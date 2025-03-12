const express = require('express');
const router = express.Router();
const { validateJWT } = require('../middlewares/auth.middleware');
const authController = require('../controllers/auth.controller');

// Register a new user
router.post('/register', authController.register);

// Login a user
router.post('/login', authController.login);

// Generate a new API key
router.post('/api-keys', validateJWT, authController.generateApiKey);

// List API keys for a user
router.get('/api-keys', validateJWT, authController.listApiKeys);

// Revoke an API key
router.delete('/api-keys/:keyId', validateJWT, authController.revokeApiKey);

// Generate access tokens from refresh tokens
router.post('/token', authController.refreshToken);

// Logout
router.post('/logout', validateJWT, authController.logout);

module.exports = router; 