#!/bin/bash
# Script to run tests for the submission service

set -e

echo "🧪 Running Nanopore Submission Service Tests"
echo "==========================================="

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found. Please run ./dev.sh first."
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Install test dependencies if needed
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Run unit tests
echo ""
echo "🔬 Running unit tests..."
pytest tests/unit -v --tb=short

# Run integration tests
echo ""
echo "🔗 Running integration tests..."
pytest tests/integration -v --tb=short

# Run all tests with coverage
echo ""
echo "📊 Running all tests with coverage..."
pytest --cov=app --cov-report=term-missing --cov-report=html

echo ""
echo "✅ All tests completed!"
echo "📄 Coverage report available in htmlcov/index.html" 