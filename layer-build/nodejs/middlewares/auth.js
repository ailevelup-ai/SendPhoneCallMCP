const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function validateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key provided' });
    }

    // Get user by API key
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check if user has sufficient credits
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (creditsError) {
      return res.status(500).json({ error: 'Error checking credits' });
    }

    // Attach user and credits to request
    req.user = user;
    req.userCredits = credits.balance;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  authenticate,
  requireAdmin,
  validateApiKey
}; 