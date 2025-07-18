#!/bin/bash

# Setup Monitoring for Python Microservices in OpenShift
# This script configures Prometheus monitoring, Grafana dashboards, and alerting

set -e

# Configuration
NAMESPACE="dept-barc"
APP_NAME="nanopore-microservices"
MONITORING_NAMESPACE="openshift-monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if oc is available
check_oc_cli() {
    if ! command -v oc &> /dev/null; then
        log_error "OpenShift CLI (oc) is not installed or not in PATH"
        exit 1
    fi
    
    # Check if logged in
    if ! oc whoami &> /dev/null; then
        log_error "Not logged in to OpenShift. Please run 'oc login' first"
        exit 1
    fi
    
    log_success "OpenShift CLI is available and logged in as $(oc whoami)"
}

# Check if namespace exists
check_namespace() {
    if ! oc get namespace "$NAMESPACE" &> /dev/null; then
        log_error "Namespace '$NAMESPACE' does not exist"
        exit 1
    fi
    
    log_success "Namespace '$NAMESPACE' exists"
}

# Enable user workload monitoring
enable_user_workload_monitoring() {
    log_info "Enabling user workload monitoring..."
    
    # Check if cluster monitoring config exists
    if oc get configmap cluster-monitoring-config -n openshift-monitoring &> /dev/null; then
        log_info "Cluster monitoring config already exists, updating..."
        oc patch configmap cluster-monitoring-config -n openshift-monitoring --type merge -p '{"data":{"config.yaml":"enableUserWorkload: true\n"}}'
    else
        log_info "Creating cluster monitoring config..."
        cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
EOF
    fi
    
    log_success "User workload monitoring enabled"
}

# Create ServiceMonitor for microservices
create_service_monitor() {
    log_info "Creating ServiceMonitor for Python microservices..."
    
    cat <<EOF | oc apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ${APP_NAME}-monitor
  namespace: ${NAMESPACE}
  labels:
    app: ${APP_NAME}
    component: monitoring
spec:
  selector:
    matchLabels:
      app: ${APP_NAME}
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
  namespaceSelector:
    matchNames:
    - ${NAMESPACE}
EOF
    
    log_success "ServiceMonitor created"
}

# Create PrometheusRule for alerts
create_prometheus_rules() {
    log_info "Creating PrometheusRule for alerts..."
    
    cat <<EOF | oc apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ${APP_NAME}-alerts
  namespace: ${NAMESPACE}
  labels:
    app: ${APP_NAME}
    component: monitoring
spec:
  groups:
  - name: nanopore-microservices
    rules:
    - alert: ServiceDown
      expr: up{job=~"nanopore-.*"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Nanopore microservice is down"
        description: "Service {{ \$labels.job }} has been down for more than 1 minute"
    
    - alert: HighErrorRate
      expr: rate(http_requests_total{job=~"nanopore-.*",status=~"5.."}[5m]) > 0.1
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Service {{ \$labels.job }} has error rate > 10% for 2 minutes"
    
    - alert: HighResponseTime
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=~"nanopore-.*"}[5m])) > 0.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High response time detected"
        description: "Service {{ \$labels.job }} 95th percentile response time > 500ms for 5 minutes"
    
    - alert: HighMemoryUsage
      expr: container_memory_usage_bytes{pod=~"nanopore-.*"} / container_spec_memory_limit_bytes{pod=~"nanopore-.*"} > 0.8
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High memory usage detected"
        description: "Pod {{ \$labels.pod }} memory usage > 80% for 5 minutes"
    
    - alert: PodRestartLoop
      expr: increase(kube_pod_container_status_restarts_total{pod=~"nanopore-.*"}[15m]) > 3
      for: 0m
      labels:
        severity: critical
      annotations:
        summary: "Pod restart loop detected"
        description: "Pod {{ \$labels.pod }} has restarted more than 3 times in 15 minutes"
EOF
    
    log_success "PrometheusRule created"
}

# Create Grafana dashboard ConfigMap
create_grafana_dashboard() {
    log_info "Creating Grafana dashboard ConfigMap..."
    
    oc apply -f deployment/openshift/monitoring-dashboard.yaml
    
    log_success "Grafana dashboard ConfigMap created"
}

