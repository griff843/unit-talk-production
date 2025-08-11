#!/bin/bash
# Setup Unit Talk Platform development environment in WSL2

echo "=========================================="
echo "Unit Talk Platform - WSL2 Dev Setup"
echo "=========================================="

# Update system
echo "📦 Updating Ubuntu packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (matching your Windows version)
echo "🟢 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install essential tools
echo "🔧 Installing development tools..."
sudo apt install -y git build-essential python3 curl wget

# Install pnpm (faster than npm)
echo "⚡ Installing pnpm..."
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Configure Git to handle line endings
echo "🔧 Configuring Git for Windows/Linux compatibility..."
git config --global core.autocrlf input
git config --global core.eol lf

# Create convenient aliases
echo "📝 Setting up aliases..."
cat >> ~/.bashrc << 'EOF'

# Unit Talk Platform Aliases
alias ut-api='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production/apps/api && npm run dev'
alias ut-cc='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production/apps/command-center && npm run dev'
alias ut-dash='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production/apps/dashboard && npm run dev'
alias ut-bot='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production/apps/discord-bot && npm run dev'
alias ut-form='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production/apps/smart-form && npm run dev'
alias ut-all='cd /mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d "\r")/Desktop/Unit\ Talk\ Production\ v3/unit-talk-production && ./start-all-wsl.sh'
EOF

# Install dependencies
echo "📦 Installing project dependencies..."
cd "/mnt/c/Users/$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')/Desktop/Unit Talk Production v3/unit-talk-production"

# Clean install
echo "🧹 Cleaning previous installations..."
find . -name "node_modules" -type d -prune -exec rm -rf {} +
find . -name "package-lock.json" -type f -delete

echo "📥 Installing fresh dependencies..."
npm install

echo "✅ WSL2 setup complete!"
echo ""
echo "🚀 Quick Start Commands:"
echo "  ut-cc     - Start Command Center"
echo "  ut-dash   - Start Dashboard"
echo "  ut-api    - Start API"
echo "  ut-bot    - Start Discord Bot"
echo "  ut-form   - Start Smart Form"
echo "  ut-all    - Start all apps"
echo ""
echo "💡 Tips:"
echo "- Your Windows files are at: /mnt/c/"
echo "- Use 'code .' to open VS Code"
echo "- Performance is 10x better than Windows!"
echo ""
echo "Run 'source ~/.bashrc' to load aliases"