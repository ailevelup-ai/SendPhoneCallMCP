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

echo "==== Deploying Cost Monitoring Dashboard for $ENVIRONMENT environment in $REGION region ===="

# Load the dashboard template and replace placeholders
echo "Loading cost dashboard template..."
DASHBOARD_JSON=$(cat cost-monitoring-dashboard.json)

# Replace environment variable placeholder in the dashboard json with sed
UPDATED_JSON=$(echo "$DASHBOARD_JSON" | sed "s/\${env}/$ENVIRONMENT/g")

# Convert to single line and escape quotes for AWS CLI
DASHBOARD_BODY=$(echo "$UPDATED_JSON" | tr -d '\n' | sed 's/"/\\"/g')

# Create or update the dashboard
DASHBOARD_NAME="AilevelupPhoneCallMCP-$ENVIRONMENT-Cost"

echo "Deploying cost dashboard: $DASHBOARD_NAME"
$AWS_CLI cloudwatch put-dashboard --dashboard-name "$DASHBOARD_NAME" --dashboard-body "\"$DASHBOARD_BODY\"" --region "$REGION"

echo "✅ Cost Monitoring Dashboard deployed successfully"
echo "Dashboard URL: https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=$DASHBOARD_NAME"

# Create a budget with alerts
echo "==== Setting up AWS Budget for $ENVIRONMENT environment ===="

ACCOUNT_ID=$($AWS_CLI sts get-caller-identity --query "Account" --output text)
MONTHLY_BUDGET=100  # Set the monthly budget limit in USD
ALERT_THRESHOLD=80  # Alert at 80% of budget

# Create a JSON file for the budget
cat > budget.json << EOF
{
  "BudgetName": "ailevelup-phone-call-mcp-$ENVIRONMENT-monthly",
  "BudgetLimit": {
    "Amount": "$MONTHLY_BUDGET",
    "Unit": "USD"
  },
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY",
  "CostFilters": {},
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false,
    "IncludeRefund": false,
    "IncludeCredit": false,
    "IncludeUpfront": true,
    "IncludeRecurring": true,
    "IncludeOtherSubscription": true,
    "IncludeSupport": true,
    "IncludeDiscount": true,
    "UseAmortized": false
  },
  "NotificationsWithSubscribers": [
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": $ALERT_THRESHOLD,
        "ThresholdType": "PERCENTAGE",
        "NotificationState": "ALARM"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "admin@ailevelup.com"
        }
      ]
    }
  ]
}
EOF

# Check if the budget already exists
EXISTING_BUDGET=$($AWS_CLI budgets describe-budget --account-id $ACCOUNT_ID --budget-name "ailevelup-phone-call-mcp-$ENVIRONMENT-monthly" 2>/dev/null || echo "")

if [ -z "$EXISTING_BUDGET" ]; then
  echo "Creating new budget: ailevelup-phone-call-mcp-$ENVIRONMENT-monthly"
  $AWS_CLI budgets create-budget --account-id $ACCOUNT_ID --cli-input-json file://budget.json
  echo "✅ Budget created successfully with $ALERT_THRESHOLD% threshold alert"
else
  echo "Updating existing budget: ailevelup-phone-call-mcp-$ENVIRONMENT-monthly"
  $AWS_CLI budgets update-budget --account-id $ACCOUNT_ID --cli-input-json file://budget.json
  echo "✅ Budget updated successfully with $ALERT_THRESHOLD% threshold alert"
fi

# Clean up
rm budget.json

echo "✅ Cost monitoring setup completed successfully"
echo "You can view your budgets at: https://console.aws.amazon.com/billing/home?region=$REGION#/budgets" 