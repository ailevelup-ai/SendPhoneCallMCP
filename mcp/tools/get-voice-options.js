/**
 * MCP Tool: Get Voice Options
 * 
 * This tool retrieves the available voice options from Supabase for phone calls.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabaseAdmin } = require('../../config/supabase');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters (empty object, no parameters needed)
const parametersSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
};

// Cache key for voice options
const VOICE_OPTIONS_CACHE_KEY = 'voice_options';
const CACHE_TTL_SECONDS = 900; // 15 minutes

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

  logger.info('Getting available voice options from Supabase', { 
    sessionId,
    userId
  });

  try {
    // Try to get voice options from cache first
    if (redisClient && redisClient.isReady) {
      try {
        const cachedOptions = await redisClient.get(VOICE_OPTIONS_CACHE_KEY);
        if (cachedOptions) {
          logger.debug('Retrieved voice options from cache', { sessionId });
          return { voices: JSON.parse(cachedOptions) };
        }
      } catch (cacheError) {
        logger.warn(`Error retrieving voice options from cache: ${cacheError.message}`, {
          sessionId,
          error: cacheError
        });
        // Continue with database query if cache fails
      }
    }

    // Fetch voices from Supabase
    const { data: voices, error } = await supabaseAdmin
      .from('voices')
      .select('*')
      .eq('public', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch voices from database: ${error.message}`);
    }

    // Map the voice data to the expected format
    const formattedVoices = voices.map(voice => ({
      id: voice.id,
      name: voice.name.replace(/^Public - /, ''), // Remove "Public - " prefix if present
      description: voice.description || '',
      gender: voice.tags?.includes('female') ? 'female' : 
              voice.tags?.includes('male') ? 'male' : 'neutral',
      accent: voice.tags?.find(tag => ['american', 'british', 'australian', 'indian', 'spanish', 'french', 'german', 'italian', 'japanese', 'chinese', 'russian', 'portuguese', 'dutch', 'swedish'].includes(tag)) || 'other',
      tags: voice.tags || [],
      sample: voice.sample_url || null
    }));

    // Cache the voice options if Redis is available
    if (redisClient && redisClient.isReady) {
      try {
        await redisClient.set(
          VOICE_OPTIONS_CACHE_KEY,
          JSON.stringify(formattedVoices),
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

    logger.info('Successfully retrieved voice options from Supabase', {
      sessionId,
      voiceCount: formattedVoices.length
    });

    return { voices: formattedVoices };
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
  description: 'Get available voice options for phone calls from the Supabase database',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getVoiceOptionsTool; 