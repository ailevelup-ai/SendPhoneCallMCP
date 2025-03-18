import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Setup mock API handling
console.log('Setting up mock API service...');

// Save the original fetch
const originalFetch = window.fetch;

// Mock session ID
const mockSessionId = 'mock-session-' + Math.random().toString(36).substring(2, 9);
console.log('Generated mock session ID:', mockSessionId);

// Mock voices data
const mockVoices = [
  { id: 'voice1', name: 'Emma', gender: 'Female', accent: 'American', description: 'Clear and friendly American accent' },
  { id: 'voice2', name: 'Michael', gender: 'Male', accent: 'British', description: 'Professional British accent' },
  { id: 'voice3', name: 'Sophia', gender: 'Female', accent: 'Australian', description: 'Warm Australian accent' },
  { id: 'voice4', name: 'James', gender: 'Male', accent: 'American', description: 'Deep and authoritative American accent' },
  { id: 'voice5', name: 'Olivia', gender: 'Female', accent: 'British', description: 'Sophisticated British accent' },
  { id: 'voice6', name: 'William', gender: 'Male', accent: 'Australian', description: 'Casual Australian accent' }
];

// Mock calls data
const mockCalls = [
  { 
    id: 'call1', 
    phone_number: '+15551234567',
    status: 'completed',
    duration: 125,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
  },
  { 
    id: 'call2', 
    phone_number: '+15559876543',
    status: 'in-progress',
    duration: 42,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  { 
    id: 'call3', 
    phone_number: '+15555555555',
    status: 'failed',
    duration: 5,
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() 
  }
];

// Mock credits data
const mockCredits = {
  balance: 50,
  totalAdded: 100,
  totalUsed: 50,
  lastUpdated: new Date().toISOString()
};

// Override fetch to intercept API calls with error handling
window.fetch = function(url, options = {}) {
  console.log('Intercepted fetch request to:', url);
  
  // Define a helper function to create mock responses
  const createMockResponse = (data, status = 200) => {
    return {
      ok: status >= 200 && status < 300,
      status: status,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      blob: () => Promise.resolve(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    };
  };
  
  // Simulate network delay for realism
  return new Promise(resolve => {
    setTimeout(() => {
      try {
        // Handle API requests
        if (url.includes('/api/')) {
          console.log('Processing API request:', url, options?.method || 'GET');
          
          // Handle JSON-RPC requests to /api/v1/mcp
          if (url.includes('/api/v1/mcp')) {
            let requestBody = {};
            try {
              requestBody = options.body ? JSON.parse(options.body) : {};
              console.log('JSONRPC request body:', requestBody);
            } catch (e) {
              console.warn('Failed to parse request body:', e);
            }
            
            // Handle different methods
            if (requestBody.method === 'initialize') {
              console.log('Handling initialize request');
              resolve(createMockResponse({
                jsonrpc: '2.0',
                id: requestBody.id,
                result: {
                  sessionId: mockSessionId
                }
              }));
              return;
            }
            
            if (requestBody.method === 'tools/execute') {
              const toolName = requestBody.params?.name;
              console.log('Handling tool execution:', toolName);
              
              if (toolName === 'getVoiceOptions') {
                resolve(createMockResponse({
                  jsonrpc: '2.0',
                  id: requestBody.id,
                  result: {
                    voices: mockVoices
                  }
                }));
                return;
              }
              
              if (toolName === 'getCallHistory') {
                resolve(createMockResponse({
                  jsonrpc: '2.0',
                  id: requestBody.id,
                  result: {
                    calls: mockCalls
                  }
                }));
                return;
              }
              
              if (toolName === 'getCredits') {
                resolve(createMockResponse({
                  jsonrpc: '2.0',
                  id: requestBody.id,
                  result: mockCredits
                }));
                return;
              }
              
              if (toolName === 'makePhoneCall') {
                const newCall = {
                  id: 'call-' + Date.now(),
                  phone_number: requestBody.params.arguments.phoneNumber,
                  status: 'in-progress',
                  duration: 0,
                  created_at: new Date().toISOString()
                };
                
                mockCalls.unshift(newCall);
                
                resolve(createMockResponse({
                  jsonrpc: '2.0',
                  id: requestBody.id,
                  result: {
                    callId: newCall.id
                  }
                }));
                return;
              }
            }
            
            // Default response for any unhandled MCP request
            console.log('Unhandled MCP request, returning generic success');
            resolve(createMockResponse({
              jsonrpc: '2.0',
              id: requestBody.id || 0,
              result: { success: true }
            }));
            return;
          }
          
          // Handle voice sample requests
          if (url.includes('/api/voice-sample') || url.includes('/api/v1/voice-samples/')) {
            console.log('Handling voice sample request');
            const audioBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
            const mockResponse = {
              ok: true,
              status: 200,
              headers: new Headers({ 'Content-Type': 'audio/mpeg' }),
              blob: () => Promise.resolve(audioBlob)
            };
            resolve(mockResponse);
            return;
          }
          
          // Generic success response for any other API
          console.log('Unhandled API request, returning generic success');
          resolve(createMockResponse({ success: true }));
          return;
        }
        
        // For non-API calls, use original fetch with error handling
        console.log('Passing through to original fetch:', url);
        originalFetch(url, options)
          .then(response => resolve(response))
          .catch(error => {
            console.error('Original fetch error:', error);
            // Instead of rejecting, resolve with a mock error response
            resolve(createMockResponse({ 
              error: "Failed to fetch resource", 
              message: error.message 
            }, 500));
          });
      } catch (error) {
        console.error('Error in fetch mock:', error);
        // Never reject, always resolve with an error response
        resolve(createMockResponse({ 
          error: "Mock API error", 
          message: error.message 
        }, 500));
      }
    }, 100); // 100ms delay to simulate network
  });
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(); 