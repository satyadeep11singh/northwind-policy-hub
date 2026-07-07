output "public_ip"  { value = azurerm_public_ip.jenkins.ip_address }
output "vm_name"    { value = azurerm_linux_virtual_machine.jenkins.name }
