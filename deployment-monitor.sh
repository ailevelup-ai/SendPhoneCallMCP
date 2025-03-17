#!/bin/bash

# Deployment Monitoring Script
# This script provides enhanced monitoring, logging, and diagnostics for deployments

set -e  # Exit on error

# Check arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <environment> [log_level]"
  echo "Example: $0 production DEBUG"
  exit 1
fi

ENVIRONMENT=$1
LOG_LEVEL=${2:-"INFO"}  # Default to INFO if not specified
REGION="us-east-1"
SERVICE_PREFIX="ailevelup-phone-call-mcp"
STACK_NAME="${SERVICE_PREFIX}-${ENVIRONMENT}"
LOG_FILE="deployment-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S).log"
TRACE_FILE="deployment-trace-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S).log"

# Configure log levels
declare -A LOG_LEVELS
LOG_LEVELS=([DEBUG]=0 [INFO]=1 [WARN]=2 [ERROR]=3 [FATAL]=4)

# Initialize directories
mkdir -p logs
mkdir -p traces

# Logging functions
log() {
  local level=$1
  local message=$2
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  
  if [[ ${LOG_LEVELS[$level]} -ge ${LOG_LEVELS[$LOG_LEVEL]} ]]; then
    echo "[$timestamp] [$level] $message" | tee -a "logs/$LOG_FILE"
  fi
}

debug() {
  log "DEBUG" "$1"
}

info() {
  log "INFO" "$1"
}

warn() {
  log "WARN" "$1"
}

error() {
  log "ERROR" "$1"
}

fatal() {
  log "FATAL" "$1"
  exit 1
}

# Function to trace AWS CLI commands
trace_aws() {
  local cmd="$@"
  echo "AWS CLI COMMAND: $cmd" >> "traces/$TRACE_FILE"
  
  # Capture both stdout and stderr
  { output=$("$@" 2>&1); exit_code=$?; } || true
  
  echo "EXIT CODE: $exit_code" >> "traces/$TRACE_FILE"
  echo "OUTPUT:" >> "traces/$TRACE_FILE"
  echo "$output" >> "traces/$TRACE_FILE"
  echo "----------------------------------------" >> "traces/$TRACE_FILE"
  
  if [ $exit_code -ne 0 ]; then
    error "AWS CLI command failed: $cmd"
    error "Exit code: $exit_code"
    error "Error output: $output"
  else
    debug "AWS CLI command succeeded: $cmd"
  fi
  
  echo "$output"
  return $exit_code
}

# Function to check AWS service health
check_aws_health() {
  debug "Checking AWS service health in $REGION..."
  
  local services=("apigateway" "lambda" "dynamodb" "cloudwatch" "budgets")
  local all_healthy=true
  
  for service in "${services[@]}"; do
    if ! aws $service help &>/dev/null; then
      error "AWS service $service appears to be unavailable or inaccessible"
      all_healthy=false
    else
      debug "AWS service $service is accessible"
    fi
  done
  
  if [ "$all_healthy" = false ]; then
    warn "Some AWS services appear to be inaccessible, deployment may fail"
  else
    info "All required AWS services are accessible"
  fi
}

# Function to check environment readiness
check_environment() {
  info "Checking environment readiness for $ENVIRONMENT..."
  
  # Check for required files
  if [ ! -f ".env.$ENVIRONMENT" ]; then
    fatal "Environment file .env.$ENVIRONMENT not found"
  else
    debug "Environment file .env.$ENVIRONMENT found"
  fi
  
  # Check for required scripts
  local required_scripts=("create-api-gateway-shell.sh" "deploy-to-$ENVIRONMENT.sh")
  for script in "${required_scripts[@]}"; do
    if [ ! -f "$script" ]; then
      fatal "Required script $script not found"
    else
      debug "Required script $script found"
      
      # Check if script is executable
      if [ ! -x "$script" ]; then
        warn "Script $script is not executable, attempting to fix..."
        chmod +x "$script"
      fi
    fi
  done
  
  # Check for required directories
  local required_dirs=("functions" "utils")
  for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
      fatal "Required directory $dir not found"
    else
      debug "Required directory $dir found"
    fi
  done
  
  # Check for Lambda functions
  local lambda_functions=(
    "make-call"
    "list-calls"
    "get-call-details"
    "update-call-status"
    "get-voice-options"
    "get-model-options"
  )
  
  for func in "${lambda_functions[@]}"; do
    if [ ! -f "functions/$func.js" ]; then
      warn "Lambda function file functions/$func.js not found"
    else
      debug "Lambda function file functions/$func.js found"
    fi
  done
  
  # Check for handler file
  if [ ! -f "functions/index.js" ]; then
    warn "Lambda handler file functions/index.js not found"
  else
    debug "Lambda handler file functions/index.js found"
  fi
  
  # Check for required utilities
  local required_utils=("aws" "jq" "zip" "uuidgen")
  for util in "${required_utils[@]}"; do
    if ! command -v $util &>/dev/null; then
      fatal "Required utility $util not found in PATH"
    else
      debug "Required utility $util found in PATH"
    fi
  done
  
  info "Environment readiness check completed for $ENVIRONMENT"
}

