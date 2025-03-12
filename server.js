require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initializeSpreadsheet } = require('./google-sheets-logging');
const routes = require('./routes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3040;
const environment = process.env.NODE_ENV || 'development';

// Apply security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/v1', routes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Initialize Google Sheets and start server
async function startServer() {
  try {
    console.log('Initializing Google Sheets...');
    await initializeSpreadsheet();
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT} in ${environment} mode`);
      console.log(`Health check available at: http://localhost:${PORT}/health`);
      console.log(`API available at: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    process.exit(1);
  }
}

startServer();

// Export app for testing
module.exports = app; 