# CORS Configuration Guide

## Overview

This guide explains how to configure and troubleshoot Cross-Origin Resource Sharing (CORS) in the nanopore tracking application's microservices architecture.

## Architecture

The application uses a centralized CORS configuration approach:

1. **Centralized ConfigMap**: All CORS settings are stored in a single OpenShift ConfigMap
2. **Standardized Middleware**: Common CORS middleware for Python and TypeScript services
3. **Environment-based Configuration**: CORS settings are injected via environment variables
4. **Deployment Templates**: Standardized deployment templates include CORS configuration

## Configuration

### 1. CORS ConfigMap

The centralized CORS configuration is stored in `deployment/openshift/cors-config.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cors-config
  labels:
    app: nanopore-microservices
    component: cors-config
data:
  CORS_ORIGINS: "https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu,https://nanopore-frontend-final-dept-barc.apps.cloudapps.unc.edu,https://nanopore-tracking-route-dept-barc.apps.cloudapps.unc.edu,http://localhost:3000,http://localhost:3001"
  CORS_METHODS: "GET,POST,PUT,DELETE,OPTIONS,PATCH"
  CORS_HEADERS: "Content-Type,Authorization,X-Requested-With,Accept,Origin,Access-Control-Request-Method,Access-Control-Request-Headers"
  CORS_CREDENTIALS: "true"
  CORS_MAX_AGE: "86400"
```

### 2. Environment Variables

Each service receives these environment variables:

- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `CORS_METHODS`: Comma-separated list of allowed HTTP methods
- `CORS_HEADERS`: Comma-separated list of allowed headers
- `CORS_CREDENTIALS`: Whether to allow credentials (true/false)
- `CORS_MAX_AGE`: Preflight cache duration in seconds

### 3. Service Implementation

#### Python FastAPI Services

Use the standardized middleware from `scripts/cors-middleware-python.py`:

```python
from cors_middleware import add_cors_middleware

app = FastAPI()
add_cors_middleware(app)
```

#### TypeScript/Node.js Services

Use the standardized middleware from `scripts/cors-middleware-typescript.ts`:

```typescript
import { createCorsMiddleware } from './cors-middleware';

const app = express();
app.use(createCorsMiddleware());
```

## Deployment

### 1. Using the Deployment Script

Deploy a new service with CORS configuration:

```bash
./scripts/deploy-service-with-cors.sh sample-management api registry/sample-management:latest 8000
```

### 2. Manual Deployment

Apply the CORS ConfigMap:

```bash
oc apply -f deployment/openshift/cors-config.yaml
```

Add environment variables to your deployment:

```yaml
env:
- name: CORS_ORIGINS
  valueFrom:
    configMapKeyRef:
      name: cors-config
      key: CORS_ORIGINS
# ... other CORS environment variables
```

## Troubleshooting

### Common Issues

#### 1. "Access to fetch has been blocked by CORS policy"

**Symptoms:**
- Browser console shows CORS error
- Network tab shows failed preflight requests

**Solutions:**
1. Check if the frontend origin is in `CORS_ORIGINS`
2. Verify the service is using the CORS middleware
3. Ensure environment variables are properly set

**Debug commands:**
```bash
# Check CORS environment variables in pod
oc exec <pod-name> -- env | grep CORS

# Test CORS preflight request
curl -v -H "Origin: https://your-frontend.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     https://your-service.com/api/health
```

#### 2. "CORS preflight request failed"

**Symptoms:**
- OPTIONS requests return 404 or 500 errors
- Missing CORS headers in response

**Solutions:**
1. Ensure the service handles OPTIONS requests
2. Check if CORS middleware is properly configured
3. Verify the service is running and healthy

#### 3. "Credentials not allowed"

**Symptoms:**
- Requests with credentials fail
- Missing `Access-Control-Allow-Credentials` header

**Solutions:**
1. Set `CORS_CREDENTIALS=true` in ConfigMap
2. Ensure frontend sends credentials correctly
3. Check if specific origins are listed (not wildcard)

### Testing CORS

#### 1. Test Preflight Request

```bash
curl -v \
  -H "Origin: https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS \
  https://your-service.com/api/health
```

Expected response headers:
- `Access-Control-Allow-Origin: https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
- `Access-Control-Allow-Headers: X-Requested-With`
- `Access-Control-Allow-Credentials: true`

#### 2. Test Actual Request

```bash
curl -v \
  -H "Origin: https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu" \
  https://your-service.com/api/health
```

Expected response headers:
- `Access-Control-Allow-Origin: https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu`

### Debugging Steps

1. **Check ConfigMap**:
   ```bash
   oc get configmap cors-config -o yaml
   ```

2. **Check Pod Environment Variables**:
   ```bash
   oc exec <pod-name> -- env | grep CORS
   ```

3. **Check Service Logs**:
   ```bash
   oc logs deployment/<service-name>
   ```

4. **Test Service Health**:
   ```bash
   curl https://<service-route>/health
   ```

5. **Validate CORS Configuration**:
   ```bash
   # In Python service
   from cors_middleware import validate_cors_config
   config = validate_cors_config()
   print(config)
   ```

## Security Considerations

### 1. Origin Validation

- Never use wildcard (`*`) in production
- List specific frontend domains
- Use HTTPS for all production origins

### 2. Credentials Handling

- Only allow credentials for trusted origins
- Use secure cookies with `SameSite` attribute
- Implement proper authentication

### 3. Header Restrictions

- Only allow necessary headers
- Avoid exposing sensitive headers
- Use minimal required permissions

## Configuration Examples

### Development Environment

```yaml
CORS_ORIGINS: "http://localhost:3000,http://localhost:3001"
CORS_CREDENTIALS: "true"
```

### Production Environment

```yaml
CORS_ORIGINS: "https://nanopore-frontend-microservice-dept-barc.apps.cloudapps.unc.edu,https://nanopore-frontend-final-dept-barc.apps.cloudapps.unc.edu"
CORS_CREDENTIALS: "true"
```

### Testing Environment

```yaml
CORS_ORIGINS: "https://test-frontend.example.com"
CORS_CREDENTIALS: "false"
```

## Monitoring

### 1. Metrics

Monitor CORS-related metrics:
- Number of preflight requests
- Failed CORS requests
- Response times for OPTIONS requests

### 2. Logging

Log CORS events:
- Rejected origins
- Preflight request details
- Configuration changes

### 3. Alerts

Set up alerts for:
- High number of CORS failures
- Unexpected origins in requests
- Configuration validation errors

## Best Practices

1. **Centralized Configuration**: Use the ConfigMap for all services
2. **Environment-Specific Settings**: Different origins for dev/prod
3. **Minimal Permissions**: Only allow necessary methods and headers
4. **Regular Testing**: Automated CORS testing in CI/CD
5. **Documentation**: Keep this guide updated with changes
6. **Security Reviews**: Regular security audits of CORS configuration

## Related Documentation

- [OpenShift Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Microservices Architecture](MICROSERVICES_ARCHITECTURE.md)
- [Security Guidelines](SECURITY_GUIDELINES.md)
- [API Documentation](API_DOCUMENTATION.md) 