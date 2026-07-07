output "webapp_name" {
  value = azurerm_linux_web_app.env["prod"].name
}

output "default_hostname" {
  value = azurerm_linux_web_app.env["prod"].default_hostname
}

output "dev_hostname" {
  value = azurerm_linux_web_app.env["dev"].default_hostname
}

output "staging_hostname" {
  value = azurerm_linux_web_app.env["staging"].default_hostname
}

# Map of env → principal_id for Key Vault access policies
output "identity_principal_ids" {
  value = { for k, v in azurerm_linux_web_app.env : k => v.identity[0].principal_id }
}

# Keep single output for backwards compat with root main.tf (uses prod)
output "identity_principal_id" {
  value = azurerm_linux_web_app.env["prod"].identity[0].principal_id
}
