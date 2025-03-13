/**
 * Script to fix column alignment in Google Sheets
 * 
 * This script will read all rows from the Google Sheet and fix the column alignment
 * by ensuring the row height is properly set.
 * Note: The Model Used column has been removed.
 */

require('dotenv').config();
const { google } = require('googleapis');
const sheets = google.sheets('v4');
const axios = require('axios');
const { logger } = require('./utils/logger');

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DOC_ID;
const SHEET_NAME = 'Call_Logs';

/**
 * Get Google Sheets authentication client
 */
async function getAuthClient() {
  try {
    // The private key might have escaped newlines (\n) that need to be converted
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );
    
    await auth.authorize();
    return auth;
  } catch (error) {
    console.error('Error authenticating with Google:', error);
    throw new Error(`Google Sheets authentication failed: ${error.message}`);
  }
}

/**
 * Fix column alignment in Google Sheets
 */
async function fixColumnAlignment() {
  try {
    console.log('Starting column alignment fix...');
    const authClient = await getAuthClient();
    
    // Get all rows from the spreadsheet
    const response = await sheets.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:AB`, // Updated range to reflect Model column removal
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      console.log('No data to fix in Google Sheets');
      return 0;
    }
    
    // Get sheet ID for row height updates
    const { data: spreadsheet } = await sheets.spreadsheets.get({
      auth: authClient,
      spreadsheetId: SPREADSHEET_ID,
      ranges: [],
      includeGridData: false,
    });
    
    let sheetId = null;
    for (const sheet of spreadsheet.sheets) {
      if (sheet.properties.title === SHEET_NAME) {
        sheetId = sheet.properties.sheetId;
        break;
      }
    }
    
    if (!sheetId) {
      console.error('Could not find sheet ID');
      return 0;
    }
    
    // Skip header row
    let fixedCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // Row index in spreadsheet (1-based, header is row 1)
      const rowIndex = i + 1;
      
      // Check if this row has data in column F (Call Duration)
      if (row.length >= 6 && row[5]) {
        console.log(`Fixing alignment for row ${rowIndex}`);
        
        // Set row height to 21 pixels
        await sheets.spreadsheets.batchUpdate({
          auth: authClient,
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{
              updateDimensionProperties: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // Convert to 0-indexed
                  endIndex: rowIndex // End is exclusive
                },
                properties: {
                  pixelSize: 21
                },
                fields: 'pixelSize'
              }
            }]
          }
        });
        
        fixedCount++;
        
        // Add slight delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Fixed column alignment for ${fixedCount} rows`);
    return fixedCount;
  } catch (error) {
    console.error('Error fixing column alignment:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    await fixColumnAlignment();
    console.log('Column alignment fix completed successfully');
  } catch (error) {
    console.error('Error in column alignment fix:', error);
  }
}

// Run the main function
main(); 