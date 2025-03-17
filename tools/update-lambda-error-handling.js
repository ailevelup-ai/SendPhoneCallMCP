#!/usr/bin/env node

/**
 * Lambda Error Handling Updater
 * 
 * This script updates all Lambda function implementations to use the
 * lambdaWrapper utility for consistent error handling.
 * 
 * Usage:
 *   node update-lambda-error-handling.js
 */

const fs = require('fs').promises;
const path = require('path');

// Path to Lambda functions directory
const functionsDir = path.join(__dirname, '..', 'functions');

// Import pattern for the lambda wrapper
const wrapperImport = `const { lambdaWrapper } = require('../utils/lambda-wrapper');`;

/**
 * Process and update a Lambda function file
 */
async function updateLambdaFile(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  try {
    // Read the file
    let content = await fs.readFile(filePath, 'utf8');
    
    // Skip if already using the wrapper
    if (content.includes('lambdaWrapper') || content.includes('lambda-wrapper')) {
      console.log(`✅ File already uses the Lambda wrapper: ${filePath}`);
      return true;
    }
    
    // Find the exports.handler definition
    const handlerMatch = content.match(/exports\.handler\s*=\s*async\s*\(event,\s*context\)\s*=>\s*{/);
    
    if (!handlerMatch) {
      console.log(`⚠️ Could not find handler definition in: ${filePath}`);
      return false;
    }
    
    // Add the wrapper import at the top of the file (after any require statements)
    const requireBlocks = content.match(/require\(.+\);/g) || [];
    
    if (requireBlocks.length > 0) {
      const lastRequire = requireBlocks[requireBlocks.length - 1];
      const lastRequirePos = content.lastIndexOf(lastRequire) + lastRequire.length;
      content = content.substring(0, lastRequirePos) + '\n' + wrapperImport + content.substring(lastRequirePos);
    } else {
      // No requires found, add at the top
      content = wrapperImport + '\n\n' + content;
    }
    
    // Extract the handler function logic
    const handlerFunctionMatch = content.match(/exports\.handler\s*=\s*async\s*\(event,\s*context\)\s*=>\s*{([^]*?)};/);
    
    if (!handlerFunctionMatch || !handlerFunctionMatch[1]) {
      console.log(`⚠️ Could not extract handler function body in: ${filePath}`);
      return false;
    }
    
    // Create a new internal handler function
    const internalFunctionName = `_${path.basename(filePath, '.js')}Handler`;
    const handlerBody = handlerFunctionMatch[1];
    
    // Create the internal handler function
    const internalFunction = `const ${internalFunctionName} = async (event, context) => {${handlerBody}};`;
    
    // Replace the original handler with the wrapped version
    const wrappedHandler = `exports.handler = lambdaWrapper(${internalFunctionName});`;
    
    // Replace the original handler in the content
    content = content.replace(/exports\.handler\s*=\s*async\s*\(event,\s*context\)\s*=>\s*{([^]*?)};/, 
                             `${internalFunction}\n\n${wrappedHandler}`);
    
    // Write the updated content back to the file
    await fs.writeFile(filePath, content, 'utf8');
    
    console.log(`✅ Successfully updated: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating file ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main function to update all Lambda functions
 */
async function updateAllLambdaFunctions() {
  console.log('Starting Lambda error handling update');
  console.log('=====================================================================');
  
  try {
    // Check if the utils/lambda-wrapper.js file exists
    try {
      await fs.access(path.join(__dirname, '..', 'utils', 'lambda-wrapper.js'));
    } catch (error) {
      console.error('Error: lambda-wrapper.js file not found in utils directory.');
      console.error('Please create the lambda-wrapper.js file first.');
      return;
    }
    
    // Get all JavaScript files in the functions directory
    const files = await fs.readdir(functionsDir);
    const jsFiles = files
      .filter(file => file.endsWith('.js') && !file.endsWith('.test.js'))
      .map(file => path.join(functionsDir, file));
    
    if (jsFiles.length === 0) {
      console.log('No Lambda function files found in the functions directory');
      return;
    }
    
    console.log(`Found ${jsFiles.length} Lambda function files to process`);
    
    // Track success/failure
    let successCount = 0;
    let failureCount = 0;
    
    // Process each file
    for (const file of jsFiles) {
      const success = await updateLambdaFile(file);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      console.log('---------------------------------------------------------------------');
    }
    
    // Summary
    console.log('=====================================================================');
    console.log('Lambda Error Handling Update Summary:');
    console.log(`Total files: ${jsFiles.length}`);
    console.log(`Successful updates: ${successCount}`);
    console.log(`Failed updates: ${failureCount}`);
    console.log('=====================================================================');
    
    if (successCount > 0) {
      console.log('⚠️ Remember to re-deploy the Lambda functions to apply the changes');
    }
  } catch (error) {
    console.error('Error updating Lambda functions:', error);
  }
}

// Run the script
updateAllLambdaFunctions().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 