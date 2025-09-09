# docker build --build-arg USE_CUDA=true -t ai-core:latest .
# docker network create  mgflow-assistant
# docker run -it --gpus all --env-file .env  --name is-core --network  mgflow-assistant -p 8080:8080 -v "${PWD}/data:/app/data" ai-core:latest
# docker exec -it ai-core ollama list

#export OLLAMA_HOST=http://ollama:11434
# source ~/.bashrc
#echo 'export OLLAMA_HOST=http://ollama:11434' >> ~/.bashrc


# syntax=docker/dockerfile:1
# Initialize device type args
ARG USE_CUDA=true
ARG USE_OLLAMA=false
ARG USE_CUDA_VER=cu128
ARG USE_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
ARG USE_RERANKING_MODEL=""
ARG USE_TIKTOKEN_ENCODING_NAME="cl100k_base"
ARG BUILD_HASH=dev-build
ARG UID=0
ARG GID=0

######## WebUI backend only ########
FROM nvidia/cuda:12.9.1-cudnn-devel-ubuntu22.04 AS base

# Install Python 3.11 and system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common \
        git build-essential pandoc netcat-openbsd curl jq \
        ffmpeg libsm6 libxext6 \
        gcc python3.11 python3.11-venv python3.11-dev python3-pip && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    rm -rf /var/lib/apt/lists/*

# Use args
ARG USE_CUDA
ARG USE_OLLAMA
ARG USE_CUDA_VER
ARG USE_EMBEDDING_MODEL
ARG USE_RERANKING_MODEL
ARG UID
ARG GID

## Basis ##
ENV ENV=prod \
    PORT=8080 \
    USE_OLLAMA_DOCKER=${USE_OLLAMA} \
    USE_CUDA_DOCKER=${USE_CUDA} \
    USE_CUDA_DOCKER_VER=${USE_CUDA_VER} \
    USE_EMBEDDING_MODEL_DOCKER=${USE_EMBEDDING_MODEL} \
    USE_RERANKING_MODEL_DOCKER=${USE_RERANKING_MODEL}

## Basis URL Config ##
ENV OLLAMA_BASE_URL="http://ollama:11434" \
    OPENAI_API_BASE_URL="http://ollama:11434"

## API Key and Security Config ##
ENV OPENAI_API_KEY="" \
    WEBUI_SECRET_KEY="" \
    SCARF_NO_ANALYTICS=true \
    DO_NOT_TRACK=true \
    ANONYMIZED_TELEMETRY=false

#### Other models #########################################################
## whisper TTS model settings ##
ENV WHISPER_MODEL="base" \
    WHISPER_MODEL_DIR="/app/data/cache/whisper/models"

## RAG Embedding model settings ##
ENV RAG_EMBEDDING_MODEL="$USE_EMBEDDING_MODEL_DOCKER" \
    RAG_RERANKING_MODEL="$USE_RERANKING_MODEL_DOCKER" \
    SENTENCE_TRANSFORMERS_HOME="/app/data/cache/embedding/models"

## Tiktoken model settings ##
ENV TIKTOKEN_ENCODING_NAME="cl100k_base" \
    TIKTOKEN_CACHE_DIR="/app/data/cache/tiktoken"

## Hugging Face download cache ##
ENV HF_HOME="/app/data/cache/embedding/models"

WORKDIR /app

ENV HOME=/root
# Create user and group if not root
RUN if [ $UID -ne 0 ]; then \
    if [ $GID -ne 0 ]; then \
    addgroup --gid $GID app; \
    fi; \
    adduser --uid $UID --gid $GID --home $HOME --disabled-password --no-create-home app; \
    fi

RUN mkdir -p $HOME/.cache/chroma
RUN echo -n 00000000-0000-0000-0000-000000000000 > $HOME/.cache/chroma/telemetry_user_id

# Make sure the user has access to the app and root directory
RUN chown -R $UID:$GID /app $HOME

RUN if [ "$USE_OLLAMA" = "true" ]; then \
    # Remove any old ollama binaries if present
    rm -f /usr/local/bin/ollama; \
    # install latest ollama
    curl -fsSL https://ollama.com/install.sh | sh; \
    ollama --version; \
    fi

# install python dependencies
COPY --chown=$UID:$GID ./requirements.txt ./requirements.txt

RUN mkdir -p /app/data
RUN pip install --no-cache-dir uv
RUN if [ "$USE_CUDA" = "true" ]; then \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/$USE_CUDA_DOCKER_VER --no-cache-dir --timeout 300 --retries 10; \
    else \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --no-cache-dir --timeout 300 --retries 10; \
    fi
RUN pip install --no-cache-dir -r requirements.txt
RUN python3 -c "import os; from sentence_transformers import SentenceTransformer; SentenceTransformer(os.environ['RAG_EMBEDDING_MODEL'], device='cpu')"
RUN python3 -c "import os; from faster_whisper import WhisperModel; WhisperModel(os.environ['WHISPER_MODEL'], device='cpu', compute_type='int8', download_root=os.environ['WHISPER_MODEL_DIR'])"
RUN python3 -c "import os; import tiktoken; tiktoken.get_encoding(os.environ['TIKTOKEN_ENCODING_NAME'])"
RUN chown -R $UID:$GID /app/data/

# copy backend files
COPY --chown=$UID:$GID . .

EXPOSE 8080

HEALTHCHECK CMD curl --silent --fail http://localhost:${PORT:-8080}/health | jq -ne 'input.status == true' || exit 1

USER $UID:$GID

ARG BUILD_HASH
ENV WEBUI_BUILD_VERSION=${BUILD_HASH}
ENV DOCKER=true

CMD [ "bash", "start.sh"]
