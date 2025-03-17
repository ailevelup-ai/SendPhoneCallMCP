# AWS Deployment Recommendations

Based on our experience migrating the AilevelUp Phone Call MCP service to AWS, here are recommendations to improve the deployment process and avoid common issues.

## Standardize on a Single Deployment Approach

### Current Situation
We currently have multiple deployment approaches:
- Custom AWS CLI scripts (`deploy-lambda-functions.sh`, `aws-lambda-deploy.sh`)
- Serverless Framework configuration (`serverless.yml`)
- Combined approach in the comprehensive script (`deploy-all.sh`)

### Recommendation
Standardize on using the Serverless Framework as the primary deployment method for the following reasons:
- **Consistent Configuration**: Unified configuration in a single `serverless.yml` file
- **Default Best Practices**: Automatically handles Lambda handler paths correctly
- **Resource Management**: Automatically creates/updates all related resources (API Gateway, IAM, etc.)
- **Environment Support**: Built-in support for different environments via stages
- **Plugin Ecosystem**: Extensive plugin ecosystem for additional functionality

### Action Items
1. Migrate all custom deployment scripts to Serverless Framework commands
2. Update the `serverless.yml` file to include all resources and configurations
3. Create stage-specific configurations for dev, staging, and production
4. Train team members on Serverless Framework concepts and commands

## Lambda Function Structure and Handler Configuration

### Current Situation
We're encountering issues with Lambda function handlers, particularly with the module resolution path.

### Recommendation
Implement a standardized Lambda function structure:

```
project/
├── index.js               # Main entry point that re-exports all handlers
├── functions/
│   ├── make-call.js       # Individual function implementations
│   ├── get-call-details.js
│   └── get-model-options.js
└── serverless.yml         # Serverless Framework configuration
```

Use `index.js` as the central entry point:

```javascript
// index.js
module.exports = {
  makeCall: require('./functions/make-call').handler,
  getCallDetails: require('./functions/get-call-details').handler,
  listCalls: require('./functions/list-calls').handler,
  updateCallStatus: require('./functions/update-call-status').handler,
  getVoiceOptions: require('./functions/get-voice-options').handler,
  getModelOptions: require('./functions/get-model-options').handler
};
```

Configure handlers in `serverless.yml`:

```yaml
functions:
  makeCall:
    handler: index.makeCall
    # ... other configuration
  getCallDetails:
    handler: index.getCallDetails
    # ... other configuration
```

### Action Items
1. Create the `index.js` file as described above
2. Update `serverless.yml` to use the index.js handlers
3. Update deployment package creation to include index.js at the root

## Environment Configuration Management

### Current Situation
We have environment-specific configuration files (`.env.{environment}`), but they're not consistently used across all components.

### Recommendation
Use Serverless Framework's built-in parameter management and environment variables:

```yaml
# serverless.yml
provider:
  environment:
    NODE_ENV: ${opt:stage, 'dev'}
    API_URL: ${self:custom.apiUrl.${opt:stage, 'dev'}}
    # ... other environment variables

custom:
  apiUrl:
    dev: 'https://dev-api.example.com'
    staging: 'https://staging-api.example.com'
    production: 'https://api.example.com'
```

Use AWS Systems Manager Parameter Store for sensitive values:

```yaml
provider:
  environment:
    API_KEY: ${ssm:/ailevelup/${opt:stage, 'dev'}/api-key}
```

### Action Items
1. Migrate all environment-specific configuration to the Serverless Framework
2. Move sensitive values to AWS Systems Manager Parameter Store
3. Create appropriate parameters for each environment
4. Update documentation to reflect the new configuration approach

## Automated Testing

### Current Situation
We have a good testing framework but it's run manually after deployment.

### Recommendation
Integrate automated testing into the deployment process:

1. **Pre-deployment Tests**: Validate the configuration before deployment
2. **Post-deployment Tests**: Verify the deployed resources work correctly
3. **Smoke Tests**: Quick tests run immediately after deployment
4. **Full Integration Tests**: Comprehensive tests run on successful smoke tests

Implement this in a CI/CD pipeline (GitHub Actions, AWS CodePipeline, etc.).

### Action Items
1. Create a dedicated testing directory for deployment tests
2. Implement pre-deployment validation scripts
3. Enhance post-deployment tests to verify core functionality
4. Set up a simple CI/CD pipeline for automated testing

## Monitoring and Observability Improvements

### Current Situation
We've implemented CloudWatch dashboards and alerts, but they're not fully integrated into the deployment process.

### Recommendation
Make monitoring and observability a core part of the deployment:

1. **Automatic Dashboard Creation**: Create CloudWatch dashboards as part of deployment
2. **Alarm Management**: Manage CloudWatch alarms in `serverless.yml`
3. **X-Ray Tracing**: Add AWS X-Ray tracing for request tracking
4. **Health Checks**: Implement scheduled health checks

### Action Items
1. Add CloudWatch dashboard configuration to `serverless.yml`
2. Configure appropriate alarms for each environment
3. Enable X-Ray tracing for Lambda functions and API Gateway
4. Implement scheduled health checks for critical endpoints

## Conclusion

By implementing these recommendations, we can improve the reliability, consistency, and maintainability of our AWS deployment process. The primary focus should be on standardizing on the Serverless Framework and addressing the Lambda handler configuration issues we've encountered. 