output "connection_string"  { value = azurerm_application_insights.ai.connection_string sensitive = true }
output "instrumentation_key" { value = azurerm_application_insights.ai.instrumentation_key sensitive = true }
output "id"                 { value = azurerm_application_insights.ai.id }
