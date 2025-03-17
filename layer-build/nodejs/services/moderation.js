const OpenAI = require('openai');
const { supabaseAdmin } = require('../config/supabase');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define content policy
const CONTENT_POLICY = `
This is a service that makes phone calls on behalf of users, with an AI voice.
The following content is NOT allowed:
1. Illegal activities (fraud, scams, threats, harassment)
2. Explicit sexual content
3. Hate speech or discrimination
4. Impersonation of specific individuals without consent
5. Content designed to mislead or deceive
6. Political campaigning or election interference
7. Content that may cause emotional distress
8. Content related to urgent medical emergencies
9. Content encouraging self-harm or violence
`;

/**
 * Moderate content using OpenAI
 * @param {String} content - Content to moderate
 * @returns {Object} - Moderation result with approval status and reason
 */
async function moderateContent(content) {
  try {
    // Skip moderation in development environment if configured
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_MODERATION === 'true') {
      console.log('Skipping moderation in development mode');
      return { 
        approved: true, 
        reason: 'Moderation skipped in development mode'
      };
    }

    // Use OpenAI gpt-4o-mini for content moderation
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a content moderation AI for a phone call service. Your job is to evaluate 
if the content violates the platform's content policy. ${CONTENT_POLICY}

If the content violates any policies, respond with JSON: {"approved": false, "reason": "specific reason"}
If the content is acceptable, respond with JSON: {"approved": true}

Be very careful not to approve any content that could be harmful, illegal, or violate the policy.
However, do not be overly strict with everyday business or personal communications that don't violate policies.

Explain your reasoning clearly in the reason field if rejecting content.`
        },
        {
          role: 'user',
          content: `Please evaluate this phone call prompt for content policy violations:
"${content}"`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Log moderation result
    await logModerationResult(content, result);
    
    return result;
  } catch (error) {
    console.error('Content moderation error:', error);
    
    // Default to rejection on error for safety
    return { 
      approved: false, 
      reason: 'Moderation service error - please try again later'
    };
  }
}

/**
 * Log moderation result to the database
 * @param {String} content - Content that was moderated
 * @param {Object} result - Moderation result
 */
async function logModerationResult(content, result) {
  try {
    const { data, error } = await supabaseAdmin
      .from('moderation_logs')
      .insert({
        content: content,
        approved: result.approved,
        reason: result.reason || null,
        timestamp: new Date()
      });
      
    if (error) {
      console.error('Error logging moderation result:', error);
    }
  } catch (error) {
    console.error('Moderation logging error:', error);
  }
}

/**
 * Get moderation logs with pagination and filtering
 * @param {Object} options - Pagination and filtering options
 * @returns {Array} - Moderation logs
 */
async function getModerationLogs(options = {}) {
  try {
    const {
      limit = 20,
      page = 1,
      approved = null,
      startDate = null,
      endDate = null
    } = options;
    
    let query = supabaseAdmin
      .from('moderation_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (approved !== null) {
      query = query.eq('approved', approved);
    }
    
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error('Failed to fetch moderation logs');
    }
    
    // Get total count for pagination
    const { count: totalCount } = await supabaseAdmin
      .from('moderation_logs')
      .select('*', { count: 'exact', head: true });
    
    return {
      logs: data,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Get moderation logs error:', error);
    throw error;
  }
}

/**
 * Get moderation stats for analytics
 * @param {String} startDate - Start date for stats period
 * @param {String} endDate - End date for stats period
 * @returns {Object} - Moderation stats
 */
async function getModerationStats(startDate = null, endDate = null) {
  try {
    let query = supabaseAdmin
      .from('moderation_logs')
      .select('*');
    
    if (startDate) {
      query = query.gte('timestamp', startDate);
    }
    
    if (endDate) {
      query = query.lte('timestamp', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error('Failed to fetch moderation stats');
    }
    
    // Calculate stats
    const total = data.length;
    const approved = data.filter(log => log.approved).length;
    const rejected = total - approved;
    
    // Group rejections by reason
    const rejectionReasons = {};
    data.forEach(log => {
      if (!log.approved && log.reason) {
        const reason = log.reason;
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      }
    });
    
    // Sort rejection reasons by frequency
    const sortedReasons = Object.entries(rejectionReasons)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }));
    
    return {
      total,
      approved,
      rejected,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
      rejectionReasons: sortedReasons
    };
  } catch (error) {
    console.error('Get moderation stats error:', error);
    throw error;
  }
}

/**
 * Update content policy
 * @param {String} newPolicy - New content policy
 * @returns {Object} - Updated policy
 */
async function updateContentPolicy(newPolicy) {
  try {
    // In a real implementation, this would update the policy in a database
    // For now, we'll just log it
    console.log('Content policy updated:', newPolicy);
    
    // This would be stored in a configuration table
    const { data, error } = await supabaseAdmin
      .from('config')
      .upsert({
        key: 'content_policy',
        value: newPolicy,
        updated_at: new Date()
      })
      .select()
      .single();
      
    if (error) {
      throw new Error('Failed to update content policy');
    }
    
    return { 
      success: true, 
      policy: newPolicy 
    };
  } catch (error) {
    console.error('Update content policy error:', error);
    throw error;
  }
}

module.exports = {
  moderateContent,
  logModerationResult,
  getModerationLogs,
  getModerationStats,
  updateContentPolicy,
  CONTENT_POLICY
}; 