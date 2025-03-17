#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================================${NC}"
echo -e "${GREEN}       LAMBDA LAYERS FIXER FOR AILEVELUP MCP           ${NC}"
echo -e "${GREEN}=======================================================${NC}"

# Environment and region
ENVIRONMENT=${1:-staging}
REGION=${2:-us-east-1}

if [ -z "$ENVIRONMENT" ] || [ -z "$REGION" ]; then
  echo -e "${YELLOW}Usage: $0 <environment> <region>${NC}"
  echo -e "${YELLOW}Example: $0 staging us-east-1${NC}"
  echo -e "${YELLOW}Proceeding with default: ${ENVIRONMENT} in ${REGION}${NC}"
fi

echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}Region: ${REGION}${NC}"

# Make scripts executable
chmod +x deploy-lambda-layer.sh
chmod +x update-lambda-functions.sh

# Step 1: Deploy the Lambda Layer
echo -e "\n${YELLOW}Step 1: Deploying Lambda Layer...${NC}"
./deploy-lambda-layer.sh "${ENVIRONMENT}" "${REGION}"

if [ $? -ne 0 ]; then
  echo -e "${RED}Error deploying Lambda Layer. Exiting.${NC}"
  exit 1
fi

# Step 2: Update Lambda Functions
echo -e "\n${YELLOW}Step 2: Updating Lambda Functions...${NC}"
./update-lambda-functions.sh "${ENVIRONMENT}" "${REGION}"

if [ $? -ne 0 ]; then
  echo -e "${RED}Error updating Lambda Functions. Exiting.${NC}"
  exit 1
fi

echo -e "\n${GREEN}=======================================================${NC}"
echo -e "${GREEN}       LAMBDA LAYERS FIXED SUCCESSFULLY!                ${NC}"
echo -e "${GREEN}=======================================================${NC}"

echo -e "\n${YELLOW}Now you can test the Lambda function with:${NC}"
echo -e "node test-aws-lambda-call.js"
exit 0 