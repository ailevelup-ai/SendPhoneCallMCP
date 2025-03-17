#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}       AILevelUp Phone Call MCP - Test Suite           ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""

# Setup test environment
echo -e "${YELLOW}Setting up test environment...${NC}"
# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm install
fi

# Function to run a test and track result
run_test() {
  TEST_NAME=$1
  TEST_CMD=$2
  
  echo ""
  echo -e "${BLUE}Running ${TEST_NAME}...${NC}"
  echo -e "${BLUE}========================================================${NC}"
  
  if $TEST_CMD; then
    echo -e "${GREEN}✅ ${TEST_NAME} - PASSED${NC}"
    return 0
  else
    echo -e "${RED}❌ ${TEST_NAME} - FAILED${NC}"
    return 1
  fi
}

# Track overall results
PASSED=0
FAILED=0
TOTAL=0

# Get API URL from environment or use default
API_URL=${API_URL:-"https://ql3w5ogpvb.execute-api.us-east-1.amazonaws.com/dev"}
TEST_PHONE_NUMBER=${TEST_PHONE_NUMBER:-"+15555555555"}

echo -e "${YELLOW}Using API URL: ${API_URL}${NC}"
echo -e "${YELLOW}Using Test Phone Number: ${TEST_PHONE_NUMBER}${NC}"

# Export for Node.js test scripts
export API_URL
export TEST_PHONE_NUMBER

# Run Lambda function unit tests
if run_test "Lambda Function Unit Tests" "npm run test:lambda"; then
  PASSED=$((PASSED+1))
else
  FAILED=$((FAILED+1))
fi
TOTAL=$((TOTAL+1))

# Run API integration tests
if run_test "API Integration Tests" "npm run test:api"; then
  PASSED=$((PASSED+1))
else
  FAILED=$((FAILED+1))
fi
TOTAL=$((TOTAL+1))

# Print summary
echo ""
echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}                    Test Summary                       ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo -e "Total Tests Run: ${TOTAL}"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Success Rate: $(( (PASSED * 100) / TOTAL ))%"

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed successfully!${NC}"
  exit 0
fi 