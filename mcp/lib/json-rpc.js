/**
 * JSON-RPC 2.0 Utilities for MCP
 * 
 * This module provides utilities for working with JSON-RPC 2.0 messages.
 */

/**
 * Validate a JSON-RPC 2.0 request
 * @param {Object} request The JSON-RPC request to validate
 * @returns {Object|null} Error object if validation fails, null if valid
 */
function validateJsonRpc(request) {
  if (!request) {
    return {
      code: -32700,
      message: "Parse error"
    };
  }

  if (request.jsonrpc !== "2.0") {
    return {
      code: -32600,
      message: "Invalid Request: Not a JSON-RPC 2.0 request"
    };
  }

  if (!request.method || typeof request.method !== "string") {
    return {
      code: -32600,
      message: "Invalid Request: Missing or invalid method"
    };
  }

  // id is optional (can be null for notifications)
  if ('id' in request && request.id !== null && 
      typeof request.id !== "string" && 
      typeof request.id !== "number") {
    return {
      code: -32600,
      message: "Invalid Request: Invalid id type"
    };
  }

  return null;
}

/**
 * Create a JSON-RPC 2.0 success response
 * @param {string|number|null} id The request id
 * @param {*} result The result data
 * @returns {Object} JSON-RPC response object
 */
function createSuccessResponse(id, result) {
  return {
    jsonrpc: "2.0",
    result,
    id
  };
}

/**
 * Create a JSON-RPC 2.0 error response
 * @param {string|number|null} id The request id
 * @param {number} code The error code
 * @param {string} message The error message
 * @param {*} [data] Optional error data
 * @returns {Object} JSON-RPC error response object
 */
function createErrorResponse(id, code, message, data = undefined) {
  const response = {
    jsonrpc: "2.0",
    error: {
      code,
      message
    },
    id
  };

  if (data !== undefined) {
    response.error.data = data;
  }

  return response;
}

/**
 * JSON-RPC 2.0 error codes
 */
const JsonRpcErrorCodes = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP specific errors
  SESSION_ERROR: -32000,
  UNAUTHORIZED: -32001,
  RESOURCE_NOT_FOUND: -32002,
  TOOL_NOT_FOUND: -32003,
  TOOL_EXECUTION_ERROR: -32004,
  RATE_LIMIT_EXCEEDED: -32005,
  CAPABILITY_NOT_SUPPORTED: -32006
};

module.exports = {
  validateJsonRpc,
  createSuccessResponse,
  createErrorResponse,
  JsonRpcErrorCodes
}; 