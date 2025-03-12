const express = require('express');
const router = express.Router();
const { default: fetch } = require('node-fetch');
const { validateApiKey } = require('../middlewares/auth');
const { moderateContent } = require('../services/content-moderation');
const { logCallToGoogleSheets } = require('../google-sheets-logging');
const { supabaseAdmin } = require('../config/supabase');

// Make a phone call
router.post('/call', validateApiKey, async (req, res) => {
  try {
    const {
      phone_number,
      task,
      voice = process.env.BLAND_DEFAULT_VOICE || 'nat',
      webhook_url,
      from_number = process.env.BLAND_DEFAULT_FROM_NUMBER,
      model = process.env.BLAND_DEFAULT_MODEL || 'turbo',
      temperature = parseFloat(process.env.BLAND_DEFAULT_TEMPERATURE) || 1,
      voicemail_action = process.env.BLAND_DEFAULT_VOICEMAIL_ACTION || 'hangup',
      answered_by_enabled = process.env.BLAND_ANSWERED_BY_ENABLED === 'true',
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

    console.log('Making call to Bland.AI:', {
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

    // Make the call using Bland.AI API
    const response = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.BLAND_ENTERPRISE_API_KEY}`,
        'X-Encrypted-Key': process.env.BLAND_ENCRYPTED_KEY
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
    console.log('Bland.AI response:', callData);

    if (!response.ok) {
      console.error('Bland.AI API error:', {
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
        credits_used: creditsToReserve
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
      .eq('id', callId)
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

module.exports = router; 