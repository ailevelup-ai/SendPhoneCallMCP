/**
 * MCP Tool: Get Call Status
 * 
 * This tool retrieves the current status of a specific phone call.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const axios = require('axios');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    callId: {
      type: 'string',
      description: 'The unique identifier of the call to retrieve status for'
    }
  },
  required: ['callId'],
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
  const validationResult = validator.validate(params || {}, parametersSchema);
  
  if (!validationResult.valid) {
    return {
      message: validationResult.errors.map(err => err.stack).join('; ')
    };
  }
  
  return null;
}

/**
 * Execute the getCallStatus tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Call status information
 */
async function execute(params, context) {
  const { callId } = params;
  const { sessionId, userId } = context;

  logger.info(`Getting status for call ${callId}`, { 
    sessionId,
    userId,
    callId
  });

  try {
    // Get call details from database
    const { data: callData, error: dbError } = await supabase
      .from('call_history')
      .select('id, status, updated_at, to_number, from_number')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();

    if (dbError) {
      logger.error(`Database error retrieving call status for ${callId}`, {
        sessionId,
        userId,
        callId,
        error: dbError
      });
      throw new Error(`Failed to retrieve call status: ${dbError.message}`);
    }

    if (!callData) {
      logger.warn(`Call not found or not authorized: ${callId}`, {
        sessionId,
        userId,
        callId
      });
      throw new Error('Call not found or you are not authorized to access it');
    }
    
    // Return the call status information
    const statusResponse = {
      callId: callData.id,
      status: callData.status || 'unknown',
      lastUpdated: callData.updated_at,
      toNumber: callData.to_number,
      fromNumber: callData.from_number
    };

    logger.info(`Successfully retrieved status for call ${callId}`, {
      sessionId,
      callId,
      status: statusResponse.status
    });

    return statusResponse;
  } catch (error) {
    logger.error(`Error executing getCallStatus tool: ${error.message}`, {
      sessionId,
      callId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getCallStatusTool = {
  name: 'getCallStatus',
  description: 'Get the current status of a specific phone call',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getCallStatusTool; 