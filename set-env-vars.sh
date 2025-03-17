#!/bin/bash

# Script to set environment variables for Lambda function update

# Function to load variables from a file
load_env_file() {
  local env_file=$1
  echo "Loading variables from $env_file..."
  
  # Read the file line by line
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ ! "$line" =~ ^# && -n "$line" ]]; then
      # Extract variable name and value
      if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # Remove quotes if present
        var_value="${var_value#\"}"
        var_value="${var_value%\"}"
        
        # Export the variable
        export "$var_name"="$var_value"
      fi
    fi
  done < "$env_file"
  
  echo "Environment variables loaded from $env_file"
}

# Check if .env exists and source it
if [ -f .env ]; then
  load_env_file ".env"
else
  echo "Warning: .env file not found"
fi

# Check for .env.staging file as a fallback
if [ ! -f .env ] && [ -f .env.staging ]; then
  load_env_file ".env.staging"
  
  # Replace placeholder variables with actual values
  if [[ "$GOOGLE_SHEETS_PRIVATE_KEY" == *"STAGING_GOOGLE_SHEETS_PRIVATE_KEY"* ]]; then
    if [ -n "$STAGING_GOOGLE_SHEETS_PRIVATE_KEY" ]; then
      export GOOGLE_SHEETS_PRIVATE_KEY="$STAGING_GOOGLE_SHEETS_PRIVATE_KEY"
      echo "Set GOOGLE_SHEETS_PRIVATE_KEY from STAGING_GOOGLE_SHEETS_PRIVATE_KEY"
    fi
  fi
  
  if [[ "$GOOGLE_SHEETS_CLIENT_EMAIL" == *"STAGING_GOOGLE_SHEETS_CLIENT_EMAIL"* ]]; then
    if [ -n "$STAGING_GOOGLE_SHEETS_CLIENT_EMAIL" ]; then
      export GOOGLE_SHEETS_CLIENT_EMAIL="$STAGING_GOOGLE_SHEETS_CLIENT_EMAIL"
      echo "Set GOOGLE_SHEETS_CLIENT_EMAIL from STAGING_GOOGLE_SHEETS_CLIENT_EMAIL"
    fi
  fi
  
  if [[ "$GOOGLE_SHEETS_DOC_ID" == *"STAGING_GOOGLE_SHEETS_DOC_ID"* ]]; then
    if [ -n "$STAGING_GOOGLE_SHEETS_DOC_ID" ]; then
      export GOOGLE_SHEETS_DOC_ID="$STAGING_GOOGLE_SHEETS_DOC_ID"
      echo "Set GOOGLE_SHEETS_DOC_ID from STAGING_GOOGLE_SHEETS_DOC_ID"
    fi
  fi
  
  if [[ "$AILEVELUP_ENTERPRISE_API_KEY" == *"STAGING_AILEVELUP_ENTERPRISE_API_KEY"* ]]; then
    if [ -n "$STAGING_AILEVELUP_ENTERPRISE_API_KEY" ]; then
      export AILEVELUP_ENTERPRISE_API_KEY="$STAGING_AILEVELUP_ENTERPRISE_API_KEY"
      echo "Set AILEVELUP_ENTERPRISE_API_KEY from STAGING_AILEVELUP_ENTERPRISE_API_KEY"
    fi
  fi
fi

# Set additional required variables
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmcmVzd2l6eXB3YXJ5enlxY3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5MDI1NTYsImV4cCI6MjAxNTQ3ODU1Nn0.KPGUqZZJgXKp0aPJwGcaSJLLNm_dTE-Q-q5RjUGYv-c"
export SUPABASE_URL="https://rfreswizypwaryzyqczr.supabase.co"
export AILEVELUP_API_URL="https://api.bland.ai"

# Verify that required variables are set
missing_vars=0

if [ -z "$GOOGLE_SHEETS_PRIVATE_KEY" ]; then
  echo "Error: GOOGLE_SHEETS_PRIVATE_KEY is not set"
  missing_vars=1
fi

if [ -z "$GOOGLE_SHEETS_CLIENT_EMAIL" ]; then
  echo "Error: GOOGLE_SHEETS_CLIENT_EMAIL is not set"
  missing_vars=1
fi

if [ -z "$GOOGLE_SHEETS_DOC_ID" ]; then
  echo "Error: GOOGLE_SHEETS_DOC_ID is not set"
  missing_vars=1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_KEY is not set"
  missing_vars=1
fi

if [ -z "$AILEVELUP_ENTERPRISE_API_KEY" ]; then
  echo "Error: AILEVELUP_ENTERPRISE_API_KEY is not set"
  missing_vars=1
fi

if [ $missing_vars -eq 1 ]; then
  echo "Some required environment variables are missing. Please set them in .env or .env.staging file."
  exit 1
fi

echo "All required environment variables are set and ready for deployment." 