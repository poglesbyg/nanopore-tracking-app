#!/bin/bash

# Comprehensive test runner for Nanopore Tracking Application
# This script runs all E2E tests and generates reports

set -e

echo "🧪 Starting comprehensive Playwright test suite for Nanopore Tracking App"
echo "=================================================================="

# Check if the application is running
echo "📋 Checking application availability..."
if ! curl -s http://localhost:3001 > /dev/null; then
    echo "❌ Application not running on localhost:3001"
    echo "Please start the application first:"
    echo "  docker compose -f deployment/docker/docker-compose.dev.yml up -d"
    exit 1
fi

echo "✅ Application is running"

# Create test results directory
mkdir -p test-results

# Run different test suites
echo ""
echo "🔄 Running Full PDF Submission Workflow Tests..."
npx playwright test tests/e2e/full-submission-flow.spec.ts --reporter=html

echo ""
echo "🔄 Running Hierarchical Dashboard Tests..."
npx playwright test tests/e2e/hierarchical-dashboard.spec.ts --reporter=html

echo ""
echo "🔄 Running Workflow Management Tests..."
npx playwright test tests/e2e/workflow-management.spec.ts --reporter=html

echo ""
echo "🔄 Running Sample Management Tests..."
npx playwright test tests/e2e/sample-management.spec.ts --reporter=html

echo ""
echo "🔄 Running Project and Submission Hierarchy Tests..."
npx playwright test tests/e2e/project-submission-hierarchy.spec.ts --reporter=html

echo ""
echo "🔄 Running All E2E Tests Together..."
npx playwright test tests/e2e/ --reporter=html --reporter=json:test-results/results.json

echo ""
echo "📊 Generating Test Coverage Report..."
if command -v nyc &> /dev/null; then
    nyc report --reporter=html --report-dir=test-results/coverage
    echo "✅ Coverage report generated at test-results/coverage/index.html"
else
    echo "⚠️  nyc not found, skipping coverage report"
fi

echo ""
echo "📈 Test Results Summary:"
echo "========================"

# Parse and display results
if [ -f "test-results/results.json" ]; then
    node -e "
    const results = JSON.parse(require('fs').readFileSync('test-results/results.json', 'utf8'));
    const stats = results.stats;
    console.log(\`✅ Passed: \${stats.expected}\`);
    console.log(\`❌ Failed: \${stats.unexpected}\`);
    console.log(\`⏭️  Skipped: \${stats.skipped}\`);
    console.log(\`⏱️  Duration: \${(stats.duration / 1000).toFixed(2)}s\`);
    
    if (stats.unexpected > 0) {
        console.log('\\n❌ Failed Tests:');
        results.suites.forEach(suite => {
            suite.specs.forEach(spec => {
                spec.tests.forEach(test => {
                    if (test.results.some(r => r.status === 'failed')) {
                        console.log(\`  - \${spec.title}: \${test.title}\`);
                    }
                });
            });
        });
        process.exit(1);
    }
    "
else
    echo "⚠️  No results file found"
fi

echo ""
echo "🎉 All tests completed successfully!"
echo "📄 Detailed HTML report available at: playwright-report/index.html"
echo "📊 Open the report with: npx playwright show-report"