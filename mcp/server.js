/**
 * Model Context Protocol (MCP) Server Implementation
 * 
 * This module implements the core MCP server functionality according to
 * the 2024-11-05 specification (https://spec.modelcontextprotocol.io/specification/2024-11-05/)
 */

const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const express = require('express');
const { validateJsonRpc, createSuccessResponse, createErrorResponse } = require('./lib/json-rpc');
const { authenticateMcp } = require('./middleware/auth');
const { registerTools } = require('./tools');
const { registerResources } = require('./resources');
const { logger } = require('../utils/logger');

// MCP Server state
const sessions = new Map();
const connections = new Map();

/**
 * Initialize MCP server capabilities
 * @returns {Object} Server capabilities according to MCP spec
 */
function getServerCapabilities() {
  return {
    server: {
      name: "ailevelup-mcp",
      version: "1.0.0",
      capabilities: {
        tools: {
          schema: {
            version: "2024-11-05"
          }
        },
        resources: {
          schema: {
            version: "2024-11-05"
          }
        }
      }
    }
  };
}

/**
 * Handle MCP initialize request
 * @param {Object} params Initialize parameters
 * @param {string} sessionId Session identifier
 * @returns {Object} Initialize result
 */
function handleInitialize(params, sessionId) {
  // Create new session or update existing one
  sessions.set(sessionId, {
    id: sessionId,
    clientInfo: params.client || {},
    capabilities: params.capabilities || {},
    initialized: true,
    createdAt: new Date(),
    lastActivity: new Date()
  });

  logger.info(`MCP session initialized: ${sessionId}`, {
    clientName: params.client?.name,
    clientVersion: params.client?.version
  });

  // Return server capabilities
  return getServerCapabilities();
}

/**
 * Handle MCP request
 * @param {Object} request JSON-RPC request
 * @param {string} sessionId Session identifier
 * @returns {Object} JSON-RPC response
 */
async function handleMcpRequest(request, sessionId) {
  try {
    // Validate JSON-RPC request
    const validationError = validateJsonRpc(request);
    if (validationError) {
      return createErrorResponse(request.id, validationError.code, validationError.message);
    }

    // Update session last activity
    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);
      session.lastActivity = new Date();
    }

    // Process methods
    let result;
    switch (request.method) {
      case 'initialize':
        result = handleInitialize(request.params, sessionId);
        break;
      
      case 'ping':
        result = { pong: new Date().toISOString() };
        break;
      
      case 'tools/execute':
        // Check if session is initialized (skip in development)
        if (process.env.NODE_ENV !== 'development' && 
           (!sessions.has(sessionId) || !sessions.get(sessionId).initialized)) {
          return createErrorResponse(request.id, -32000, "Session not initialized");
        }
        
        // Forward to tool execution handler
        const toolsModule = require('./tools');
        result = await toolsModule.executeToolById(request.params, sessionId);
        break;
      
      case 'resources/get':
        // Check if session is initialized (skip in development) 
        if (process.env.NODE_ENV !== 'development' && 
           (!sessions.has(sessionId) || !sessions.get(sessionId).initialized)) {
          return createErrorResponse(request.id, -32000, "Session not initialized");
        }
        
        // Forward to resource handler
        const resourcesModule = require('./resources');
        result = await resourcesModule.getResourceById(request.params, sessionId);
        break;
      
      case 'shutdown':
        // Delete session
        if (sessions.has(sessionId)) {
          sessions.delete(sessionId);
          logger.info(`MCP session shutdown: ${sessionId}`);
        }
        result = { success: true };
        break;
      
      default:
        return createErrorResponse(request.id, -32601, "Method not found");
    }

    return createSuccessResponse(request.id, result);
  } catch (error) {
    logger.error(`Error handling MCP request: ${error.message}`, { error });
    return createErrorResponse(
      request.id, 
      error.code || -32000, 
      error.message || "Internal server error"
    );
  }
}

/**
 * Initialize HTTP routes for MCP
 * @param {Object} app Express application
 */
