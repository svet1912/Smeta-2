# SMETA360-2 Infrastructure as Code

Terraform модули для автоматизированного развертывания SMETA360-2 в облачной инфраструктуре.

## 📁 Структура

```
terraform/
├── modules/
│   ├── database/          # PostgreSQL + Redis модуль
│   ├── application/       # ECS/Fargate deployment
│   ├── networking/        # VPC, subnets, security groups
│   ├── monitoring/        # CloudWatch, Prometheus
│   └── security/          # IAM, secrets, SSL
├── environments/
│   ├── staging/          # Staging окружение
│   ├── production/       # Production окружение
│   └── development/      # Development окружение
├── terraform.tf          # Provider configuration
├── variables.tf          # Global variables
├── outputs.tf            # Global outputs
└── README.md            # Этот файл
```

## 🚀 Quick Start

### Предварительные требования

```bash
# Установить Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform

# Установить AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Настроить AWS credentials
aws configure
```

### Развертывание staging окружения

```bash
cd terraform/environments/staging
terraform init
terraform plan
terraform apply
```

### Развертывание production окружения

```bash
cd terraform/environments/production
terraform init
terraform plan
terraform apply
```

## 🏗️ Модули

### Database Module
**Файл**: `modules/database/main.tf`

**Ресурсы**:
- RDS PostgreSQL с Multi-AZ
- ElastiCache Redis cluster
- Automated backups
- Performance monitoring
- Security groups

**Переменные**:
```hcl
variable "environment" {
  description = "Environment name (staging/production)"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "smeta360"
}

variable "instance_class" {
  description = "RDS instance type"
  type        = string
  default     = "db.t3.micro"
}
```

### Application Module
**Файл**: `modules/application/main.tf`

**Ресурсы**:
- ECS Cluster с Fargate
- Load Balancer (ALB)
- Auto Scaling
- CloudWatch Logs
- ECR repositories

### Networking Module
**Файл**: `modules/networking/main.tf`

**Ресурсы**:
- VPC с public/private subnets
- Internet Gateway
- NAT Gateways для HA
- Route Tables
- Security Groups

### Monitoring Module
**Файл**: `modules/monitoring/main.tf`

**Ресурсы**:
- CloudWatch Dashboards
- Alarms для критичных метрик
- SNS topics для alerts
- Log Groups с retention

### Security Module
**Файл**: `modules/security/main.tf`

**Ресурсы**:
- IAM roles и policies
- AWS Secrets Manager
- SSL сертификаты (ACM)
- WAF rules

## 🎯 Окружения

### Development
**Конфигурация**: Минимальные ресурсы для разработки
```hcl
# environments/development/terraform.tfvars
environment = "dev"
instance_count = 1
database_instance_class = "db.t3.micro"
redis_node_type = "cache.t3.micro"
```

### Staging  
**Конфигурация**: Копия production с меньшими ресурсами
```hcl
# environments/staging/terraform.tfvars
environment = "staging"
instance_count = 2
database_instance_class = "db.t3.small"
redis_node_type = "cache.t3.small"
```

### Production
**Конфигурация**: High availability и performance
```hcl
# environments/production/terraform.tfvars
environment = "production"
instance_count = 3
database_instance_class = "db.r5.large"
redis_node_type = "cache.r5.large"
enable_multi_az = true
```

## 📊 Ресурсы по окружениям

| Ресурс | Development | Staging | Production |
|--------|-------------|---------|------------|
| **ECS Tasks** | 1 | 2 | 3-10 (auto-scaling) |
| **RDS** | db.t3.micro | db.t3.small | db.r5.large (Multi-AZ) |
| **Redis** | cache.t3.micro | cache.t3.small | cache.r5.large (cluster) |
| **Load Balancer** | ALB | ALB | ALB + WAF |
| **Monitoring** | Basic | Enhanced | Full observability |

## 🔧 Конфигурация

### Provider Configuration
```hcl
# terraform.tf
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "smeta360-terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "SMETA360-2"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
```

### Global Variables
```hcl
# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "smeta360"
}
```

## 🚦 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/infrastructure.yml
name: Infrastructure Deployment

