/**
 * MCP Tool: Make Phone Call
 * 
 * This tool initiates a phone call using the ailevelup.AI API.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const axios = require('axios');
const { logCallToGoogleSheets } = require('../../google-sheets-logging');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    phoneNumber: {
      type: 'string',
      description: 'Target phone number in E.164 format (e.g., +15551234567)',
      pattern: '^\\+[1-9]\\d{1,14}$'
    },
    task: {
      type: 'string',
      description: 'What the AI should accomplish on this call'
    },
    voice: {
      type: 'string',
      description: 'Voice ID to use for the call (UUID format)',
      default: '4a5c3c9b-19bc-4ae7-9d58-a96950e97ef5' // Default to customer's preferred voice
    },
    fromNumber: {
      type: 'string',
      description: 'Phone number to call from (must be a verified number)',
      pattern: '^\\+[1-9]\\d{1,14}$'
    },
    temperature: {
      type: 'number',
      description: 'Temperature for AI responses (0-1)',
      minimum: 0,
      maximum: 1,
      default: 1
    },
    voicemailAction: {
      type: 'string',
      description: 'What to do when encountering voicemail',
      enum: ['hangup', 'leave_message'],
      default: 'hangup'
    },
    answeredByEnabled: {
      type: 'boolean',
      description: 'Enable answered-by detection',
      default: true
    },
    maxDuration: {
      type: 'integer',
      description: 'Maximum duration of the call in seconds',
      minimum: 30,
      maximum: 1800,
      default: 300
    },
    webhookUrl: {
      type: 'string',
      description: 'URL to receive webhook notifications about call status changes'
    }
  },
  required: ['phoneNumber', 'task'],
  additionalProperties: false
};

// Validator for parameters
const validator = new JSONSchemaValidator();

/**
 * Validate parameters against schema
 * @param {Object} params Parameters to validate
 * @returns {Object|null} Validation error or null if valid
 */
function validateParameters(params) {
  const validationResult = validator.validate(params, parametersSchema);
  
  if (!validationResult.valid) {
    return {
      message: validationResult.errors.map(err => err.stack).join('; ')
    };
  }
  
  return null;
}

/**
 * Execute the tool with the provided parameters
 * @param {Object} params Tool parameters
 * @param {Object} context Execution context including sessionId
 * @returns {Promise<Object>} Tool execution result
 */
