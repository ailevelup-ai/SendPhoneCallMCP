/**
 * MCP Tools Implementation
 * 
 * This module registers and manages tools for the Model Context Protocol.
 */

const { logger } = require('../../utils/logger');
const makePhoneCallTool = require('./make-phone-call');
const getCallDetailsTool = require('./get-call-details');
const cancelCallTool = require('./cancel-call');
const getCallProgressTool = require('./get-call-progress');
const updateCallPreferencesTool = require('./update-call-preferences');
const getVoiceOptionsTool = require('./get-voice-options');
const getModelOptionsTool = require('./get-model-options');
const getCallStatusTool = require('./get-call-status');
const getCallHistoryTool = require('./get-call-history');
const getCreditsTool = require('./get-credits');
const addCreditsTool = require('./add-credits');

// Registry for available tools
const toolRegistry = new Map();

/**
 * Register a tool in the registry
 * @param {Object} tool Tool definition
 */
function registerTool(tool) {
  if (!tool || !tool.name) {
    throw new Error('Invalid tool definition');
  }
  
  if (toolRegistry.has(tool.name)) {
    logger.warn(`Tool ${tool.name} already registered, overwriting`);
  }
  
  toolRegistry.set(tool.name, tool);
  logger.info(`Registered MCP tool: ${tool.name}`);
}

/**
 * Get available tools for MCP capabilities
 * @returns {Array} Array of tool definitions
 */
function getAvailableTools() {
  return Array.from(toolRegistry.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

/**
 * Register all available tools
 */
function registerTools() {
  // Register core phone call tools
  registerTool(makePhoneCallTool);
  registerTool(getCallDetailsTool);
  registerTool(cancelCallTool);
  
  // Register progress reporting tool
  registerTool(getCallProgressTool);
  
  // Register configuration tools
  registerTool(updateCallPreferencesTool);
  registerTool(getVoiceOptionsTool);
  registerTool(getModelOptionsTool);
  
  // Register secondary tools
  registerTool(getCallStatusTool);
  registerTool(getCallHistoryTool);
  registerTool(getCreditsTool);
  registerTool(addCreditsTool);
  
  logger.info(`Registered ${toolRegistry.size} MCP tools`);
}

/**
 * Execute a tool by name
 * @param {Object} params Parameters containing name and arguments
 * @param {string} sessionId Session identifier
 * @returns {Promise<Object>} Tool execution result
 */
async function executeToolById(params, sessionId) {
  const { name, arguments: args } = params;
  
  if (!name) {
    throw new Error('Tool name is required');
  }
  
  // Get tool from registry
  const tool = toolRegistry.get(name);
  
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  
  // Validate parameters against schema
  if (tool.validateParameters) {
    const validationError = tool.validateParameters(args);
    if (validationError) {
      throw Object.assign(
        new Error(`Invalid parameters for tool ${name}: ${validationError.message}`),
        { code: -32602 }
      );
    }
  }
  
  // Log tool execution
  logger.info(`Executing MCP tool: ${name}`, { 
    sessionId,
    toolName: name,
    // Don't log sensitive arguments
    hasArgs: !!args
  });
  
  try {
    // Execute tool with arguments
    const result = await tool.execute(args, { sessionId });
    
    // Log success (without sensitive result data)
    logger.info(`Successfully executed MCP tool: ${name}`, {
      sessionId,
      toolName: name
    });
    
    return result;
  } catch (error) {
    // Log error
    logger.error(`Error executing MCP tool ${name}: ${error.message}`, {
      sessionId,
      toolName: name,
      error
    });
    
    // Rethrow with appropriate error code
    throw Object.assign(
      new Error(`Error executing tool ${name}: ${error.message}`),
      { code: -32004, data: { originalError: error.message } }
    );
  }
}

module.exports = {
  registerTools,
  registerTool,
  getAvailableTools,
  executeToolById
}; 