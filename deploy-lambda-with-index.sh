#!/bin/bash

# AilevelUp Phone Call MCP - Lambda Deployment Script with Index.js
# This script deploys all Lambda functions with the new index.js approach

# Function to display script usage
function display_usage {
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
}

# Check if we have enough arguments
if [ $# -lt 2 ]; then
  display_usage
fi

# Set variables
ENV=$1
REGION=$2
STACK_NAME="ailevelup-phone-call-mcp-$ENV"
LAYER_NAME="$STACK_NAME-dependencies"
ROLE_NAME="$STACK_NAME-lambda-role"
SERVICE_NAME="ailevelup-phone-call-mcp"
TEMP_DIR="/tmp/$SERVICE_NAME-$ENV-lambda-$(date +%s)"
ZIP_FILE="$TEMP_DIR/lambda-package.zip"

echo "Deploying Lambda functions for $SERVICE_NAME ($ENV) in region $REGION"
echo "=========================================================="
echo "Start time: $(date)"

# Load environment variables
echo "Loading environment variables from .env.$ENV"
export $(grep -v '^#' .env.$ENV | xargs)

# Create temporary directory for packaging
mkdir -p $TEMP_DIR
echo "Created temporary directory: $TEMP_DIR"

# Get Lambda layer ARN if it exists
LAYER_ARN=$(aws lambda list-layer-versions --layer-name $LAYER_NAME --region $REGION --query 'LayerVersions[0].LayerVersionArn' --output text)
if [ "$LAYER_ARN" == "None" ]; then
  echo "Warning: Lambda layer $LAYER_NAME not found, proceeding without layer"
  LAYER_ARN=""
else
  echo "Using Lambda layer: $LAYER_ARN"
fi

# Check if IAM role exists, create if it doesn't
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text 2>/dev/null || echo "")
if [ -z "$ROLE_ARN" ]; then
  echo "Creating IAM role $ROLE_NAME..."
  
  # Create trust policy document
  cat > $TEMP_DIR/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  # Create the role
  ROLE_ARN=$(aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file://$TEMP_DIR/trust-policy.json --query 'Role.Arn' --output text)
  
  # Attach basic Lambda execution policy
  aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  # Attach DynamoDB policy
  aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  
  echo "Created IAM role: $ROLE_ARN"
else
  echo "Using existing IAM role: $ROLE_ARN"
fi

# Check if DynamoDB table exists, create if it doesn't
TABLE_NAME="$STACK_NAME-rate-limits"
TABLE_EXISTS=$(aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION --query 'Table.TableName' --output text 2>/dev/null || echo "")
if [ -z "$TABLE_EXISTS" ]; then
  echo "Creating DynamoDB table $TABLE_NAME..."
  
  # Create the table
  aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions AttributeName=id,AttributeType=S \
    --key-schema AttributeName=id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION
  
  echo "Created DynamoDB table: $TABLE_NAME"
else
  echo "Using existing DynamoDB table: $TABLE_NAME"
fi

# Create deployment package
echo "Creating deployment package..."

# Create the zip file
cd $(dirname $0)
mkdir -p $TEMP_DIR/package

# Copy all function files and the index.js file
cp index.js $TEMP_DIR/package/
cp -r functions/ $TEMP_DIR/package/
cp -r utils/ $TEMP_DIR/package/
cp -r config/ $TEMP_DIR/package/ 2>/dev/null || true

# Copy environment variables
cat > $TEMP_DIR/package/.env << EOF
ENV=$ENV
AILEVELUP_API_KEY=$AILEVELUP_API_KEY
STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY
GOOGLE_SHEETS_DOC_ID=$GOOGLE_SHEETS_DOC_ID
AWS_REGION=$REGION
DYNAMODB_TABLE_PREFIX=$STACK_NAME
SERVICE_NAME=$SERVICE_NAME
EOF

# Create the zip file
cd $TEMP_DIR/package
zip -r $ZIP_FILE * .env > /dev/null
cd - > /dev/null

echo "Deployment package created: $ZIP_FILE"

# Function to deploy a Lambda function
deploy_function() {
  local function_name="$STACK_NAME-$1"
  local handler="index.$2"
  local description="$3"
  local memory=${4:-128}
  local timeout=${5:-30}
  
  echo "Processing function: $function_name"
  
  # Check if function exists
  local function_exists=$(aws lambda get-function --function-name $function_name --region $REGION --query 'Configuration.FunctionName' --output text 2>/dev/null || echo "")
  
  if [ -z "$function_exists" ]; then
    # Create new function
    echo "Creating new Lambda function: $function_name"
    
    # Wait for IAM role to propagate (first deployment only)
    if [ "$function_name" == "$STACK_NAME-make-call" ]; then
      echo "Waiting for IAM role to propagate..."
      sleep 10
    fi
    
    local create_params=(
      --function-name $function_name
      --runtime nodejs18.x
      --role $ROLE_ARN
      --handler $handler
      --zip-file fileb://$ZIP_FILE
      --description "$description"
      --memory-size $memory
      --timeout $timeout
      --environment "Variables={ENV=$ENV,AILEVELUP_API_KEY=$AILEVELUP_API_KEY,STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY,GOOGLE_SHEETS_DOC_ID=$GOOGLE_SHEETS_DOC_ID,REGION=$REGION,DYNAMODB_TABLE_PREFIX=$STACK_NAME,SERVICE_NAME=$SERVICE_NAME}"
      --region $REGION
    )
    
    # Add layer if it exists
    if [ ! -z "$LAYER_ARN" ]; then
      create_params+=(--layers $LAYER_ARN)
    fi
    
    aws lambda create-function "${create_params[@]}"
    
    echo "Function $function_name created"
  else
    # Update existing function
    echo "Updating existing Lambda function: $function_name"
    
    # Update function code
    aws lambda update-function-code \
      --function-name $function_name \
      --zip-file fileb://$ZIP_FILE \
      --region $REGION \
      --no-cli-pager
    
    # Update configuration
    local update_params=(
      --function-name $function_name
      --handler $handler
      --description "$description"
      --memory-size $memory
      --timeout $timeout
      --environment "Variables={ENV=$ENV,AILEVELUP_API_KEY=$AILEVELUP_API_KEY,STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY,GOOGLE_SHEETS_DOC_ID=$GOOGLE_SHEETS_DOC_ID,REGION=$REGION,DYNAMODB_TABLE_PREFIX=$STACK_NAME,SERVICE_NAME=$SERVICE_NAME}"
      --region $REGION
    )
    
    # Add layer if it exists
    if [ ! -z "$LAYER_ARN" ]; then
      update_params+=(--layers $LAYER_ARN)
    fi
    
    aws lambda update-function-configuration "${update_params[@]}"
    
    echo "Function $function_name updated"
  fi
  
  # Wait for function to be active
  echo "Waiting for function $function_name to be active..."
  aws lambda wait function-updated --function-name $function_name --region $REGION
  echo "Function $function_name is now active"
}

# Deploy all functions
deploy_function "make-call" "makeCall" "Make phone call with AI" 256 60
deploy_function "get-call-details" "getCallDetails" "Get details of a phone call" 128 30
deploy_function "list-calls" "listCalls" "List all phone calls" 128 30
deploy_function "update-call-status" "updateCallStatus" "Update phone call status" 128 30
deploy_function "get-voice-options" "getVoiceOptions" "Get available voice options" 128 15
deploy_function "get-model-options" "getModelOptions" "Get available model options" 128 15

# Clean up temporary directory
rm -rf $TEMP_DIR
echo "Cleaned up temporary files"

echo "=========================================================="
echo "Deployment completed at $(date)"
echo "All Lambda functions have been updated"
echo "==========================================================" 