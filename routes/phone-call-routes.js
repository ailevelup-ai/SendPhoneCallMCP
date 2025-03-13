const express = require('express');
const router = express.Router();
const { default: fetch } = require('node-fetch');
const { validateApiKey } = require('../middlewares/auth');
const { moderateContent } = require('../services/content-moderation');
const { logCallToGoogleSheets } = require('../google-sheets-logging');
const { supabaseAdmin } = require('../config/supabase');

// Get API URL from environment variables
const AILEVELUP_API_URL = process.env.AILEVELUP_API_URL || 'https://api.ailevelup.ai';

// Make a phone call
router.post('/call', validateApiKey, async (req, res) => {
  try {
    const {
      phone_number,
      task,
      voice = process.env.AILEVELUP_DEFAULT_VOICE || 'nat',
      webhook_url,
      from_number = process.env.AILEVELUP_DEFAULT_FROM_NUMBER,
      model = process.env.AILEVELUP_DEFAULT_MODEL || 'turbo',
      temperature = parseFloat(process.env.AILEVELUP_DEFAULT_TEMPERATURE) || 1,
      voicemail_action = process.env.AILEVELUP_DEFAULT_VOICEMAIL_ACTION || 'hangup',
      answered_by_enabled = process.env.AILEVELUP_ANSWERED_BY_ENABLED === 'true',
      max_duration
    } = req.body;

    // Validate required fields
    if (!phone_number || !task) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['phone_number', 'task']
      });
    }

    // Check user credits
    if (req.userCredits < 1) {
      return res.status(402).json({
        error: 'Insufficient credits',
        credits: req.userCredits
      });
    }

    // Calculate max_duration based on remaining credits (if not provided)
    // Each credit is roughly equivalent to 1 minute of call time
    const calculatedMaxDuration = max_duration || req.userCredits;

    // Moderate content
    const moderationResult = await moderateContent(task);
    if (!moderationResult.isAllowed) {
      return res.status(400).json({
        error: 'Content moderation failed',
        reason: moderationResult.reason
      });
    }

    console.log('Making call to ailevelup.AI:', {
      phone_number,
      task,
      voice,
      webhook_url,
      from_number,
      model,
      temperature,
      voicemail_action,
      answered_by_enabled,
      max_duration: calculatedMaxDuration
    });

    // Make the call using ailevelup.AI API
    const response = await fetch(`${AILEVELUP_API_URL}/v1/calls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AILEVELUP_ENTERPRISE_API_KEY}`,
        'X-Encrypted-Key': process.env.AILEVELUP_ENCRYPTED_KEY
      },
      body: JSON.stringify({
        phone_number,
        task,
        voice,
        webhook_url,
        from_number,
        model,
        temperature,
        voicemail_action,
        answered_by_enabled,
        max_duration: calculatedMaxDuration
      })
    });

    const callData = await response.json();
    console.log('ailevelup.AI response:', callData);

    if (!response.ok) {
      console.error('ailevelup.AI API error:', {
        status: response.status,
        statusText: response.statusText,
        data: callData
      });
      throw new Error(callData.error || callData.message || 'Failed to make call');
    }

    // Reserve 1 credit initially, may be adjusted later based on actual call duration
    const creditsToReserve = 1;

    // Log call to database
    const { data: call, error: dbError } = await supabaseAdmin
      .from('calls')
      .insert({
        user_id: req.user.id,
        call_id: callData.call_id,
        phone_number,
        status: 'initiated',
        task,
        voice,
        from_number,
        model,
        temperature,
        voicemail_action,
        answered_by_enabled,
        max_duration: calculatedMaxDuration,
        credits_used: creditsToReserve,
        update_status: 'Pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error logging call to database:', dbError);
    }

    // Deduct initial credits
    const { error: creditError } = await supabaseAdmin
      .from('credits')
      .update({
        balance: req.userCredits - creditsToReserve,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.user.id);

    if (creditError) {
      console.error('Error updating credits:', creditError);
    }

    // Log API usage
    await supabaseAdmin
      .from('api_usage')
      .insert({
        user_id: req.user.id,
        endpoint: '/call',
        status_code: 200,
        credits_used: creditsToReserve
      })
      .then(({ error }) => {
        if (error) console.error('Error logging API usage:', error);
      });

    // Log to Google Sheets
    await logCallToGoogleSheets({
      api_key: req.user.api_key,
      user_id: req.user.id,
      call_id: callData.call_id || 'error',
      phone_number,
      call_status: 'initiated',
      task,
      voice,
      from_number,
      model,
      temperature,
      voicemail_action,
      answered_by_enabled,
      max_duration: calculatedMaxDuration,
      credits_used: creditsToReserve,
      webhook: webhook_url,
      request_parameters: req.body,
      response_parameters: callData
    });

    // Return response
    res.json({
      success: true,
      call_id: callData.call_id,
      status: 'initiated',
      credits_remaining: req.userCredits - creditsToReserve,
      max_duration: calculatedMaxDuration,
      ...callData
    });
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({
      error: 'Failed to make call',
      message: error.message,
      details: error.response ? await error.response.json() : undefined
    });
  }
});

