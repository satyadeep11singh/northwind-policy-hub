data "azurerm_subscription" "current" {}

# Single F1 plan — free tier, shared across all three environments
resource "azurerm_service_plan" "plan" {
  name                = "asp-nw-policy-hub-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  # F1 free tier — no deployment slots; dev/staging/prod as separate web apps
  sku_name            = "F1"
  tags                = var.tags
}

# ── Per-environment web apps ──────────────────────────────────────────────────

locals {
  envs = {
    dev     = { node_env = "development", image_tag = "dev" }
    staging = { node_env = "staging",     image_tag = "staging" }
    prod    = { node_env = "production",  image_tag = "latest" }
  }
}

resource "azurerm_linux_web_app" "env" {
  for_each = local.envs

  name                = "nw-policy-hub-${each.key}-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = azurerm_service_plan.plan.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    # F1 doesn't support always_on or health_check_path
    always_on     = false
    http2_enabled = true

    application_stack {
      docker_image_name        = "northwind-policy-hub:${each.value.image_tag}"
      docker_registry_url      = "https://${var.acr_login_server}"
      docker_registry_username = null
      docker_registry_password = null
    }
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE"  = "false"
    "DOCKER_ENABLE_CI"                     = "true"
    "KEY_VAULT_URI"                        = var.key_vault_uri
    "NODE_ENV"                             = each.value.node_env
    "PORT"                                 = "8080"
    "WEBSITES_PORT"                        = "8080"
    "APPLICATIONINSIGHTS_CONNECTION_STRING" = var.app_insights_conn
  }

  logs {
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 35
      }
    }
    application_logs {
      file_system_level = "Information"
    }
  }

  tags = var.tags
}

# Grant each app's Managed Identity AcrPull on the container registry
resource "azurerm_role_assignment" "acr_pull" {
  for_each = local.envs

  scope                = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.ContainerRegistry/registries/${var.acr_name}"
  role_definition_name = "AcrPull"
  principal_id         = azurerm_linux_web_app.env[each.key].identity[0].principal_id
}
