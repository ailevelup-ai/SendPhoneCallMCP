/**
 * MCP Tool: Cancel Call
 * 
 * This tool cancels an ongoing phone call through the Bland.AI API.
 */

const { JSONSchemaValidator } = require('jsonschema');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const axios = require('axios');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    callId: {
      type: 'string',
      description: 'The unique identifier of the call to cancel'
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
 * Execute the cancelCall tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Cancellation result
 */
async function execute(params, context) {
  const { callId } = params;
  const { sessionId, userId } = context;

  logger.info(`Attempting to cancel call ${callId}`, { 
    sessionId,
    userId,
    callId
  });

  try {
    // Check if call exists and belongs to user
    const { data: callData, error: dbError } = await supabase
      .from('calls')
      .select('*')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (dbError) {
      logger.error(`Database error retrieving call for cancellation: ${callId}`, {
        sessionId,
        userId,
        callId,
        error: dbError
      });
      throw new Error(`Failed to retrieve call: ${dbError.message}`);
    }

    if (!callData) {
      logger.warn(`Call not found or not authorized for cancellation: ${callId}`, {
        sessionId,
        userId,
        callId
      });
      throw new Error('Call not found or you are not authorized to cancel it');
    }

    // Check if call can be cancelled (only in_progress or queued calls can be cancelled)
    if (!['in_progress', 'queued'].includes(callData.status)) {
      logger.warn(`Cannot cancel call with status ${callData.status}`, {
        sessionId,
        userId,
        callId,
        status: callData.status
      });
      throw new Error(`Cannot cancel call with status: ${callData.status}`);
    }

    // Call Bland.AI API to cancel the call
    try {
      const response = await axios.post(
        `https://api.bland.ai/v1/calls/${callId}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Check the API response
      if (response.data && response.data.status === 'success') {
        // Update call status in database
        const { error: updateError } = await supabase
          .from('calls')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('call_id', callId);

        if (updateError) {
          logger.error(`Error updating call status after cancellation: ${callId}`, {
            sessionId,
            callId,
            error: updateError
          });
          // Continue execution despite database update error
        }

        logger.info(`Successfully cancelled call ${callId}`, {
          sessionId,
          callId
        });

        return {
          success: true,
          callId,
          status: 'cancelled',
          message: 'Call has been successfully cancelled'
        };
      } else {
        // API returned an error or unexpected response
        logger.error(`Bland.AI API error cancelling call ${callId}`, {
          sessionId,
          callId,
          response: response.data
        });
        throw new Error('Failed to cancel call: API returned an error');
      }
    } catch (apiError) {
      // Handle API request errors
      logger.error(`Error calling Bland.AI API to cancel call ${callId}`, {
        sessionId,
        callId,
        error: apiError.message
      });
      
      // If the API error indicates the call is already completed or cancelled
      if (apiError.response && apiError.response.data && 
          apiError.response.data.message && 
          (apiError.response.data.message.includes('completed') || 
           apiError.response.data.message.includes('cancelled'))) {
        
        // Update call status in database if needed
        if (callData.status !== 'cancelled' && callData.status !== 'completed') {
          const { error: updateError } = await supabase
            .from('calls')
            .update({ 
              status: 'cancelled',
              updated_at: new Date().toISOString()
            })
            .eq('call_id', callId);
            
          if (updateError) {
            logger.error(`Error updating call status after finding it's already cancelled: ${callId}`, {
              sessionId,
              callId,
              error: updateError
            });
          }
        }
        
        return {
          success: true,
          callId,
          status: 'cancelled',
          message: 'Call was already completed or cancelled'
        };
      }
      
      throw new Error(`Failed to cancel call: ${apiError.message}`);
    }
  } catch (error) {
    logger.error(`Error executing cancelCall tool: ${error.message}`, {
      sessionId,
      callId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const cancelCallTool = {
  name: 'cancelCall',
  description: 'Cancel an ongoing or queued phone call',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = cancelCallTool; 