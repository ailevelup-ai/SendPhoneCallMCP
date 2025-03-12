const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../config/supabase');
const { addCredits } = require('./billing');
const { logTransactionToGoogleSheets } = require('./logging');

/**
 * Process auto top-up for a user
 * @param {String} userId - User ID
 * @returns {Object} - Result of top-up attempt
 */
async function processAutoTopup(userId) {
  try {
    // Get user's auto top-up settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('auto_topup_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (settingsError || !settings || !settings.is_enabled) {
      return { 
        success: false, 
        reason: 'Auto top-up not enabled',
        userId
      };
    }
    
    // Check if the current balance is below threshold
    const { data: account, error: accountError } = await supabaseAdmin
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (accountError || !account) {
      return { 
        success: false, 
        reason: 'Credit account not found',
        userId
      };
    }
    
    // Check if balance is above threshold
    if (account.balance >= settings.threshold_amount) {
      return { 
        success: true, 
        reason: 'Balance above threshold',
        userId,
        balance: account.balance,
        threshold: settings.threshold_amount
      };
    }
    
    // Get user details for payment
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();
    
    if (userError || !user || !user.stripe_customer_id) {
      return { 
        success: false, 
        reason: 'User or Stripe customer not found',
        userId
      };
    }
    
    // Get user's default payment method
    const customer = await stripe.customers.retrieve(user.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method']
    });
    
    if (!customer.invoice_settings.default_payment_method) {
      // Log the failed attempt
      await logAutoTopupAttempt({
        userId,
        amount: settings.topup_amount,
        success: false,
        reason: 'No default payment method',
        errorDetails: 'User has no default payment method configured'
      });
      
      return { 
        success: false, 
        reason: 'No default payment method',
        userId
      };
    }
    
    // Process the payment using off-session capability
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(settings.topup_amount * 100), // Convert to cents
      currency: 'usd',
      customer: user.stripe_customer_id,
      payment_method: customer.invoice_settings.default_payment_method.id,
      off_session: true,
      confirm: true,
      description: `Auto top-up - $${settings.topup_amount.toFixed(2)}`,
      metadata: {
        user_id: userId,
        auto_topup: 'true',
        credits_amount: settings.topup_amount.toString(),
        threshold: settings.threshold_amount.toString()
      }
    });
    
    if (paymentIntent.status !== 'succeeded') {
      // Log the failed attempt
      await logAutoTopupAttempt({
        userId,
        amount: settings.topup_amount,
        success: false,
        reason: 'Payment failed',
        errorDetails: `Payment status: ${paymentIntent.status}`
      });
      
      return { 
        success: false, 
        reason: 'Payment failed',
        userId,
        paymentStatus: paymentIntent.status
      };
    }
    
    // Update credit account
    const newBalance = account.balance + settings.topup_amount;
    
    const { error: updateError } = await supabaseAdmin
      .from('credit_accounts')
      .update({
        balance: newBalance,
        updated_at: new Date()
      })
      .eq('user_id', userId);
    
    if (updateError) {
      console.error('Error updating balance after auto top-up:', updateError);
      
      // Still consider it successful since payment went through
      // We need to handle this inconsistency with customer support
    }
    
    // Record transaction
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        amount: settings.topup_amount,
        type: 'credit',
        payment_id: paymentIntent.id,
        description: 'Auto top-up',
        balance_after: newBalance,
        created_at: new Date()
      });
    
    // Log the successful attempt
    await logAutoTopupAttempt({
      userId,
      amount: settings.topup_amount,
      success: true,
      payment_id: paymentIntent.id,
      newBalance
    });
    
    // Log transaction to Google Sheets
    await logTransactionToGoogleSheets({
      timestamp: new Date(),
      userId,
      type: 'credit',
      amount: settings.topup_amount,
      paymentId: paymentIntent.id,
      description: 'Auto top-up',
      balanceAfter: newBalance
    });
    
    // Send email notification about successful top-up
    // This would be implemented with an email service
    
    return {
      success: true,
      reason: 'Auto top-up successful',
      userId,
      amount: settings.topup_amount,
      newBalance,
      paymentId: paymentIntent.id
    };
  } catch (error) {
    console.error('Auto top-up error:', error);
    
    // Log the failed attempt
    try {
      await logAutoTopupAttempt({
        userId,
        amount: 0, // Unknown at this point
        success: false,
        reason: 'Processing error',
        errorDetails: error.message
      });
    } catch (logError) {
      console.error('Error logging auto top-up attempt:', logError);
    }
    
    return {
      success: false,
      reason: 'Processing error',
      userId,
      error: error.message
    };
  }
}

/**
 * Log auto top-up attempt
 * @param {Object} logData - Log data
 */
