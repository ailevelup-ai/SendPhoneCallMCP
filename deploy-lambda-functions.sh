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

echo "Deploying Lambda functions to $ENVIRONMENT environment in $REGION region..."

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

# Load the Lambda Layer ARN
if [ -f layer-arn.env ]; then
  source layer-arn.env
  echo "Using Lambda Layer: $LAYER_ARN"
else
  echo "Error: layer-arn.env file not found! Run create-lambda-layer.sh first."
  exit 1
fi

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"

# Package Lambda functions (without node_modules)
echo "Packaging Lambda functions..."
rm -rf dist
mkdir -p dist

# Create deployment package with just the function code
zip -r dist/functions.zip functions

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
      --layers $LAYER_ARN \
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
      --layers $LAYER_ARN \
      --timeout 30 \
      --memory-size 256 \
      --environment "$ENV_VARS" \
      --region $REGION
  fi
done

echo "Lambda functions created successfully!" 