/**
 * MCP Tool: Update Call Preferences
 * 
 * This tool updates a user's default preferences for phone calls.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    defaultVoice: {
      type: 'string',
      description: 'Default voice to use for calls'
    },
    defaultModel: {
      type: 'string',
      description: 'Default AI model to use for calls'
    },
    defaultTemperature: {
      type: 'number',
      description: 'Default temperature setting for AI model (0.0-1.0)',
      minimum: 0,
      maximum: 1
    },
    defaultFromNumber: {
      type: 'string',
      description: 'Default phone number to make calls from'
    },
    defaultVoicemailAction: {
      type: 'string',
      description: 'Default action when voicemail is detected',
      enum: ['leave_message', 'hang_up', 'retry_later']
    }
  },
  additionalProperties: false,
  minProperties: 1
};

// Valid voice and model options
const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const VALID_MODELS = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];

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
  
  // Additional validation for specific fields
  if (params.defaultVoice && !VALID_VOICES.includes(params.defaultVoice)) {
    return {
      message: `Invalid voice option. Valid voices are: ${VALID_VOICES.join(', ')}`
    };
  }
  
  if (params.defaultModel && !VALID_MODELS.includes(params.defaultModel)) {
    return {
      message: `Invalid model option. Valid models are: ${VALID_MODELS.join(', ')}`
    };
  }
  
  if (params.defaultFromNumber && !/^\+\d{10,15}$/.test(params.defaultFromNumber)) {
    return {
      message: 'Invalid phone number format. Must be in E.164 format (e.g., +12345678901)'
    };
  }
  
  return null;
}

/**
 * Get the cache key for user settings
 * @param {string} userId User ID
 * @returns {string} Redis cache key
 */
function getUserSettingsCacheKey(userId) {
  return `user_settings:${userId}`;
}

/**
 * Execute the updateCallPreferences tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Updated call preferences
 */
async function execute(params, context) {
  const { sessionId, userId } = context;

  logger.info(`Updating call preferences for user ${userId}`, { 
    sessionId,
    userId,
    paramsProvided: Object.keys(params)
  });

  try {
    // First, check if user has settings already
    const { data: existingSettings, error: fetchError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Not finding the record is ok
      logger.error(`Database error fetching user settings: ${fetchError.message}`, {
        sessionId,
        userId,
        error: fetchError
      });
      throw new Error(`Failed to fetch user settings: ${fetchError.message}`);
    }

    // Convert params to database column names
    const settingsToUpdate = {};
    
    if (params.defaultVoice) settingsToUpdate.default_voice = params.defaultVoice;
    if (params.defaultModel) settingsToUpdate.default_model = params.defaultModel;
    if (params.defaultTemperature !== undefined) settingsToUpdate.default_temperature = params.defaultTemperature;
    if (params.defaultFromNumber) settingsToUpdate.default_from_number = params.defaultFromNumber;
    if (params.defaultVoicemailAction) settingsToUpdate.default_voicemail_action = params.defaultVoicemailAction;

    let result;
    
    // Insert or update user settings
    if (existingSettings) {
      // Update existing settings
      const { data, error: updateError } = await supabase
        .from('user_settings')
        .update({
          ...settingsToUpdate,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select();
      
      if (updateError) {
        logger.error(`Error updating user settings: ${updateError.message}`, {
          sessionId,
          userId,
          error: updateError
        });
        throw new Error(`Failed to update call preferences: ${updateError.message}`);
      }
      
      result = data[0];
    } else {
      // Insert new settings
      const { data, error: insertError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          ...settingsToUpdate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        logger.error(`Error inserting user settings: ${insertError.message}`, {
          sessionId,
          userId,
          error: insertError
        });
        throw new Error(`Failed to create call preferences: ${insertError.message}`);
      }
      
      result = data[0];
    }

    // Update cache if Redis is available
    if (redisClient.isReady) {
      try {
        await redisClient.set(
          getUserSettingsCacheKey(userId),
          JSON.stringify(result),
          { EX: 3600 } // Cache for 1 hour
        );
      } catch (cacheError) {
        logger.warn(`Failed to update user settings cache: ${cacheError.message}`, {
          sessionId,
          userId,
          error: cacheError
        });
        // Continue execution even if caching fails
      }
    }

    // Format the response
    const updatedPreferences = {
      defaultVoice: result.default_voice,
      defaultModel: result.default_model,
      defaultTemperature: result.default_temperature,
      defaultFromNumber: result.default_from_number,
      defaultVoicemailAction: result.default_voicemail_action,
      updatedAt: result.updated_at
    };

    logger.info(`Successfully updated call preferences for user ${userId}`, {
      sessionId,
      userId,
      updatedFields: Object.keys(settingsToUpdate)
    });

    return updatedPreferences;
  } catch (error) {
    logger.error(`Error executing updateCallPreferences tool: ${error.message}`, {
      sessionId,
      userId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const updateCallPreferencesTool = {
  name: 'updateCallPreferences',
  description: 'Update default preferences for phone calls',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = updateCallPreferencesTool; 