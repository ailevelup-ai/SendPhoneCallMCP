#!/bin/bash
set -e

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  echo "Example: $0 staging us-east-1"
  echo "Example: $0 production us-east-1"
  exit 1
fi

echo "=========================================================="
echo "Starting comprehensive deployment to $ENVIRONMENT environment in $REGION region"
echo "Time: $(date)"
echo "=========================================================="

# Make all scripts executable
chmod +x deploy.sh
chmod +x deploy-lambda-functions-verbose.sh
chmod +x deploy-cloudwatch-dashboard.sh
chmod +x deploy-cost-monitoring.sh
chmod +x setup-audit-logs.sh
chmod +x create-lambda-layer.sh
chmod +x setup-api-gateway.sh
chmod +x setup-eventbridge.sh

# Step 1: Run the main deployment script
echo "=========================================================="
echo "Step 1: Running main deployment script"
echo "=========================================================="
./deploy.sh "$ENVIRONMENT" "$REGION"

# Wait a bit for resources to stabilize
echo "Waiting for resources to stabilize (30 seconds)..."
sleep 30

# Step 2: Deploy CloudWatch dashboard
echo "=========================================================="
echo "Step 2: Deploying CloudWatch dashboard"
echo "=========================================================="
./deploy-cloudwatch-dashboard.sh "$ENVIRONMENT" "$REGION"

# Step 3: Set up cost monitoring 
echo "=========================================================="
echo "Step 3: Setting up cost monitoring"
echo "=========================================================="
./deploy-cost-monitoring.sh "$ENVIRONMENT" "$REGION"

# Step 4: Set up audit logging
echo "=========================================================="
echo "Step 4: Setting up audit logging"
echo "=========================================================="
./setup-audit-logs.sh "$ENVIRONMENT" "$REGION"

# Step 5: Run comprehensive tests
echo "=========================================================="
echo "Step 5: Running comprehensive API tests"
echo "=========================================================="
node test-api-endpoints-comprehensive.js "$ENVIRONMENT"

echo "=========================================================="
echo "Deployment to $ENVIRONMENT environment completed"
echo "Time: $(date)"
echo "=========================================================="

# Print the API URL
API_URL=$(grep "API_URL" .env.$ENVIRONMENT 2>/dev/null || grep "API_URL" .env 2>/dev/null || echo "API_URL not found")
echo "API URL: $API_URL"

echo "Next steps:"
echo "1. Check the CloudWatch dashboard for monitoring: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards"
echo "2. Review cost monitoring setup: https://console.aws.amazon.com/billing/home?region=$REGION#/budgets"
echo "3. Verify audit logging is working correctly"
echo "4. Review test results and fix any issues"
echo "5. Update the implementation-progress.md file to reflect the current status" 