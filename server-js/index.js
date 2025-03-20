const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Create Express app
const app = express();
const PORT = 3001; // Use port 3001 explicitly

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());

// Serve static files from the client build
app.use(express.static(path.join(__dirname, '../client/build')));

// In-memory session store (in production this would be a database)
const sessions = new Map();
// In-memory call history (in production this would be a database)
const calls = [];
// In-memory credits (in production this would be a database)
const credits = new Map();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
const callsFilePath = path.join(dataDir, 'calls.json');
const creditsFilePath = path.join(dataDir, 'credits.json');

async function ensureDataFilesExist() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    
    try {
      await fs.access(callsFilePath);
    } catch (err) {
      // File doesn't exist, create it
      await fs.writeFile(callsFilePath, JSON.stringify([]));
    }
    
    try {
      await fs.access(creditsFilePath);
    } catch (err) {
      // File doesn't exist, create it
      await fs.writeFile(creditsFilePath, JSON.stringify({}));
    }
    
    // Load existing data
    const callsData = await fs.readFile(callsFilePath, 'utf8');
    const creditsData = await fs.readFile(creditsFilePath, 'utf8');
    
    // Parse and store in memory
    calls.push(...JSON.parse(callsData));
    const creditsObj = JSON.parse(creditsData);
    Object.keys(creditsObj).forEach(sessionId => {
      credits.set(sessionId, creditsObj[sessionId]);
    });
    
    console.log(`Loaded ${calls.length} calls and ${credits.size} credit records`);
  } catch (error) {
    console.error('Error ensuring data files exist:', error);
  }
}

// Save calls to JSON file
async function saveCalls() {
  try {
    await fs.writeFile(callsFilePath, JSON.stringify(calls, null, 2));
  } catch (error) {
    console.error('Error saving calls:', error);
  }
}

// Save credits to JSON file
async function saveCredits() {
  try {
    const creditsObj = {};
    credits.forEach((value, key) => {
      creditsObj[key] = value;
    });
    await fs.writeFile(creditsFilePath, JSON.stringify(creditsObj, null, 2));
  } catch (error) {
    console.error('Error saving credits:', error);
  }
}

