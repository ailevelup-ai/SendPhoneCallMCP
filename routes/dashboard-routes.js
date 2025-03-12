const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard-controller');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { rateLimiter } = require('../middleware/rate-limiter');

// Middleware for all dashboard routes
router.use(authenticate);

// User dashboard - available to all authenticated users
router.get(
  '/user',
  rateLimiter({ windowMs: 60 * 1000, max: 20 }), // 20 requests per minute
  dashboardController.getUserDashboard
);

// System metrics - admin only
router.get(
  '/metrics',
  requireAdmin,
  rateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 requests per minute
  dashboardController.getSystemMetrics
);

// Generate reports - admin only
router.get(
  '/reports/:reportType',
  requireAdmin, 
  rateLimiter({ windowMs: 60 * 1000, max: 5 }), // 5 requests per minute
  dashboardController.generateReport
);

// Schedule a report
router.post(
  '/reports/schedule',
  rateLimiter({ windowMs: 5 * 60 * 1000, max: 5 }), // 5 requests per 5 minutes
  dashboardController.scheduleReport
);

// Get scheduled reports
router.get(
  '/reports/scheduled',
  rateLimiter({ windowMs: 60 * 1000, max: 10 }), // 10 requests per minute
  dashboardController.getScheduledReports
);

module.exports = router; 