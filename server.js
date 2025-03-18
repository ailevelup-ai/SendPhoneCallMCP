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

// Import route modules
const authRoutes = require('./routes/auth-routes');
const auditRoutes = require('./routes/audit-routes');
const phoneCallRoutes = require('./routes/phone-call-routes');
const dashboardRoutes = require('./routes/dashboard-routes');
const voiceSampleRoutes = require('./server/api/voice-sample');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3030;
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

// Add bypass middleware in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('DEVELOPMENT MODE: Creating simplified MCP endpoint');
  
  // These routes need to be defined BEFORE the other app.use('/api/v1') routes
  app.options('/api/v1/mcp', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, MCP-Session-Id');
    res.header('Access-Control-Expose-Headers', 'MCP-Session-Id');
    res.status(200).end();
  });
  
  app.post('/api/v1/mcp', (req, res) => {
    console.log('DEV MCP REQUEST:', req.method, req.body?.method);
    
    // Create a session ID
    const sessionId = 'dev-session-' + Date.now();
    res.setHeader('MCP-Session-Id', sessionId);
    
    // Process methods
    if (req.body && req.body.method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          sessionId,
          server: {
            name: "ailevelup-mcp-dev",
            version: "1.0.0"
          },
          capabilities: {
            tools: { schema: { version: "2024-11-05" } },
            resources: { schema: { version: "2024-11-05" } }
          }
        }
      });
    }
    
    if (req.body && req.body.method === 'tools/execute') {
      const toolName = req.body.params?.name || 'unknown';
      console.log('DEV MCP TOOL REQUEST:', toolName);
      
      // Handle specific tool types
      if (toolName === 'getVoiceOptions') {
        return res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: {
            voices: [
              { id: "1", name: "Alex", gender: "male", accent: "American" },
              { id: "2", name: "Emily", gender: "female", accent: "American" },
              { id: "3", name: "David", gender: "male", accent: "British" },
              { id: "4", name: "Sarah", gender: "female", accent: "British" }
            ]
          }
        });
      }
      
      if (toolName === 'getModelOptions') {
        return res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: [
            { id: "standard", name: "Standard", description: "Basic voice model" },
            { id: "turbo", name: "Turbo", description: "Enhanced voice model" }
          ]
        });
      }
      
      if (toolName === 'getCredits') {
        return res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          result: {
            balance: 100.0,
            totalAdded: 150.0,
            totalUsed: 50.0
          }
        });
      }
      
      // Default response for other tools
      return res.json({
        jsonrpc: '2.0',
        id: req.body.id,
        result: {
          success: true,
          toolName: toolName,
          mockData: true,
          message: 'This is mock data for development mode'
        }
      });
    }
    
    // Default response for other methods
    return res.json({
      jsonrpc: '2.0',
      id: req.body.id || 0,
      result: {
        success: true,
        devMode: true,
        message: 'Development mode MCP endpoint'
      }
    });
  });
}

// API Routes
app.use('/api/v1', routes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', auditRoutes);
app.use('/api/v1', phoneCallRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api', voiceSampleRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, 'client/build')));

// Explicitly serve the images directory
app.use('/images', express.static(path.join(__dirname, 'client/public/images')));

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