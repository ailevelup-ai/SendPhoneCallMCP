#!/bin/bash

# Enhanced Production Deployment Script with Debugging
# This script runs the production deployment with additional debugging and safeguards

set -e  # Exit on error

echo "===================================================================="
echo "⚠️  ENHANCED PRODUCTION DEPLOYMENT WITH DEBUGGING ⚠️"
echo "===================================================================="

# Create log directory
mkdir -p logs

# Set log file
LOG_FILE="logs/production-deployment-$(date +%Y%m%d%H%M%S).log"
ERROR_LOG_FILE="logs/production-deployment-errors-$(date +%Y%m%d%H%M%S).log"

# Function to log messages
log() {
  local message="$1"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $message" | tee -a "$LOG_FILE"
}

# Function to log errors
log_error() {
  local message="$1"
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] ERROR: $message" | tee -a "$LOG_FILE" | tee -a "$ERROR_LOG_FILE"
}

# Function to capture command output with logging
run_with_logging() {
  local cmd="$@"
  local start_time=$(date +%s)
  
  log "EXECUTING: $cmd"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  # Execute the command and capture both stdout and stderr
  set +e  # Temporarily disable exit on error
  output=$("$@" 2>&1)
  exit_code=$?
  set -e  # Re-enable exit on error
  
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))
  
  echo "$output" | tee -a "$LOG_FILE"
  echo "----------------------------------------" | tee -a "$LOG_FILE"
  
  if [ $exit_code -eq 0 ]; then
    log "COMMAND SUCCEEDED in ${duration}s: $cmd"
  else
    log_error "COMMAND FAILED in ${duration}s (exit code: $exit_code): $cmd"
    echo "----------------------------------------" | tee -a "$ERROR_LOG_FILE"
    echo "$output" | tee -a "$ERROR_LOG_FILE"
    echo "----------------------------------------" | tee -a "$ERROR_LOG_FILE"
  fi
  
  return $exit_code
}

# Ensure we have all required tools
log "Checking for required tools..."

for tool in aws jq zip uuidgen grep sed; do
  if ! command -v $tool &>/dev/null; then
    log_error "Required tool not found: $tool"
    exit 1
  else
    log "Found required tool: $tool"
  fi
done

# Check for required files
log "Checking for required files..."

# Check for shell script utilities
for script in create-api-gateway-shell.sh deploy-to-production.sh deployment-monitor.sh; do
  if [ ! -f "$script" ]; then
    log_error "Required script not found: $script"
    exit 1
  else
    log "Found required script: $script"
    
    # Ensure script is executable
    if [ ! -x "$script" ]; then
      log "Making script executable: $script"
      chmod +x "$script"
    fi
  fi
done

# Check for environment file
if [ ! -f ".env.production" ]; then
  log_error "Required environment file not found: .env.production"
  exit 1
else
  log "Found environment file: .env.production"
fi

# Check for functions directory
if [ ! -d "functions" ]; then
  log_error "Required directory not found: functions"
  exit 1
