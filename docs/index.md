# Nanopore Tracking Application Documentation

Welcome to the Nanopore Tracking Application documentation! This system provides comprehensive sample tracking and management for Oxford Nanopore sequencing workflows.

## Overview

The Nanopore Tracking Application is a modern, microservices-based system designed to streamline the management of Oxford Nanopore sequencing samples from submission through data delivery. Built with React, TypeScript, Python, and PostgreSQL, it provides an intuitive interface for researchers and lab technicians.

### Key Features

- 📋 **Sample Management**: Track samples through the entire sequencing workflow
- 🤖 **AI-Enhanced Processing**: Automatic extraction of sample data from PDF forms
- 📊 **Real-time Status Tracking**: Monitor sample progress through 8 workflow stages
- 🔒 **Secure Authentication**: Role-based access control with Better-auth
- 📈 **Performance Monitoring**: Built-in metrics and health monitoring
- 🚀 **Cloud-Native Architecture**: Deployed on OpenShift with automatic scaling

## Documentation Contents

```{toctree}
:maxdepth: 2
:caption: Getting Started

QUICK_REFERENCE
COMPLETE_IMPLEMENTATION_GUIDE
```

```{toctree}
:maxdepth: 2
:caption: Architecture & Design

MICROSERVICES_ANALYSIS
MICROSERVICES_MIGRATION_PLAN
DATABASE_SEPARATION_GUIDE
SERVICE_MESH_IMPLEMENTATION
```

```{toctree}
:maxdepth: 2
:caption: Development Guides

SERVICE_COMMUNICATION_GUIDE
CORS_CONFIGURATION_GUIDE
QUOTA_OPTIMIZED_SERVICE_MESH
```

```{toctree}
:maxdepth: 2
:caption: Deployment & Operations

PHASE3_PRODUCTION_DEPLOYMENT
PRODUCTION_RUNBOOK
PROMETHEUS_DEPLOYMENT_SUMMARY
MICROSERVICES_PROGRESS
```

## Quick Links

- [API Documentation](api/index)
- [Frontend Components](frontend/index)
- [Backend Services](backend/index)
- [Database Schema](database/index)

## Technology Stack

### Frontend
- **React 19** with TypeScript
- **Astro 5.x** for server-side rendering
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **tRPC** for type-safe API communication

### Backend
- **Python FastAPI** for microservices
- **Node.js** with Express for gateway services
- **PostgreSQL** for data persistence
- **Redis** for caching and sessions
- **Ollama** for AI/ML capabilities

### Infrastructure
- **OpenShift** container platform
- **Docker** for containerization
- **Prometheus** for monitoring
- **Grafana** for visualization

## Project Structure

```
nanopore-tracking-app/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── lib/               # Core libraries and utilities
│   ├── pages/             # Astro pages and API routes
│   └── services/          # Business logic services
├── services/              # Microservices
│   ├── ai-processing/     # AI/ML processing service
│   ├── authentication/    # Auth service
│   ├── audit/            # Audit logging service
│   ├── file-storage/     # File management service
│   ├── submission-service/# PDF/CSV processing
│   └── sample-management/ # Core sample tracking
├── database/             # Database migrations
├── deployment/           # Deployment configurations
└── docs/                # Documentation
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](contributing) for details on:
- Setting up your development environment
- Code style and standards
- Submitting pull requests
- Reporting issues

## Support

For questions or issues:
- 📧 Email: support@unc.edu
- 🐛 GitHub Issues: [Report a bug](https://github.com/unc-barc/nanopore-tracking-app/issues)
- 📚 Wiki: [Internal documentation](https://wiki.unc.edu/nanopore-tracking)

---

*Last updated: {sub-ref}`today`* 