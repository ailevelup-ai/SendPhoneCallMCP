// Credit System for Bland.AI MCP Wrapper
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../database');

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
    // Create credit account record
    const creditAccount = await db.creditAccounts.create({
      userId,
      balance: 0,
      freeMinutesRemaining: FREE_MINUTES,
      totalDeposited: 0,
      totalUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return {
      userId,
      balance: 0,
      freeMinutesRemaining: FREE_MINUTES
    };
  } catch (error) {
    console.error('Error creating credit account:', error);
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
    // Get credit account from database
    const creditAccount = await db.creditAccounts.findOne({
      where: { userId }
    });
    
    if (!creditAccount) {
      // Create a new credit account if one doesn't exist
      const newAccount = await createCreditAccount(userId);
      return {
        balance: newAccount.balance,
        freeMinutesRemaining: newAccount.freeMinutesRemaining,
        hasBalance: newAccount.freeMinutesRemaining > 0
      };
    }
    
    // Calculate whether user has sufficient balance (either paid credits or free minutes)
    const hasBalance = creditAccount.balance > 0 || creditAccount.freeMinutesRemaining > 0;
    
    return {
      balance: creditAccount.balance,
      freeMinutesRemaining: creditAccount.freeMinutesRemaining,
      hasBalance,
      totalDeposited: creditAccount.totalDeposited,
      totalUsed: creditAccount.totalUsed
    };
  } catch (error) {
    console.error('Error checking balance:', error);
    throw error;
  }
}

/**
 * Add credits to user's account via Stripe
 * @param {String} userId - User ID
 * @param {Number} amount - Amount to deposit in dollars
 * @param {String} paymentMethodId - Stripe payment method ID
 * @returns {Object} - Transaction details
 */
async function addCredits(userId, amount, paymentMethodId) {
  // Validate minimum deposit
  if (amount < MINIMUM_DEPOSIT) {
    throw new Error(`Minimum deposit amount is $${MINIMUM_DEPOSIT}`);
  }
  
  try {
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      description: `Credit deposit for MCP user ${userId}`
    });
    
    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }
    
    // Get current credit balance
    const creditAccount = await db.creditAccounts.findOne({
      where: { userId }
    });
    
    if (!creditAccount) {
      // Create a new account with the deposit amount
      await createCreditAccount(userId);
      await db.creditAccounts.update(
        { balance: amount, totalDeposited: amount },
        { where: { userId } }
      );
    } else {
      // Update existing account
      await db.creditAccounts.update(
        { 
          balance: creditAccount.balance + amount,
          totalDeposited: creditAccount.totalDeposited + amount,
          updatedAt: new Date()
        },
        { where: { userId } }
      );
    }
    
    // Record transaction
    const transaction = await db.transactions.create({
      userId,
      type: 'deposit',
      amount,
      paymentIntentId: paymentIntent.id,
      description: 'Credit deposit',
      status: 'completed',
      createdAt: new Date()
    });
    
    return {
      transactionId: transaction.id,
      amount,
      newBalance: creditAccount ? creditAccount.balance + amount : amount,
      status: 'success'
    };
  } catch (error) {
    console.error('Error adding credits:', error);
    
    // Record failed transaction
    await db.transactions.create({
      userId,
      type: 'deposit',
      amount,
      paymentIntentId: error.payment_intent?.id,
      description: 'Credit deposit - failed',
      status: 'failed',
      error: error.message,
      createdAt: new Date()
    });
    
    throw error;
  }
}

/**
 * Deduct credits for a call
 * @param {String} userId - User ID
 * @param {String} callId - Call ID
 * @param {Number} minutes - Call duration in minutes
 * @returns {Object} - Updated balance
 */
