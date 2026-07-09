output "app_url" {
  description = "App Service URL"
  value       = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "app_name" {
  description = "App Service name (for az webapp deploy)"
  value       = azurerm_linux_web_app.app.name
}

output "resource_group" {
  description = "Resource group name"
  value       = azurerm_resource_group.app.name
}

output "acr_name" {
  description = "ACR name (set as Jenkins credential acr-name)"
  value       = azurerm_container_registry.acr.name
}

output "acr_login_server" {
  description = "ACR login server (set as Jenkins credential acr-login-server)"
  value       = azurerm_container_registry.acr.login_server
}

output "jenkins_public_ip" {
  description = "Jenkins VM public IP — open http://<ip>:8080 after cloud-init finishes (~10 min)"
  value       = azurerm_public_ip.jenkins.ip_address
}

output "jenkins_ssh" {
  description = "SSH command to connect to Jenkins VM"
  value       = "ssh azureuser@${azurerm_public_ip.jenkins.ip_address}"
}

output "app_insights_name" {
  description = "Application Insights resource name"
  value       = azurerm_application_insights.main.name
}

output "app_insights_instrumentation_key" {
  description = "Application Insights instrumentation key"
  value       = azurerm_application_insights.main.instrumentation_key
  sensitive   = true
}
