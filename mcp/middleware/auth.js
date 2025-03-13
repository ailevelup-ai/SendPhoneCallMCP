/**
 * Authentication Middleware for MCP
 * 
 * This module provides authentication middleware for MCP endpoints.
 */

const jwt = require('jsonwebtoken');
const { createErrorResponse, JsonRpcErrorCodes } = require('../lib/json-rpc');
const { logger } = require('../../utils/logger');
const { supabase } = require('../../config/supabase');

/**
 * Authentication middleware for MCP requests
 * Validates the Bearer token and attaches user information to the request
 */
async function authenticateMcp(req, res, next) {
  // Get Authorization header
  const authHeader = req.headers.authorization;
  
  // Check if Authorization header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('MCP authentication failed: Missing or invalid Authorization header');
    return res.status(401).json(
      createErrorResponse(
        req.body.id || null,
        JsonRpcErrorCodes.UNAUTHORIZED,
        "Missing or invalid Authorization header"
      )
    );
  }
  
  // Extract token
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user ID to request
    req.userId = decoded.userId;
    
    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, api_key')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !user) {
      logger.warn(`MCP authentication failed: User not found`, { userId: decoded.userId });
      return res.status(401).json(
        createErrorResponse(
          req.body.id || null,
          JsonRpcErrorCodes.UNAUTHORIZED,
          "Invalid authentication token"
        )
      );
    }
    
    // Attach user to request
    req.user = user;
    
    // Proceed to next middleware
    next();
  } catch (error) {
    logger.warn(`MCP authentication failed: ${error.message}`, { error });
    
    // Send appropriate error response
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json(
        createErrorResponse(
          req.body.id || null,
          JsonRpcErrorCodes.UNAUTHORIZED,
          "Authentication token expired"
        )
      );
    }
    
    return res.status(401).json(
      createErrorResponse(
        req.body.id || null,
        JsonRpcErrorCodes.UNAUTHORIZED,
        "Invalid authentication token"
      )
    );
  }
}

/**
 * Check if user has required permissions
 * @param {Object} req Express request
 * @param {Array} roles Array of allowed roles
 * @returns {boolean} True if user has permission, false otherwise
 */
function hasPermission(req, roles) {
  if (!req.user) {
    return false;
  }
  
  return roles.includes(req.user.role);
}

/**
 * Create permissions middleware
 * @param {Array} roles Array of allowed roles
 * @returns {Function} Express middleware
 */
function requirePermission(roles) {
  return (req, res, next) => {
    if (!hasPermission(req, roles)) {
      logger.warn(`MCP permission denied: User ${req.userId} does not have required roles`, {
        userId: req.userId,
        requiredRoles: roles,
        userRole: req.user?.role
      });
      
      return res.status(403).json(
        createErrorResponse(
          req.body.id || null,
          JsonRpcErrorCodes.UNAUTHORIZED,
          "Insufficient permissions"
        )
      );
    }
    
    next();
  };
}

module.exports = {
  authenticateMcp,
  hasPermission,
  requirePermission
}; 