#!/bin/bash

echo "🚀 Starting Unit Talk Redis Infrastructure..."

# Start Redis with Docker Compose
echo "📊 Starting Redis service..."
docker-compose -f docker-compose.redis.yml up -d

# Wait for Redis to be ready
echo "⏳ Waiting for Redis to be ready..."
sleep 10

# Test Redis connection
echo "🔍 Testing Redis connection..."
docker exec unit-talk-redis redis-cli ping

echo "✅ Redis infrastructure ready!"
echo "📊 Redis UI available at: http://localhost:8081"
echo "🔧 Redis connection: redis://localhost:6379"