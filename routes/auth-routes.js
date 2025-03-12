const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate API key
    const apiKey = uuidv4();

    // Create user
    const { data: user, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        api_key: apiKey,
        role: 'user'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return res.status(500).json({ error: 'Error creating user' });
    }

    // Initialize credits for the user
    const { error: creditsError } = await supabaseAdmin
      .from('credits')
      .insert({
        user_id: user.id,
        balance: 10.0 // Give 10 credits to start
      });

    if (creditsError) {
      console.error('Error initializing credits:', creditsError);
      // Don't fail registration if credits initialization fails
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    // Log the registration
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'user_registration',
        metadata: { email }
      });

    // Return user info (excluding password hash)
    const userResponse = {
      id: user.id,
      email: user.email,
      api_key: apiKey,
      role: user.role,
      token
    };

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    // Log the login
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'user_login',
        metadata: { email }
      });

    // Return user info (excluding password hash)
    const userResponse = {
      id: user.id,
      email: user.email,
      api_key: user.api_key,
      role: user.role,
      token
    };

    res.json(userResponse);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 