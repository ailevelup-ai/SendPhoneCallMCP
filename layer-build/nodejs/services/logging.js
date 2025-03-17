const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Initialize Google Sheets authentication
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

// Create JWT client
const jwt = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: SCOPES
});

// Sheet configuration
const SHEETS_DOC_ID = process.env.GOOGLE_SHEETS_DOC_ID;
const CALL_LOGS_SHEET_NAME = 'Call Logs';
const TRANSACTION_LOGS_SHEET_NAME = 'Transaction Logs';
const ERROR_LOGS_SHEET_NAME = 'Error Logs';

// Cache for Google Sheets document
let sheetsDoc = null;

/**
 * Get Google Sheets document
 * @returns {GoogleSpreadsheet} - Google Sheets document
 */
async function getDocument() {
  if (sheetsDoc) {
    return sheetsDoc;
  }

  // Create a new document
  sheetsDoc = new GoogleSpreadsheet(SHEETS_DOC_ID, jwt);
  await sheetsDoc.loadInfo();
  
  return sheetsDoc;
}

/**
 * Get or create a sheet
 * @param {GoogleSpreadsheet} doc - Google Sheets document
 * @param {String} sheetName - Name of the sheet
 * @param {Array} headerValues - Header values for the sheet
 * @returns {Object} - Google Sheets worksheet
 */
async function getOrCreateSheet(doc, sheetName, headerValues) {
  let sheet = null;
  
  // Try to get existing sheet
  try {
    sheet = doc.sheetsByTitle[sheetName];
  } catch (error) {
    console.log(`Sheet "${sheetName}" not found, creating...`);
  }
  
  // Create new sheet if it doesn't exist
  if (!sheet) {
    sheet = await doc.addSheet({ title: sheetName });
    await sheet.setHeaderRow(headerValues);
  }
  
  return sheet;
}

/**
 * Log call to Google Sheets
 * @param {Object} callData - Call data to log
 */
async function logCallToGoogleSheets(callData) {
  try {
    // Skip logging if not configured
    if (!SHEETS_DOC_ID || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.log('Google Sheets logging not configured, skipping');
      return;
    }
    
    const doc = await getDocument();
    
    // Get or create sheet
    const headerValues = [
      'timestamp',
      'api_key',
      'user_id',
      'call_id',
      'phone_number',
      'call_duration',
      'call_status',
      'credits_used',
      'webhook_url',
      'voice_used',
      'moderation_status',
      'error_messages'
    ];
    
    const sheet = await getOrCreateSheet(doc, CALL_LOGS_SHEET_NAME, headerValues);
    
    // Add row
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      api_key: callData.apiKey || '',
      user_id: callData.userId || '',
      call_id: callData.callId || '',
      phone_number: callData.phoneNumber || '',
      call_duration: callData.callDuration || 0,
      call_status: callData.callStatus || '',
      credits_used: callData.creditsUsed || 0,
      webhook_url: callData.webhookUrl || '',
      voice_used: callData.voiceUsed || '',
      moderation_status: callData.moderationStatus || '',
      error_messages: callData.errorMessages || ''
    });
    
    console.log(`Call ${callData.callId} logged to Google Sheets`);
  } catch (error) {
    console.error('Error logging call to Google Sheets:', error);
  }
}

/**
 * Log transaction to Google Sheets
 * @param {Object} transactionData - Transaction data to log
 */
async function logTransactionToGoogleSheets(transactionData) {
  try {
    // Skip logging if not configured
    if (!SHEETS_DOC_ID || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.log('Google Sheets logging not configured, skipping');
      return;
    }
    
    const doc = await getDocument();
    
    // Get or create sheet
    const headerValues = [
      'timestamp',
      'user_id',
      'type',
      'amount',
      'payment_id',
      'call_id',
      'description',
      'balance_after'
    ];
    
    const sheet = await getOrCreateSheet(doc, TRANSACTION_LOGS_SHEET_NAME, headerValues);
    
    // Add row
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      user_id: transactionData.userId || '',
      type: transactionData.type || '',
      amount: transactionData.amount || 0,
      payment_id: transactionData.paymentId || '',
      call_id: transactionData.callId || '',
      description: transactionData.description || '',
      balance_after: transactionData.balanceAfter || 0
    });
    
    console.log(`Transaction for user ${transactionData.userId} logged to Google Sheets`);
  } catch (error) {
    console.error('Error logging transaction to Google Sheets:', error);
  }
}

/**
 * Log error to Google Sheets
 * @param {Object} errorData - Error data to log
 */
