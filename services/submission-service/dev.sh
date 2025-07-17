#!/bin/bash

# Development script for Nanopore Submission Service with hot reload

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Nanopore Submission Service in development mode...${NC}"

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo -e "${RED}Error: UV is not installed${NC}"
    echo "Install UV with: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    uv venv --python 3.12
fi

# Install/update dependencies
echo -e "${YELLOW}Installing/updating dependencies...${NC}"
uv pip install -r requirements.txt

# Set development environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export SUBMISSION_SERVICE_PORT=${SUBMISSION_SERVICE_PORT:-8001}
export SUBMISSION_SERVICE_HOST=${SUBMISSION_SERVICE_HOST:-0.0.0.0}
export ENVIRONMENT=development
export DEBUG=true

# Load environment from .env if it exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Loading environment from .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Display service info
echo -e "${GREEN}Development Configuration:${NC}"
echo "  Host: $SUBMISSION_SERVICE_HOST"
echo "  Port: $SUBMISSION_SERVICE_PORT"
echo "  Environment: $ENVIRONMENT"
echo "  Debug: $DEBUG"
echo "  Python: $(uv run python --version)"
echo

# Start the service with hot reload
echo -e "${GREEN}Starting service with hot reload...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo

# Use uvicorn with reload for development
uv run uvicorn app:app \
    --host $SUBMISSION_SERVICE_HOST \
    --port $SUBMISSION_SERVICE_PORT \
    --reload \
    --reload-dir . \
    --log-level info 