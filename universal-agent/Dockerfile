# MindGarden Universal Agent Docker Image
FROM python:3.11-slim

LABEL maintainer="MindGarden AI <support@mindgardenai.com>"
LABEL description="Universal Agent for connecting EEG devices to MindGarden platform"
LABEL version="1.0.0"

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV FLASK_APP=main.py
ENV FLASK_ENV=production

# Install system dependencies including cloudflared and hidapi
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libhidapi-dev \
    libudev-dev \
    libusb-1.0-0-dev \
    libgpiod-dev \
    bluez \
    bluetooth \
    libbluetooth-dev \
    git \
    curl \
    wget \
    python3-dev \
    python3-hidapi \
    && curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i cloudflared.deb \
    && rm cloudflared.deb \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy requirements and wheels first for better caching
COPY requirements.txt .

# Install Python dependencies with error handling for hardware-specific packages
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        Flask==3.0.0 \
        Flask-SocketIO==5.3.6 \
        Flask-CORS==4.0.0 \
        PyJWT==2.8.0 \
        python-jose==3.3.0 \
        requests==2.31.0 \
        cryptography==41.0.7 \
        jwcrypto==1.5.6 \
        pyserial==3.5 \
        pyusb==1.3.1 \
        bleak==0.21.1 \
        numpy==1.24.3 \
        scipy==1.11.4 \
        pandas==2.0.3 \
        python-dotenv==1.0.0 \
        pycryptodome==3.19.0 \
        psutil==5.9.6 \
        asyncio-mqtt==0.16.1 \
        structlog==23.2.0 \
        colorlog==6.8.0 \
        pytest==7.4.3 \
        pytest-asyncio==0.21.1 \
        black==23.11.0 \
        flake8==6.1.0

# Try to install hardware-specific packages (may fail in non-Raspberry Pi environments)
RUN pip install --no-cache-dir spidev==3.6 || echo "Warning: spidev installation failed - not running on Pi, SPI support disabled" && \
    pip install --no-cache-dir gpiod==2.1.0 || echo "Warning: gpiod installation failed - not running on Pi, GPIO support disabled" && \
    pip install --no-cache-dir RPi.GPIO==0.7.1 || echo "Warning: RPi.GPIO installation failed - not running on Pi, GPIO support disabled"

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data/logs && \
    mkdir -p static/css static/js static/images && \
    chown -R appuser:appuser /app

# Set up device access permissions (gracefully handle missing groups)
RUN groupadd -f spi 2>/dev/null || echo "Warning: Could not create spi group - not running on Pi" && \
    groupadd -f gpio 2>/dev/null || echo "Warning: Could not create gpio group - not running on Pi" && \
    groupadd -f i2c 2>/dev/null || echo "Warning: Could not create i2c group - not running on Pi" && \
    usermod -a -G dialout appuser 2>/dev/null || echo "Warning: Could not add user to dialout group" && \
    usermod -a -G spi appuser 2>/dev/null || echo "Warning: Could not add user to spi group - not running on Pi" && \
    usermod -a -G gpio appuser 2>/dev/null || echo "Warning: Could not add user to gpio group - not running on Pi" && \
    usermod -a -G i2c appuser 2>/dev/null || echo "Warning: Could not add user to i2c group - not running on Pi"

# Copy entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Switch to app user
USER appuser

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
CMD ["python", "main.py"]