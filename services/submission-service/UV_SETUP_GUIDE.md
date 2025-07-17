# UV Setup Guide for Nanopore Submission Service

## Overview

This guide explains how to set up and use UV (ultra-fast Python package installer) for the Nanopore Submission Service.

## What is UV?

UV is a fast Python package installer and resolver written in Rust. It's significantly faster than pip and provides better dependency resolution.

## Installation

### Install UV (if not already installed)
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Or using Homebrew:
```bash
brew install uv
```

## Project Setup

### 1. Create Virtual Environment
```bash
cd services/submission-service
uv venv --python 3.12
```

### 2. Install Dependencies
```bash
uv pip install -r requirements.txt
```

### 3. Install Additional Dependencies
```bash
# If you need to add a new package
uv pip install package-name

# To install with specific version
uv pip install package-name==1.2.3
```

## Running the Service

### Development Mode (with hot reload)
```bash
./dev.sh
```

### Production Mode
```bash
./start.sh
```

### Direct UV Commands
```bash
# Run Python script
uv run python app.py

# Run with uvicorn
uv run uvicorn app:app --host 0.0.0.0 --port 8001 --reload

# Run tests
uv run pytest

# Format code
uv run black .

# Lint code
uv run ruff check .
```

## Managing Dependencies

### Add a New Dependency
1. Install the package:
   ```bash
   uv pip install new-package
   ```

2. Update requirements.txt:
   ```bash
   uv pip freeze > requirements.txt
   ```

### Update Dependencies
```bash
# Update all packages
uv pip install -r requirements.txt --upgrade

# Update specific package
uv pip install package-name --upgrade
```

### Show Installed Packages
```bash
uv pip list
```

## Project Configuration

### pyproject.toml
The project uses `pyproject.toml` for configuration:
- Package metadata
- Build system configuration
- Tool configurations (Black, Ruff, pytest)

### Environment Variables
Copy the example environment file:
```bash
cp env.example .env
```

Edit `.env` with your configuration.

## Scripts

### dev.sh
- Creates virtual environment if needed
- Installs/updates dependencies
- Runs service with hot reload
- Sets development environment variables

### start.sh
- Creates virtual environment if needed
- Installs dependencies
- Runs service in production mode
- Loads environment from .env

## Troubleshooting

### Python Version Issues
If you encounter Python version compatibility issues:
```bash
# Remove existing virtual environment
rm -rf .venv

# Create with specific Python version
uv venv --python 3.12
```

### Dependency Conflicts
```bash
# Clear UV cache
uv cache clean

# Reinstall dependencies
rm -rf .venv
uv venv --python 3.12
uv pip install -r requirements.txt
```

### Service Won't Start
1. Check Python version:
   ```bash
   uv run python --version
   ```

2. Verify all dependencies are installed:
   ```bash
   uv pip list
   ```

3. Check for port conflicts:
   ```bash
   lsof -i :8001
   ```

## Performance Benefits

UV provides significant performance improvements:
- **Installation Speed**: 10-100x faster than pip
- **Dependency Resolution**: More efficient solver
- **Caching**: Better cache management
- **Parallel Downloads**: Concurrent package downloads

## Best Practices

1. **Always use UV for package management** in this project
2. **Specify Python version** when creating virtual environments
3. **Keep requirements.txt updated** after installing new packages
4. **Use the provided scripts** (dev.sh, start.sh) for consistency
5. **Check compatibility** before upgrading Python version

## Integration with CI/CD

For deployment pipelines:
```bash
# Install UV in CI
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv pip install -r requirements.txt

# Run tests
uv run pytest

# Build Docker image (if needed)
docker build -t submission-service .
```

## Memory Usage

The service is optimized for low memory usage:
- Typical usage: 50-100MB
- Page-by-page PDF processing
- Chunked CSV processing
- Automatic garbage collection

Monitor memory usage:
```bash
curl http://localhost:8001/health | jq .memory_usage
```

## Conclusion

UV provides a fast, reliable way to manage Python dependencies for the submission service. Use the provided scripts for the best development experience. 