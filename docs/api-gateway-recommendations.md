# API Gateway Integration Recommendations

This document outlines recommendations for resolving the API Gateway integration issues in the AilevelUp Phone Call MCP service.

## Current Issues

We've encountered 502 Internal Server Error responses when testing our API Gateway endpoints that integrate with Lambda functions. This typically indicates that API Gateway successfully forwarded the request to the Lambda function, but there was a problem with the Lambda execution or the integration.

## Root Cause Analysis

The 502 errors can be caused by several potential issues:

1. **Lambda Handler Configuration**: Incorrect handler configuration prevents Lambda from finding the entry point
2. **Lambda Execution Errors**: Unhandled exceptions in the Lambda code
3. **Lambda Permissions**: Insufficient permissions for API Gateway to invoke Lambda functions
4. **Timeout Issues**: Lambda execution timeout before response is returned
5. **Response Format**: Incorrectly formatted Lambda responses

## Recommended Solutions

### 1. Fix Lambda Handler Configuration

With the implementation of the centralized `index.js` handler approach, we've addressed handler configuration issues. Now ensure API Gateway is correctly configured to use these new handlers.

#### Actions:
- Update API Gateway integration to call the Lambda function with the correct handler
- Verify handler configuration using AWS CLI:
  ```bash
  aws lambda get-function --function-name ailevelup-phone-call-mcp-dev-get-model-options --query 'Configuration.Handler'
  ```
- Expected result: `"index.getModelOptions"`

### 2. Implement Proper Error Handling

Ensure Lambda functions properly handle exceptions and return correctly formatted responses.

#### Implementation Example:
```javascript
exports.handler = async (event) => {
  try {
    // Function logic here
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'  // For CORS support
      },
      body: JSON.stringify({ 
        success: true,
        data: result
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};
```

### 3. Check Lambda Permissions

Verify that API Gateway has permission to invoke the Lambda functions.

#### Actions:
- Create a resource-based policy for Lambda that allows API Gateway to invoke it:
  ```bash
  aws lambda add-permission \
    --function-name ailevelup-phone-call-mcp-dev-get-model-options \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:us-east-1:ACCOUNT_ID:API_ID/*/GET/models"
  ```
- Replace `ACCOUNT_ID` with your AWS account ID and `API_ID` with your API Gateway ID

### 4. Debug with CloudWatch Logs

Use CloudWatch Logs to identify the specific errors occurring in Lambda functions.

#### Actions:
- Check CloudWatch Logs for each Lambda function:
  ```bash
  aws logs filter-log-events \
    --log-group-name /aws/lambda/ailevelup-phone-call-mcp-dev-get-model-options \
    --start-time $(date -v-1d +%s)000 \
    --filter-pattern "ERROR"
  ```
- Look for error messages or exceptions that might explain the 502 responses

### 5. Test Lambda Functions Directly

Isolate issues by testing Lambda functions directly, bypassing API Gateway.

#### Actions:
- Invoke Lambda functions directly with test events:
  ```bash
  aws lambda invoke \
    --function-name ailevelup-phone-call-mcp-dev-get-model-options \
    --payload '{"resource":"/models","path":"/models","httpMethod":"GET"}' \
    response.json
  ```
- Examine the response to verify the function works correctly in isolation

## Recommended API Gateway Configuration

### Using Proxy Integration

For simplicity and consistency, use Lambda Proxy Integration for all endpoints. This passes the complete request to Lambda and allows the Lambda function to control the response format.

#### API Gateway Configuration:
1. Select the Lambda Proxy integration option
2. Set the Lambda Function to the correct ARN
3. Enable CORS if needed
4. Deploy the API to the appropriate stage

### Sample Serverless Framework Configuration

```yaml
functions:
  getModelOptions:
    handler: index.getModelOptions
    events:
      - http:
          path: /models
          method: get
          cors: true
  
  getVoiceOptions:
    handler: index.getVoiceOptions
    events:
      - http:
          path: /voices
          method: get
          cors: true
  
  makeCall:
    handler: index.makeCall
    events:
      - http:
          path: /call
          method: post
          cors: true
```

## Implementation Plan

1. Update Lambda functions with proper error handling
2. Verify Lambda permissions for API Gateway invocation
3. Update API Gateway integration to use Lambda Proxy integration
4. Test each endpoint individually
5. Review CloudWatch Logs for any remaining issues

## Monitoring and Verification

After implementing these changes:

1. Set up CloudWatch Alarms for API Gateway 4xx and 5xx errors
2. Create automated tests for each API endpoint
3. Establish a monitoring dashboard to track API Gateway and Lambda metrics
4. Document the successful resolution in the migration progress documentation 