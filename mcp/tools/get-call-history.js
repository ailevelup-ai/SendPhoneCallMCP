/**
 * MCP Tool: Get Call History
 * 
 * This tool retrieves the call history for the current user.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');

// Schema for tool parameters
const parametersSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of results to return (default: 10, max: 100)',
      minimum: 1,
      maximum: 100
    },
    offset: {
      type: 'integer',
      description: 'Number of results to skip for pagination (default: 0)',
      minimum: 0
    },
    status: {
      type: 'string',
      description: 'Filter by call status (e.g., completed, in_progress, failed)',
      enum: ['completed', 'in_progress', 'failed', 'cancelled', 'scheduled']
    },
    fromDate: {
      type: 'string',
      format: 'date-time',
      description: 'Start date for filtering (ISO format)'
    },
    toDate: {
      type: 'string',
      format: 'date-time',
      description: 'End date for filtering (ISO format)'
    },
    sortBy: {
      type: 'string',
      description: 'Field to sort by',
      enum: ['created_at', 'status', 'duration', 'cost']
    },
    sortOrder: {
      type: 'string',
      description: 'Sort order (ascending or descending)',
      enum: ['asc', 'desc']
    }
  },
  additionalProperties: false
};

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
 * Execute the getCallHistory tool
 * @param {Object} params The tool parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Call history results
 */
async function execute(params, context) {
  const { 
    limit = 10, 
    offset = 0, 
    status, 
    fromDate, 
    toDate, 
    sortBy = 'created_at', 
    sortOrder = 'desc'
  } = params || {};
  
  const { sessionId, userId } = context;

  logger.info(`Getting call history for user`, { 
    sessionId,
    userId,
    limit,
    offset,
    status,
    fromDate,
    toDate,
    sortBy,
    sortOrder
  });

  try {
    // Build query
    let query = supabase
      .from('call_history')
      .select(`
        id,
        to_number,
        from_number,
        voice_id,
        model_id,
        temperature,
        status,
        duration,
        cost,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }
    
    if (toDate) {
      query = query.lte('created_at', toDate);
    }
    
    // Execute query
    const { data: calls, error: dbError, count } = await query;

    if (dbError) {
      logger.error(`Database error retrieving call history`, {
        sessionId,
        userId,
        error: dbError
      });
      throw new Error(`Failed to retrieve call history: ${dbError.message}`);
    }

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('call_history')
      .select('id', { count: 'exact' })
      .eq('user_id', userId);
    
    if (countError) {
      logger.warn(`Error getting total count: ${countError.message}`, {
        sessionId,
        userId
      });
      // Continue with results even if count fails
    }
    
    // Format the response
    const callHistory = {
      calls: calls || [],
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        hasMore: calls && calls.length === limit
      }
    };

    logger.info(`Successfully retrieved call history`, {
      sessionId,
      userId,
      callCount: calls ? calls.length : 0
    });

    return callHistory;
  } catch (error) {
    logger.error(`Error executing getCallHistory tool: ${error.message}`, {
      sessionId,
      userId,
      error
    });
    throw error;
  }
}

// Tool definition for MCP
const getCallHistoryTool = {
  name: 'getCallHistory',
  description: 'Get the call history for the current user',
  parameters: parametersSchema,
  validateParameters,
  execute
};

module.exports = getCallHistoryTool; 