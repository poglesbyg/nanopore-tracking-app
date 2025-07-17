# Submission Service Integration Checklist

## 📋 Developer Checklist for API Gateway Integration

### Prerequisites
- [ ] Python submission service is deployed and accessible
- [ ] Service URL is known (e.g., `https://submission-service-dept-barc.apps.cloudapps.unc.edu`)
- [ ] Health endpoint is confirmed working (`/health`)

---

## 1. ✅ Add Submission Service to API Gateway Registry

### Location: `src/lib/gateway/APIGateway.ts`

- [ ] **Add service registration in `initializeServices()` method:**
  ```typescript
  // Submission Service
  this.services.set('submission', {
    name: 'submission',
    baseUrl: this.config.get('SUBMISSION_SERVICE_URL', 'http://localhost:8000'),
    healthCheckUrl: '/health',
    timeout: 60000, // 60 seconds for PDF processing
    retries: 2,
    circuitBreaker: {
      failureThreshold: 3,
      recoveryTimeout: 45000
    }
  })
  ```

- [ ] **Verify circuit breaker initialization includes the new service**
  - The existing loop should automatically handle it:
  ```typescript
  // Initialize circuit breakers
  for (const [serviceName] of this.services) {
    this.circuitBreakers.set(serviceName, {
      failures: 0,
      lastFailureTime: null,
      state: 'closed'
    })
  }
  ```

---

## 2. 🔧 Configure Environment Variables

### Local Development
- [ ] **Add to `.env.local` or `.env.development`:**
  ```env
  SUBMISSION_SERVICE_URL=http://localhost:8000
  ```

### Production/OpenShift
- [ ] **Update ConfigMap (`deployment/openshift/configmap.yaml`):**
  ```yaml
  data:
    SUBMISSION_SERVICE_URL: "http://submission-service:8000"
  ```
  
- [ ] **Or use external route for cross-namespace communication:**
  ```yaml
  data:
    SUBMISSION_SERVICE_URL: "https://submission-service-dept-barc.apps.cloudapps.unc.edu"
  ```

- [ ] **Apply ConfigMap changes:**
  ```bash
  oc apply -f deployment/openshift/configmap.yaml
  ```

---

## 3. 🏥 Add Health Check Support

- [ ] **Verify health check endpoint works:**
  ```bash
  curl https://submission-service-dept-barc.apps.cloudapps.unc.edu/health
  ```

- [ ] **Expected response:**
  ```json
  {
    "status": "healthy",
    "memory_usage": {
      "rss_mb": 45.2,
      "vms_mb": 120.5,
      "percent": 2.1,
      "available_mb": 2048.0
    },
    "service": "submission-service"
  }
  ```

- [ ] **Test from API Gateway:**
  ```typescript
  // Add test in your code or console
  const gateway = APIGateway.getInstance()
  const isHealthy = await gateway.checkServiceHealth('submission')
  console.log('Submission service healthy:', isHealthy)
  ```

---

## 4. 🔀 Create API Routes for PDF/CSV Processing

### Option A: Direct Gateway Route (Recommended)
- [ ] **Create `src/pages/api/submission/[...path].ts`:**
  ```typescript
  import type { NextApiRequest, NextApiResponse } from 'next'
  import { APIGateway } from '@/lib/gateway/APIGateway'

  export const config = {
    api: {
      bodyParser: false, // Important for file uploads
    },
  }

  export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
  ) {
    const gateway = APIGateway.getInstance()
    const path = Array.isArray(req.query.path) 
      ? `/${req.query.path.join('/')}` 
      : `/${req.query.path || ''}`

    try {
      const response = await gateway.routeRequest(
        'submission',
        req.method || 'GET',
        path,
        req.headers as Record<string, string>,
        req.body
      )

      const data = await response.json()
      res.status(response.status).json(data)
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  ```

### Option B: Specific Endpoints
- [ ] **Create `src/pages/api/process-pdf.ts`:**
  ```typescript
  export default async function handler(req, res) {
    const gateway = APIGateway.getInstance()
    const response = await gateway.routeRequest(
      'submission',
      'POST',
      '/process-pdf',
      req.headers,
      req.body
    )
    // ... handle response
  }
  ```

- [ ] **Create `src/pages/api/process-csv.ts`:**
  ```typescript
  // Similar to process-pdf.ts but for CSV
  ```

---

## 5. 🔌 Update Frontend Client

### Location: `src/lib/submission-client.ts`

