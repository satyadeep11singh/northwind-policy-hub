resource "azurerm_key_vault" "kv" {
  name                        = "kv-nw-hub-${var.suffix}"
  resource_group_name         = var.resource_group_name
  location                    = var.location
  tenant_id                   = var.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false   # set true for production workloads

  # Allow the Terraform deployer to manage secrets during provisioning
  access_policy {
    tenant_id = var.tenant_id
    object_id = var.deployer_object_id

    secret_permissions = ["Get", "Set", "Delete", "List", "Purge", "Recover"]
  }

  tags = var.tags
}
