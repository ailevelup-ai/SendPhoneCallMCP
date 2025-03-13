/**
 * MCP Resources Implementation
 * 
 * This module registers and manages resources for the Model Context Protocol.
 */

const { logger } = require('../../utils/logger');
const callHistoryResource = require('./call-history');
const userCreditsResource = require('./user-credits');

// Registry for available resources
const resourceRegistry = new Map();

/**
 * Register a resource in the registry
 * @param {Object} resource Resource definition
 */
function registerResource(resource) {
  if (!resource || !resource.name) {
    throw new Error('Invalid resource definition');
  }
  
  if (resourceRegistry.has(resource.name)) {
    logger.warn(`Resource ${resource.name} already registered, overwriting`);
  }
  
  resourceRegistry.set(resource.name, resource);
  logger.info(`Registered MCP resource: ${resource.name}`);
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
  registerResource(callHistoryResource);
  registerResource(userCreditsResource);
  
  // Register additional resources as needed
  
  logger.info(`Registered ${resourceRegistry.size} MCP resources`);
}

/**
 * Get a resource by name
 * @param {Object} params Parameters containing name and filters
 * @param {string} sessionId Session identifier
 * @returns {Promise<Object>} Resource data
 */
async function getResourceById(params, sessionId) {
  const { name, filters } = params;
  
  if (!name) {
    throw new Error('Resource name is required');
  }
  
  // Get resource from registry
  const resource = resourceRegistry.get(name);
  
  if (!resource) {
    throw new Error(`Resource not found: ${name}`);
  }
  
  // Validate filters against schema
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
    resourceName: name,
    // Don't log sensitive filters
    hasFilters: !!filters
  });
  
  try {
    // Access resource with filters
    const data = await resource.get(filters, { sessionId });
    
    // Log success (without sensitive result data)
    logger.info(`Successfully accessed MCP resource: ${name}`, {
      sessionId,
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