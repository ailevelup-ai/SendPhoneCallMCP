/**
 * Call History Resource
 * 
 * This resource provides access to call history data.
 */

const { JSONSchemaValidator } = require('../lib/validators');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');

// Schema for the resource
const resourceSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for the call'
      },
      callId: {
        type: 'string',
        description: 'Bland.AI call ID'
      },
      phoneNumber: {
        type: 'string',
        description: 'Phone number that was called'
      },
      status: {
        type: 'string',
        description: 'Current status of the call',
        enum: ['initiated', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail']
      },
      duration: {
        type: 'integer',
        description: 'Call duration in seconds'
      },
      creditsUsed: {
        type: 'number',
        description: 'Number of credits used for the call'
      },
      task: {
        type: 'string',
        description: 'The task that was assigned for the call'
      },
      voice: {
        type: 'string',
        description: 'Voice used for the call'
      },
      model: {
        type: 'string',
        description: 'AI model used for the call'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the call was created'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Timestamp when the call was last updated'
      }
    }
  }
};

// Schema for filter parameters
const filtersSchema = {
  type: 'object',
  properties: {
    limit: {
      type: 'integer',
      description: 'Maximum number of records to return',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    offset: {
      type: 'integer',
      description: 'Number of records to skip',
      minimum: 0,
      default: 0
    },
    status: {
      type: 'string',
      description: 'Filter by call status',
      enum: ['initiated', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'voicemail']
    },
    startDate: {
      type: 'string',
      format: 'date',
      description: 'Filter calls on or after this date (YYYY-MM-DD)'
    },
    endDate: {
      type: 'string',
      format: 'date',
      description: 'Filter calls on or before this date (YYYY-MM-DD)'
    },
    phoneNumber: {
      type: 'string',
      description: 'Filter by phone number'
    },
    sortBy: {
      type: 'string',
      description: 'Field to sort by',
      enum: ['created_at', 'updated_at', 'status', 'duration', 'credits_used'],
      default: 'created_at'
    },
    sortOrder: {
      type: 'string',
      description: 'Sort order',
      enum: ['asc', 'desc'],
      default: 'desc'
    }
  },
  additionalProperties: false
};

// Validator for filters
const validator = new JSONSchemaValidator();

/**
 * Validate filters against schema
 * @param {Object} filters Filters to validate
 * @returns {Object|null} Validation error or null if valid
 */
function validateFilters(filters) {
  const validationResult = validator.validate(filters || {}, filtersSchema);
  
  if (!validationResult.valid) {
    return {
      message: validationResult.errors.map(err => err.stack).join('; ')
    };
  }
  
  return null;
}

/**
 * Get call history data with filters
 * @param {Object} filters Filter parameters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Array>} Array of call history records
 */
async function get(filters = {}, context) {
  const { userId } = context;
  
  // Set default values for filters
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  const sortBy = filters.sortBy || 'created_at';
  const sortOrder = filters.sortOrder || 'desc';
  
  // Start building query
  let query = supabase
    .from('calls')
    .select('*')
    .eq('user_id', userId)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);
  
  // Apply filters if provided
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters.phoneNumber) {
    query = query.eq('phone_number', filters.phoneNumber);
  }
  
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  
  if (filters.endDate) {
    // Add one day to endDate to include the end date
    const endDate = new Date(filters.endDate);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt('created_at', endDate.toISOString());
  }
  
  // Execute query
  const { data, error, count } = await query;
  
  if (error) {
    logger.error('Error fetching call history', { error, userId });
    throw new Error(`Failed to fetch call history: ${error.message}`);
  }
  
  // Transform data to match schema
  const transformedData = data.map(call => ({
    id: call.id,
    callId: call.call_id,
    phoneNumber: call.phone_number,
    status: call.status,
    duration: call.duration,
    creditsUsed: call.credits_used,
    task: call.task,
    voice: call.voice,
    model: call.model,
    createdAt: call.created_at,
    updatedAt: call.updated_at
  }));
  
  return transformedData;
}

// Resource definition for MCP
const callHistoryResource = {
  name: 'callHistory',
  description: 'Call history records',
  schema: resourceSchema,
  validateFilters,
  get
};

module.exports = callHistoryResource; 