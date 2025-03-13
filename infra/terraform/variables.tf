/**
 * Variables for the Bland.AI MCP Terraform configuration
 */

variable "aws_region" {
  description = "AWS region to deploy resources"
  default     = "us-east-1"
}

variable "app_name" {
  description = "Application name"
  default     = "bland-ai-mcp"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  default     = "dev"
}

# Network configuration
variable "vpc_id" {
  description = "VPC ID for deploying resources"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for EC2 instance"
  type        = string
}

variable "key_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
}

# Application secrets
variable "bland_api_key" {
  description = "Bland.AI Enterprise API Key"
  type        = string
  sensitive   = true
}

variable "bland_default_voice" {
  description = "Default voice for Bland.AI calls"
  type        = string
  default     = "ai-morgan"
}

variable "bland_default_from_number" {
  description = "Default from number for Bland.AI calls"
  type        = string
}

variable "bland_default_model" {
  description = "Default model for Bland.AI calls"
  type        = string
  default     = "gpt-4o"
}

variable "bland_default_temperature" {
  description = "Default temperature for Bland.AI calls"
  type        = number
  default     = 0.7
}

variable "bland_default_voicemail_action" {
  description = "Default voicemail action for Bland.AI calls"
  type        = string
  default     = "continue"
}

variable "bland_answered_by_enabled" {
  description = "Whether to enable the answered by detection"
  type        = bool
  default     = true
}

# Supabase configuration
variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_service_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anon key"
  type        = string
  sensitive   = true
}

# Google Sheets configuration
variable "google_sheets_doc_id" {
  description = "Google Sheets document ID"
  type        = string
}

variable "google_sheets_client_email" {
  description = "Google Sheets service account email"
  type        = string
}

variable "google_sheets_private_key" {
  description = "Google Sheets service account private key"
  type        = string
  sensitive   = true
}

# JWT secret for authentication
variable "jwt_secret" {
  description = "Secret for JWT token generation"
  type        = string
  sensitive   = true
}

# Application scaling
variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "lambda_memory_size" {
  description = "Memory allocation for Lambda function"
  type        = number
  default     = 256
}

variable "lambda_timeout" {
  description = "Timeout for Lambda function in seconds"
  type        = number
  default     = 300
} 