data "azurerm_subscription" "current" {}

# User-Assigned Managed Identity — used by all three container apps to pull from ACR
# (azurerm v3.x registry block only accepts UAI resource IDs, not "system")
resource "azurerm_user_assigned_identity" "acr_pull" {
  name                = "mi-nw-policy-hub-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

# Grant the UAI AcrPull on the container registry
resource "azurerm_role_assignment" "acr_pull" {
  scope                = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.ContainerRegistry/registries/${var.acr_name}"
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.acr_pull.principal_id
}

# Container Apps Environment — shared across dev/staging/prod
# Log Analytics workspace linked for observability
resource "azurerm_container_app_environment" "env" {
  name                       = "cae-nw-policy-hub-${var.suffix}"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = var.tags
}

locals {
  envs = {
    dev     = { node_env = "development", image_tag = "dev",     min_replicas = 0, max_replicas = 1 }
    staging = { node_env = "staging",     image_tag = "staging", min_replicas = 0, max_replicas = 1 }
    prod    = { node_env = "production",  image_tag = "latest",  min_replicas = 0, max_replicas = 2 }
  }
}

resource "azurerm_container_app" "app" {
  for_each = local.envs

  name                         = "ca-nw-policy-hub-${each.key}-${var.suffix}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"
  tags                         = var.tags

  # UAI used for both ACR pull and Key Vault access
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.acr_pull.id]
  }

  # ACR pull via User-Assigned MI (v3.x requires UAI resource ID)
  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.acr_pull.id
  }

  template {
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas

    container {
      name   = "northwind-policy-hub"
      image  = "${var.acr_login_server}/northwind-policy-hub:${each.value.image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "NODE_ENV"
        value = each.value.node_env
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "KEY_VAULT_URI"
        value = var.key_vault_uri
      }
      env {
        name        = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        secret_name = "appinsights-conn"
      }
    }
  }

  secret {
    name  = "appinsights-conn"
    value = var.app_insights_conn
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 8080
    transport                  = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}
