require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initializeSpreadsheet } = require('./google-sheets-logging');
const routes = require('./routes');
const { initializeDatabase } = require('./config/supabase');
const { initializeMcpServer } = require('./mcp/server');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3040;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https://api.bland.ai"]
    }
  }
}));
app.use(cors());

// Logging middleware
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.'
  }
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1', routes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// Initialize Google Sheets and start server
async function startServer() {
  try {
    console.log('Initializing Google Sheets...');
    await initializeSpreadsheet();
    console.log('Google Sheets initialized successfully');

    try {
      await initializeDatabase();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed, but continuing server startup:', error);
    }

    // Create HTTP server
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${NODE_ENV} mode`);
      console.log(`Health check available at: http://localhost:${PORT}/health`);
      console.log(`API available at: http://localhost:${PORT}/api/v1`);
      console.log(`MCP available at: http://localhost:${PORT}/api/v1/mcp`);
    });

    // Initialize MCP server
    initializeMcpServer(app, server);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();

// Export app for testing
module.exports = app; 