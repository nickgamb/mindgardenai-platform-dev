#!/bin/bash

# Alden Platform Complete Setup Script
# This script sets up Redis, Ollama, and alden-core using Docker Compose

set -e

echo "🚀 Setting up Alden Platform with Docker Compose..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if nvidia-docker is available (for GPU support)
if command -v nvidia-docker &> /dev/null; then
    echo "✅ NVIDIA Docker detected - GPU support enabled"
    GPU_SUPPORT=true
else
    echo "⚠️  NVIDIA Docker not found - GPU support disabled"
    GPU_SUPPORT=false
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Auth0 Configuration
AUTH0_CLIENT_ID=your_auth0_client_id_here
AUTH0_API_IDENTIFIER=your_auth0_api_identifier_here
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here

# Database Configuration
DATABASE_URL=sqlite:////app/data/webui.db

# Redis Configuration
REDIS_URL=redis://redis:6379/0

# Ollama Configuration
OLLAMA_BASE_URLS=http://ollama:11434
EOF
    echo "⚠️  Please edit .env file with your Auth0 credentials before continuing"
    echo "   Press Enter when ready to continue..."
    read
fi

# Create Docker network
echo "🌐 Creating Docker network 'alden'..."
docker network create alden 2>/dev/null || echo "Network 'alden' already exists"

# Create data directory
echo "📁 Creating data directory..."
mkdir -p data

# Build and start services
echo "🔨 Building and starting services..."
if [ "$GPU_SUPPORT" = true ]; then
    docker-compose up --build -d
else
    # Remove GPU configuration for non-GPU systems
    echo "⚠️  Building without GPU support..."
    docker-compose -f docker-compose.yml up --build -d
fi

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "🔍 Checking service status..."
docker-compose ps

# Test Redis connection
echo "🧪 Testing Redis connection..."
if docker exec redis redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis is running"
else
    echo "❌ Redis connection failed"
fi

# Test Ollama connection
echo "🧪 Testing Ollama connection..."
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is running"
else
    echo "❌ Ollama connection failed"
fi

# Test alden-core connection
echo "🧪 Testing alden-core connection..."
if curl -s http://localhost:8080/health > /dev/null; then
    echo "✅ alden-core is running"
else
    echo "❌ alden-core connection failed"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📊 Service URLs:"
echo "   - alden-core: http://localhost:8080"
echo "   - Ollama API: http://localhost:11434"
echo "   - Redis: localhost:6379"
echo ""
echo "📋 Useful commands:"
echo "   - View logs: docker-compose logs -f"
echo "   - Stop services: docker-compose down"
echo "   - Restart services: docker-compose restart"
echo "   - Update services: docker-compose pull && docker-compose up -d"
echo ""
echo "🔧 Management commands:"
echo "   - Redis CLI: docker exec -it redis redis-cli"
echo "   - Ollama logs: docker logs -f ollama"
echo "   - alden-core logs: docker logs -f alden-core" 