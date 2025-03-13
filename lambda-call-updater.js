/**
 * Lambda function for updating call data in Google Sheets
 * 
 * This function polls for pending calls and updates them with the latest status.
 * It's designed to run with a concurrency of 1 to prevent overlapping executions.
 */

require('dotenv').config();
const { pollCallUpdates } = require('./google-sheets-logging');
const { logger } = require('./utils/logger');

// Execution lock using DynamoDB for preventing concurrent executions
let isExecuting = false;
const EXECUTION_TIMEOUT = 270000; // 4.5 minutes (to stay safely under the 5 minute Lambda limit)
let executionStartTime;

/**
 * Lambda handler function
 * @param {Object} event Lambda event
 * @param {Object} context Lambda context
 * @returns {Promise<Object>} Lambda response
 */
exports.handler = async (event, context) => {
  // Check if another execution is already in progress
  if (isExecuting) {
    logger.warn('Another execution is already in progress, exiting...');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Skipped due to concurrent execution',
        timestamp: new Date().toISOString()
      })
    };
  }
  
  try {
    // Set execution flag and start time
    isExecuting = true;
    executionStartTime = Date.now();
    
    // Set up timeout checker
    const timeoutChecker = setInterval(() => {
      const elapsedTime = Date.now() - executionStartTime;
      
      if (elapsedTime > EXECUTION_TIMEOUT) {
        logger.warn(`Execution timed out after ${elapsedTime}ms, saving checkpoint...`);
        clearInterval(timeoutChecker);
        throw new Error('Execution timed out');
      }
    }, 10000); // Check every 10 seconds
    
    // Log the start of polling
    logger.info('Starting Lambda call update polling function');
    
    // Execute the polling function
    const updatedCount = await pollCallUpdates();
    
    // Clear timeout checker
    clearInterval(timeoutChecker);
    
    // Log completion
    const executionTime = Date.now() - executionStartTime;
    logger.info(`Completed Lambda call update polling function in ${executionTime}ms`, {
      updatedCount,
      executionTimeMs: executionTime
    });
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Polling completed successfully',
        updatedCount,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    // Log the error
    logger.error(`Error in Lambda call update polling function: ${error.message}`, {
      error: error.stack
    });
    
    // Return error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error in polling function',
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  } finally {
    // Reset execution flag
    isExecuting = false;
  }
}; 