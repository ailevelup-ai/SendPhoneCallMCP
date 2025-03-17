#!/bin/bash
set -e

# Environment and region
ENVIRONMENT=$1
REGION=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo "Usage: $0 <environment> <region>"
  echo "Example: $0 dev us-east-1"
  exit 1
fi

# Set AWS CLI path
AWS_CLI="/opt/homebrew/Cellar/awscli/2.24.23/libexec/bin/aws"

# Service name and table name
SERVICE_NAME="ailevelup-phone-call-mcp"
AUDIT_TABLE_NAME="${SERVICE_NAME}-${ENVIRONMENT}-audit-logs"

echo "==== Setting up Audit Logging for $ENVIRONMENT environment in $REGION region ===="

# Check if the table already exists
TABLE_EXISTS=$($AWS_CLI dynamodb describe-table --table-name "$AUDIT_TABLE_NAME" --region "$REGION" 2>/dev/null || echo "")

if [ -z "$TABLE_EXISTS" ]; then
  echo "Creating new audit logs table: $AUDIT_TABLE_NAME"
  
  # Create the DynamoDB table
  $AWS_CLI dynamodb create-table \
    --table-name "$AUDIT_TABLE_NAME" \
    --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=timestamp,AttributeType=S \
    --key-schema \
      AttributeName=id,KeyType=HASH \
      AttributeName=timestamp,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
      "IndexName=timestamp-index,KeySchema=[{AttributeName=timestamp,KeyType=HASH}],Projection={ProjectionType=ALL}" \
    --region "$REGION"
  
  # Wait for the table to be created
  echo "Waiting for table to be created..."
  $AWS_CLI dynamodb wait table-exists --table-name "$AUDIT_TABLE_NAME" --region "$REGION"
  
  # Enable TTL for automatic expiration of old logs
  echo "Enabling Time-To-Live (TTL) for automatic log expiration..."
  $AWS_CLI dynamodb update-time-to-live \
    --table-name "$AUDIT_TABLE_NAME" \
    --time-to-live-specification "Enabled=true,AttributeName=ttl" \
    --region "$REGION"
  
  echo "✅ Audit logs table created successfully"
else
  echo "Using existing audit logs table: $AUDIT_TABLE_NAME"
fi

# Create log group in CloudWatch Logs
LOG_GROUP="/ailevelup-phone-call-mcp/${ENVIRONMENT}/audit-logs"
LOG_GROUP_EXISTS=$($AWS_CLI logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --region "$REGION" | grep "$LOG_GROUP" || echo "")

if [ -z "$LOG_GROUP_EXISTS" ]; then
  echo "Creating CloudWatch Logs group: $LOG_GROUP"
  $AWS_CLI logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION"
  
  # Set log retention to 90 days to control costs
  $AWS_CLI logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 90 --region "$REGION"
  
  echo "✅ CloudWatch Logs group created successfully"
else
  echo "Using existing CloudWatch Logs group: $LOG_GROUP"
fi

echo "==== Audit logging setup completed successfully ===="
echo "DynamoDB Table: $AUDIT_TABLE_NAME"
echo "CloudWatch Logs Group: $LOG_GROUP" 