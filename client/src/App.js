import React, { useState, useEffect } from 'react';
import './App.css';

function DirectCallForm({ sessionId, voices }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [task, setTask] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [maxDuration, setMaxDuration] = useState(300);
  const [temperature, setTemperature] = useState(0.7);
  const [status, setStatus] = useState('');
  const [phoneNumberError, setPhoneNumberError] = useState('');

  // Function to format phone number into E.164 format
  const formatToE164 = (input) => {
    // Remove all non-numeric characters
    const digitsOnly = input.replace(/\D/g, '');
    
    // Handle US numbers without country code (assuming US if no country code provided)
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // If it starts with 1 and is 11 digits, assume it's a US number
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }
    
    // If it already has a + sign, preserve it
    if (input.includes('+')) {
      return `+${digitsOnly}`;
    }
    
    // For international numbers without + prefix, add it
    if (digitsOnly.length > 10) {
      return `+${digitsOnly}`;
    }
    
    // Return as is if we can't determine the format
    return input;
  };

  const validatePhoneNumber = (value) => {
    // Check if phone number matches E.164 format: +[country code][number]
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(value)) {
      setPhoneNumberError('Phone number must be in E.164 format (e.g., +12125551234)');
      return false;
    }
    setPhoneNumberError('');
    return true;
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    setPhoneNumber(value);
    if (value) {
      validatePhoneNumber(value);
    } else {
      setPhoneNumberError('');
    }
  };

  const handlePhoneNumberBlur = () => {
    if (phoneNumber) {
      const formatted = formatToE164(phoneNumber);
      setPhoneNumber(formatted);
      validatePhoneNumber(formatted);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Format the phone number before validation
    const formattedNumber = formatToE164(phoneNumber);
    setPhoneNumber(formattedNumber);
    
    if (!validatePhoneNumber(formattedNumber)) {
      return;
    }
    
    setStatus('Initiating call...');

    try {
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ailevelup-mcp',
          'MCP-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/execute',
          params: {
            name: 'makePhoneCall',
            arguments: {
              phoneNumber: formattedNumber,
              task,
              voice: selectedVoice,
              maxDuration,
              temperature
            }
          }
        })
      });

      const data = await response.json();
      
      if (data.result) {
        setStatus(`Call initiated successfully! Call ID: ${data.result.callId}`);
      } else if (data.error) {
        setStatus(`Error: ${data.error.message}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="direct-call-form">
      <h2>Make a Direct Call</h2>
      
      <div className="form-group">
        <label htmlFor="phoneNumber">Phone Number (E.164 format):</label>
        <input
          type="tel"
          id="phoneNumber"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          onBlur={handlePhoneNumberBlur}
          placeholder="+12125551234"
          required
        />
        <small className="help-text">Examples: (212)555-1234, 212 555 1234, or +12125551234</small>
        {phoneNumberError && <div className="error-message">{phoneNumberError}</div>}
      </div>

      <div className="form-group">
        <label htmlFor="task">Task/Prompt:</label>
        <textarea
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="What should the AI do on this call?"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="voice">Voice:</label>
        <select
          id="voice"
          value={selectedVoice}
          onChange={(e) => setSelectedVoice(e.target.value)}
          required
        >
          <option value="">Select a voice</option>
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="maxDuration">Max Duration (seconds):</label>
        <input
          type="number"
          id="maxDuration"
          value={maxDuration}
          onChange={(e) => setMaxDuration(Number(e.target.value))}
          min="60"
          max="3600"
        />
      </div>

      <div className="form-group">
        <label htmlFor="temperature">Temperature:</label>
        <input
          type="range"
          id="temperature"
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          min="0"
          max="1"
          step="0.1"
        />
        <span>{temperature}</span>
      </div>

      <button type="submit">Make Call</button>

      {status && <div className="status-message">{status}</div>}
    </form>
  );
}

function CreditsManager({ sessionId }) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ailevelup-mcp',
          'MCP-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/execute',
          params: {
            name: 'getCredits',
            arguments: {}
          }
        })
      });

      const data = await response.json();
      
      if (data.result) {
        setCredits(data.result.balance);
      } else if (data.error) {
        setError(`Failed to fetch credits: ${data.error.message}`);
      }
    } catch (error) {
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="credits-manager">
      <h2>Credits Balance</h2>
      {loading && <div>Loading credits...</div>}
      {error && <div className="error">{error}</div>}
      {credits !== null && (
        <div className="credits-balance">
          <p>Available Credits: {credits}</p>
          <button onClick={fetchCredits}>Refresh Balance</button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [voices, setVoices] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    // Initialize MCP session
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ailevelup-mcp'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            clientName: 'web-client',
            clientVersion: '1.0.0'
          }
        })
      });

      const data = await response.json();
      
      // Get the session ID from response headers
      const sessionId = response.headers.get('MCP-Session-Id') || 
                        response.headers.get('mcp-session-id');
      
      if (sessionId) {
        console.log('Session initialized with ID:', sessionId);
        setSessionId(sessionId);
        // After getting session, fetch voices
        fetchVoices(sessionId);
      } else {
        console.error('No session ID received from server');
        
        if (data.result && data.result.sessionId) {
          console.log('Using session ID from response body as fallback');
          setSessionId(data.result.sessionId);
          fetchVoices(data.result.sessionId);
        } else {
          setError('Failed to initialize session: No session ID found in response');
        }
      }
      
      if (data.error) {
        console.error('Error initializing session:', data.error);
        setError(`Failed to initialize session: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to initialize session');
    } finally {
      setLoading(false);
    }
  };

  const fetchVoices = async (sid) => {
    if (!sid) return;
    try {
      setLoading(true);
      // Define the voice options with the correct IDs from the user
      const voiceOptions = [
        { id: 'd9c372fd-31db-4c74-ac5a-d194e8e923a4', name: 'Alloy', description: 'Clear and professional voice' },
        { id: '7d132ef1-c295-4b87-b27b-9f12ec64246d', name: 'Echo', description: 'Resonant and dynamic voice' },
        { id: '0f4958b1-3765-46b3-8df3-9b10424ff0f2', name: 'Fable', description: 'Engaging storyteller voice' },
        { id: 'a61e4166-43c9-48ec-b694-5b6747517f2f', name: 'Onyx', description: 'Deep and authoritative voice' },
        { id: '42f34de3-e147-4538-90e1-1302563d8b11', name: 'Nova', description: 'Warm and friendly voice' },
        { id: 'ff1ccc45-487c-4911-9351-8a95f12ba832', name: 'Shimmer', description: 'Bright and energetic voice' }
      ];
      setVoices(voiceOptions);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to fetch voices');
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>SendPhoneCall MCP Client</h1>
        {loading && <div className="loading">Connecting to MCP server...</div>}
        {error && <div className="error">{error}</div>}
        {sessionId && <div className="success">Connected to MCP Server</div>}
      </header>

      {sessionId && (
        <>
          <nav className="tabs">
            <button
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={activeTab === 'make-call' ? 'active' : ''}
              onClick={() => setActiveTab('make-call')}
            >
              Make a Call
            </button>
          </nav>

          <main>
            {activeTab === 'dashboard' && (
              <>
                <CreditsManager sessionId={sessionId} />
                <section className="voices">
                  <h2>Available Voices</h2>
                  <div className="voice-list">
                    {voices.map((voice, index) => (
                      <div key={index} className="voice-item">
                        <h3>{voice.name}</h3>
                        <p>{voice.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeTab === 'make-call' && (
              <DirectCallForm
                sessionId={sessionId}
                voices={voices}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}

export default App; 