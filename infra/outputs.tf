output "app_service_url" {
  description = "Default hostname of the App Service"
  value       = "https://${module.app_service.default_hostname}"
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
  description = "Public IP of Jenkins VM (use for initial setup only — restrict NSG after)"
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

output "webapp_name" {
  value = module.app_service.webapp_name
}
