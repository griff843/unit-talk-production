#!/bin/bash

echo "🚀 Unit Talk Discord Bot - Complete Setup & Fix Script"
echo "======================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the unit-talk-custom-bot directory"
    echo "Usage: cd unit-talk-custom-bot && ./fix-bot.sh"
    exit 1
fi

echo "📋 Step 1: Checking environment configuration..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure it:"
    echo "cp .env.example .env"
    exit 1
fi

echo "✅ .env file found"

# Check critical environment variables
echo "🔍 Checking critical environment variables..."

if ! grep -q "DISCORD_TOKEN=" .env || grep -q "DISCORD_TOKEN=$" .env || grep -q "DISCORD_TOKEN=your_" .env; then
    echo "❌ DISCORD_TOKEN is not set properly in .env"
    echo "Please set your Discord bot token in the .env file"
    exit 1
fi

if ! grep -q "SUPABASE_URL=" .env || grep -q "SUPABASE_URL=$" .env || grep -q "SUPABASE_URL=your_" .env; then
    echo "❌ SUPABASE_URL is not set properly in .env"
    echo "Please set your Supabase URL in the .env file"
    exit 1
fi

if ! grep -q "SUPABASE_SERVICE_ROLE_KEY=" .env || grep -q "SUPABASE_SERVICE_ROLE_KEY=$" .env || grep -q "SUPABASE_SERVICE_ROLE_KEY=your_" .env; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY is not set properly in .env"
    echo "Please set your Supabase service role key in the .env file"
    exit 1
fi

echo "✅ Critical environment variables appear to be set"
echo ""

echo "📦 Step 2: Installing/updating dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ npm install failed"
    exit 1
fi
echo "✅ Dependencies installed successfully"
echo ""

echo "🔍 Step 3: Testing database connection..."
node test-database.js
echo ""

echo "🏗️ Step 4: Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    echo "Please check the TypeScript errors above"
    exit 1
fi
echo "✅ Build successful"
echo ""

echo "🎯 Setup Complete!"
echo "=================="
echo ""
echo "⚠️  IMPORTANT: Before starting the bot, make sure you have:"
echo ""
echo "1. 📊 Run the database setup SQL script in your Supabase project:"
echo "   - Go to your Supabase dashboard"
echo "   - Navigate to SQL Editor"
echo "   - Copy and run the contents of 'complete-database-setup.sql'"
echo ""
echo "2. 🤖 Verify your Discord bot has proper permissions:"
echo "   - Read Messages"
echo "   - Send Messages"
echo "   - Manage Messages"
echo "   - Manage Threads"
echo "   - Use Slash Commands"
echo "   - Manage Roles (if using role management features)"
echo ""
echo "3. 🔧 Double-check your channel and role IDs in the .env file"
echo ""
echo "🚀 To start the bot, run:"
echo "   npm run dev"
echo ""
echo "📖 For detailed troubleshooting, see SETUP_GUIDE.md"
echo ""

# Offer to run the database test again
read -p "Would you like to test the database connection again? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔍 Running database connection test..."
    node test-database.js
fi

echo ""
echo "🎉 Setup script completed!"
echo "If you see any errors above, please address them before starting the bot."