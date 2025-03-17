#!/bin/bash

# Script to test Lambda functions

echo "Testing Lambda functions..."

# Test update-call-status function
echo "Testing update-call-status function..."
aws lambda invoke \
  --function-name ailevelup-phone-call-mcp-dev-update-call-status \
  --payload '{"call_id": "test-call-id", "status": "completed", "duration": 120}' \
  --region us-east-1 \
  update-call-status-response.json

echo "Response saved to update-call-status-response.json"
cat update-call-status-response.json

# Test make-call function
echo "Testing make-call function..."
aws lambda invoke \
  --function-name ailevelup-phone-call-mcp-staging-make-call \
  --payload '{"body": "{\"phone_number\": \"+15555555555\", \"task\": \"This is a test call\", \"from\": \"+15555555555\"}"}' \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  make-call-response.json

echo "Response saved to make-call-response.json"
echo "Response content:"
cat make-call-response.json
echo ""

# Test check-call-status function
echo "Testing check-call-status function..."
aws lambda invoke \
  --function-name ailevelup-phone-call-mcp-staging-check-call-status \
  --payload '{"callId": "test-call-id"}' \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  check-call-status-response.json

echo "Response saved to check-call-status-response.json"
echo "Response content:"
cat check-call-status-response.json
echo ""

echo "Testing complete. Check the response files for details." 