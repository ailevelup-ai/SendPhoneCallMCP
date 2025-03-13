#!/bin/bash
# Deploy lambda call updater to AWS

# Set default values
FUNCTION_NAME="ailevelupAiCallUpdater"
LAMBDA_ROLE="arn:aws:iam::123456789012:role/ailevelup-ai-call-updater-role"
REGION="us-east-1"
MEMORY=512
TIMEOUT=300
SCHEDULE="rate(5 minutes)"
EVENT_RULE_NAME="CallUpdaterSchedule"

# Print header
echo "==== ailevelup.AI Call Updater Lambda Deployment ===="
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo "Schedule: $SCHEDULE"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
  echo "Error: AWS CLI is not installed. Please install it first."
  exit 1
fi

# Create deployment package
echo "Building deployment package..."
rm -rf lambda-package lambda-package.zip
mkdir -p lambda-package

# Copy necessary files
cp lambda-call-updater.js lambda-package/index.js
cp -r google-sheets-logging.js lambda-package/
cp -r config lambda-package/
cp -r utils lambda-package/
cp package.json lambda-package/

# Install production dependencies
echo "Installing production dependencies..."
cd lambda-package
npm install --production
cd ..

# Create zip package
echo "Creating zip archive..."
zip -r lambda-package.zip lambda-package/ -x "*.git*" -x "node_modules/aws-sdk/*"

# Check if function exists
echo "Checking if function exists..."
if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION &> /dev/null; then
  # Update existing function
  echo "Updating existing Lambda function..."
  aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://lambda-package.zip \
    --region $REGION

  echo "Updating Lambda configuration..."
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment "Variables={AILEVELUP_ENTERPRISE_API_KEY=${AILEVELUP_ENTERPRISE_API_KEY},AILEVELUP_ENCRYPTED_KEY=${AILEVELUP_ENCRYPTED_KEY},GOOGLE_SHEETS_PRIVATE_KEY=${GOOGLE_SHEETS_PRIVATE_KEY},GOOGLE_SHEETS_CLIENT_EMAIL=${GOOGLE_SHEETS_CLIENT_EMAIL},GOOGLE_SHEETS_DOC_ID=${GOOGLE_SHEETS_DOC_ID},SUPABASE_URL=${SUPABASE_URL},SUPABASE_KEY=${SUPABASE_KEY}}" \
    --region $REGION
else
  # Create new function
  echo "Creating new Lambda function..."
  aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $LAMBDA_ROLE \
    --handler index.handler \
    --zip-file fileb://lambda-package.zip \
    --timeout $TIMEOUT \
    --memory-size $MEMORY \
    --environment "Variables={AILEVELUP_ENTERPRISE_API_KEY=${AILEVELUP_ENTERPRISE_API_KEY},AILEVELUP_ENCRYPTED_KEY=${AILEVELUP_ENCRYPTED_KEY},GOOGLE_SHEETS_PRIVATE_KEY=${GOOGLE_SHEETS_PRIVATE_KEY},GOOGLE_SHEETS_CLIENT_EMAIL=${GOOGLE_SHEETS_CLIENT_EMAIL},GOOGLE_SHEETS_DOC_ID=${GOOGLE_SHEETS_DOC_ID},SUPABASE_URL=${SUPABASE_URL},SUPABASE_KEY=${SUPABASE_KEY}}" \
    --region $REGION

  # Create scheduler event rule
  echo "Setting up scheduled event to run every 5 minutes..."
  aws events put-rule \
    --name $EVENT_RULE_NAME \
    --schedule-expression "$SCHEDULE" \
    --region $REGION

  # Get function ARN
  FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --query 'Configuration.FunctionArn' --output text)

  # Add permission for EventBridge to invoke the function
  aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id EventBridgeInvoke \
    --action 'lambda:InvokeFunction' \
    --principal events.amazonaws.com \
    --source-arn $(aws events describe-rule --name $EVENT_RULE_NAME --region $REGION --query 'Arn' --output text) \
    --region $REGION

  # Set the Lambda function as the target for the rule
  aws events put-targets \
    --rule $EVENT_RULE_NAME \
    --targets "[{\"Id\": \"1\", \"Arn\": \"$FUNCTION_ARN\"}]" \
    --region $REGION
fi

echo "Deployment completed successfully!"
echo "The function will update call data in Google Sheets every 5 minutes." 