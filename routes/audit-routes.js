const express = require('express');
const router = express.Router();

// Mock authentication middleware for development
const authenticate = (req, res, next) => {
  // For development, always authenticate
  req.user = { id: 'dev-user-id', role: 'admin' };
  next();
};

// Mock admin check middleware
const requireAdmin = (req, res, next) => {
  // For development, always grant admin access
  next();
};

// Mock rate limiter
const rateLimiter = (limit, period) => (req, res, next) => {
  // For development, don't apply rate limiting
  next();
};

// Apply authentication to all routes
router.use(authenticate);

// Mock controller functions
const searchLogs = (req, res) => {
  res.json({
    success: true,
    message: 'Mock audit logs search',
    data: [
      {
        id: '1',
        event: 'call_initiated',
        user_id: 'user123',
        timestamp: new Date().toISOString(),
        details: { phone: '555-555-5555' }
      }
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1
    }
  });
};

const getStats = (req, res) => {
  res.json({
    success: true,
    message: 'Mock audit stats',
    data: {
      total_events: 125,
      events_by_type: {
        call_initiated: 50,
        call_completed: 45,
        user_login: 30
      },
      events_by_day: {
        [new Date().toISOString().split('T')[0]]: 12
      }
    }
  });
};

const exportLogs = (req, res) => {
  res.json({
    success: true,
    message: 'Export functionality would generate a file for download',
    mockData: 'This would be CSV or JSON data in a real implementation'
  });
};

const cleanupLogs = (req, res) => {
  res.json({
    success: true,
    message: 'Mock cleanup completed',
    deleted_count: 5
  });
};

const logCustomEvent = (req, res) => {
  const { eventType, metadata, severity } = req.body;
  
  if (!eventType) {
    return res.status(400).json({
      success: false,
      message: 'Event type is required'
    });
  }
  
  res.json({
    success: true,
    message: 'Mock event logged successfully',
    event: {
      id: 'mock-event-id',
      type: eventType,
      severity: severity || 'info',
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    }
  });
};

// Define routes
router.get('/logs', requireAdmin, rateLimiter(30, 60), searchLogs);
router.get('/stats', requireAdmin, rateLimiter(20, 60), getStats);
router.get('/export', requireAdmin, rateLimiter(5, 60), exportLogs);
router.post('/cleanup', requireAdmin, rateLimiter(2, 60), cleanupLogs);
router.post('/events', rateLimiter(60, 60), logCustomEvent);

module.exports = router; 