// Get call status
router.get('/call/:callId', validateApiKey, async (req, res) => {
  try {
    const { callId } = req.params;

    const { data: call, error } = await supabaseAdmin
      .from('calls')
      .select('*')
      .eq('call_id', callId)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (call.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this call' });
    }

    res.json(call);
  } catch (error) {
    console.error('Error getting call status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user call history
router.get('/calls', validateApiKey, async (req, res) => {
  try {
    const { 
      limit = 10, 
      offset = 0,
      status = null,
      from_date = null,
      to_date = null,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = supabaseAdmin
      .from('calls')
      .select('*')
      .eq('user_id', req.user.id)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (from_date) {
      query = query.gte('created_at', from_date);
    }
    
    if (to_date) {
      query = query.lte('created_at', to_date);
    }

    const { data: calls, error, count } = await query;

    if (error) {
      console.error('Error fetching call history:', error);
      return res.status(500).json({ error: 'Server error' });
    }

    // Get total count
    const { count: total, error: countError } = await supabaseAdmin
      .from('calls')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    if (countError) {
      console.error('Error fetching total count:', countError);
    }

    res.json({ 
      calls,
      pagination: {
        total: total || 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error getting call history:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get voice options
router.get('/voice-options', validateApiKey, async (req, res) => {
  try {
    // Define available voices with their details
    const voices = [
      { id: 'nat', name: 'Nat (Male)', gender: 'male', description: 'Clear and professional' },
      { id: 'nova', name: 'Nova (Female)', gender: 'female', description: 'Friendly and approachable' },
      { id: 'dave', name: 'Dave (Male)', gender: 'male', description: 'Deep and authoritative' },
      { id: 'bella', name: 'Bella (Female)', gender: 'female', description: 'Warm and empathetic' },
      { id: 'amy', name: 'Amy (Female)', gender: 'female', description: 'Cheerful and energetic' },
      { id: 'josh', name: 'Josh (Male)', gender: 'male', description: 'Casual and conversational' }
    ];

    res.json({
      success: true,
      voices
    });
  } catch (error) {
    console.error('Error fetching voice options:', error);
    res.status(500).json({ error: 'Failed to fetch voice options' });
  }
});

// Get model options
router.get('/model-options', validateApiKey, async (req, res) => {
  try {
    // Define available models with their details
    const models = [
      { 
        id: 'turbo', 
        name: 'Turbo (Fast)', 
        description: 'Fast and efficient for most use cases',
        speed: 'Fast',
        price: 'Standard'
      },
      { 
        id: 'claude', 
        name: 'Claude (Balanced)', 
        description: 'Good balance of performance and quality',
        speed: 'Medium',
        price: 'Premium'
      },
      { 
        id: 'gpt-4', 
        name: 'GPT-4 (Advanced)', 
        description: 'Most capable for complex tasks',
        speed: 'Slower',
        price: 'Premium+'
      }
    ];

    res.json({
      success: true,
      models
    });
  } catch (error) {
    console.error('Error fetching model options:', error);
    res.status(500).json({ error: 'Failed to fetch model options' });
  }
});

// Get user credits
router.get('/credits', validateApiKey, async (req, res) => {
  try {
    // Get user credits from database
    const { data, error } = await supabaseAdmin
      .from('credits')
      .select('balance')
      .eq('user_id', req.user.id)
      .single();
    
    if (error) {
      console.error('Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch credits' });
    }
    
    // Return credits
    res.json({
      success: true,
      balance: data?.balance || 0
    });
  } catch (error) {
    console.error('Error fetching user credits:', error);
    res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

module.exports = router; 