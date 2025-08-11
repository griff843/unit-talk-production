#!/bin/bash

# Unit Talk Production - Startup Deployment Script
# This script automates the complete production deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="unit-talk-production"
DOMAIN="your-domain.com"
DROPLET_SIZE="s-1vcpu-2gb"
DROPLET_REGION="nyc3"
DROPLET_IMAGE="ubuntu-22-04-x64"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check for doctl
    if ! command_exists doctl; then
        print_error "DigitalOcean CLI (doctl) not found. Please install it first:"
        echo "https://docs.digitalocean.com/reference/doctl/how-to/install/"
        exit 1
    fi
    
    # Check for docker
    if ! command_exists docker; then
        print_error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    # Check for docker-compose
    if ! command_exists docker-compose; then
        print_error "Docker Compose not found. Please install Docker Compose first."
        exit 1
    fi
    
    # Check for required environment variables
    required_vars=("DIGITALOCEAN_ACCESS_TOKEN" "SUPABASE_URL" "SUPABASE_ANON_KEY" "DISCORD_TOKEN")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Environment variable $var is not set"
            exit 1
        fi
    done
    
    print_success "All prerequisites met"
}

# Function to create DigitalOcean droplet
create_droplet() {
    print_status "Creating DigitalOcean droplet..."
    
    # Generate SSH key if it doesn't exist
    if [ ! -f ~/.ssh/id_rsa ]; then
        print_status "Generating SSH key..."
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    fi
    
    # Import SSH key to DigitalOcean
    SSH_KEY_ID=$(doctl compute ssh-key import unit-talk-key --public-key-file ~/.ssh/id_rsa.pub --format ID --no-header)
    
    # Create droplet
    DROPLET_ID=$(doctl compute droplet create $PROJECT_NAME \
        --size $DROPLET_SIZE \
        --region $DROPLET_REGION \
        --image $DROPLET_IMAGE \
        --ssh-keys $SSH_KEY_ID \
        --format ID --no-header)
    
    print_status "Waiting for droplet to be ready..."
    sleep 30
    
    # Get droplet IP
    DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)
    
    print_success "Droplet created with IP: $DROPLET_IP"
    echo "DROPLET_ID=$DROPLET_ID" > .env.deployment
    echo "DROPLET_IP=$DROPLET_IP" >> .env.deployment
}

# Function to setup server
setup_server() {
    print_status "Setting up server..."
    
    source .env.deployment
    
    # Wait for SSH to be available
    print_status "Waiting for SSH to be available..."
    while ! ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@$DROPLET_IP exit 2>/dev/null; do
        sleep 5
    done
    
    # Update system and install dependencies
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << 'EOF'
        # Update system
        apt update && apt upgrade -y
        
        # Install Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        
        # Install Docker Compose
        curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        
        # Install Nginx
        apt install -y nginx certbot python3-certbot-nginx
        
        # Create application directory
        mkdir -p /opt/$PROJECT_NAME
        chown -R $SUDO_USER:$SUDO_USER /opt/$PROJECT_NAME
        
        # Setup firewall
        ufw allow OpenSSH
        ufw allow 'Nginx Full'
        ufw --force enable
EOF
    
    print_success "Server setup completed"
}

# Function to deploy application
deploy_application() {
    print_status "Deploying application..."
    
    source .env.deployment
    
    # Create production environment file
    cat > .env.production << EOF
NODE_ENV=production
PORT=3000

# Database
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Discord
DISCORD_TOKEN=$DISCORD_TOKEN
DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID
DISCORD_GUILD_ID=$DISCORD_GUILD_ID

# Security
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Monitoring
UPTIME_ROBOT_WEBHOOK=$UPTIME_ROBOT_WEBHOOK
DISCORD_WEBHOOK=$DISCORD_WEBHOOK

# Redis
REDIS_URL=redis://localhost:6379
EOF
    
    # Copy files to server
    scp -o StrictHostKeyChecking=no docker-compose.yml root@$DROPLET_IP:/opt/$PROJECT_NAME/
    scp -o StrictHostKeyChecking=no Dockerfile root@$DROPLET_IP:/opt/$PROJECT_NAME/
    scp -o StrictHostKeyChecking=no nginx.conf root@$DROPLET_IP:/opt/$PROJECT_NAME/
    scp -o StrictHostKeyChecking=no .env.production root@$DROPLET_IP:/opt/$PROJECT_NAME/.env
    
    # Deploy application
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << EOF
        cd /opt/$PROJECT_NAME
        
        # Build and start containers
        docker-compose down || true
        docker-compose up -d --build
        
        # Wait for application to be ready
        sleep 30
        
        # Check health
        curl -f http://localhost/health || exit 1
EOF
    
    print_success "Application deployed successfully"
}

