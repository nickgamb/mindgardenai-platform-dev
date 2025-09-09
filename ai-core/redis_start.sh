#!/bin/sh

# Start Redis server with configuration
redis-server /usr/local/etc/redis/redis.conf &

# Wait for Redis to start
sleep 3

# Optional: Set up initial Redis configuration
# redis-cli CONFIG SET maxmemory 256mb
# redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Keep the container running
wait 