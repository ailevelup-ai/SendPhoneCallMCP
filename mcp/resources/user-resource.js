/**
 * MCP Resource: User
 * 
 * This resource provides information about the current user,
 * including their credit balance, subscription details, and settings.
 */

const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');

// Define the resource schema
const resourceSchema = {
  name: 'user',
  description: 'Information about the current user',
  schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The unique identifier for the user'
      },
      email: {
        type: 'string',
        description: 'The user\'s email address'
      },
      firstName: {
        type: 'string',
        description: 'The user\'s first name',
      },
      lastName: {
        type: 'string',
        description: 'The user\'s last name',
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the user account was created'
      },
      credits: {
        type: 'object',
        description: 'Information about the user\'s credit balance',
        properties: {
          available: {
            type: 'number',
            description: 'Number of available credits'
          },
          used: {
            type: 'number',
            description: 'Number of credits used'
          },
          lastUpdated: {
            type: 'string',
            format: 'date-time',
            description: 'When the credit balance was last updated'
          }
        }
      },
      defaultCallSettings: {
        type: 'object',
        description: 'Default settings for phone calls',
        properties: {
          voice: {
            type: 'string',
            description: 'Default voice to use for calls'
          },
          model: {
            type: 'string',
            description: 'Default model to use for calls'
          },
          temperature: {
            type: 'number',
            description: 'Default temperature setting for calls'
          },
          fromNumber: {
            type: 'string',
            description: 'Default number to call from'
          },
          voicemailAction: {
            type: 'string',
            description: 'Default action when voicemail is detected'
          }
        }
      }
    }
  }
};

/**
 * Fetch the user resource
 * @param {string} userId User ID to fetch information for
 * @returns {Promise<Object>} User resource data
 */
async function fetchUserResource(userId, sessionId) {
  logger.info(`Fetching user resource for ${userId}`, { userId, sessionId });
  
  try {
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      logger.error(`Error fetching user profile: ${profileError.message}`, {
        userId,
        sessionId,
        error: profileError
      });
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }
    
    if (!profile) {
      logger.error(`User profile not found for ${userId}`, { userId, sessionId });
      throw new Error('User profile not found');
    }
    
    // Fetch user credit balance
    const { data: credits, error: creditsError } = await supabase
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (creditsError) {
      logger.error(`Error fetching user credits: ${creditsError.message}`, {
        userId,
        sessionId,
        error: creditsError
      });
      // Continue without credits info
    }
    
    // Fetch user call settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (settingsError) {
      logger.error(`Error fetching user settings: ${settingsError.message}`, {
        userId,
        sessionId,
        error: settingsError
      });
      // Continue without settings info
    }
    
    // Format the user resource response
    const userResource = {
      id: profile.id,
      email: profile.email,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      createdAt: profile.created_at,
      credits: {
        available: credits ? credits.available_credits : 0,
        used: credits ? credits.used_credits : 0,
        lastUpdated: credits ? credits.updated_at : profile.created_at
      },
      defaultCallSettings: settings ? {
        voice: settings.default_voice || 'alloy',
        model: settings.default_model || 'gpt-4',
        temperature: settings.default_temperature || 0.7,
        fromNumber: settings.default_from_number || process.env.DEFAULT_FROM_NUMBER,
        voicemailAction: settings.default_voicemail_action || 'leave_message'
      } : {
        voice: 'alloy',
        model: 'gpt-4',
        temperature: 0.7,
        fromNumber: process.env.DEFAULT_FROM_NUMBER,
        voicemailAction: 'leave_message'
      }
    };
    
    logger.info(`Successfully fetched user resource for ${userId}`, { 
      userId, 
      sessionId
    });
    
    return userResource;
  } catch (error) {
    logger.error(`Error in fetchUserResource: ${error.message}`, {
      userId,
      sessionId,
      error
    });
    throw error;
  }
}

module.exports = {
  resourceSchema,
  fetchUserResource
}; 