async function logErrorToGoogleSheets(errorData) {
  try {
    // Skip logging if not configured
    if (!SHEETS_DOC_ID || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      console.log('Google Sheets logging not configured, skipping');
      return;
    }
    
    const doc = await getDocument();
    
    // Get or create sheet
    const headerValues = [
      'timestamp',
      'user_id',
      'api_key',
      'error_type',
      'error_message',
      'request_path',
      'request_method',
      'ip_address',
      'additional_info'
    ];
    
    const sheet = await getOrCreateSheet(doc, ERROR_LOGS_SHEET_NAME, headerValues);
    
    // Add row
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      user_id: errorData.userId || '',
      api_key: errorData.apiKey || '',
      error_type: errorData.errorType || '',
      error_message: errorData.errorMessage || '',
      request_path: errorData.requestPath || '',
      request_method: errorData.requestMethod || '',
      ip_address: errorData.ipAddress || '',
      additional_info: JSON.stringify(errorData.additionalInfo || {})
    });
    
    console.log(`Error for user ${errorData.userId} logged to Google Sheets`);
  } catch (error) {
    console.error('Error logging error to Google Sheets:', error);
  }
}

/**
 * Get call logs with filtering
 * @param {Object} options - Filter options
 * @returns {Array} - Call logs
 */
async function getCallLogs(options = {}) {
  try {
    // Skip if not configured
    if (!SHEETS_DOC_ID || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      return [];
    }
    
    const {
      userId = null,
      startDate = null,
      endDate = null,
      status = null,
      limit = 100
    } = options;
    
    const doc = await getDocument();
    const sheet = doc.sheetsByTitle[CALL_LOGS_SHEET_NAME];
    
    if (!sheet) {
      return [];
    }
    
    // Get all rows
    const rows = await sheet.getRows();
    
    // Apply filters
    const filteredRows = rows.filter(row => {
      let include = true;
      
      if (userId && row.user_id !== userId) {
        include = false;
      }
      
      if (startDate && new Date(row.timestamp) < new Date(startDate)) {
        include = false;
      }
      
      if (endDate && new Date(row.timestamp) > new Date(endDate)) {
        include = false;
      }
      
      if (status && row.call_status !== status) {
        include = false;
      }
      
      return include;
    });
    
    // Limit results
    return filteredRows.slice(0, limit).map(row => ({
      timestamp: row.timestamp,
      userId: row.user_id,
      callId: row.call_id,
      phoneNumber: row.phone_number,
      callDuration: parseFloat(row.call_duration) || 0,
      callStatus: row.call_status,
      creditsUsed: parseFloat(row.credits_used) || 0,
      voiceUsed: row.voice_used
    }));
  } catch (error) {
    console.error('Error getting call logs from Google Sheets:', error);
    return [];
  }
}

/**
 * Get transaction logs with filtering
 * @param {Object} options - Filter options
 * @returns {Array} - Transaction logs
 */
async function getTransactionLogs(options = {}) {
  try {
    // Skip if not configured
    if (!SHEETS_DOC_ID || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
      return [];
    }
    
    const {
      userId = null,
      startDate = null,
      endDate = null,
      type = null,
      limit = 100
    } = options;
    
    const doc = await getDocument();
    const sheet = doc.sheetsByTitle[TRANSACTION_LOGS_SHEET_NAME];
    
    if (!sheet) {
      return [];
    }
    
    // Get all rows
    const rows = await sheet.getRows();
    
    // Apply filters
    const filteredRows = rows.filter(row => {
      let include = true;
      
      if (userId && row.user_id !== userId) {
        include = false;
      }
      
      if (startDate && new Date(row.timestamp) < new Date(startDate)) {
        include = false;
      }
      
      if (endDate && new Date(row.timestamp) > new Date(endDate)) {
        include = false;
      }
      
      if (type && row.type !== type) {
        include = false;
      }
      
      return include;
    });
    
    // Limit results
    return filteredRows.slice(0, limit).map(row => ({
      timestamp: row.timestamp,
      userId: row.user_id,
      type: row.type,
      amount: parseFloat(row.amount) || 0,
      paymentId: row.payment_id,
      callId: row.call_id,
      description: row.description,
      balanceAfter: parseFloat(row.balance_after) || 0
    }));
  } catch (error) {
    console.error('Error getting transaction logs from Google Sheets:', error);
    return [];
  }
}

module.exports = {
  logCallToGoogleSheets,
  logTransactionToGoogleSheets,
  logErrorToGoogleSheets,
  getCallLogs,
  getTransactionLogs
}; 