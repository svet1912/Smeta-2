#!/bin/bash

# SMETA360-2 Blue-Green Deployment Script
# Phase 4 Step 1: DevOps & Deployment Automation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.blue-green.yml"
DEPLOYMENT_MANAGER_URL="http://localhost:3000"
APP_IMAGE="smeta360/app"
DEFAULT_TAG="latest"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if compose file exists
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $DOCKER_COMPOSE_FILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

start_infrastructure() {
    log_info "Starting Blue-Green infrastructure..."
    
    # Start all services except apps (they will be managed by deployment manager)
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis nginx-lb prometheus grafana deployment-manager
    
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check if deployment manager is ready
    for i in {1..12}; do
        if curl -s "$DEPLOYMENT_MANAGER_URL/health" > /dev/null 2>&1; then
            log_success "Deployment manager is ready"
            break
        fi
        
        if [ $i -eq 12 ]; then
            log_error "Deployment manager failed to start"
            exit 1
        fi
        
        log_info "Waiting for deployment manager... ($i/12)"
        sleep 10
    done
}

deploy_application() {
    local image_tag=${1:-$DEFAULT_TAG}
    
    log_info "Deploying application with tag: $image_tag"
    
    # Prepare deployment payload
    local payload=$(cat <<EOF
{
  "image": "$APP_IMAGE",
  "tag": "$image_tag",
  "healthCheckPath": "/api/monitoring/health",
  "healthCheckTimeout": 300000,
  "rollbackOnFailure": true
}
EOF
)
    
    # Start deployment
    local response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$DEPLOYMENT_MANAGER_URL/api/deployment/deploy")
    
    local deployment_id=$(echo "$response" | jq -r '.deploymentId // empty')
    
    if [ -z "$deployment_id" ]; then
        log_error "Failed to start deployment"
        echo "$response" | jq '.'
        exit 1
    fi
    
    log_success "Deployment started with ID: $deployment_id"
    
    # Monitor deployment progress
    monitor_deployment
}

monitor_deployment() {
    log_info "Monitoring deployment progress..."
    
    local max_attempts=60  # 5 minutes with 5-second intervals
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local status_response=$(curl -s "$DEPLOYMENT_MANAGER_URL/api/deployment/status")
        local deploying=$(echo "$status_response" | jq -r '.deploying')
        local last_deployment_status=$(echo "$status_response" | jq -r '.lastDeployment.status // "unknown"')
        
        if [ "$deploying" = "false" ]; then
            if [ "$last_deployment_status" = "completed" ]; then
                log_success "Deployment completed successfully!"
                
                # Show deployment details
                local active_environment=$(echo "$status_response" | jq -r '.active')
                local deployment_duration=$(echo "$status_response" | jq -r '.lastDeployment.duration // "unknown"')
                
                log_success "Active environment: $active_environment"
                log_success "Deployment duration: ${deployment_duration}ms"
                
                return 0
            elif [ "$last_deployment_status" = "failed" ]; then
                log_error "Deployment failed!"
                
                # Show error details
                local error_message=$(echo "$status_response" | jq -r '.lastDeployment.error // "unknown"')
                log_error "Error: $error_message"
                
                return 1
            fi
        fi
        
        log_info "Deployment in progress... ($((attempt + 1))/$max_attempts)"
        sleep 5
        ((attempt++))
    done
    
    log_error "Deployment monitoring timeout"
    return 1
}

rollback_deployment() {
    log_info "Rolling back deployment..."
    
    local response=$(curl -s -X POST "$DEPLOYMENT_MANAGER_URL/api/deployment/rollback")
    local status=$(echo "$response" | jq -r '.status // "unknown"')
    
    if [ "$status" = "success" ]; then
        local new_active=$(echo "$response" | jq -r '.newActive // "unknown"')
        log_success "Rollback completed. Active environment: $new_active"
    else
        log_error "Rollback failed"
        echo "$response" | jq '.'
        exit 1
    fi
}

show_status() {
    log_info "Getting deployment status..."
    
    local status_response=$(curl -s "$DEPLOYMENT_MANAGER_URL/api/deployment/status")
    
    if [ $? -eq 0 ]; then
        echo "$status_response" | jq '.'
    else
        log_error "Failed to get deployment status"
        exit 1
    fi
}

show_history() {
    local limit=${1:-10}
    
    log_info "Getting deployment history (last $limit deployments)..."
    
    local history_response=$(curl -s "$DEPLOYMENT_MANAGER_URL/api/deployment/history?limit=$limit")
    
    if [ $? -eq 0 ]; then
        echo "$history_response" | jq '.'
    else
        log_error "Failed to get deployment history"
        exit 1
    fi
}

stop_infrastructure() {
    log_info "Stopping Blue-Green infrastructure..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    log_success "Infrastructure stopped"
}

show_logs() {
    local service=${1:-"deployment-manager"}
    
    log_info "Showing logs for service: $service"
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f "$service"
}

show_help() {
    cat <<EOF
SMETA360-2 Blue-Green Deployment Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start                   Start Blue-Green infrastructure
    deploy [TAG]           Deploy application (default tag: latest)
    rollback               Rollback to previous version
    status                 Show deployment status
    history [LIMIT]        Show deployment history (default: 10)
    stop                   Stop infrastructure
    logs [SERVICE]         Show service logs (default: deployment-manager)
    help                   Show this help message

Examples:
    $0 start                    # Start infrastructure
    $0 deploy v1.2.0           # Deploy version v1.2.0
    $0 deploy                  # Deploy latest version
    $0 rollback                # Rollback deployment
    $0 status                  # Check status
    $0 history 5               # Show last 5 deployments
    $0 logs nginx-lb           # Show nginx logs

Environment Variables:
    APP_IMAGE              Docker image name (default: smeta360/app)
    DEPLOYMENT_MANAGER_URL Deployment manager URL (default: http://localhost:3000)

EOF
}

# Main script logic
case "$1" in
    "start")
        check_prerequisites
        start_infrastructure
        ;;
    "deploy")
        deploy_application "$2"
        ;;
    "rollback")
        rollback_deployment
        ;;
    "status")
        show_status
        ;;
    "history")
        show_history "$2"
        ;;
    "stop")
        stop_infrastructure
        ;;
    "logs")
        show_logs "$2"
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac