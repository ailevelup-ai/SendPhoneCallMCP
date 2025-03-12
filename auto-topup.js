// Auto Top-up Service for Bland.AI MCP Wrapper
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database');
const { sendEmail } = require('../services/notifications');

/**
 * Configure auto top-up settings for a user
 * @param {String} userId - User ID
 * @param {Object} settings - Auto top-up settings
 * @returns {Object} - Updated user settings
 */
async function configureAutoTopup(userId, settings) {
  try {
    const { 
      enabled = false, 
      threshold = 5.00, 
      amount = 20.00,
      paymentMethodId = null
    } = settings;
    
    // Validate settings
    if (enabled) {
      if (!paymentMethodId) {
        throw new Error('Payment method is required for auto top-up');
      }
      
      if (threshold < 1) {
        throw new Error('Threshold must be at least $1.00');
      }
      
      if (amount < 20) {
        throw new Error('Auto top-up amount must be at least $20.00');
      }
    }
    
    // Get user
    const user = await db.users.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // If enabling auto top-up, ensure user has a Stripe customer ID
    if (enabled && !user.stripeCustomerId) {
      // Create Stripe customer if not exists
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || user.email,
        metadata: {
          userId: userId
        }
      });
      
      // Update user with Stripe customer ID
      await db.users.update(
        { stripeCustomerId: customer.id },
        { where: { id: userId } }
      );
      
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });
      
      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    } else if (enabled && paymentMethodId) {
      // Update default payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId
      });
      
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    }
    
    // Update user settings
    await db.userSettings.upsert({
      userId,
      autoTopupEnabled: enabled,
      autoTopupThreshold: threshold,
      autoTopupAmount: amount,
      defaultPaymentMethodId: paymentMethodId,
      updatedAt: new Date()
    });
    
    // Return updated settings
    return {
      userId,
      autoTopupEnabled: enabled,
      autoTopupThreshold: threshold,
      autoTopupAmount: amount,
      defaultPaymentMethodId: paymentMethodId ? 
        paymentMethodId.slice(-4).padStart(paymentMethodId.length, '*') : null
    };
  } catch (error) {
    console.error('Error configuring auto top-up:', error);
    throw error;
  }
}

/**
 * Check balance and process auto top-up if needed
 * @param {String} userId - User ID
 * @returns {Object} - Result of balance check and top-up
 */
async function checkAndProcessAutoTopup(userId) {
  try {
    // Get user settings
    const userSettings = await db.userSettings.findOne({
      where: { userId }
    });
    
    // Skip if auto top-up not enabled
    if (!userSettings || !userSettings.autoTopupEnabled) {
      return { 
        userId, 
        autoTopupEnabled: false,
        message: 'Auto top-up not enabled' 
      };
    }
    
    // Get credit account
    const creditAccount = await db.creditAccounts.findOne({
      where: { userId }
    });
    
    if (!creditAccount) {
      return { 
        userId, 
        error: 'Credit account not found' 
      };
    }
    
    // Check if balance is below threshold
    if (creditAccount.balance > userSettings.autoTopupThreshold) {
      return { 
        userId, 
        currentBalance: creditAccount.balance,
        threshold: userSettings.autoTopupThreshold,
        needsTopup: false,
        message: 'Balance above threshold, no top-up needed' 
      };
    }
    
    // Get user for Stripe customer ID
    const user = await db.users.findByPk(userId);
    if (!user || !user.stripeCustomerId) {
      return { 
        userId, 
        error: 'Stripe customer not found' 
      };
    }
    
    // Process the top-up
    const topupResult = await processAutoTopup(
      user, 
      userSettings.autoTopupAmount
    );
    
    return topupResult;
  } catch (error) {
    console.error('Error checking auto top-up:', error);
    
    return {
      userId,
      error: error.message,
      status: 'error'
    };
  }
}

/**
 * Process an auto top-up payment
 * @param {Object} user - User object
 * @param {Number} amount - Amount to top up
 * @returns {Object} - Result of top-up
 */
