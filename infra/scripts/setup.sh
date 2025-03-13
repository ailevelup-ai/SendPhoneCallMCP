#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_DIR="$PROJECT_ROOT/infra/deployment"
TERRAFORM_DIR="$PROJECT_ROOT/infra/terraform"

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

function create_directories() {
  log_info "Creating necessary directories..."
  
  # Create deployment directory
  mkdir -p "$DEPLOYMENT_DIR"
  
  # Create terraform directories
  mkdir -p "$TERRAFORM_DIR"
  
  log_success "Directories created successfully."
}

function create_gitignore() {
  log_info "Creating .gitignore file for deployment assets..."
  
  # Create or append to .gitignore file
  if [ ! -f "$PROJECT_ROOT/.gitignore" ]; then
    touch "$PROJECT_ROOT/.gitignore"
  fi
  
  # Add deployment-specific patterns to .gitignore
  cat >> "$PROJECT_ROOT/.gitignore" << EOL

# Terraform
.terraform/
.terraform.lock.hcl
terraform.tfstate
terraform.tfstate.backup
tfplan
*.tfvars
!terraform.tfvars.example

# Deployment
infra/deployment/
EOL
  
  log_success ".gitignore updated for deployment assets."
}

function create_env_file() {
  log_info "Creating .env.deploy file for deployment configuration..."
  
  # Create .env.deploy file for storing deployment environment variables
  cat > "$PROJECT_ROOT/.env.deploy.example" << EOL
# AWS Configuration
export AWS_REGION=us-east-1
export AWS_VPC_ID=vpc-xxxxxxxx
export AWS_SUBNET_ID=subnet-xxxxxxxx
export AWS_KEY_NAME=your-key-pair-name

# Bland.AI Configuration
export BLAND_API_KEY=your-bland-api-key
export BLAND_DEFAULT_FROM_NUMBER=+15555555555
export BLAND_DEFAULT_VOICE=ai-morgan
export BLAND_DEFAULT_MODEL=gpt-4o
export BLAND_DEFAULT_TEMPERATURE=0.7
export BLAND_DEFAULT_VOICEMAIL_ACTION=continue
export BLAND_ANSWERED_BY_ENABLED=true

# Supabase Configuration
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-supabase-service-key
export SUPABASE_ANON_KEY=your-supabase-anon-key

# Google Sheets Configuration
export GOOGLE_SHEETS_DOC_ID=your-google-sheets-doc-id
export GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@google.com
export GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"

# JWT Configuration
export JWT_SECRET=your-jwt-secret

# Instance Configuration
export EC2_INSTANCE_TYPE=t3.small
export LAMBDA_MEMORY_SIZE=256
export LAMBDA_TIMEOUT=300
EOL
  
  log_success ".env.deploy.example file created. Copy this to .env.deploy and fill in your values."
}

function set_permissions() {
  log_info "Setting execution permissions for scripts..."
  
  # Make scripts executable
  chmod +x "$SCRIPT_DIR/deploy.sh"
  
  log_success "Script permissions set."
}

function display_next_steps() {
  echo ""
  echo "======================================"
  echo "           SETUP COMPLETE            "
  echo "======================================"
  echo ""
  echo "Next steps:"
  echo "1. Copy .env.deploy.example to .env.deploy and fill in your values:"
  echo "   cp $PROJECT_ROOT/.env.deploy.example $PROJECT_ROOT/.env.deploy"
  echo ""
  echo "2. Update the environment variables in .env.deploy with your configuration"
  echo ""
  echo "3. Run the deployment script to deploy the infrastructure:"
  echo "   $SCRIPT_DIR/deploy.sh [environment]"
  echo ""
  echo "Supported environments: dev, staging, prod"
  echo "Default environment: dev"
  echo "======================================"
  echo ""
}

# Main script execution
echo "======================================"
echo "   BLAND.AI MCP SETUP SCRIPT         "
echo "======================================"

# Execute setup steps
create_directories
create_gitignore
create_env_file
set_permissions
display_next_steps

log_success "Setup completed successfully!"
exit 0 