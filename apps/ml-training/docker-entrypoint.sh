#!/bin/bash
# ML Training Docker Entrypoint Script

echo "🚀 Unit Talk ML Training Environment Starting"
echo "=============================================="

# Set permissions
chmod +x /app/training/*.py
chmod +x /app/features/*.py

# Print environment info
echo "📊 Environment Information:"
echo "  Python version: $(python --version)"
echo "  Working directory: $(pwd)"
echo "  Available data: $(ls -la /app/data/ 2>/dev/null || echo 'No data directory found')"

# Check if training data exists
if [ -f "/app/data/all_training_data.csv" ]; then
    echo "✅ Training data found: $(wc -l < /app/data/all_training_data.csv) lines"
else
    echo "⚠️ Training data not found - will use sample data"
fi

# Start Jupyter Lab by default
echo "🔬 Starting Jupyter Lab..."
echo "📍 Access at: http://localhost:8888"
echo "🎯 Notebooks: /app/notebooks/"
echo ""

exec "$@"