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

echo "Setting up EventBridge rule for $ENVIRONMENT environment in $REGION region..."

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"

# Get AWS account ID
ACCOUNT_ID=$($AWS_CLI sts get-caller-identity --query 'Account' --output text)

# Create EventBridge rule for checking call status
RULE_NAME="${STACK_NAME}-check-call-status"
FUNCTION_NAME="${STACK_NAME}-update-call-status"

echo "Creating EventBridge rule: $RULE_NAME"

# Create or update EventBridge rule
$AWS_CLI events put-rule \
  --name $RULE_NAME \
  --schedule-expression "rate(1 minute)" \
  --state ENABLED

# Set the Lambda function as the target for the rule
$AWS_CLI events put-targets \
  --rule $RULE_NAME \
  --targets "Id"="1","Arn"="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"

# Add permission for EventBridge to invoke the Lambda function
PERMISSION_EXISTS=$($AWS_CLI lambda get-policy --function-name $FUNCTION_NAME 2>/dev/null | grep -q "events:PutRule" && echo "true" || echo "false")

if [ "$PERMISSION_EXISTS" = "false" ]; then
  echo "Adding permission for EventBridge to invoke $FUNCTION_NAME"
  $AWS_CLI lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id "eventbridge-$RULE_NAME" \
    --action "lambda:InvokeFunction" \
    --principal "events.amazonaws.com" \
    --source-arn "arn:aws:events:$REGION:$ACCOUNT_ID:rule/$RULE_NAME"
else
  echo "Permission already exists for EventBridge to invoke $FUNCTION_NAME"
fi

echo "EventBridge rule setup complete!" 