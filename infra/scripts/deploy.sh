#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/infra/deployment"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"
ENV=${1:-dev}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
function log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

function log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

function log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

function log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

function check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check for Node.js
  if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js and try again."
    exit 1
  fi
  
  # Check for npm
  if ! command -v npm &> /dev/null; then
    log_error "npm is not installed. Please install npm and try again."
    exit 1
  fi
  
  # Check for Terraform
  if ! command -v terraform &> /dev/null; then
    log_error "Terraform is not installed. Please install Terraform and try again."
    exit 1
  }
  
  # Check for AWS CLI
  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install AWS CLI and try again."
    exit 1
  fi
  
  # Check AWS credentials
  if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials are not configured. Please configure AWS credentials and try again."
    exit 1
  fi
  
  log_success "All prerequisites are installed."
}

function prepare_lambda() {
  log_info "Preparing Lambda function deployment package..."
  
  # Create deployment directory if it doesn't exist
  mkdir -p "$DEPLOYMENT_DIR"
  
  # Create a temporary directory for packaging
  TEMP_DIR="$(mktemp -d)"
  
  # Copy Lambda function files
  cp "$PROJECT_ROOT/lambda-call-updater.js" "$TEMP_DIR/"
  cp "$PROJECT_ROOT/utils/logger.js" "$TEMP_DIR/utils/"
  cp "$PROJECT_ROOT/utils/rate-limiter.js" "$TEMP_DIR/utils/"
  cp "$PROJECT_ROOT/google-sheets-logging.js" "$TEMP_DIR/"
  cp "$PROJECT_ROOT/db.js" "$TEMP_DIR/"
  cp "$PROJECT_ROOT/package.json" "$TEMP_DIR/"
  cp "$PROJECT_ROOT/package-lock.json" "$TEMP_DIR/"
  
  # Install production dependencies
  (cd "$TEMP_DIR" && npm ci --production)
  
  # Create Lambda zip package
  (cd "$TEMP_DIR" && zip -r "$DEPLOYMENT_DIR/lambda-call-updater.zip" .)
  
  # Clean up
  rm -rf "$TEMP_DIR"
  
  log_success "Lambda deployment package created at $DEPLOYMENT_DIR/lambda-call-updater.zip"
}

function deploy_terraform() {
  log_info "Deploying infrastructure with Terraform for environment: $ENV..."
  
  # Initialize Terraform
  (cd "$TERRAFORM_DIR" && terraform init)
  
  # Create tfvars file from environment variables or prompt for values
  if [ ! -f "$TERRAFORM_DIR/terraform.tfvars" ]; then
    log_warning "terraform.tfvars file not found. Creating from template..."
    
    cat > "$TERRAFORM_DIR/terraform.tfvars" << EOL
# Environment
environment = "$ENV"

# AWS Configuration
aws_region = "${AWS_REGION:-us-east-1}"
vpc_id = "${AWS_VPC_ID}"
subnet_id = "${AWS_SUBNET_ID}"
key_name = "${AWS_KEY_NAME}"

# Bland.AI Configuration
bland_api_key = "${BLAND_API_KEY}"
bland_default_from_number = "${BLAND_DEFAULT_FROM_NUMBER}"
bland_default_voice = "${BLAND_DEFAULT_VOICE:-ai-morgan}"
bland_default_model = "${BLAND_DEFAULT_MODEL:-gpt-4o}"
bland_default_temperature = "${BLAND_DEFAULT_TEMPERATURE:-0.7}"
bland_default_voicemail_action = "${BLAND_DEFAULT_VOICEMAIL_ACTION:-continue}"
bland_answered_by_enabled = "${BLAND_ANSWERED_BY_ENABLED:-true}"

# Supabase Configuration
supabase_url = "${SUPABASE_URL}"
supabase_service_key = "${SUPABASE_SERVICE_KEY}"
supabase_anon_key = "${SUPABASE_ANON_KEY}"

# Google Sheets Configuration
google_sheets_doc_id = "${GOOGLE_SHEETS_DOC_ID}"
google_sheets_client_email = "${GOOGLE_SHEETS_CLIENT_EMAIL}"
google_sheets_private_key = "${GOOGLE_SHEETS_PRIVATE_KEY}"

# JWT Configuration
jwt_secret = "${JWT_SECRET}"

# Instance Configuration
ec2_instance_type = "${EC2_INSTANCE_TYPE:-t3.small}"
lambda_memory_size = "${LAMBDA_MEMORY_SIZE:-256}"
lambda_timeout = "${LAMBDA_TIMEOUT:-300}"
EOL
    
    log_warning "Please review and update the terraform.tfvars file with your configuration values."
    read -p "Press enter to continue after updating the file..."
  fi
  
  # Plan Terraform changes
  (cd "$TERRAFORM_DIR" && terraform plan -var-file=terraform.tfvars -out=tfplan)
  
  # Apply Terraform changes
  read -p "Do you want to apply these changes? (y/n) " confirm
  if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
    (cd "$TERRAFORM_DIR" && terraform apply tfplan)
    log_success "Infrastructure deployed successfully!"
  else
    log_info "Deployment canceled by user."
  fi
}

function display_outputs() {
  log_info "Retrieving deployment outputs..."
  
  # Get outputs from Terraform
  APP_URL=$(cd "$TERRAFORM_DIR" && terraform output -raw app_url)
  INSTANCE_IP=$(cd "$TERRAFORM_DIR" && terraform output -raw instance_ip)
  LAMBDA_ARN=$(cd "$TERRAFORM_DIR" && terraform output -raw lambda_arn)
  
  # Display outputs
  echo ""
  echo "======================================"
  echo "      DEPLOYMENT INFORMATION          "
  echo "======================================"
  echo "Environment: $ENV"
  echo "Application URL: $APP_URL"
  echo "Server IP: $INSTANCE_IP"
  echo "Lambda ARN: $LAMBDA_ARN"
  echo "======================================"
  echo ""
  
  log_success "Deployment completed successfully!"
}

# Main script execution
echo "======================================"
echo "   BLAND.AI MCP DEPLOYMENT SCRIPT    "
echo "======================================"
echo "Environment: $ENV"
echo "======================================"

# Execute deployment steps
check_prerequisites
prepare_lambda
deploy_terraform
display_outputs

exit 0 