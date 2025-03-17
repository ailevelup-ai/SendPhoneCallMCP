/**
 * Logger Utility
 * 
 * This module provides a centralized logging system with different formats
 * for development and production environments.
 */

const winston = require('winston');
const { format } = winston;

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';

// Create format based on environment
const logFormat = isProduction 
  ? format.combine(
      format.timestamp(),
      format.json()
    ) 
  : format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.printf(({ level, message, timestamp, ...meta }) => {
        const metaStr = Object.keys(meta).length 
          ? `\n${JSON.stringify(meta, null, 2)}` 
          : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    );

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: logFormat,
  transports: [
    new winston.transports.Console()
  ]
});

// Add file transports in production
if (isProduction) {
  // Add file transports for different log levels
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );
  
  logger.add(
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );
}

/**
 * Log an HTTP request (for Express middleware)
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 * @param {number} time Request processing time in milliseconds
 */
function logHttpRequest(req, res, time) {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    statusCode: res.statusCode,
    userAgent: req.headers['user-agent'],
    responseTime: time
  };
  
  // Add user ID if authenticated
  if (req.userId) {
    logData.userId = req.userId;
  }
  
  // Log based on status code
  if (res.statusCode >= 500) {
    logger.error('HTTP Request Error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request Warning', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
}

/**
 * Create Express middleware for HTTP request logging
 * @returns {Function} Express middleware function
 */
function httpLoggerMiddleware() {
  return (req, res, next) => {
    const startHrTime = process.hrtime();
    
    // Add response listener
    res.on('finish', () => {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1000000;
      
      logHttpRequest(req, res, elapsedTimeInMs);
    });
    
    next();
  };
}

module.exports = {
  logger,
  logHttpRequest,
  httpLoggerMiddleware
}; 