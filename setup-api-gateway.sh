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

echo "Setting up API Gateway for $ENVIRONMENT environment in $REGION region..."

# Set up names with environment suffix
SERVICE_NAME="ailevelup-phone-call-mcp"
STACK_NAME="$SERVICE_NAME-$ENVIRONMENT"

# Set up API Gateway
echo "Setting up API Gateway..."
API_NAME="${STACK_NAME}-api"

# Check if API already exists
API_ID=$($AWS_CLI apigateway get-rest-apis --query "items[?name=='$API_NAME'].id" --output text)

if [ -z "$API_ID" ]; then
  # Create new API
  API_ID=$($AWS_CLI apigateway create-rest-api --name "$API_NAME" --query 'id' --output text)
fi

echo "API Gateway created with ID: $API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create resources and methods
echo "Creating API Gateway resources and methods..."

# Get AWS account ID
ACCOUNT_ID=$($AWS_CLI sts get-caller-identity --query 'Account' --output text)

# /call (POST) - Make a call
CALL_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/call'].id" --output text)
if [ -z "$CALL_RESOURCE_ID" ]; then
  CALL_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "call" --query 'id' --output text)
fi

# Create POST method for /call
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALL_RESOURCE_ID \
  --http-method POST --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALL_RESOURCE_ID \
  --http-method POST --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:${STACK_NAME}-make-call/invocations"

# /call/{callId} (GET) - Get call details
CALL_ID_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/call/{callId}'].id" --output text)
if [ -z "$CALL_ID_RESOURCE_ID" ]; then
  CALL_ID_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $CALL_RESOURCE_ID --path-part "{callId}" --query 'id' --output text)
fi

# Create GET method for /call/{callId}
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALL_ID_RESOURCE_ID \
  --http-method GET --authorization-type NONE \
  --request-parameters "method.request.path.callId=true"

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALL_ID_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:${STACK_NAME}-get-call-details/invocations"

# /calls (GET) - List calls
CALLS_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/calls'].id" --output text)
if [ -z "$CALLS_RESOURCE_ID" ]; then
  CALLS_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "calls" --query 'id' --output text)
fi

# Create GET method for /calls
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $CALLS_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $CALLS_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:${STACK_NAME}-list-calls/invocations"

# /voices (GET) - Get voice options
VOICES_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/voices'].id" --output text)
if [ -z "$VOICES_RESOURCE_ID" ]; then
  VOICES_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "voices" --query 'id' --output text)
fi

# Create GET method for /voices
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $VOICES_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $VOICES_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:${STACK_NAME}-get-voice-options/invocations"

# /models (GET) - Get model options
MODELS_RESOURCE_ID=$($AWS_CLI apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/models'].id" --output text)
if [ -z "$MODELS_RESOURCE_ID" ]; then
  MODELS_RESOURCE_ID=$($AWS_CLI apigateway create-resource --rest-api-id $API_ID --parent-id $ROOT_RESOURCE_ID --path-part "models" --query 'id' --output text)
fi

# Create GET method for /models
$AWS_CLI apigateway put-method --rest-api-id $API_ID --resource-id $MODELS_RESOURCE_ID \
  --http-method GET --authorization-type NONE

# Integrate with Lambda
$AWS_CLI apigateway put-integration --rest-api-id $API_ID --resource-id $MODELS_RESOURCE_ID \
  --http-method GET --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:$ACCOUNT_ID:function:${STACK_NAME}-get-model-options/invocations"

# Deploy the API
echo "Deploying API Gateway..."
DEPLOYMENT_ID=$($AWS_CLI apigateway create-deployment --rest-api-id $API_ID \
  --stage-name $ENVIRONMENT \
  --query 'id' --output text)

echo "API Gateway deployed with ID: $DEPLOYMENT_ID"

# Add lambda permissions for API Gateway to invoke Lambda functions
echo "Adding Lambda permissions..."

for FUNC in "make-call" "get-call-details" "list-calls" "get-voice-options" "get-model-options"; do
  FUNCTION_NAME="${STACK_NAME}-${FUNC}"
  PERMISSION_EXISTS=$($AWS_CLI lambda get-policy --function-name $FUNCTION_NAME 2>/dev/null | grep -q "apigateway:${API_ID}" && echo "true" || echo "false")
  
  if [ "$PERMISSION_EXISTS" = "false" ]; then
    echo "Adding permission for API Gateway to invoke $FUNCTION_NAME"
    $AWS_CLI lambda add-permission \
      --function-name $FUNCTION_NAME \
      --statement-id "apigateway-$API_ID" \
      --action "lambda:InvokeFunction" \
      --principal "apigateway.amazonaws.com" \
      --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*/*"
  else
    echo "Permission already exists for $FUNCTION_NAME"
  fi
done

API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT"
echo "API Gateway setup complete!"
echo "API URL: $API_URL" 