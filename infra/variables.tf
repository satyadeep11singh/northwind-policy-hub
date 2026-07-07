variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "canadacentral"
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "jenkins_admin_username" {
  description = "Admin username for Jenkins VM"
  type        = string
  default     = "azureuser"
}

variable "jenkins_admin_password" {
  description = "Admin password for Jenkins VM (set via TF_VAR_ env var or CI secret)"
  type        = string
  sensitive   = true
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string (stored in Key Vault)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret (min 32 chars, stored in Key Vault)"
  type        = string
  sensitive   = true
}
