#!/bin/bash
set -e

# Use the Homebrew-installed AWS CLI
AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"

# Environment and region
ENVIRONMENT=$1
REGION=$2
FUNCTION_TO_DEPLOY=$3

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region> [specific-function]"
  echo "Example: $0 dev us-east-1"
  echo "Example to deploy specific function: $0 dev us-east-1 make-call"
  exit 1
fi

echo "==== Starting Lambda deployment to $ENVIRONMENT environment in $REGION region ===="
echo "Time: $(date)"

# Create a more compatible approach to load .env file
if [ -f .env ]; then
  echo "==== Loading environment variables from .env file ===="
  
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
    echo "  Loaded: $key"
  done < .env.tmp
  
  rm .env.tmp
  
  echo "✅ Environment variables loaded successfully!"
else
  echo "❌ Error: .env file not found!"
  exit 1
fi

# Load the Lambda Layer ARN
if [ -f layer-arn.env ]; then
  source layer-arn.env
  echo "==== Using Lambda Layer: $LAYER_ARN ===="
else
  echo "❌ Error: layer-arn.env file not found! Run create-lambda-layer.sh first."
  exit 1
fi

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"

# Package Lambda functions (without node_modules)
echo "==== Packaging Lambda functions ===="
rm -rf dist
mkdir -p dist

# Create deployment package with just the function code
echo "  Creating zip file with Lambda function code..."
zip -r dist/functions.zip functions
echo "✅ Lambda functions packaged."

# Create or update Lambda functions
echo "==== Setting up Lambda functions ===="

# Define the functions to be created
FUNCTIONS=(
  "make-call"
  "get-call-details"
  "list-calls"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

# If a specific function was specified, only deploy that one
if [ -n "$FUNCTION_TO_DEPLOY" ]; then
  echo "Note: Deploying only the $FUNCTION_TO_DEPLOY function"
  FUNCTIONS=("$FUNCTION_TO_DEPLOY")
fi

# Create IAM role for Lambda
ROLE_NAME="${STACK_NAME}-lambda-role"
echo "==== Checking IAM role: $ROLE_NAME ===="
ROLE_ARN=$($AWS_CLI iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "  Creating new IAM role: $ROLE_NAME"
  
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
  
  echo "  Attaching policies to role..."
  # Attach policies
  $AWS_CLI iam attach-role-policy --role-name $ROLE_NAME \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  
  $AWS_CLI iam attach-role-policy --role-name $ROLE_NAME \
    --policy-arn "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
  
  # Let IAM role propagate
  echo "  Waiting for IAM role to propagate (10 seconds)..."
  sleep 10
  echo "✅ IAM role created and configured."
else
  echo "  Using existing IAM role: $ROLE_ARN"
fi

# Create DynamoDB table for rate limiting
DYNAMO_TABLE_NAME="${STACK_NAME}-rate-limits"
echo "==== Checking DynamoDB table: $DYNAMO_TABLE_NAME ===="
DYNAMO_TABLE_EXISTS=$($AWS_CLI dynamodb describe-table --table-name $DYNAMO_TABLE_NAME 2>/dev/null || echo "")

if [ -z "$DYNAMO_TABLE_EXISTS" ]; then
  echo "  Creating new DynamoDB table: $DYNAMO_TABLE_NAME"
  $AWS_CLI dynamodb create-table \
    --table-name $DYNAMO_TABLE_NAME \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5
  
  # Wait for DynamoDB table to be created
  echo "  Waiting for DynamoDB table to be created..."
  $AWS_CLI dynamodb wait table-exists --table-name $DYNAMO_TABLE_NAME
  echo "✅ DynamoDB table created."
else
  echo "  Using existing DynamoDB table: $DYNAMO_TABLE_NAME"
fi

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

# Function to wait for Lambda function to become active
wait_for_lambda_function() {
  local function_name=$1
  local max_attempts=30
  local attempt=1
  local state=""
  
  echo "  Waiting for function $function_name to become active..."
  
  while [ $attempt -le $max_attempts ]; do
    state=$($AWS_CLI lambda get-function --function-name "$function_name" --query 'Configuration.State' --output text 2>/dev/null || echo "Failed")
    status=$($AWS_CLI lambda get-function --function-name "$function_name" --query 'Configuration.LastUpdateStatus' --output text 2>/dev/null || echo "Failed")
    
    echo "  Attempt $attempt: State = $state, Status = $status"
    
    if [ "$state" = "Active" ] && ([ "$status" = "Successful" ] || [ "$status" = "null" ]); then
      echo "  Function is now active and ready!"
      return 0
    fi
    
    if [ "$state" = "Failed" ] || [ "$status" = "Failed" ]; then
      echo "  Function update failed!"
      return 1
    fi
    
    echo "  Function not ready yet. Waiting 5 seconds..."
    sleep 5
    attempt=$((attempt + 1))
  done
  
  echo "  Timed out waiting for function to become active."
  return 1
}

# Create Lambda functions
for FUNC in "${FUNCTIONS[@]}"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNC}"
  echo "==== Processing function: $FUNCTION_NAME ===="
  
  FUNCTION_EXISTS=$($AWS_CLI lambda get-function --function-name $FUNCTION_NAME 2>/dev/null || echo "")
  
  if [ -z "$FUNCTION_EXISTS" ]; then
    echo "  Creating new function: $FUNCTION_NAME"
    # Create new function
    echo "  Running create-function command..."
    RESULT=$($AWS_CLI lambda create-function \
      --function-name $FUNCTION_NAME \
      --runtime nodejs22.x \
      --handler "functions/${FUNC}.handler" \
      --role $ROLE_ARN \
      --zip-file fileb://dist/functions.zip \
      --layers $LAYER_ARN \
      --timeout 30 \
      --memory-size 256 \
      --environment "$ENV_VARS" \
      --region $REGION)
    
    echo "  Function ARN: $(echo "$RESULT" | grep FunctionArn | cut -d'"' -f4)"
    wait_for_lambda_function "$FUNCTION_NAME"
    echo "✅ Function $FUNCTION_NAME created successfully!"
  else
    echo "  Updating existing function: $FUNCTION_NAME"
    
    echo "  Updating function code..."
    CODE_RESULT=$($AWS_CLI lambda update-function-code \
      --function-name $FUNCTION_NAME \
      --zip-file fileb://dist/functions.zip \
      --region $REGION)
    
    echo "  Code update status: $(echo "$CODE_RESULT" | grep LastUpdateStatus | cut -d'"' -f4)"
    
    # Wait for code update to complete before updating configuration
    wait_for_lambda_function "$FUNCTION_NAME"
    
    echo "  Updating function configuration..."
    CONFIG_RESULT=$($AWS_CLI lambda update-function-configuration \
      --function-name $FUNCTION_NAME \
      --runtime nodejs22.x \
      --layers $LAYER_ARN \
      --timeout 30 \
      --memory-size 256 \
      --environment "$ENV_VARS" \
      --region $REGION)
    
    echo "  Config update status: $(echo "$CONFIG_RESULT" | grep LastUpdateStatus | cut -d'"' -f4)"
    
    # Wait for configuration update to complete
    wait_for_lambda_function "$FUNCTION_NAME"
    
    echo "✅ Function $FUNCTION_NAME updated successfully!"
  fi
  
  echo "-------------------------------------------------"
done

echo "==== Lambda functions deployment completed! ===="
echo "Time: $(date)" 