variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "suffix" {
  type = string
}

variable "tenant_id" {
  type = string
}

variable "deployer_object_id" {
  type = string
}

variable "tags" {
  type = map(string)
}
