#!/bin/bash
set -e

# Use the Homebrew-installed AWS CLI
AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
fi

echo "Deploying to $ENVIRONMENT environment in $REGION region..."

# Create a more compatible approach to load .env file
if [ -f .env ]; then
  echo "Loading environment variables from .env file..."
  
  # Use Node.js to parse the .env file and export the variables
  node -e '
    const fs = require("fs");
    const envContent = fs.readFileSync(".env", "utf8");
    const lines = envContent.split("\n");
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith("#") || line.trim() === "") continue;
      
      // Split by first equals sign
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;
      
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();
      
      // Write to stdout for processing by shell
      console.log(`${key}=${JSON.stringify(value)}`);
    }
  ' > .env.tmp || { echo "Error parsing .env file"; exit 1; }
  
  # Load the variables from the temp file
  # shellcheck disable=SC1090
  while IFS= read -r line; do
    key=$(echo "$line" | cut -d= -f1)
    value=$(echo "$line" | cut -d= -f2-)
    # Remove quotes if they exist at beginning and end
    value=$(echo "$value" | sed -E 's/^"(.*)"$/\1/')
    # Use eval to handle the JSON escaping
    eval "export $key=\"$value\""
  done < .env.tmp
  
  rm .env.tmp
  
  echo "Environment variables loaded successfully!"
else
  echo "Error: .env file not found!"
  exit 1
fi

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"

# Package dependencies
echo "Packaging Lambda functions..."
rm -rf dist
mkdir -p dist

# Create deployment package with node_modules
zip -r dist/functions.zip node_modules functions
echo "Lambda functions packaged."

# Create or update Lambda functions
echo "Creating Lambda functions..."

# Define the functions to be created
FUNCTIONS=(
  "make-call"
  "get-call-details"
  "list-calls"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

# Create IAM role for Lambda
ROLE_NAME="${STACK_NAME}-lambda-role"
ROLE_ARN=$($AWS_CLI iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "Creating IAM role: $ROLE_NAME"
  
  TRUST_POLICY='{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }]
  }'
  
  ROLE_ARN=$($AWS_CLI iam create-role --role-name $ROLE_NAME \
    --assume-role-policy-document "$TRUST_POLICY" \
    --query 'Role.Arn' --output text)
  
  # Attach policies
  $AWS_CLI iam attach-role-policy --role-name $ROLE_NAME \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  
  $AWS_CLI iam attach-role-policy --role-name $ROLE_NAME \
    --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
  
  # Let IAM role propagate
  echo "Waiting for IAM role to propagate..."
  sleep 10
fi

# Create DynamoDB table for rate limiting
DYNAMO_TABLE_NAME="${STACK_NAME}-rate-limits"
DYNAMO_TABLE_EXISTS=$($AWS_CLI dynamodb describe-table --table-name $DYNAMO_TABLE_NAME 2>/dev/null || echo "")

if [ -z "$DYNAMO_TABLE_EXISTS" ]; then
  echo "Creating DynamoDB table: $DYNAMO_TABLE_NAME"
  $AWS_CLI dynamodb create-table \
    --table-name $DYNAMO_TABLE_NAME \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
  
  # Wait for DynamoDB table to be created
  echo "Waiting for DynamoDB table to be created..."
  $AWS_CLI dynamodb wait table-exists --table-name $DYNAMO_TABLE_NAME
fi

# Create Lambda functions
for FUNC in "${FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNC}"
  echo "Creating function: $FUNCTION_NAME"
  
  FUNCTION_EXISTS=$($AWS_CLI lambda get-function --function-name $FUNCTION_NAME 2>/dev/null || echo "")
  
  # Create environment variables for Lambda
  ENV_VARS="{
    \"Variables\": {
      \"AILEVELUP_ENTERPRISE_API_KEY\": \"$AILEVELUP_ENTERPRISE_API_KEY\",
      \"AILEVELUP_API_URL\": \"$AILEVELUP_API_URL\",
      \"SUPABASE_URL\": \"$SUPABASE_URL\",
      \"SUPABASE_SERVICE_KEY\": \"$SUPABASE_SERVICE_KEY\",
      \"DYNAMO_TABLE_NAME\": \"$DYNAMO_TABLE_NAME\",
      \"ENVIRONMENT\": \"$ENVIRONMENT\"
    }
  }"
  
  if [ -z "$FUNCTION_EXISTS" ]; then
    # Create new function
    $AWS_CLI lambda create-function \
      --function-name $FUNCTION_NAME \
      --runtime nodejs22.x \
      --handler "functions/${FUNC}.handler" \
      --role $ROLE_ARN \
      --zip-file fileb://dist/functions.zip \
      --timeout 30 \
      --memory-size 256 \
      --environment "$ENV_VARS" \
      --region $REGION
  else
    # Update existing function
    $AWS_CLI lambda update-function-code \
      --function-name $FUNCTION_NAME \
      --zip-file fileb://dist/functions.zip \
      --region $REGION
    
    $AWS_CLI lambda update-function-configuration \
      --function-name $FUNCTION_NAME \
      --runtime nodejs22.x \
      --timeout 30 \
      --memory-size 256 \
      --environment "$ENV_VARS" \
      --region $REGION
  fi
