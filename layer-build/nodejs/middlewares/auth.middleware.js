const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware to validate API key
 */
const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }
    
    // Look up the API key in the database
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('user_id, is_active, permissions')
      .eq('key', apiKey)
      .single();
      
    if (error || !data) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    if (!data.is_active) {
      return res.status(403).json({ error: 'API key is inactive' });
    }
    
    // Add user data to request object
    req.user = {
      id: data.user_id,
      permissions: data.permissions || []
    };
    
    next();
  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware to validate JWT token
 */
const validateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'JWT token is required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      // Add user data to request object
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('JWT validation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware to check admin permissions
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.permissions.includes('admin')) {
    return res.status(403).json({ error: 'Admin permission required' });
  }
  
  next();
};

module.exports = {
  validateApiKey,
  validateJWT,
  requireAdmin
}; 