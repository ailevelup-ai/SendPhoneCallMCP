#!/usr/bin/env node

/**
 * Lambda Function Permissions Updater for API Gateway
 * 
 * This script adds the necessary permissions for API Gateway to invoke our Lambda functions.
 * It grants the Lambda:InvokeFunction permission to the API Gateway service principal.
 * 
 * Usage:
 *   node update-lambda-permissions.js <environment> <region> <api-id>
 * 
 * Example:
 *   node update-lambda-permissions.js dev us-east-1 abc123def
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get command line arguments
const environment = process.argv[2];
const region = process.argv[3];
const apiId = process.argv[4];

if (!environment || !region || !apiId) {
  console.error('Usage: node update-lambda-permissions.js <environment> <region> <api-id>');
  console.error('Example: node update-lambda-permissions.js dev us-east-1 abc123def');
  process.exit(1);
}

// Get AWS account ID
async function getAccountId() {
  try {
    const { stdout } = await execAsync('aws sts get-caller-identity --query "Account" --output text');
    return stdout.trim();
  } catch (error) {
    console.error('Error getting AWS account ID:', error.message);
    process.exit(1);
  }
}

// Lambda function names prefix
const functionPrefix = `ailevelup-phone-call-mcp-${environment}`;

// API Gateway to Lambda function endpoint mappings
const endpointMappings = [
  { 
    functionName: `${functionPrefix}-get-model-options`,
    httpMethod: 'GET',
    path: 'models'
  },
  { 
    functionName: `${functionPrefix}-get-voice-options`,
    httpMethod: 'GET',
    path: 'voices'
  },
  { 
    functionName: `${functionPrefix}-make-call`,
    httpMethod: 'POST',
    path: 'call'
  },
  { 
    functionName: `${functionPrefix}-get-call-details`,
    httpMethod: 'GET',
    path: 'call/{callId}'
  },
  { 
    functionName: `${functionPrefix}-list-calls`,
    httpMethod: 'GET',
    path: 'calls'
  },
  { 
    functionName: `${functionPrefix}-update-call-status`,
    httpMethod: 'PUT',
    path: 'call/{callId}/status'
  }
];

/**
 * List all Lambda functions matching the prefix
 */
async function listFunctions() {
  console.log(`Listing Lambda functions with prefix '${functionPrefix}' in region ${region}...`);
  
  try {
    const { stdout } = await execAsync(
      `aws lambda list-functions --region ${region} --query "Functions[?starts_with(FunctionName, '${functionPrefix}')].FunctionName" --output json`
    );
    
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Error listing Lambda functions:', error.message);
    return [];
  }
}

/**
 * Add permission for API Gateway to invoke Lambda function
 */
async function addPermission(functionName, accountId, httpMethod, path) {
  console.log(`Adding API Gateway invoke permission for ${functionName}...`);
  
  // Create a unique statement ID for this permission
  const statementId = `apigateway-${httpMethod}-${path.replace(/\//g, '-').replace(/\{|\}/g, '')}`;
  
  // Create the source ARN for the API Gateway resource
  const sourceArn = `arn:aws:execute-api:${region}:${accountId}:${apiId}/*/${httpMethod}/${path}`;
  
  try {
    // Check if permission already exists by trying to get the policy
    try {
      const { stdout } = await execAsync(
        `aws lambda get-policy --function-name ${functionName} --region ${region} --query "Policy" --output text`
      );
      
      // If policy exists, check if it already has this permission
      if (stdout.includes(statementId) || stdout.includes(sourceArn)) {
        console.log(`✅ Permission already exists for ${functionName}`);
        return true;
      }
    } catch (error) {
      // No policy exists yet, which is fine, we'll create it
    }
    
    // Add the permission
    await execAsync(
      `aws lambda add-permission \
        --function-name ${functionName} \
        --statement-id ${statementId} \
        --action lambda:InvokeFunction \
        --principal apigateway.amazonaws.com \
        --source-arn "${sourceArn}" \
        --region ${region}`
    );
    
    console.log(`✅ Successfully added permission for ${functionName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error adding permission for ${functionName}:`, error.message);
    return false;
  }
}

/**
 * Main function to update all permissions
 */
async function updateAllPermissions() {
  console.log(`Starting Lambda permissions update for API Gateway`);
  console.log(`Environment: ${environment}, Region: ${region}, API Gateway ID: ${apiId}`);
  console.log('=====================================================================');
  
  // Get AWS account ID
  const accountId = await getAccountId();
  console.log(`AWS Account ID: ${accountId}`);
  
  // Get all functions
  const functions = await listFunctions();
  
  if (functions.length === 0) {
    console.log(`No Lambda functions found with prefix '${functionPrefix}'`);
    return;
  }
  
  console.log(`Found ${functions.length} Lambda functions`);
  
  // Track success/failure
  let successCount = 0;
  let failureCount = 0;
  
  // Process each endpoint mapping
  for (const mapping of endpointMappings) {
    // Check if the function exists
    if (!functions.includes(mapping.functionName)) {
      console.log(`Skipping ${mapping.functionName} - function not found`);
      failureCount++;
      continue;
    }
    
    // Add permission
    const success = await addPermission(
      mapping.functionName, 
      accountId, 
      mapping.httpMethod, 
      mapping.path
    );
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    console.log('---------------------------------------------------------------------');
  }
  
  // Summary
  console.log('=====================================================================');
  console.log('Permission Update Summary:');
  console.log(`Total endpoints: ${endpointMappings.length}`);
  console.log(`Successful updates: ${successCount}`);
  console.log(`Failed updates: ${failureCount}`);
  console.log('=====================================================================');
}

// Run the script
updateAllPermissions().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 