#!/bin/bash

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Rebuilding Nanopore Tracking App     ${NC}"
echo -e "${BLUE}========================================${NC}"

# Step 1: Install dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
pnpm install

# Step 2: Clean build artifacts
echo -e "${GREEN}🧹 Cleaning build artifacts...${NC}"
pnpm clean

# Step 3: Build the application
echo -e "${GREEN}🏗️ Building the application...${NC}"
pnpm build

# Step 4: Start the development server
echo -e "${GREEN}🚀 Starting development server...${NC}"
echo -e "${YELLOW}The app will be available at http://localhost:3001${NC}"
echo -e "${YELLOW}💡 Look for 'CODE VERSION: 2.1 - with flowCell fix' in the console to confirm new code is running${NC}"
echo -e "${YELLOW}💡 Press Ctrl+C to stop the server${NC}"
echo ""
pnpm dev 