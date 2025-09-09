#!/bin/bash

# MindGarden Platform Docker Startup Script
echo "🚀 Starting MindGarden Platform..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Please copy .env.example to .env and configure your settings:"
    echo "  cp .env.example .env"
    echo "  nano .env  # Edit with your Auth0 and other settings"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Docker and docker-compose are required but not installed."
    echo "Please install Docker Desktop from https://docker.com"
    exit 1
fi

# Create the network if it doesn't exist
echo "📡 Creating Docker network..."
docker network create mgflow-assistant 2>/dev/null || true

# Build and start all services
echo "🏗️  Building and starting services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up --build -d
else
    docker compose up --build -d
fi

# Wait a moment for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service status..."
echo ""
echo "Services should be available at:"
echo "  📱 Web Client:     http://localhost:3000"
echo "  🔧 API Server:     http://localhost:5000"
echo "  🤖 AI Core:        http://localhost:8080"
echo "  📊 Redis:          localhost:6379"
echo "  🦙 Ollama:         http://localhost:11434"
echo ""

# Check if services are responding
echo "Health checks:"
sleep 5

# Check web client
if curl -s http://localhost:3000 > /dev/null; then
    echo "  ✅ Web Client is running"
else
    echo "  ❌ Web Client is not responding"
fi

# Check API server
if curl -s http://localhost:5000/api/status > /dev/null; then
    echo "  ✅ API Server is running"
else
    echo "  ❌ API Server is not responding"
fi

# Check AI Core
if curl -s http://localhost:8080/health > /dev/null; then
    echo "  ✅ AI Core is running"
else
    echo "  ❌ AI Core is not responding"
fi

echo ""
echo "🎉 MindGarden Platform is ready!"
echo "Open http://localhost:3000 in your browser to get started."
echo ""
echo "To stop all services: docker-compose down"
echo "To view logs: docker-compose logs -f [service-name]"