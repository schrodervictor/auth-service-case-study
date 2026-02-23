variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
}

# --- Networking ---

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block for security group ingress rules"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for RDS and ElastiCache"
  type        = list(string)
}

# --- EKS / IRSA ---

variable "eks_oidc_provider_arn" {
  description = "ARN of the EKS OIDC identity provider"
  type        = string
}

variable "eks_oidc_provider_url" {
  description = "EKS OIDC issuer URL without the https:// prefix"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes namespace where the app runs"
  type        = string
  default     = "default"
}

variable "k8s_service_account" {
  description = "Kubernetes service account name for the app"
  type        = string
  default     = "marta"
}

# --- RDS ---

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "case_study_db"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

# --- ElastiCache ---

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

# --- Secrets (written to SSM) ---

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "database_user" {
  description = "PostgreSQL master username"
  type        = string
  sensitive   = true
}

variable "database_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}
