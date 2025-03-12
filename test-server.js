require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Root route for API info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Bland.AI MCP Wrapper API',
    version: '1.0.0',
    endpoints: {
      phoneCalls: '/api/v1/phone-calls',
      audit: '/api/v1/audit',
      dashboard: '/api/v1/dashboard'
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
}); 