# Function to setup SSL certificate
setup_ssl() {
    print_status "Setting up SSL certificate..."
    
    source .env.deployment
    
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << EOF
        # Stop nginx temporarily
        systemctl stop nginx
        
        # Get SSL certificate
        certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        
        # Start nginx
        systemctl start nginx
        
        # Setup auto-renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
EOF
    
    print_success "SSL certificate configured"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    source .env.deployment
    
    # Create monitoring script
    cat > scripts/monitor.sh << 'EOF'
#!/bin/bash

# Health check script
HEALTH_URL="https://$DOMAIN/health"
WEBHOOK_URL="$DISCORD_WEBHOOK"

# Check health
response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ "$response" != "200" ]; then
    # Send Discord alert
    curl -H "Content-Type: application/json" \
         -X POST \
         -d "{\"content\":\"🚨 **System Alert**: Health check failed for $DOMAIN (Status: $response)\"}" \
         $WEBHOOK_URL
fi
EOF
    
    chmod +x scripts/monitor.sh
    
    # Setup cron job for monitoring
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << EOF
        # Add monitoring cron job
        echo "*/5 * * * * /opt/$PROJECT_NAME/scripts/monitor.sh" | crontab -
EOF
    
    print_success "Monitoring configured"
}

# Function to setup backups
setup_backups() {
    print_status "Setting up backup system..."
    
    source .env.deployment
    
    # Create backup script
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash

# Backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database (if using Supabase, this would be via their API)
# For now, we'll backup application data
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /opt/$PROJECT_NAME

# Keep only last 7 days
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +7 -delete
EOF
    
    chmod +x scripts/backup.sh
    
    # Setup daily backup cron job
    ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << EOF
        # Add backup cron job
        echo "0 2 * * * /opt/$PROJECT_NAME/scripts/backup.sh" | crontab -
EOF
    
    print_success "Backup system configured"
}

# Function to run tests
run_tests() {
    print_status "Running deployment tests..."
    
    source .env.deployment
    
    # Test health endpoint
    if curl -f https://$DOMAIN/health; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        exit 1
    fi
    
    # Test Discord bot
    if ssh -o StrictHostKeyChecking=no root@$DROPLET_IP "docker logs $PROJECT_NAME-discord-bot-1 2>&1 | grep -q 'Ready'"; then
        print_success "Discord bot is running"
    else
        print_warning "Discord bot may not be ready yet"
    fi
    
    print_success "All tests passed"
}

# Function to display deployment info
display_info() {
    print_status "Deployment completed successfully!"
    
    source .env.deployment
    
    echo ""
    echo "=== Deployment Information ==="
    echo "Domain: https://$DOMAIN"
    echo "Server IP: $DROPLET_IP"
    echo "Health Check: https://$DOMAIN/health"
    echo ""
    echo "=== Next Steps ==="
    echo "1. Update DNS records to point $DOMAIN to $DROPLET_IP"
    echo "2. Configure Discord bot in your Discord server"
    echo "3. Set up UptimeRobot monitoring"
    echo "4. Test the complete system"
    echo ""
    echo "=== Useful Commands ==="
    echo "View logs: ssh root@$DROPLET_IP 'docker-compose logs -f'"
    echo "Restart app: ssh root@$DROPLET_IP 'cd /opt/$PROJECT_NAME && docker-compose restart'"
    echo "Update app: ./scripts/update.sh"
    echo ""
}

# Main deployment function
main() {
    echo "🚀 Unit Talk Production - Startup Deployment"
    echo "============================================="
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Create droplet
    create_droplet
    
    # Setup server
    setup_server
    
    # Deploy application
    deploy_application
    
    # Setup SSL (only if domain is configured)
    if [ "$DOMAIN" != "your-domain.com" ]; then
        setup_ssl
    else
        print_warning "SSL setup skipped - please configure domain first"
    fi
    
    # Setup monitoring
    setup_monitoring
    
    # Setup backups
    setup_backups
    
    # Run tests
    run_tests
    
    # Display information
    display_info
    
    print_success "Deployment completed! 🎉"
}

# Run main function
main "$@" 