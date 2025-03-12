require('dotenv').config();
const { initializeDatabase } = require('../config/supabase');
const { initializeSpreadsheet } = require('../google-sheets-logging');
const fs = require('fs').promises;
const path = require('path');

async function createRequiredDirectories() {
  const dirs = [
    'logs',
    'logs/audit',
    'logs/calls',
    'logs/errors'
  ];

  for (const dir of dirs) {
    await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

async function verifyEnvironmentVariables() {
  const requiredVars = [
    'PORT',
    'NODE_ENV',
    'BLAND_ENTERPRISE_API_KEY',
    'STRIPE_SECRET_KEY',
    'OPENAI_API_KEY',
    'JWT_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY',
    'GOOGLE_SHEETS_PRIVATE_KEY',
    'GOOGLE_SHEETS_CLIENT_EMAIL',
    'GOOGLE_SHEETS_DOC_ID'
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  console.log('All required environment variables are present');
}

async function setup() {
  try {
    console.log('Starting setup process...');

    // Verify environment variables
    await verifyEnvironmentVariables();
    console.log('Environment variables verified');

    // Create required directories
    await createRequiredDirectories();
    console.log('Required directories created');

    // Initialize database schema
    await initializeDatabase();
    console.log('Database schema initialized');

    // Initialize Google Sheets
    await initializeSpreadsheet();
    console.log('Google Sheets initialized');

    console.log('Setup completed successfully!');
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

// Run setup if this file is run directly
if (require.main === module) {
  setup();
}

module.exports = setup; 