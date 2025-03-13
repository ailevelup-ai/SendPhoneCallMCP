/**
 * MCP Tool: Get Voice Options
 * 
 * This tool retrieves the available voice options for Bland.AI phone calls.
 */

const { JSONSchemaValidator } = require('jsonschema');
const { logger } = require('../../utils/logger');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters (empty object, no parameters needed)
const parametersSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
};

// Voice options with additional metadata
const VOICE_OPTIONS = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Neutral, versatile voice with a balanced tone',
    gender: 'gender-neutral',
    useCase: 'general purpose',
    sample: 'https://api.bland.ai/samples/alloy.mp3'
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'Deep, resonant male voice with a confident tone',
    gender: 'male',
    useCase: 'professional services',
    sample: 'https://api.bland.ai/samples/echo.mp3'
  },
  {
    id: 'fable',
    name: 'Fable',
    description: 'Warm, friendly female voice with a soft tone',
    gender: 'female',
    useCase: 'customer service',
    sample: 'https://api.bland.ai/samples/fable.mp3'
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Deep, authoritative male voice with a rich tone',
    gender: 'male',
    useCase: 'business calls',
    sample: 'https://api.bland.ai/samples/onyx.mp3'
  },
  {
    id: 'nova',
    name: 'Nova',
    description: 'Clear, articulate female voice with a professional tone',
    gender: 'female',
    useCase: 'information services',
    sample: 'https://api.bland.ai/samples/nova.mp3'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'Energetic, bright female voice with an engaging tone',
    gender: 'female',
    useCase: 'sales and marketing',
    sample: 'https://api.bland.ai/samples/shimmer.mp3'
  }
];

// Cache key for voice options
const VOICE_OPTIONS_CACHE_KEY = 'voice_options';
const CACHE_TTL_SECONDS = 86400; // 24 hours

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
 * Execute the getVoiceOptions tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Voice options
 */
async function execute(params, context) {
  const { sessionId, userId } = context;

  logger.info('Getting available voice options', { 
    sessionId,
    userId
  });

  try {
    // Try to get voice options from cache first
    if (redisClient.isReady) {
      try {
        const cachedOptions = await redisClient.get(VOICE_OPTIONS_CACHE_KEY);
        if (cachedOptions) {
          logger.debug('Retrieved voice options from cache', { sessionId });
          return JSON.parse(cachedOptions);
        }
      } catch (cacheError) {
        logger.warn(`Error retrieving voice options from cache: ${cacheError.message}`, {
          sessionId,
          error: cacheError
        });
        // Continue with default options if cache fails
      }
    }

    // For future implementation: call Bland.AI API to get the latest voice options
    // For now, return the hardcoded options

    // Cache the voice options if Redis is available
    if (redisClient.isReady) {
      try {
        await redisClient.set(
          VOICE_OPTIONS_CACHE_KEY,
          JSON.stringify(VOICE_OPTIONS),
          { EX: CACHE_TTL_SECONDS }
        );
      } catch (cacheError) {
        logger.warn(`Failed to cache voice options: ${cacheError.message}`, {
          sessionId,
          error: cacheError
        });
        // Continue execution even if caching fails
      }
    }

    logger.info('Successfully retrieved voice options', {
      sessionId,
      voiceCount: VOICE_OPTIONS.length
    });

    return VOICE_OPTIONS;
  } catch (error) {
    logger.error(`Error executing getVoiceOptions tool: ${error.message}`, {
      sessionId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getVoiceOptionsTool = {
  name: 'getVoiceOptions',
  description: 'Get available voice options for phone calls',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getVoiceOptionsTool; 