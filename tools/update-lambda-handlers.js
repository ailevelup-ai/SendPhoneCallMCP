#!/usr/bin/env node

/**
 * Lambda Function Handler Updater
 * 
 * This script updates all Lambda function handlers in the specified AWS region
 * to use the centralized index.js approach. This helps resolve module path issues
 * in AWS Lambda and standardizes the handler configuration.
 * 
 * Usage:
 *   node update-lambda-handlers.js <environment> <region>
 * 
 * Example:
 *   node update-lambda-handlers.js dev us-east-1
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get command line arguments
const environment = process.argv[2];
const region = process.argv[3];

if (!environment || !region) {
  console.error('Usage: node update-lambda-handlers.js <environment> <region>');
  console.error('Example: node update-lambda-handlers.js dev us-east-1');
  process.exit(1);
}

// Lambda function names prefix
const functionPrefix = `ailevelup-phone-call-mcp-${environment}`;

// Handler mappings from old to new
const handlerMappings = {
  [`${functionPrefix}-make-call`]: 'index.makeCall',
  [`${functionPrefix}-get-call-details`]: 'index.getCallDetails',
  [`${functionPrefix}-list-calls`]: 'index.listCalls',
  [`${functionPrefix}-update-call-status`]: 'index.updateCallStatus',
  [`${functionPrefix}-get-voice-options`]: 'index.getVoiceOptions',
  [`${functionPrefix}-get-model-options`]: 'index.getModelOptions',
};

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
 * Get current handler for a Lambda function
 */
async function getCurrentHandler(functionName) {
  try {
    const { stdout } = await execAsync(
      `aws lambda get-function-configuration --region ${region} --function-name ${functionName} --query "Handler" --output text`
    );
    
    return stdout.trim();
  } catch (error) {
    console.error(`Error getting current handler for ${functionName}:`, error.message);
    return null;
  }
}

/**
 * Update the handler for a Lambda function
 */
async function updateHandler(functionName, newHandler) {
  console.log(`Updating handler for ${functionName} to ${newHandler}...`);
  
  try {
    await execAsync(
      `aws lambda update-function-configuration --region ${region} --function-name ${functionName} --handler ${newHandler}`
    );
    
    console.log(`✅ Successfully updated handler for ${functionName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating handler for ${functionName}:`, error.message);
    return false;
  }
}

/**
 * Main function to update all handlers
 */
async function updateAllHandlers() {
  console.log(`Starting Lambda handler update for environment: ${environment}, region: ${region}`);
  console.log('This will update all Lambda function handlers to use the centralized index.js approach');
  console.log('=====================================================================');
  
  // Get all functions
  const functions = await listFunctions();
  
  if (functions.length === 0) {
    console.log(`No Lambda functions found with prefix '${functionPrefix}'`);
    return;
  }
  
  console.log(`Found ${functions.length} Lambda functions to update`);
  
  // Track success/failure
  let successCount = 0;
  let failureCount = 0;
  
  // Process each function
  for (const functionName of functions) {
    // Get current handler
    const currentHandler = await getCurrentHandler(functionName);
    
    if (!currentHandler) {
      console.log(`Skipping ${functionName} - couldn't retrieve current handler`);
      failureCount++;
      continue;
    }
    
    // Determine new handler
    const newHandler = handlerMappings[functionName];
    
    if (!newHandler) {
      console.log(`Skipping ${functionName} - no handler mapping defined`);
      failureCount++;
      continue;
    }
    
    console.log(`${functionName}: Current handler = ${currentHandler}, New handler = ${newHandler}`);
    
    // Update if different
    if (currentHandler !== newHandler) {
      const success = await updateHandler(functionName, newHandler);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    } else {
      console.log(`✅ Handler for ${functionName} is already correct`);
      successCount++;
    }
    
    console.log('---------------------------------------------------------------------');
  }
  
  // Summary
  console.log('=====================================================================');
  console.log('Handler Update Summary:');
  console.log(`Total functions: ${functions.length}`);
  console.log(`Successful updates: ${successCount}`);
  console.log(`Failed updates: ${failureCount}`);
  console.log('=====================================================================');
}

// Run the script
updateAllHandlers().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1); 
}); 