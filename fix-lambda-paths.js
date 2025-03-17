#!/usr/bin/env node

/**
 * This script fixes the require paths in Lambda functions
 * to properly access modules from the Lambda layer at /opt/nodejs
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Function directories
const functionsDir = path.join(__dirname, 'functions');

// Pattern to match local requires
const localRequirePattern = /require\(['"]\.\.\/(?:lib|services|utils|middlewares|config)\/([^'"]+)['"]\)/g;
// Pattern to match direct requires that should use the layer
const directRequirePattern = /require\(['"](?:@supabase\/supabase-js|dotenv|axios|uuid|node-fetch)['"](?!\/)/g;

// Lambda layer path prefix
const layerPrefix = '/opt/nodejs';

// Get list of function files
const functionFiles = fs.readdirSync(functionsDir)
  .filter(file => file.endsWith('.js'))
  .map(file => path.join(functionsDir, file));

console.log(`Found ${functionFiles.length} function files to process`);

// Process each function file
functionFiles.forEach(filePath => {
  console.log(`Processing ${path.basename(filePath)}...`);
  
  // Read file content
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix require paths for local modules
  content = content.replace(
    localRequirePattern,
    `require('${layerPrefix}/lib/$1')`
  );
  
  // Fix require paths for direct modules that should use the layer
  content = content.replace(
    /require\(['"]\.\.\/config\/supabase['"]\)/g,
    `require('${layerPrefix}/config/supabase')`
  );
  
  content = content.replace(
    /require\(['"]\.\.\/services\/google-sheets-logging['"]\)/g,
    `require('${layerPrefix}/services/google-sheets-logging')`
  );
  
  content = content.replace(
    /require\(['"]\.\.\/services\/content-moderation['"]\)/g,
    `require('${layerPrefix}/services/content-moderation')`
  );
  
  content = content.replace(
    /require\(['"]\.\.\/utils\/lambda-wrapper['"]\)/g,
    `require('${layerPrefix}/utils/lambda-wrapper')`
  );
  
  content = content.replace(
    /require\(['"]\.\.\/lib\/rate-limit['"]\)/g,
    `require('${layerPrefix}/lib/rate-limit')`
  );
  
  content = content.replace(
    /require\(['"]\.\.\/lib\/api-response['"]\)/g,
    `require('${layerPrefix}/lib/api-response')`
  );
  
  // Write the updated content back to the file
  fs.writeFileSync(filePath, content);
  
  console.log(`✓ Updated ${path.basename(filePath)}`);
});

console.log('All function files have been updated successfully!');

// Create a package structure for Lambda functions
async function createLambdaPackages() {
  console.log('\nCreating Lambda function packages with updated paths...');
  
  // Create a directory for the slim functions
  const slimFunctionsDir = path.join(__dirname, 'functions-slim');
  if (!fs.existsSync(slimFunctionsDir)) {
    fs.mkdirSync(slimFunctionsDir, { recursive: true });
  }
  
  // Process each function to create a slim package
  for (const filePath of functionFiles) {
    const functionName = path.basename(filePath, '.js');
    console.log(`Creating slim package for ${functionName}...`);
    
    // Create a directory for this function
    const functionDir = path.join(slimFunctionsDir, functionName);
    if (!fs.existsSync(functionDir)) {
      fs.mkdirSync(functionDir, { recursive: true });
    }
    
    // Copy the function file to the slim package directory
    fs.copyFileSync(filePath, path.join(functionDir, `${functionName}.js`));
    
    // Copy the index.js file from the root directory (for the handler)
    if (fs.existsSync(path.join(__dirname, 'index.js'))) {
      fs.copyFileSync(
        path.join(__dirname, 'index.js'),
        path.join(functionDir, 'index.js')
      );
    } else {
      // Create a simple index.js file for the handler
      const indexContent = `/**
 * Handler for ${functionName} Lambda function
 */
exports.handler = require('./${functionName}').handler;
`;
      fs.writeFileSync(path.join(functionDir, 'index.js'), indexContent);
    }
    
    // Copy the .env file
    fs.copyFileSync(
      path.join(__dirname, '.env'),
      path.join(functionDir, '.env')
    );
    
    // Create a zip file for the function
    console.log(`Creating zip for ${functionName}...`);
    try {
      await exec(`cd ${functionDir} && zip -r ../../../functions-slim/${functionName}.zip .`);
      console.log(`✓ Created zip for ${functionName}`);
    } catch (error) {
      console.error(`Error creating zip for ${functionName}: ${error.message}`);
      console.error(error.stderr);
    }
  }
  
  console.log('All Lambda function packages have been created!');
}

// Execute the function to create Lambda packages
createLambdaPackages().catch(console.error); 