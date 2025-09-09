#!/bin/sh
ollama serve &
sleep 5

ollama pull llama3:8b
ollama pull mistral
ollama pull phi3:3.8b
ollama pull deepseek-llm:7b
ollama pull deepseek-coder:6.7b
ollama pull codellama:7b
ollama pull gemma:7b

wait