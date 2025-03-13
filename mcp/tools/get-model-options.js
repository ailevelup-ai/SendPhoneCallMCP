/**
 * MCP Tool: Get Model Options
 * 
 * This tool explains the fixed model approach for ailevelup.AI phone calls.
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

const modelOptions = [
  {
    id: 'turbo',
    name: 'Turbo',
    description: 'Fast and efficient model for real-time phone conversations',
    isDefault: true,
    details: 'For content moderation/safety checks, we use gpt-4o-mini. For the actual phone calls via ailevelup.AI, we use the turbo model.',
    useCase: 'All phone calls'
  }
];

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
 * @returns {Promise<Object>} Model information
 */
async function execute(params, context) {
  const { sessionId, userId } = context;

  logger.info('Getting model information', { 
    sessionId,
    userId
  });

  try {
    logger.info('Successfully retrieved model information', {
      sessionId
    });

    return modelOptions;
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
  description: 'Get information about the system\'s model approach for phone calls',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getModelOptionsTool; 