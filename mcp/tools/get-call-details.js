/**
 * MCP Tool: Get Call Details
 * 
 * This tool retrieves detailed information about a specific call made through ailevelup.AI.
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
      description: 'The unique identifier of the call to retrieve details for'
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
 * Execute the getCallDetails tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Call details
 */
async function execute(params, context) {
  const { callId } = params;
  const { sessionId, userId } = context;

  logger.info(`Getting details for call ${callId}`, { 
    sessionId,
    userId,
    callId
  });

  try {
    // Get call details from database
    const { data: callData, error: dbError } = await supabase
      .from('calls')
      .select('*')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (dbError) {
      logger.error(`Database error retrieving call details for ${callId}`, {
        sessionId,
        userId,
        callId,
        error: dbError
      });
      throw new Error(`Failed to retrieve call details: ${dbError.message}`);
    }

    if (!callData) {
      logger.warn(`Call not found or not authorized: ${callId}`, {
        sessionId,
        userId,
        callId
      });
      throw new Error('Call not found or you are not authorized to access it');
    }

    // If call is completed or in progress, fetch additional details from ailevelup.AI
    let ailevelupAIDetails = null;
    if (['completed', 'in_progress'].includes(callData.status)) {
      try {
        const response = await axios.get(
          `https://api.bland.ai/v1/calls/${callId}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.AILEVELUP_ENTERPRISE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data && response.data.status === 'success') {
          ailevelupAIDetails = response.data.call || null;
        }
      } catch (error) {
        logger.warn(`Failed to get additional details from ailevelup.AI API for call ${callId}`, {
          sessionId,
          userId,
          error: error.message
        });
        // Continue execution even if ailevelup.AI API fails
      }
    }

    // Transform call data to match expected schema
    const callDetails = {
      id: callData.id,
      callId: callData.call_id,
      phoneNumber: callData.phone_number,
      status: callData.status,
      duration: callData.duration,
      creditsUsed: callData.credits_used,
      task: callData.task,
      voice: callData.voice,
      model: callData.model,
      temperature: callData.temperature,
      voicemailAction: callData.voicemail_action,
      fromNumber: callData.from_number,
      createdAt: callData.created_at,
      updatedAt: callData.updated_at
    };

    // Add ailevelup.AI specific details if available
    if (ailevelupAIDetails) {
      callDetails.ailevelupDetails = {
        status: ailevelupAIDetails.status,
        transcript: ailevelupAIDetails.transcript || null,
        recordingUrl: ailevelupAIDetails.recording_url || null,
        callLengthSeconds: ailevelupAIDetails.call_length_seconds || 0,
        answeredBy: ailevelupAIDetails.answered_by || null,
        cost: ailevelupAIDetails.cost || null
      };
    }

    logger.info(`Successfully retrieved details for call ${callId}`, {
      sessionId,
      callId
    });

    return callDetails;
  } catch (error) {
    logger.error(`Error executing getCallDetails tool: ${error.message}`, {
      sessionId,
      callId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getCallDetailsTool = {
  name: 'getCallDetails',
  description: 'Get detailed information about a specific phone call',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getCallDetailsTool; 