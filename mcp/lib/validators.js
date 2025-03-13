/**
 * JSON Schema Validators
 * 
 * This module exports validators for MCP schema validation.
 */

const { Validator } = require('jsonschema');

/**
 * Wrapper for jsonschema's Validator class
 * This helps maintain API compatibility across our code
 */
class JSONSchemaValidator extends Validator {
  constructor() {
    super();
  }
}

module.exports = {
  JSONSchemaValidator
}; 