const auditService = require('../services/audit-logging');
const { logger } = require('../services/audit-logging');

/**
 * Search audit logs with filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchLogs(req, res) {
  try {
    const options = {
      userId: req.query.userId,
      eventType: req.query.eventType,
      severity: req.query.severity,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      page: req.query.page ? parseInt(req.query.page, 10) : 1,
      sortBy: req.query.sortBy || 'created_at',
      sortDirection: req.query.sortDirection || 'desc'
    };
    
    const results = await auditService.searchAuditLogs(options);
    
    return res.status(200).json({
      success: true,
      ...results
    });
  } catch (error) {
    logger.error('Error in searchLogs controller', { error: error.message });
    return res.status(500).json({ error: 'Failed to search audit logs' });
  }
}

/**
 * Get audit log statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getStats(req, res) {
  try {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const stats = await auditService.getAuditStats(options);
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error in getStats controller', { error: error.message });
    return res.status(500).json({ error: 'Failed to get audit statistics' });
  }
}

/**
 * Export audit logs to a file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function exportLogs(req, res) {
  try {
    const options = {
      userId: req.query.userId,
      eventType: req.query.eventType,
      severity: req.query.severity,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      format: req.query.format || 'json'
    };
    
    const filePath = await auditService.exportAuditLogs(options);
    
    // Set appropriate headers based on format
    if (options.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_export.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_export.json"`);
    }
    
    // Send the file
    return res.sendFile(filePath);
  } catch (error) {
    logger.error('Error in exportLogs controller', { error: error.message });
    return res.status(500).json({ error: 'Failed to export audit logs' });
  }
}

/**
 * Clean up old audit logs
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function cleanupLogs(req, res) {
  try {
    const retentionDays = req.query.retentionDays ? parseInt(req.query.retentionDays, 10) : 90;
    
    // Validate inputs
    if (retentionDays < 1) {
      return res.status(400).json({ error: 'Retention days must be at least 1' });
    }
    
    const result = await auditService.cleanupAuditLogs(retentionDays);
    
    return res.status(200).json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Error in cleanupLogs controller', { error: error.message });
    return res.status(500).json({ error: 'Failed to clean up audit logs' });
  }
}

/**
 * Log a custom audit event
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function logCustomEvent(req, res) {
  try {
    const { eventType, metadata, severity } = req.body;
    const userId = req.user.id;
    
    // Validate inputs
    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }
    
    // Log the event
    await auditService.logAuditEvent(eventType, userId, metadata, severity || 'info');
    
    return res.status(200).json({
      success: true,
      message: 'Event logged successfully'
    });
  } catch (error) {
    logger.error('Error in logCustomEvent controller', { error: error.message });
    return res.status(500).json({ error: 'Failed to log custom event' });
  }
}

module.exports = {
  searchLogs,
  getStats,
  exportLogs,
  cleanupLogs,
  logCustomEvent
}; 