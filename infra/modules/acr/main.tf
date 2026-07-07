resource "azurerm_container_registry" "acr" {
  name                = "nwpolicyhub${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = false   # admin disabled — Jenkins uses SP, App Service uses MI

  tags = var.tags
}
