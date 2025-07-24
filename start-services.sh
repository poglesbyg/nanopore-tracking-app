#!/bin/bash

echo "Starting Nanopore Tracking Services..."

# Start submission service
echo "Starting submission service on port 8000..."
cd services/submission-service
source .test_venv/bin/activate 2>/dev/null || {
    echo "Creating virtual environment for submission service..."
    python3 -m venv .test_venv
    source .test_venv/bin/activate
    pip install fastapi uvicorn pydantic pydantic-settings psutil python-multipart pdfplumber PyPDF2 pandas httpx
}
PYTHONPATH=. python app/main.py &
SUBMISSION_PID=$!
cd ../..

echo "Submission service started with PID: $SUBMISSION_PID"

# Start frontend dev server
echo "Starting frontend on port 3001..."
pnpm dev &
FRONTEND_PID=$!

echo "Frontend started with PID: $FRONTEND_PID"

echo ""
echo "Services are running:"
echo "- Frontend: http://localhost:3001"
echo "- Submission Service: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait and handle shutdown
trap "echo 'Stopping services...'; kill $SUBMISSION_PID $FRONTEND_PID; exit" INT TERM
wait 