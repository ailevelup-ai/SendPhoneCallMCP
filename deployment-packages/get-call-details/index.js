/**
 * Main entry point for all Lambda functions
 * 
 * This file centralizes all handler exports to resolve module path issues
 * in AWS Lambda. Instead of using individual file paths as handlers,
 * we use this file to re-export all handlers, simplifying the configuration.
 * 
 * Handler names in serverless.yml should be configured as:
 * - index.makeCall
 * - index.getCallDetails
 * - etc.
 */

// Re-export all Lambda function handlers
module.exports = {
  // Make call function
  makeCall: require('./functions/make-call').handler,
  
  // Get call details function
  getCallDetails: require('./functions/get-call-details').handler,
  
  // List calls function
  listCalls: require('./functions/list-calls').handler,
  
  // Update call status function
  updateCallStatus: require('./functions/update-call-status').handler,
  
  // Get voice options function
  getVoiceOptions: require('./functions/get-voice-options').handler,
  
  // Get model options function
  getModelOptions: require('./functions/get-model-options').handler
}; 