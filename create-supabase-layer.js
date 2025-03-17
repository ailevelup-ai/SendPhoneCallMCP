/**
 * Script to create a Lambda layer with Supabase and other dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create the Lambda layer directories
const buildDir = path.join(__dirname, 'layer-build');
const nodeDir = path.join(buildDir, 'nodejs');
const libDir = path.join(nodeDir, 'lib');
const configDir = path.join(nodeDir, 'config');
const servicesDir = path.join(nodeDir, 'services');
const utilsDir = path.join(nodeDir, 'utils');

// Create directory structure
console.log('Creating directory structure...');
[nodeDir, libDir, configDir, servicesDir, utilsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create supabase.js in the lib directory
console.log('Creating supabase.js in lib directory...');
const supabaseLibContent = `
// This is a proxy module that re-exports from config/supabase
const supabaseConfig = require('../config/supabase');
module.exports = supabaseConfig;
`;
fs.writeFileSync(path.join(libDir, 'supabase.js'), supabaseLibContent);

// Create supabase.js in the config directory
console.log('Creating supabase.js in config directory...');
const supabaseConfigContent = `
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Create Supabase client with service key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Create Supabase client with anon key for public operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = {
  supabase,
  supabaseAdmin
};
`;
fs.writeFileSync(path.join(configDir, 'supabase.js'), supabaseConfigContent);

// Create placeholder files for other modules
const placeholders = {
  'lib/api-response.js': `
const createResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true
    },
    body: JSON.stringify(body)
  };
};

module.exports = { createResponse };
`,
  'lib/rate-limit.js': `
const getRateLimit = async (userId) => {
  return { allowed: true, resetTime: null };
};

const updateRateLimit = async (userId) => {
  return true;
};

module.exports = { getRateLimit, updateRateLimit };
`,
  'services/content-moderation.js': `
const moderateContent = async (content) => {
  return { isAllowed: true, reason: null };
};

module.exports = { moderateContent };
`,
  'services/google-sheets-logging.js': `
const logCallToGoogleSheets = async (data) => {
  console.log('Logging call to Google Sheets:', data);
  return true;
};

module.exports = { logCallToGoogleSheets };
`,
  'utils/lambda-wrapper.js': `
const lambdaWrapper = (handler) => {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Lambda error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  };
};

module.exports = { lambdaWrapper };
`
};

// Create each placeholder file
Object.entries(placeholders).forEach(([file, content]) => {
  const filePath = path.join(nodeDir, file);
  const dirPath = path.dirname(filePath);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Created ${file}`);
});

// Copy .env file to the layer
if (fs.existsSync(path.join(__dirname, '.env'))) {
  fs.copyFileSync(
    path.join(__dirname, '.env'),
    path.join(nodeDir, '.env')
  );
  console.log('Copied .env file to layer');
}

// Create package.json
console.log('Creating package.json...');
const packageJson = {
  name: 'ailevelup-phone-call-mcp-layer',
  version: '1.0.0',
  description: 'Lambda layer for AILevelUp Phone Call MCP',
  dependencies: {
    '@supabase/supabase-js': '^2.33.2',
    'dotenv': '^16.3.1',
    'node-fetch': '^2.7.0',
    'uuid': '^9.0.1',
    'axios': '^1.5.0'
  }
};
fs.writeFileSync(
  path.join(nodeDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Install dependencies
console.log('Installing dependencies...');
const originalDir = process.cwd();
try {
  process.chdir(nodeDir);
  execSync('npm install --production', { stdio: 'inherit' });
} finally {
  process.chdir(originalDir);
}

// Create the ZIP file
console.log('Creating layer ZIP file...');
const zipFileName = 'ailevelup-mcp-supabase-layer.zip';
try {
  execSync(`cd ${buildDir} && zip -r ../${zipFileName} .`, { stdio: 'inherit' });
  console.log(`Layer ZIP file created: ${zipFileName}`);
} catch (error) {
  console.error('Error creating ZIP file:', error);
}

console.log('\nTo deploy this layer to AWS Lambda, run:');
console.log(`aws lambda publish-layer-version \\
  --layer-name ailevelup-phone-call-mcp-staging-dependencies \\
  --description "Shared dependencies for ailevelup-phone-call-mcp" \\
  --zip-file fileb://${zipFileName} \\
  --compatible-runtimes nodejs18.x nodejs20.x nodejs22.x \\
  --region us-east-1`); 