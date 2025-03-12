// Local script to poll for call updates every 5 minutes
require('dotenv').config();
const { pollCallUpdates } = require('./google-sheets-logging');

console.log('Starting call update polling service...');

// Run immediately on startup
pollCallUpdates()
  .then(() => console.log('Initial poll completed at', new Date().toISOString()))
  .catch(error => console.error('Error in initial poll:', error));

// Then run every 5 minutes
setInterval(() => {
  console.log('Running scheduled poll at', new Date().toISOString());
  pollCallUpdates()
    .then(() => console.log('Poll completed at', new Date().toISOString()))
    .catch(error => console.error('Error in scheduled poll:', error));
}, 5 * 60 * 1000); // 5 minutes in milliseconds

console.log('Polling service started. Press Ctrl+C to stop.'); 