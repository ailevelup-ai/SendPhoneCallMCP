#!/bin/bash

# API Gateway Creation Shell Script
# This script creates a new API Gateway REST API for the specified environment

# Check for arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <environment> [region]"
  echo "Example: $0 staging us-east-1"
  exit 1
fi

# Set variables
ENVIRONMENT=$1
REGION=${2:-"us-east-1"}
SERVICE_PREFIX="ailevelup-phone-call-mcp"
API_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}-api"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"

echo "Creating API Gateway: $API_NAME in region $REGION"
echo "=============================================================="

# Check if API Gateway already exists
echo "Checking if API Gateway already exists..."
API_ID=$(aws apigateway get-rest-apis --region $REGION --query "items[?name=='$API_NAME'].id" --output text)

if [ -n "$API_ID" ]; then
  echo "API Gateway with name $API_NAME already exists (ID: $API_ID)"
else
  echo "Creating new API Gateway..."
  API_RESULT=$(aws apigateway create-rest-api --name "$API_NAME" --description "API for $SERVICE_PREFIX $ENVIRONMENT" --region $REGION --endpoint-configuration "types=REGIONAL" --output json)
  API_ID=$(echo $API_RESULT | jq -r .id)
  echo "API Gateway created with ID: $API_ID"
fi

# Get root resource ID
echo "Getting root resource ID..."
RESOURCES=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
ROOT_ID=$(echo $RESOURCES | jq -r '.items[] | select(.path=="/") | .id')
echo "Root resource ID: $ROOT_ID"

# Define API paths and methods
declare -A API_PATHS=(
  ["calls-post"]="/calls:POST:make-call"
  ["calls-get"]="/calls:GET:list-calls"
  ["call-details"]="/calls/{callId}:GET:get-call-details"
  ["call-status"]="/calls/{callId}/status:PATCH:update-call-status"
  ["voices"]="/voices:GET:get-voice-options"
  ["models"]="/models:GET:get-model-options"
)

# Function to create or get resource
create_or_get_resource() {
  local path=$1
  local parent_id=$ROOT_ID
  
  # Split path into parts
  IFS='/' read -ra PARTS <<< "$path"
  
  # Get all resources
  local resources=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
  
  # Current path being built
  local current_path=""
  
  # Process each path part
  for part in "${PARTS[@]}"; do
    # Skip empty parts
    if [ -z "$part" ]; then
      continue
    fi
    
    # Update current path
    if [ -z "$current_path" ]; then
      current_path="/$part"
    else
      current_path="$current_path/$part"
    fi
    
    # Check if resource exists
    local resource_id=$(echo $resources | jq -r --arg path "$current_path" '.items[] | select(.path==$path) | .id')
    
    if [ -n "$resource_id" ]; then
      echo "Resource for path $current_path already exists (ID: $resource_id)"
    else
      echo "Creating resource: $part under parent $parent_id"
      local result=$(aws apigateway create-resource --rest-api-id $API_ID --parent-id $parent_id --path-part "$part" --region $REGION --output json)
      resource_id=$(echo $result | jq -r .id)
      echo "Resource created with ID: $resource_id"
      
      # Update resources
      resources=$(aws apigateway get-resources --rest-api-id $API_ID --region $REGION --output json)
    fi
    
    parent_id=$resource_id
  done
  
  echo $parent_id
}

# Process each API path
for key in "${!API_PATHS[@]}"; do
  # Split the value into path, method, and function
  IFS=':' read -ra PARTS <<< "${API_PATHS[$key]}"
  path="${PARTS[0]}"
  method="${PARTS[1]}"
  function="${PARTS[2]}"
  
  echo "Processing $path ($method) -> $function"
  
  # Create or get resource
  resource_id=$(create_or_get_resource "$path")
  
  # Create method
  echo "Creating method: $method on resource $resource_id"
  aws apigateway put-method --rest-api-id $API_ID --resource-id $resource_id --http-method $method --authorization-type "NONE" --region $REGION --output json
  
  # Set up Lambda integration
  function_name="$STACK_NAME-$function"
  echo "Setting up Lambda integration with function: $function_name"
  
  # Get the Lambda function ARN
  function_arn=$(aws lambda get-function --function-name $function_name --region $REGION --query "Configuration.FunctionArn" --output text)
  
  if [ -z "$function_arn" ]; then
    echo "Error: Could not find Lambda function: $function_name"
    echo "Make sure the Lambda function is deployed first"
    continue
  fi
  
  # Create integration
  aws apigateway put-integration --rest-api-id $API_ID --resource-id $resource_id --http-method $method --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$function_arn/invocations --region $REGION --output json
  
  # Add permission for API Gateway to invoke Lambda
  source_arn="arn:aws:execute-api:$REGION:*:$API_ID/*/$method/*"
  aws lambda add-permission --function-name $function_name --statement-id apigateway-$ENVIRONMENT-$method --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "$source_arn" --region $REGION --output json || true
  
  # Create method response
  aws apigateway put-method-response --rest-api-id $API_ID --resource-id $resource_id --http-method $method --status-code 200 --response-models '{"application/json": "Empty"}' --region $REGION --output json || true
  
  # Create integration response
  aws apigateway put-integration-response --rest-api-id $API_ID --resource-id $resource_id --http-method $method --status-code 200 --selection-pattern "" --region $REGION --output json || true
  
  echo "Completed $path ($method) -> $function"
  echo "--------------------------------------------------------------"
done

# Deploy the API
echo "Deploying API $API_ID to $ENVIRONMENT stage"
aws apigateway create-deployment --rest-api-id $API_ID --stage-name $ENVIRONMENT --description "Deployment to $ENVIRONMENT" --region $REGION --output json

# Save API details to a file
echo "Saving API details to api-details-$ENVIRONMENT.json"
cat > "api-details-$ENVIRONMENT.json" << EOF
{
  "apiId": "$API_ID",
  "environment": "$ENVIRONMENT",
  "region": "$REGION",
  "name": "$API_NAME",
  "url": "https://$API_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT"
}
EOF

echo "=============================================================="
echo "API Gateway creation completed for $API_NAME"
echo "API URL: https://$API_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT"
echo "==============================================================" 