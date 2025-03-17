/**
 * Centralized Lambda Handler File
 * 
 * This file imports and exports all Lambda function handlers to simplify deployment
 * and resolve module path issues. AWS Lambda will use this file as the entry point
 * for function invocation.
 */

// Import individual function handlers
const makeCallHandler = require('./make-call');
const getCallDetailsHandler = require('./get-call-details');
const listCallsHandler = require('./list-calls');
const updateCallStatusHandler = require('./update-call-status');
const getVoiceOptionsHandler = require('./get-voice-options');
const getModelOptionsHandler = require('./get-model-options');

// Import error handling wrapper if it exists
let wrapHandler;
try {
  const { wrapLambdaHandler } = require('../utils/lambda-wrapper');
  wrapHandler = wrapLambdaHandler;
} catch (error) {
  // If wrapper doesn't exist, create a simple passthrough wrapper
  wrapHandler = (handler) => async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Error in Lambda handler:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PATCH,DELETE',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
        }
      };
    }
  };
}

// Export wrapped handlers
module.exports = {
  // Make Call function
  makeCall: wrapHandler(makeCallHandler),
  
  // Get Call Details function
  getCallDetails: wrapHandler(getCallDetailsHandler),
  
  // List Calls function
  listCalls: wrapHandler(listCallsHandler),
  
  // Update Call Status function
  updateCallStatus: wrapHandler(updateCallStatusHandler),
  
  // Get Voice Options function
  getVoiceOptions: wrapHandler(getVoiceOptionsHandler),
  
  // Get Model Options function
  getModelOptions: wrapHandler(getModelOptionsHandler)
}; 