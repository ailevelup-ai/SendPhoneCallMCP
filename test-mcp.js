// Simple test to directly check the MCP endpoint
const fetch = require('node-fetch');

async function testMcp() {
  try {
    console.log('Testing MCP connection...');
    
    // First try without auth
    console.log('Attempt 1: No auth headers');
    let response = await fetch('http://localhost:3040/api/v1/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'test-script',
            version: '1.0.0'
          }
        }
      })
    });
    
    console.log('Response status:', response.status);
    let data = await response.text();
    console.log('Response body:', data);
    
    // Try with auth token
    console.log('\nAttempt 2: With auth header');
    response = await fetch('http://localhost:3040/api/v1/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ailevelup-mcp'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'test-script',
            version: '1.0.0'
          }
        }
      })
    });
    
    console.log('Response status:', response.status);
    data = await response.text();
    console.log('Response body:', data);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMcp(); 