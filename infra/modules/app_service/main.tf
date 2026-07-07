resource "azurerm_service_plan" "plan" {
  name                = "asp-nw-policy-hub-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  # Standard S1 minimum — required for deployment slots
  sku_name            = "S1"
  tags                = var.tags
}

resource "azurerm_linux_web_app" "app" {
  name                = "nw-policy-hub-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.plan.id

  # System-assigned Managed Identity — used to pull from ACR and read Key Vault
  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                         = true
    health_check_path                 = "/health"
    health_check_eviction_time_in_min = 5
    http2_enabled                     = true

    application_stack {
      docker_image_name        = "northwind-policy-hub:latest"
      docker_registry_url      = "https://${var.acr_login_server}"
      docker_registry_username = null  # MI auth — no username needed
      docker_registry_password = null
    }
  }

  app_settings = {
    # App Service pulls the image; MI handles registry auth
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"   = "false"
    "DOCKER_ENABLE_CI"                       = "true"

    # Key Vault reference pattern — App Service resolves at runtime via MI
    "KEY_VAULT_URI"                          = var.key_vault_uri
    "NODE_ENV"                               = "production"
    "PORT"                                   = "8080"
    "WEBSITES_PORT"                          = "8080"

    # Application Insights — also stored in Key Vault but injected here
    # so App Service SDK auto-wiring works on startup
    "APPLICATIONINSIGHTS_CONNECTION_STRING"  = var.app_insights_conn
  }

  logs {
    http_logs {
      retention_in_days = 7
    }
    application_logs {
      file_system_level = "Information"
    }
  }

  tags = var.tags
}

# Grant Managed Identity AcrPull on the container registry
resource "azurerm_role_assignment" "acr_pull" {
  scope                = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.ContainerRegistry/registries/${var.acr_name}"
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.app.identity[0].principal_id
}

data "azurerm_subscription" "current" {}

# ── Deployment slots ──────────────────────────────────────────────────────────

resource "azurerm_linux_web_app_slot" "staging" {
  name           = "staging"
  app_service_id = azurerm_linux_web_app.app.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on         = false  # staging slot can sleep to save cost
    health_check_path = "/health"
    http2_enabled     = true

    application_stack {
      docker_image_name = "northwind-policy-hub:staging"
      docker_registry_url      = "https://${var.acr_login_server}"
      docker_registry_username = null
      docker_registry_password = null
    }
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
    "KEY_VAULT_URI"                       = var.key_vault_uri
    "NODE_ENV"                            = "staging"
    "PORT"                                = "8080"
    "WEBSITES_PORT"                       = "8080"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = var.app_insights_conn
  }

  tags = var.tags
}

# dev slot — used by Jenkins CD as the first deploy target
resource "azurerm_linux_web_app_slot" "dev" {
  name           = "dev"
  app_service_id = azurerm_linux_web_app.app.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on         = false
    health_check_path = "/health"
    http2_enabled     = true

    application_stack {
      docker_image_name = "northwind-policy-hub:dev"
      docker_registry_url      = "https://${var.acr_login_server}"
      docker_registry_username = null
      docker_registry_password = null
    }
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
    "KEY_VAULT_URI"                       = var.key_vault_uri
    "NODE_ENV"                            = "development"
    "PORT"                                = "8080"
    "WEBSITES_PORT"                       = "8080"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = var.app_insights_conn
  }

  tags = var.tags
}
