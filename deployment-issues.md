# Deployment Issues and Solutions

## Current Issues

We've identified several issues that need to be addressed before we can successfully deploy to the staging environment:

### 1. AWS CLI Binary Issue

**Problem**: The AWS CLI binary at `/usr/local/bin/aws` cannot be executed. This is causing all AWS commands to fail with the error message:
```
/usr/local/bin/aws: cannot execute binary file
```

**Possible Causes**:
- The AWS CLI may be installed for a different architecture than the current system
- The binary file might be corrupted
- The file permissions might be incorrect

**Solution**:
1. Reinstall the AWS CLI using the appropriate installer for your system:
   ```bash
   # For macOS (arm64/Apple Silicon):
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   
   # For macOS (x86_64/Intel):
   curl "https://awscli.amazonaws.com/AWSCLIV2-intel.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   ```

2. After installation, verify it works:
   ```bash
   aws --version
   ```

3. Configure AWS credentials:
   ```bash
   aws configure
   ```

### 2. API Gateway Missing

**Problem**: The API Gateway with name `ailevelup-phone-call-mcp-staging-api` does not exist.

**Solution**:
1. Use the `create-api-gateway.js` script (after fixing the AWS CLI):
   ```bash
   node create-api-gateway.js staging us-east-1
   ```

### 3. Lambda Function Handler Issues

**Problem**: The Lambda function handlers are not configured correctly, as seen in the syntax error in `tools/update-lambda-handlers.js`.

**Solution**:
1. We've fixed the syntax error in the script, but we need to implement a centralized handler approach:
   ```bash
   # Create an index.js file that imports and exports all Lambda handlers
   node tools/update-lambda-handlers.js staging us-east-1
   ```

## General Deployment Process (After Fixing Issues)

Once the issues above are resolved, follow this process for deployment:

1. Verify the environment is ready:
   ```bash
   node check-environment.js staging us-east-1
   ```

2. If the API Gateway doesn't exist, create it:
   ```bash
   node create-api-gateway.js staging us-east-1
   ```

3. Deploy to the staging environment:
   ```bash
   ./deploy-to-staging.sh
   ```

4. Verify the deployment:
   ```bash
   # Check Lambda functions
   aws lambda list-functions --region us-east-1 --query "Functions[?starts_with(FunctionName, 'ailevelup-phone-call-mcp-staging')].[FunctionName]" --output table
   
   # Check API Gateway
   aws apigateway get-rest-apis --region us-east-1 --query "items[?name=='ailevelup-phone-call-mcp-staging-api']" --output table
   ```

## Alternative Deployment Approach

If reinstalling the AWS CLI is not feasible, consider using Docker for deployment:

1. Create a Dockerfile:
   ```dockerfile
   FROM amazon/aws-cli:latest
   
   WORKDIR /app
   
   # Copy deployment scripts and code
   COPY . .
   
   # Install Node.js
   RUN yum update -y && \
       yum install -y nodejs npm
   
   # Make scripts executable
   RUN chmod +x *.sh tools/*.js
   
   # Entry point
   ENTRYPOINT ["/bin/bash"]
   ```

2. Build and run the Docker container:
   ```bash
   docker build -t ailevelup-deployment .
   docker run -it --rm \
     -v ~/.aws:/root/.aws \
     ailevelup-deployment
   ```

3. Run the deployment scripts within the container:
   ```bash
   ./deploy-to-staging.sh
   ```

## Recommended Next Steps

1. Fix the AWS CLI installation issue
2. Create the API Gateway using the script
3. Update Lambda handlers to use the centralized approach
4. Deploy to staging
5. Verify all components are working correctly
6. Fix any remaining issues
7. Update `migration-errors.md` with your progress 