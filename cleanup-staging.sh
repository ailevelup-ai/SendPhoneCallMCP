#!/bin/bash

# Cleanup script for Staging environment
set -e  # Exit on error

ENVIRONMENT="staging"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "===================================================================="
echo "Cleaning up AilevelUp Phone Call MCP service in ${ENVIRONMENT} environment"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"
echo "===================================================================="

# Delete DynamoDB tables
echo "Deleting DynamoDB tables..."

echo "Deleting Audit Logs table..."
aws dynamodb delete-table \
  --table-name "${STACK_NAME}-audit-logs" \
  --region ${REGION} || echo "Table ${STACK_NAME}-audit-logs doesn't exist or couldn't be deleted."

echo "Deleting Rate Limits table..."
aws dynamodb delete-table \
  --table-name "${STACK_NAME}-rate-limits" \
  --region ${REGION} || echo "Table ${STACK_NAME}-rate-limits doesn't exist or couldn't be deleted."

# Delete Lambda functions
echo "Deleting Lambda functions..."
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
  echo "Deleting Lambda function: ${FUNCTION_NAME}"
  aws lambda delete-function \
    --function-name "${FUNCTION_NAME}" \
    --region ${REGION} || echo "Function ${FUNCTION_NAME} doesn't exist or couldn't be deleted."
done

# Delete CloudWatch Dashboard
echo "Deleting CloudWatch Dashboard..."
DASHBOARD_NAME="${STACK_NAME}-dashboard"
aws cloudwatch delete-dashboards \
  --dashboard-names "${DASHBOARD_NAME}" \
  --region ${REGION} || echo "Dashboard ${DASHBOARD_NAME} doesn't exist or couldn't be deleted."

# Delete API Gateway
echo "Deleting API Gateway..."
API_ID=$(aws apigateway get-rest-apis --region ${REGION} --query "items[?name=='${STACK_NAME}'].id" --output text)
if [ ! -z "${API_ID}" ]; then
  echo "Deleting API Gateway with ID: ${API_ID}"
  aws apigateway delete-rest-api \
    --rest-api-id "${API_ID}" \
    --region ${REGION}
else
  echo "No API Gateway found for ${STACK_NAME}"
fi

echo "Cleanup completed." 