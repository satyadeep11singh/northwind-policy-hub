# ── Networking ────────────────────────────────────────────────────────────────
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-jenkins-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = ["10.10.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "jenkins" {
  name                 = "snet-jenkins"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.vnet.name
  address_prefixes     = ["10.10.1.0/24"]
}

resource "azurerm_public_ip" "jenkins" {
  name                = "pip-jenkins-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = var.tags
}

resource "azurerm_network_security_group" "jenkins" {
  name                = "nsg-jenkins-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  # SSH — restrict to your IP in production (var.allowed_ssh_cidr)
  security_rule {
    name                       = "SSH"
    priority                   = 1000
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = var.allowed_ssh_cidr
    destination_address_prefix = "*"
  }

  # Jenkins UI (port 8080) — restrict after initial setup
  security_rule {
    name                       = "Jenkins-UI"
    priority                   = 1010
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8080"
    source_address_prefix      = var.allowed_ssh_cidr
    destination_address_prefix = "*"
  }

  # GitHub webhook inbound (GitHub CIDR blocks — simplified to public here)
  security_rule {
    name                       = "GitHub-Webhooks"
    priority                   = 1020
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8080"
    source_address_prefix      = "192.30.252.0/22"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "jenkins" {
  name                = "nic-jenkins-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  ip_configuration {
    name                          = "ipconfig"
    subnet_id                     = azurerm_subnet.jenkins.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.jenkins.id
  }
}

resource "azurerm_network_interface_security_group_association" "jenkins" {
  network_interface_id      = azurerm_network_interface.jenkins.id
  network_security_group_id = azurerm_network_security_group.jenkins.id
}

# ── Jenkins VM ────────────────────────────────────────────────────────────────
resource "azurerm_linux_virtual_machine" "jenkins" {
  name                = "vm-jenkins-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  size                = "Standard_B2s"   # 2 vCPU, 4 GB — sufficient for Jenkins + Docker
  admin_username      = var.admin_username
  tags                = var.tags

  # Password auth enabled for simplicity — use SSH key in production
  admin_password                  = var.admin_password
  disable_password_authentication = false

  network_interface_ids = [azurerm_network_interface.jenkins.id]

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 64
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  # cloud-init provisions Jenkins, Docker, Azure CLI, and all tooling
  custom_data = filebase64("${path.module}/../../jenkins/cloud-init.yml")
}
