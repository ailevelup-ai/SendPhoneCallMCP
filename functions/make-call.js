const { supabase } = require('/opt/nodejs/lib/supabase');
const { moderateContent } = require('/opt/nodejs/services/content-moderation');
const { logCallToGoogleSheets } = require('/opt/nodejs/services/google-sheets-logging');
const { getRateLimit, updateRateLimit } = require('/opt/nodejs/lib/rate-limit');
const { createResponse } = require('/opt/nodejs/lib/api-response');
const { lambdaWrapper } = require('/opt/nodejs/utils/lambda-wrapper');

const _makeCallHandler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const userId = event.requestContext.authorizer.claims.sub;

    // Check rate limit
    const rateLimitResult = await getRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return createResponse(429, {
        error: 'Rate limit exceeded',
        resetTime: rateLimitResult.resetTime
      });
    }

    const {
      phone_number,
      task,
      voice = process.env.DEFAULT_VOICE,
      webhook_url,
      from_number = process.env.DEFAULT_FROM_NUMBER,
      model = process.env.DEFAULT_MODEL,
      temperature = parseFloat(process.env.DEFAULT_TEMPERATURE) || 1,
      voicemail_action = process.env.DEFAULT_VOICEMAIL_ACTION || 'hangup',
      answered_by_enabled = process.env.ANSWERED_BY_ENABLED === 'true',
      max_duration
    } = body;

    // Validate required fields
    if (!phone_number || !task) {
      return createResponse(400, {
        error: 'Missing required fields',
        required: ['phone_number', 'task']
      });
    }

    // Check user credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (creditsError || !userCredits || userCredits.balance < 1) {
      return createResponse(402, {
        error: 'Insufficient credits',
        credits: userCredits?.balance || 0
      });
    }

    // Moderate content
    const moderationResult = await moderateContent(task);
    if (!moderationResult.isAllowed) {
      return createResponse(400, {
        error: 'Content moderation failed',
        reason: moderationResult.reason
      });
    }

    // Make the call using ailevelup.AI API
    const response = await fetch(`${process.env.AILEVELUP_API_URL}/v1/calls`, {
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
        max_duration: max_duration || userCredits.balance
      })
    });

    const callData = await response.json();

    if (!response.ok) {
      return createResponse(response.status, {
        error: 'Failed to make call',
        details: callData
      });
    }

    // Log call to database
    const { data: call, error: dbError } = await supabase
      .from('calls')
      .insert({
        user_id: userId,
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
        max_duration: max_duration || userCredits.balance,
        credits_used: 1,
        update_status: 'Pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error logging call to database:', dbError);
    }

    // Deduct credits
    await supabase
      .from('credits')
      .update({
        balance: userCredits.balance - 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Log to Google Sheets
    await logCallToGoogleSheets({
      user_id: userId,
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
      max_duration: max_duration || userCredits.balance,
      credits_used: 1
    });

    // Update rate limit
    await updateRateLimit(userId);

    return createResponse(200, {
      success: true,
      call_id: callData.call_id,
      status: 'initiated',
      credits_remaining: userCredits.balance - 1,
      ...callData
    });
  } catch (error) {
    console.error('Error making call:', error);
    return createResponse(500, {
      error: 'Internal server error',
      message: error.message
    });
  }
};

exports.handler = lambdaWrapper(_makeCallHandler); 