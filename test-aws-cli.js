#!/usr/bin/env node

const { execSync } = require('child_process');

try {
  console.log('Testing AWS CLI through Node.js:');
  
  // Try using the full path
  console.log('Using explicit path:');
  const fullPathOutput = execSync('/usr/bin/aws --version', { encoding: 'utf8' });
  console.log(fullPathOutput);
} catch (error) {
  console.error('Error with explicit path:', error.message);
  
  try {
    // Try using the command as is (relying on PATH)
    console.log('\nUsing PATH:');
    const pathOutput = execSync('aws --version', { encoding: 'utf8' });
    console.log(pathOutput);
  } catch (error) {
    console.error('Error with PATH:', error.message);
  }
}

// Try to get AWS account info
try {
  console.log('\nTrying to get AWS account info:');
  const accountOutput = execSync('aws sts get-caller-identity --query "Account" --output text', { encoding: 'utf8' });
  console.log('AWS Account:', accountOutput);
} catch (error) {
  console.error('Error getting AWS account info:', error.message);
} 