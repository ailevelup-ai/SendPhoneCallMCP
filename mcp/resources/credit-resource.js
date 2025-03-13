/**
 * MCP Resource: Credits
 * 
 * This resource provides information about the user's credit balance and usage history.
 */

const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');

// Define the resource schema
const resourceSchema = {
  name: 'credits',
  description: 'Information about the user\'s credit balance and usage',
  schema: {
    type: 'object',
    properties: {
      available: {
        type: 'number',
        description: 'Number of available credits'
      },
      used: {
        type: 'number',
        description: 'Total number of credits used'
      },
      usageHistory: {
        type: 'array',
        description: 'Recent credit usage history',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for this usage record'
            },
            amount: {
              type: 'number',
              description: 'Number of credits used'
            },
            description: {
              type: 'string',
              description: 'Description of what the credits were used for'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the credits were used'
            },
            callId: {
              type: 'string',
              description: 'Associated call ID if applicable'
            }
          }
        }
      },
      lastUpdated: {
        type: 'string',
        format: 'date-time',
        description: 'When the credit balance was last updated'
      }
    }
  }
};

/**
 * Fetch the credits resource
 * @param {string} userId User ID to fetch credit information for
 * @param {string} sessionId Session identifier for logging
 * @param {Object} options Query options (e.g., limit for usage history)
 * @returns {Promise<Object>} Credits resource data
 */
async function fetchCreditsResource(userId, sessionId, options = {}) {
  const limit = options.limit || 10; // Default to last 10 usage records
  
  logger.info(`Fetching credits resource for ${userId}`, { 
    userId, 
    sessionId,
    limit
  });
  
  try {
    // Fetch user's credit balance
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
      throw new Error(`Failed to fetch credit information: ${creditsError.message}`);
    }
    
    if (!credits) {
      logger.warn(`No credit information found for user ${userId}`, { 
        userId, 
        sessionId 
      });
      
      // Return default values if no credit information exists
      return {
        available: 0,
        used: 0,
        usageHistory: [],
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Fetch recent credit usage history
    const { data: usageHistory, error: usageError } = await supabase
      .from('credit_usage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (usageError) {
      logger.error(`Error fetching credit usage history: ${usageError.message}`, {
        userId,
        sessionId,
        error: usageError
      });
      // Continue without usage history
    }
    
    // Format the credits resource response
    const creditsResource = {
      available: credits.available_credits || 0,
      used: credits.used_credits || 0,
      usageHistory: (usageHistory || []).map(usage => ({
        id: usage.id,
        amount: usage.amount,
        description: usage.description,
        timestamp: usage.created_at,
        callId: usage.call_id || null
      })),
      lastUpdated: credits.updated_at
    };
    
    logger.info(`Successfully fetched credits resource for ${userId}`, { 
      userId, 
      sessionId,
      availableCredits: creditsResource.available
    });
    
    return creditsResource;
  } catch (error) {
    logger.error(`Error in fetchCreditsResource: ${error.message}`, {
      userId,
      sessionId,
      error
    });
    throw error;
  }
}

/**
 * Update user's credit balance
 * @param {string} userId User ID to update credits for
 * @param {number} amount Amount of credits to add (positive) or subtract (negative)
 * @param {string} description Description of the credit change
 * @param {string} callId Optional associated call ID
 * @param {string} sessionId Session identifier for logging
 * @returns {Promise<Object>} Updated credit information
 */
async function updateCredits(userId, amount, description, callId = null, sessionId) {
  logger.info(`Updating credits for user ${userId}: ${amount} credits`, {
    userId,
    sessionId,
    amount,
    description,
    callId
  });
  
  // Start a Supabase transaction
  const { data, error } = await supabase.rpc('update_user_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_call_id: callId
  });
  
  if (error) {
    logger.error(`Error updating credits: ${error.message}`, {
      userId,
      sessionId,
      amount,
      error
    });
    throw new Error(`Failed to update credits: ${error.message}`);
  }
  
  logger.info(`Successfully updated credits for user ${userId}`, {
    userId,
    sessionId,
    newBalance: data.available_credits
  });
  
  // Return the updated credit information
  return {
    available: data.available_credits,
    used: data.used_credits,
    lastUpdated: data.updated_at
  };
}

module.exports = {
  resourceSchema,
  fetchCreditsResource,
  updateCredits
}; 