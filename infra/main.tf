terraform {
  required_version = ">= 1.8.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.110"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Reuse the shared tfstate backend from the northwind project suite
  backend "azurerm" {
    resource_group_name  = "rg-northwind-tfstate"
    storage_account_name = "stnorthwindtf676746"
    container_name       = "tfstate"
    key                  = "northwind-policy-hub.tfstate"
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

data "azurerm_client_config" "current" {}

resource "random_id" "suffix" {
  byte_length = 3
}

# ── Resource groups ────────────────────────────────────────────────────────────
resource "azurerm_resource_group" "app" {
  name     = "rg-northwind-policy-hub-${var.environment}"
  location = var.location
  tags     = local.common_tags
}

resource "azurerm_resource_group" "jenkins" {
  name     = "rg-northwind-jenkins-${var.environment}"
  location = var.location
  tags     = local.common_tags
}

locals {
  common_tags = {
    project     = "northwind-policy-hub"
    environment = var.environment
    managed_by  = "terraform"
  }
  suffix = random_id.suffix.hex
}

# ── Modules ────────────────────────────────────────────────────────────────────

module "acr" {
  source              = "./modules/acr"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  suffix              = local.suffix
  tags                = local.common_tags
}

module "app_insights" {
  source              = "./modules/app_insights"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  suffix              = local.suffix
  tags                = local.common_tags
}

module "key_vault" {
  source              = "./modules/key_vault"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  suffix              = local.suffix
  tenant_id           = data.azurerm_client_config.current.tenant_id
  deployer_object_id  = data.azurerm_client_config.current.object_id
  tags                = local.common_tags
}

module "container_apps" {
  source                     = "./modules/container_apps"
  resource_group_name        = azurerm_resource_group.app.name
  location                   = var.location
  suffix                     = local.suffix
  acr_login_server           = module.acr.login_server
  acr_name                   = module.acr.name
  key_vault_uri              = module.key_vault.vault_uri
  app_insights_conn          = module.app_insights.connection_string
  log_analytics_workspace_id = module.app_insights.log_analytics_workspace_id
  tags                       = local.common_tags

  depends_on = [module.acr, module.key_vault, module.app_insights]
}

module "jenkins_vm" {
  source              = "./modules/jenkins_vm"
  resource_group_name = azurerm_resource_group.jenkins.name
  location            = var.location
  suffix              = local.suffix
  admin_username      = var.jenkins_admin_username
  admin_password      = var.jenkins_admin_password
  tags                = local.common_tags
}

# ── Key Vault secrets (populated after initial deploy) ────────────────────────

resource "azurerm_key_vault_secret" "mongodb_uri" {
  name         = "mongodb-uri"
  value        = var.mongodb_uri
  key_vault_id = module.key_vault.vault_id
  tags         = local.common_tags
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = var.jwt_secret
  key_vault_id = module.key_vault.vault_id
  tags         = local.common_tags
}

resource "azurerm_key_vault_secret" "appinsights_conn" {
  name         = "appinsights-connection-string"
  value        = module.app_insights.connection_string
  key_vault_id = module.key_vault.vault_id
  tags         = local.common_tags
}

# ── Grant the shared UAI (used by all container apps) access to Key Vault ────
resource "azurerm_key_vault_access_policy" "container_app" {
  key_vault_id = module.key_vault.vault_id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = module.container_apps.uai_principal_id

  secret_permissions = ["Get", "List"]
}
