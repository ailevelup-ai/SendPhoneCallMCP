#!/bin/bash

# Script to update Lambda function environment variables

# Set environment variables for Google Sheets integration
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-update-call-status \
  --region us-east-1 \
  --environment "Variables={
    SUPABASE_SERVICE_KEY=\"$SUPABASE_SERVICE_KEY\",
    AILEVELUP_ENTERPRISE_API_KEY=\"$AILEVELUP_ENTERPRISE_API_KEY\",
    DYNAMO_TABLE_NAME=\"ailevelup-phone-call-mcp-dev-rate-limits\",
    ENVIRONMENT=\"dev\",
    AILEVELUP_API_URL=\"https://api.bland.ai\",
    SUPABASE_URL=\"https://rfreswizypwaryzyqczr.supabase.co\",
    GOOGLE_SHEETS_PRIVATE_KEY=\"$GOOGLE_SHEETS_PRIVATE_KEY\",
    GOOGLE_SHEETS_CLIENT_EMAIL=\"$GOOGLE_SHEETS_CLIENT_EMAIL\",
    GOOGLE_SHEETS_DOC_ID=\"$GOOGLE_SHEETS_DOC_ID\"
  }"

echo "Lambda function environment variables updated successfully."

# Also update the make-call function
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-make-call \
  --region us-east-1 \
  --environment "Variables={
    SUPABASE_SERVICE_KEY=\"$SUPABASE_SERVICE_KEY\",
    AILEVELUP_ENTERPRISE_API_KEY=\"$AILEVELUP_ENTERPRISE_API_KEY\",
    DYNAMO_TABLE_NAME=\"ailevelup-phone-call-mcp-dev-rate-limits\",
    ENVIRONMENT=\"dev\",
    AILEVELUP_API_URL=\"https://api.bland.ai\",
    SUPABASE_URL=\"https://rfreswizypwaryzyqczr.supabase.co\",
    GOOGLE_SHEETS_PRIVATE_KEY=\"$GOOGLE_SHEETS_PRIVATE_KEY\",
    GOOGLE_SHEETS_CLIENT_EMAIL=\"$GOOGLE_SHEETS_CLIENT_EMAIL\",
    GOOGLE_SHEETS_DOC_ID=\"$GOOGLE_SHEETS_DOC_ID\"
  }"

echo "Make-call Lambda function environment variables updated successfully." 