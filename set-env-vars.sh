#!/bin/bash

# Script to set environment variables for Lambda function update

# Check if .env.staging exists and source it
if [ -f .env.staging ]; then
  echo "Loading variables from .env.staging..."
  export $(grep -v '^#' .env.staging | xargs)
fi

# Prompt for required variables if not set
if [ -z "$GOOGLE_SHEETS_PRIVATE_KEY" ]; then
  echo "Enter GOOGLE_SHEETS_PRIVATE_KEY:"
  read -s GOOGLE_SHEETS_PRIVATE_KEY
  export GOOGLE_SHEETS_PRIVATE_KEY
fi

if [ -z "$GOOGLE_SHEETS_CLIENT_EMAIL" ]; then
  echo "Enter GOOGLE_SHEETS_CLIENT_EMAIL:"
  read GOOGLE_SHEETS_CLIENT_EMAIL
  export GOOGLE_SHEETS_CLIENT_EMAIL
fi

if [ -z "$GOOGLE_SHEETS_DOC_ID" ]; then
  echo "Enter GOOGLE_SHEETS_DOC_ID:"
  read GOOGLE_SHEETS_DOC_ID
  export GOOGLE_SHEETS_DOC_ID
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Enter SUPABASE_SERVICE_KEY:"
  read -s SUPABASE_SERVICE_KEY
  export SUPABASE_SERVICE_KEY
fi

if [ -z "$AILEVELUP_ENTERPRISE_API_KEY" ]; then
  echo "Enter AILEVELUP_ENTERPRISE_API_KEY:"
  read -s AILEVELUP_ENTERPRISE_API_KEY
  export AILEVELUP_ENTERPRISE_API_KEY
fi

echo "Environment variables set. Now run ./update-lambda-env.sh to update the Lambda functions." 