# Quick Reference Guide

## Common Commands

### Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev                    # Runs on http://localhost:3001

# Build for production
pnpm build

# Run tests
pnpm test:unit             # Unit tests
pnpm test:e2e              # End-to-end tests
```

### Database Management

```bash
# Run migrations
node run-migrations.js

# Connect to PostgreSQL
psql -h localhost -p 5436 -U postgres -d nanopore_db

# Docker database commands
docker-compose -f deployment/docker/docker-compose.dev.yml up db
```

### Docker Commands

```bash
# Start all services
docker-compose -f deployment/docker/docker-compose.yml up

# Start development environment
docker-compose -f deployment/docker/docker-compose.dev.yml up

# Start microservices
docker-compose -f deployment/docker/docker-compose.microservices.yml up

# Stop all containers
docker-compose down

# View logs
docker-compose logs -f [service-name]
```

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend (Astro) | 3001 | Main application |
| Sample Management | 3002 | Sample service |
| AI Processing | 3003 | PDF extraction & LLM |
| Authentication | 3004 | User auth service |
| File Storage | 3005 | Document storage |
| Audit Service | 3006 | Audit logging |
| PostgreSQL | 5432/5436 | Main database |
| Auth DB | 5433 | Authentication database |
| Audit DB | 5434 | Audit database |
| File DB | 5435 | File storage database |
| Redis | 6379 | Cache & sessions |
| Qdrant | 6333 | Vector database |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Monitoring dashboard |
| Ollama | 11434 | LLM service |

## Sample Status Values

| Status | Description |
|--------|-------------|
| `submitted` | Initial submission |
| `prep` | Library preparation |
| `sequencing` | Active sequencing |
| `analysis` | Data analysis |
| `completed` | Processing finished |
| `distributed` | Delivered to customer *(NEW)* |
| `archived` | Long-term storage |

## Priority Levels

| Priority | Description |
|----------|-------------|
| `low` | Standard processing |
| `normal` | Regular queue (default) |
| `high` | Expedited processing |
| `urgent` | Priority handling |

## Chart Field Format

Valid chart field patterns:
- `HTSF-XXX` (e.g., HTSF-001)
- `NANO-XXX` (e.g., NANO-123)
- `SEQ-XXX` (e.g., SEQ-456)

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/nanopore_db
```

### Optional

```bash
NODE_ENV=development|production
PORT=3001
OLLAMA_HOST=http://localhost:11434
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug|info|warn|error
```

## API Endpoints

### Sample Management

```typescript
// Get all samples
GET /api/samples

// Get sample by ID
GET /api/samples/:id

// Create sample
POST /api/samples

// Update sample
PUT /api/samples/:id

// Update sample status
PATCH /api/samples/:id/status

// Bulk operations
POST /api/samples/bulk-operations
```

### File Processing

```typescript
// Process PDF
POST /api/submission/process-pdf

// Process CSV
POST /api/submission/process-csv

// Export data
GET /api/export/:type
```

### Authentication

```typescript
// Login
POST /api/admin/login

// Logout
POST /api/admin/logout

// Get session
GET /api/admin/session
```

## Database Schema

### Main Tables

- `projects` - Top-level projects
- `submissions` - HTSF submissions
- `nanopore_samples` - Sample records
- `nanopore_sample_details` - Extended sample metadata
- `nanopore_processing_steps` - Workflow steps
- `nanopore_attachments` - File attachments

### Key Relationships

```sql
projects (1) --> (N) submissions
submissions (1) --> (N) nanopore_samples
nanopore_samples (1) --> (N) nanopore_processing_steps
nanopore_samples (1) --> (N) nanopore_attachments
nanopore_samples (1) --> (1) nanopore_sample_details
```

## Validation Rules

### Concentration Ranges

| Sample Type | Min (ng/μL) | Max (ng/μL) |
|-------------|-------------|-------------|
| DNA | 0.1 | 1000 |
| RNA | 0.01 | 100 |
| Protein | 0.001 | 10 |

### Volume Requirements

- **Minimum**: 0.1 μL
- **Maximum**: 1000 μL
- **Typical**: 10-50 μL

### Flow Cell Types

- `R9.4.1` - Standard flow cell
- `R10.4.1` - High accuracy
- `R10.5.1` - Latest version

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL status
docker ps | grep postgres

# View database logs
docker logs docker-db-1

# Test connection
psql -h localhost -p 5436 -U postgres -c "SELECT 1"
```

### Build Errors

```bash
# Clear node_modules
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear build cache
rm -rf dist .astro

# Check TypeScript errors
npx tsc --noEmit
```

### Docker Issues

```bash
# Reset Docker environment
docker-compose down -v
docker system prune -a

# Rebuild containers
docker-compose build --no-cache
docker-compose up
```

## Useful Scripts

### Import Samples

```bash
# Import from CSV
node scripts/bulk-import-samples.js samples.csv

# Import from HTSF PDF
python scripts/parse-htsf-samples-correct.py HTSF-quote.pdf
```

### Database Migrations

```bash
# Run all migrations
node run-migrations.js

# Create new migration
echo "-- Migration description" > database/migrations/$(date +%s)_migration_name.sql
```

### Performance Testing

```bash
# Run benchmark
python scripts/performance-benchmark.py

# Monitor services
./scripts/monitor-services.sh
```

## MCP Server Commands

```bash
# Test MCP servers
node test-mcp-servers.js

# View MCP configuration
cat mcp-config.json
```

---

For more detailed information, see the [Complete Implementation Guide](COMPLETE_IMPLEMENTATION_GUIDE.md).
