#!/bin/bash

# Production Deployment Script for AilevelUp Phone Call MCP Service
# This script deploys all components to the production environment with additional safeguards

set -e  # Exit on error

ENVIRONMENT="production"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "===================================================================="
echo "⚠️  PRODUCTION DEPLOYMENT ⚠️"
echo "Deploying AilevelUp Phone Call MCP service to PRODUCTION environment"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"
echo "===================================================================="

# Function to check if AWS CLI is available
check_aws_cli() {
  if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed or not in PATH"
    exit 1
  fi
  
  # Test AWS CLI access
  echo "Testing AWS CLI access..."
  aws sts get-caller-identity > /dev/null || {
    echo "Error: AWS CLI is not configured or lacks permissions"
    exit 1
  }
  echo "AWS CLI is properly configured."
}

# Confirmation prompt for production deployment
read -p "⚠️ Are you sure you want to deploy to PRODUCTION? This will affect live services! (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Deployment canceled."
  exit 0
fi

# Check for staging deployment success
echo "Verifying staging deployment was successful..."
if [ ! -f "api-details-staging.json" ]; then
  echo "Error: No evidence of successful staging deployment found."
  echo "Please deploy to staging environment first and verify it works properly."
  exit 1
fi

# Check that .env.production exists
if [ ! -f ".env.production" ]; then
  echo "Error: .env.production file not found"
  exit 1
fi

# Check for required tools
check_aws_cli

echo "Checking for jq..."
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed. Please install jq for JSON processing."
  exit 1
fi

# Step 1: Create DynamoDB tables if they don't exist
echo "Creating DynamoDB tables..."

