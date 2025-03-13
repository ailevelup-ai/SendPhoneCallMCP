/**
 * Rate Limiter Middleware
 * 
 * Configures and exports a middleware for API rate limiting.
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

/**
 * Create a rate limiter middleware for Express
 * @param {Object} options Configuration options
 * @param {number} options.windowMs Time window in milliseconds
 * @param {number} options.max Maximum requests per window
 * @param {string} options.message Error message
 * @param {boolean} options.standardHeaders Whether to add standard rate limit headers
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const config = {
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // Limit each IP to 100 requests per window
    standardHeaders: options.standardHeaders !== false, // Send standard rate limit headers
    legacyHeaders: false, // Don't send legacy X-RateLimit headers
    message: options.message || {
      status: 429,
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.'
    },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        path: req.path,
        method: req.method,
        limit: options.max,
        window: options.windowMs
      });
      
      res.status(429).json(options.message);
    }
  };
  
  return rateLimit(config);
}

// Export rate limiter
module.exports = {
  createRateLimiter
}; 