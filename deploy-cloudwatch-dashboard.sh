#!/bin/bash
set -e

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
fi

# Set AWS CLI path
AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"

echo "==== Deploying CloudWatch Dashboard for $ENVIRONMENT environment in $REGION region ===="

# Load the dashboard template and replace placeholders
echo "Loading dashboard template..."
DASHBOARD_JSON=$(cat cloudwatch-dashboard.json)

# Replace environment in the dashboard json with sed
UPDATED_JSON=$(echo "$DASHBOARD_JSON" | sed "s/ailevelup-phone-call-mcp-dev/ailevelup-phone-call-mcp-$ENVIRONMENT/g")

# Convert to single line and escape quotes for AWS CLI
DASHBOARD_BODY=$(echo "$UPDATED_JSON" | tr -d '\n' | sed 's/"/\\"/g')

# Create or update the dashboard
DASHBOARD_NAME="AilevelupPhoneCallMCP-$ENVIRONMENT"

echo "Deploying dashboard: $DASHBOARD_NAME"
$AWS_CLI cloudwatch put-dashboard --dashboard-name "$DASHBOARD_NAME" --dashboard-body "\"$DASHBOARD_BODY\"" --region "$REGION"

echo "✅ CloudWatch Dashboard deployed successfully"
echo "Dashboard URL: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=$DASHBOARD_NAME" 