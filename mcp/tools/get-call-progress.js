/**
 * MCP Tool: Get Call Progress
 * 
 * This tool retrieves progress information for long-running call operations,
 * including status updates, transcript snippets, and time elapsed.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const axios = require('axios');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    callId: {
      type: 'string',
      description: 'The unique identifier of the call to track progress for'
    },
    includeTranscript: {
      type: 'boolean',
      description: 'Whether to include partial transcript in the progress update',
      default: false
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
 * Get progress cache key for a call
 * @param {string} callId Call ID
 * @returns {string} Redis cache key
 */
function getProgressCacheKey(callId) {
  return `call_progress:${callId}`;
}

/**
 * Execute the getCallProgress tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Call progress information
 */
async function execute(params, context) {
  const { callId, includeTranscript = false } = params;
  const { sessionId, userId } = context;

  logger.info(`Getting progress for call ${callId}`, { 
    sessionId,
    userId,
    callId,
    includeTranscript
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
      logger.error(`Database error retrieving call for progress: ${callId}`, {
        sessionId,
        userId,
        callId,
        error: dbError
      });
      throw new Error(`Failed to retrieve call: ${dbError.message}`);
    }

    if (!callData) {
      logger.warn(`Call not found or not authorized: ${callId}`, {
        sessionId,
        userId,
        callId
      });
      throw new Error('Call not found or you are not authorized to access it');
    }

    // Check if call is in a state where progress is relevant
    if (!['queued', 'in_progress'].includes(callData.status)) {
      logger.info(`Call ${callId} is not in progress (status: ${callData.status})`, {
        sessionId,
        callId,
        status: callData.status
      });
      
      // For completed calls, return details but mark as complete
      return {
        callId,
        status: callData.status,
        isComplete: true,
        elapsedTime: callData.duration || 0,
        startedAt: callData.started_at || callData.created_at,
        completedAt: callData.updated_at,
        progressPercentage: 100,
        currentState: 'completed',
        message: `Call has been ${callData.status}`
      };
    }

    // Try to get progress from cache first
    let progressData = null;
    if (redisClient.isReady) {
      try {
        const cachedProgress = await redisClient.get(getProgressCacheKey(callId));
        if (cachedProgress) {
          progressData = JSON.parse(cachedProgress);
          logger.debug(`Retrieved progress data from cache for call ${callId}`, {
            sessionId,
            callId
          });
        }
      } catch (cacheError) {
        logger.warn(`Error retrieving progress cache for call ${callId}`, {
          sessionId,
          callId,
          error: cacheError.message
        });
        // Continue without cache
      }
    }

    // If call is in progress, try to get live status from Bland.AI
    let blandAIDetails = null;
    let transcript = null;
    
    if (callData.status === 'in_progress') {
      try {
        const response = await axios.get(
          `https://api.bland.ai/v1/calls/${callId}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data && response.data.status === 'success') {
          blandAIDetails = response.data.call || null;
          
          if (blandAIDetails && includeTranscript) {
            transcript = blandAIDetails.transcript || '';
          }
          
          // Update progress cache if we have new data
          if (blandAIDetails && redisClient.isReady) {
            const updatedProgress = {
              status: blandAIDetails.status,
              lastUpdated: new Date().toISOString(),
              callLengthSeconds: blandAIDetails.call_length_seconds || 0,
              answeredBy: blandAIDetails.answered_by || null,
              currentState: blandAIDetails.status === 'in_progress' ? 'on_call' : blandAIDetails.status
            };
            
            // Cache for 30 seconds
            await redisClient.set(
              getProgressCacheKey(callId), 
              JSON.stringify(updatedProgress), 
              { EX: 30 }
            );
          }
        }
      } catch (apiError) {
        logger.warn(`Failed to get live status from Bland.AI API for call ${callId}`, {
          sessionId,
          callId,
          error: apiError.message
        });
        // Continue with cached data if available
      }
    }

    // Calculate elapsed time
    const startTime = callData.started_at ? new Date(callData.started_at) : new Date(callData.created_at);
    const currentTime = new Date();
    const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
    
    // Determine progress percentage (estimate based on call status)
    let progressPercentage = 0;
    let currentState = '';
    let message = '';
    
    if (callData.status === 'queued') {
      progressPercentage = 10;
      currentState = 'queued';
      message = 'Call is queued and waiting to be initiated';
    } else if (callData.status === 'in_progress') {
      // If we have Bland.AI details, use them
      if (blandAIDetails) {
        if (blandAIDetails.status === 'in_progress') {
          progressPercentage = 50; // Mid-call
          currentState = 'on_call';
          message = 'Call is currently in progress';
        } else if (blandAIDetails.status === 'completed') {
          progressPercentage = 100;
          currentState = 'completed';
          message = 'Call has completed';
        } else {
          progressPercentage = 25; // Early stages
          currentState = blandAIDetails.status;
          message = `Call is in state: ${blandAIDetails.status}`;
        }
      } 
      // If no Bland.AI details but we have cached progress
      else if (progressData) {
        progressPercentage = progressData.callLengthSeconds > 0 ? 50 : 25;
        currentState = progressData.currentState;
        message = `Call is in state: ${progressData.currentState}`;
      } 
      // Fallback if no details
      else {
        progressPercentage = 25;
        currentState = 'in_progress';
        message = 'Call is in progress';
      }
    }

    // Construct progress response
    const progress = {
      callId,
      status: callData.status,
      isComplete: false,
      elapsedTime: blandAIDetails?.call_length_seconds || progressData?.callLengthSeconds || elapsedSeconds,
      startedAt: callData.started_at || callData.created_at,
      progressPercentage,
      currentState,
      message
    };
    
    // Add transcript if requested and available
    if (includeTranscript && transcript) {
      progress.transcript = transcript;
    }
    
    // Add additional details if available
    if (blandAIDetails) {
      progress.answeredBy = blandAIDetails.answered_by || null;
    } else if (progressData && progressData.answeredBy) {
      progress.answeredBy = progressData.answeredBy;
    }

    logger.info(`Successfully retrieved progress for call ${callId}`, {
      sessionId,
      callId,
      progressPercentage,
      currentState
    });

    return progress;
  } catch (error) {
    logger.error(`Error executing getCallProgress tool: ${error.message}`, {
      sessionId,
      callId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getCallProgressTool = {
  name: 'getCallProgress',
  description: 'Get progress information for an ongoing phone call',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getCallProgressTool; 