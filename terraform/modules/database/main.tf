# Database Module - PostgreSQL + Redis Infrastructure

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (dev/staging/production)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "smeta360"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for database"
  type        = list(string)
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "smeta360"
}

variable "database_username" {
  description = "Database master username"
  type        = string
  default     = "postgres"
}

variable "database_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "database_instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ deployment for RDS"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Database backup retention period"
  type        = number
  default     = 7
}

variable "allowed_security_groups" {
  description = "Security groups allowed to access database"
  type        = list(string)
  default     = []
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.environment}-${var.project_name}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-${var.project_name}-db-subnet-group"
    Environment = var.environment
  }
}

# Database Security Group
resource "aws_security_group" "database" {
  name_prefix = "${var.environment}-${var.project_name}-database-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-database-sg"
    Environment = var.environment
  }
}

# Redis Security Group
resource "aws_security_group" "redis" {
  name_prefix = "${var.environment}-${var.project_name}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  ingress {
    description = "Redis from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis-sg"
    Environment = var.environment
  }
}

# Database Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "${var.environment}-${var.project_name}-db-params"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "max_connections"
    value = var.environment == "production" ? "200" : "100"
  }

  parameter {
    name  = "work_mem"
    value = var.environment == "production" ? "16384" : "8192"
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-db-params"
    Environment = var.environment
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  allocated_storage                   = var.environment == "production" ? 100 : 20
  storage_type                       = var.environment == "production" ? "gp3" : "gp2"
  engine                             = "postgres"
  engine_version                     = "15.4"
  instance_class                     = var.database_instance_class
  identifier                         = "${var.environment}-${var.project_name}-database"
  
  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  
  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name
  
  backup_retention_period   = var.backup_retention_period
  backup_window            = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"
  auto_minor_version_upgrade = false
  
  storage_encrypted               = true
  performance_insights_enabled    = var.environment == "production"
  performance_insights_retention_period = var.environment == "production" ? 7 : null
  monitoring_interval             = var.environment == "production" ? 60 : 0
  monitoring_role_arn            = var.environment == "production" ? aws_iam_role.rds_monitoring[0].arn : null
  
  multi_az               = var.enable_multi_az
  publicly_accessible    = false
  copy_tags_to_snapshot  = true
  delete_automated_backups = false
  deletion_protection    = var.environment == "production"
  skip_final_snapshot    = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.environment}-${var.project_name}-final-snapshot" : null

  tags = {
    Name        = "${var.environment}-${var.project_name}-database"
    Environment = var.environment
  }
}

# Redis Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.environment}-${var.project_name}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis-subnet-group"
    Environment = var.environment
  }
}

# Redis Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7.x"
  name   = "${var.environment}-${var.project_name}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis-params"
    Environment = var.environment
  }
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "main" {
  replication_group_id         = "${var.environment}-${var.project_name}-redis"
  description                  = "Redis cluster for ${var.environment} environment"
  
  node_type                   = var.redis_node_type
  port                        = 6379
  parameter_group_name        = aws_elasticache_parameter_group.main.name
  
  num_cache_clusters          = var.environment == "production" ? 2 : 1
  automatic_failover_enabled  = var.environment == "production"
  multi_az_enabled           = var.environment == "production"
  
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = var.environment == "production"
  auth_token                 = var.environment == "production" ? random_password.redis_auth[0].result : null
  
  snapshot_retention_limit   = var.environment == "production" ? 5 : 1
  snapshot_window           = "03:00-05:00"
  maintenance_window        = "sun:05:00-sun:07:00"
  
  auto_minor_version_upgrade = false

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis"
    Environment = var.environment
  }
}

# Redis Auth Token (Production only)
resource "random_password" "redis_auth" {
  count   = var.environment == "production" ? 1 : 0
  length  = 32
  special = true
}

# IAM Role for RDS Enhanced Monitoring (Production only)
resource "aws_iam_role" "rds_monitoring" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.environment}-${var.project_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-${var.project_name}-rds-monitoring-role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count      = var.environment == "production" ? 1 : 0
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Secrets Manager for Database Credentials
resource "aws_secretsmanager_secret" "database_credentials" {
  name        = "${var.environment}-${var.project_name}-database-credentials"
  description = "Database credentials for ${var.environment} environment"

  tags = {
    Name        = "${var.environment}-${var.project_name}-database-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
    engine   = "postgres"
    host     = aws_db_instance.main.endpoint
    port     = aws_db_instance.main.port
    dbname   = var.database_name
    url      = "postgresql://${var.database_username}:${var.database_password}@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${var.database_name}?sslmode=require"
  })
}

# Secrets Manager for Redis Credentials
resource "aws_secretsmanager_secret" "redis_credentials" {
  count       = var.environment == "production" ? 1 : 0
  name        = "${var.environment}-${var.project_name}-redis-credentials"
  description = "Redis credentials for ${var.environment} environment"

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  count     = var.environment == "production" ? 1 : 0
  secret_id = aws_secretsmanager_secret.redis_credentials[0].id
  secret_string = jsonencode({
    host     = aws_elasticache_replication_group.main.primary_endpoint_address
    port     = aws_elasticache_replication_group.main.port
    auth_token = random_password.redis_auth[0].result
    url      = "redis://:${random_password.redis_auth[0].result}@${aws_elasticache_replication_group.main.primary_endpoint_address}:${aws_elasticache_replication_group.main.port}"
  })
}

# CloudWatch Alarms for Database
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-${var.project_name}-database-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors database cpu utilization"
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-database-cpu-alarm"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "${var.environment}-${var.project_name}-database-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.environment == "production" ? "150" : "80"
  alarm_description   = "This metric monitors database connections"
  treat_missing_data  = "breaching"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-database-connections-alarm"
    Environment = var.environment
  }
}

# CloudWatch Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.environment}-${var.project_name}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis cpu utilization"
  treat_missing_data  = "breaching"

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.main.replication_group_id
  }

  tags = {
    Name        = "${var.environment}-${var.project_name}-redis-cpu-alarm"
    Environment = var.environment
  }
}

# Outputs
output "database_endpoint" {
  description = "PostgreSQL database endpoint"
  value       = aws_db_instance.main.endpoint
}

output "database_port" {
  description = "PostgreSQL database port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = aws_db_instance.main.db_name
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "database_security_group_id" {
  description = "Database security group ID"
  value       = aws_security_group.database.id
}

output "redis_security_group_id" {
  description = "Redis security group ID"
  value       = aws_security_group.redis.id
}

output "database_secret_arn" {
  description = "Database credentials secret ARN"
  value       = aws_secretsmanager_secret.database_credentials.arn
}

output "redis_secret_arn" {
  description = "Redis credentials secret ARN"
  value       = var.environment == "production" ? aws_secretsmanager_secret.redis_credentials[0].arn : null
}