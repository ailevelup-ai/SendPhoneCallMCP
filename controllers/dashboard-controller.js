const dashboardService = require('../services/dashboard');
const { logger } = require('../services/audit-logging');

/**
 * Get system metrics for admin dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSystemMetrics(req, res) {
  try {
    const { startDate, endDate } = req.query;
    
    // Validate date params if provided
    if (startDate && !isValidISODate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    if (endDate && !isValidISODate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    const options = { startDate, endDate };
    const metrics = await dashboardService.getSystemMetrics(options);
    
    return res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting system metrics', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve system metrics',
      error: error.message
    });
  }
}

/**
 * Get user dashboard data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserDashboard(req, res) {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    // Validate date params if provided
    if (startDate && !isValidISODate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    if (endDate && !isValidISODate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    const options = { startDate, endDate };
    const dashboard = await dashboardService.getUserDashboard(userId, options);
    
    return res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    logger.error('Error getting user dashboard', { error: error.message, userId: req.user.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: error.message
    });
  }
}

/**
 * Generate a report on demand
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generateReport(req, res) {
  try {
    const { reportType } = req.params;
    const { format = 'json', startDate, endDate } = req.query;
    
    // Validate report type
    const validReportTypes = ['daily', 'weekly', 'monthly', 'custom'];
    if (!validReportTypes.includes(reportType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid report type. Supported types: ${validReportTypes.join(', ')}`
      });
    }
    
    // Validate format
    const validFormats = ['json', 'csv'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: `Invalid format. Supported formats: ${validFormats.join(', ')}`
      });
    }
    
    // Validate date params if provided
    if (startDate && !isValidISODate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    if (endDate && !isValidISODate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Use ISO date format (YYYY-MM-DD).'
      });
    }
    
    let report;
    switch (reportType) {
      case 'daily':
        report = await dashboardService.generateDailyReport();
        break;
      // Add cases for other report types as needed
      default:
        report = await dashboardService.getSystemMetrics({ startDate, endDate });
    }
    
    // Handle different formats
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }
    
    return res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating report', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
}

/**
 * Schedule a report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function scheduleReport(req, res) {
  try {
    const userId = req.user.id;
    const { name, type, frequency, format, recipients, filters } = req.body;
    
    // Validate required fields
    if (!name || !type || !frequency) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, and frequency are required'
      });
    }
    
    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: `Invalid frequency. Supported values: ${validFrequencies.join(', ')}`
      });
    }
    
    // Validate format if provided
    if (format) {
      const validFormats = ['json', 'csv', 'pdf'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          success: false,
          message: `Invalid format. Supported formats: ${validFormats.join(', ')}`
        });
      }
    }
    
    // Validate recipients if provided
    if (recipients && (!Array.isArray(recipients) || !recipients.every(email => isValidEmail(email)))) {
      return res.status(400).json({
        success: false,
        message: 'Recipients must be an array of valid email addresses'
      });
    }
    
    const reportConfig = {
      name,
      type,
      frequency,
      format: format || 'json',
      recipients: recipients || [],
      filters: filters || {},
      userId
    };
    
    const scheduledReport = await dashboardService.scheduleReport(reportConfig);
    
    return res.status(201).json({
      success: true,
      data: scheduledReport,
      message: 'Report scheduled successfully'
    });
  } catch (error) {
    logger.error('Error scheduling report', { error: error.message, userId: req.user.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to schedule report',
      error: error.message
    });
  }
}

/**
 * Get scheduled reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getScheduledReports(req, res) {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // If admin and includeAll query param is true, get all reports
    const includeAll = isAdmin && req.query.includeAll === 'true';
    
    const reports = await dashboardService.getScheduledReports(includeAll ? null : userId);
    
    return res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error getting scheduled reports', { error: error.message, userId: req.user.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve scheduled reports',
      error: error.message
    });
  }
}

// Helper functions

/**
 * Validate if string is ISO date format (YYYY-MM-DD)
 * @param {String} dateString - Date string to validate
 * @returns {Boolean} - Whether the string is a valid ISO date
 */
function isValidISODate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;
  
  if (!regex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validate email address
 * @param {String} email - Email to validate
 * @returns {Boolean} - Whether the email is valid
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Convert object to CSV
 * @param {Object} data - Data to convert
 * @returns {String} - CSV string
 */
function convertToCSV(data) {
  if (!data) return '';
  
  // Flatten the object
  const flattenedData = flattenObject(data);
  
  // Get headers
  const headers = Object.keys(flattenedData);
  
  // Create CSV string
  const csv = [
    headers.join(','),
    headers.map(header => {
      const value = flattenedData[header];
      // Handle strings with commas by wrapping in quotes
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',')
  ].join('\n');
  
  return csv;
}

/**
 * Flatten a nested object
 * @param {Object} obj - Object to flatten
 * @param {String} prefix - Key prefix
 * @returns {Object} - Flattened object
 */
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const pre = prefix.length ? `${prefix}.` : '';
    
    if (
      typeof obj[key] === 'object' && 
      obj[key] !== null && 
      !Array.isArray(obj[key])
    ) {
      Object.assign(acc, flattenObject(obj[key], `${pre}${key}`));
    } else {
      let value = obj[key];
      
      // Handle arrays by joining with semicolons
      if (Array.isArray(value)) {
        value = value.join(';');
      }
      
      acc[`${pre}${key}`] = value;
    }
    
    return acc;
  }, {});
}

module.exports = {
  getSystemMetrics,
  getUserDashboard,
  generateReport,
  scheduleReport,
  getScheduledReports
}; 