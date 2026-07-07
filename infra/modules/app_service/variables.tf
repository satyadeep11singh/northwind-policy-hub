variable "resource_group_name" { type = string }
variable "location"            { type = string }
variable "suffix"              { type = string }
variable "environment"         { type = string }
variable "acr_login_server"    { type = string }
variable "acr_name"            { type = string }
variable "key_vault_uri"       { type = string }
variable "app_insights_conn"   { type = string sensitive = true }
variable "tags"                { type = map(string) }
