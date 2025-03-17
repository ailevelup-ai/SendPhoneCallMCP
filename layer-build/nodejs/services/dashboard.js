const { supabaseAdmin } = require('../config/supabase');
const { logger } = require('./audit-logging');
const fs = require('fs');
const path = require('path');

/**
 * Get system-wide usage metrics
 * @param {Object} options - Filter options
 * @returns {Object} - Usage metrics
 */
async function getSystemMetrics(options = {}) {
  try {
    const {
      startDate = getDateNDaysAgo(30),
      endDate = new Date().toISOString()
    } = options;
    
    // Initialize metrics object
    const metrics = {
      userStats: {},
      callStats: {},
      billingStats: {},
      moderationStats: {},
      timeRangeInDays: daysBetween(new Date(startDate), new Date(endDate))
    };
    
    // User metrics
    const { data: userCounts, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    if (userError) {
      logger.error('Error getting user metrics', { error: userError.message });
    } else {
      // Total users
      const { count: totalUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      // Active users (made at least one call in the period)
      const { data: activeUserData } = await supabaseAdmin
        .from('calls')
        .select('user_id')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(10000); // Limit to reasonable size
      
      const activeUsers = new Set();
      if (activeUserData) {
        activeUserData.forEach(call => activeUsers.add(call.user_id));
      }
      
      metrics.userStats = {
        total: totalUsers || 0,
        newInPeriod: userCounts?.length || 0,
        active: activeUsers.size,
        churnRate: totalUsers ? 1 - (activeUsers.size / totalUsers) : 0
      };
    }
    
    // Call metrics
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, status, call_duration, credits_used, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    if (callError) {
      logger.error('Error getting call metrics', { error: callError.message });
    } else {
      // Calculate call metrics
      let totalCalls = callData?.length || 0;
      let completedCalls = 0;
      let failedCalls = 0;
      let totalDuration = 0;
      let totalCreditsUsed = 0;
      
      // Status distribution
      const statusCounts = {};
      
      callData?.forEach(call => {
        // Count by status
        statusCounts[call.status] = (statusCounts[call.status] || 0) + 1;
        
        // Count completed vs failed
        if (['completed', 'done', 'success'].includes(call.status?.toLowerCase())) {
          completedCalls++;
          totalDuration += (call.call_duration || 0);
          totalCreditsUsed += (call.credits_used || 0);
        } else if (['failed', 'error'].includes(call.status?.toLowerCase())) {
          failedCalls++;
        }
      });
      
      metrics.callStats = {
        total: totalCalls,
        completed: completedCalls,
        failed: failedCalls,
        successRate: totalCalls ? completedCalls / totalCalls : 0,
        averageDuration: completedCalls ? totalDuration / completedCalls : 0,
        totalDuration,
        statusDistribution: statusCounts,
        callsPerDay: totalCalls / Math.max(1, metrics.timeRangeInDays)
      };
    }
    
    // Billing metrics
    const { data: transactionData, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, type, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    if (transactionError) {
      logger.error('Error getting billing metrics', { error: transactionError.message });
    } else {
      let totalRevenue = 0;
      let purchases = 0;
      let refunds = 0;
      let autoTopups = 0;
      
      transactionData?.forEach(transaction => {
        if (transaction.type === 'credit' && transaction.amount > 0) {
          totalRevenue += transaction.amount;
          
          // Count different types of transactions
          if (transaction.description?.toLowerCase().includes('auto top-up')) {
            autoTopups++;
          } else {
            purchases++;
          }
        } else if (transaction.type === 'refund') {
          refunds++;
          totalRevenue -= transaction.amount;
        }
      });
      
      // Get current total credit balance
      const { data: creditData } = await supabaseAdmin
        .from('credit_accounts')
        .select('balance');
        
      let totalCreditsOutstanding = 0;
      creditData?.forEach(account => {
        totalCreditsOutstanding += (account.balance || 0);
      });
      
      metrics.billingStats = {
        revenue: totalRevenue,
        transactions: transactionData?.length || 0,
        purchases,
        autoTopups,
        refunds,
        revenuePerDay: totalRevenue / Math.max(1, metrics.timeRangeInDays),
        outstandingCredits: totalCreditsOutstanding
      };
    }
    
    // Moderation metrics
    const { data: moderationData, error: moderationError } = await supabaseAdmin
      .from('moderation_logs')
      .select('id, approved, reason, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    if (moderationError) {
      logger.error('Error getting moderation metrics', { error: moderationError.message });
    } else {
      let totalModerated = moderationData?.length || 0;
      let approved = 0;
      let rejected = 0;
      const rejectionReasons = {};
      
      moderationData?.forEach(log => {
        if (log.approved) {
          approved++;
        } else {
          rejected++;
          
          // Count rejection reasons
          if (log.reason) {
            rejectionReasons[log.reason] = (rejectionReasons[log.reason] || 0) + 1;
          }
        }
      });
      
      metrics.moderationStats = {
        total: totalModerated,
        approved,
        rejected,
        approvalRate: totalModerated ? approved / totalModerated : 0,
        rejectionReasons
      };
    }
    
    return metrics;
  } catch (error) {
    logger.error('Error getting system metrics', { error: error.message });
    throw error;
  }
}

/**
 * Get user-specific dashboard metrics
 * @param {String} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Object} - User dashboard metrics
 */
async function getUserDashboard(userId, options = {}) {
  try {
    const {
      startDate = getDateNDaysAgo(30),
      endDate = new Date().toISOString()
    } = options;
    
    // Initialize dashboard object
    const dashboard = {
      creditBalance: 0,
      callStats: {},
      recentCalls: [],
      billing: {},
      usage: {}
    };
    
    // Get user's credit balance
    const { data: creditData, error: creditError } = await supabaseAdmin
      .from('credit_accounts')
      .select('balance')
      .eq('user_id', userId)
      .single();
      
    if (creditError) {
      logger.error('Error getting user credit balance', { error: creditError.message, userId });
    } else {
      dashboard.creditBalance = creditData?.balance || 0;
    }
    
    // Get auto top-up settings
    const { data: topupSettings } = await supabaseAdmin
      .from('auto_topup_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
      
    dashboard.autoTopup = topupSettings || { is_enabled: false };
    
    // Get call statistics
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, status, call_duration, credits_used, created_at, phone_number, script')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
      
    if (callError) {
      logger.error('Error getting user call statistics', { error: callError.message, userId });
    } else {
      // Calculate call metrics
      let totalCalls = callData?.length || 0;
      let completedCalls = 0;
      let failedCalls = 0;
      let totalDuration = 0;
      let totalCreditsUsed = 0;
      
      // Status distribution
      const statusCounts = {};
      
      callData?.forEach(call => {
        // Count by status
        statusCounts[call.status] = (statusCounts[call.status] || 0) + 1;
        
        // Count completed vs failed
        if (['completed', 'done', 'success'].includes(call.status?.toLowerCase())) {
          completedCalls++;
          totalDuration += (call.call_duration || 0);
          totalCreditsUsed += (call.credits_used || 0);
        } else if (['failed', 'error'].includes(call.status?.toLowerCase())) {
          failedCalls++;
        }
      });
      
      dashboard.callStats = {
        total: totalCalls,
        completed: completedCalls,
        failed: failedCalls,
        successRate: totalCalls ? completedCalls / totalCalls : 0,
        averageDuration: completedCalls ? totalDuration / completedCalls : 0,
        totalDuration,
        statusDistribution: statusCounts,
        creditsUsed: totalCreditsUsed
      };
      
      // Recent calls (limit to 10)
      dashboard.recentCalls = (callData || []).slice(0, 10).map(call => ({
        id: call.id,
        status: call.status,
        duration: call.call_duration,
        creditsUsed: call.credits_used,
        createdAt: call.created_at,
        phoneNumber: maskPhoneNumber(call.phone_number),
        scriptPreview: truncateText(call.script, 100)
      }));
    }
    
    // Get billing history
    const { data: transactionData, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
      
    if (transactionError) {
      logger.error('Error getting user billing history', { error: transactionError.message, userId });
    } else {
      let totalSpent = 0;
      let purchases = 0;
      let autoTopups = 0;
      
      transactionData?.forEach(transaction => {
        if (transaction.type === 'credit' && transaction.amount > 0) {
          totalSpent += transaction.amount;
          
          // Count different types of transactions
          if (transaction.description?.toLowerCase().includes('auto top-up')) {
            autoTopups++;
          } else {
            purchases++;
          }
        }
      });
      
      dashboard.billing = {
        totalSpent,
        transactions: transactionData?.length || 0,
        purchases,
        autoTopups,
        recentTransactions: (transactionData || []).slice(0, 5)
      };
    }
    
    // Get usage trends (daily)
    const usageTrends = await getDailyUsageTrends(userId, startDate, endDate);
    dashboard.usage = usageTrends;
    
    return dashboard;
  } catch (error) {
    logger.error('Error getting user dashboard', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate a daily usage report
 * @returns {Object} - Daily report data
 */
async function generateDailyReport() {
  try {
    // Get yesterday's date range
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const endDate = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
    
    // Get metrics for yesterday
    const metrics = await getSystemMetrics({ startDate, endDate });
    
    // Format the report
    const report = {
      date: yesterday.toISOString().split('T')[0],
      userStats: {
        newUsers: metrics.userStats.newInPeriod,
        activeUsers: metrics.userStats.active
      },
      callStats: {
        totalCalls: metrics.callStats.total,
        successRate: metrics.callStats.successRate,
        averageDuration: metrics.callStats.averageDuration
      },
      billingStats: {
        revenue: metrics.billingStats.revenue,
        transactions: metrics.billingStats.transactions
      },
      moderationStats: {
        totalModerated: metrics.moderationStats.total,
        approvalRate: metrics.moderationStats.approvalRate
      }
    };
    
    // Save the report to the database
    const { data, error } = await supabaseAdmin
      .from('daily_reports')
      .insert({
        report_date: yesterday.toISOString().split('T')[0],
        report_data: report,
        created_at: new Date()
      });
      
    if (error) {
      logger.error('Error saving daily report', { error: error.message });
    }
    
    // Also save to a JSON file for backup
    const reportsDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const filePath = path.join(reportsDir, `daily_report_${report.date}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    
    return report;
  } catch (error) {
    logger.error('Error generating daily report', { error: error.message });
    throw error;
  }
}

/**
 * Get daily usage trends for a user
 * @param {String} userId - User ID
 * @param {String} startDate - Start date
 * @param {String} endDate - End date
 * @returns {Object} - Usage trends
 */
async function getDailyUsageTrends(userId, startDate, endDate) {
  try {
    // Get calls for the period
    const { data: callData, error: callError } = await supabaseAdmin
      .from('calls')
      .select('id, created_at, credits_used')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    if (callError) {
      logger.error('Error getting user call data for trends', { error: callError.message, userId });
      return {};
    }
    
    // Organize by day
    const dailyUsage = {};
    
    // Initialize all days in the range
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);
    
    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      dailyUsage[dateString] = {
        calls: 0,
        credits: 0
      };
      current.setDate(current.getDate() + 1);
    }
    
    // Populate with actual usage
    callData?.forEach(call => {
      const dateString = new Date(call.created_at).toISOString().split('T')[0];
      if (dailyUsage[dateString]) {
        dailyUsage[dateString].calls++;
        dailyUsage[dateString].credits += (call.credits_used || 0);
      }
    });
    
    // Convert to arrays for charting
    const dates = Object.keys(dailyUsage).sort();
    const callCounts = dates.map(date => dailyUsage[date].calls);
    const creditUsage = dates.map(date => dailyUsage[date].credits);
    
    return {
      dates,
      callCounts,
      creditUsage
    };
  } catch (error) {
    logger.error('Error getting daily usage trends', { error: error.message, userId });
    return {};
  }
}

/**
 * Schedule a report for generation and delivery
 * @param {Object} reportConfig - Report configuration
 * @returns {Object} - Scheduled report info
 */
async function scheduleReport(reportConfig) {
  try {
    const {
      name,
      type, // 'system', 'user', 'billing', etc.
      frequency, // 'daily', 'weekly', 'monthly'
      format, // 'json', 'csv', 'pdf'
      recipients, // Array of email addresses
      filters, // Any filters to apply
      userId // User who scheduled the report (if applicable)
    } = reportConfig;
    
    // Validate config
    if (!name || !type || !frequency) {
      throw new Error('Missing required fields for report scheduling');
    }
    
    // Save to database
    const { data, error } = await supabaseAdmin
      .from('scheduled_reports')
      .insert({
        name,
        type,
        frequency,
        format: format || 'json',
        recipients: recipients || [],
        filters: filters || {},
        user_id: userId,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();
      
    if (error) {
      throw new Error(`Failed to schedule report: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error scheduling report', { error: error.message });
    throw error;
  }
}

/**
 * Get scheduled reports
 * @param {String} userId - User ID (for filtering)
 * @returns {Array} - Scheduled reports
 */
async function getScheduledReports(userId = null) {
  try {
    let query = supabaseAdmin
      .from('scheduled_reports')
      .select('*');
      
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get scheduled reports: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error getting scheduled reports', { error: error.message });
    throw error;
  }
}

// Helper functions

/**
 * Get date N days ago as ISO string
 * @param {Number} days - Number of days
 * @returns {String} - ISO date string
 */
function getDateNDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Calculate days between two dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Number} - Number of days
 */
function daysBetween(startDate, endDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round(Math.abs((endDate - startDate) / millisecondsPerDay)));
}

/**
 * Mask a phone number for privacy
 * @param {String} phoneNumber - Phone number to mask
 * @returns {String} - Masked phone number
 */
function maskPhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove non-digits
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // If very short number, just use ***
  if (digitsOnly.length < 7) return '***';
  
  // Otherwise, keep last 4 digits
  return '***-***-' + digitsOnly.slice(-4);
}

/**
 * Truncate text to specified length
 * @param {String} text - Text to truncate
 * @param {Number} maxLength - Maximum length
 * @returns {String} - Truncated text
 */
function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

module.exports = {
  getSystemMetrics,
  getUserDashboard,
  generateDailyReport,
  scheduleReport,
  getScheduledReports
}; 