on:
  push:
    branches: [main]
    paths: ['terraform/**']

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        with:
          terraform_version: 1.5.0
          
      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/production
        
      - name: Terraform Plan
        run: terraform plan
        working-directory: terraform/environments/production
        
      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: terraform apply -auto-approve
        working-directory: terraform/environments/production
```

## 🔒 Безопасность

### Secrets Management
```hcl
# Secrets в AWS Secrets Manager
resource "aws_secretsmanager_secret" "database_credentials" {
  name = "${var.environment}-smeta360-database-credentials"
  
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  secret_string = jsonencode({
    username = var.database_username
    password = var.database_password
  })
}
```

### Security Groups
```hcl
# Database security group
resource "aws_security_group" "database" {
  name_prefix = "${var.environment}-database-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.application.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## 📈 Мониторинг и Алерты

### CloudWatch Alarms
```hcl
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.environment}-database-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors database cpu utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }
}
```

### Application Metrics
```hcl
resource "aws_cloudwatch_log_group" "application" {
  name              = "/ecs/${var.environment}-smeta360"
  retention_in_days = var.environment == "production" ? 30 : 7
}
```

## 💰 Cost Optimization

### Resource Scheduling
```hcl
# Auto-scaling for non-production
resource "aws_autoscaling_schedule" "scale_down_evening" {
  count                  = var.environment != "production" ? 1 : 0
  scheduled_action_name  = "scale-down-evening"
  min_size               = 0
  max_size               = 0
  desired_capacity       = 0
  recurrence             = "0 18 * * MON-FRI"
  autoscaling_group_name = aws_autoscaling_group.main.name
}

resource "aws_autoscaling_schedule" "scale_up_morning" {
  count                  = var.environment != "production" ? 1 : 0
  scheduled_action_name  = "scale-up-morning"
  min_size               = 1
  max_size               = 3
  desired_capacity       = 1
  recurrence             = "0 8 * * MON-FRI"
  autoscaling_group_name = aws_autoscaling_group.main.name
}
```

## 🔄 Backup и Disaster Recovery

### Automated Backups
```hcl
resource "aws_db_instance" "main" {
  # ... other configuration
  
  backup_retention_period   = var.environment == "production" ? 30 : 7
  backup_window            = "03:00-04:00"
  maintenance_window       = "sun:04:00-sun:05:00"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false
  deletion_protection      = var.environment == "production"
}
```

### Cross-Region Replication
```hcl
# Production only - read replica in different region
resource "aws_db_instance" "replica" {
  count                     = var.environment == "production" ? 1 : 0
  identifier                = "${var.environment}-smeta360-replica"
  replicate_source_db       = aws_db_instance.main.id
  instance_class           = var.database_instance_class
  publicly_accessible     = false
  auto_minor_version_upgrade = false
}
```

## 🛠️ Команды управления

### Развертывание
```bash
# Инициализация
terraform init

# Планирование изменений
terraform plan -var-file="terraform.tfvars"

# Применение изменений
terraform apply -var-file="terraform.tfvars"

# Уничтожение ресурсов
terraform destroy -var-file="terraform.tfvars"
```

### Управление состоянием
```bash
# Просмотр состояния
terraform show

# Список ресурсов
terraform state list

# Импорт существующего ресурса
terraform import aws_instance.example i-1234567890abcdef0
```

### Отладка
```bash
# Подробное логирование
export TF_LOG=DEBUG
terraform apply

# Валидация конфигурации
terraform validate

# Форматирование кода
terraform fmt -recursive
```

## 📋 Чек-лист развертывания

### Pre-deployment
- [ ] AWS credentials настроены
- [ ] S3 bucket для state создан
- [ ] Переменные окружения проверены
- [ ] Terraform план проанализирован

### Post-deployment
- [ ] Приложение доступно через Load Balancer
- [ ] Database connectivity проверено
- [ ] Monitoring и alarms настроены
- [ ] SSL сертификаты активны
- [ ] Backup процедуры работают

### Security checklist
- [ ] Security groups ограничивают доступ
- [ ] Secrets в AWS Secrets Manager
- [ ] IAM roles имеют минимальные права
- [ ] WAF rules активны (production)
- [ ] CloudTrail логирование включено

## 📚 Дополнительные ресурсы

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)