- [ ] **Update base URL to use API Gateway:**
  ```typescript
  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/submission`
      : '/api/submission'
  ) {
    this.baseUrl = baseUrl
  }
  ```

- [ ] **Or use environment variable:**
  ```typescript
  constructor(
    baseUrl: string = process.env.NEXT_PUBLIC_SUBMISSION_SERVICE_URL 
      || process.env.SUBMISSION_SERVICE_URL 
      || '/api/submission'
  ) {
    this.baseUrl = baseUrl
  }
  ```

---

## 6. 🧪 Testing Checklist

### Unit Tests
- [ ] **Test service registration:**
  ```typescript
  describe('APIGateway', () => {
    it('should register submission service', () => {
      const gateway = APIGateway.getInstance()
      const services = gateway.getServices() // Add getter if needed
      expect(services.has('submission')).toBe(true)
    })
  })
  ```

### Integration Tests
- [ ] **Test PDF upload through gateway:**
  ```typescript
  const formData = new FormData()
  formData.append('file', testPdfFile)
  
  const response = await fetch('/api/submission/process-pdf', {
    method: 'POST',
    body: formData
  })
  
  expect(response.ok).toBe(true)
  ```

- [ ] **Test CSV upload through gateway:**
  ```typescript
  // Similar to PDF test
  ```

### Manual Testing
- [ ] Upload a PDF file through the UI
- [ ] Upload a CSV file through the UI
- [ ] Check logs for successful gateway routing
- [ ] Verify samples are created in the database

---

## 7. 🚀 Deployment Verification

- [ ] **Check all pods are running:**
  ```bash
  oc get pods -l app=nanopore-tracking-app
  oc get pods -l app=submission-service
  ```

- [ ] **Verify environment variables:**
  ```bash
  oc exec -it <pod-name> -- env | grep SUBMISSION_SERVICE_URL
  ```

- [ ] **Test end-to-end flow:**
  ```bash
  # From main app pod
  curl http://submission-service:8000/health
  
  # Or using external route
  curl https://submission-service-dept-barc.apps.cloudapps.unc.edu/health
  ```

- [ ] **Check gateway logs:**
  ```bash
  oc logs -l app=nanopore-tracking-app | grep submission
  ```

---

## 8. 📊 Monitoring & Observability

- [ ] **Add logging for submission service calls:**
  ```typescript
  this.logger.info('Routing to submission service', {
    path,
    method,
    fileSize: req.headers['content-length']
  })
  ```

- [ ] **Monitor circuit breaker status:**
  ```typescript
  const circuitStatus = gateway.getCircuitBreakerStatus('submission')
  console.log('Submission service circuit breaker:', circuitStatus)
  ```

- [ ] **Add metrics collection:**
  ```typescript
  // Track processing times
  const startTime = Date.now()
  const response = await gateway.routeRequest(...)
  const duration = Date.now() - startTime
  metrics.recordHistogram('submission_processing_time', duration)
  ```

---

## 9. 🔒 Security Considerations

- [ ] **Validate file types before forwarding:**
  ```typescript
  const allowedTypes = ['application/pdf', 'text/csv']
  if (!allowedTypes.includes(req.headers['content-type'])) {
    return res.status(400).json({ error: 'Invalid file type' })
  }
  ```

- [ ] **Add file size limits:**
  ```typescript
  const maxSize = 100 * 1024 * 1024 // 100MB
  if (parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ error: 'File too large' })
  }
  ```

- [ ] **Ensure authentication is passed through:**
  ```typescript
  // Forward auth headers
  const authHeaders = {
    'Authorization': req.headers.authorization,
    'X-User-ID': req.session?.userId
  }
  ```

---

## 10. 📝 Documentation Updates

- [ ] **Update API documentation with new endpoints**
- [ ] **Add submission service to architecture diagram**
- [ ] **Document environment variables in README**
- [ ] **Create troubleshooting guide for common issues**

---

## ✅ Final Verification

- [ ] PDF uploads work through the UI
- [ ] CSV uploads work through the UI
- [ ] Health checks pass for submission service
- [ ] Circuit breaker protects against service failures
- [ ] Logs show successful routing through gateway
- [ ] Memory usage is reduced compared to previous implementation
- [ ] All tests pass
- [ ] Documentation is updated

---

## 🎉 Success Criteria

The integration is complete when:
1. Files can be uploaded through the UI
2. Processing happens via the Python submission service
3. Results are displayed correctly in the UI
4. The system handles service failures gracefully
5. Memory usage is significantly reduced

---

## 🚨 Common Issues & Solutions

### Issue: Service not reachable
```bash
# Check DNS resolution
nslookup submission-service
# Check network policies
oc get networkpolicy
```

### Issue: Circuit breaker always open
```typescript
// Reset circuit breaker manually
gateway.resetCircuitBreaker('submission')
```

### Issue: File upload fails
```bash
# Check request size limits
oc get route -o yaml | grep -i limit
```

This checklist ensures proper integration of the Python submission service with the API Gateway for production-ready PDF/CSV processing. 