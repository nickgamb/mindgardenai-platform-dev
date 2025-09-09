# Alden Platform - Docker Compose Setup

This setup runs your complete Alden Platform with Redis, Ollama, and alden-core using Docker Compose.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- NVIDIA Docker (for GPU support)
- Auth0 credentials

### 1. Setup Environment
```bash
cd alden-core

# Create .env file with your Auth0 credentials
cat > .env << EOF
AUTH0_CLIENT_ID=your_auth0_client_id_here
AUTH0_API_IDENTIFIER=your_auth0_api_identifier_here
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here
EOF
```

### 2. Run Everything
```bash
# Create network and start all services
docker network create alden
docker-compose up --build -d
```

### 3. Verify Services
```bash
# Check all services are running
docker-compose ps

# Test connections
curl http://localhost:8080/health  # alden-core
curl http://localhost:11434/api/tags  # Ollama
docker exec redis redis-cli ping  # Redis
```

## 📊 Service Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   alden-core│    │    Ollama   │    │    Redis    │
│   :8080     │    │   :11434    │    │   :6379     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌─────────────┐
                    │   alden     │
                    │  network    │
                    └─────────────┘
```

## 🔧 Services

### Redis (`redis`)
- **Purpose**: Task management, caching, WebSocket support
- **Port**: 6379
- **Data**: Persisted in `redis-data` volume
- **Config**: `redis.conf`

### Ollama (`ollama`)
- **Purpose**: Local LLM inference
- **Port**: 11434
- **Models**: Stored in `ollama-models` volume
- **GPU**: NVIDIA GPU support enabled

### alden-core (`alden-core`)
- **Purpose**: Your Open WebUI backend
- **Port**: 8080
- **Database**: SQLite in `./data` volume
- **Auth**: Auth0 integration
- **GPU**: NVIDIA GPU support for inference

## 📋 Management Commands

### Start Services
```bash
# Start all services
docker-compose up -d

# Start with rebuild
docker-compose up --build -d

# Start specific service
docker-compose up -d redis
```

### Stop Services
```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f alden-core
docker-compose logs -f ollama
docker-compose logs -f redis
```

### Access Services
```bash
# Redis CLI
docker exec -it redis redis-cli

# Ollama logs
docker logs -f ollama

# alden-core logs
docker logs -f alden-core
```

## 🔍 Troubleshooting

### GPU Issues
```bash
# Check NVIDIA Docker
nvidia-docker run --rm nvidia/cuda:11.0-base nvidia-smi

# Check GPU in containers
docker exec ollama nvidia-smi
docker exec alden-core nvidia-smi
```

### Network Issues
```bash
# Check network
docker network ls
docker network inspect alden

# Recreate network
docker network rm alden
docker network create alden
```

### Volume Issues
```bash
# Check volumes
docker volume ls
docker volume inspect alden-core_redis-data
docker volume inspect alden-core_ollama-models
```

## 📁 File Structure
```
alden-core/
├── docker-compose.yml      # Main compose file
├── Dockerfile              # alden-core image
├── RedisServerDockerfile   # Redis image
├── OllamaServerDockerfile  # Ollama image
├── redis.conf              # Redis configuration
├── redis_start.sh          # Redis startup script
├── ollama_start.sh         # Ollama startup script
├── setup.sh                # Automated setup script
├── .env                    # Environment variables
└── data/                   # Persistent data
```

## 🔄 Development Workflow

### Making Changes
1. **Code changes**: Edit files in `alden-core/`
2. **Rebuild**: `docker-compose up --build -d`
3. **Test**: Check logs and endpoints

### Adding Models to Ollama
```bash
# Access Ollama container
docker exec -it ollama ollama pull llama3:8b

# Or add to ollama_start.sh and rebuild
```

### Database Changes
```bash
# Access SQLite database
docker exec -it alden-core sqlite3 /app/data/webui.db
```

## 🚨 Important Notes

1. **GPU Support**: Requires NVIDIA Docker for GPU acceleration
2. **Auth0**: Must configure Auth0 credentials in `.env`
3. **Data Persistence**: Data survives container restarts
4. **Network**: All services communicate via `alden` network
5. **Ports**: Ensure ports 8080, 11434, 6379 are available

## 🎯 Production Considerations

### Security
- Add Redis password in `redis.conf`
- Use HTTPS for alden-core
- Secure Auth0 configuration

### Performance
- Adjust Redis memory limits
- Configure Ollama model loading
- Monitor GPU usage

### Scaling
- Use Redis Sentinel for high availability
- Load balance alden-core instances
- Separate Ollama instances per model

## 📞 Support

If you encounter issues:
1. Check logs: `docker-compose logs -f`
2. Verify network: `docker network inspect alden`
3. Test individual services
4. Check GPU support: `nvidia-smi` 