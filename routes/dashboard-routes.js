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

// Mock authentication middleware for development
const mockAuthenticate = (req, res, next) => {
  // For development, always authenticate
  req.user = { id: 'dev-user-id', role: 'admin' };
  next();
};

// Mock admin check middleware
const mockRequireAdmin = (req, res, next) => {
  // For development, always grant admin access
  next();
};

// Mock rate limiter
const mockRateLimiter = (limit, period) => (req, res, next) => {
  // For development, don't apply rate limiting
  next();
};

// Apply authentication to all routes
router.use(mockAuthenticate);

// Mock dashboard controller functions
const getOverview = (req, res) => {
  res.json({
    success: true,
    data: {
      calls: {
        total: 1250,
        successful: 1150,
        failed: 100,
        daily_average: 42
      },
      credits: {
        used_today: 253,
        used_this_month: 6428,
        remaining: 3572,
        monthly_budget: 10000
      },
      active_users: 78,
      system_health: 'optimal'
    }
  });
};

const getCallMetrics = (req, res) => {
  res.json({
    success: true,
    data: {
      call_volume_by_day: {
        '2023-03-01': 42,
        '2023-03-02': 47,
        '2023-03-03': 51,
        '2023-03-04': 38,
        '2023-03-05': 45
      },
      average_duration: 3.7, // minutes
      success_rate: 92, // percentage
      busiest_hours: [10, 14, 16], // hours of day (24h format)
      most_used_voices: [
        { name: 'alloy', count: 523 },
        { name: 'nova', count: 431 },
        { name: 'shimmer', count: 296 }
      ]
    }
  });
};

const getCreditUsage = (req, res) => {
  res.json({
    success: true,
    data: {
      usage_by_day: {
        '2023-03-01': 520,
        '2023-03-02': 495,
        '2023-03-03': 610,
        '2023-03-04': 430,
        '2023-03-05': 520
      },
      usage_by_user: [
        { user_id: 'user123', credits: 780 },
        { user_id: 'user456', credits: 650 },
        { user_id: 'user789', credits: 520 }
      ],
      projected_monthly_usage: 9750,
      average_cost_per_call: 4.2
    }
  });
};

const getHealthStatus = (req, res) => {
  res.json({
    success: true,
    data: {
      api_status: 'operational',
      database_status: 'operational',
      google_sheets_status: 'operational',
      latency: {
        api_calls: 120, // ms
        database_queries: 85, // ms
        google_sheets: 350 // ms
      },
      uptime: 99.95, // percentage
      last_incident: '2023-02-15T08:23:12Z'
    }
  });
};

// Define routes
router.get('/overview', mockRequireAdmin, mockRateLimiter(30, 60), getOverview);
router.get('/call-metrics', mockRequireAdmin, mockRateLimiter(20, 60), getCallMetrics);
router.get('/credit-usage', mockRequireAdmin, mockRateLimiter(15, 60), getCreditUsage);
router.get('/health', mockRequireAdmin, mockRateLimiter(10, 60), getHealthStatus);

module.exports = router; 