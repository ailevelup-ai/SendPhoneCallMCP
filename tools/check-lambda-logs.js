#!/usr/bin/env node

/**
 * Lambda CloudWatch Logs Checker
 * 
 * This script checks CloudWatch logs for Lambda functions to identify errors.
 * It can be used to debug issues with Lambda functions in API Gateway integration.
 * 
 * Usage:
 *   node check-lambda-logs.js <environment> <region> [function-name] [minutes]
 * 
 * Example:
 *   node check-lambda-logs.js dev us-east-1
 *   node check-lambda-logs.js dev us-east-1 ailevelup-phone-call-mcp-dev-get-model-options 30
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Get command line arguments
const environment = process.argv[2];
const region = process.argv[3];
const specificFunction = process.argv[4];
const minutes = parseInt(process.argv[5] || '15', 10);

if (!environment || !region) {
  console.error('Usage: node check-lambda-logs.js <environment> <region> [function-name] [minutes]');
  console.error('Example: node check-lambda-logs.js dev us-east-1');
  console.error('Example: node check-lambda-logs.js dev us-east-1 ailevelup-phone-call-mcp-dev-get-model-options 30');
  process.exit(1);
}

// Lambda function names prefix
const functionPrefix = `ailevelup-phone-call-mcp-${environment}`;

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
 * Get recent logs for a Lambda function
 */
async function getLogs(functionName, minutes) {
  const logGroupName = `/aws/lambda/${functionName}`;
  const startTime = new Date(Date.now() - (minutes * 60 * 1000));
  const startTimeMs = startTime.getTime();
  
  console.log(`\nChecking logs for ${functionName} from the past ${minutes} minutes...`);
  
  try {
    // First check if the log group exists
    try {
      await execAsync(`aws logs describe-log-groups --log-group-name-prefix ${logGroupName} --region ${region}`);
    } catch (error) {
      console.log(`No log group found for ${functionName}`);
      return null;
    }
    
    // Get the log events
    const { stdout } = await execAsync(
      `aws logs filter-log-events \
        --log-group-name ${logGroupName} \
        --start-time ${startTimeMs} \
        --filter-pattern "ERROR" \
        --region ${region}`
    );
    
    const response = JSON.parse(stdout);
    
    if (!response.events || response.events.length === 0) {
      console.log(`No error logs found for ${functionName}`);
      
      // Check for all recent logs to see if there's any activity
      const { stdout: allLogs } = await execAsync(
        `aws logs filter-log-events \
          --log-group-name ${logGroupName} \
          --start-time ${startTimeMs} \
          --limit 5 \
          --region ${region}`
      );
      
      const allLogsResponse = JSON.parse(allLogs);
      
      if (!allLogsResponse.events || allLogsResponse.events.length === 0) {
        console.log(`No logs found at all for ${functionName} in the past ${minutes} minutes`);
      } else {
        console.log(`Found ${allLogsResponse.events.length} recent logs (showing up to 5):`);
        allLogsResponse.events.forEach((event, index) => {
          console.log(`[${new Date(event.timestamp).toISOString()}] ${event.message}`);
        });
      }
      
      return null;
    }
    
    console.log(`Found ${response.events.length} error logs:`);
    response.events.forEach((event) => {
      console.log(`[${new Date(event.timestamp).toISOString()}] ${event.message}`);
    });
    
    return response.events;
  } catch (error) {
    console.error(`Error getting logs for ${functionName}:`, error.message);
    return null;
  }
}

/**
 * Main function to check logs for Lambda functions
 */
async function checkLogs() {
  console.log(`Checking CloudWatch logs for Lambda functions in environment: ${environment}, region: ${region}`);
  console.log(`Time range: past ${minutes} minutes`);
  console.log('=====================================================================');
  
  // If a specific function is provided, only check that one
  if (specificFunction) {
    await getLogs(specificFunction, minutes);
    return;
  }
  
  // Get all functions
  const functions = await listFunctions();
  
  if (functions.length === 0) {
    console.log(`No Lambda functions found with prefix '${functionPrefix}'`);
    return;
  }
  
  console.log(`Found ${functions.length} Lambda functions to check`);
  
  // Check logs for each function
  let errorCount = 0;
  
  for (const functionName of functions) {
    const logs = await getLogs(functionName, minutes);
    
    if (logs && logs.length > 0) {
      errorCount += logs.length;
    }
    
    console.log('---------------------------------------------------------------------');
  }
  
  // Summary
  console.log('=====================================================================');
  console.log('CloudWatch Logs Check Summary:');
  console.log(`Total functions checked: ${functions.length}`);
  console.log(`Total error logs found: ${errorCount}`);
  console.log('=====================================================================');
}

// Run the script
checkLogs().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 