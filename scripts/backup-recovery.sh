#!/bin/bash

# SMETA360-2 Automated Backup and Recovery System
# Phase 4 Step 2: Database Backup with Recovery Procedures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/opt/smeta360/backups"
DATABASE_URL="${DATABASE_URL:-}"
REDIS_URL="${REDIS_URL:-}"
AWS_S3_BUCKET="${BACKUP_S3_BUCKET:-smeta360-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local missing_tools=()
    
    command -v pg_dump >/dev/null 2>&1 || missing_tools+=("pg_dump")
    command -v redis-cli >/dev/null 2>&1 || missing_tools+=("redis-cli")
    command -v aws >/dev/null 2>&1 || missing_tools+=("aws")
    command -v gpg >/dev/null 2>&1 || missing_tools+=("gpg")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    if [ -z "$REDIS_URL" ]; then
        log_error "REDIS_URL environment variable is required"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log_success "Prerequisites check passed"
}

create_database_backup() {
    local backup_type=${1:-"full"}
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="database_${backup_type}_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.sql"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.gpg"
    
    log_info "Creating database backup: $backup_name"
    
    # Parse database URL
    local db_url_parsed=$(python3 -c "
import urllib.parse as urlparse
import sys
url = urlparse.urlparse('$DATABASE_URL')
print(f'{url.hostname} {url.port or 5432} {url.username} {url.password} {url.path[1:]}')
")
    
    read -r db_host db_port db_user db_pass db_name <<< "$db_url_parsed"
    
    # Set password for pg_dump
    export PGPASSWORD="$db_pass"
    
    try {
        # Create database backup
        if [ "$backup_type" = "schema" ]; then
            pg_dump --host="$db_host" --port="$db_port" --username="$db_user" \
                    --dbname="$db_name" --schema-only --no-password \
                    --verbose --file="$backup_file"
        elif [ "$backup_type" = "data" ]; then
            pg_dump --host="$db_host" --port="$db_port" --username="$db_user" \
                    --dbname="$db_name" --data-only --no-password \
                    --verbose --file="$backup_file"
        else
            # Full backup
            pg_dump --host="$db_host" --port="$db_port" --username="$db_user" \
                    --dbname="$db_name" --no-password --verbose \
                    --file="$backup_file"
        fi
        
        # Compress backup
        log_info "Compressing backup..."
        gzip "$backup_file"
        
        # Encrypt backup if encryption key provided
        if [ -n "$ENCRYPTION_KEY" ]; then
            log_info "Encrypting backup..."
            echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
                --symmetric --cipher-algo AES256 \
                --output "$encrypted_file" "$compressed_file"
            rm "$compressed_file"
            backup_final_file="$encrypted_file"
        else
            backup_final_file="$compressed_file"
        fi
        
        # Calculate checksum
        local checksum=$(sha256sum "$backup_final_file" | cut -d' ' -f1)
        echo "$checksum  $(basename "$backup_final_file")" > "${backup_final_file}.sha256"
        
        # Get file size
        local file_size=$(du -h "$backup_final_file" | cut -f1)
        
        log_success "Database backup created: $(basename "$backup_final_file") (${file_size})"
        log_info "Checksum: $checksum"
        
        # Upload to S3 if configured
        if [ -n "$AWS_S3_BUCKET" ]; then
            upload_to_s3 "$backup_final_file"
            upload_to_s3 "${backup_final_file}.sha256"
        fi
        
        echo "$backup_final_file"
        
    } catch {
        log_error "Database backup failed: $?"
        rm -f "$backup_file" "$compressed_file" "$encrypted_file"
        exit 1
    } finally {
        unset PGPASSWORD
    }
}

create_redis_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="redis_${timestamp}"
    local backup_file="$BACKUP_DIR/${backup_name}.rdb"
    local compressed_file="${backup_file}.gz"
    local encrypted_file="${compressed_file}.gpg"
    
    log_info "Creating Redis backup: $backup_name"
    
    # Parse Redis URL
    local redis_host=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local redis_port=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
    local redis_auth=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/:\([^@]*\)@.*/\1/p')
    
    redis_host=${redis_host:-localhost}
    redis_port=${redis_port:-6379}
    
    try {
        # Create Redis backup using BGSAVE
        if [ -n "$redis_auth" ]; then
            redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_auth" BGSAVE
        else
            redis-cli -h "$redis_host" -p "$redis_port" BGSAVE
        fi
        
        # Wait for backup to complete
        log_info "Waiting for Redis backup to complete..."
        while true; do
            if [ -n "$redis_auth" ]; then
                local status=$(redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_auth" LASTSAVE)
            else
                local status=$(redis-cli -h "$redis_host" -p "$redis_port" LASTSAVE)
            fi
            
            sleep 2
            
            if [ -n "$redis_auth" ]; then
                local new_status=$(redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_auth" LASTSAVE)
            else
                local new_status=$(redis-cli -h "$redis_host" -p "$redis_port" LASTSAVE)
            fi
            
            if [ "$status" != "$new_status" ]; then
                break
            fi
        done
        
        # Copy RDB file (this is simplified - in production you'd need to access Redis data directory)
        log_warning "Redis backup creation requires access to Redis data directory"
        log_warning "This is typically handled by Redis persistence configuration"
        
        # For demonstration, create a Redis dump using redis-cli
        if [ -n "$redis_auth" ]; then
            redis-cli -h "$redis_host" -p "$redis_port" -a "$redis_auth" --rdb "$backup_file"
        else
            redis-cli -h "$redis_host" -p "$redis_port" --rdb "$backup_file"
        fi
        
        # Compress backup
        log_info "Compressing Redis backup..."
        gzip "$backup_file"
        
        # Encrypt backup if encryption key provided
        if [ -n "$ENCRYPTION_KEY" ]; then
            log_info "Encrypting Redis backup..."
            echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
                --symmetric --cipher-algo AES256 \
                --output "$encrypted_file" "$compressed_file"
            rm "$compressed_file"
            backup_final_file="$encrypted_file"
        else
            backup_final_file="$compressed_file"
        fi
        
        # Calculate checksum
        local checksum=$(sha256sum "$backup_final_file" | cut -d' ' -f1)
        echo "$checksum  $(basename "$backup_final_file")" > "${backup_final_file}.sha256"
        
        # Get file size
        local file_size=$(du -h "$backup_final_file" | cut -f1)
        
        log_success "Redis backup created: $(basename "$backup_final_file") (${file_size})"
        log_info "Checksum: $checksum"
        
        # Upload to S3 if configured
        if [ -n "$AWS_S3_BUCKET" ]; then
            upload_to_s3 "$backup_final_file"
            upload_to_s3 "${backup_final_file}.sha256"
        fi
        
        echo "$backup_final_file"
        
    } catch {
        log_error "Redis backup failed: $?"
        rm -f "$backup_file" "$compressed_file" "$encrypted_file"
        exit 1
    }
}

upload_to_s3() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    local s3_key="backups/$(date +%Y/%m/%d)/$file_name"
    
    log_info "Uploading to S3: s3://$AWS_S3_BUCKET/$s3_key"
    
    aws s3 cp "$file_path" "s3://$AWS_S3_BUCKET/$s3_key" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    if [ $? -eq 0 ]; then
        log_success "Upload completed: $file_name"
    else
        log_error "Upload failed: $file_name"
        return 1
    fi
}

restore_database() {
    local backup_file="$1"
    local target_database="${2:-}"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file path is required"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring database from: $(basename "$backup_file")"
    
    # Parse database URL
    local db_url_parsed=$(python3 -c "
import urllib.parse as urlparse
import sys
url = urlparse.urlparse('$DATABASE_URL')
print(f'{url.hostname} {url.port or 5432} {url.username} {url.password} {url.path[1:]}')
")
    
    read -r db_host db_port db_user db_pass db_name <<< "$db_url_parsed"
    
    # Use target database if provided
    if [ -n "$target_database" ]; then
        db_name="$target_database"
    fi
    
    # Set password for psql
    export PGPASSWORD="$db_pass"
    
    # Verify checksum if available
    if [ -f "${backup_file}.sha256" ]; then
        log_info "Verifying backup checksum..."
        if sha256sum -c "${backup_file}.sha256"; then
            log_success "Checksum verification passed"
        else
            log_error "Checksum verification failed"
            exit 1
        fi
    fi
    
    try {
        # Decrypt if needed
        local restore_file="$backup_file"
        if [[ "$backup_file" == *.gpg ]]; then
            if [ -z "$ENCRYPTION_KEY" ]; then
                log_error "Encryption key required for encrypted backup"
                exit 1
            fi
            
            local decrypted_file="${backup_file%.gpg}"
            echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
                --decrypt --output "$decrypted_file" "$backup_file"
            restore_file="$decrypted_file"
        fi
        
        # Decompress if needed
        if [[ "$restore_file" == *.gz ]]; then
            local uncompressed_file="${restore_file%.gz}"
            gunzip -c "$restore_file" > "$uncompressed_file"
            restore_file="$uncompressed_file"
        fi
        
        # Create database if it doesn't exist
        psql --host="$db_host" --port="$db_port" --username="$db_user" \
             --dbname="postgres" --no-password \
             -c "CREATE DATABASE \"$db_name\";" 2>/dev/null || true
        
        # Restore database
        log_info "Restoring database to: $db_name"
        psql --host="$db_host" --port="$db_port" --username="$db_user" \
             --dbname="$db_name" --no-password \
             --file="$restore_file" --verbose
        
        log_success "Database restore completed"
        
        # Cleanup temporary files
        if [[ "$restore_file" != "$backup_file" ]]; then
            rm -f "$restore_file"
        fi
        
    } catch {
        log_error "Database restore failed: $?"
        exit 1
    } finally {
        unset PGPASSWORD
    }
}

restore_redis() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file path is required"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring Redis from: $(basename "$backup_file")"
    
    # Parse Redis URL
    local redis_host=$(echo "$REDIS_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local redis_port=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
    local redis_auth=$(echo "$REDIS_URL" | sed -n 's/redis:\/\/:\([^@]*\)@.*/\1/p')
    
    redis_host=${redis_host:-localhost}
    redis_port=${redis_port:-6379}
    
    log_warning "Redis restore requires Redis server restart with restored RDB file"
    log_warning "This operation should be performed by Redis administrator"
    
    # For demonstration, we'll show the process
    log_info "Redis restore process:"
    log_info "1. Stop Redis server"
    log_info "2. Replace dump.rdb with backup file"
    log_info "3. Start Redis server"
    log_info "4. Verify data integrity"
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "*.sql.gz*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.rdb.gz*" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.sha256" -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup if configured
    if [ -n "$AWS_S3_BUCKET" ]; then
        log_info "Cleaning up S3 backups older than $RETENTION_DAYS days..."
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        
        aws s3api list-objects-v2 --bucket "$AWS_S3_BUCKET" --prefix "backups/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" --output text | \
        while read -r key; do
            if [ -n "$key" ]; then
                aws s3 rm "s3://$AWS_S3_BUCKET/$key"
                log_info "Deleted: s3://$AWS_S3_BUCKET/$key"
            fi
        done
    fi
    
    log_success "Backup cleanup completed"
}

list_backups() {
    log_info "Local backups in $BACKUP_DIR:"
    ls -lah "$BACKUP_DIR"/*.{sql,rdb}.gz* 2>/dev/null || log_info "No local backups found"
    
    if [ -n "$AWS_S3_BUCKET" ]; then
        log_info "S3 backups in s3://$AWS_S3_BUCKET/backups/:"
        aws s3 ls "s3://$AWS_S3_BUCKET/backups/" --recursive --human-readable
    fi
}

verify_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file path is required"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_info "Verifying backup: $(basename "$backup_file")"
    
    # Check file integrity
    if [ -f "${backup_file}.sha256" ]; then
        if sha256sum -c "${backup_file}.sha256"; then
            log_success "Checksum verification passed"
        else
            log_error "Checksum verification failed"
            return 1
        fi
    else
        log_warning "No checksum file found"
    fi
    
    # Try to read the backup file
    if [[ "$backup_file" == *.gpg ]]; then
        if [ -z "$ENCRYPTION_KEY" ]; then
            log_error "Encryption key required to verify encrypted backup"
            return 1
        fi
        
        echo "$ENCRYPTION_KEY" | gpg --batch --yes --passphrase-fd 0 \
            --decrypt "$backup_file" | head -n 10 > /dev/null
        
        if [ $? -eq 0 ]; then
            log_success "Encrypted backup can be decrypted"
        else
            log_error "Failed to decrypt backup"
            return 1
        fi
    elif [[ "$backup_file" == *.gz ]]; then
        if gunzip -t "$backup_file"; then
            log_success "Compressed backup is valid"
        else
            log_error "Compressed backup is corrupted"
            return 1
        fi
    else
        if head -n 10 "$backup_file" > /dev/null; then
            log_success "Backup file is readable"
        else
            log_error "Backup file is corrupted"
            return 1
        fi
    fi
    
    log_success "Backup verification completed"
}

# Helper functions for error handling
try() {
    "$@"
}

catch() {
    case $? in
        0) ;;
        *) return $? ;;
    esac
}

finally() {
    :
}

# Main script logic
main() {
    local command="$1"
    shift
    
    case "$command" in
        "backup-database")
            check_prerequisites
            create_database_backup "$@"
            ;;
        "backup-redis")
            check_prerequisites
            create_redis_backup "$@"
            ;;
        "backup-all")
            check_prerequisites
            log_info "Starting full backup..."
            create_database_backup "full"
            create_redis_backup
            cleanup_old_backups
            log_success "Full backup completed"
            ;;
        "restore-database")
            check_prerequisites
            restore_database "$@"
            ;;
        "restore-redis")
            check_prerequisites
            restore_redis "$@"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "verify")
            verify_backup "$@"
            ;;
        *)
            echo "SMETA360-2 Backup and Recovery System"
            echo ""
            echo "Usage: $0 [COMMAND] [OPTIONS]"
            echo ""
            echo "Commands:"
            echo "  backup-database [type]    Create database backup (full/schema/data)"
            echo "  backup-redis             Create Redis backup"
            echo "  backup-all               Create full system backup"
            echo "  restore-database <file>  Restore database from backup"
            echo "  restore-redis <file>     Restore Redis from backup"
            echo "  list                     List available backups"
            echo "  cleanup                  Remove old backups"
            echo "  verify <file>            Verify backup integrity"
            echo ""
            echo "Environment Variables:"
            echo "  DATABASE_URL             Database connection URL"
            echo "  REDIS_URL                Redis connection URL"
            echo "  BACKUP_S3_BUCKET         S3 bucket for backup storage"
            echo "  BACKUP_RETENTION_DAYS    Backup retention period (default: 30)"
            echo "  BACKUP_ENCRYPTION_KEY    Encryption key for backups"
            echo ""
            echo "Examples:"
            echo "  $0 backup-all"
            echo "  $0 backup-database schema"
            echo "  $0 restore-database /opt/smeta360/backups/database_full_20251007_120000.sql.gz"
            echo "  $0 verify /opt/smeta360/backups/database_full_20251007_120000.sql.gz"
            ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi