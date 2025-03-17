#!/usr/bin/env node

/**
 * API Gateway Creation Script
 * 
 * This script creates a new API Gateway REST API for the specified environment
 * and sets up the necessary resources and methods for Lambda integration.
 * 
 * Usage:
 *   node create-api-gateway.js <environment> <region>
 * 
 * Example:
 *   node create-api-gateway.js staging us-east-1
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get command line arguments
const environment = process.argv[2];
const region = process.argv[3] || 'us-east-1';

if (!environment) {
  console.error('Usage: node create-api-gateway.js <environment> <region>');
  console.error('Example: node create-api-gateway.js staging us-east-1');
  process.exit(1);
}

// Names and prefixes
const servicePrefix = 'ailevelup-phone-call-mcp';
const apiName = `${servicePrefix}-${environment}-api`;
const stackName = `${servicePrefix}-${environment}`;

// API Gateway paths and methods to create
const apiPaths = [
  { path: '/calls', method: 'POST', function: 'make-call' },
  { path: '/calls', method: 'GET', function: 'list-calls' },
  { path: '/calls/{callId}', method: 'GET', function: 'get-call-details' },
  { path: '/calls/{callId}/status', method: 'PATCH', function: 'update-call-status' },
  { path: '/voices', method: 'GET', function: 'get-voice-options' },
  { path: '/models', method: 'GET', function: 'get-model-options' }
];

// Helper function to run commands and get output
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error(`Error running command: ${command}`);
    console.error(error.message);
    return null;
  }
}

// Create the API Gateway
function createApiGateway() {
  console.log(`Creating API Gateway: ${apiName} in region ${region}`);
  
  // Check if API with the same name already exists
  const existingApis = runCommand(
    `aws apigateway get-rest-apis --region ${region} --query "items[?name=='${apiName}'].id" --output text`
  );
  
  if (existingApis && existingApis.length > 0) {
    console.log(`API Gateway with name ${apiName} already exists (ID: ${existingApis})`);
    return existingApis;
  }
  
  // Create the API Gateway
  const createResult = runCommand(
    `aws apigateway create-rest-api --name "${apiName}" --description "API for ${servicePrefix} ${environment}" --region ${region} --endpoint-configuration "types=REGIONAL" --output json`
  );
  
  if (!createResult) {
    console.error('Failed to create API Gateway');
    process.exit(1);
  }
  
  const apiData = JSON.parse(createResult);
  const apiId = apiData.id;
  
  console.log(`API Gateway created with ID: ${apiId}`);
  return apiId;
}

// Get the root resource ID of the API
function getRootResourceId(apiId) {
  const resources = runCommand(
    `aws apigateway get-resources --rest-api-id ${apiId} --region ${region} --output json`
  );
  
  if (!resources) {
    console.error('Failed to get API Gateway resources');
    process.exit(1);
  }
  
  const resourcesData = JSON.parse(resources);
  const rootResource = resourcesData.items.find(item => item.path === '/');
  
  if (!rootResource) {
    console.error('Could not find root resource');
    process.exit(1);
  }
  
  return rootResource.id;
}

// Create a resource on the API
function createResource(apiId, parentResourceId, pathPart) {
  console.log(`Creating resource: ${pathPart} under parent ${parentResourceId}`);
  
  const result = runCommand(
    `aws apigateway create-resource --rest-api-id ${apiId} --parent-id ${parentResourceId} --path-part "${pathPart}" --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to create resource: ${pathPart}`);
    process.exit(1);
  }
  
  const resourceData = JSON.parse(result);
  console.log(`Resource created with ID: ${resourceData.id}`);
  return resourceData.id;
}

// Create a method on a resource
function createMethod(apiId, resourceId, httpMethod) {
  console.log(`Creating method: ${httpMethod} on resource ${resourceId}`);
  
  const result = runCommand(
    `aws apigateway put-method --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${httpMethod} --authorization-type "NONE" --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to create method: ${httpMethod}`);
    process.exit(1);
  }
  
  console.log(`Method ${httpMethod} created successfully`);
  return true;
}

// Set up Lambda integration for a method
function setLambdaIntegration(apiId, resourceId, httpMethod, lambdaFunction) {
  const functionName = `${stackName}-${lambdaFunction}`;
  console.log(`Setting up Lambda integration for ${httpMethod} with function: ${functionName}`);
  
  // Get the Lambda function ARN
  const functionArnResult = runCommand(
    `aws lambda get-function --function-name ${functionName} --region ${region} --query "Configuration.FunctionArn" --output text`
  );
  
  if (!functionArnResult) {
    console.error(`Failed to get Lambda function ARN for: ${functionName}`);
    console.error('Make sure the Lambda function is deployed first');
    process.exit(1);
  }
  
  const functionArn = functionArnResult.trim();
  
  // Create integration
  const result = runCommand(
    `aws apigateway put-integration --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${httpMethod} --type AWS_PROXY --integration-http-method POST --uri arn:aws:apigateway:${region}:lambda:path/2015-03-31/functions/${functionArn}/invocations --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to create Lambda integration for: ${functionName}`);
    process.exit(1);
  }
  
  console.log(`Lambda integration set up successfully for ${functionName}`);
  
  // Add permission for API Gateway to invoke Lambda
  const sourceArn = `arn:aws:execute-api:${region}:*:${apiId}/*/${httpMethod}/*`;
  
  // Check if permission already exists
  const permissionResult = runCommand(
    `aws lambda add-permission --function-name ${functionName} --statement-id apigateway-${environment}-${httpMethod} --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "${sourceArn}" --region ${region} --output json`
  );
  
  if (!permissionResult) {
    console.warn(`Warning: Could not add permission for API Gateway to invoke Lambda function: ${functionName}`);
    console.warn('This may be because the permission already exists');
  } else {
    console.log(`Permission added for API Gateway to invoke Lambda function: ${functionName}`);
  }
  
  return true;
}

// Create a method response
function createMethodResponse(apiId, resourceId, httpMethod) {
  console.log(`Creating method response for ${httpMethod}`);
  
  const result = runCommand(
    `aws apigateway put-method-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${httpMethod} --status-code 200 --response-models '{"application/json": "Empty"}' --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to create method response for: ${httpMethod}`);
    return false;
  }
  
  console.log(`Method response created successfully for ${httpMethod}`);
  return true;
}

// Create an integration response
function createIntegrationResponse(apiId, resourceId, httpMethod) {
  console.log(`Creating integration response for ${httpMethod}`);
  
  const result = runCommand(
    `aws apigateway put-integration-response --rest-api-id ${apiId} --resource-id ${resourceId} --http-method ${httpMethod} --status-code 200 --selection-pattern "" --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to create integration response for: ${httpMethod}`);
    return false;
  }
  
  console.log(`Integration response created successfully for ${httpMethod}`);
  return true;
}

// Deploy the API to a stage
function deployApi(apiId) {
  console.log(`Deploying API ${apiId} to ${environment} stage`);
  
  const result = runCommand(
    `aws apigateway create-deployment --rest-api-id ${apiId} --stage-name ${environment} --description "Deployment to ${environment}" --region ${region} --output json`
  );
  
  if (!result) {
    console.error(`Failed to deploy API to ${environment} stage`);
    return false;
  }
  
  console.log(`API deployed successfully to ${environment} stage`);
  
  // Get the deployment URL
  const url = `https://${apiId}.execute-api.${region}.amazonaws.com/${environment}`;
  console.log(`API URL: ${url}`);
  
  return true;
}

// Save API details to a file
function saveApiDetails(apiId) {
  const details = {
    apiId,
    environment,
    region,
    name: apiName,
    url: `https://${apiId}.execute-api.${region}.amazonaws.com/${environment}`
  };
  
  const filename = `api-details-${environment}.json`;
  fs.writeFileSync(filename, JSON.stringify(details, null, 2));
  console.log(`API details saved to ${filename}`);
}

// Function to find or create resources for a given path
function findOrCreateResource(apiId, rootResourceId, path) {
  // Split the path into parts, removing empty strings
  const pathParts = path.split('/').filter(Boolean);
  
  if (pathParts.length === 0) {
    return rootResourceId;
  }
  
  // Get all existing resources
  const resources = runCommand(
    `aws apigateway get-resources --rest-api-id ${apiId} --region ${region} --output json`
  );
  
  if (!resources) {
    console.error('Failed to get API Gateway resources');
    process.exit(1);
  }
  
  const resourcesData = JSON.parse(resources);
  const allResources = resourcesData.items;
  
  // Start from the root resource
  let currentPathParts = [];
  let currentResourceId = rootResourceId;
  
  for (const pathPart of pathParts) {
    currentPathParts.push(pathPart);
    const currentPath = '/' + currentPathParts.join('/');
    
    // Check if resource already exists
    const existingResource = allResources.find(r => r.path === currentPath);
    
    if (existingResource) {
      console.log(`Resource for path ${currentPath} already exists (ID: ${existingResource.id})`);
      currentResourceId = existingResource.id;
    } else {
      // If not, create it
      currentResourceId = createResource(apiId, currentResourceId, pathPart);
    }
  }
  
  return currentResourceId;
}

// Main function
async function main() {
  console.log(`Creating API Gateway for ${servicePrefix} ${environment} in region ${region}`);
  
  // Create API Gateway
  const apiId = createApiGateway();
  
  if (!apiId) {
    console.error('Failed to create API Gateway');
    process.exit(1);
  }
  
  // Get root resource ID
  const rootResourceId = getRootResourceId(apiId);
  
  // Create resources and methods
  for (const apiPath of apiPaths) {
    const resourceId = findOrCreateResource(apiId, rootResourceId, apiPath.path);
    
    // Create method
    createMethod(apiId, resourceId, apiPath.method);
    
    // Set up Lambda integration
    setLambdaIntegration(apiId, resourceId, apiPath.method, apiPath.function);
    
    // Create method response
    createMethodResponse(apiId, resourceId, apiPath.method);
    
    // Create integration response
    createIntegrationResponse(apiId, resourceId, apiPath.method);
  }
  
  // Deploy the API
  deployApi(apiId);
  
  // Save API details
  saveApiDetails(apiId);
  
  console.log(`API Gateway creation completed for ${apiName}`);
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 