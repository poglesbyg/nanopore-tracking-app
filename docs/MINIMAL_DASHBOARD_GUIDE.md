# Minimal Dashboard Guide

## Overview

The Nanopore Tracking App now features a simplified, minimal dashboard that focuses on core functionality:
- View samples and their status
- Submit new samples
- Track submission progress

## Key Features

### 1. Simple Dashboard View
- **Stats Overview**: See total samples, submitted, in progress, and completed counts at a glance
- **Clean Interface**: Removed complex features like admin panels, bulk operations, and advanced filters
- **Mobile Friendly**: Responsive design that works on all devices

### 2. Sample Submission
- **Quick Form**: Simple form with only essential fields:
  - Sample Name
  - Sample Type (DNA/RNA/Protein/Other)
  - Submitter Name & Email
  - Concentration (optional)
  - Volume (optional)
  - Priority level
- **Instant Feedback**: Success/error messages for submissions
- **Default Values**: Chart field automatically set to HTSF-001

### 3. Sample List
- **Clear Display**: Each sample shows:
  - Sample name
  - Submitter information
  - Type and measurements
  - Submission date
  - Current status badge
  - Priority badge
- **Status Tracking**: Visual badges for different workflow stages
- **No Pagination**: All samples visible on one page for simplicity

## Removed Features
To achieve a minimal, functional interface, the following features were removed:
- Authentication/login system
- Admin panels (memory optimization, audit, config, shutdown, migration)
- Bulk operations and selection
- PDF/CSV upload modals
- Complex filtering and search
- Edit/delete/assign functionality
- Export functionality
- User menu and settings
- Pagination

## Technical Changes

### Component Structure
- Created new `minimal-dashboard.tsx` component (~350 lines vs 1600+ lines)
- Uses native HTML form elements instead of complex UI libraries
- Direct tRPC integration for data fetching and mutations
- Simplified state management with React hooks

### API Integration
- Uses existing tRPC endpoints:
  - `nanopore.getAll` - Fetch all samples
  - `nanopore.create` - Create new sample
- Removed unused mutations for update, delete, assign, etc.

## Deployment

The minimal dashboard is deployed to OpenShift and accessible at:
- Development: http://localhost:3001
- Production: https://nanopore-minimal-dept-barc.apps.cloudapps.unc.edu

## Future Enhancements

If needed, the following features could be added back incrementally:
1. Basic search/filter functionality
2. Edit sample information
3. CSV export
4. Simple authentication

## Code Location

- Main component: `/src/components/nanopore/minimal-dashboard.tsx`
- Page integration: `/src/pages/nanopore.astro`
- Deployment config: `/deployment/scripts/deploy-minimal.sh` 