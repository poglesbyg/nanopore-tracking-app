# Nanopore Frontend Service

A React/TypeScript/Astro frontend microservice for the Nanopore Tracking Application.

## Features

- 🚀 **Modern Stack**: React 18, TypeScript, Astro 4
- 🎨 **Beautiful UI**: Tailwind CSS + Radix UI components
- 📱 **Responsive**: Mobile-first design
- 🔧 **Microservices**: Communicates with backend services via REST APIs
- 🐳 **Containerized**: Docker support for easy deployment
- ☁️ **Cloud Ready**: OpenShift deployment configurations

## Architecture

This frontend service communicates with the following backend microservices:

- **Sample Management Service**: CRUD operations for samples
- **Submission Service**: PDF processing and data extraction
- **Authentication Service**: User authentication and authorization
- **File Storage Service**: File upload and management
- **Audit Service**: Activity logging and audit trails
- **AI Processing Service**: AI-powered data processing

## Development

### Prerequisites

- Node.js 20+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The development server will start on `http://localhost:3000`.

### Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript type checking

## Configuration

The frontend service uses environment variables to configure microservice endpoints:

```env
# Service URLs
SAMPLE_MANAGEMENT_URL=http://sample-management:3002
SUBMISSION_SERVICE_URL=https://submission-service-dept-barc.apps.cloudapps.unc.edu
AUTH_SERVICE_URL=http://authentication:3003
FILE_STORAGE_URL=http://file-storage:3004
AUDIT_SERVICE_URL=http://audit:3005
AI_PROCESSING_URL=http://ai-processing:3006

# Server configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

## Deployment

### Docker

```bash
# Build image
docker build -t nanopore-frontend .

# Run container
docker run -p 3000:3000 nanopore-frontend
```

### OpenShift

```bash
# Deploy to OpenShift
./deploy.sh
```

The deployment script will:
1. Build the container image
2. Deploy to OpenShift
3. Create routes for external access

## API Integration

The frontend uses a microservice client (`src/lib/microservice-client.ts`) to communicate with backend services:

```typescript
import { microserviceClient } from '@/lib/microservice-client'

// Get all samples
const samples = await microserviceClient.getSamples()

// Process PDF
const result = await microserviceClient.processPDF(file)

// Create sample
const sample = await microserviceClient.createSample(sampleData)
```

## Health Checks

The service provides a health endpoint at `/health` that returns:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "service": "nanopore-frontend",
  "version": "1.0.0"
}
```

## Components

### Key Components

- **NanoporeDashboard**: Main dashboard with sample management
- **PDFUpload**: File upload and processing interface
- **ExportModal**: Data export functionality
- **StatusBadge**: Visual status indicators
- **PriorityBadge**: Priority level indicators

### UI Components

Built with Radix UI primitives:
- Button, Card, Input, Select
- Dialog, Dropdown, Tabs
- Badge, Separator, Tooltip

## Features

### Sample Management
- View all samples with filtering and search
- Create new samples manually or from PDF extraction
- Update sample status and priority
- Delete samples
- Export data to CSV/JSON

### PDF Processing
- Drag-and-drop PDF upload
- AI-powered data extraction
- Real-time processing status
- Error handling and retry logic

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interactions
- Accessible navigation

## Performance

- **Bundle Size**: Optimized with code splitting
- **Loading**: Lazy loading for components
- **Caching**: Browser caching for static assets
- **Memory**: Efficient React patterns

## Security

- **CORS**: Configured for microservice communication
- **Headers**: Security headers applied
- **Input**: Client-side validation
- **API**: Secure communication with backend services

## Monitoring

- Health check endpoint
- Error boundary components
- Console logging for debugging
- Performance metrics collection

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all linter checks pass

## License

This project is part of the Nanopore Tracking Application. 