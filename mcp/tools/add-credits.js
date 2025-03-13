/**
 * MCP Tool: Add Credits
 * 
 * This tool adds credits to the user's account.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');
const { redisClient } = require('../../config/redis');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    amount: {
      type: 'number',
      description: 'Amount of credits to add',
      minimum: 0.01
    },
    description: {
      type: 'string',
      description: 'Description or reason for adding credits'
    },
    paymentId: {
      type: 'string',
      description: 'Optional payment ID or reference'
    }
  },
  required: ['amount'],
  additionalProperties: false
};

// Cache settings
const CREDITS_CACHE_PREFIX = 'user_credits_';

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
 * Execute the addCredits tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Updated credit balance
 */
async function execute(params, context) {
  const { amount, description = 'Credit purchase', paymentId } = params;
  const { sessionId, userId } = context;

  logger.info(`Adding ${amount} credits for user`, { 
    sessionId,
    userId,
    amount,
    description,
    paymentId
  });

  try {
    // Round amount to 2 decimal places to avoid floating point issues
    const roundedAmount = Math.round(amount * 100) / 100;
    
    // Start a transaction
    const { data: result, error: txError } = await supabase.rpc('add_user_credits', {
      p_user_id: userId,
      p_amount: roundedAmount,
      p_description: description,
      p_payment_id: paymentId || null
    });

    if (txError) {
      logger.error(`Transaction error adding credits: ${txError.message}`, {
        sessionId,
        userId,
        amount: roundedAmount,
        error: txError
      });
      
      // If the function doesn't exist, try to update credits directly
      if (txError.code === 'PGRST204') {
        // First, check if user has credits record
        const { data: existing, error: checkError } = await supabase
          .from('credits')
          .select('id, balance, total_added')
          .eq('user_id', userId)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') {
          throw new Error(`Failed to check existing credits: ${checkError.message}`);
        }
        
        if (existing) {
          // Update existing record
          const newBalance = (existing.balance || 0) + roundedAmount;
          const newTotalAdded = (existing.total_added || 0) + roundedAmount;
          
          const { error: updateError } = await supabase
            .from('credits')
            .update({
              balance: newBalance,
              total_added: newTotalAdded,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
            
          if (updateError) {
            throw new Error(`Failed to update credits: ${updateError.message}`);
          }
        } else {
          // Create new record
          const { error: insertError } = await supabase
            .from('credits')
            .insert({
              user_id: userId,
              balance: roundedAmount,
              total_added: roundedAmount,
              total_used: 0
            });
            
          if (insertError) {
            throw new Error(`Failed to create credits record: ${insertError.message}`);
          }
        }
        
        // Log the credit addition
        try {
          await supabase
            .from('credit_transactions')
            .insert({
              user_id: userId,
              amount: roundedAmount,
              description,
              payment_id: paymentId,
              transaction_type: 'add'
            });
        } catch (logError) {
          logger.warn(`Failed to log credit transaction: ${logError.message}`, {
            sessionId,
            userId,
            error: logError
          });
          // Continue even if logging fails
        }
      } else {
        throw new Error(`Failed to add credits: ${txError.message}`);
      }
    }

    // Get updated credit balance
    const { data: credits, error: dbError } = await supabase
      .from('credits')
      .select('balance, total_added, total_used, updated_at')
      .eq('user_id', userId)
      .single();

    if (dbError) {
      logger.error(`Database error retrieving updated credits: ${dbError.message}`, {
        sessionId,
        userId,
        error: dbError
      });
      throw new Error(`Failed to retrieve updated credits: ${dbError.message}`);
    }

    // Format the response
    const creditsResponse = {
      balance: credits?.balance || roundedAmount,
      totalAdded: credits?.total_added || roundedAmount,
      totalUsed: credits?.total_used || 0,
      lastUpdated: credits?.updated_at || new Date().toISOString(),
      amountAdded: roundedAmount
    };

    // Invalidate cache if Redis is available
    if (redisClient.isReady) {
      try {
        await redisClient.del(getCreditsCacheKey(userId));
      } catch (cacheError) {
        logger.warn(`Failed to invalidate credits cache: ${cacheError.message}`, {
          sessionId,
          userId,
          error: cacheError
        });
        // Continue execution even if cache invalidation fails
      }
    }

    logger.info(`Successfully added ${roundedAmount} credits for user`, {
      sessionId,
      userId,
      amountAdded: roundedAmount,
      newBalance: creditsResponse.balance
    });

    return creditsResponse;
  } catch (error) {
    logger.error(`Error executing addCredits tool: ${error.message}`, {
      sessionId,
      userId,
      amount,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const addCreditsTool = {
  name: 'addCredits',
  description: 'Add credits to the user\'s account',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = addCreditsTool; 