#!/bin/bash
# Manual hidapi installation script for MindGarden Universal Agent

echo "🔧 Manual hidapi Installation Script"
echo "===================================="

# Check if container is running
if ! docker-compose ps | grep -q "universal-agent.*Up"; then
    echo "❌ Container is not running. Start it first with ./start.sh"
    exit 1
fi

echo "✅ Container is running, attempting to install hidapi..."

# Try different installation methods
echo "📦 Method 1: Installing from PyPI with binary only..."
docker-compose exec universal-agent pip install --no-cache-dir --only-binary=all hidapi==0.14.0

if [ $? -eq 0 ]; then
    echo "✅ Method 1 succeeded!"
else
    echo "⚠️  Method 1 failed, trying alternative version..."
    docker-compose exec universal-agent pip install --no-cache-dir --only-binary=all hidapi
fi

# Test if installation worked
echo "🧪 Testing hidapi import..."
docker-compose exec universal-agent python -c "import hidapi; print('hidapi imported successfully')"

if [ $? -eq 0 ]; then
    echo "✅ hidapi installation successful!"
    echo "🔄 Restarting container to apply changes..."
    docker-compose restart universal-agent
else
    echo "❌ hidapi installation failed. You may need to:"
    echo "   1. Check container logs: docker-compose logs universal-agent"
    echo "   2. Bash into container: docker-compose exec universal-agent bash"
    echo "   3. Try manual installation inside container"
fi 