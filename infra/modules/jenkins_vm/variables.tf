variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "suffix"              { type = string }
variable "admin_username"      { type = string }
variable "admin_password"      { type = string  sensitive = true }
variable "allowed_ssh_cidr"    { type = string  default = "*" }  # restrict in prod
variable "tags"                { type = map(string) }
