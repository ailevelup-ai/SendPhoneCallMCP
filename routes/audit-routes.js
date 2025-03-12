const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit-controller');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rate-limit');

// All routes require authentication
router.use(authMiddleware.authenticate);

// Additional middleware to require admin privileges for most routes
const requireAdmin = authMiddleware.requireAdmin;

// Search audit logs (admin only)
router.get(
  '/logs',
  requireAdmin,
  rateLimitMiddleware.limitByUser(30, 60), // 30 requests per minute
  auditController.searchLogs
);

// Get audit statistics (admin only)
router.get(
  '/stats',
  requireAdmin,
  rateLimitMiddleware.limitByUser(20, 60), // 20 requests per minute
  auditController.getStats
);

// Export logs (admin only)
router.get(
  '/export',
  requireAdmin,
  rateLimitMiddleware.limitByUser(5, 60), // 5 requests per minute
  auditController.exportLogs
);

// Clean up old logs (admin only)
router.post(
  '/cleanup',
  requireAdmin,
  rateLimitMiddleware.limitByUser(2, 60), // 2 requests per minute
  auditController.cleanupLogs
);

// Log custom event (available to all authenticated users)
router.post(
  '/events',
  rateLimitMiddleware.limitByUser(60, 60), // 60 requests per minute
  auditController.logCustomEvent
);

module.exports = router; 