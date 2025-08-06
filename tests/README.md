# Nanopore Tracking Application - Comprehensive Test Suite

## Updated Test Structure (2025)

This directory contains comprehensive tests for the nanopore sample tracking application, covering PDF submission workflows, hierarchical data management, sample tracking, and workflow management.

### Unit Tests (Vitest)
- **Location**: `/tests/unit/`
- **Framework**: Vitest
- **Run**: `pnpm test:unit`

#### Core Features Tested:
1. **PDF Processing** (`pdf-processor.test.ts`)
   - HTSF PDF data extraction
   - Quote number parsing
   - Sample data validation

2. **Hierarchical Structure** (`hierarchy-structure.test.ts`)
   - Project model validation
   - Submission model validation
   - Sample model validation
   - Parent-child relationships

3. **Sample Service** (`sample-service.test.ts`)
   - Sample creation and retrieval
   - Pagination
   - Status updates

4. **AI Service** (`ai-service.test.ts`)
   - LLM integration
   - Text extraction
   - Confidence scoring

5. **Bulk Operations** (`bulk-operations.test.ts`)
   - Batch sample creation
   - Performance optimization

### End-to-End Tests (Playwright)
- **Location**: `/tests/e2e/`
- **Framework**: Playwright
- **Run**: `pnpm test:e2e` or `pnpm test:e2e:full`

#### Comprehensive Test Suites:

1. **Complete PDF Submission Flow** (`full-submission-flow.spec.ts`)
   - PDF upload and processing
   - Project creation from PDF data
   - Submission creation with sample extraction
   - Hierarchical display verification
   - Workflow stage transitions
   - Bulk operations testing
   - Data export functionality

2. **Hierarchical Dashboard** (`hierarchical-dashboard.spec.ts`)
   - Dashboard statistics display
   - Project/submission expansion and collapse
   - Sample detail viewing
   - Bulk selection and operations
   - Search and filtering
   - Empty state handling

3. **Workflow Management** (`workflow-management.spec.ts`)
   - Priority queue ordering
   - Workflow stage progression (8-step nanopore workflow)
   - Stage transition validation
   - Sample data validation by workflow stage
   - Workflow statistics and filtering

4. **Sample Management** (`sample-management.spec.ts`)
   - Dashboard display
   - Sample creation and editing
   - Filtering and search
   - Sample detail modal functionality

5. **Authentication** (`authentication.spec.ts`)
   - Login/logout flows
   - Session persistence
   - Role-based access
   - Workflow progression

3. **Production Workflows** (`production-workflows.spec.ts`)
   - Complete sample lifecycle
   - PDF upload and processing
   - Error handling
   - Concurrent operations

4. **Performance** (`performance.spec.ts`)
   - Load times
   - UI responsiveness
   - Memory efficiency

5. **Project & Submission Hierarchy** (`project-submission-hierarchy.spec.ts`) - NEW
   - Project creation
   - Submission with PDF upload
   - Hierarchical view navigation
   - Form validation

## Test Coverage Gaps

### Features NOT Fully Tested:
1. **Project Management**
   - Project editing/deletion
   - Project archiving
   - Owner management

2. **Submission Processing**
   - CSV bulk upload
   - Multiple file attachments
   - Submission status transitions

3. **API Endpoints**
   - Error responses
   - Authentication middleware
   - Rate limiting

4. **Database Operations**
   - Migration rollbacks
   - Transaction handling
   - Connection pooling

## Running Tests

### Comprehensive Test Execution
```bash
# All tests (unit + E2E)
pnpm test

# Comprehensive E2E test suite with detailed reporting
pnpm test:e2e:full
./tests/run-all-tests.sh
```

### Specific Test Suites
```bash
# Unit tests only
pnpm test:unit

# All E2E tests
pnpm test:e2e

# Specific E2E test suites
pnpm test:e2e:pdf       # PDF submission workflow
pnpm test:e2e:dashboard # Hierarchical dashboard
pnpm test:e2e:workflow  # Workflow management
```

### Development and Debugging
```bash
# E2E tests with UI
pnpm test:ui

# E2E tests in headed mode
pnpm test:headed

# Debug mode
pnpm test:debug

# Watch mode for unit tests
pnpm test:watch

# Generate and view test report
pnpm test:report
```

## Test Environment Setup

1. **Local Development**:
   - Ensure app is running on http://localhost:3001
   - Database should be initialized with test data

2. **CI/CD**:
   - Tests run automatically on push
   - Uses GitHub Actions
   - Generates coverage reports

## Best Practices

1. **Unit Tests**:
   - Test business logic in isolation
   - Mock external dependencies
   - Aim for >80% coverage

2. **E2E Tests**:
   - Test critical user paths
   - Use data-testid attributes
   - Clean up test data after runs

3. **Performance Tests**:
   - Monitor response times
   - Check memory usage
   - Test with realistic data volumes