# Audit Log Table
echo "Creating AuditLog Table..."
aws dynamodb create-table \
  --table-name "${STACK_NAME}-audit-logs" \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
    AttributeName=resourceType,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=timestamp-index,KeySchema=[{AttributeName=timestamp,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
    "IndexName=resourceType-timestamp-index,KeySchema=[{AttributeName=resourceType,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
  --provisioned-throughput \
    ReadCapacityUnits=10,WriteCapacityUnits=10 \
  --region ${REGION} || echo "Table ${STACK_NAME}-audit-logs already exists or couldn't be created."

# Rate Limit Table
echo "Creating RateLimit Table..."
aws dynamodb create-table \
  --table-name "${STACK_NAME}-rate-limits" \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=10,WriteCapacityUnits=10 \
  --region ${REGION} || echo "Table ${STACK_NAME}-rate-limits already exists or couldn't be created."

# Step 2: Deploy Lambda functions
echo "Deploying Lambda functions..."
LAMBDA_FUNCTIONS=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  FUNCTION_FILE="functions/${FUNCTION}.js"
  
  if [ ! -f "${FUNCTION_FILE}" ]; then
    echo "Warning: Function file ${FUNCTION_FILE} not found. Skipping."
    continue
  fi
  
  echo "Deploying Lambda function: ${FUNCTION_NAME}"
  
  # Create zip file for the function
  echo "Creating zip package..."
  PACKAGE_DIR="deployment-package-${FUNCTION}"
  mkdir -p "${PACKAGE_DIR}"
  
  # Copy function file
  cp "${FUNCTION_FILE}" "${PACKAGE_DIR}/"
  
  # Copy shared files (handler, utils, etc.)
  if [ -f "functions/index.js" ]; then
    cp "functions/index.js" "${PACKAGE_DIR}/"
  fi
  
  if [ -d "utils" ]; then
    mkdir -p "${PACKAGE_DIR}/utils"
    cp -r utils/* "${PACKAGE_DIR}/utils/"
  fi
  
  # Copy node_modules if they exist
  if [ -d "node_modules" ]; then
    cp -r node_modules "${PACKAGE_DIR}/"
  fi
  
  # Load environment variables into the package
  grep -v '^#' .env.production > "${PACKAGE_DIR}/.env"
  
  # Create zip file
  (cd "${PACKAGE_DIR}" && zip -r "../${PACKAGE_DIR}.zip" .)
  
  # Check if function exists
  FUNCTION_EXISTS=$(aws lambda list-functions --region ${REGION} --query "Functions[?FunctionName=='${FUNCTION_NAME}'].FunctionName" --output text)
  
  if [ -z "${FUNCTION_EXISTS}" ]; then
    # Create function
    echo "Creating new Lambda function: ${FUNCTION_NAME}"
    aws lambda create-function \
      --function-name "${FUNCTION_NAME}" \
      --runtime nodejs18.x \
      --handler "index.handler" \
      --role "arn:aws:iam::$(aws sts get-caller-identity --query 'Account' --output text):role/lambda-basic-execution" \
      --zip-file "fileb://${PACKAGE_DIR}.zip" \
      --timeout 30 \
      --memory-size 256 \
      --region ${REGION}
  else
    # Update function
    echo "Updating existing Lambda function: ${FUNCTION_NAME}"
    aws lambda update-function-code \
      --function-name "${FUNCTION_NAME}" \
      --zip-file "fileb://${PACKAGE_DIR}.zip" \
      --region ${REGION}
      
    # Update configuration
    aws lambda update-function-configuration \
      --function-name "${FUNCTION_NAME}" \
      --handler "index.handler" \
      --timeout 30 \
      --memory-size 256 \
      --region ${REGION}
  fi
  
  # Set up function versioning for production
  echo "Creating version for function ${FUNCTION_NAME}..."
  aws lambda publish-version \
    --function-name "${FUNCTION_NAME}" \
    --description "Production deployment $(date +%Y-%m-%d)" \
    --region ${REGION}
  
  # Clean up
  rm -rf "${PACKAGE_DIR}" "${PACKAGE_DIR}.zip"
  
  echo "Lambda function ${FUNCTION_NAME} deployed successfully."
done

# Step 3: Create API Gateway
echo "Creating API Gateway..."
chmod +x create-api-gateway-shell.sh
./create-api-gateway-shell.sh ${ENVIRONMENT} ${REGION}

# Step 4: Set up CloudWatch Dashboard
echo "Setting up CloudWatch Dashboard..."
DASHBOARD_NAME="${STACK_NAME}-dashboard"

# Create dashboard JSON
cat > "dashboard.json" << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-make-call" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-list-calls" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-call-details" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-update-call-status" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-voice-options" ],
          [ "AWS/Lambda", "Invocations", "FunctionName", "${STACK_NAME}-get-model-options" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "Lambda Invocations",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-make-call" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-list-calls" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-call-details" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-update-call-status" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-voice-options" ],
          [ "AWS/Lambda", "Errors", "FunctionName", "${STACK_NAME}-get-model-options" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "Lambda Errors",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-make-call" ],
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-list-calls" ],
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-get-call-details" ],
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-update-call-status" ],
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-get-voice-options" ],
          [ "AWS/Lambda", "Duration", "FunctionName", "${STACK_NAME}-get-model-options" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "Lambda Duration",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS/ApiGateway", "Count", "ApiName", "${SERVICE_PREFIX}-${ENVIRONMENT}-api" ],
          [ "AWS/ApiGateway", "4XXError", "ApiName", "${SERVICE_PREFIX}-${ENVIRONMENT}-api" ],
          [ "AWS/ApiGateway", "5XXError", "ApiName", "${SERVICE_PREFIX}-${ENVIRONMENT}-api" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${REGION}",
        "title": "API Gateway",
        "period": 300
      }
    },
    {
      "type": "metric",
      "x": 0, 
      "y": 12,
      "width": 24,
      "height": 6,
      "properties": {
        "metrics": [
          [ "AWS", "EstimatedCharges", "Currency", "USD" ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "us-east-1",
        "title": "Estimated AWS Charges",
        "period": 86400,
        "stat": "Maximum"
      }
    }
  ]
}
EOF

# Create or update dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "${DASHBOARD_NAME}" \
  --dashboard-body file://dashboard.json \
  --region ${REGION}
  
rm dashboard.json

# Step 5: Set up AWS Budget alerts
echo "Setting up AWS Budget alerts..."
BUDGET_NAME="${STACK_NAME}-budget"
BUDGET_AMOUNT=100
THRESHOLD_WARN=70
THRESHOLD_CRITICAL=90

# Create budget JSON
cat > "budget.json" << EOF
{
  "BudgetName": "${BUDGET_NAME}",
  "BudgetLimit": {
    "Amount": "${BUDGET_AMOUNT}",
    "Unit": "USD"
  },
  "BudgetType": "COST",
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
  "TimePeriod": {
    "Start": $(date +%s),
    "End": 2955625200
  },
  "TimeUnit": "MONTHLY"
}
EOF

cat > "notifications.json" << EOF
[
  {
    "Notification": {
      "ComparisonOperator": "GREATER_THAN",
      "NotificationType": "ACTUAL",
      "Threshold": ${THRESHOLD_WARN},
      "ThresholdType": "PERCENTAGE",
      "NotificationState": "ALARM"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "alerts@ailevelup.com"
      }
    ]
  },
  {
    "Notification": {
      "ComparisonOperator": "GREATER_THAN",
      "NotificationType": "ACTUAL",
      "Threshold": ${THRESHOLD_CRITICAL},
      "ThresholdType": "PERCENTAGE",
      "NotificationState": "ALARM"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "alerts@ailevelup.com"
      },
      {
        "SubscriptionType": "EMAIL",
        "Address": "oncall@ailevelup.com"
      }
    ]
  }
]
EOF

# Create or update budget
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query 'Account' --output text) \
  --budget file://budget.json \
  --region ${REGION} || echo "Budget ${BUDGET_NAME} already exists. Updating..."

aws budgets create-notification \
  --account-id $(aws sts get-caller-identity --query 'Account' --output text) \
  --budget-name "${BUDGET_NAME}" \
  --notifications file://notifications.json \
  --subscribers '[{"SubscriptionType": "EMAIL", "Address": "alerts@ailevelup.com"}]' \
  --region ${REGION} || echo "Budget notification already exists."

rm budget.json notifications.json

# Step 6: Set up CloudWatch Alarms
echo "Setting up CloudWatch Alarms..."

# Lambda error rate alarm
for FUNCTION in "${LAMBDA_FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNCTION}"
  ALARM_NAME="${FUNCTION_NAME}-error-alarm"
  
  aws cloudwatch put-metric-alarm \
    --alarm-name "${ALARM_NAME}" \
    --alarm-description "Alarm when ${FUNCTION_NAME} has errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --dimensions Name=FunctionName,Value=${FUNCTION_NAME} \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --alarm-actions "arn:aws:sns:${REGION}:$(aws sts get-caller-identity --query 'Account' --output text):${STACK_NAME}-alarms" \
    --region ${REGION} || echo "Could not create alarm ${ALARM_NAME}"
done

# API Gateway 5XX error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "${STACK_NAME}-api-5xx-alarm" \
  --alarm-description "Alarm when API Gateway returns 5XX errors" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --dimensions Name=ApiName,Value=${SERVICE_PREFIX}-${ENVIRONMENT}-api \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions "arn:aws:sns:${REGION}:$(aws sts get-caller-identity --query 'Account' --output text):${STACK_NAME}-alarms" \
  --region ${REGION} || echo "Could not create API Gateway 5XX alarm"

# Step 7: Log deployment to audit table
echo "Logging deployment to audit table..."
TIMESTAMP=$(date +%s)
DEPLOYMENT_ID=$(uuidgen | tr -d '-')

aws dynamodb put-item \
  --table-name "${STACK_NAME}-audit-logs" \
  --item '{
      "id": {"S": "'"${DEPLOYMENT_ID}"'"},
      "timestamp": {"N": "'"${TIMESTAMP}"'"},
      "resourceType": {"S": "DEPLOYMENT"},
      "action": {"S": "DEPLOY"},
      "environment": {"S": "'"${ENVIRONMENT}"'"},
      "user": {"S": "'"$(whoami)"'"},
      "details": {"S": "Deployed all components to production environment"}
    }' \
  --region ${REGION}

echo "===================================================================="
echo "⚠️  PRODUCTION DEPLOYMENT COMPLETED ⚠️"
echo "Deployment to ${ENVIRONMENT} completed successfully!"
echo "API Gateway URL: $(cat api-details-${ENVIRONMENT}.json | jq -r .url)"
echo "CloudWatch Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
echo "===================================================================="

# Update migration plan
echo "Updating migration plan..."
if [ -f "migration-plan.md" ]; then
  CURRENT_DATE=$(date +"%Y-%m-%d")
  sed -i.bak "s/⏳ Deployment to production environment - In Progress/✅ Deployment to production environment - Completed on ${CURRENT_DATE}/g" migration-plan.md
  rm migration-plan.md.bak
fi

echo "===================================================================="
echo "Post-Deployment Verification Steps:"
echo "1. Verify Lambda functions by invoking them directly"
echo "2. Run API tests against the production API"
echo "3. Check CloudWatch logs for errors"
echo "4. Verify CloudWatch Dashboard is showing metrics"
echo "5. Verify CloudWatch Alarms are set up correctly"
echo "6. Verify Budget Alerts are set up correctly"
echo "====================================================================" 