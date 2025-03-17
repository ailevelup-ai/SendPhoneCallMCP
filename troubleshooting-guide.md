# Lambda Handler Troubleshooting Guide

This guide provides steps to troubleshoot and resolve the Lambda function handler issues we're experiencing with our AWS deployment.

## Current Issue

The Lambda function for `get-model-options` is failing with the error:

```
Error: Cannot find module 'get-model-options'
```

This indicates that the Lambda runtime cannot locate the module referenced in the handler configuration.

## Understanding Lambda Handler Configuration

The AWS Lambda handler configuration follows this format:

```
[file_name].[export]
```

For example, if your JavaScript file is named `my-function.js` and exports a function called `handler`, your handler configuration would be:

```
my-function.handler
```

If the file is within a directory structure, you need to adjust the handler path accordingly but **without the .js extension**.

## Troubleshooting Steps

### 1. Check the Deployment Package Structure

First, let's examine the deployment package to confirm the file structure:

```bash
# Unzip the deployment package to a temporary directory
mkdir -p /tmp/lambda-debug
unzip -l dist/functions.zip

# Verify the path to the get-model-options.js file
unzip -l dist/functions.zip | grep model-options
```

If the file is located at `functions/get-model-options.js`, the correct handler would be `functions/get-model-options.handler`.

### 2. Check the Lambda Function Configuration

Verify the current handler configuration:

```bash
aws lambda get-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --query "Handler" --output text
```

### 3. Try Different Handler Configurations

If the handler is incorrect, try these variations:

```bash
# Option 1: Direct reference to file
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --handler get-model-options.handler

# Option 2: Including the directory path
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --handler functions/get-model-options.handler

# Option 3: Using index.js as an entry point (if you create one)
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --handler index.handler
```

### 4. Create an index.js Entry Point

Another approach is to create an `index.js` file in the deployment package that imports and re-exports the handler:

```javascript
// index.js
const getModelOptions = require('./functions/get-model-options');
exports.handler = getModelOptions.handler;
```

Then update the Lambda function configuration:

```bash
aws lambda update-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --handler index.handler
```

### 5. Check Lambda Runtime Compatibility

Ensure the Lambda runtime is compatible with your code:

```bash
aws lambda get-function-configuration \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --query "Runtime" --output text
```

Our code is using Node.js 18.x in the serverless.yml, but the Lambda might be configured with a different runtime.

### 6. Review Deployment Script

Examine the deployment script that creates or updates the Lambda function:

```bash
cat deploy-lambda-functions-verbose.sh | grep -A 10 handler
```

Check how the handler is set during the Lambda function creation and update.

### 7. Test Lambda Function Directly

After making changes, test the Lambda function directly:

```bash
aws lambda invoke \
  --function-name ailevelup-phone-call-mcp-dev-get-model-options \
  --payload '{}' response.json

# Check the response
cat response.json
```

## Recommended Solution

Based on the error message and our current structure, the most likely solution is:

1. Create an `index.js` file in the deployment package that re-exports the handlers
2. Update all Lambda function configurations to use `index.handler` instead of separate handlers
3. Update the deployment scripts to reflect this change

## Prevention for Future Deployments

1. Standardize on a single approach for Lambda function deployment
2. Use the Serverless Framework exclusively for more reliable handler configuration
3. Include automated tests in the deployment process to catch handler configuration issues
4. Document the Lambda function structure and handler naming convention 