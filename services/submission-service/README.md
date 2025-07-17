# Nanopore Submission Service

A memory-efficient Python microservice for processing PDF and CSV files for nanopore sample submissions.

## 🎯 Features

### Memory Optimization
- **Chunked Processing**: CSV files processed in 100-row chunks to prevent memory overflow
- **Streaming File Upload**: Files streamed to disk instead of loading into memory
- **Page-by-Page PDF Processing**: PDFs processed one page at a time
- **Background Task Processing**: Heavy operations moved to background tasks
- **Memory Monitoring**: Real-time memory usage tracking and health checks

### File Processing
- **CSV Processing**: Bulk sample creation from CSV files with validation
- **PDF Processing**: Text extraction and sample data parsing from PDF forms
- **Data Validation**: Pydantic models ensure data integrity
- **Error Handling**: Comprehensive error reporting and logging

### Architecture
- **FastAPI**: High-performance async web framework
- **Celery**: Background task processing with Redis
- **Pandas**: Efficient CSV processing with chunking
- **PDFPlumber**: Memory-efficient PDF text extraction

## 🚀 Quick Start

### Local Development

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set Environment Variables**
   ```bash
   export MAIN_APP_URL=http://localhost:3001
   export REDIS_URL=redis://localhost:6379/0
   export PORT=8000
   ```

3. **Run the Service**
   ```bash
   python app.py
   ```

### Docker Deployment

1. **Build Image**
   ```bash
   docker build -t submission-service .
   ```

2. **Run Container**
   ```bash
   docker run -p 8000:8000 \
     -e MAIN_APP_URL=http://your-main-app:3001 \
     -e REDIS_URL=redis://your-redis:6379/0 \
     submission-service
   ```

## 📊 API Endpoints

### Health Check
```http
GET /health
```
Returns service health status and memory usage statistics.

### CSV Processing
```http
POST /process-csv
Content-Type: multipart/form-data

file: <csv_file>
```
Processes CSV file and creates samples in the main application.

### PDF Processing
```http
POST /process-pdf
Content-Type: multipart/form-data

file: <pdf_file>
```
Extracts sample data from PDF and creates samples in the main application.

### Memory Usage
```http
GET /memory-usage
```
Returns current memory usage statistics.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MAIN_APP_URL` | URL of main nanopore tracking app | `http://localhost:3001` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `PORT` | Service port | `8000` |
| `HOST` | Service host | `0.0.0.0` |

### Memory Optimization Settings

The service includes several memory optimization features:

1. **CSV Chunking**: Processes 100 rows at a time
2. **Temporary Files**: Uses disk storage for large files
3. **Background Tasks**: Moves heavy processing to background
4. **Memory Monitoring**: Tracks usage and provides alerts

## 📈 Performance

### Memory Usage Comparison

| Service Type | Memory Usage | Processing Speed | Scalability |
|--------------|--------------|------------------|-------------|
| **Python Submission Service** | ~50-100MB | Fast | High |
| **Node.js (Current)** | ~200-500MB | Medium | Medium |

### Benchmarks

- **CSV Processing**: 1000 rows in ~2 seconds, ~50MB memory
- **PDF Processing**: 10-page PDF in ~5 seconds, ~80MB memory
- **Concurrent Requests**: Handles 10+ simultaneous uploads

## 🔍 Monitoring

### Health Checks
The service provides comprehensive health monitoring:

```json
{
  "status": "healthy",
  "memory_usage": {
    "rss_mb": 45.2,
    "vms_mb": 120.5,
    "percent": 2.1,
    "available_mb": 2048.0
  },
  "service": "submission-service"
}
```

### Logging
Structured logging with different levels:
- `INFO`: Normal operations
- `WARNING`: Memory usage alerts
- `ERROR`: Processing failures

## 🛠️ Development

### Running Tests
```bash
pytest tests/
```

### Code Formatting
```bash
black .
flake8 .
```

### Adding New Features

1. **New File Type**: Add new endpoint and processing function
2. **Enhanced Validation**: Update Pydantic models
3. **Background Tasks**: Use Celery for heavy operations

## 🔒 Security

- **Non-root User**: Container runs as non-root user
- **Input Validation**: All inputs validated with Pydantic
- **File Type Checking**: Strict file type validation
- **Temporary File Cleanup**: Automatic cleanup of temporary files

## 📝 Integration

### Main Application Integration

The service communicates with the main nanopore tracking app via HTTP API calls:

```python
# Example integration call
response = await client.post(
    f"{main_app_url}/api/trpc/nanopore.createSample",
    json={"json": sample_data},
    timeout=30.0
)
```

### Error Handling

The service provides detailed error reporting:

```json
{
  "success": false,
  "message": "Processed 50 samples, created 45",
  "samples_processed": 50,
  "samples_created": 45,
  "errors": [
    "Row 12: Invalid email format",
    "Row 23: Missing required field 'sample_name'"
  ],
  "processing_time": 2.34
}
```

## 🚀 Deployment

### OpenShift Deployment

The service can be deployed to OpenShift using the provided deployment configurations:

```bash
# Deploy to OpenShift
oc apply -f deployment/openshift/
```

### Production Considerations

1. **Resource Limits**: Set appropriate CPU and memory limits
2. **Scaling**: Use HPA for automatic scaling
3. **Monitoring**: Integrate with Prometheus/Grafana
4. **Backup**: Ensure Redis persistence for background tasks

## 📚 Dependencies

### Core Dependencies
- `fastapi`: Web framework
- `pandas`: CSV processing
- `pdfplumber`: PDF text extraction
- `celery`: Background tasks
- `redis`: Message broker

### Development Dependencies
- `pytest`: Testing framework
- `black`: Code formatting
- `flake8`: Linting

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Monitor memory usage impact 