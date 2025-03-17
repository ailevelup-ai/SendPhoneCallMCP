const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('../config/supabase');
const { logTransactionToGoogleSheets } = require('./logging');

// Constants
const COST_PER_MINUTE = 0.10; // $0.10 per minute
const FREE_MINUTES = 10; // 10 minutes free
const MINIMUM_DEPOSIT = 20.00; // $20 minimum deposit

/**
 * Create a credit account for a new user
 * @param {String} userId - User ID
 * @returns {Object} - Credit account details
 */
async function createCreditAccount(userId) {
  try {
    // Check if account already exists
    const { data: existingAccount } = await supabaseAdmin
      .from('credit_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingAccount) {
      return existingAccount;
    }

    // Create credit account record
    const { data, error } = await supabaseAdmin
      .from('credit_accounts')
      .insert({
        user_id: userId,
        balance: 0,
        has_free_tier: true,
        free_minutes_used: 0,
        free_minutes_total: FREE_MINUTES,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();

    if (error) {
      console.error('Credit account creation error:', error);
      throw new Error('Failed to create credit account');
    }

    return data;
  } catch (error) {
    console.error('Create credit account error:', error);
    throw error;
  }
}

/**
 * Check user's credit balance
 * @param {String} userId - User ID
 * @returns {Object} - Balance information
 */
async function checkBalance(userId) {
  try {
    // Get user's credit account
    const { data, error } = await supabaseAdmin
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Check balance error:', error);
      throw new Error('Failed to check balance');
    }

    if (!data) {
      // Create account if it doesn't exist
      return createCreditAccount(userId);
    }

    return {
      balance: data.balance,
      hasFreeTier: data.has_free_tier,
      freeMinutesUsed: data.free_minutes_used,
      freeMinutesTotal: data.free_minutes_total
    };
  } catch (error) {
    console.error('Check balance error:', error);
    throw error;
  }
}

/**
 * Add credits to user's account
 * @param {String} userId - User ID
 * @param {Number} amount - Amount to add in dollars
 * @param {String} paymentMethodId - Stripe payment method ID
 * @returns {Object} - Updated balance information
 */
async function addCredits(userId, amount, paymentMethodId) {
  try {
    // Validate amount
    if (amount < MINIMUM_DEPOSIT) {
      throw new Error(`Minimum deposit is $${MINIMUM_DEPOSIT}`);
    }

    // Get user details
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    let { stripe_customer_id } = userData;
    
    // Create or get Stripe customer
    if (!stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          user_id: userId
        }
      });
      
      stripe_customer_id = customer.id;
      
      // Update user with Stripe customer ID
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id })
        .eq('id', userId);
    }
    
    // Attach payment method to customer if provided
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripe_customer_id
      });
      
      // Set as default payment method
      await stripe.customers.update(stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      description: `Credits purchase - $${amount.toFixed(2)}`,
      metadata: {
        user_id: userId,
        credits_amount: amount.toString()
      }
    });
    
    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed: ${paymentIntent.status}`);
    }
    
    // Update credit account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (accountError) {
      throw new Error('Failed to fetch credit account');
    }
    
    const newBalance = (account.balance || 0) + amount;
    
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('credit_accounts')
      .update({
        balance: newBalance,
        updated_at: new Date()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error('Failed to update credit account');
    }
    
    // Record transaction
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        type: 'credit',
        payment_id: paymentIntent.id,
        description: 'Credits purchase',
        balance_after: newBalance,
        created_at: new Date()
      });
    
    // Log transaction to Google Sheets
    await logTransactionToGoogleSheets({
      timestamp: new Date(),
      userId,
      type: 'credit',
      amount,
      paymentId: paymentIntent.id,
      description: 'Credits purchase',
      balanceAfter: newBalance
    });
    
    return {
      success: true,
      balance: newBalance,
      transaction: {
        id: paymentIntent.id,
        amount,
        created: new Date()
      }
    };
  } catch (error) {
    console.error('Add credits error:', error);
    throw error;
  }
}

/**
 * Deduct credits from user's account
 * @param {String} userId - User ID
 * @param {String} callId - Call ID
 * @param {Number} minutes - Duration in minutes
 * @returns {Object} - Updated balance information
 */
async function deductCredits(userId, callId, minutes) {
  try {
    if (!minutes || minutes <= 0) {
      return { success: true, charged: 0 };
    }
    
    // Get user's credit account
    const { data: account, error: accountError } = await supabaseAdmin
      .from('credit_accounts')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (accountError || !account) {
      throw new Error('Credit account not found');
    }
    
    let amountToCharge = 0;
    let remainingMinutes = minutes;
    let freeMinutesUsed = account.free_minutes_used || 0;
    
    // Check if call has already been billed
    const { data: existingBilling } = await supabaseAdmin
      .from('call_billing')
      .select('id')
      .eq('call_id', callId)
      .single();
    
    if (existingBilling) {
      // Call already billed
      return { success: true, charged: 0, alreadyBilled: true };
    }
    
    // Use free tier minutes if available
    if (account.has_free_tier && freeMinutesUsed < account.free_minutes_total) {
      const freeMinutesAvailable = account.free_minutes_total - freeMinutesUsed;
      const freeMinutesToUse = Math.min(freeMinutesAvailable, remainingMinutes);
      
      freeMinutesUsed += freeMinutesToUse;
      remainingMinutes -= freeMinutesToUse;
    }
    
    // Calculate cost for remaining minutes
    if (remainingMinutes > 0) {
      amountToCharge = remainingMinutes * COST_PER_MINUTE;
    }
    
    // Update credit account
    const newBalance = Math.max(0, (account.balance || 0) - amountToCharge);
    
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('credit_accounts')
      .update({
        balance: newBalance,
        free_minutes_used: freeMinutesUsed,
        updated_at: new Date()
      })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error('Failed to update credit account');
    }
    
    // Record transaction if credits were charged
    if (amountToCharge > 0) {
      await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: userId,
          amount: amountToCharge,
          type: 'debit',
          call_id: callId,
          description: `Call charges - ${minutes} minutes`,
          balance_after: newBalance,
          created_at: new Date()
        });
      
      // Log transaction to Google Sheets
      await logTransactionToGoogleSheets({
        timestamp: new Date(),
        userId,
        type: 'debit',
        amount: amountToCharge,
        callId,
        description: `Call charges - ${minutes} minutes`,
        balanceAfter: newBalance
      });
    }
    
    // Record billing information for the call
    await supabaseAdmin
      .from('call_billing')
      .insert({
        call_id: callId,
        user_id: userId,
        total_minutes: minutes,
        free_minutes_used: minutes - remainingMinutes,
        charged_minutes: remainingMinutes,
        amount_charged: amountToCharge,
        created_at: new Date()
      });
    
    return {
      success: true,
      charged: amountToCharge,
      freeMinutesUsed: minutes - remainingMinutes,
      paidMinutes: remainingMinutes,
      balance: newBalance
    };
  } catch (error) {
    console.error('Deduct credits error:', error);
    throw error;
  }
}

/**
 * Estimate cost for a call
 * @param {Number} minutes - Duration in minutes
 * @param {Object} userAccount - User's credit account details
 * @returns {Object} - Cost estimate
 */
function estimateCost(minutes, userAccount = null) {
  let freeMinutesAvailable = 0;
  let freeMinutesUsed = 0;
  
  if (userAccount && userAccount.hasFreeTier) {
    freeMinutesAvailable = userAccount.freeMinutesTotal - userAccount.freeMinutesUsed;
  }
  
  let remainingMinutes = minutes;
  
  // Use free tier minutes if available
  if (freeMinutesAvailable > 0) {
    freeMinutesUsed = Math.min(freeMinutesAvailable, remainingMinutes);
    remainingMinutes -= freeMinutesUsed;
  }
  
  // Calculate cost for remaining minutes
  const cost = remainingMinutes * COST_PER_MINUTE;
  
  return {
    totalMinutes: minutes,
    freeMinutesUsed,
    paidMinutes: remainingMinutes,
    cost
  };
}

/**
 * Get transaction history for a user
 * @param {String} userId - User ID
 * @param {Object} options - Pagination and filtering options
 * @returns {Array} - Transaction history
 */
async function getTransactionHistory(userId, options = {}) {
  try {
    const {
      limit = 20,
      page = 1,
      type = null, // 'credit' or 'debit'
      startDate = null,
      endDate = null
    } = options;
    
    let query = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (type) {
      query = query.eq('type', type);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error('Failed to fetch transaction history');
    }
    
    // Get total count for pagination
    const { count: totalCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    return {
      transactions: data,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    console.error('Get transaction history error:', error);
    throw error;
  }
}

/**
 * Get pricing information
 * @returns {Object} - Pricing details
 */
function getPricingInfo() {
  return {
    costPerMinute: COST_PER_MINUTE,
    freeMinutes: FREE_MINUTES,
    minimumDeposit: MINIMUM_DEPOSIT,
    plans: [
      {
        name: 'Pay As You Go',
        description: 'Standard rate with no commitment',
        pricePerMinute: COST_PER_MINUTE,
        minimumDeposit: MINIMUM_DEPOSIT
      },
      {
        name: 'Volume Discount',
        description: 'For users purchasing over $100 in credits',
        pricePerMinute: 0.09, // $0.09 per minute
        minimumDeposit: 100.00
      }
    ]
  };
}

/**
 * Generate an invoice for a user
 * @param {String} userId - User ID
 * @param {String} startDate - Start date for invoice period
 * @param {String} endDate - End date for invoice period
 * @returns {Object} - Invoice details
 */
async function generateInvoice(userId, startDate, endDate) {
  try {
    // Get user details
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, name, stripe_customer_id')
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      throw new Error('User not found');
    }
    
    // Get transactions for the period
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });
    
    if (txError) {
      throw new Error('Failed to fetch transactions');
    }
    
    // Calculate totals
    let totalDebits = 0;
    let totalCredits = 0;
    
    transactions.forEach(tx => {
      if (tx.type === 'debit') {
        totalDebits += tx.amount;
      } else if (tx.type === 'credit') {
        totalCredits += tx.amount;
      }
    });
    
    // Get call details for the period
    const { data: calls, error: callError } = await supabaseAdmin
      .from('call_billing')
      .select('*, calls(*)')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true });
    
    if (callError) {
      console.error('Error fetching call details:', callError);
    }
    
    // Build invoice
    const invoice = {
      userId,
      userEmail: userData.email,
      userName: userData.name,
      invoiceDate: new Date(),
      periodStart: startDate,
      periodEnd: endDate,
      totalDebits,
      totalCredits,
      netAmount: totalCredits - totalDebits,
      transactions,
      calls: calls || []
    };
    
    return invoice;
  } catch (error) {
    console.error('Generate invoice error:', error);
    throw error;
  }
}

module.exports = {
  createCreditAccount,
  checkBalance,
  addCredits,
  deductCredits,
  estimateCost,
  getTransactionHistory,
  getPricingInfo,
  generateInvoice,
  COST_PER_MINUTE,
  FREE_MINUTES,
  MINIMUM_DEPOSIT
}; 