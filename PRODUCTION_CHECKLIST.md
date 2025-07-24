# Production Readiness Checklist

## 🚀 Deployment Readiness

### Infrastructure
- [ ] OpenShift cluster access configured
- [ ] Resource quotas verified (min 2GB RAM, 1 CPU)
- [ ] Persistent storage configured (5GB minimum)
- [ ] Database provisioned and accessible
- [ ] Network policies configured

### Configuration
- [ ] Production environment variables set
- [ ] Secrets properly configured in OpenShift
- [ ] Database connection string updated
- [ ] JWT secret generated (min 32 chars)
- [ ] Admin password set securely

### Security
- [ ] HTTPS/TLS configured on routes
- [ ] CORS settings reviewed
- [ ] Authentication enabled
- [ ] Secrets rotated from defaults
- [ ] Security headers enabled

### Application
- [ ] Production build created
- [ ] Static assets optimized
- [ ] Error tracking configured
- [ ] Health checks verified
- [ ] Graceful shutdown implemented

## 📊 Monitoring & Observability

- [ ] Health endpoints accessible
- [ ] Prometheus metrics exposed
- [ ] Log aggregation configured
- [ ] Alerts configured for:
  - [ ] High memory usage (>80%)
  - [ ] High CPU usage (>70%)
  - [ ] Pod crashes
  - [ ] Database connection failures
  - [ ] API response time >2s

## 🧪 Testing

- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load testing completed
- [ ] Security scanning completed

## 📝 Documentation

- [ ] API documentation current
- [ ] Runbook updated
- [ ] Deployment guide reviewed
- [ ] Environment variables documented
- [ ] Architecture diagrams current

## 🔄 Backup & Recovery

- [ ] Database backup strategy implemented
- [ ] File storage backup configured
- [ ] Disaster recovery plan documented
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined

## 🚦 Go-Live Criteria

### Must Have
- [x] Application deploys successfully
- [x] Health checks passing
- [x] Database connectivity verified
- [ ] Authentication working
- [ ] Core features tested in production
- [ ] Monitoring configured
- [ ] Backups configured

### Nice to Have
- [ ] Auto-scaling configured
- [ ] CDN configured for assets
- [ ] Advanced monitoring dashboards
- [ ] Automated backup testing

## 📋 Deployment Steps

1. **Pre-deployment**
   ```bash
   # Review configuration
   cat config/production.env.template
   
   # Update secrets
   oc edit secret nanopore-secrets -n dept-barc
   ```

2. **Deploy**
   ```bash
   # Apply production configuration
   oc apply -f deployment/openshift/production/nanopore-production.yaml
   
   # Or use minimal resources
   oc apply -f deployment/openshift/production/minimal-resource-deployment.yaml
   ```

3. **Verify**
   ```bash
   # Check deployment status
   oc rollout status deployment/nanopore-app -n dept-barc
   
   # Check pods
   oc get pods -l app=nanopore-tracking -n dept-barc
   
   # Check logs
   oc logs -l app=nanopore-tracking -n dept-barc
   ```

4. **Test**
   ```bash
   # Health check
   curl https://nanopore-dept-barc.apps.cloudapps.unc.edu/health
   
   # Basic functionality
   curl https://nanopore-dept-barc.apps.cloudapps.unc.edu/api/health
   ```

## 🔥 Rollback Plan

If issues occur:

1. **Quick Rollback**
   ```bash
   oc rollout undo deployment/nanopore-app -n dept-barc
   ```

2. **Full Rollback**
   ```bash
   oc delete -f deployment/openshift/production/nanopore-production.yaml
   oc apply -f deployment/openshift/production/previous-version.yaml
   ```

## 📞 Contacts

- **Platform Team**: platform@unc.edu
- **Database Admin**: dba@unc.edu
- **On-Call**: +1-xxx-xxx-xxxx
- **Escalation**: manager@unc.edu

## ✅ Sign-off

- [ ] Development Team Lead
- [ ] Operations Team Lead
- [ ] Security Review
- [ ] Business Owner

---

**Last Updated**: January 2025
**Version**: 1.0.0 