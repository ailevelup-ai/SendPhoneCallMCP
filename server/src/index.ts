import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import mcpTools from './tools/mcp-tools';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the client build
app.use(express.static(path.join(__dirname, '../../client/build')));

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
    
    // Get session ID from headers
    const sessionId = req.headers['mcp-session-id'] as string;
    if (!sessionId) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Missing MCP-Session-Id header'
        }
      });
    }
    
    console.log(`[${id}] Received request:`, { method, params });
    
    // Handle method calls
    if (method === 'tools/execute') {
      const { name, arguments: args } = params;
      
      // Find the tool
      const tool = mcpTools.find(t => t.name === name);
      if (!tool) {
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool '${name}' not found`
          }
        });
      }
      
      try {
        // Execute the tool
        const result = await tool.handler(args, sessionId);
        
        // Return the result
        return res.json({
          jsonrpc: '2.0',
          id,
          result
        });
      } catch (error) {
        console.error(`[${id}] Error executing tool:`, error);
        
        return res.status(500).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error.message || 'Internal server error'
          }
        });
      }
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method '${method}' not found`
        }
      });
    }
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

// Catch-all route to return the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/build/index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 