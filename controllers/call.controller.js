const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { checkBalance, deductCredits } = require('../services/billing');
const { moderateContent } = require('../services/moderation');
const { logCallToGoogleSheets } = require('../services/logging');

// Bland.AI API configuration
const BLAND_API_BASE_URL = 'https://api.bland.ai/v1';
const BLAND_API_KEY = process.env.BLAND_ENTERPRISE_API_KEY;

/**
 * Send a new call
 */
const sendCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const callParams = req.body;

    // Validate required parameters
    if (!callParams.phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    if (!callParams.voice || !callParams.prompt) {
      return res.status(400).json({ error: 'Voice and prompt are required' });
    }

    // Check if user has sufficient credit balance
    const { balance, hasFreeTier } = await checkBalance(userId);
    
    if (balance <= 0 && !hasFreeTier) {
      return res.status(403).json({ 
        error: 'Insufficient credits',
        balance,
        minDeposit: 20.00 // $20 minimum deposit
      });
    }

    // Moderate the content
    const { approved, reason } = await moderateContent(callParams.prompt);
    
    if (!approved) {
      return res.status(403).json({ 
        error: 'Content moderation failed', 
        reason
      });
    }

    // Prepare parameters for Bland.AI API
    const blandParams = {
      ...callParams,
      api_key: BLAND_API_KEY
    };

    // Make the request to Bland.AI API
    const response = await axios.post(`${BLAND_API_BASE_URL}/calls`, blandParams);
    
    if (!response.data || !response.data.call_id) {
      throw new Error('Invalid response from Bland.AI API');
    }

    const callId = response.data.call_id;

    // Store call data in our database
    await supabaseAdmin
      .from('calls')
      .insert({
        id: callId,
        user_id: userId,
        phone_number: maskPhoneNumber(callParams.phone_number),
        voice: callParams.voice,
        prompt: callParams.prompt,
        status: 'initiated',
        webhook_url: callParams.webhook_url || null,
        created_at: new Date()
      });

    // Log the call to Google Sheets
    await logCallToGoogleSheets({
      timestamp: new Date(),
      apiKey: req.headers['x-api-key'],
      userId,
      callId,
      phoneNumber: maskPhoneNumber(callParams.phone_number),
      callDuration: 0,
      callStatus: 'initiated',
      creditsUsed: 0,
      webhookUrl: callParams.webhook_url || '',
      voiceUsed: callParams.voice,
      moderationStatus: 'approved',
      errorMessages: ''
    });

    res.status(201).json({
      message: 'Call initiated successfully',
      call_id: callId,
      status: 'initiated'
    });
  } catch (error) {
    console.error('Send call error:', error);
    
    // Log error to Google Sheets if possible
    try {
      if (req.user && req.user.id) {
        await logCallToGoogleSheets({
          timestamp: new Date(),
          apiKey: req.headers['x-api-key'],
          userId: req.user.id,
          callId: 'ERROR',
          phoneNumber: maskPhoneNumber(req.body.phone_number || ''),
          callDuration: 0,
          callStatus: 'error',
          creditsUsed: 0,
          webhookUrl: req.body.webhook_url || '',
          voiceUsed: req.body.voice || '',
          moderationStatus: 'n/a',
          errorMessages: error.message || 'Unknown error'
        });
      }
    } catch (logError) {
      console.error('Error logging call failure:', logError);
    }
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to initiate call' });
  }
};

/**
 * Analyze a call
 */
const analyzeCall = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;
    const analysisParams = req.body;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }

    // Forward the request to Bland.AI API
    const response = await axios.post(
      `${BLAND_API_BASE_URL}/calls/${callId}/analyze`, 
      {
        ...analysisParams,
        api_key: BLAND_API_KEY
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Analyze call error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to analyze call' });
  }
};

/**
 * Stop a call
 */
const stopCall = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, status')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }
    
    if (callData.status === 'completed' || callData.status === 'failed') {
      return res.status(400).json({ error: 'Call already ended' });
    }

    // Forward the request to Bland.AI API
    const response = await axios.post(
      `${BLAND_API_BASE_URL}/calls/${callId}/stop`, 
      { api_key: BLAND_API_KEY }
    );
    
    // Update call status in our database
    await supabaseAdmin
      .from('calls')
      .update({ 
        status: 'stopped',
        updated_at: new Date()
      })
      .eq('id', callId);

    // Get call details to determine duration
    const callDetailsResponse = await axios.get(
      `${BLAND_API_BASE_URL}/calls/${callId}`,
      { params: { api_key: BLAND_API_KEY } }
    );
    
    const duration = calculateCallDuration(callDetailsResponse.data);
    
    // Deduct credits based on call duration
    if (duration > 0) {
      await deductCredits(userId, callId, duration);
    }

    res.json({
      message: 'Call stopped successfully',
      ...response.data
    });
  } catch (error) {
    console.error('Stop call error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to stop call' });
  }
};

