#!/bin/bash
# NBA ML Environment Setup for Docker
# Install Python ML packages for syndicate-level model training

set -e

echo "🏀 Setting up NBA ML Environment in Docker..."
echo "============================================="

# Check if we're in Docker
if [ ! -f /.dockerenv ]; then
    echo "❌ This script must be run inside Docker container"
    echo "💡 Use: docker-compose exec api bash setup_ml_environment.sh"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt-get update -qq

# Install Python development packages
echo "🐍 Installing Python development packages..."
apt-get install -y python3-dev python3-pip build-essential

# Upgrade pip
echo "⬆️ Upgrading pip..."
python3 -m pip install --upgrade pip

# Install ML requirements
echo "🤖 Installing ML packages..."
cd /app/apps/api/ml
python3 -m pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating ML directories..."
mkdir -p /app/apps/api/ml/models
mkdir -p /app/apps/api/ml/logs
mkdir -p /app/apps/api/ml/data

# Set permissions
chmod +x /app/apps/api/ml/nba_model_trainer.py

# Verify installation
echo "✅ Verifying installation..."
python3 -c "
import pandas as pd
import numpy as np
import xgboost as xgb
import sklearn
import optuna
print('✅ All packages installed successfully!')
print(f'📊 Pandas: {pd.__version__}')
print(f'🔢 NumPy: {np.__version__}')
print(f'🌳 XGBoost: {xgb.__version__}')
print(f'🧠 Scikit-learn: {sklearn.__version__}')
print('🚀 NBA ML Environment Ready!')
"

echo ""
echo "🏆 NBA ML ENVIRONMENT SETUP COMPLETE!"
echo "============================================="
echo "✅ Python ML packages installed"
echo "✅ XGBoost ready for training"
echo "✅ Optuna ready for hyperparameter optimization"
echo "✅ Directory structure created"
echo ""
echo "🚀 Ready to train NBA syndicate model!"
echo "💡 Next: Run python3 /app/apps/api/ml/nba_model_trainer.py"