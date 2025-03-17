#!/bin/bash

# Exit on error
set -e

ENVIRONMENT="staging"
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "Creating API Gateway for ${STACK_NAME}..."

# Create the API
API_ID=$(aws apigateway create-rest-api \
  --name "${STACK_NAME}-api" \
  --region ${REGION} \
  --query 'id' \
  --output text)

echo "API Gateway created with ID: ${API_ID}"

# Get the root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${API_ID} \
  --region ${REGION} \
  --query 'items[0].id' \
  --output text)

# Function to create API resource and method
create_endpoint() {
  local path=$1
  local function_name=$2
  local http_method=$3

  # Create resource
  echo "Creating resource for ${path}..."
  RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${API_ID} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "${path}" \
    --region ${REGION} \
    --query 'id' \
    --output text)

  # Create method
  echo "Creating ${http_method} method for ${path}..."
  aws apigateway put-method \
    --rest-api-id ${API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method ${http_method} \
    --authorization-type "NONE" \
    --region ${REGION}

  # Create integration
  echo "Creating Lambda integration for ${function_name}..."
  aws apigateway put-integration \
    --rest-api-id ${API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method ${http_method} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:$(aws sts get-caller-identity --query 'Account' --output text):function:${function_name}/invocations" \
    --region ${REGION}

  # Add Lambda permission
  echo "Adding Lambda permission for ${function_name}..."
  aws lambda add-permission \
    --function-name ${function_name} \
    --statement-id "apigateway-${path}-${http_method}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:$(aws sts get-caller-identity --query 'Account' --output text):${API_ID}/*/${http_method}/${path}" \
    --region ${REGION} || true
}

# Create endpoints for each function
create_endpoint "make-call" "${STACK_NAME}-make-call" "POST"
create_endpoint "calls" "${STACK_NAME}-list-calls" "GET"
create_endpoint "call" "${STACK_NAME}-get-call-details" "GET"
create_endpoint "call-status" "${STACK_NAME}-update-call-status" "PUT"
create_endpoint "voice-options" "${STACK_NAME}-get-voice-options" "GET"
create_endpoint "model-options" "${STACK_NAME}-get-model-options" "GET"

# Deploy the API
echo "Deploying API..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${API_ID} \
  --stage-name ${ENVIRONMENT} \
  --region ${REGION} \
  --query 'id' \
  --output text)

# Get the API URL
API_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${ENVIRONMENT}"
echo "API Gateway deployed successfully!"
echo "Base URL: ${API_URL}"

# Save the API URL to a file
echo "API_URL=${API_URL}" > api-url.env

echo "Testing endpoints:"
echo "1. Make a call: curl -X POST ${API_URL}/make-call -H 'Content-Type: application/json' -d '{\"phoneNumber\":\"+1234567890\",\"message\":\"Test message\"}'"
echo "2. List calls: curl ${API_URL}/calls"
echo "3. Get call details: curl ${API_URL}/call?callId=YOUR_CALL_ID"
echo "4. Update call status: curl -X PUT ${API_URL}/call-status -H 'Content-Type: application/json' -d '{\"callId\":\"YOUR_CALL_ID\",\"status\":\"completed\"}'"
echo "5. Get voice options: curl ${API_URL}/voice-options"
echo "6. Get model options: curl ${API_URL}/model-options" 