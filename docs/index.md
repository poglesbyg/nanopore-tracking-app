# Nanopore Tracking Application

Welcome to the documentation for the Nanopore Tracking Application - a comprehensive sample management system for Oxford Nanopore sequencing workflows.

## Overview

The Nanopore Tracking Application is a full-stack web application designed to streamline the management of nanopore sequencing samples from submission through data delivery. Built with modern technologies and following microservices architecture principles, it provides laboratory staff with powerful tools for tracking, processing, and managing sequencing workflows.

## Key Features

### 🧬 Sample Management
- **Hierarchical Data Structure**: Projects → Submissions → Samples
- **8-Step Laboratory Workflow**: From Sample QC to Data Delivery
- **Status Tracking**: Including the new "distributed" status for delivered samples
- **Priority System**: Low, Normal, High, and Urgent processing levels

### 🤖 AI-Powered Processing
- **PDF Extraction**: Automated extraction from HTSF quote forms
- **LLM Integration**: Using Ollama for intelligent data processing
- **RAG System**: Retrieval-augmented generation for improved accuracy
- **Pattern Matching**: Rule-based extraction with confidence scoring

### 🏗️ Architecture
- **Microservices Design**: Modular, scalable architecture
- **Type-Safe APIs**: Using tRPC with TypeScript
- **Real-time Updates**: WebSocket support for live status tracking
- **Comprehensive Monitoring**: Prometheus and Grafana integration

### 🔒 Security & Compliance
- **Authentication**: Secure user authentication with Better-auth
- **Audit Trail**: Complete logging of all data changes
- **Role-Based Access**: RBAC for fine-grained permissions
- **Data Protection**: Input sanitization and secure storage

## Quick Links

- **[Architecture Diagrams](ARCHITECTURE_DIAGRAMS.md)** - Visual representations of system architecture
- **[Quick Reference](QUICK_REFERENCE.md)** - Common commands and configurations
- **[Implementation Guide](COMPLETE_IMPLEMENTATION_GUIDE.md)** - Step-by-step setup instructions
- **[Production Deployment](PHASE3_PRODUCTION_DEPLOYMENT.md)** - Production deployment guide

## Technology Stack

### Frontend
- **Astro 5.x** - Server-side rendering framework
- **React 19** - UI component library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives

### Backend
- **tRPC** - Type-safe API layer
- **PostgreSQL** - Primary database
- **Kysely** - Type-safe SQL query builder
- **Zod** - Runtime schema validation
- **Redis** - Caching and session storage

### Infrastructure
- **Docker** - Containerization
- **Kubernetes/OpenShift** - Container orchestration
- **Prometheus** - Metrics collection
- **Grafana** - Visualization

## Sample Status Workflow

The application tracks samples through the following status progression:

```
submitted → prep → sequencing → analysis → completed → distributed → archived
```

**New Status**: The `distributed` status has been recently added to track when samples/data have been delivered to customers.

## Laboratory Workflow Steps

1. **Sample QC** - Initial quality control
2. **Library Preparation** - Sample processing
3. **Library QC** - Library validation
4. **Sequencing Setup** - Configure sequencing run
5. **Sequencing Run** - Execute sequencing
6. **Basecalling** - Convert electrical signals to base calls
7. **Quality Assessment** - Validate results
8. **Data Delivery** - Transfer data to customer

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 15+
- Docker (optional, for containerized deployment)
- Ollama (optional, for AI features)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/poglesbyg/nanopore-tracking-app.git
cd nanopore-tracking-app

# Install dependencies
pnpm install

# Set up the database
pnpm db:setup

# Start development server
pnpm dev
```

The application will be available at `http://localhost:3001`

### Docker Deployment

```bash
# Basic deployment
docker-compose -f deployment/docker/docker-compose.yml up

# Full microservices deployment
docker-compose -f deployment/docker/docker-compose.microservices.yml up
```

## Documentation Structure

- **Getting Started** - Installation and setup guides
- **Architecture** - System design and technical documentation
- **Development** - Development guides and best practices
- **Operations** - Deployment and operational procedures

## Recent Updates

### Version 1.1.0 - Distributed Status
- Added "distributed" status for tracking delivered samples
- Database migration for status constraint update
- UI components updated with new status badge
- Validation rules updated to include distributed status

## Support

For issues, questions, or contributions:
- **Repository**: [GitHub](https://github.com/poglesbyg/nanopore-tracking-app)
- **Documentation**: [Read the Docs](https://nanopore-tracking-app.readthedocs.io)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

*Built with ❤️ by the UNC BARC Team*
