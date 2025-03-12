const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { createCreditAccount } = require('../services/billing');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
      
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    
    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email for now, can be changed for production
    });
    
    if (authError) {
      console.error('Supabase Auth error:', authError);
      return res.status(500).json({ error: 'Failed to create user' });
    }
    
    // Create user profile in our users table
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        name: name || email.split('@')[0], // Use part of email as name if not provided
        created_at: new Date(),
        updated_at: new Date()
      })
      .select()
      .single();
      
    if (profileError) {
      console.error('User profile creation error:', profileError);
      // Attempt to clean up the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return res.status(500).json({ error: 'Failed to create user profile' });
    }
    
    // Create credit account for the new user (with free minutes)
    await createCreditAccount(authUser.user.id);
    
    // Generate access token
    const token = jwt.sign(
      { id: authUser.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: authUser.user.id,
        email,
        name: userProfile.name
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Login a user
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Get user profile from our users table
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    // Generate access token
    const token = jwt.sign(
      { 
        id: authData.user.id, 
        email,
        name: userProfile?.name || email.split('@')[0],
        permissions: userProfile?.permissions || []
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { id: authData.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Store refresh token in database
    await supabaseAdmin
      .from('refresh_tokens')
      .insert({
        user_id: authData.user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });
    
    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email,
        name: userProfile?.name
      },
      token,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Generate a new API key for a user
 */
const generateApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, permissions } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'API key name is required' });
    }
    
    // Generate a secure random API key
    const apiKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    
    // Store the API key in the database
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: userId,
        key: apiKey,
        name,
        permissions: permissions || ['api:access'],
        is_active: true,
        created_at: new Date()
      })
      .select()
      .single();
      
    if (error) {
      console.error('API key generation error:', error);
      return res.status(500).json({ error: 'Failed to generate API key' });
    }
    
    res.status(201).json({
      message: 'API key generated successfully',
      apiKey: {
        id: data.id,
        key: apiKey, // Only show the key once, after creation
        name: data.name,
        permissions: data.permissions,
        isActive: data.is_active,
        createdAt: data.created_at
      }
    });
  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * List API keys for a user
 */
const listApiKeys = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, permissions, is_active, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('API key list error:', error);
      return res.status(500).json({ error: 'Failed to retrieve API keys' });
    }
    
    res.json({
      apiKeys: data.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions,
        isActive: key.is_active,
        createdAt: key.created_at,
        lastUsedAt: key.last_used_at
      }))
    });
  } catch (error) {
    console.error('API key list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Revoke an API key
 */
const revokeApiKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const keyId = req.params.keyId;
    
    // Make sure the API key belongs to the user
    const { data: keyCheck, error: keyCheckError } = await supabaseAdmin
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();
      
    if (keyCheckError || !keyCheck) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Deactivate the API key
    const { error } = await supabaseAdmin
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);
      
    if (error) {
      console.error('API key revocation error:', error);
      return res.status(500).json({ error: 'Failed to revoke API key' });
    }
    
    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('API key revocation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh access token using a refresh token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Check if refresh token exists in the database
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('refresh_tokens')
      .select('*')
      .eq('user_id', decoded.id)
      .eq('token', refreshToken)
      .single();
      
    if (tokenError || !tokenData) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    // Check if refresh token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }
    
    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();
      
    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate new access token
    const newToken = jwt.sign(
      { 
        id: userData.id, 
        email: userData.email,
        name: userData.name,
        permissions: userData.permissions || []
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );
    
    res.json({
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout - invalidate refresh token
 */
const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Remove specific refresh token
      await supabaseAdmin
        .from('refresh_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', refreshToken);
    } else {
      // Remove all refresh tokens for user
      await supabaseAdmin
        .from('refresh_tokens')
        .delete()
        .eq('user_id', userId);
    }
    
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  refreshToken,
  logout
}; 