/**
 * Get call details
 */
const getCallDetails = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }

    // Forward the request to Bland.AI API
    const response = await axios.get(
      `${BLAND_API_BASE_URL}/calls/${callId}`,
      { params: { api_key: BLAND_API_KEY } }
    );
    
    // Update call status in our database if it has changed
    if (response.data && response.data.status) {
      await supabaseAdmin
        .from('calls')
        .update({ 
          status: response.data.status,
          updated_at: new Date()
        })
        .eq('id', callId);
      
      // If call is completed, calculate duration and deduct credits
      if (response.data.status === 'completed' && response.data.ended_at) {
        const duration = calculateCallDuration(response.data);
        
        if (duration > 0) {
          await deductCredits(userId, callId, duration);
        }
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error('Get call details error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to get call details' });
  }
};

/**
 * Get call event stream
 */
const getEventStream = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }
    
    // Set up headers for event stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Set up client disconnection handler
    const clientClosed = new Promise((resolve) => {
      req.on('close', resolve);
    });
    
    // Create event source from Bland.AI
    const streamUrl = `${BLAND_API_BASE_URL}/event_stream/${callId}?api_key=${BLAND_API_KEY}`;
    
    // Set up axios to stream the response
    const axiosResponse = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream'
    });
    
    const stream = axiosResponse.data;
    
    // Forward the stream to the client
    stream.on('data', (chunk) => {
      res.write(chunk);
    });
    
    stream.on('end', () => {
      res.end();
    });
    
    stream.on('error', (err) => {
      console.error('Event stream error:', err);
      res.end();
    });
    
    // Clean up when client disconnects
    await clientClosed;
    if (stream) {
      stream.destroy();
    }
  } catch (error) {
    console.error('Get event stream error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to get event stream' });
  }
};

/**
 * Get call recording
 */
const getCallRecording = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }

    // Forward the request to Bland.AI API
    const response = await axios.get(
      `${BLAND_API_BASE_URL}/calls/${callId}/recording`,
      { 
        params: { api_key: BLAND_API_KEY },
        responseType: 'stream'
      }
    );
    
    // Forward the headers
    Object.keys(response.headers).forEach(header => {
      res.setHeader(header, response.headers[header]);
    });
    
    // Pipe the response stream to our response
    response.data.pipe(res);
  } catch (error) {
    console.error('Get call recording error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to get call recording' });
  }
};

/**
 * Get corrected transcripts
 */
const getCorrectedTranscripts = async (req, res) => {
  try {
    const callId = req.params.callId;
    const userId = req.user.id;

    // Verify that call belongs to user
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id')
      .eq('id', callId)
      .eq('user_id', userId)
      .single();
    
    if (callError || !callData) {
      return res.status(404).json({ error: 'Call not found or access denied' });
    }

    // Forward the request to Bland.AI API
    const response = await axios.get(
      `${BLAND_API_BASE_URL}/calls/${callId}/correct`,
      { params: { api_key: BLAND_API_KEY } }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Get corrected transcripts error:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Error from Bland.AI API',
        details: error.response.data
      });
    }
    
    res.status(500).json({ error: 'Failed to get corrected transcripts' });
  }
};

/**
 * Helper function to mask phone number for privacy
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove any non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Keep country code and last 4 digits, mask the rest
  if (digits.length > 4) {
    const countryCode = digits.slice(0, digits.length - 10) || '';
    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - countryCode.length - 4);
    return `${countryCode}${masked}${lastFour}`;
  }
  
  return phoneNumber; // Return original if too short
}

/**
 * Helper function to calculate call duration in minutes
 */
function calculateCallDuration(callData) {
  if (!callData || !callData.started_at || !callData.ended_at) {
    return 0;
  }
  
  const startTime = new Date(callData.started_at);
  const endTime = new Date(callData.ended_at);
  
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    return 0;
  }
  
  // Calculate duration in minutes, rounded up to nearest minute
  const durationMs = endTime - startTime;
  const durationMinutes = Math.ceil(durationMs / (1000 * 60));
  
  return durationMinutes;
}

module.exports = {
  sendCall,
  analyzeCall,
  stopCall,
  getCallDetails,
  getEventStream,
  getCallRecording,
  getCorrectedTranscripts
}; 