/**
 * Daily Report Generator Script
 * 
 * This script generates daily reports of system usage and metrics.
 * It is designed to be run as a scheduled task (e.g., using cron in production).
 * 
 * To run manually: node tasks/generate-daily-report.js
 */

require('dotenv').config();
const { generateDailyReport } = require('../services/dashboard');
const { logger } = require('../services/audit-logging');

async function runDailyReportGenerator() {
  console.log('Starting daily report generation...');
  
  try {
    // Generate the daily report for yesterday
    const report = await generateDailyReport();
    
    console.log('Daily report generated successfully.');
    console.log('Report date:', report.date);
    console.log('Summary:');
    console.log(`- New users: ${report.userStats.newUsers}`);
    console.log(`- Active users: ${report.userStats.activeUsers}`);
    console.log(`- Total calls: ${report.callStats.totalCalls}`);
    console.log(`- Success rate: ${(report.callStats.successRate * 100).toFixed(2)}%`);
    console.log(`- Revenue: $${report.billingStats.revenue.toFixed(2)}`);
    
    // Log successful report generation
    logger.info('Daily report generated successfully', {
      reportDate: report.date,
      summary: {
        newUsers: report.userStats.newUsers,
        activeUsers: report.userStats.activeUsers,
        totalCalls: report.callStats.totalCalls,
        successRate: report.callStats.successRate,
        revenue: report.billingStats.revenue
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating daily report:', error.message);
    
    // Log error
    logger.error('Failed to generate daily report', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  }
}

// Run the report generator
runDailyReportGenerator(); 