// MCP API endpoint
app.post('/api/v1/mcp', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;
    
    // Check for required fields
    if (!jsonrpc || !id || !method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      });
    }
    
    // Verify jsonrpc version
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32600,
          message: 'Invalid jsonrpc version'
        }
      });
    }
    
    console.log(`[${id}] Received request:`, { method, params });
    
    // Handle initialization
    if (method === 'initialize') {
      const sessionId = uuidv4();
      sessions.set(sessionId, {
        id: sessionId,
        createdAt: new Date().toISOString()
      });
      
      // Initialize credits for the session if they don't exist
      if (!credits.has(sessionId)) {
        credits.set(sessionId, {
          balance: 50, // Default starting credits
          totalAdded: 50,
          totalUsed: 0,
          lastUpdated: new Date().toISOString()
        });
        await saveCredits();
      }
      
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          sessionId
        }
      });
    }
    
    // Get session ID from headers for all other methods
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(401).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32000,
          message: 'Invalid or missing session ID'
        }
      });
    }
    
    // Handle tool execution
    if (method === 'tools/execute') {
      const { name, arguments: args = {} } = params;
      
      // Handle getVoiceOptions
      if (name === 'getVoiceOptions') {
        // Fetch voices from Bland API if API key is available
        // Otherwise return mock voices
        let voices;
        
        // Use AILEVELUP_ENTERPRISE_KEY or AILEVELUP_API_KEY as the Bland API key
        const apiKey = process.env.AILEVELUP_ENTERPRISE_KEY || process.env.AILEVELUP_API_KEY || process.env.BLAND_API_KEY;
        
        if (apiKey) {
          try {
            const response = await axios.get('https://api.bland.ai/v1/voices', {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            });
            voices = response.data.voices || [];
          } catch (error) {
            console.error('Error fetching voices from Bland API:', error);
            // Fall back to mock voices
            voices = getMockVoices();
          }
        } else {
          voices = getMockVoices();
        }
        
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            voices
          }
        });
      }
      
      // Handle getCallHistory
      if (name === 'getCallHistory') {
        const { limit = 50, offset = 0, status } = args;
        
        let sessionCalls = calls.filter(call => call.session_id === sessionId);
        
        if (status) {
          sessionCalls = sessionCalls.filter(call => call.status === status);
        }
        
        // Sort by created_at descending
        sessionCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Apply pagination
        const paginatedCalls = sessionCalls.slice(offset, offset + limit);
        
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            calls: paginatedCalls
          }
        });
      }
      
      // Handle getCredits
      if (name === 'getCredits') {
        const sessionCredits = credits.get(sessionId) || {
          balance: 50,
          totalAdded: 50,
          totalUsed: 0,
          lastUpdated: new Date().toISOString()
        };
        
        return res.json({
          jsonrpc: '2.0',
          id,
          result: sessionCredits
        });
      }
      
      // Handle makePhoneCall
      if (name === 'makePhoneCall') {
        const { phoneNumber, task, voice: voiceId, maxDuration = 300, temperature = 1, webhookUrl } = args;
        
        // Validate required parameters
        if (!phoneNumber || !task) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Invalid parameters: phoneNumber and task are required'
            }
          });
        }
        
        // Check if user has enough credits
        const sessionCredits = credits.get(sessionId);
        if (!sessionCredits || sessionCredits.balance <= 0) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32000,
              message: 'Insufficient credits'
            }
          });
        }
        
        // Create a new call
        const callId = uuidv4();
        const callTime = new Date();
        
        // Create the call object
        const newCall = {
          id: callId,
          session_id: sessionId,
          phone_number: phoneNumber,
          task,
          voice: voiceId,
          max_duration: maxDuration,
          temperature,
          webhook_url: webhookUrl || '',
          status: 'initiated',
          duration: 0,
          created_at: callTime.toISOString(),
          updated_at: callTime.toISOString()
        };
        
        // Add to calls array
        calls.push(newCall);
        
        // Save to file
        await saveCalls();
        
        // Deduct credits (mock)
        sessionCredits.balance -= 1;
        sessionCredits.totalUsed += 1;
        sessionCredits.lastUpdated = callTime.toISOString();
        await saveCredits();
        
        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            callId,
            status: 'initiated',
            message: 'Call initiated successfully'
          }
        });
      }
      
      // Tool not found
      return res.status(404).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Tool '${name}' not found`
        }
      });
    }
    
    // Method not found
    return res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method '${method}' not found`
      }
    });
  } catch (error) {
    console.error('Server error:', error);
    
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal server error'
      }
    });
  }
});

// Voice sample API endpoint
app.get('/api/v1/voice-samples/:voiceId', (req, res) => {
  // In a real implementation, this would fetch or generate a voice sample
  // For now, we'll just send a dummy MP3 file (or a 404 if it doesn't exist)
  const voiceId = req.params.voiceId;
  const samplePath = path.join(__dirname, 'samples', `${voiceId}.mp3`);
  
  // Check if the file exists
  fs.access(samplePath)
    .then(() => {
      res.sendFile(samplePath);
    })
    .catch(() => {
      // File doesn't exist, return a 404
      res.status(404).json({
        error: 'Voice sample not found'
      });
    });
});

// Helper functions
function getMockVoices() {
  return [
    { id: 'voice1', name: 'Emma', gender: 'Female', accent: 'American', description: 'Clear and friendly American accent' },
    { id: 'voice2', name: 'Michael', gender: 'Male', accent: 'British', description: 'Professional British accent' },
    { id: 'voice3', name: 'Sophia', gender: 'Female', accent: 'Australian', description: 'Warm Australian accent' },
    { id: 'voice4', name: 'James', gender: 'Male', accent: 'American', description: 'Deep and authoritative American accent' },
    { id: 'voice5', name: 'Olivia', gender: 'Female', accent: 'British', description: 'Sophisticated British accent' },
    { id: 'voice6', name: 'William', gender: 'Male', accent: 'Australian', description: 'Casual Australian accent' }
  ];
}

// Create a samples directory if it doesn't exist
fs.mkdir(path.join(__dirname, 'samples'), { recursive: true })
  .catch(err => console.error('Error creating samples directory:', err));

// Catch-all route to return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Initialize data and start the server
ensureDataFilesExist().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}); 