done

echo "Lambda functions created."

# Set up API Gateway
echo "Setting up API Gateway..."
API_NAME="${STACK_NAME}-api"

# Check if API already exists
API_ID=$($AWS_CLI apigateway get-rest-apis --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ]; then
  # Create new API
  API_ID=$($AWS_CLI apigateway create-rest-api --name "$API_NAME" --query 'id' --output text)
fi

echo "API Gateway created with ID: $API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create resources and methods
echo "Creating API Gateway resources and methods..."

# /call (POST) - Make a call
CALL_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/call'].id" --output text)
if [ -z "$CALL_RESOURCE_ID" ]; then
  CALL_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "call" --query 'id' --output text)
fi

# Create POST method for /call
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALL_RESOURCE_ID \
  --http-method POST --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALL_RESOURCE_ID \
  --http-method POST --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-make-call/invocations"

# /call/{callId} (GET) - Get call details
CALL_ID_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/call/{callId}'].id" --output text)
if [ -z "$CALL_ID_RESOURCE_ID" ]; then
  CALL_ID_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $CALL_RESOURCE_ID --path-part "{callId}" --query 'id' --output text)
fi

# Create GET method for /call/{callId}
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALL_ID_RESOURCE_ID \
  --http-method GET --authorization-type NONE \
  --request-parameters "method.request.path.callId=true"

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALL_ID_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-get-call-details/invocations"

# /calls (GET) - List calls
CALLS_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/calls'].id" --output text)
if [ -z "$CALLS_RESOURCE_ID" ]; then
  CALLS_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "calls" --query 'id' --output text)
fi

# Create GET method for /calls
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALLS_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALLS_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-list-calls/invocations"

# /voice-options (GET) - Get voice options
VOICE_OPTIONS_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/voice-options'].id" --output text)
if [ -z "$VOICE_OPTIONS_RESOURCE_ID" ]; then
  VOICE_OPTIONS_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "voice-options" --query 'id' --output text)
fi

# Create GET method for /voice-options
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $VOICE_OPTIONS_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $VOICE_OPTIONS_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-get-voice-options/invocations"

# /model-options (GET) - Get model options
MODEL_OPTIONS_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/model-options'].id" --output text)
if [ -z "$MODEL_OPTIONS_RESOURCE_ID" ]; then
  MODEL_OPTIONS_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "model-options" --query 'id' --output text)
fi

# Create GET method for /model-options
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $MODEL_OPTIONS_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $MODEL_OPTIONS_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-get-model-options/invocations"

# Give API Gateway permission to invoke Lambda functions
for FUNC in "${FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNC}"
  $AWS_CLI lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-invoke-$ENVIRONMENT \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):$API_ID/*/*" \
    --region $REGION || true  # Ignore errors if permission already exists
done

# Deploy API
DEPLOYMENT_ID=$($AWS_CLI apigateway create-deployment --rest-api-id $API_ID --stage-name $ENVIRONMENT --query 'id' --output text)
echo "API Gateway deployment created."

# Set up EventBridge rule for call status updates
echo "Setting up EventBridge rule for call status updates..."
RULE_NAME="${STACK_NAME}-status-update-rule"

# Create rule (runs every 5 minutes)
$AWS_CLI events put-rule \
  --name $RULE_NAME \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED

# Add Lambda function as target
$AWS_CLI events put-targets \
  --rule $RULE_NAME \
  --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):function:${STACK_NAME}-update-call-status"

# Give EventBridge permission to invoke Lambda
$AWS_CLI lambda add-permission \
  --function-name "${STACK_NAME}-update-call-status" \
  --statement-id events-invoke-$ENVIRONMENT \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:$REGION:$($AWS_CLI sts get-caller-identity --query 'Account' --output text):rule/$RULE_NAME" \
  --region $REGION || true  # Ignore errors if permission already exists

echo "EventBridge rule created."

# Output the API Gateway URL
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT"

echo "======================================================"
echo "Deployment completed!"
echo "API Gateway URL: $API_URL"
echo "======================================================"
echo "Available endpoints:"
echo "$API_URL/call (POST) - Make a phone call"
echo "$API_URL/call/{callId} (GET) - Get call details"
echo "$API_URL/calls (GET) - List calls"
echo "$API_URL/voice-options (GET) - Get voice options"
echo "$API_URL/model-options (GET) - Get model options"
echo "======================================================"
echo "Lambda functions:"
for FUNC in "${FUNCTIONS[@]}"; do
  echo "${STACK_NAME}-${FUNC}"
done
echo "======================================================"

# Clean up
echo "Cleaning up temporary files..."
rm -rf dist

echo "Deployment script completed successfully!" 