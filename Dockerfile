FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built application and package files
COPY --from=base /app/dist ./dist
COPY --from=base /app/package*.json ./

# Install all dependencies needed for runtime
RUN npm ci --ignore-scripts && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S astro -u 1001

# Change ownership of the app directory
RUN chown -R astro:nodejs /app
USER astro

# Set the port and host environment variables
ENV PORT=3001
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]