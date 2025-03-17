#!/bin/bash

# Script to update Lambda function environment variables

# Source environment variables
if [ -f ./set-env-vars.sh ]; then
  source ./set-env-vars.sh
  if [ $? -ne 0 ]; then
    echo "Failed to source environment variables. Exiting."
    exit 1
  fi
else
  echo "Error: set-env-vars.sh not found. Please run from the project root directory."
  exit 1
fi

# Escape the private key for JSON
ESCAPED_PRIVATE_KEY=$(echo "$GOOGLE_SHEETS_PRIVATE_KEY" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed 's/\n/\\n/g')

# Update make-call function environment variables
echo "Updating environment variables for make-call function..."
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-staging-make-call \
  --region us-east-1 \
  --environment "Variables={GOOGLE_SHEETS_PRIVATE_KEY=\"$ESCAPED_PRIVATE_KEY\",GOOGLE_SHEETS_CLIENT_EMAIL=\"$GOOGLE_SHEETS_CLIENT_EMAIL\",GOOGLE_SHEETS_DOC_ID=\"$GOOGLE_SHEETS_DOC_ID\",SUPABASE_SERVICE_KEY=\"$SUPABASE_SERVICE_KEY\",SUPABASE_ANON_KEY=\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmVzd2l6eXB3YXJ5enlxY3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5MDI1NTYsImV4cCI6MjAxNTQ3ODU1Nn0.KPGUqZZJgXKp0aPJwGcaSJLLNm_dTE-Q-q5RjUGYv-c\",AILEVELUP_ENTERPRISE_API_KEY=\"$AILEVELUP_ENTERPRISE_API_KEY\",SUPABASE_URL=\"https://rfreswizypwaryzyqczr.supabase.co\",AILEVELUP_API_URL=\"https://api.bland.ai\"}"

if [ $? -eq 0 ]; then
  echo "Successfully updated environment variables for make-call function."
else
  echo "Failed to update environment variables for make-call function."
  exit 1
fi

# Update check-call-status function environment variables
echo "Updating environment variables for check-call-status function..."
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-staging-check-call-status \
  --region us-east-1 \
  --environment "Variables={AILEVELUP_ENTERPRISE_API_KEY=\"$AILEVELUP_ENTERPRISE_API_KEY\"}"

if [ $? -eq 0 ]; then
  echo "Successfully updated environment variables for check-call-status function."
else
  echo "Failed to update environment variables for check-call-status function."
  exit 1
fi

echo "Environment variables updated successfully for both functions." 