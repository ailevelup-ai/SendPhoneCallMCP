const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Import available route modules
// We'll dynamically detect which route files exist and import only those
const routeModules = {
  // Map route endpoints to their file paths, with flag for existence
  'auth': { path: './auth-routes.js', exists: false },
  'audit': { path: './audit-routes.js', exists: false },
  'phone-calls': { path: './phone-call-routes.js', exists: false },
  'dashboard': { path: './dashboard-routes.js', exists: false }
};

// Check which route files actually exist
Object.keys(routeModules).forEach(route => {
  try {
    if (fs.existsSync(path.join(__dirname, routeModules[route].path))) {
      routeModules[route].exists = true;
      const routeModule = require(routeModules[route].path);
      router.use(`/${route}`, routeModule);
      console.log(`Route module loaded: ${route}`);
    }
  } catch (error) {
    console.error(`Error loading route module ${route}:`, error.message);
  }
});

// Add the simplified call endpoint
const phoneCallRoutes = require('./phone-call-routes');
router.use('/', phoneCallRoutes);

// Root route for API info
router.get('/', (req, res) => {
  // Only include routes that actually exist
  const endpoints = {};
  Object.keys(routeModules).forEach(route => {
    if (routeModules[route].exists) {
      endpoints[route] = `/api/v1/${route}`;
    }
  });

  // Add the simplified call endpoint
  endpoints.call = '/api/v1/call';

  res.json({
    name: 'Bland.AI MCP Wrapper API',
    version: '1.0.0',
    endpoints
  });
});

module.exports = router; 