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

  backend "azurerm" {
    resource_group_name  = "rg-northwind-tfstate"
    storage_account_name = "stnorthwindtf676746"
    container_name       = "tfstate"
    key                  = "northwind-policy-hub.tfstate"
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
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

locals {
  common_tags = {
    project     = "northwind-policy-hub"
    environment = var.environment
    managed_by  = "terraform"
  }
  suffix = random_id.suffix.hex
}

# ── Resource Group ─────────────────────────────────────────────────────────────
resource "azurerm_resource_group" "app" {
  name     = "rg-northwind-policy-hub-${var.environment}"
  location = var.location
  tags     = local.common_tags
}

# ── Azure Container Registry ───────────────────────────────────────────────────
resource "azurerm_container_registry" "acr" {
  name                = "acrnwpolicyhub${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.common_tags
}

# ── Networking (Jenkins VM) ────────────────────────────────────────────────────
resource "azurerm_virtual_network" "jenkins" {
  name                = "vnet-nw-policy-hub-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  address_space       = ["10.0.0.0/16"]
  tags                = local.common_tags
}

resource "azurerm_subnet" "jenkins" {
  name                 = "snet-jenkins"
  resource_group_name  = azurerm_resource_group.app.name
  virtual_network_name = azurerm_virtual_network.jenkins.name
  address_prefixes     = ["10.0.1.0/24"]
}

resource "azurerm_network_security_group" "jenkins" {
  name                = "nsg-jenkins-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  tags                = local.common_tags

  # SSH
  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Jenkins UI
  security_rule {
    name                       = "AllowJenkinsUI"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8080"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "jenkins" {
  subnet_id                 = azurerm_subnet.jenkins.id
  network_security_group_id = azurerm_network_security_group.jenkins.id
}

resource "azurerm_public_ip" "jenkins" {
  name                = "pip-jenkins-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.common_tags
}

resource "azurerm_network_interface" "jenkins" {
  name                = "nic-jenkins-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  tags                = local.common_tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.jenkins.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.jenkins.id
  }
}

# ── Jenkins VM ─────────────────────────────────────────────────────────────────
resource "azurerm_linux_virtual_machine" "jenkins" {
  name                  = "vm-nw-jenkins-${local.suffix}"
  resource_group_name   = azurerm_resource_group.app.name
  location              = var.location
  size                  = "Standard_B2s"
  admin_username        = "azureuser"
  network_interface_ids = [azurerm_network_interface.jenkins.id]
  tags                  = local.common_tags

  admin_ssh_key {
    username   = "azureuser"
    public_key = var.jenkins_ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 64
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(file("${path.module}/../jenkins/cloud-init.yml"))
}

# ── Service Principal → ACR push permission (for Jenkins) ─────────────────────
resource "azurerm_role_assignment" "jenkins_acr_push" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPush"
  principal_id         = var.jenkins_sp_object_id
}

# ── App Service Plan (F1 Free Linux) ──────────────────────────────────────────
resource "azurerm_service_plan" "plan" {
  name                = "asp-nw-policy-hub-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "F1"
  tags                = local.common_tags
}

# ── Linux Web App ──────────────────────────────────────────────────────────────
resource "azurerm_linux_web_app" "app" {
  name                = "nw-policy-hub-${local.suffix}"
  resource_group_name = azurerm_resource_group.app.name
  location            = var.location
  service_plan_id     = azurerm_service_plan.plan.id
  https_only          = true
  tags                = local.common_tags

  site_config {
    always_on = false

    application_stack {
      node_version = "20-lts"
    }

    app_command_line = "node server/index.js"
  }

  app_settings = {
    NODE_ENV                       = "production"
    PORT                           = "8080"
    MONGODB_URI                    = var.mongodb_uri
    JWT_SECRET                     = var.jwt_secret
    JWT_EXPIRES_IN                 = "8h"
    WEBSITES_PORT                  = "8080"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
  }
}
