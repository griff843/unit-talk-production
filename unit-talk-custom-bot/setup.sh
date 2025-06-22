#!/bin/bash

# Unit Talk Discord Bot - Quick Start Script
# This script helps you set up and run the bot quickly

set -e

echo "🤖 Unit Talk Discord Bot - Quick Start"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the unit-talk-custom-bot directory"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found"
    if [ -f ".env.example" ]; then
        echo "📋 Copying .env.example to .env"
        cp .env.example .env
        echo "⚠️  Please edit .env file with your configuration before running the bot"
        echo "   Required: DISCORD_TOKEN, DISCORD_CLIENT_ID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY"
        exit 1
    else
        echo "❌ No .env.example file found. Please create a .env file manually."
        exit 1
    fi
fi

echo "✅ Environment file found"

# Check if required environment variables are set
source .env

REQUIRED_VARS=("DISCORD_TOKEN" "DISCORD_CLIENT_ID" "SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" = "your_${var,,}_here" ] || [[ "${!var}" == *"your_"* ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing or incomplete required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please edit your .env file and set these variables before running the bot."
    echo "See README.md for detailed setup instructions."
    exit 1
fi

echo "✅ Required environment variables are set"

# Build the project
echo "🔨 Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "🚀 Setup complete! You can now run the bot with:"
echo ""
echo "   Development mode (with hot reload):"
echo "   npm run dev"
echo ""
echo "   Production mode:"
echo "   npm start"
echo ""
echo "📖 For more information, see README.md"
echo ""

# Ask if user wants to start in development mode
read -p "Would you like to start the bot in development mode now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting bot in development mode..."
    npm run dev
fi