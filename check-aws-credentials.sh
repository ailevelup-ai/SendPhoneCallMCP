#!/bin/bash
set -e

echo "==== AWS Credentials Test ===="

# Check AWS CLI version
echo "AWS CLI Version:"
aws --version

# Check AWS credentials
echo -e "\nChecking AWS identity..."
aws sts get-caller-identity

# Check AWS Lambda functions
echo -e "\nChecking Lambda functions in us-east-1..."
aws lambda list-functions --region us-east-1 --query "Functions[?contains(FunctionName, 'ailevelup-phone-call-mcp')].FunctionName" --output text

# Create a test file for AWS S3 (as a test)
echo "This is a test file" > aws-test.txt

# Test AWS S3 access (create a temporary bucket if needed)
echo -e "\nTesting AWS S3 access..."
TEST_BUCKET="ailevelup-mcp-test-$(date +%s)"
aws s3 mb "s3://${TEST_BUCKET}" --region us-east-1 || echo "Could not create bucket"
if aws s3 ls "s3://${TEST_BUCKET}" &>/dev/null; then
  aws s3 cp aws-test.txt "s3://${TEST_BUCKET}/"
  aws s3 ls "s3://${TEST_BUCKET}"
  aws s3 rm "s3://${TEST_BUCKET}/aws-test.txt"
  aws s3 rb "s3://${TEST_BUCKET}"
  echo "S3 operations succeeded!"
else
  echo "S3 operations failed!"
fi

# Remove test file
rm aws-test.txt

echo -e "\nCredentials verification complete!"

# Check if we need to refresh credentials
echo -e "\nTo refresh AWS credentials:"
echo "1. Make sure AWS CLI is configured with 'aws configure'"
echo "2. Or try refreshing with 'aws sso login' if using SSO"
echo "3. Or update ~/.aws/credentials file with valid keys" 