async function deductCredits(userId, callId, minutes) {
  try {
    // Get credit account
    const creditAccount = await db.creditAccounts.findOne({
      where: { userId }
    });
    
    if (!creditAccount) {
      throw new Error('Credit account not found');
    }
    
    // Calculate cost
    const cost = minutes * COST_PER_MINUTE;
    
    // Start transaction
    const transaction = await db.sequelize.transaction();
    
    try {
      let remainingFreeMinutes = creditAccount.freeMinutesRemaining;
      let paidBalance = creditAccount.balance;
      let freeMinutesUsed = 0;
      let paidMinutesUsed = 0;
      
      // Use free minutes first if available
      if (remainingFreeMinutes > 0) {
        if (minutes <= remainingFreeMinutes) {
          // All minutes covered by free allocation
          freeMinutesUsed = minutes;
          remainingFreeMinutes -= minutes;
        } else {
          // Use all remaining free minutes and some paid minutes
          freeMinutesUsed = remainingFreeMinutes;
          paidMinutesUsed = minutes - remainingFreeMinutes;
          
          // Calculate cost of paid minutes
          const paidCost = paidMinutesUsed * COST_PER_MINUTE;
          
          // Deduct from balance
          paidBalance -= paidCost;
          remainingFreeMinutes = 0;
        }
      } else {
        // No free minutes, use paid balance
        paidMinutesUsed = minutes;
        paidBalance -= cost;
      }
      
      // Update credit account
      await db.creditAccounts.update(
        {
          balance: paidBalance,
          freeMinutesRemaining: remainingFreeMinutes,
          totalUsed: creditAccount.totalUsed + cost,
          updatedAt: new Date()
        },
        { 
          where: { userId },
          transaction
        }
      );
      
      // Record usage transaction
      await db.transactions.create(
        {
          userId,
          type: 'usage',
          amount: cost,
          description: `Call usage: ${callId}`,
          callId,
          freeMinutesUsed,
          paidMinutesUsed,
          status: 'completed',
          createdAt: new Date()
        },
        { transaction }
      );
      
      // Commit transaction
      await transaction.commit();
      
      return {
        newBalance: paidBalance,
        freeMinutesRemaining: remainingFreeMinutes,
        costDetails: {
          totalCost: cost,
          freeMinutesUsed,
          paidMinutesUsed,
          paidAmount: paidMinutesUsed * COST_PER_MINUTE
        }
      };
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}

/**
 * Calculate estimated cost for a call
 * @param {Number} minutes - Estimated minutes
 * @returns {Object} - Cost estimate
 */
function estimateCost(minutes) {
  return {
    estimatedMinutes: minutes,
    costPerMinute: COST_PER_MINUTE,
    estimatedCost: minutes * COST_PER_MINUTE
  };
}

/**
 * Get transaction history for a user
 * @param {String} userId - User ID
 * @param {Object} options - Query options (limit, offset, type, etc.)
 * @returns {Array} - Transaction records
 */
async function getTransactionHistory(userId, options = {}) {
  try {
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    const type = options.type; // 'deposit', 'usage', or undefined for all
    
    const whereClause = { userId };
    if (type) {
      whereClause.type = type;
    }
    
    const transactions = await db.transactions.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });
    
    return {
      total: transactions.count,
      transactions: transactions.rows,
      limit,
      offset
    };
  } catch (error) {
    console.error('Error getting transaction history:', error);
    throw error;
  }
}

/**
 * Get current pricing information
 * @returns {Object} - Pricing information
 */
function getPricingInfo() {
  return {
    costPerMinute: COST_PER_MINUTE,
    freeMinutes: FREE_MINUTES,
    minimumDeposit: MINIMUM_DEPOSIT,
    currency: 'USD'
  };
}

/**
 * Generate invoice for a period
 * @param {String} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} - Invoice data
 */
async function generateInvoice(userId, startDate, endDate) {
  try {
    // Get transactions for the period
    const transactions = await db.transactions.findAll({
      where: {
        userId,
        createdAt: {
          [db.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['createdAt', 'ASC']]
    });
    
    // Get user details
    const user = await db.users.findByPk(userId);
    
    // Calculate totals
    const deposits = transactions
      .filter(t => t.type === 'deposit' && t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const usage = transactions
      .filter(t => t.type === 'usage')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const freeUsage = transactions
      .filter(t => t.type === 'usage')
      .reduce((sum, t) => sum + (t.freeMinutesUsed || 0), 0);
    
    const paidUsage = transactions
      .filter(t => t.type === 'usage')
      .reduce((sum, t) => sum + (t.paidMinutesUsed || 0), 0);
    
    // Generate invoice data
    const invoice = {
      userId,
      userEmail: user.email,
      invoiceNumber: `INV-${userId.slice(0, 8)}-${Date.now()}`,
      startDate,
      endDate,
      createdAt: new Date(),
      totals: {
        deposits,
        usage,
        balance: deposits - usage
      },
      usageSummary: {
        totalMinutes: freeUsage + paidUsage,
        freeMinutes: freeUsage,
        paidMinutes: paidUsage,
        costPerMinute: COST_PER_MINUTE
      },
      transactions
    };
    
    // Store invoice in database
    await db.invoices.create({
      userId,
      invoiceNumber: invoice.invoiceNumber,
      startDate,
      endDate,
      amount: usage,
      status: 'generated',
      data: JSON.stringify(invoice),
      createdAt: new Date()
    });
    
    return invoice;
  } catch (error) {
    console.error('Error generating invoice:', error);
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
  generateInvoice
};
