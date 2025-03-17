#!/bin/bash

# Deployment Troubleshooting Script
# This script provides detailed diagnostics for AWS Lambda and API Gateway issues

set -e  # Exit on error

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <environment> [component]"
  echo "Environment: staging, production"
  echo "Component (optional): lambda, apigateway, all (default)"
  echo "Example: $0 production lambda"
  exit 1
fi

ENVIRONMENT=$1
COMPONENT=${2:-"all"}
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"
LOG_DIR="logs"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
LOG_FILE="${LOG_DIR}/troubleshoot-${ENVIRONMENT}-${TIMESTAMP}.log"

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

# Function to log messages
log() {
  local message="$1"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

# Function to log section headers
log_section() {
  local section="$1"
  echo "" | tee -a "$LOG_FILE"
  echo "====================================================================" | tee -a "$LOG_FILE"
  echo "                           $section                                  " | tee -a "$LOG_FILE"
  echo "====================================================================" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
}

# Function to capture command output with logging
run_cmd() {
  local cmd="$@"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  
  echo "[$timestamp] COMMAND: $cmd" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  # Execute the command and capture both stdout and stderr
  set +e  # Temporarily disable exit on error
  output=$("$@" 2>&1)
  exit_code=$?
  set -e  # Re-enable exit on error
  
  echo "$output" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  if [ $exit_code -ne 0 ]; then
    echo "[$timestamp] COMMAND FAILED (exit code: $exit_code)" | tee -a "$LOG_FILE"
  else
    echo "[$timestamp] COMMAND SUCCEEDED" | tee -a "$LOG_FILE"
  fi
  
  echo "$output"
}

# Function to check Lambda configuration
check_lambda_config() {
  local function_name="$1"
  
  log "Checking configuration for Lambda function: $function_name"
  
  # Check if function exists
  if ! aws lambda get-function --function-name "$function_name" --region $REGION &>/dev/null; then
    log "Lambda function $function_name does not exist"
    return 1
  fi
  
  # Get function configuration
  local config
  config=$(run_cmd aws lambda get-function --function-name "$function_name" --region $REGION)
  
  # Extract key information
  local handler=$(echo "$config" | jq -r .Configuration.Handler)
  local runtime=$(echo "$config" | jq -r .Configuration.Runtime)
  local role=$(echo "$config" | jq -r .Configuration.Role)
  local code_size=$(echo "$config" | jq -r .Configuration.CodeSize)
  local memory=$(echo "$config" | jq -r .Configuration.MemorySize)
  local timeout=$(echo "$config" | jq -r .Configuration.Timeout)
  local last_modified=$(echo "$config" | jq -r .Configuration.LastModified)
  
  log "  Handler: $handler"
  log "  Runtime: $runtime"
  log "  Role: $role"
  log "  Code Size: $code_size bytes"
  log "  Memory: $memory MB"
  log "  Timeout: $timeout seconds"
  log "  Last Modified: $last_modified"
  
  # Check if handler is correctly set to index.handler
  if [ "$handler" != "index.handler" ]; then
    log "⚠️ Handler is not set to 'index.handler', this may cause issues"
  else
    log "✅ Handler is correctly set to 'index.handler'"
  fi
  
  # Check if role exists and has proper permissions
  local role_name=$(echo "$role" | cut -d/ -f2)
  if ! aws iam get-role --role-name "$role_name" &>/dev/null; then
    log "⚠️ IAM Role $role_name doesn't exist or is not accessible"
  else
    log "✅ IAM Role $role_name exists"
    
    # Check role policies
    local policies
    policies=$(run_cmd aws iam list-attached-role-policies --role-name "$role_name" --region $REGION)
    local basic_execution=$(echo "$policies" | grep -c "AWSLambdaBasicExecutionRole")
    
    if [ $basic_execution -eq 0 ]; then
      log "⚠️ AWSLambdaBasicExecutionRole not attached to IAM Role"
    else
      log "✅ AWSLambdaBasicExecutionRole is attached"
    fi
  fi
  
  # Test function invocation
  log "Testing function invocation with empty payload..."
  
  local invocation
  invocation=$(run_cmd aws lambda invoke --function-name "$function_name" --payload '{"test":true}' --region $REGION /tmp/lambda-output.json)
  
  # Check status code
  local status_code=$(echo "$invocation" | grep -o "StatusCode.*[0-9]" | cut -d: -f2 | tr -d ' ,')
  
  if [ "$status_code" == "200" ]; then
    log "✅ Function invocation successful (status code: $status_code)"
    log "Function response:"
    cat /tmp/lambda-output.json | tee -a "$LOG_FILE"
  else
    log "⚠️ Function invocation failed or returned non-200 status (status code: $status_code)"
    if [ -f /tmp/lambda-output.json ]; then
      log "Function response:"
      cat /tmp/lambda-output.json | tee -a "$LOG_FILE"
    fi
  fi
  
  return 0
}

# Function to investigate API Gateway issues
check_api_gateway() {
  log "Checking API Gateway configuration..."
  
  # Check if API Gateway exists
  local api_id
  api_id=$(run_cmd aws apigateway get-rest-apis --region $REGION --query "items[?name=='$SERVICE_PREFIX-$ENVIRONMENT-api'].id" --output text)
  
  if [ -z "$api_id" ] || [ "$api_id" == "None" ]; then
    log "⚠️ API Gateway not found for environment: $ENVIRONMENT"
    return 1
  else
    log "✅ API Gateway found with ID: $api_id"
  fi
  
  # Get resources
  log "Getting API Gateway resources..."
  local resources
  resources=$(run_cmd aws apigateway get-resources --rest-api-id "$api_id" --region $REGION)
  
  # Count resources
  local resource_count=$(echo "$resources" | jq '.items | length')
  log "API Gateway has $resource_count resources"
  
  # Print out resources with methods
  log "API Gateway resources and methods:"
  echo "$resources" | jq -r '.items[] | select(.resourceMethods != null) | "  Path: " + .path + ", Methods: " + (.resourceMethods | keys | join(", "))' | tee -a "$LOG_FILE"
  
  # Check if there are resources with methods
  local methods_count=$(echo "$resources" | jq '[.items[] | select(.resourceMethods != null)] | length')
  if [ $methods_count -eq 0 ]; then
    log "⚠️ No API methods found, API Gateway is not properly configured"
  fi
  
  # Check deployments
  log "Checking API Gateway deployments..."
  local deployments
  deployments=$(run_cmd aws apigateway get-deployments --rest-api-id "$api_id" --region $REGION)
  
  # Count deployments
  local deployment_count=$(echo "$deployments" | jq '.items | length')
  log "API Gateway has $deployment_count deployments"
  
  # Check stages
  log "Checking API Gateway stages..."
  local stages
  stages=$(run_cmd aws apigateway get-stages --rest-api-id "$api_id" --region $REGION)
  
  # Check if our environment stage exists
  local stage_exists=$(echo "$stages" | jq -r --arg env "$ENVIRONMENT" '.item[] | select(.stageName == $env) | .stageName' | grep -c "$ENVIRONMENT")
  
  if [ $stage_exists -eq 0 ]; then
    log "⚠️ Stage '$ENVIRONMENT' does not exist for API Gateway $api_id"
  else
    log "✅ Stage '$ENVIRONMENT' exists for API Gateway $api_id"
    
    # Get stage details
    local stage_details
    stage_details=$(run_cmd aws apigateway get-stage --rest-api-id "$api_id" --stage-name "$ENVIRONMENT" --region $REGION)
    
    # Check if there are any issues
    local method_settings=$(echo "$stage_details" | jq -r '.methodSettings')
    if [ "$method_settings" == "{}" ]; then
      log "⚠️ No method settings configured for stage '$ENVIRONMENT'"
    fi
    
    # Check deployment ID
    local deployment_id=$(echo "$stage_details" | jq -r '.deploymentId')
    log "Stage '$ENVIRONMENT' uses deployment ID: $deployment_id"
    
    # Verify this deployment actually exists
    if ! echo "$deployments" | jq -r '.items[].id' | grep -q "$deployment_id"; then
      log "⚠️ Deployment ID $deployment_id referenced by stage '$ENVIRONMENT' not found"
    else
      log "✅ Deployment ID $deployment_id is valid"
    fi
  fi
  
  # Check for Lambda integrations
  log "Checking Lambda integrations for each resource..."
  
  echo "$resources" | jq -r '.items[] | select(.resourceMethods != null) | .id' | while read -r resource_id; do
    local path=$(echo "$resources" | jq -r --arg id "$resource_id" '.items[] | select(.id == $id) | .path')
    
    echo "$resources" | jq -r --arg id "$resource_id" '.items[] | select(.id == $id) | .resourceMethods | keys[]' | while read -r method; do
      log "Checking integration for resource $path, method $method..."
      
      local integration
      integration=$(run_cmd aws apigateway get-integration --rest-api-id "$api_id" --resource-id "$resource_id" --http-method "$method" --region $REGION)
      
      # Check integration type
      local integration_type=$(echo "$integration" | jq -r .type)
      log "  Integration type: $integration_type"
      
      if [ "$integration_type" != "AWS_PROXY" ]; then
        log "⚠️ Integration type is not AWS_PROXY ($integration_type)"
      else
        log "✅ Integration type is AWS_PROXY"
      
        # Extract Lambda function name from URI
        local uri=$(echo "$integration" | jq -r .uri)
        local function_arn=$(echo "$uri" | sed -n 's/.*functions\/\(.*\)\/invocations.*/\1/p')
        
        if [ -z "$function_arn" ]; then
          log "⚠️ Could not extract Lambda function ARN from integration URI: $uri"
        else
          local function_name=$(echo "$function_arn" | cut -d: -f7)
          log "  Integrated with Lambda function: $function_name"
          
          # Check if Lambda function exists
          if ! aws lambda get-function --function-name "$function_arn" --region $REGION &>/dev/null; then
            log "⚠️ Lambda function $function_name does not exist or is not accessible"
          else
            log "✅ Lambda function $function_name exists"
            
            # Check Lambda permissions
            log "  Checking Lambda permissions for API Gateway..."
            local source_arn="arn:aws:execute-api:$REGION:*:$api_id/*/$method/*"
            
            local permissions
            permissions=$(run_cmd aws lambda get-policy --function-name "$function_name" --region $REGION)
            
            if [ $? -ne 0 ]; then
              log "⚠️ No resource policy found for Lambda function $function_name"
              
              # Suggest fixing permissions
              log "  Fixing permissions by adding API Gateway permissions to Lambda..."
              run_cmd aws lambda add-permission \
                --function-name "$function_name" \
                --statement-id "apigateway-$ENVIRONMENT-$method-$(date +%s)" \
                --action lambda:InvokeFunction \
                --principal apigateway.amazonaws.com \
                --source-arn "$source_arn" \
                --region $REGION
              
              if [ $? -eq 0 ]; then
                log "✅ Successfully added API Gateway permissions to Lambda function"
              else
                log "⚠️ Failed to add API Gateway permissions to Lambda function"
              fi
            else
              # Check if policy contains the correct source ARN
              local policy_text=$(echo "$permissions" | jq -r .Policy)
              
              if echo "$policy_text" | grep -q "$api_id"; then
                log "✅ Lambda function has permissions for API Gateway"
              else
                log "⚠️ Lambda function does not have correct permissions for API Gateway"
                
                # Suggest fixing permissions
                log "  Fixing permissions by adding API Gateway permissions to Lambda..."
                run_cmd aws lambda add-permission \
                  --function-name "$function_name" \
                  --statement-id "apigateway-$ENVIRONMENT-$method-$(date +%s)" \
                  --action lambda:InvokeFunction \
                  --principal apigateway.amazonaws.com \
                  --source-arn "$source_arn" \
                  --region $REGION
                
                if [ $? -eq 0 ]; then
                  log "✅ Successfully added API Gateway permissions to Lambda function"
                else
                  log "⚠️ Failed to add API Gateway permissions to Lambda function"
                fi
              fi
            fi
          fi
        fi
      fi
    done
  done
  
  return 0
}

# Function to inspect Lambda logs
inspect_lambda_logs() {
  local function_name="$1"
  
  log "Inspecting CloudWatch logs for Lambda function: $function_name"
  
  # Check if function exists
  if ! aws lambda get-function --function-name "$function_name" --region $REGION &>/dev/null; then
    log "Lambda function $function_name does not exist"
    return 1
  fi
  
  # Get log group
  local log_group="/aws/lambda/$function_name"
  
  # Check if log group exists
  if ! aws logs describe-log-groups --log-group-name-prefix "$log_group" --region $REGION 2>/dev/null | grep -q "$log_group"; then
    log "Log group $log_group does not exist yet. Lambda function may not have been invoked."
    return 1
  fi
  
  # Get log streams
  log "Getting log streams..."
  local streams
  streams=$(run_cmd aws logs describe-log-streams --log-group-name "$log_group" --order-by LastEventTime --descending --max-items 5 --region $REGION)
  
  # Check if we have log streams
  local stream_count=$(echo "$streams" | jq '.logStreams | length')
  if [ $stream_count -eq 0 ]; then
    log "No log streams found for Lambda function $function_name"
    return 1
  fi
  
  log "Found $stream_count log streams, examining the most recent ones..."
  
  # Process the most recent log streams
  echo "$streams" | jq -r '.logStreams[].logStreamName' | head -n 3 | while read -r stream; do
    log "Log stream: $stream"
    
    # Get log events
    local events
    events=$(run_cmd aws logs get-log-events --log-group-name "$log_group" --log-stream-name "$stream" --limit 100 --region $REGION)
    
    # Process log events
    echo "$events" | jq -r '.events[].message' > /tmp/lambda_logs.txt
    
    # Check for common errors
    log "Checking for common error patterns..."
    
    if grep -q "module not found" /tmp/lambda_logs.txt; then
      log "⚠️ MODULE NOT FOUND ERROR detected - check deployment package structure"
      log "Error details:"
      grep -A 2 -B 2 "module not found" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    if grep -q "cannot find module" /tmp/lambda_logs.txt; then
      log "⚠️ CANNOT FIND MODULE ERROR detected - check deployment package structure"
      log "Error details:"
      grep -A 2 -B 2 "cannot find module" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    if grep -q "Timeout" /tmp/lambda_logs.txt; then
      log "⚠️ TIMEOUT ERROR detected - function exceeded its execution time limit"
      log "Error details:"
      grep -A 2 -B 2 "Timeout" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    if grep -q "Memory Size" /tmp/lambda_logs.txt; then
      log "⚠️ MEMORY ERROR detected - function is using too much memory"
      log "Error details:"
      grep -A 2 -B 2 "Memory Size" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    if grep -q "AccessDenied" /tmp/lambda_logs.txt; then
      log "⚠️ ACCESS DENIED ERROR detected - check IAM permissions"
      log "Error details:"
      grep -A 2 -B 2 "AccessDenied" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    # Check for any error or exception messages
    if grep -i -E "error|exception|fail" /tmp/lambda_logs.txt; then
      log "⚠️ ERROR or EXCEPTION detected in logs"
      log "Error details:"
      grep -i -E "error|exception|fail" /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
    fi
    
    # Print the most recent log events
    log "Most recent log events:"
    tail -n 20 /tmp/lambda_logs.txt | tee -a "$LOG_FILE"
  done
  
  rm -f /tmp/lambda_logs.txt
  return 0
}

# Function to check Lambda environment variables
check_lambda_env_vars() {
  local function_name="$1"
  
  log "Checking environment variables for Lambda function: $function_name"
  
  # Check if function exists
  if ! aws lambda get-function --function-name "$function_name" --region $REGION &>/dev/null; then
    log "Lambda function $function_name does not exist"
    return 1
  fi
  
  # Get function configuration
  local config
  config=$(run_cmd aws lambda get-function-configuration --function-name "$function_name" --region $REGION)
  
  # Check if environment variables exist
  local has_env=$(echo "$config" | jq -r '.Environment != null')
  
  if [ "$has_env" == "false" ]; then
    log "⚠️ No environment variables found for Lambda function $function_name"
    return 1
  fi
  
  # List environment variable keys (not values for security)
  local env_vars=$(echo "$config" | jq -r '.Environment.Variables | keys[]')
  
  log "Environment variables (keys only):"
  echo "$env_vars" | sort | tee -a "$LOG_FILE"
  
  # Check for critical environment variables
  log "Checking for critical environment variables..."
  
  local critical_vars=("NODE_ENV" "AWS_REGION" "DYNAMODB_TABLE_PREFIX")
  
  for var in "${critical_vars[@]}"; do
    if echo "$env_vars" | grep -q "^$var$"; then
      log "✅ Found critical environment variable: $var"
    else
      log "⚠️ Missing critical environment variable: $var"
    fi
  done
  
  return 0
}

# Function to provide a summary of all issues and suggested fixes
provide_summary() {
  log_section "TROUBLESHOOTING SUMMARY"
  
  # Count issues
  local issues_count=$(grep -c "⚠️" "$LOG_FILE")
  local successes_count=$(grep -c "✅" "$LOG_FILE")
  
  log "Found $issues_count potential issues and $successes_count successful checks"
  
  if [ $issues_count -gt 0 ]; then
    log "List of issues found:"
    grep "⚠️" "$LOG_FILE" | sort | uniq | tee -a "/tmp/issues.txt"
    
    log "Suggested fixes:"
    
    # Handler issues
    if grep -q "Handler is not set to 'index.handler'" "/tmp/issues.txt"; then
      log "1. Update Lambda function handlers to use 'index.handler'"
      log "   Command: aws lambda update-function-configuration --function-name FUNCTION_NAME --handler index.handler --region $REGION"
    fi
    
    # Module not found issues
    if grep -q "MODULE NOT FOUND ERROR" "/tmp/issues.txt" || grep -q "CANNOT FIND MODULE ERROR" "/tmp/issues.txt"; then
      log "2. Fix deployment package structure:"
      log "   - Ensure all dependencies are included in the deployment package"
      log "   - Check that index.js exists and correctly exports the handler function"
      log "   - Verify the file structure matches the import/require paths in your code"
    fi
    
    # API Gateway permission issues
    if grep -q "does not have correct permissions for API Gateway" "/tmp/issues.txt"; then
      log "3. Add API Gateway permissions to Lambda functions:"
      log "   - Run the following for each function and HTTP method:"
      log "   aws lambda add-permission \\"
      log "     --function-name FUNCTION_NAME \\"
      log "     --statement-id apigateway-$ENVIRONMENT-METHOD \\"
      log "     --action lambda:InvokeFunction \\"
      log "     --principal apigateway.amazonaws.com \\"
      log "     --source-arn \"arn:aws:execute-api:$REGION:ACCOUNT_ID:API_ID/*/METHOD/*\" \\"
      log "     --region $REGION"
    fi
    
    # Environmental variable issues
    if grep -q "Missing critical environment variable" "/tmp/issues.txt"; then
      log "4. Add missing environment variables to Lambda functions:"
      log "   - Update the .env.$ENVIRONMENT file with missing variables"
      log "   - Redeploy the Lambda functions with updated environment variables"
    fi
    
    # Generic fixes
    log "5. General fixes:"
    log "   - Re-run deployment with detailed logging: ./deploy-to-production-with-debugging.sh"
    log "   - Check CloudWatch logs for detailed error messages"
    log "   - Verify IAM roles have appropriate permissions"
    log "   - Confirm AWS region consistency across all commands"
  else
    log "No issues found. If problems persist, try the following:"
    log "1. Check for transient AWS service issues"
    log "2. Verify network connectivity to AWS endpoints"
    log "3. Confirm all Lambda code is functioning correctly"
    log "4. Test API endpoints directly with curl or a similar tool"
  fi
  
  rm -f "/tmp/issues.txt"
  
  log "Troubleshooting complete. Full logs available at: $LOG_FILE"
}

# Main execution
log_section "DEPLOYMENT TROUBLESHOOTING"
log "Environment: $ENVIRONMENT"
log "Component: $COMPONENT"
log "Region: $REGION"
log "Stack Name: $STACK_NAME"

# Check AWS access
log "Checking AWS access..."
if ! run_cmd aws sts get-caller-identity; then
  log "⚠️ AWS access check failed. Please check AWS credentials and try again."
  exit 1
fi

# List of Lambda functions
LAMBDA_FUNCTIONS=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

# Perform Lambda troubleshooting if needed
if [ "$COMPONENT" == "all" ] || [ "$COMPONENT" == "lambda" ]; then
  log_section "LAMBDA FUNCTION DIAGNOSTICS"
  
  for func in "${LAMBDA_FUNCTIONS[@]}"; do
    func_name="${STACK_NAME}-${func}"
    log_section "LAMBDA FUNCTION: $func_name"
    
    # Check Lambda configuration
    check_lambda_config "$func_name"
    
    # Check Lambda logs
    inspect_lambda_logs "$func_name"
    
    # Check Lambda environment variables
    check_lambda_env_vars "$func_name"
  done
fi

# Perform API Gateway troubleshooting if needed
if [ "$COMPONENT" == "all" ] || [ "$COMPONENT" == "apigateway" ]; then
  log_section "API GATEWAY DIAGNOSTICS"
  check_api_gateway
fi

# Provide a summary of issues and suggested fixes
provide_summary

# Exit with success
exit 0 