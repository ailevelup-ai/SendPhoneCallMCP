const axios = require('axios');
const { supabase } = require('../config/supabase');
const { deductCredits } = require('./billing');
const { moderateContent } = require('./content-moderation');
const logger = require('./logging');
const { getAutoTopupSettings, processAutoTopup } = require('./auto-topup');

// ailevelup.AI API configuration
const AILEVELUP_API_KEY = process.env.AILEVELUP_API_KEY;
const AILEVELUP_API_URL = process.env.AILEVELUP_API_URL || 'https://api.ailevelup.ai';

/**
 * Send a phone call using ailevelup.AI
 * @param {Object} callData - Call data including phoneNumber, script, voiceId, etc.
 * @param {string} userId - User ID making the request
 * @returns {Object} - Call details including callId and status
 */
async function sendCall(callData, userId) {
  try {
    // Validate required fields
    if (!callData.phoneNumber) {
      throw new Error('Phone number is required');
    }
    
    if (!callData.script) {
      throw new Error('Script is required');
    }

    // Moderate the call script content
    const moderationResult = await moderateContent(callData.script);
    if (!moderationResult.approved) {
      logger.warn('Content moderation failed', { 
        userId, 
        reason: moderationResult.reason,
        contentType: 'call_script'
      });
      throw new Error(`Content moderation failed: ${moderationResult.reason}`);
    }

    // Check if user has enough credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_balance')
      .eq('user_id', userId)
      .single();

    if (creditsError) {
      throw new Error(`Failed to check user credits: ${creditsError.message}`);
    }

    // Estimate call cost (simplified - in a real app, this would be more sophisticated)
    const estimatedCost = 10; // 10 credits per call as a baseline

    if (userCredits.credits_balance < estimatedCost) {
      // Check if auto top-up is enabled
      const autoTopupSettings = await getAutoTopupSettings(userId);
      
      if (autoTopupSettings.enabled && autoTopupSettings.threshold >= userCredits.credits_balance) {
        // Process auto top-up
        const topupResult = await processAutoTopup(userId);
        if (!topupResult.success) {
          throw new Error(`Insufficient credits and auto top-up failed: ${topupResult.message}`);
        }
        // Auto top-up successful, continue with call
        logger.info('Auto top-up processed before call', { userId, topupAmount: autoTopupSettings.amount });
      } else {
        throw new Error('Insufficient credits to make this call');
      }
    }

    // Prepare call data for ailevelup.AI
    const ailevelupCallData = {
      phone_number: callData.phoneNumber,
      task: callData.script,
      voice: callData.voice || defaultVoice,
      from_number: callData.fromNumber || defaultFromNumber,
      model: callData.model || defaultModel,
      temperature: callData.temperature || defaultTemperature,
      voicemail_action: callData.voicemailAction || defaultVoicemailAction,
      answered_by_enabled: callData.answeredByEnabled ?? defaultAnsweredByEnabled
    };

    // Add optional parameters if provided
    if (callData.maxDuration) ailevelupCallData.max_duration = callData.maxDuration;
    if (callData.webhookUrl) ailevelupCallData.webhook_url = callData.webhookUrl;
    if (callData.recordingEnabled !== undefined) ailevelupCallData.recording_enabled = callData.recordingEnabled;
    if (callData.amdConfig) ailevelupCallData.amd_config = callData.amdConfig;
    if (callData.transferConfig) ailevelupCallData.transfer_config = callData.transferConfig;

    // Make API call to ailevelup.AI
    const response = await axios.post(`${AILEVELUP_API_URL}/v1/calls`, ailevelupCallData, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Deduct credits for the call
    await deductCredits(userId, estimatedCost, 'phone_call');

    // Store call in database
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .insert({
        user_id: userId,
        ailevelup_call_id: response.data.call_id,
        phone_number: callData.phoneNumber,
        script: callData.script,
        status: 'initiated',
        credits_used: estimatedCost,
        metadata: callData.metadata || {},
        custom_call_id: callData.customCallId || null
      })
      .select()
      .single();

    if (callError) {
      logger.error('Failed to store call record', { userId, error: callError.message });
      // Continue anyway since the call was made successfully
    }

    // Log the call
    logger.info('Phone call initiated', {
      userId,
      callId: response.data.call_id,
      phoneNumber: callData.phoneNumber,
      creditsUsed: estimatedCost
    });

    return {
      callId: response.data.call_id,
      status: 'initiated',
      estimatedCost,
      ...response.data
    };
  } catch (error) {
    logger.error('Failed to send call', {
      userId,
      error: error.message,
      callData: { ...callData, script: 'REDACTED' } // Don't log the full script for privacy
    });

    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get call details from ailevelup.AI
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @returns {Object} - Call details
 */
async function getCallDetails(callId, userId) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to access this call');
    }

    // Get call details from ailevelup.AI
    const response = await axios.get(`${AILEVELUP_API_URL}/v1/calls/${callId}`, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`
      }
    });

    // Update call status in database if it has changed
    if (response.data.status && response.data.status !== callRecord.status) {
      const { error: updateError } = await supabase
        .from('calls')
        .update({ status: response.data.status, updated_at: new Date() })
        .eq('ailevelup_call_id', callId);

      if (updateError) {
        logger.error('Failed to update call status', { callId, error: updateError.message });
      }
    }

    return {
      ...response.data,
      metadata: callRecord.metadata,
      custom_call_id: callRecord.custom_call_id,
      credits_used: callRecord.credits_used
    };
  } catch (error) {
    logger.error('Failed to get call details', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Stop an ongoing call
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @returns {Object} - Result of the stop operation
 */
async function stopCall(callId, userId) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to stop this call');
    }

    // Stop the call via ailevelup.AI
    const response = await axios.post(`${AILEVELUP_API_URL}/v1/calls/${callId}/stop`, {}, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Update call status in database
    const { error: updateError } = await supabase
      .from('calls')
      .update({ status: 'stopped', updated_at: new Date() })
      .eq('ailevelup_call_id', callId);

    if (updateError) {
      logger.error('Failed to update call status after stopping', { callId, error: updateError.message });
    }

    logger.info('Call stopped', { userId, callId });

    return {
      success: true,
      message: 'Call stopped successfully',
      ...response.data
    };
  } catch (error) {
    logger.error('Failed to stop call', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Analyze a call using ailevelup.AI
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @param {Object} options - Analysis options
 * @returns {Object} - Analysis results
 */
async function analyzeCall(callId, userId, options = {}) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to analyze this call');
    }

    // Prepare analysis options
    const analysisOptions = {
      ...options
    };

    // Request analysis from ailevelup.AI
    const response = await axios.post(`${AILEVELUP_API_URL}/v1/calls/${callId}/analyze`, analysisOptions, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Store analysis results in database
    const { error: analysisError } = await supabase
      .from('call_analyses')
      .insert({
        call_id: callRecord.id,
        user_id: userId,
        ailevelup_call_id: callId,
        analysis_data: response.data,
        analysis_type: options.analysisType || 'standard'
      });

    if (analysisError) {
      logger.error('Failed to store call analysis', { callId, error: analysisError.message });
      // Continue anyway since the analysis was successful
    }

    logger.info('Call analyzed', { userId, callId, analysisType: options.analysisType || 'standard' });

    return response.data;
  } catch (error) {
    logger.error('Failed to analyze call', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get call recording from ailevelup.AI
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @returns {Object} - Recording URL and details
 */
async function getCallRecording(callId, userId) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to access this recording');
    }

    // Get recording from ailevelup.AI
    const response = await axios.get(`${AILEVELUP_API_URL}/v1/calls/${callId}/recording`, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`
      },
      responseType: 'stream' // Stream the response
    });

    logger.info('Call recording accessed', { userId, callId });

    return {
      stream: response.data,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length']
    };
  } catch (error) {
    logger.error('Failed to get call recording', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get corrected transcript for a call
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @returns {Object} - Transcript data
 */
async function getCorrectedTranscript(callId, userId) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to access this transcript');
    }

    // Get transcript from ailevelup.AI
    const response = await axios.get(`${AILEVELUP_API_URL}/v1/calls/${callId}/transcript`, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`
      }
    });

    // Store transcript in database if not already stored
    const { data: existingTranscript, error: checkError } = await supabase
      .from('call_transcripts')
      .select('id')
      .eq('ailevelup_call_id', callId)
      .single();

    if (!existingTranscript && !checkError) {
      const { error: transcriptError } = await supabase
        .from('call_transcripts')
        .insert({
          call_id: callRecord.id,
          user_id: userId,
          ailevelup_call_id: callId,
          transcript_data: response.data,
          transcript_type: 'corrected'
        });

      if (transcriptError) {
        logger.error('Failed to store call transcript', { callId, error: transcriptError.message });
      }
    }

    logger.info('Call transcript accessed', { userId, callId });

    return response.data;
  } catch (error) {
    logger.error('Failed to get call transcript', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get event stream for a call
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @returns {Object} - Event stream
 */
async function getEventStream(callId, userId) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to access this event stream');
    }

    // Get event stream from ailevelup.AI
    const response = await axios.get(`${AILEVELUP_API_URL}/v1/calls/${callId}/events`, {
      headers: {
        'Authorization': `Bearer ${AILEVELUP_API_KEY}`
      },
      responseType: 'stream' // Stream the response
    });

    logger.info('Call event stream accessed', { userId, callId });

    return {
      stream: response.data,
      contentType: response.headers['content-type']
    };
  } catch (error) {
    logger.error('Failed to get call event stream', { callId, userId, error: error.message });
    
    // Check if it's an API error from ailevelup.AI
    if (error.response) {
      throw new Error(`ailevelup.AI API error: ${error.response.data.message || JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get user's call history
 * @param {string} userId - User ID
 * @param {Object} options - Pagination and filtering options
 * @returns {Array} - List of calls
 */
async function getUserCallHistory(userId, options = {}) {
  try {
    const { page = 1, limit = 10, status, startDate, endDate } = options;
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('calls')
      .select('*, call_analyses(id, analysis_type, created_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data: calls, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch call history: ${error.message}`);
    }
    
    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (countError) {
      logger.error('Failed to get call count', { userId, error: countError.message });
    }
    
    return {
      calls,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    };
  } catch (error) {
    logger.error('Failed to get user call history', { userId, error: error.message });
    throw error;
  }
}

/**
 * Update call metadata
 * @param {string} callId - ailevelup.AI call ID
 * @param {string} userId - User ID making the request
 * @param {Object} metadata - New metadata to store
 * @returns {Object} - Updated call record
 */
async function updateCallMetadata(callId, userId, metadata) {
  try {
    // Verify the call belongs to the user
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('*')
      .eq('ailevelup_call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !callRecord) {
      throw new Error('Call not found or not authorized to update this call');
    }

    // Update metadata
    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update({ 
        metadata: { ...callRecord.metadata, ...metadata },
        updated_at: new Date()
      })
      .eq('ailevelup_call_id', callId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update call metadata: ${updateError.message}`);
    }

    logger.info('Call metadata updated', { userId, callId });

    return updatedCall;
  } catch (error) {
    logger.error('Failed to update call metadata', { callId, userId, error: error.message });
    throw error;
  }
}

module.exports = {
  sendCall,
  getCallDetails,
  stopCall,
  analyzeCall,
  getCallRecording,
  getCorrectedTranscript,
  getEventStream,
  getUserCallHistory,
  updateCallMetadata
}; 