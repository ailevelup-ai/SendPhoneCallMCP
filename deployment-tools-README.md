# AilevelUp Phone Call MCP Deployment Tools

This document provides instructions for using the enhanced deployment tools developed for the AilevelUp Phone Call MCP service migration to AWS.

## Overview

These tools are designed to improve the reliability and debuggability of deployments to AWS environments. They provide robust error handling, comprehensive logging, and automated troubleshooting capabilities.

## Prerequisites

Before using these tools, ensure you have:

1. AWS CLI installed and configured with appropriate credentials
2. The following utilities: `jq`, `zip`, `uuidgen`, `grep`, `sed`
3. Required directories: `functions`, `utils`, and `logs`
4. Environment configuration files (`.env.staging` and `.env.production`)

## Available Tools

### 1. API Gateway Shell Script (`create-api-gateway-shell.sh`)

This script creates a REST API Gateway with all required resources and methods, and sets up Lambda integrations.

**Usage:**
```bash
./create-api-gateway-shell.sh <environment> [region]
```

**Example:**
```bash
./create-api-gateway-shell.sh staging us-east-1
```

### 2. Staging Deployment Script (`deploy-to-staging.sh`)

Deploys all components to the staging environment, including Lambda functions, API Gateway, DynamoDB tables, and CloudWatch dashboards.

**Usage:**
```bash
./deploy-to-staging.sh
```

### 3. Production Deployment with Debugging (`deploy-to-production-with-debugging.sh`)

Deploys to production with enhanced debugging capabilities, including detailed logging, error tracking, and pre/post-deployment validation.

**Usage:**
```bash
./deploy-to-production-with-debugging.sh
```

### 4. Deployment Monitoring Script (`deployment-monitor.sh`)

Provides comprehensive verification of deployed resources, generating detailed reports and diagnostic information.

**Usage:**
```bash
./deployment-monitor.sh <environment> [log_level]
```

**Example:**
```bash
./deployment-monitor.sh production DEBUG
```

**Log Levels:** DEBUG, INFO, WARN, ERROR, FATAL (default: INFO)

### 5. Deployment Troubleshooting Script (`troubleshoot-deployment.sh`)

Targeted troubleshooting for specific AWS components, with automatic issue detection and remediation suggestions.

**Usage:**
```bash
./troubleshoot-deployment.sh <environment> [component]
```

**Example:**
```bash
./troubleshoot-deployment.sh staging lambda
```

**Components:** lambda, apigateway, all (default: all)

## Lambda Layers Deployment Tools

For a more efficient deployment approach, we provide scripts to use AWS Lambda Layers. Lambda Layers allow you to separate your dependencies from your function code, resulting in smaller function packages and easier maintenance.

### Lambda Layer Tools

#### Create Lambda Layers Script (`create-lambda-layers.sh`)

This script creates and publishes two Lambda Layers:

1. **Dependencies Layer**: Contains all the `node_modules` dependencies
2. **Utils Layer**: Contains all the shared utility code

**Usage:**
```bash
./create-lambda-layers.sh
```

**What it does:**
- Creates the necessary directory structure for Lambda Layers
- Packages node_modules into a dependencies layer
- Packages utils into a utilities layer
- Publishes both layers to AWS
- Saves the layer ARNs for later use

#### Deploy Functions With Layers Script (`deploy-functions-with-layers.sh`)

This script deploys Lambda functions using the previously created layers instead of bundling everything together.

**Usage:**
```bash
./deploy-functions-with-layers.sh
```

**What it does:**
- Creates slim function packages (just the function code, no dependencies)
- Deploys/updates each function with references to the Lambda Layers
- Creates/updates the API Gateway
- Sets up CloudWatch Dashboard

### Benefits of using Lambda Layers

1. **Faster Deployments**: Function packages are much smaller without dependencies
2. **Easier Maintenance**: Update dependencies in one place rather than in each function
3. **Reduced Package Size**: No need for large ZIP files with duplicated dependencies
4. **Simplified CI/CD**: Deploy changes to shared code once instead of redeploying all functions

### Prerequisites

- AWS CLI properly configured
- IAM role with Lambda and Layer permissions
- jq command-line JSON processor

### Troubleshooting Lambda Layers

If you encounter issues:

1. **Layer Size Limit**: Ensure layers remain under 250MB unzipped
2. **Node.js Module Resolution**: Make sure modules are in the `nodejs` directory in the layer
3. **Layer Permissions**: Verify the layer is accessible to your function
4. **Lambda Runtime Compatibility**: Ensure the layer is compatible with your runtime version

## Deployment Process

### Staging Deployment

1. Ensure `.env.staging` is properly configured
2. Run the staging deployment script:
   ```bash
   ./deploy-to-staging.sh
   ```
3. Check the deployment logs and API Gateway URL output
4. Run troubleshooting if any issues are encountered:
   ```bash
   ./troubleshoot-deployment.sh staging
   ```

### Production Deployment

1. Ensure successful staging deployment
2. Verify `.env.production` is properly configured
3. Run the production deployment with debugging:
   ```bash
   ./deploy-to-production-with-debugging.sh
   ```
4. When prompted, choose to run pre-deployment checks
5. Review logs and deployment report after completion
6. If issues occur, use the troubleshooting script:
   ```bash
   ./troubleshoot-deployment.sh production
   ```

## Logs and Reports

All deployment tools generate detailed logs in the `logs/` directory:

- Deployment logs: `logs/production-deployment-*.log`
- Error logs: `logs/production-deployment-errors-*.log`
- AWS CLI trace logs: `logs/aws-cli-trace-*.log`
- Troubleshooting logs: `logs/troubleshoot-*.log`

Deployment reports are generated in markdown format in the project root.

## Common Issues and Solutions

### Lambda Function Handlers

If Lambda functions fail with "Cannot find module" errors:
1. Verify the handler is set to `index.handler`
2. Check that `functions/index.js` exists and exports the handler function
3. Run:
   ```bash
   ./troubleshoot-deployment.sh <environment> lambda
   ```

### API Gateway Issues

If API Gateway returns 5XX errors:
1. Check Lambda permissions for API Gateway
2. Verify API Gateway integrations use AWS_PROXY
3. Run:
   ```bash
   ./troubleshoot-deployment.sh <environment> apigateway
   ```

## Customization

These tools have been configured specifically for the AilevelUp Phone Call MCP service. To adapt them for other services:

1. Modify the `SERVICE_PREFIX` variable in each script
2. Update the Lambda function names in the arrays
3. Adjust the environment variable checks and CloudWatch metric configurations as needed

## Support

For assistance with these deployment tools, contact the DevOps team or the project maintainers. 