output "app_url" {
  description = "Production Container App URL"
  value       = "https://${module.container_apps.prod_fqdn}"
}

output "app_dev_url" {
  description = "Dev Container App URL"
  value       = "https://${module.container_apps.dev_fqdn}"
}

output "app_staging_url" {
  description = "Staging Container App URL"
  value       = "https://${module.container_apps.staging_fqdn}"
}

output "prod_app_name" {
  value = module.container_apps.prod_app_name
}

output "acr_login_server" {
  description = "ACR login server for Docker push/pull"
  value       = module.acr.login_server
}

output "acr_name" {
  value = module.acr.name
}

output "key_vault_uri" {
  description = "Key Vault URI for app configuration"
  value       = module.key_vault.vault_uri
}

output "jenkins_public_ip" {
  description = "Public IP of Jenkins VM"
  value       = module.jenkins_vm.public_ip
}

output "app_insights_connection_string" {
  description = "Application Insights connection string"
  value       = module.app_insights.connection_string
  sensitive   = true
}

output "resource_group_app" {
  value = azurerm_resource_group.app.name
}
