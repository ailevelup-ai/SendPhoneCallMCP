const { supabaseAdmin } = require('../config/supabase');
const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ailevelup-ai-mcp' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

/**
 * Log an audit event to both Winston and the database
 * @param {String} eventType - Type of event (e.g., 'user.login', 'api.call', 'billing.payment')
 * @param {String} userId - User ID related to the event, if applicable
 * @param {Object} metadata - Additional event data
 * @param {String} severity - Severity level (info, warn, error)
 */
async function logAuditEvent(eventType, userId = null, metadata = {}, severity = 'info') {
  try {
    // Log to Winston
    logger.log(severity, eventType, {
      userId,
      timestamp: new Date().toISOString(),
      ...metadata
    });
    
    // Log to database
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        event_type: eventType,
        user_id: userId,
        metadata,
        severity,
        created_at: new Date()
      });
      
    if (error) {
      logger.error('Failed to write audit log to database', {
        error: error.message,
        eventType,
        userId
      });
    }
  } catch (error) {
    // Log to Winston only if database logging fails
    logger.error('Audit logging error', {
      error: error.message,
      eventType,
      userId
    });
  }
}

/**
 * Search audit logs with filtering options
 * @param {Object} options - Search and pagination options
 * @returns {Array} - Matching audit logs
 */
async function searchAuditLogs(options = {}) {
  try {
    const {
      userId = null,
      eventType = null,
      severity = null,
      startDate = null,
      endDate = null,
      limit = 50,
      page = 1,
      sortBy = 'created_at',
      sortDirection = 'desc'
    } = options;
    
    // Build query
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Apply pagination and sorting
    const offset = (page - 1) * limit;
    
    query = query
      .order(sortBy, { ascending: sortDirection === 'asc' })
      .range(offset, offset + limit - 1);
    
    // Execute query
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to search audit logs: ${error.message}`);
    }
    
    return {
      logs: data,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    };
  } catch (error) {
    logger.error('Error searching audit logs', {
      error: error.message,
      options
    });
    throw error;
  }
}

/**
 * Get audit log statistics
 * @param {Object} options - Filtering options
 * @returns {Object} - Audit log statistics
 */
async function getAuditStats(options = {}) {
  try {
    const {
      startDate = null,
      endDate = null
    } = options;
    
    // Build query for all relevant logs
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*');
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get audit log statistics: ${error.message}`);
    }
    
    // Compute statistics
    const stats = {
      total: data.length,
      byEventType: {},
      bySeverity: {
        info: 0,
        warn: 0,
        error: 0
      },
      byDate: {}
    };
    
    // Process data
    data.forEach(log => {
      // Count by event type
      stats.byEventType[log.event_type] = (stats.byEventType[log.event_type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      // Count by date (YYYY-MM-DD)
      const date = new Date(log.created_at).toISOString().split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
    });
    
    return stats;
  } catch (error) {
    logger.error('Error getting audit statistics', {
      error: error.message,
      options
    });
    throw error;
  }
}

/**
 * Export audit logs to a file
 * @param {Object} options - Filtering options
 * @returns {String} - Path to the exported file
 */
async function exportAuditLogs(options = {}) {
  try {
    const {
      userId = null,
      eventType = null,
      severity = null,
      startDate = null,
      endDate = null,
      format = 'json' // 'json' or 'csv'
    } = options;
    
    // Build query
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*');
    
    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (eventType) {
      query = query.eq('event_type', eventType);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    
    // Execute query
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to export audit logs: ${error.message}`);
    }
    
    // Create export filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `audit_logs_export_${timestamp}.${format}`;
    const filePath = path.join(logsDir, filename);
    
    // Export data in the requested format
    if (format === 'csv') {
      // Convert to CSV
      const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;
      const csvStringifier = createCsvStringifier({
        header: [
          { id: 'id', title: 'ID' },
          { id: 'event_type', title: 'Event Type' },
          { id: 'user_id', title: 'User ID' },
          { id: 'metadata', title: 'Metadata' },
          { id: 'severity', title: 'Severity' },
          { id: 'created_at', title: 'Created At' }
        ]
      });
      
      const records = data.map(log => ({
        ...log,
        metadata: JSON.stringify(log.metadata)
      }));
      
      const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
      fs.writeFileSync(filePath, csvContent);
    } else {
      // Export as JSON
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    
    return filePath;
  } catch (error) {
    logger.error('Error exporting audit logs', {
      error: error.message,
      options
    });
    throw error;
  }
}

/**
 * Clean up old audit logs based on retention policy
 * @param {Number} retentionDays - Number of days to retain logs (default: 90)
 * @returns {Object} - Result of the cleanup operation
 */
async function cleanupAuditLogs(retentionDays = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // Delete old logs from database
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('count');
    
    if (error) {
      throw new Error(`Failed to clean up audit logs: ${error.message}`);
    }
    
    // Log the cleanup operation
    logger.info(`Cleaned up audit logs older than ${retentionDays} days`, {
      deletedCount: data?.length || 0,
      cutoffDate: cutoffDate.toISOString()
    });
    
    // Also clean up log files
    const logFiles = fs.readdirSync(logsDir);
    let fileDeleteCount = 0;
    
    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);
      
      if (fileDate < cutoffDate && file.startsWith('audit_logs_export_')) {
        fs.unlinkSync(filePath);
        fileDeleteCount++;
      }
    }
    
    return {
      success: true,
      databaseRecordsDeleted: data?.length || 0,
      filesDeleted: fileDeleteCount,
      cutoffDate: cutoffDate.toISOString()
    };
  } catch (error) {
    logger.error('Error cleaning up audit logs', {
      error: error.message,
      retentionDays
    });
    throw error;
  }
}

module.exports = {
  logAuditEvent,
  searchAuditLogs,
  getAuditStats,
  exportAuditLogs,
  cleanupAuditLogs,
  logger
}; 