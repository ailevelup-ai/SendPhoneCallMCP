#!/usr/bin/env node

/**
 * Lambda Function Direct Testing Tool
 * 
 * This script directly invokes each Lambda function to test them in isolation,
 * bypassing API Gateway to identify any issues with the functions themselves.
 * 
 * Usage:
 *   node test-lambda-functions.js <environment> <region>
 * 
 * Example:
 *   node test-lambda-functions.js dev us-east-1
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const execAsync = promisify(exec);

// Get command line arguments
const environment = process.argv[2];
const region = process.argv[3];

if (!environment || !region) {
  console.error('Usage: node test-lambda-functions.js <environment> <region>');
  console.error('Example: node test-lambda-functions.js dev us-east-1');
  process.exit(1);
}

// Lambda function names prefix
const functionPrefix = `ailevelup-phone-call-mcp-${environment}`;

// Test payloads for each function type
const testPayloads = {
  [`${functionPrefix}-get-model-options`]: {
    resource: '/models',
    path: '/models',
    httpMethod: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null
  },
  [`${functionPrefix}-get-voice-options`]: {
    resource: '/voices',
    path: '/voices',
    httpMethod: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: null,
    pathParameters: null,
    body: null
  },
  [`${functionPrefix}-make-call`]: {
    resource: '/call',
    path: '/call',
    httpMethod: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: null,
    pathParameters: null,
    body: JSON.stringify({
      phoneNumber: '+12025550167',
      message: 'This is a test call from the Lambda testing tool.',
      voiceId: 'nova',
      modelId: 'gpt-4'
    })
  },
  [`${functionPrefix}-get-call-details`]: {
    resource: '/call/{callId}',
    path: '/call/test-call-id',
    httpMethod: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: null,
    pathParameters: {
      callId: 'test-call-id'
    },
    body: null
  },
  [`${functionPrefix}-list-calls`]: {
    resource: '/calls',
    path: '/calls',
    httpMethod: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: {
      limit: '10',
      offset: '0'
    },
    pathParameters: null,
    body: null
  },
  [`${functionPrefix}-update-call-status`]: {
    resource: '/call/{callId}/status',
    path: '/call/test-call-id/status',
    httpMethod: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    queryStringParameters: null,
    pathParameters: {
      callId: 'test-call-id'
    },
    body: JSON.stringify({
      status: 'completed'
    })
  }
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
 * Invoke a Lambda function directly
 */
async function invokeFunction(functionName) {
  console.log(`\nTesting Lambda function: ${functionName}`);
  
  // Get the appropriate test payload
  const payload = testPayloads[functionName] || { body: null };
  
  // Create a temp file to store the payload
  const payloadFile = path.join('/tmp', `${functionName}-payload.json`);
  const responseFile = path.join('/tmp', `${functionName}-response.json`);
  
  try {
    // Write the payload to a file
    await fs.writeFile(payloadFile, JSON.stringify(payload));
    
    console.log(`Invoking function with payload:`, JSON.stringify(payload, null, 2));
    
    // Invoke the function
    await execAsync(
      `aws lambda invoke \
        --function-name ${functionName} \
        --payload file://${payloadFile} \
        --cli-binary-format raw-in-base64-out \
        --region ${region} \
        ${responseFile}`
    );
    
    // Read the response
    const response = await fs.readFile(responseFile, 'utf8');
    console.log(`Response:`, response);
    
    try {
      // Parse the response to see if it's valid JSON
      const parsedResponse = JSON.parse(response);
      
      // Check for Lambda errors
      if (parsedResponse.errorType || parsedResponse.errorMessage) {
        console.error(`❌ Error executing Lambda function: ${parsedResponse.errorMessage}`);
        return false;
      }
      
      // Check for API Gateway formatted response
      if (parsedResponse.statusCode) {
        console.log(`Status Code: ${parsedResponse.statusCode}`);
        
        if (parsedResponse.body) {
          try {
            const body = JSON.parse(parsedResponse.body);
            console.log(`Body:`, JSON.stringify(body, null, 2));
          } catch (e) {
            console.log(`Body: ${parsedResponse.body}`);
          }
        }
        
        if (parsedResponse.statusCode >= 200 && parsedResponse.statusCode < 300) {
          console.log(`✅ Lambda function executed successfully with status code ${parsedResponse.statusCode}`);
          return true;
        } else {
          console.error(`❌ Lambda function returned error status code ${parsedResponse.statusCode}`);
          return false;
        }
      }
      
      console.log(`✅ Lambda function executed successfully`);
      return true;
    } catch (e) {
      // If the response is not JSON, just log it
      console.log(`Raw response:`, response);
      console.log(`✅ Lambda function executed and returned a response`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error invoking Lambda function:`, error.message);
    return false;
  } finally {
    // Clean up temp files
    try {
      await fs.unlink(payloadFile);
      await fs.unlink(responseFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Main function to test all Lambda functions
 */
async function testAllFunctions() {
  console.log(`Starting Lambda function tests for environment: ${environment}, region: ${region}`);
  console.log('=====================================================================');
  
  // Get all functions
  const functions = await listFunctions();
  
  if (functions.length === 0) {
    console.log(`No Lambda functions found with prefix '${functionPrefix}'`);
    return;
  }
  
  console.log(`Found ${functions.length} Lambda functions to test`);
  
  // Track success/failure
  let successCount = 0;
  let failureCount = 0;
  
  // Process each function
  for (const functionName of functions) {
    // Check if we have a test payload for this function
    if (!testPayloads[functionName]) {
      console.log(`Skipping ${functionName} - no test payload defined`);
      continue;
    }
    
    // Invoke function
    const success = await invokeFunction(functionName);
    
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    
    console.log('---------------------------------------------------------------------');
  }
  
  // Summary
  console.log('=====================================================================');
  console.log('Lambda Function Test Summary:');
  console.log(`Total functions: ${functions.length}`);
  console.log(`Successful tests: ${successCount}`);
  console.log(`Failed tests: ${failureCount}`);
  console.log('=====================================================================');
}

// Run the script
testAllFunctions().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 