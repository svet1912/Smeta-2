# Production Environment Configuration

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "smeta360-terraform-state-prod"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
    
    dynamodb_table = "smeta360-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "SMETA360-2"
      Environment = "production"
      ManagedBy   = "Terraform"
      Owner       = "DevOps Team"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "smeta360"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "smeta360.com"
}

variable "database_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

# Local values
locals {
  environment = "production"
  
  common_tags = {
    Project     = var.project_name
    Environment = local.environment
  }
}

# Networking Module
module "networking" {
  source = "../../modules/networking"
  
  environment     = local.environment
  project_name    = var.project_name
  aws_region      = var.aws_region
  
  vpc_cidr             = "10.0.0.0/16"
  public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = false
}

# Security Module
module "security" {
  source = "../../modules/security"
  
  environment     = local.environment
  project_name    = var.project_name
  domain_name     = var.domain_name
  
  vpc_id = module.networking.vpc_id
}

# Database Module
module "database" {
  source = "../../modules/database"
  
  environment             = local.environment
  project_name            = var.project_name
  vpc_id                  = module.networking.vpc_id
  private_subnet_ids      = module.networking.private_subnet_ids
  
  database_name           = "smeta360_prod"
  database_username       = "postgres"
  database_password       = var.database_password
  database_instance_class = "db.r5.large"
  redis_node_type         = "cache.r5.large"
  
  enable_multi_az         = true
  backup_retention_period = 30
  
  allowed_security_groups = [module.application.application_security_group_id]
}

# Application Module  
module "application" {
  source = "../../modules/application"
  
  environment     = local.environment
  project_name    = var.project_name
  
  vpc_id              = module.networking.vpc_id
  public_subnet_ids   = module.networking.public_subnet_ids
  private_subnet_ids  = module.networking.private_subnet_ids
  
  # Application Configuration
  app_image           = "smeta360/app:latest"
  app_port            = 3000
  desired_count       = 3
  min_capacity        = 2
  max_capacity        = 10
  
  cpu                 = 1024
  memory              = 2048
  
  # Environment Variables
  environment_variables = {
    NODE_ENV     = "production"
    PORT         = "3000"
    JWT_SECRET   = var.jwt_secret
    DATABASE_URL = "postgresql://${module.database.database_username}:${var.database_password}@${module.database.database_endpoint}:${module.database.database_port}/${module.database.database_name}?sslmode=require"
    REDIS_URL    = "redis://${module.database.redis_endpoint}:${module.database.redis_port}"
  }
  
  # Health Check
  health_check_path              = "/api/monitoring/health"
  health_check_interval          = 30
  health_check_timeout           = 10
  health_check_healthy_threshold = 2
  
  # Load Balancer
  certificate_arn    = module.security.ssl_certificate_arn
  enable_waf        = true
  
  # Auto Scaling
  scale_up_threshold    = 70
  scale_down_threshold  = 30
  scale_up_cooldown     = 300
  scale_down_cooldown   = 300
}

# Monitoring Module
module "monitoring" {
  source = "../../modules/monitoring"
  
  environment     = local.environment
  project_name    = var.project_name
  
  # Application Monitoring
  ecs_cluster_name     = module.application.ecs_cluster_name
  ecs_service_name     = module.application.ecs_service_name
  load_balancer_arn    = module.application.load_balancer_arn
  target_group_arn     = module.application.target_group_arn
  
  # Database Monitoring
  database_instance_id = module.database.database_instance_id
  redis_cluster_id     = module.database.redis_cluster_id
  
  # Alerting
  alert_email         = "alerts@smeta360.com"
  slack_webhook_url   = var.slack_webhook_url
  
  # Thresholds
  cpu_threshold_high    = 80
  memory_threshold_high = 85
  error_rate_threshold  = 5
  response_time_threshold = 2000
}

# Backup Module
module "backup" {
  source = "../../modules/backup"
  
  environment     = local.environment
  project_name    = var.project_name
  
  # Database Backups
  database_instance_id = module.database.database_instance_id
  backup_retention_days = 30
  backup_schedule      = "cron(0 2 * * ? *)" # Daily at 2 AM
  
  # Application Data Backups
  s3_bucket_name = "${var.project_name}-${local.environment}-backups"
  
  # Cross-Region Replication
  enable_cross_region_backup = true
  backup_region             = "us-west-2"
}

# Outputs
output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

output "load_balancer_dns" {
  description = "Load balancer DNS name"
  value       = module.application.load_balancer_dns_name
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.database_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "Redis endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.application.ecs_cluster_name
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.monitoring.dashboard_url
}

# Additional Variables for Secrets
variable "slack_webhook_url" {
  description = "Slack webhook URL for alerts"
  type        = string
  sensitive   = true
  default     = ""
}