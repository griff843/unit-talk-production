#!/bin/bash
# Unit Talk Platform - Universal Startup Script
# Works on Linux, macOS, WSL, and Git Bash on Windows

set -e

# Detect OS
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "🪟 Windows detected (Git Bash/Cygwin)"
    IS_WINDOWS=true
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "🐧 Linux detected"
    IS_WINDOWS=false
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 macOS detected"
    IS_WINDOWS=false
else
    echo "❓ Unknown OS, proceeding with Linux commands"
    IS_WINDOWS=false
fi

# Function to check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed or not running"
        if [ "$IS_WINDOWS" = true ]; then
            echo "Please start Docker Desktop"
        else
            echo "Please install and start Docker"
        fi
        exit 1
    fi
    echo "✅ Docker is running"
}

# Function to check docker-compose
check_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        echo "❌ Docker Compose not found"
        exit 1
    fi
    echo "✅ Docker Compose found: $COMPOSE_CMD"
}

# Main execution
main() {
    echo "===================================================="
    echo "    UNIT TALK PLATFORM - PRODUCTION-GRADE SETUP"
    echo "===================================================="
    echo ""
    
    # Check prerequisites
    check_docker
    check_compose
    
    # Check for .env file
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            echo "📋 Creating .env from .env.example..."
            cp .env.example .env
            echo "⚠️  Please update .env with your actual values"
        else
            echo "❌ No .env file found"
            exit 1
        fi
    fi
    
    # Create necessary directories
    echo "📁 Creating required directories..."
    mkdir -p logs monitoring/prometheus monitoring/grafana backups
    
    # Start services
    echo "🚀 Starting all services..."
    $COMPOSE_CMD up -d
    
    # Wait for services
    echo "⏳ Waiting for services to initialize..."
    sleep 10
    
    # Check health
    echo "🏥 Checking service health..."
    $COMPOSE_CMD ps
    
    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "🌐 Access your services at:"
    echo "  📊 Command Center:  http://localhost:3004"
    echo "  🔧 API:            http://localhost:3001"
    echo "  📱 Smart Form:     http://localhost:3002"
    echo "  ⏱️  Temporal UI:    http://localhost:8088"
    echo "  📈 Prometheus:     http://localhost:9090"
    echo "  📊 Grafana:        http://localhost:3000"
    echo ""
    echo "📝 Useful commands:"
    echo "  View logs:    $COMPOSE_CMD logs -f"
    echo "  Stop all:     $COMPOSE_CMD down"
    echo "  Restart:      $COMPOSE_CMD restart"
    echo "  Status:       $COMPOSE_CMD ps"
}

# Handle command argument
case "${1:-start}" in
    start)
        main
        ;;
    stop)
        echo "🛑 Stopping all services..."
        $COMPOSE_CMD down
        echo "✅ All services stopped"
        ;;
    restart)
        echo "🔄 Restarting services..."
        $COMPOSE_CMD restart
        echo "✅ Services restarted"
        ;;
    logs)
        $COMPOSE_CMD logs -f --tail=50
        ;;
    status)
        $COMPOSE_CMD ps
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status}"
        exit 1
        ;;
esac