/**
 * MCP Tool: Get Credits
 * 
 * This tool retrieves the current credit balance for the user.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters (empty object, no parameters needed)
const parametersSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false
};

// Cache settings
const CREDITS_CACHE_PREFIX = 'user_credits_';
const CACHE_TTL_SECONDS = 300; // 5 minutes

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
 * Get cache key for user credits
 * @param {string} userId User ID
 * @returns {string} Cache key
 */
function getCreditsCacheKey(userId) {
  return `${CREDITS_CACHE_PREFIX}${userId}`;
}

/**
 * Execute the getCredits tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Credit balance
 */
async function execute(params, context) {
  const { sessionId, userId } = context;

  logger.info(`Getting credit balance for user`, { 
    sessionId,
    userId
  });

  try {
    // Try to get credits from cache first
    if (redisClient.isReady) {
      try {
        const cachedCredits = await redisClient.get(getCreditsCacheKey(userId));
        if (cachedCredits) {
          logger.debug('Retrieved credits from cache', { sessionId, userId });
          return JSON.parse(cachedCredits);
        }
      } catch (cacheError) {
        logger.warn(`Error retrieving credits from cache: ${cacheError.message}`, {
          sessionId,
          userId,
          error: cacheError
        });
        // Continue with database query if cache fails
      }
    }

    // Get credits from database
    const { data: credits, error: dbError } = await supabase
      .from('credits')
      .select('balance, updated_at')
      .eq('user_id', userId)
      .single();

    if (dbError) {
      logger.error(`Database error retrieving credits: ${dbError.message}`, {
        sessionId,
        userId,
        error: dbError
      });
      
      // If the table doesn't exist or user doesn't have credits yet, return default values
      if (dbError.code === '42P01' || dbError.code === 'PGRST116') {
        const defaultCredits = {
          balance: 0,
          totalAdded: 0,
          totalUsed: 0,
          lastUpdated: new Date().toISOString()
        };
        
        logger.info(`Returning default credits for new user`, {
          sessionId,
          userId
        });
        
        return defaultCredits;
      }
      
      throw new Error(`Failed to retrieve credits: ${dbError.message}`);
    }

    // Format the response
    const creditsResponse = {
      balance: credits?.balance || 0,
      totalAdded: 0, // Default to 0 for backward compatibility
      totalUsed: 0, // Default to 0 for backward compatibility
      lastUpdated: credits?.updated_at || new Date().toISOString()
    };

    // Try to get the additional columns if they exist
    try {
      const { data: extraData, error: extraError } = await supabase
        .from('credits')
        .select('total_added, total_used')
        .eq('user_id', userId)
        .single();
        
      if (!extraError && extraData) {
        creditsResponse.totalAdded = extraData.total_added || 0;
        creditsResponse.totalUsed = extraData.total_used || 0;
      }
    } catch (extraErr) {
      // Silently handle missing columns
      logger.warn(`Credits table is missing some columns, using defaults`, {
        sessionId,
        userId
      });
    }

    // Cache the credits if Redis is available
    if (redisClient.isReady) {
      try {
        await redisClient.set(
          getCreditsCacheKey(userId),
          JSON.stringify(creditsResponse),
          { EX: CACHE_TTL_SECONDS }
        );
      } catch (cacheError) {
        logger.warn(`Failed to cache credits: ${cacheError.message}`, {
          sessionId,
          userId,
          error: cacheError
        });
        // Continue execution even if caching fails
      }
    }

    logger.info(`Successfully retrieved credit balance`, {
      sessionId,
      userId,
      balance: creditsResponse.balance
    });

    return creditsResponse;
  } catch (error) {
    logger.error(`Error executing getCredits tool: ${error.message}`, {
      sessionId,
      userId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getCreditsTool = {
  name: 'getCredits',
  description: 'Get the current credit balance for the user',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getCreditsTool; 