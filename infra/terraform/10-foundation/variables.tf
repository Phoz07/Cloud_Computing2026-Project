variable "account_id" {
  description = "AWS account ID. Guards against applying with stale credentials for another account."
  type        = string
  default     = "735838417080"
}

variable "region" {
  description = "AWS region. Learner Lab is us-east-1 only."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Name prefix for all resources."
  type        = string
  default     = "eventide"
}

variable "services" {
  description = "The microservices that each get an ECR repo."
  type        = list(string)
  default     = ["auth", "event", "registration", "payment", "mail-worker"]
}

variable "tool_images" {
  description = "Non-service images that get an ECR repo but no Secrets Manager secret (one-shot Jobs, the static SPA)."
  type        = list(string)
  default     = ["db-bootstrap", "web"]
}

