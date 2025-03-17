/**
 * Lambda Handler Wrapper Utility
 * 
 * This module provides a wrapper for Lambda function handlers to ensure:
 * - Consistent error handling
 * - CORS headers
 * - Response formatting
 * - Logging
 */

// Load environment variables if needed
try {
  require('dotenv').config();
} catch (error) {
  console.log('Dotenv not available, using environment variables as is');
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PATCH,DELETE',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
};

/**
 * Format the response with correct headers and status code
 * @param {number} statusCode - HTTP status code
 * @param {object|string} body - Response body
 * @param {object} additionalHeaders - Additional headers to include
 * @returns {object} Formatted response
 */
function formatResponse(statusCode, body, additionalHeaders = {}) {
  const bodyContent = typeof body === 'string' ? body : JSON.stringify(body);
  
  return {
    statusCode,
    body: bodyContent,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...additionalHeaders
    }
  };
}

/**
 * Handle OPTIONS requests for CORS preflight
 * @param {object} event - Lambda event object
 * @returns {object} CORS preflight response
 */
function handleCorsPreflightRequest(event) {
  return {
    statusCode: 204, // No Content
    headers: corsHeaders,
    body: ''
  };
}

/**
 * Log error details to CloudWatch
 * @param {Error} error - Error object
 * @param {object} event - Lambda event
 * @param {object} context - Lambda context
 */
function logError(error, event, context) {
  console.error('Lambda execution error:', {
    errorMessage: error.message,
    errorType: error.name,
    stackTrace: error.stack,
    functionName: context.functionName,
    requestId: context.awsRequestId,
    path: event.path,
    httpMethod: event.httpMethod,
  });
}

/**
 * Wrap a Lambda handler function with consistent error handling, CORS support, and logging
 * @param {Function} handler - Original Lambda handler function
 * @returns {Function} Wrapped handler function
 */
function wrapLambdaHandler(handler) {
  return async (event, context) => {
    // Log request
    console.log('Lambda request:', {
      functionName: context.functionName,
      requestId: context.awsRequestId,
      path: event.path,
      httpMethod: event.httpMethod,
      requestTime: new Date().toISOString()
    });

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return handleCorsPreflightRequest(event);
    }

    try {
      // Call the original handler
      const result = await handler(event, context);
      
      // If result is already formatted with statusCode and body, return it directly
      if (result && result.statusCode && (result.body !== undefined)) {
        // Ensure CORS headers are included
        return {
          ...result,
          headers: {
            ...corsHeaders,
            ...result.headers
          }
        };
      }
      
      // Otherwise, format the response
      return formatResponse(200, result);
    } catch (error) {
      // Log error
      logError(error, event, context);
      
      // Determine status code from error
      let statusCode = 500;
      let errorMessage = 'Internal Server Error';
      
      // Check for custom error properties
      if (error.statusCode) {
        statusCode = error.statusCode;
      }
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // Return formatted error response
      return formatResponse(statusCode, {
        error: errorMessage,
        requestId: context.awsRequestId
      });
    }
  };
}

module.exports = {
  wrapLambdaHandler,
  formatResponse,
  corsHeaders
}; 