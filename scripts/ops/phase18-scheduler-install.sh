#!/bin/bash
#
# Phase 18: Continuous Validation Framework - Cron Installation
#
# Installs Phase 18 validation tasks into crontab:
# - Health checks every 10 minutes
# - E2E smoke tests every 6 hours
# - Self-heal worker as background service
#
# Usage:
#   bash scripts/ops/phase18-scheduler-install.sh
#   bash scripts/ops/phase18-scheduler-install.sh --alert-webhook-slack "https://..."
#
# Date: 2025-11-10
# Author: Unit Talk Ops
# Version: 1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
ALERT_WEBHOOK_SLACK=""
ALERT_WEBHOOK_DISCORD=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --alert-webhook-slack)
            ALERT_WEBHOOK_SLACK="$2"
            shift 2
            ;;
        --alert-webhook-discord)
            ALERT_WEBHOOK_DISCORD="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Get workspace root
WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CRON_DIR="/etc/cron.d"
CRON_FILE="phase18-continuous-validator"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Phase 18: Continuous Validation Framework - Cron Installation  ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Running as root${NC}"
echo ""

# Build common arguments
COMMON_ARGS=""
if [[ -n "$ALERT_WEBHOOK_SLACK" ]]; then
    COMMON_ARGS="$COMMON_ARGS --alert-webhook-slack \"$ALERT_WEBHOOK_SLACK\""
fi
if [[ -n "$ALERT_WEBHOOK_DISCORD" ]]; then
    COMMON_ARGS="$COMMON_ARGS --alert-webhook-discord \"$ALERT_WEBHOOK_DISCORD\""
fi

# Create cron file
echo -e "${YELLOW}📝 Creating cron configuration...${NC}"

cat > "/tmp/$CRON_FILE" << 'EOF'
# Phase 18: Continuous Validation Framework
# Generated: $(date)

# Health checks every 10 minutes
*/10 * * * * root cd WORKSPACE_ROOT && npm run ops:phase18:run -- --dry-run --verbose COMMON_ARGS >> /var/log/phase18-health.log 2>&1

# E2E smoke tests every 6 hours (at 00:00, 06:00, 12:00, 18:00)
0 */6 * * * root cd WORKSPACE_ROOT && npm run ops:phase18:run -- --dry-run --verbose COMMON_ARGS >> /var/log/phase18-e2e.log 2>&1

# Self-heal worker (runs continuously, restarts if killed)
@reboot root cd WORKSPACE_ROOT && npm run ops:phase18:self-heal-worker -- --interval 60000 COMMON_ARGS >> /var/log/phase18-self-heal.log 2>&1
EOF

# Replace placeholders
sed -i "s|WORKSPACE_ROOT|$WORKSPACE_ROOT|g" "/tmp/$CRON_FILE"
sed -i "s|COMMON_ARGS|$COMMON_ARGS|g" "/tmp/$CRON_FILE"

# Install cron file
echo -e "${YELLOW}Installing cron file...${NC}"
if [[ -d "$CRON_DIR" ]]; then
    cp "/tmp/$CRON_FILE" "$CRON_DIR/$CRON_FILE"
    chmod 644 "$CRON_DIR/$CRON_FILE"
    echo -e "${GREEN}  ✅ Cron file installed to $CRON_DIR/$CRON_FILE${NC}"
else
    echo -e "${YELLOW}  ⚠️  $CRON_DIR not found, using crontab instead${NC}"
    
    # Backup existing crontab
    CRONTAB_BACKUP="/tmp/crontab.backup.$(date +%s)"
    crontab -l > "$CRONTAB_BACKUP" 2>/dev/null || true
    echo -e "${YELLOW}  📋 Crontab backup: $CRONTAB_BACKUP${NC}"
    
    # Add new cron entries
    (crontab -l 2>/dev/null || true; cat "/tmp/$CRON_FILE") | crontab -
    echo -e "${GREEN}  ✅ Cron entries added to crontab${NC}"
fi

# Create log directory
echo -e "${YELLOW}📁 Creating log directory...${NC}"
mkdir -p /var/log/phase18
chmod 755 /var/log/phase18
echo -e "${GREEN}  ✅ Log directory created${NC}"

# Create systemd service for self-heal worker (optional, for better process management)
if command -v systemctl &> /dev/null; then
    echo -e "${YELLOW}📦 Creating systemd service for self-heal worker...${NC}"
    
    cat > "/tmp/phase18-self-heal.service" << EOF
[Unit]
Description=Phase 18 Self-Heal Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$WORKSPACE_ROOT
ExecStart=/bin/bash -c 'npm run ops:phase18:self-heal-worker -- --interval 60000 $COMMON_ARGS'
Restart=always
RestartSec=10
StandardOutput=append:/var/log/phase18/self-heal.log
StandardError=append:/var/log/phase18/self-heal.log

[Install]
WantedBy=multi-user.target
EOF
    
    cp "/tmp/phase18-self-heal.service" "/etc/systemd/system/phase18-self-heal.service"
    systemctl daemon-reload
    systemctl enable phase18-self-heal.service
    echo -e "${GREEN}  ✅ Systemd service installed${NC}"
fi

# Verify installation
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Installation Summary                                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [[ -f "$CRON_DIR/$CRON_FILE" ]]; then
    echo -e "${GREEN}✅ Cron file installed${NC}"
    echo -e "${YELLOW}📋 Cron entries:${NC}"
    cat "$CRON_DIR/$CRON_FILE" | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
else
    echo -e "${GREEN}✅ Crontab entries added${NC}"
    echo -e "${YELLOW}📋 Current crontab:${NC}"
    crontab -l | grep -v "^#" | grep -v "^$" | sed 's/^/  /'
fi

echo ""
echo -e "${YELLOW}📊 Log files:${NC}"
echo -e "  • /var/log/phase18/health.log"
echo -e "  • /var/log/phase18/e2e.log"
echo -e "  • /var/log/phase18/self-heal.log"
echo ""

echo -e "${YELLOW}🔍 To view cron logs:${NC}"
echo -e "  tail -f /var/log/phase18/*.log"
echo ""

echo -e "${YELLOW}▶️  To run a task manually:${NC}"
echo -e "  cd $WORKSPACE_ROOT && npm run ops:phase18:run -- --dry-run --verbose"
echo ""

if command -v systemctl &> /dev/null; then
    echo -e "${YELLOW}🔧 To manage self-heal service:${NC}"
    echo -e "  systemctl status phase18-self-heal"
    echo -e "  systemctl start phase18-self-heal"
    echo -e "  systemctl stop phase18-self-heal"
    echo ""
fi

echo -e "${GREEN}✅ Phase 18 scheduler installation complete!${NC}"
exit 0

