# Nanopore Sequencing Microservices Architecture

## Overview

This microservices architecture decomposes the 8-step nanopore sequencing workflow into independent, scalable services. Each service handles a specific step in the sequencing pipeline, communicating through a message queue system.

## Architecture Components

### Core Services

1. **API Gateway** (`services/api-gateway/`)
   - Single entry point for all client requests
   - Route management and load balancing
   - Authentication and authorization
   - Rate limiting and monitoring

2. **Workflow Orchestrator** (`services/workflow-orchestrator/`)
   - Coordinates workflow step transitions
   - Manages sample state and progression
   - Handles workflow business logic
   - Monitors step completions and failures

### Workflow Step Services

3. **Sample QC Service** (`services/sample-qc/`)
   - Initial quality control validation
   - Concentration and purity measurements
   - Duration: ~1 hour

4. **Library Preparation Service** (`services/library-prep/`)
   - DNA/RNA library construction
   - Adapter ligation verification
   - Duration: ~4 hours

5. **Library QC Service** (`services/library-qc/`)
   - Quality metrics validation
   - Fragment size analysis
   - Duration: ~1 hour

6. **Sequencing Setup Service** (`services/sequencing-setup/`)
   - Flow cell preparation
   - Device configuration
   - Duration: ~1 hour

7. **Sequencing Run Service** (`services/sequencing-run/`)
   - Active sequencing monitoring
   - Real-time data collection
   - Duration: ~48 hours

8. **Basecalling Service** (`services/basecalling/`)
   - Raw signal conversion
   - Initial sequence assembly
   - Duration: ~2 hours

9. **Quality Assessment Service** (`services/quality-assessment/`)
   - Read quality metrics
   - Coverage analysis
   - Duration: ~1 hour

10. **Data Delivery Service** (`services/data-delivery/`)
    - Results packaging
    - Data transfer validation
    - Duration: ~1 hour

### Support Services

11. **AI Extraction Service** (`services/ai-extraction/`)
    - PDF form processing
    - Field extraction and validation
    - RAG-enhanced data processing

12. **PDF Processing Service** (`services/pdf-processing/`)
    - Document parsing and text extraction
    - Metadata extraction
    - File storage management

13. **Export Service** (`services/export/`)
    - Data transformation and formatting
    - Integration with downstream tools
    - Custom export formats

14. **Notification Service** (`services/notification/`)
    - Real-time status updates
    - Email notifications
    - WebSocket connections

### Infrastructure Services

15. **Message Queue** (`infrastructure/message-queue/`)
    - Event-driven communication
    - Service decoupling
    - Reliability and scalability

16. **Service Discovery** (`infrastructure/service-discovery/`)
    - Dynamic service registration
    - Health checking
    - Load balancing

17. **Configuration Service** (`infrastructure/config/`)
    - Centralized configuration management
    - Environment-specific settings
    - Runtime configuration updates

## Communication Patterns

### Event-Driven Architecture
- Services communicate through events published to the message queue
- Each service publishes events when work is completed
- Other services subscribe to relevant events

### Common Events
- `sample.created`
- `step.started`
- `step.completed`
- `step.failed`
- `workflow.completed`
- `priority.changed`

### Service APIs
- Each service exposes RESTful APIs for direct communication
- GraphQL gateway for complex queries
- gRPC for high-performance inter-service communication

## Data Management

### Database Strategy
- **Shared Database per Service**: Each service has its own database schema
- **Event Sourcing**: Track all state changes through events
- **CQRS**: Separate read and write models for optimal performance

### Data Consistency
- **Eventual Consistency**: Services synchronize through events
- **Saga Pattern**: Manage distributed transactions
- **Compensation Actions**: Handle failures gracefully

## Deployment Strategy

### Containerization
- Each service runs in its own Docker container
- Kubernetes orchestration for scaling and management
- Helm charts for configuration management

### Development Environment
```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up workflow-orchestrator

# Run tests
npm run test:services
```

### Production Deployment
- OpenShift/Kubernetes deployment
- Auto-scaling based on workload
- Blue-green deployments
- Circuit breakers for fault tolerance

## Monitoring and Observability

### Metrics
- Service-level metrics (latency, throughput, errors)
- Business metrics (samples processed, workflow completion times)
- Infrastructure metrics (CPU, memory, network)

### Logging
- Structured logging with correlation IDs
- Centralized log aggregation
- Distributed tracing

### Health Checks
- Service health endpoints
- Dependency health monitoring
- Circuit breaker patterns

## Security

### Authentication & Authorization
- JWT tokens for service authentication
- Role-based access control (RBAC)
- API key management for external services

### Data Protection
- Encryption at rest and in transit
- Secure secret management
- Audit logging

## Service Development Guidelines

### Technology Stack
- **Node.js/TypeScript** for service implementation
- **Express.js** for HTTP APIs
- **NATS/RabbitMQ** for message queuing
- **Redis** for caching and session storage
- **PostgreSQL** for data persistence

### Code Structure
```
services/[service-name]/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── events/
│   └── config/
├── tests/
├── Dockerfile
└── package.json
```

### Best Practices
- Single responsibility principle
- Domain-driven design
- Fail-fast error handling
- Graceful degradation
- Idempotent operations

## Getting Started

1. **Prerequisites**
   - Node.js 18+
   - Docker and Docker Compose
   - PostgreSQL
   - Redis
   - NATS/RabbitMQ

2. **Installation**
   ```bash
   # Install dependencies
   npm install
   
   # Start infrastructure services
   docker-compose up -d postgres redis nats
   
   # Start all microservices
   npm run dev:services
   ```

3. **Development**
   ```bash
   # Generate service template
   npm run generate:service [service-name]
   
   # Run specific service
   npm run dev:service [service-name]
   
   # Run tests
   npm run test:service [service-name]
   ```

## Migration from Monolith

### Phase 1: Extract Core Services
- Workflow Orchestrator
- Sample QC Service
- Library Prep Service

### Phase 2: Extract Processing Services
- Library QC Service
- Sequencing Setup Service
- Sequencing Run Service

### Phase 3: Extract Analysis Services
- Basecalling Service
- Quality Assessment Service
- Data Delivery Service

### Phase 4: Extract Support Services
- AI Extraction Service
- PDF Processing Service
- Export Service

## Service Catalog

| Service | Port | Health Check | Dependencies |
|---------|------|--------------|--------------|
| API Gateway | 3000 | `/health` | All services |
| Workflow Orchestrator | 3001 | `/health` | Database, Message Queue |
| Sample QC | 3002 | `/health` | Database, Message Queue |
| Library Prep | 3003 | `/health` | Database, Message Queue |
| Library QC | 3004 | `/health` | Database, Message Queue |
| Sequencing Setup | 3005 | `/health` | Database, Message Queue |
| Sequencing Run | 3006 | `/health` | Database, Message Queue |
| Basecalling | 3007 | `/health` | Database, Message Queue |
| Quality Assessment | 3008 | `/health` | Database, Message Queue |
| Data Delivery | 3009 | `/health` | Database, Message Queue |

## Contributing

1. Follow the service development guidelines
2. Add comprehensive tests for all new features
3. Update documentation for API changes
4. Ensure proper error handling and logging
5. Add monitoring and metrics for new endpoints 