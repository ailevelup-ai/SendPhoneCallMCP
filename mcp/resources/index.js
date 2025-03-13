/**
 * MCP Resources Implementation
 * 
 * This module registers and manages resources for the Model Context Protocol.
 */

const { logger } = require('../../utils/logger');
const callHistoryResource = require('./call-history');
const { resourceSchema: userResourceSchema, fetchUserResource } = require('./user-resource');
const { resourceSchema: creditResourceSchema, fetchCreditsResource } = require('./credit-resource');

// Registry for available resources
const resourceRegistry = new Map();

/**
 * Register a resource schema in the registry
 * @param {Object} resourceSchema Resource schema definition
 * @param {Function} getFunction Function to fetch the resource data
 */
function registerResource(resourceSchema, getFunction) {
  if (!resourceSchema || !resourceSchema.name) {
    throw new Error('Invalid resource schema definition');
  }
  
  if (resourceRegistry.has(resourceSchema.name)) {
    logger.warn(`Resource ${resourceSchema.name} already registered, overwriting`);
  }
  
  resourceRegistry.set(resourceSchema.name, {
    ...resourceSchema,
    get: getFunction
  });
  
  logger.info(`Registered MCP resource: ${resourceSchema.name}`);
}

/**
 * Get available resources for MCP capabilities
 * @returns {Array} Array of resource definitions
 */
function getAvailableResources() {
  return Array.from(resourceRegistry.values()).map(resource => ({
    name: resource.name,
    description: resource.description,
    schema: resource.schema
  }));
}

/**
 * Register all available resources
 */
function registerResources() {
  // Register call-related resources
  registerResource(callHistoryResource.resourceSchema, callHistoryResource.fetchCallHistory);
  
  // Register user-related resources
  registerResource(userResourceSchema, fetchUserResource);
  registerResource(creditResourceSchema, fetchCreditsResource);
  
  // Register additional resources as needed
  
  logger.info(`Registered ${resourceRegistry.size} MCP resources`);
}

/**
 * Get a resource by name
 * @param {Object} params Parameters containing name and filters
 * @param {Object} context Execution context including sessionId and user
 * @returns {Promise<Object>} Resource data
 */
async function getResourceById(params, context) {
  const { name, filters } = params;
  const { sessionId, userId } = context;
  
  if (!name) {
    throw new Error('Resource name is required');
  }
  
  // Get resource from registry
  const resource = resourceRegistry.get(name);
  
  if (!resource) {
    throw new Error(`Resource not found: ${name}`);
  }
  
  // Validate filters if a validation function exists
  if (resource.validateFilters) {
    const validationError = resource.validateFilters(filters);
    if (validationError) {
      throw Object.assign(
        new Error(`Invalid filters for resource ${name}: ${validationError.message}`),
        { code: -32602 }
      );
    }
  }
  
  // Log resource access
  logger.info(`Accessing MCP resource: ${name}`, { 
    sessionId,
    userId,
    resourceName: name,
    // Don't log sensitive filters
    hasFilters: !!filters
  });
  
  try {
    // Access resource with filters
    const data = await resource.get(userId, sessionId, filters);
    
    // Log success (without sensitive result data)
    logger.info(`Successfully accessed MCP resource: ${name}`, {
      sessionId,
      userId,
      resourceName: name
    });
    
    return {
      data,
      name,
      schema: resource.schema
    };
  } catch (error) {
    // Log error
    logger.error(`Error accessing MCP resource ${name}: ${error.message}`, {
      sessionId,
      userId,
      resourceName: name,
      error
    });
    
    // Rethrow with appropriate error code
    throw Object.assign(
      new Error(`Error accessing resource ${name}: ${error.message}`),
      { code: -32002, data: { originalError: error.message } }
    );
  }
}

module.exports = {
  registerResources,
  registerResource,
  getAvailableResources,
  getResourceById
}; 