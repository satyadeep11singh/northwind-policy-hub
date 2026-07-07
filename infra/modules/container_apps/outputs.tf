output "prod_fqdn" {
  value = azurerm_container_app.app["prod"].ingress[0].fqdn
}

output "staging_fqdn" {
  value = azurerm_container_app.app["staging"].ingress[0].fqdn
}

output "dev_fqdn" {
  value = azurerm_container_app.app["dev"].ingress[0].fqdn
}

output "prod_app_name" {
  value = azurerm_container_app.app["prod"].name
}

# UAI principal ID — used to grant Key Vault access
output "uai_principal_id" {
  value = azurerm_user_assigned_identity.acr_pull.principal_id
}
