#!/bin/bash

# Startup script for Nanopore Submission Service using UV

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Nanopore Submission Service...${NC}"

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

# Check if dependencies are installed
if [ ! -f ".venv/bin/python" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    uv pip install -r requirements.txt
fi

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
export SUBMISSION_SERVICE_PORT=${SUBMISSION_SERVICE_PORT:-8001}
export SUBMISSION_SERVICE_HOST=${SUBMISSION_SERVICE_HOST:-0.0.0.0}

# Load environment from .env if it exists
if [ -f ".env" ]; then
    echo -e "${YELLOW}Loading environment from .env${NC}"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Display service info
echo -e "${GREEN}Service Configuration:${NC}"
echo "  Host: $SUBMISSION_SERVICE_HOST"
echo "  Port: $SUBMISSION_SERVICE_PORT"
echo "  Python: $(uv run python --version)"
echo

# Start the service
echo -e "${GREEN}Starting service...${NC}"
uv run python app.py 