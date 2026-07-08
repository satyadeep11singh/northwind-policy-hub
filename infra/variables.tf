variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "australiaeast"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "mongodb_uri" {
  description = "MongoDB Atlas connection string"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "jenkins_ssh_public_key" {
  description = "SSH public key for the Jenkins VM (contents of ~/.ssh/id_rsa.pub or similar)"
  type        = string
}

variable "jenkins_sp_object_id" {
  description = "Object ID of the Service Principal used by Jenkins (for AcrPush role assignment)"
  type        = string
}