async function execute(params, context) {
  const { userId, sessionId } = context;
  
  // Get default settings from environment
  const defaultFromNumber = process.env.CALL_FROM || process.env.AILEVELUP_DEFAULT_FROM_NUMBER || "+15615665857";
  const ailevelupApiKey = process.env.AILEVELUP_ENTERPRISE_API_KEY;
  const encryptedKey = process.env.AILEVELUP_ENCRYPTED_KEY;
  
  if (!ailevelupApiKey) {
    throw new Error('ailevelup.AI API key not configured');
  }
  
  // Check user credits
  /*
  const { data: userCredits, error: creditsError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', userId)
    .single();
  
  if (creditsError || !userCredits || userCredits.balance <= 0) {
    throw new Error('Insufficient credits');
  }
  */
  
  // Bypass credit check for testing
  logger.info('Bypassing credit check for testing purposes', { sessionId, userId });
  const userCredits = { balance: 100 }; // Mock credits for deduction later
  
  // Check for malicious content using gpt-4o-mini (this would be implemented separately)
  // TODO: Implement content check with gpt-4o-mini before making the call
  
  // Prepare ailevelup.AI API request
  const requestBody = {
    phone_number: params.phoneNumber,
    task: params.task,
    voice: params.voice, // Using the voice ID directly from Supabase
    from_number: params.fromNumber || defaultFromNumber,
    model: 'turbo', // Always use turbo model for ailevelup.AI calls
    temperature: params.temperature,
    voicemail_action: params.voicemailAction || 'hangup',
    answered_by_enabled: params.answeredByEnabled !== undefined ? params.answeredByEnabled : true,
    max_duration: params.maxDuration || 300
  };
  
  // Add encrypted key if available
  if (encryptedKey) {
    requestBody.encrypted_key = encryptedKey;
  }
  
  // Add webhook URL if provided
  if (params.webhookUrl) {
    requestBody.webhook = params.webhookUrl;
  }
  
  logger.info('Making call request', {
    sessionId,
    userId,
    phoneNumber: params.phoneNumber,
    voice: params.voice,
    webhookUrl: params.webhookUrl,
    environment: process.env.NODE_ENV
  });
  
  try {
    let responseData;
    
    // Use AWS Lambda in production mode
    if (process.env.NODE_ENV === 'production') {
      const AWS = require('aws-sdk');
      const lambda = new AWS.Lambda({
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      });
      
      logger.info('Invoking Lambda function', {
        function: process.env.AWS_LAMBDA_FUNCTION || 'ailevelup-phone-call-mcp-production-make-call',
        region: process.env.AWS_REGION || 'us-east-1'
      });
      
      const lambdaParams = {
        FunctionName: process.env.AWS_LAMBDA_FUNCTION || 'ailevelup-phone-call-mcp-production-make-call',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          phoneNumber: params.phoneNumber,
          task: params.task,
          voice: params.voice,
          fromNumber: params.fromNumber || defaultFromNumber,
          maxDuration: params.maxDuration || 300,
          temperature: params.temperature || 1,
          model: 'turbo',
          voicemailAction: params.voicemailAction || 'hangup',
          answeredByEnabled: params.answeredByEnabled !== undefined ? params.answeredByEnabled : true,
          webhookUrl: params.webhookUrl
        })
      };
      
      const lambdaResponse = await lambda.invoke(lambdaParams).promise();
      
      // Check if the Lambda execution was successful
      if (lambdaResponse.FunctionError) {
        logger.error('Lambda execution failed', {
          error: lambdaResponse.FunctionError,
          payload: lambdaResponse.Payload
        });
        throw new Error(`Lambda execution failed: ${lambdaResponse.Payload}`);
      }
      
      // Parse the Lambda response payload
      responseData = JSON.parse(lambdaResponse.Payload);
      
      if (responseData.statusCode !== 200) {
        throw new Error(responseData.body ? JSON.parse(responseData.body).message : 'Failed to make call');
      }
      
      // Extract the actual response body
      if (responseData.body && typeof responseData.body === 'string') {
        responseData = JSON.parse(responseData.body);
      }
    } else {
      // Development mode - call ailevelup.AI API directly
      const response = await axios.post(
        'https://api.bland.ai/v1/calls',
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${ailevelupApiKey}`,
            'Content-Type': 'application/json',
            'X-Encrypted-Key': encryptedKey
          }
        }
      );
      
      responseData = response.data;
    }
    
    // Check for error response
    if (responseData.status === 'error') {
      logger.error('API error', {
        sessionId,
        userId,
        error: responseData.message
      });
      
      throw new Error(responseData.message || 'Failed to make call');
    }
    
    const callId = responseData.call_id;
    
    // Log the call to both Google Sheets and database
    const callData = {
      user_id: userId,
      call_id: callId,
      phone_number: params.phoneNumber,
      status: 'initiated',
      task: params.task,
      voice: params.voice,
      from_number: params.fromNumber || defaultFromNumber,
      webhook: params.webhookUrl || '',
      request_parameters: {
        phoneNumber: params.phoneNumber,
        task: params.task,
        voice: params.voice,
        maxDuration: params.maxDuration || 300,
        temperature: params.temperature || 1,
        webhookUrl: params.webhookUrl || ''
      },
      response_parameters: responseData
    };
    
    try {
      // Log to database
      const { error: dbError } = await supabase
        .from('calls')
        .insert(callData);
      
      if (dbError) {
        logger.error('Error logging call to database', { error: dbError });
      }
      
      // Log to Google Sheets
      await logCallToGoogleSheets(callData);
      
      // Deduct credits (1 credit per call for now)
      await supabase
        .from('credits')
        .update({ 
          balance: userCredits.balance - 1,
          updated_at: new Date()
        })
        .eq('user_id', userId);
      
      // Log API usage
      await supabase
        .from('api_usage')
        .insert({
          user_id: userId,
          endpoint: 'calls',
          status_code: 200,
          response_time: Date.now() - (context.startTime || Date.now()),
          credits_used: 1,
          created_at: new Date()
        });
      
    } catch (loggingError) {
      logger.error('Error in call logging', { error: loggingError });
      // Continue execution even if logging fails
    }
    
    // Return successful response
    return {
      callId: callId,
      status: 'initiated',
      message: responseData.message || 'Call initiated successfully'
    };
    
  } catch (error) {
    logger.error('Error making call', { error });
    
    // Log API usage even on error
    try {
      await supabase
        .from('api_usage')
        .insert({
          user_id: userId,
          endpoint: 'calls',
          status_code: error.response?.status || 500,
          response_time: Date.now() - (context.startTime || Date.now()),
          credits_used: 0,
          created_at: new Date()
        });
    } catch (loggingError) {
      logger.error('Error logging API usage', { error: loggingError });
    }
    
    // Rethrow with appropriate message
    throw new Error(error.response?.data?.message || error.message || 'Failed to make call');
  }
}

// Tool definition for MCP
const makePhoneCallTool = {
  name: 'makePhoneCall',
  description: 'Make an AI phone call using ailevelup.AI',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = makePhoneCallTool; 