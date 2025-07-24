# Ultra-Minimal Dashboard Guide

## Overview

The Nanopore Tracking App now features an ultra-minimal frontend that focuses purely on essential functionality:
- Submit samples with minimal fields
- View sample list
- Upload PDFs for processing
- No authentication required
- No external UI libraries
- Plain HTML/CSS styling

## Key Features

### 1. Ultra-Simple Dashboard
- **Single stat**: Total sample count only
- **Minimal form**: Just 3 required fields (sample name, submitter name, email)
- **Plain table**: Simple HTML table showing samples
- **No dependencies**: Uses only React hooks and native fetch API

### 2. Simplified PDF Upload
- **Basic file input**: Standard HTML file input
- **Simple feedback**: Success/error messages
- **No preview**: Direct upload without complex UI
- **Minimal processing**: Shows extracted data if available

### 3. Clean Home Page
- **Two buttons**: Dashboard and PDF submission
- **Simple instructions**: Basic numbered list
- **No graphics**: Text-only interface
- **Fast loading**: No heavy components

## Technical Implementation

### Component Structure
- `ultra-minimal-dashboard.tsx`: ~200 lines of simple React
- Direct fetch API calls instead of tRPC hooks
- Inline styles instead of Tailwind classes
- No external component libraries

### API Integration
- Direct HTTP calls to `/api/trpc/` endpoints
- Simple JSON request/response handling
- Basic error handling with alerts

### Removed Features
All non-essential features have been removed:
- Authentication system
- Complex UI components (Cards, Badges, Icons)
- Advanced filtering and search
- Bulk operations
- Export functionality
- Priority and status badges
- Pagination
- Modal dialogs
- Toast notifications
- Loading spinners (except basic text)

## File Locations

- Dashboard: `/src/components/nanopore/ultra-minimal-dashboard.tsx`
- Home page: `/src/pages/index.astro`
- PDF upload: `/src/pages/submit-pdf.astro`
- Main app: `/src/pages/nanopore.astro`

## Usage

1. **Submit a sample**:
   - Click "Submit New Sample" button
   - Fill in 3 fields: name, submitter, email
   - Click Submit

2. **View samples**:
   - All samples shown in a simple table
   - Shows: name, submitter, status, date

3. **Upload PDF**:
   - Go to /submit-pdf
   - Select PDF file
   - Click Upload PDF
   - See success/error message

## Benefits

- **Fast loading**: Minimal JavaScript and CSS
- **Easy to understand**: Simple code structure
- **Low maintenance**: Few dependencies
- **Mobile friendly**: Works on any device
- **Accessible**: Standard HTML elements

## Future Considerations

If needed, these features could be added incrementally:
- Basic search box
- Simple status filter
- CSV download link
- More sample fields

The ultra-minimal approach ensures the application remains focused on core functionality while being extremely easy to use and maintain. 