function initializeHttpRoutes(app) {
  // Add CORS headers
  app.use((req, res, next) => {
    // CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, MCP-Session-Id');
    res.header('Access-Control-Expose-Headers', 'MCP-Session-Id'); // Expose the session ID header for client access
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });
  
  const mcpRouter = express.Router();
  
  // Apply authentication middleware only in production
  if (process.env.NODE_ENV !== 'development') {
    console.log('Applying MCP authentication middleware (production mode)');
    mcpRouter.use(authenticateMcp);
  } else {
    console.log('Skipping MCP authentication middleware (development mode)');
  }
  
  // Handle JSON-RPC requests
  mcpRouter.post('/', async (req, res) => {
    // In development mode, create a fixed session ID for easier debugging
    const sessionId = process.env.NODE_ENV === 'development' 
      ? (req.headers['mcp-session-id'] || 'dev-session-' + Date.now()) 
      : (req.headers['mcp-session-id'] || uuidv4());
    
    // For initialize requests in development mode, always create a valid session
    if (process.env.NODE_ENV === 'development' && req.body.method === 'initialize') {
      console.log('Debug: Creating development session:', sessionId);
      sessions.set(sessionId, {
        id: sessionId,
        clientInfo: req.body.params?.clientInfo || {},
        capabilities: req.body.params?.capabilities || {},
        initialized: true,
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }
    
    // Handle request
    const response = await handleMcpRequest(req.body, sessionId);
    
    // Set session ID header
    res.setHeader('MCP-Session-Id', sessionId);
    
    // Send response
    res.json(response);
  });
  
  // Register MCP router
  app.use('/api/v1/mcp', mcpRouter);
  
  logger.info('MCP HTTP routes initialized');
}

/**
 * Initialize WebSocket server for MCP
 * @param {Object} server HTTP server
 */
function initializeWebSocketServer(server) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/mcp'
  });
  
  wss.on('connection', (ws, req) => {
    // Create session ID
    const sessionId = uuidv4();
    
    // Store connection
    connections.set(sessionId, ws);
    
    logger.info(`MCP WebSocket connection established: ${sessionId}`);
    
    // Handle messages
    ws.on('message', async (message) => {
      try {
        // Parse JSON-RPC message
        const request = JSON.parse(message);
        
        // Handle request
        const response = await handleMcpRequest(request, sessionId);
        
        // Send response
        ws.send(JSON.stringify(response));
      } catch (error) {
        logger.error(`Error handling WebSocket message: ${error.message}`, { error });
        
        // Send error response
        ws.send(JSON.stringify(createErrorResponse(
          null,
          -32700,
          "Parse error"
        )));
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      // Clean up session and connection
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
      }
      
      connections.delete(sessionId);
      
      logger.info(`MCP WebSocket connection closed: ${sessionId}`);
    });
  });
  
  logger.info('MCP WebSocket server initialized');
}

/**
 * Initialize MCP server
 * @param {Object} app Express application
 * @param {Object} server HTTP server
 */
function initializeMcpServer(app, server) {
  // Register tools
  registerTools();
  
  // Register resources
  registerResources();
  
  // Initialize HTTP routes
  initializeHttpRoutes(app);
  
  // Initialize WebSocket server
  if (server) {
    initializeWebSocketServer(server);
  }
  
  // Set up session cleanup
  setInterval(() => {
    const now = new Date();
    sessions.forEach((session, id) => {
      // Clean up sessions inactive for more than 30 minutes
      if (now - session.lastActivity > 30 * 60 * 1000) {
        sessions.delete(id);
        
        // Close WebSocket connection if exists
        if (connections.has(id)) {
          connections.get(id).close();
          connections.delete(id);
        }
        
        logger.info(`MCP session timed out: ${id}`);
      }
    });
  }, 5 * 60 * 1000); // Run every 5 minutes
  
  logger.info('MCP server initialized');
}

module.exports = {
  initializeMcpServer,
  getServerCapabilities
}; 