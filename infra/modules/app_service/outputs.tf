output "webapp_name"           { value = azurerm_linux_web_app.app.name }
output "default_hostname"      { value = azurerm_linux_web_app.app.default_hostname }
output "identity_principal_id" { value = azurerm_linux_web_app.app.identity[0].principal_id }
output "staging_hostname"      { value = azurerm_linux_web_app_slot.staging.default_hostname }
output "dev_hostname"          { value = azurerm_linux_web_app_slot.dev.default_hostname }