async function processAutoTopup(user, amount) {
  try {
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      customer: user.stripeCustomerId,
      confirm: true,
      description: `Auto top-up for MCP user ${user.id}`,
      metadata: {
        userId: user.id,
        type: 'auto_topup'
      },
      off_session: true,
      payment_method_types: ['card']
    });
    
    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }
    
    // Get current credit balance
    const creditAccount = await db.creditAccounts.findOne({
      where: { userId: user.id }
    });
    
    // Update credit balance
    await db.creditAccounts.update(
      { 
        balance: creditAccount.balance + amount,
        totalDeposited: creditAccount.totalDeposited + amount,
        updatedAt: new Date()
      },
      { where: { userId: user.id } }
    );
    
    // Record transaction
    const transaction = await db.transactions.create({
      userId: user.id,
      type: 'auto_topup',
      amount,
      paymentIntentId: paymentIntent.id,
      description: 'Automatic credit top-up',
      status: 'completed',
      createdAt: new Date()
    });
    
    // Send notification email
    await sendTopupNotification(user, amount, creditAccount.balance + amount);
    
    return {
      userId: user.id,
      transactionId: transaction.id,
      amount,
      previousBalance: creditAccount.balance,
      newBalance: creditAccount.balance + amount,
      status: 'success',
      message: 'Auto top-up completed successfully'
    };
  } catch (error) {
    console.error('Error processing auto top-up:', error);
    
    // Record failed transaction
    await db.transactions.create({
      userId: user.id,
      type: 'auto_topup',
      amount,
      paymentIntentId: error.payment_intent?.id,
      description: 'Automatic credit top-up - failed',
      status: 'failed',
      error: error.message,
      createdAt: new Date()
    });
    
    // Send failure notification
    await sendTopupFailureNotification(user, amount, error.message);
    
    throw error;
  }
}

/**
 * Send email notification for successful top-up
 * @param {Object} user - User object
 * @param {Number} amount - Amount topped up
 * @param {Number} newBalance - New balance
 */
async function sendTopupNotification(user, amount, newBalance) {
  const emailData = {
    to: user.email,
    subject: 'Your MCP account has been automatically topped up',
    body: `
      <p>Hello,</p>
      <p>Your MCP account has been automatically topped up with $${amount.toFixed(2)}.</p>
      <p>Your new balance is $${newBalance.toFixed(2)}.</p>
      <p>Thank you for using our service!</p>
    `
  };
  
  await sendEmail(emailData);
}

/**
 * Send email notification for failed top-up
 * @param {Object} user - User object
 * @param {Number} amount - Amount attempted
 * @param {String} error - Error message
 */
async function sendTopupFailureNotification(user, amount, error) {
  const emailData = {
    to: user.email,
    subject: 'Action Required: Your MCP account auto top-up failed',
    body: `
      <p>Hello,</p>
      <p>We attempted to automatically top up your MCP account with $${amount.toFixed(2)}, but the payment failed.</p>
      <p>Error: ${error}</p>
      <p>Please log in to your account to update your payment information and add credits manually.</p>
      <p>If you don't add credits soon, your outbound calls may be affected.</p>
    `
  };
  
  await sendEmail(emailData);
}

/**
 * Run balance check and auto top-up for all eligible users
 * Can be scheduled to run periodically
 */
async function runAutoTopupBatchJob() {
  try {
    // Get users with auto top-up enabled
    const eligibleUsers = await db.userSettings.findAll({
      where: { autoTopupEnabled: true }
    });
    
    console.log(`Running auto top-up batch job for ${eligibleUsers.length} eligible users`);
    
    // Process each user
    const results = await Promise.all(
      eligibleUsers.map(settings => checkAndProcessAutoTopup(settings.userId))
    );
    
    // Log results
    const topupsProcessed = results.filter(r => r.status === 'success').length;
    console.log(`Auto top-up batch job completed. Processed ${topupsProcessed} top-ups.`);
    
    return {
      processed: eligibleUsers.length,
      toppedUp: topupsProcessed,
      results
    };
  } catch (error) {
    console.error('Error running auto top-up batch job:', error);
    return { error: error.message };
  }
}

module.exports = {
  configureAutoTopup,
  checkAndProcessAutoTopup,
  runAutoTopupBatchJob
};