# Function to check AWS permissions
check_aws_permissions() {
  info "Checking AWS permissions..."
  
  # Get caller identity
  local identity
  identity=$(trace_aws aws sts get-caller-identity)
  local account_id=$(echo "$identity" | jq -r .Account)
  local user_arn=$(echo "$identity" | jq -r .Arn)
  
  info "Deploying as: $user_arn in account: $account_id"
  
  # Check Lambda permissions
  debug "Checking Lambda permissions..."
  if ! trace_aws aws lambda list-functions --max-items 1 --region $REGION &>/dev/null; then
    warn "May lack sufficient Lambda permissions"
  fi
  
  # Check API Gateway permissions
  debug "Checking API Gateway permissions..."
  if ! trace_aws aws apigateway get-rest-apis --region $REGION &>/dev/null; then
    warn "May lack sufficient API Gateway permissions"
  fi
  
  # Check DynamoDB permissions
  debug "Checking DynamoDB permissions..."
  if ! trace_aws aws dynamodb list-tables --region $REGION &>/dev/null; then
    warn "May lack sufficient DynamoDB permissions"
  fi
  
  info "AWS permissions check completed"
}

# Function to capture Lambda deployment errors
monitor_lambda_deployment() {
  local function_name=$1
  
  info "Monitoring deployment of Lambda function: $function_name"
  
  # Check if function exists
  if ! trace_aws aws lambda get-function --function-name "$function_name" --region $REGION &>/dev/null; then
    warn "Lambda function $function_name does not exist yet"
    return
  fi
  
  # Get current configuration
  local config
  config=$(trace_aws aws lambda get-function-configuration --function-name "$function_name" --region $REGION)
  
  # Save relevant details
  local handler=$(echo "$config" | jq -r .Handler)
  local runtime=$(echo "$config" | jq -r .Runtime)
  local memory=$(echo "$config" | jq -r .MemorySize)
  local timeout=$(echo "$config" | jq -r .Timeout)
  
  info "Lambda function $function_name config: Handler=$handler, Runtime=$runtime, Memory=$memory, Timeout=$timeout"
  
  # Test function invocation
  info "Testing invocation of Lambda function: $function_name"
  if ! trace_aws aws lambda invoke --function-name "$function_name" --payload '{"test": true}' --region $REGION /tmp/lambda-output.json &>/dev/null; then
    warn "Unable to invoke Lambda function $function_name"
  else
    local status=$(jq -r .StatusCode /tmp/lambda-output.json 2>/dev/null || echo "unknown")
    if [[ "$status" == "200" ]]; then
      info "Lambda function $function_name invocation successful"
    else
      warn "Lambda function $function_name invocation returned non-200 status: $status"
    fi
  fi
  
  # Check CloudWatch logs for errors
  info "Checking recent CloudWatch logs for Lambda function: $function_name"
  local log_group="/aws/lambda/$function_name"
  
  # Create log group if it doesn't exist
  trace_aws aws logs create-log-group --log-group-name "$log_group" --region $REGION &>/dev/null || true
  
  # Get log streams
  local streams
  streams=$(trace_aws aws logs describe-log-streams --log-group-name "$log_group" --order-by LastEventTime --descending --max-items 5 --region $REGION)
  local stream_names=($(echo "$streams" | jq -r '.logStreams[].logStreamName'))
  
  if [ ${#stream_names[@]} -eq 0 ]; then
    warn "No log streams found for Lambda function $function_name"
  else
    for stream in "${stream_names[@]}"; do
      debug "Checking log stream: $stream"
      local logs
      logs=$(trace_aws aws logs get-log-events --log-group-name "$log_group" --log-stream-name "$stream" --limit 100 --region $REGION)
      
      # Check for errors in logs
      local error_count=$(echo "$logs" | jq -r '.events[].message' | grep -i -E 'error|exception|fail' | wc -l)
      if [ $error_count -gt 0 ]; then
        warn "Found $error_count error(s) in logs for Lambda function $function_name"
        echo "$logs" | jq -r '.events[].message' | grep -i -E 'error|exception|fail' >> "logs/$LOG_FILE"
      else
        debug "No errors found in logs for Lambda function $function_name in stream $stream"
      fi
    done
  fi
}

# Function to check API Gateway
check_api_gateway() {
  info "Checking API Gateway for $ENVIRONMENT..."
  
  # Get API ID
  local api_id
  api_id=$(trace_aws aws apigateway get-rest-apis --region $REGION --query "items[?name=='$SERVICE_PREFIX-$ENVIRONMENT-api'].id" --output text)
  
  if [ -z "$api_id" ]; then
    warn "API Gateway not found for $ENVIRONMENT"
    return
  fi
  
  info "Found API Gateway with ID: $api_id"
  
  # Get resources
  local resources
  resources=$(trace_aws aws apigateway get-resources --rest-api-id "$api_id" --region $REGION)
  local resource_count=$(echo "$resources" | jq '.items | length')
  
  info "API Gateway has $resource_count resources"
  
  # Check deployments
  local deployments
  deployments=$(trace_aws aws apigateway get-deployments --rest-api-id "$api_id" --region $REGION)
  local deployment_count=$(echo "$deployments" | jq '.items | length')
  
  info "API Gateway has $deployment_count deployments"
  
  # Check if stage exists
  local stages
  stages=$(trace_aws aws apigateway get-stages --rest-api-id "$api_id" --region $REGION)
  local stage_exists=$(echo "$stages" | jq -r --arg env "$ENVIRONMENT" '.item[] | select(.stageName == $env) | .stageName' | wc -l)
  
  if [ $stage_exists -eq 0 ]; then
    warn "Stage $ENVIRONMENT does not exist for API Gateway $api_id"
  else
    info "Stage $ENVIRONMENT exists for API Gateway $api_id"
    
    # Generate test curl commands for each endpoint
    echo "API Endpoint test commands:" >> "logs/$LOG_FILE"
    echo "$resources" | jq -r '.items[] | select(.resourceMethods != null) | .path + " - Methods: " + (.resourceMethods | keys | join(", "))' | while read -r line; do
      path=$(echo "$line" | cut -d' ' -f1)
      methods=$(echo "$line" | cut -d' ' -f4)
      
      # Only generate for GET methods for safety
      if [[ $methods == *"GET"* ]]; then
        echo "curl -v https://$api_id.execute-api.$REGION.amazonaws.com/$ENVIRONMENT$path" >> "logs/$LOG_FILE"
      fi
    done
  fi
}

# Function to check DynamoDB tables
check_dynamodb_tables() {
  info "Checking DynamoDB tables..."
  
  local tables=(
    "$STACK_NAME-audit-logs"
    "$STACK_NAME-rate-limits"
  )
  
  for table in "${tables[@]}"; do
    info "Checking DynamoDB table: $table"
    
    # Check if table exists
    if ! trace_aws aws dynamodb describe-table --table-name "$table" --region $REGION &>/dev/null; then
      warn "DynamoDB table $table does not exist"
      continue
    fi
    
    # Get table info
    local table_info
    table_info=$(trace_aws aws dynamodb describe-table --table-name "$table" --region $REGION)
    
    # Check table status
    local status=$(echo "$table_info" | jq -r .Table.TableStatus)
    info "DynamoDB table $table status: $status"
    
    if [ "$status" != "ACTIVE" ]; then
      warn "DynamoDB table $table is not active (status: $status)"
    fi
    
    # Check provisioned throughput
    local read_capacity=$(echo "$table_info" | jq -r .Table.ProvisionedThroughput.ReadCapacityUnits)
    local write_capacity=$(echo "$table_info" | jq -r .Table.ProvisionedThroughput.WriteCapacityUnits)
    
    info "DynamoDB table $table capacity: Read=$read_capacity, Write=$write_capacity"
  done
}

# Function to check CloudWatch alarms and dashboards
check_cloudwatch() {
  info "Checking CloudWatch..."
  
  # Check dashboard
  local dashboard_name="$STACK_NAME-dashboard"
  info "Checking CloudWatch dashboard: $dashboard_name"
  
  if ! trace_aws aws cloudwatch get-dashboard --dashboard-name "$dashboard_name" --region $REGION &>/dev/null; then
    warn "CloudWatch dashboard $dashboard_name does not exist"
  else
    info "CloudWatch dashboard $dashboard_name exists"
  fi
  
  # Check alarms
  info "Checking CloudWatch alarms..."
  local alarms
  alarms=$(trace_aws aws cloudwatch describe-alarms --alarm-name-prefix "$STACK_NAME" --region $REGION)
  local alarm_count=$(echo "$alarms" | jq '.MetricAlarms | length')
  
  info "Found $alarm_count CloudWatch alarms for $STACK_NAME"
  
  # Check alarm states
  if [ $alarm_count -gt 0 ]; then
    local alarm_states=$(echo "$alarms" | jq -r '.MetricAlarms[] | .AlarmName + ": " + .StateValue')
    echo "$alarm_states" | while read -r alarm_state; do
      info "Alarm state: $alarm_state"
    done
  fi
}

# Function to create deployment report
create_deployment_report() {
  info "Creating deployment report..."
  
  local report_file="deployment-report-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S).md"
  
  # Create report header
  cat > "$report_file" << EOF
# Deployment Report: $ENVIRONMENT Environment

**Stack Name:** $STACK_NAME
**Region:** $REGION
**Generated:** $(date)
**Generated By:** $(whoami)

## Deployment Status

EOF
  
  # Add Lambda functions status
  cat >> "$report_file" << EOF
### Lambda Functions

| Function | Exists | Handler | Runtime | Memory | Timeout |
|----------|--------|---------|---------|--------|---------|
EOF
  
  local lambda_functions=(
    "make-call"
    "list-calls"
    "get-call-details"
    "update-call-status"
    "get-voice-options"
    "get-model-options"
  )
  
  for func in "${lambda_functions[@]}"; do
    local function_name="$STACK_NAME-$func"
    local exists="❌"
    local handler="N/A"
    local runtime="N/A"
    local memory="N/A"
    local timeout="N/A"
    
    if trace_aws aws lambda get-function --function-name "$function_name" --region $REGION &>/dev/null; then
      exists="✅"
      
      # Get configuration
      local config
      config=$(trace_aws aws lambda get-function-configuration --function-name "$function_name" --region $REGION)
      
      handler=$(echo "$config" | jq -r .Handler)
      runtime=$(echo "$config" | jq -r .Runtime)
      memory=$(echo "$config" | jq -r .MemorySize)
      timeout=$(echo "$config" | jq -r .Timeout)
    fi
    
    echo "| $func | $exists | $handler | $runtime | $memory | $timeout |" >> "$report_file"
  done
  
  # Add API Gateway status
  cat >> "$report_file" << EOF

### API Gateway

EOF
  
  local api_id
  api_id=$(trace_aws aws apigateway get-rest-apis --region $REGION --query "items[?name=='$SERVICE_PREFIX-$ENVIRONMENT-api'].id" --output text)
  
  if [ -z "$api_id" ]; then
    echo "❌ API Gateway not found for $ENVIRONMENT" >> "$report_file"
  else
    echo "✅ API Gateway found with ID: $api_id" >> "$report_file"
    echo "" >> "$report_file"
    echo "**API URL:** https://$api_id.execute-api.$REGION.amazonaws.com/$ENVIRONMENT" >> "$report_file"
    echo "" >> "$report_file"
    
    # Add resources
    echo "#### API Resources" >> "$report_file"
    echo "" >> "$report_file"
    
    echo "| Path | Methods |" >> "$report_file"
    echo "|------|---------|" >> "$report_file"
    
    local resources
    resources=$(trace_aws aws apigateway get-resources --rest-api-id "$api_id" --region $REGION)
    
    echo "$resources" | jq -r '.items[] | select(.resourceMethods != null) | [.path, (.resourceMethods | keys | join(", "))] | @tsv' | while IFS=$'\t' read -r path methods; do
      echo "| $path | $methods |" >> "$report_file"
    done
  fi
  
  # Add DynamoDB tables status
  cat >> "$report_file" << EOF

### DynamoDB Tables

| Table | Exists | Status | Read Capacity | Write Capacity |
|-------|--------|--------|--------------|----------------|
EOF
  
  local tables=(
    "$STACK_NAME-audit-logs"
    "$STACK_NAME-rate-limits"
  )
  
  for table in "${tables[@]}"; do
    local exists="❌"
    local status="N/A"
    local read_capacity="N/A"
    local write_capacity="N/A"
    
    if trace_aws aws dynamodb describe-table --table-name "$table" --region $REGION &>/dev/null; then
      exists="✅"
      
      # Get table info
      local table_info
      table_info=$(trace_aws aws dynamodb describe-table --table-name "$table" --region $REGION)
      
      status=$(echo "$table_info" | jq -r .Table.TableStatus)
      read_capacity=$(echo "$table_info" | jq -r .Table.ProvisionedThroughput.ReadCapacityUnits)
      write_capacity=$(echo "$table_info" | jq -r .Table.ProvisionedThroughput.WriteCapacityUnits)
    fi
    
    echo "| $table | $exists | $status | $read_capacity | $write_capacity |" >> "$report_file"
  done
  
  # Add CloudWatch status
  cat >> "$report_file" << EOF

### CloudWatch

#### Dashboard

EOF
  
  local dashboard_name="$STACK_NAME-dashboard"
  
  if trace_aws aws cloudwatch get-dashboard --dashboard-name "$dashboard_name" --region $REGION &>/dev/null; then
    echo "✅ CloudWatch dashboard exists: $dashboard_name" >> "$report_file"
    echo "" >> "$report_file"
    echo "**Dashboard URL:** https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=$dashboard_name" >> "$report_file"
  else
    echo "❌ CloudWatch dashboard does not exist: $dashboard_name" >> "$report_file"
  fi
  
  cat >> "$report_file" << EOF

#### Alarms

| Alarm | State |
|-------|-------|
EOF
  
  local alarms
  alarms=$(trace_aws aws cloudwatch describe-alarms --alarm-name-prefix "$STACK_NAME" --region $REGION)
  
  if [ "$(echo "$alarms" | jq '.MetricAlarms | length')" -gt 0 ]; then
    echo "$alarms" | jq -r '.MetricAlarms[] | [.AlarmName, .StateValue] | @tsv' | while IFS=$'\t' read -r name state; do
      echo "| $name | $state |" >> "$report_file"
    done
  else
    echo "| No alarms found | N/A |" >> "$report_file"
  fi
  
  # Add conclusion
  cat >> "$report_file" << EOF

## Deployment Issues

EOF
  
  # Extract warnings and errors from log file
  grep -E "WARN|ERROR|FATAL" "logs/$LOG_FILE" >> "$report_file" || echo "No issues detected during deployment" >> "$report_file"
  
  info "Deployment report created: $report_file"
}

# Main execution flow
info "Starting deployment monitoring for $ENVIRONMENT environment"
info "Logging to: logs/$LOG_FILE"
info "Tracing to: traces/$TRACE_FILE"

# Step 1: Check environment readiness
check_environment

# Step 2: Check AWS permissions
check_aws_permissions

# Step 3: Check AWS service health
check_aws_health

# Step 4: Monitor specific resources
info "Starting resource monitoring..."

# Lambda functions
lambda_functions=(
  "make-call"
  "list-calls"
  "get-call-details"
  "update-call-status"
  "get-voice-options"
  "get-model-options"
)

for func in "${lambda_functions[@]}"; do
  monitor_lambda_deployment "$STACK_NAME-$func"
done

# API Gateway
check_api_gateway

# DynamoDB
check_dynamodb_tables

# CloudWatch
check_cloudwatch

# Step 5: Create deployment report
create_deployment_report

info "Deployment monitoring completed for $ENVIRONMENT environment"
info "Log file: logs/$LOG_FILE"
info "Trace file: traces/$TRACE_FILE"
info "Run the following command to view logs: cat logs/$LOG_FILE" 