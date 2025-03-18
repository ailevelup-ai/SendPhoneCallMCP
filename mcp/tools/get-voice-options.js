/**
 * MCP Tool: Get Voice Options
 * 
 * This tool retrieves the available voice options for ailevelup.AI phone calls.
 */

const { JSONSchemaValidator } = require('../lib/validators');
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
    id: 'd9c372fd-31db-4c74-ac5a-d194e8e923a4',
    name: 'Alloy',
    description: 'Clear and professional voice',
    gender: 'neutral',
    useCase: 'general purpose',
    sample: 'https://api.ailevelup.ai/samples/alloy.mp3'
  },
  {
    id: '7d132ef1-c295-4b87-b27b-9f12ec64246d',
    name: 'Echo',
    description: 'Resonant and dynamic voice',
    gender: 'neutral',
    useCase: 'professional services',
    sample: 'https://api.ailevelup.ai/samples/echo.mp3'
  },
  {
    id: '0f4958b1-3765-46b3-8df3-9b10424ff0f2',
    name: 'Fable',
    description: 'Engaging storyteller voice',
    gender: 'neutral',
    useCase: 'customer service',
    sample: 'https://api.ailevelup.ai/samples/fable.mp3'
  },
  {
    id: 'a61e4166-43c9-48ec-b694-5b6747517f2f',
    name: 'Onyx',
    description: 'Deep and authoritative voice',
    gender: 'neutral',
    useCase: 'business calls',
    sample: 'https://api.ailevelup.ai/samples/onyx.mp3'
  },
  {
    id: '42f34de3-e147-4538-90e1-1302563d8b11',
    name: 'Nova',
    description: 'Warm and friendly voice',
    gender: 'neutral',
    useCase: 'information services',
    sample: 'https://api.ailevelup.ai/samples/nova.mp3'
  },
  {
    id: 'ff1ccc45-487c-4911-9351-8a95f12ba832',
    name: 'Shimmer',
    description: 'Bright and energetic voice',
    gender: 'neutral',
    useCase: 'sales and marketing',
    sample: 'https://api.ailevelup.ai/samples/shimmer.mp3'
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

    // For future implementation: call ailevelup.AI API to get the latest voice options
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