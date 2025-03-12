const express = require('express');
const router = express.Router();

// Import route modules
const callRoutes = require('./call.routes');
const authRoutes = require('./auth.routes');
const billingRoutes = require('./billing.routes');
const userRoutes = require('./user.routes');
const webhookRoutes = require('./webhook.routes');
const phoneCallRoutes = require('./phone-call-routes');
const auditRoutes = require('./audit-routes');
const dashboardRoutes = require('./dashboard-routes');

// Apply routes
router.use('/calls', callRoutes);
router.use('/auth', authRoutes);
router.use('/billing', billingRoutes);
router.use('/users', userRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/phone-calls', phoneCallRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);

// Root route for API info
router.get('/', (req, res) => {
  res.json({
    name: 'Bland.AI MCP Wrapper API',
    version: '1.0.0',
    endpoints: {
      calls: '/api/v1/calls',
      auth: '/api/v1/auth',
      billing: '/api/v1/billing',
      users: '/api/v1/users',
      webhooks: '/api/v1/webhooks',
      phoneCalls: '/api/v1/phone-calls',
      audit: '/api/v1/audit',
      dashboard: '/api/v1/dashboard'
    }
  });
});

module.exports = router; 