# Create monitoring service account with appropriate permissions
create_monitoring_rbac() {
    log_info "Creating monitoring RBAC..."
    
    cat <<EOF | oc apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${APP_NAME}-monitoring
  namespace: ${NAMESPACE}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ${APP_NAME}-monitoring
rules:
- apiGroups: [""]
  resources: ["pods", "services", "endpoints"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["monitoring.coreos.com"]
  resources: ["servicemonitors", "prometheusrules"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ${APP_NAME}-monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ${APP_NAME}-monitoring
subjects:
- kind: ServiceAccount
  name: ${APP_NAME}-monitoring
  namespace: ${NAMESPACE}
EOF
    
    log_success "Monitoring RBAC created"
}

# Verify monitoring setup
verify_monitoring() {
    log_info "Verifying monitoring setup..."
    
    # Check ServiceMonitor
    if oc get servicemonitor ${APP_NAME}-monitor -n ${NAMESPACE} &> /dev/null; then
        log_success "ServiceMonitor is created"
    else
        log_warning "ServiceMonitor not found"
    fi
    
    # Check PrometheusRule
    if oc get prometheusrule ${APP_NAME}-alerts -n ${NAMESPACE} &> /dev/null; then
        log_success "PrometheusRule is created"
    else
        log_warning "PrometheusRule not found"
    fi
    
    # Check if Prometheus is scraping targets
    log_info "Checking if Prometheus is scraping targets..."
    sleep 30  # Wait for Prometheus to discover targets
    
    # Get Prometheus route (if available)
    if oc get route prometheus-k8s -n openshift-monitoring &> /dev/null; then
        PROMETHEUS_URL=$(oc get route prometheus-k8s -n openshift-monitoring -o jsonpath='{.spec.host}')
        log_info "Prometheus is available at: https://${PROMETHEUS_URL}"
    fi
    
    # Get Grafana route (if available)
    if oc get route grafana -n openshift-monitoring &> /dev/null; then
        GRAFANA_URL=$(oc get route grafana -n openshift-monitoring -o jsonpath='{.spec.host}')
        log_info "Grafana is available at: https://${GRAFANA_URL}"
    fi
}

# Display monitoring URLs and access instructions
display_access_info() {
    log_info "Monitoring Setup Complete!"
    echo
    echo "=== ACCESS INFORMATION ==="
    echo
    
    # OpenShift Console
    CONSOLE_URL=$(oc whoami --show-console)
    echo "🖥️  OpenShift Console: ${CONSOLE_URL}"
    echo "   Navigate to: Administrator → Monitoring → Dashboards"
    echo
    
    # Prometheus
    if oc get route prometheus-k8s -n openshift-monitoring &> /dev/null; then
        PROMETHEUS_URL=$(oc get route prometheus-k8s -n openshift-monitoring -o jsonpath='{.spec.host}')
        echo "📊 Prometheus: https://${PROMETHEUS_URL}"
        echo "   Query targets: {job=~\"nanopore-.*\"}"
    fi
    echo
    
    # Grafana
    if oc get route grafana -n openshift-monitoring &> /dev/null; then
        GRAFANA_URL=$(oc get route grafana -n openshift-monitoring -o jsonpath='{.spec.host}')
        echo "📈 Grafana: https://${GRAFANA_URL}"
        echo "   Import dashboard from ConfigMap: nanopore-monitoring-dashboard"
    fi
    echo
    
    echo "=== MONITORING QUERIES ==="
    echo "📊 Service Health: up{job=~\"nanopore-.*\"}"
    echo "⚡ Request Rate: rate(http_requests_total{job=~\"nanopore-.*\"}[5m])"
    echo "⏱️  Response Time: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=~\"nanopore-.*\"}[5m]))"
    echo "💾 Memory Usage: container_memory_usage_bytes{pod=~\"nanopore-.*\"}"
    echo "🔄 CPU Usage: rate(container_cpu_usage_seconds_total{pod=~\"nanopore-.*\"}[5m])"
    echo
    
    echo "=== NEXT STEPS ==="
    echo "1. Access OpenShift Console and navigate to Monitoring section"
    echo "2. Import the Grafana dashboard from the ConfigMap"
    echo "3. Set up alerting channels (email, Slack, etc.)"
    echo "4. Configure alert routing rules"
    echo "5. Test alerts by stopping a service temporarily"
}

# Main execution
main() {
    log_info "Starting monitoring setup for Python microservices..."
    
    check_oc_cli
    check_namespace
    enable_user_workload_monitoring
    create_monitoring_rbac
    create_service_monitor
    create_prometheus_rules
    create_grafana_dashboard
    verify_monitoring
    display_access_info
    
    log_success "Monitoring setup completed successfully!"
}

# Run main function
main "$@" 