else
  log "Found functions directory"
  
  # Check for key files in functions directory
  if [ ! -f "functions/index.js" ]; then
    log_error "Lambda handler file not found: functions/index.js"
    exit 1
  else
    log "Found Lambda handler file: functions/index.js"
  fi
  
  # Count Lambda function files
  lambda_count=$(ls functions/*.js 2>/dev/null | grep -v index.js | wc -l)
  log "Found $lambda_count Lambda function files"
  
  if [ $lambda_count -eq 0 ]; then
    log_error "No Lambda function files found in functions directory"
    exit 1
  fi
fi

# Check for utils directory
if [ ! -d "utils" ]; then
  log_error "Required directory not found: utils"
  exit 1
else
  log "Found utils directory"
fi

# Check AWS configuration
log "Checking AWS configuration..."

if ! run_with_logging aws sts get-caller-identity; then
  log_error "AWS credentials not configured properly"
  log "Please run 'aws configure' to set up your AWS credentials"
  exit 1
fi

# Get account ID for reference
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
log "AWS Account ID: $ACCOUNT_ID"

# Check if we need to run the pre-deployment checks
read -p "Do you want to run pre-deployment checks? (recommended) (yes/no): " run_checks
if [[ "$run_checks" == "yes" ]]; then
  log "Running pre-deployment checks..."
  if ! run_with_logging ./deployment-monitor.sh production DEBUG; then
    log_error "Pre-deployment checks failed"
    log "Review the logs and fix any issues before proceeding"
    
    read -p "Continue despite pre-deployment check failures? (yes/no): " continue_anyway
    if [[ "$continue_anyway" != "yes" ]]; then
      log "Deployment aborted due to pre-deployment check failures"
      exit 1
    else
      log "Continuing deployment despite pre-deployment check failures..."
    fi
  else
    log "Pre-deployment checks passed"
  fi
else
  log "Skipping pre-deployment checks"
fi

# Create tracing functions to debug AWS CLI calls
trace_aws_calls() {
  # Backup the real aws command
  if [ ! -f /tmp/aws.real ]; then
    log "Setting up AWS CLI tracing..."
    which aws > /tmp/aws.real
    
    # Create a wrapper script
    cat > /tmp/aws.wrapper << 'EOF'
#!/bin/bash
REAL_AWS=$(cat /tmp/aws.real)
LOG_FILE="logs/aws-cli-trace-$(date +%Y%m%d).log"

# Log the command
echo "[$(date +"%Y-%m-%d %H:%M:%S")] COMMAND: aws $@" >> "$LOG_FILE"

# Run the real command
"$REAL_AWS" "$@"
EXIT_CODE=$?

# Log the exit code
echo "[$(date +"%Y-%m-%d %H:%M:%S")] EXIT CODE: $EXIT_CODE" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

exit $EXIT_CODE
EOF
    
    chmod +x /tmp/aws.wrapper
    
    # Create an alias for the aws command that uses our wrapper
    alias aws="/tmp/aws.wrapper"
    log "AWS CLI tracing enabled"
  else
    log "AWS CLI tracing already enabled"
  fi
}

disable_aws_tracing() {
  if [ -f /tmp/aws.real ]; then
    log "Disabling AWS CLI tracing..."
    unalias aws
    rm -f /tmp/aws.wrapper /tmp/aws.real
    log "AWS CLI tracing disabled"
  fi
}

# Enable AWS CLI tracing
trace_aws_calls

# Additional safeguards for production
log "Running deployment with enhanced logging and error tracking..."

# Run the deployment script with input redirection to automatically answer the confirmation prompt
log "Starting production deployment with automatic confirmation..."
echo "yes" | run_with_logging ./deploy-to-production.sh

# Capture the exit code
DEPLOY_EXIT_CODE=$?

# Disable AWS CLI tracing
disable_aws_tracing

# Check if deployment was successful
if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
  log "Production deployment completed successfully!"
  
  # Run post-deployment checks
  log "Running post-deployment verification..."
  if run_with_logging ./deployment-monitor.sh production DEBUG; then
    log "Post-deployment verification passed"
  else
    log_error "Post-deployment verification detected issues"
    log "Please review the logs and take appropriate actions"
  fi
  
  # Update migration plan
  if [ -f "migration-plan.md" ]; then
    log "Updating migration plan..."
    CURRENT_DATE=$(date +"%Y-%m-%d")
    sed -i.bak "s/⏳ Deployment to production environment - In Progress/✅ Deployment to production environment - Completed on ${CURRENT_DATE}/g" migration-plan.md
    rm -f migration-plan.md.bak
    log "Migration plan updated"
  fi
  
  # Provide success summary
  echo "===================================================================="
  echo "✅ PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY"
  echo "===================================================================="
  echo "Deployment logs: $LOG_FILE"
  if [ -f "api-details-production.json" ]; then
    echo "API Gateway URL: $(cat api-details-production.json | jq -r .url)"
  fi
  echo "===================================================================="
else
  log_error "Production deployment failed with exit code: $DEPLOY_EXIT_CODE"
  
  # Run diagnostic checks
  log "Running deployment diagnostics..."
  run_with_logging ./deployment-monitor.sh production DEBUG
  
  # Check CloudWatch logs for errors in Lambda functions
  log "Checking CloudWatch logs for errors..."
  SERVICE_PREFIX="ailevelup-phone-call-mcp"
  STACK_NAME="${SERVICE_PREFIX}-production"
  
  LAMBDA_FUNCTIONS=(
    "make-call"
    "list-calls"
    "get-call-details"
    "update-call-status"
    "get-voice-options"
    "get-model-options"
  )
  
  for func in "${LAMBDA_FUNCTIONS[@]}"; do
    func_name="${STACK_NAME}-${func}"
    log "Checking logs for Lambda function: $func_name"
    
    # Check if the function exists
    if aws lambda get-function --function-name "$func_name" --region us-east-1 &>/dev/null; then
      # Get the latest log stream
      log_group="/aws/lambda/$func_name"
      latest_stream=$(aws logs describe-log-streams --log-group-name "$log_group" --order-by LastEventTime --descending --max-items 1 --region us-east-1 --query 'logStreams[0].logStreamName' --output text)
      
      if [ "$latest_stream" != "None" ] && [ -n "$latest_stream" ]; then
        # Get the log events
        log "Most recent logs for $func_name:"
        aws logs get-log-events --log-group-name "$log_group" --log-stream-name "$latest_stream" --limit 20 --region us-east-1 --query 'events[].message' --output text | tee -a "$ERROR_LOG_FILE"
      else
        log "No log streams found for $func_name"
      fi
    else
      log "Lambda function $func_name does not exist"
    fi
  done
  
  # Provide failure summary
  echo "===================================================================="
  echo "❌ PRODUCTION DEPLOYMENT FAILED"
  echo "===================================================================="
  echo "Deployment logs: $LOG_FILE"
  echo "Error logs: $ERROR_LOG_FILE"
  echo "Please fix the issues and retry deployment"
  echo "===================================================================="
  
  exit $DEPLOY_EXIT_CODE
fi 