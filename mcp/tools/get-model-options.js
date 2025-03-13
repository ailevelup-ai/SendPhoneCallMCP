/**
 * MCP Tool: Get Model Options
 * 
 * This tool retrieves the available AI model options for Bland.AI phone calls.
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

// Model options with additional metadata
const MODEL_OPTIONS = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    description: 'OpenAI\'s advanced model with strong reasoning capabilities',
    provider: 'OpenAI',
    costMultiplier: 1.0,
    recommendedFor: ['complex conversations', 'sales calls', 'customer support'],
    maxTemperature: 1.0
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'OpenAI\'s efficient model with good performance for standard tasks',
    provider: 'OpenAI',
    costMultiplier: 0.5,
    recommendedFor: ['simple conversations', 'information gathering', 'appointment scheduling'],
    maxTemperature: 1.0
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    description: 'Anthropic\'s most capable model with advanced reasoning',
    provider: 'Anthropic',
    costMultiplier: 1.2,
    recommendedFor: ['complex problem solving', 'nuanced conversations', 'detailed tasks'],
    maxTemperature: 1.0
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    description: 'Anthropic\'s balanced model for most use cases',
    provider: 'Anthropic',
    costMultiplier: 0.8,
    recommendedFor: ['general purpose calls', 'balanced performance', 'good cost efficiency'],
    maxTemperature: 1.0
  }
];

// Cache key for model options
const MODEL_OPTIONS_CACHE_KEY = 'model_options';
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
 * Execute the getModelOptions tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Model options
 */
async function execute(params, context) {
  const { sessionId, userId } = context;

  logger.info('Getting available model options', { 
    sessionId,
    userId
  });

  try {
    // Try to get model options from cache first
    if (redisClient.isReady) {
      try {
        const cachedOptions = await redisClient.get(MODEL_OPTIONS_CACHE_KEY);
        if (cachedOptions) {
          logger.debug('Retrieved model options from cache', { sessionId });
          return JSON.parse(cachedOptions);
        }
      } catch (cacheError) {
        logger.warn(`Error retrieving model options from cache: ${cacheError.message}`, {
          sessionId,
          error: cacheError
        });
        // Continue with default options if cache fails
      }
    }

    // For future implementation: call API to get the latest model options
    // For now, return the hardcoded options

    // Cache the model options if Redis is available
    if (redisClient.isReady) {
      try {
        await redisClient.set(
          MODEL_OPTIONS_CACHE_KEY,
          JSON.stringify(MODEL_OPTIONS),
          { EX: CACHE_TTL_SECONDS }
        );
      } catch (cacheError) {
        logger.warn(`Failed to cache model options: ${cacheError.message}`, {
          sessionId,
          error: cacheError
        });
        // Continue execution even if caching fails
      }
    }

    logger.info('Successfully retrieved model options', {
      sessionId,
      modelCount: MODEL_OPTIONS.length
    });

    return MODEL_OPTIONS;
  } catch (error) {
    logger.error(`Error executing getModelOptions tool: ${error.message}`, {
      sessionId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getModelOptionsTool = {
  name: 'getModelOptions',
  description: 'Get available AI model options for phone calls',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getModelOptionsTool; 