async function logAutoTopupAttempt(logData) {
  try {
    const { data, error } = await supabaseAdmin
      .from('auto_topup_logs')
      .insert({
        user_id: logData.userId,
        amount: logData.amount,
        success: logData.success,
        reason: logData.reason || null,
        payment_id: logData.payment_id || null,
        error_details: logData.errorDetails || null,
        new_balance: logData.newBalance || null,
        created_at: new Date()
      });
      
    if (error) {
      console.error('Error logging auto top-up attempt:', error);
    }
  } catch (error) {
    console.error('Error logging auto top-up attempt:', error);
  }
}

/**
 * Run auto top-up check for all eligible users
 * This would be scheduled to run periodically
 * @returns {Object} - Results of the batch operation
 */
async function runAutoTopupBatch() {
  try {
    // Get all users with auto top-up enabled
    const { data: eligibleUsers, error: usersError } = await supabaseAdmin
      .from('auto_topup_settings')
      .select('user_id')
      .eq('is_enabled', true);
    
    if (usersError) {
      throw new Error('Failed to fetch eligible users');
    }
    
    console.log(`Found ${eligibleUsers.length} users with auto top-up enabled`);
    
    const results = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    // Process each user
    for (const user of eligibleUsers) {
      try {
        const result = await processAutoTopup(user.user_id);
        
        results.totalProcessed++;
        
        if (result.success) {
          if (result.reason === 'Balance above threshold') {
            results.skipped++;
          } else {
            results.successful++;
          }
        } else {
          results.failed++;
        }
        
        results.details.push({
          userId: user.user_id,
          result
        });
      } catch (error) {
        console.error(`Error processing auto top-up for user ${user.user_id}:`, error);
        
        results.totalProcessed++;
        results.failed++;
        
        results.details.push({
          userId: user.user_id,
          error: error.message
        });
      }
    }
    
    console.log(`Auto top-up batch completed. Processed: ${results.totalProcessed}, Success: ${results.successful}, Failed: ${results.failed}, Skipped: ${results.skipped}`);
    
    return results;
  } catch (error) {
    console.error('Auto top-up batch error:', error);
    throw error;
  }
}

/**
 * Update auto top-up settings for a user
 * @param {String} userId - User ID
 * @param {Object} settings - Auto top-up settings
 * @returns {Object} - Updated settings
 */
async function updateAutoTopupSettings(userId, settings) {
  try {
    // Validate settings
    if (settings.is_enabled && settings.topup_amount < 20) {
      throw new Error('Minimum top-up amount is $20');
    }
    
    if (settings.is_enabled && settings.threshold_amount < 5) {
      throw new Error('Minimum threshold amount is $5');
    }
    
    // Check if settings exist
    const { data: existing } = await supabaseAdmin
      .from('auto_topup_settings')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    let data;
    let error;
    
    if (existing) {
      // Update existing settings
      ({ data, error } = await supabaseAdmin
        .from('auto_topup_settings')
        .update({
          is_enabled: settings.is_enabled,
          threshold_amount: settings.threshold_amount,
          topup_amount: settings.topup_amount,
          updated_at: new Date()
        })
        .eq('user_id', userId)
        .select()
        .single());
    } else {
      // Create new settings
      ({ data, error } = await supabaseAdmin
        .from('auto_topup_settings')
        .insert({
          user_id: userId,
          is_enabled: settings.is_enabled,
          threshold_amount: settings.threshold_amount,
          topup_amount: settings.topup_amount,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select()
        .single());
    }
    
    if (error) {
      throw new Error('Failed to update auto top-up settings');
    }
    
    return {
      success: true,
      settings: data
    };
  } catch (error) {
    console.error('Update auto top-up settings error:', error);
    throw error;
  }
}

/**
 * Get auto top-up settings for a user
 * @param {String} userId - User ID
 * @returns {Object} - Auto top-up settings
 */
async function getAutoTopupSettings(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('auto_topup_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // Not found
      throw new Error('Failed to fetch auto top-up settings');
    }
    
    // Return default settings if none exist
    return data || {
      is_enabled: false,
      threshold_amount: 5,
      topup_amount: 20,
      user_id: userId
    };
  } catch (error) {
    console.error('Get auto top-up settings error:', error);
    throw error;
  }
}

/**
 * Get auto top-up history for a user
 * @param {String} userId - User ID
 * @param {Object} options - Pagination options
 * @returns {Array} - Auto top-up history
 */
async function getAutoTopupHistory(userId, options = {}) {
  try {
    const { limit = 20, page = 1 } = options;
    
    const { data, error, count } = await supabaseAdmin
      .from('auto_topup_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (error) {
      throw new Error('Failed to fetch auto top-up history');
    }
    
    return {
      history: data,
      pagination: {
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Get auto top-up history error:', error);
    throw error;
  }
}

module.exports = {
  processAutoTopup,
  runAutoTopupBatch,
  updateAutoTopupSettings,
  getAutoTopupSettings,
  getAutoTopupHistory
}; 