import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Login from './Login';

// eslint-disable-next-line
function VoiceItem({ voice, onPlay, isPlaying }) {
  return (
    <div className="voice-item">
      <h3>{voice.name}</h3>
      <p>{voice.description}</p>
      <button 
        className={`play-button ${isPlaying ? 'playing' : ''}`} 
        onClick={() => onPlay(voice)}
        disabled={isPlaying}
      >
        {isPlaying ? 'Playing...' : 'Play Sample'}
      </button>
    </div>
  );
}

function DirectCallForm({ voices, sessionId, setCurrentPlayingVoice, currentPlayingVoice, fetchCallHistoryRef }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [task, setTask] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [status, setStatus] = useState('');
  const [temperature, setTemperature] = useState(1);
  const [maxDuration, setMaxDuration] = useState(300);
  const [phoneNumberError, setPhoneNumberError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  
  // Update selected voice when voices are loaded
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) {
      setSelectedVoice(voices[0].id);
    }
  }, [voices, selectedVoice]);

  // Phone number formatting and validation functions
  const formatToE164 = (input) => {
    // Remove all non-digit characters
    let digits = input.replace(/\D/g, '');
    
    // Check if we need to add the country code (assume US +1 if not present)
    if (digits.length === 10) {
      // US number without country code
      digits = '1' + digits;
    }
    
    // Only add the plus sign if we have digits
    if (digits) {
      return '+' + digits;
    }
    
    return '';
  };

  const handlePhoneNumberChange = (e) => {
    const input = e.target.value;
    setPhoneNumber(input);
    
    // Clear any previous errors
    if (phoneNumberError) {
      setPhoneNumberError('');
    }
  };

  const handlePhoneNumberBlur = () => {
    if (!phoneNumber) {
      setPhoneNumberError('Phone number is required');
      return;
    }
    
    // Format to E.164 on blur
    const formattedNumber = formatToE164(phoneNumber);
    setPhoneNumber(formattedNumber);
    
    // Validate the formatted number
    const e164Regex = /^\+[1-9]\d{10,14}$/;
    if (!e164Regex.test(formattedNumber)) {
      setPhoneNumberError('Please enter a valid phone number');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate phone number
    if (!phoneNumber) {
      setPhoneNumberError('Phone number is required');
      return;
    }
    
    // Format phone number (ensure it has a '+' prefix for international format)
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    
    setStatus('Initiating call...');
    setIsSubmitting(true);
    
    try {
      // Get the token from localStorage
      const token = localStorage.getItem('token');
      
      // Use the auth headers that worked for initialization
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : 'Bearer ailevelup-mcp',
        'MCP-Session-Id': sessionId
      };
      
      console.log('Making phone call with parameters:', {
        phoneNumber: formattedNumber,
        task,
        voice: selectedVoice,
        maxDuration,
        temperature,
        webhookUrl,
        model: 'turbo' // Always use turbo model
      });
      
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers,
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
              temperature,
              webhookUrl: webhookUrl || undefined,
              model: 'turbo' // Always use turbo model
            }
          }
        })
      });

      const data = await response.json();
      console.log('Phone call response:', data);
      
      if (data.result) {
        setStatus(`Call initiated successfully! Call ID: ${data.result.callId}`);
        // After successful call, refresh the call history
        if (fetchCallHistoryRef.current) {
          fetchCallHistoryRef.current();
        }
      } else if (data.error) {
        setStatus(`Error: ${data.error.message || JSON.stringify(data.error)}`);
      }
    } catch (error) {
      console.error('Error making call:', error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const playVoiceSample = async (voice) => {
    try {
      const sampleText = "Hello there! This is a sample of my voice. I can help you make phone calls and perform various tasks over the phone.";
      
      setCurrentPlayingVoice(voice.id);
      
      // Use the auth headers that worked for initialization if available
      const headers = {
        'Content-Type': 'application/json',
        ...(window.authHeaders || {
          'Authorization': 'Bearer ailevelup-mcp'
        })
      };
      
      const response = await fetch('/api/voice-sample', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          voice_id: voice.id,
          text: sampleText
        })
      });
      
      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setCurrentPlayingVoice(null);
          URL.revokeObjectURL(audioUrl); // Clean up blob URL when done
        };
        
        audio.onerror = () => {
          console.error('Error playing audio sample');
          setCurrentPlayingVoice(null);
          URL.revokeObjectURL(audioUrl);
        };
        
        await audio.play();
      } else {
        console.error('Failed to generate voice sample');
        setCurrentPlayingVoice(null);
      }
    } catch (error) {
      console.error('Error playing voice sample:', error);
      setCurrentPlayingVoice(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="direct-call-form">
      <h2>Make a Direct Call</h2>
      
      <div className="form-group">
        <label htmlFor="phoneNumber">Phone Number</label>
        <input
          type="tel"
          id="phoneNumber"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          onBlur={handlePhoneNumberBlur}
          placeholder="+1 (555) 555-5555"
          className={phoneNumberError ? 'error' : ''}
        />
        {phoneNumberError && <div className="error-message">{phoneNumberError}</div>}
      </div>
      
      <div className="form-group">
        <label htmlFor="task">Task Description</label>
        <textarea
          id="task"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe what the AI should do on this call..."
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="webhookUrl">Webhook URL (Optional)</label>
        <input
          type="url"
          id="webhookUrl"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://your-webhook-url.com/callback"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="temperature">Temperature (Creativity)</label>
        <input
          type="range"
          id="temperature"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />
        <span>{temperature}</span>
      </div>

      <div className="form-group">
        <label htmlFor="maxDuration">Max Duration (seconds)</label>
        <input
          type="number"
          id="maxDuration"
          min="60"
          max="1800"
          value={maxDuration}
          onChange={(e) => setMaxDuration(parseInt(e.target.value))}
        />
      </div>
      
      <div className="voice-select-container">
        <label>Select Voice</label>
        <div className="voice-options">
          {voices.map(voice => (
            <div
              key={voice.id}
              className={`voice-option ${selectedVoice === voice.id ? 'selected' : ''}`}
              onClick={() => setSelectedVoice(voice.id)}
            >
              <button
                type="button"
                className={`voice-play-button ${currentPlayingVoice === voice.id ? 'playing' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playVoiceSample(voice);
                }}
              >
                {currentPlayingVoice === voice.id ? '■' : '▶'}
              </button>
              <div className="voice-details">
                <div className="voice-name">{voice.name}</div>
                <div className="voice-accent">{voice.gender}, {voice.accent}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <button type="submit" className="submit-button">Make Call</button>
      
      {status && (
        <div className={`status-message ${status.includes('successfully') ? 'success' : status.includes('Error') ? 'error' : ''}`}>
          {status}
        </div>
      )}
    </form>
  );
}

function CreditsManager({ sessionId }) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [customAmount, setCustomAmount] = useState(100);
  const [showCustomAmount, setShowCustomAmount] = useState(false);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : 'Bearer ailevelup-mcp',
          'MCP-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/execute',
          params: {
            name: 'getCredits'
          }
        })
      });

      const data = await response.json();
      
      if (data.result) {
        setCredits(data.result);
      } else if (data.error) {
        setError(`Failed to fetch credits: ${data.error.message}`);
      }
    } catch (error) {
      console.error('Error fetching credits:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch credits when component mounts or sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchCredits();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Format the credit value for display with proper null checks
  const formatCredits = (creditsData) => {
    if (!creditsData) return '0.00';
    
    // Check different possible structures based on API response
    if (typeof creditsData === 'number') {
      return creditsData.toFixed(2);
    }
    
    if (creditsData.balance !== undefined && creditsData.balance !== null) {
      return Number(creditsData.balance).toFixed(2);
    }
    
    return '0.00';
  };

  // Updated credit purchase plans
  const creditPlans = [
    { id: 'credits_25', name: '25 Credits', price: 5.00, credits: 25 },
    { id: 'credits_100', name: '100 Credits', price: 20.00, credits: 100 },
    { id: 'credits_300', name: '300 Credits', price: 50.00, credits: 300 },
    { id: 'credits_1000', name: '1000 Credits', price: 100.00, credits: 1000 },
  ];

  // Updated subscription plans
  const subscriptionPlans = [
    { id: 'sub_standard', name: 'Standard Monthly', price: 19.99, creditsPerMonth: 110 },
    { id: 'sub_pro', name: 'Pro Monthly', price: 49.99, creditsPerMonth: 420 },
    { id: 'sub_enterprise', name: 'Enterprise Monthly', price: 99.99, creditsPerMonth: 1100 }
  ];

  // Handle custom amount input
  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    // Only allow numbers and decimal point
    if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
      setCustomAmount(value);
    }
  };

  // Calculate credits from custom amount (10c per minute)
  const calculateCustomCredits = () => {
    if (!customAmount || isNaN(parseFloat(customAmount))) return 0;
    const amount = parseFloat(customAmount);
    return Math.floor(amount * 10); // 10 credits per dollar
  };

  // Handle custom amount purchase
  const handleCustomPurchase = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 100) {
      alert('Custom amount must be greater than $100');
      return;
    }
    
    const credits = calculateCustomCredits();
    if (credits > 1000000) {
      alert('Maximum 1 million credits allowed');
      return;
    }
    
    const customPlan = {
      id: 'custom_credits',
      name: `${credits} Credits`,
      price: amount,
      credits: credits
    };
    
    handlePurchaseCredits(customPlan);
  };

  // Handle opening Stripe checkout for one-time purchases
  const handlePurchaseCredits = (plan) => {
    setSelectedPlan(plan);
    setShowCustomAmount(true);
    // In a real implementation, you'd redirect to a Stripe checkout page or open a Stripe modal
    console.log(`Opening Stripe checkout for ${plan.name} plan at $${plan.price}`);
    
    // Example of how you might open a Stripe checkout
    // window.open(`https://your-stripe-checkout-url?plan=${plan.id}&session=${sessionId}`, '_blank');
  };

  // Handle opening Stripe checkout for subscriptions
  const handleSubscribe = (plan) => {
    setSelectedPlan(plan);
    setShowCustomAmount(true);
    // In a real implementation, you'd redirect to a Stripe checkout page or open a Stripe modal
    console.log(`Opening Stripe subscription checkout for ${plan.name} plan at $${plan.price}/month`);
    
    // Example of how you might open a Stripe checkout for subscriptions
    // window.open(`https://your-stripe-subscription-url?plan=${plan.id}&session=${sessionId}`, '_blank');
  };

  // Simulating a Stripe form (in production, you'd use Stripe Elements or Checkout)
  const StripeForm = () => (
    <div className="stripe-form">
      <h3>Complete Purchase</h3>
      <p>Plan: {selectedPlan?.name}</p>
      <p>Price: ${selectedPlan?.price.toFixed(2)}</p>
      
      <div className="form-group">
        <label htmlFor="card-number">Card Number</label>
        <input type="text" id="card-number" placeholder="4242 4242 4242 4242" />
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="expiry">Expiry (MM/YY)</label>
          <input type="text" id="expiry" placeholder="MM/YY" />
        </div>
        <div className="form-group">
          <label htmlFor="cvc">CVC</label>
          <input type="text" id="cvc" placeholder="123" />
        </div>
      </div>
      
      <div className="button-row">
        <button 
          className="cancel-button" 
          onClick={() => setShowCustomAmount(false)}
        >
          Cancel
        </button>
        <button 
          className="pay-button"
          onClick={() => {
            alert(`Payment of $${selectedPlan.price.toFixed(2)} processed! Credits will be added shortly.`);
            setShowCustomAmount(false);
            // In a real app, you'd process the payment through Stripe
          }}
        >
          Pay ${selectedPlan?.price.toFixed(2)}
        </button>
      </div>
    </div>
  );

  return (
    <div className="credits-manager">
      <h2>Credits</h2>
      {loading ? (
        <p>Loading credits...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : showCustomAmount ? (
        <StripeForm />
      ) : (
        <>
          <div className="credits-balance">
            <h3>Available Credits</h3>
            <div className="credits-value">{formatCredits(credits)}</div>
            
            {credits && credits.totalAdded !== undefined && (
              <div className="credits-stats">
                <div className="stat">
                  <span className="stat-label">Total Added:</span>
                  <span className="stat-value">{Number(credits.totalAdded || 0).toFixed(2)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Total Used:</span>
                  <span className="stat-value">{Number(credits.totalUsed || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <button className="refresh-button" onClick={fetchCredits}>
              Refresh
            </button>
          </div>
          
          <div className="purchase-section">
            <h3>Purchase Credits</h3>
            <p className="pricing-info">1 credit = 1 minute of call time</p>
            <div className="plan-options">
              {creditPlans.map(plan => (
                <div key={plan.id} className="plan-card">
                  <div className="plan-name">{plan.credits} Credits</div>
                  <div className="plan-price">${plan.price.toFixed(2)}</div>
                  <button 
                    className="purchase-button"
                    onClick={() => handlePurchaseCredits(plan)}
                  >
                    Buy Now
                  </button>
                </div>
              ))}
            </div>
            
            <div className="custom-purchase">
              <h4>Need more credits?</h4>
              <p>For orders over $100: 10¢ per minute (maximum 1 million minutes)</p>
              <div className="custom-input-group">
                <span className="currency-symbol">$</span>
                <input 
                  type="text" 
                  value={customAmount} 
                  onChange={handleCustomAmountChange}
                  placeholder="Enter amount (more than $100)"
                  className="custom-amount-input"
                />
                <button 
                  className="purchase-button"
                  onClick={handleCustomPurchase}
                  disabled={!customAmount || parseFloat(customAmount) <= 100}
                >
                  Get {calculateCustomCredits()} Credits
                </button>
              </div>
            </div>
          </div>
          
          <div className="subscription-section">
            <h3>Subscribe and Save</h3>
            <div className="plan-options">
              {subscriptionPlans.map(plan => (
                <div key={plan.id} className="plan-card">
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price">${plan.price.toFixed(2)}<span className="per-month">/month</span></div>
                  <div className="plan-feature">{plan.creditsPerMonth} credits per month</div>
                  <button 
                    className="subscribe-button"
                    onClick={() => handleSubscribe(plan)}
                  >
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CallLogManager({ sessionId, setFetchCallHistoryRef }) {
  const [callHistory, setCallHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to fetch the call history
  const fetchCallHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : 'Bearer ailevelup-mcp',
          'MCP-Session-Id': sessionId
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/execute',
          params: {
            name: 'getCallHistory',
            arguments: {
              limit: 10
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        setError(`Error fetching call history: ${data.error.message}`);
      } else if (data.result && Array.isArray(data.result.calls)) {
        setCallHistory(data.result.calls);
      } else {
        setCallHistory([]);
      }
    } catch (error) {
      console.error('Error fetching call history:', error);
      setError(`Failed to load call history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Set the fetchCallHistory function in the parent
  useEffect(() => {
    if (setFetchCallHistoryRef) {
      setFetchCallHistoryRef(fetchCallHistory);
    }
  }, [setFetchCallHistoryRef, fetchCallHistory]);
  
  // Fetch call history on component mount
  useEffect(() => {
    if (sessionId) {
      fetchCallHistory();
    }
  }, [sessionId, fetchCallHistory]);
  
  // Format date function
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  // Format duration in minutes and seconds
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  return (
    <div className="call-log-manager">
      <div className="call-log-header">
        <h2>Call Log</h2>
        <button 
          className="refresh-button" 
          onClick={fetchCallHistory}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      {loading ? (
        <div className="loading-indicator">Loading call history...</div>
      ) : callHistory.length === 0 ? (
        <div className="no-calls">No calls yet</div>
      ) : (
        <div className="call-table">
          <div className="call-header">
            <div className="call-cell">Phone</div>
            <div className="call-cell">Status</div>
            <div className="call-cell">Duration</div>
            <div className="call-cell">Date</div>
          </div>
          
          {callHistory.map(call => (
            <div key={call.id} className={`call-row ${call.status.toLowerCase()}`}>
              <div className="call-cell">{call.phone_number}</div>
              <div className="call-cell">{call.status}</div>
              <div className="call-cell">{formatDuration(call.duration)}</div>
              <div className="call-cell">{formatDate(call.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [sessionId, setSessionId] = useState('');
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPlayingVoice, setCurrentPlayingVoice] = useState(null);
  const fetchCallHistoryRef = useRef(null);
  
  // Add authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  
  // Check if user is already logged in (token in localStorage)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');
    
    if (token && userId) {
      setIsAuthenticated(true);
      setUser({
        id: userId,
        email: userEmail,
        role: userRole,
        token
      });
    }
  }, []);
  
  // Separate useEffect for initialization after authentication
  useEffect(() => {
    if (isAuthenticated) {
      initializeSession();
    }
  }, [isAuthenticated]);

  const setFetchCallHistoryRef = (fetchFn) => {
    fetchCallHistoryRef.current = fetchFn;
  };
  
  const handleLogout = () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    
    // Reset state
    setIsAuthenticated(false);
    setUser(null);
    setSessionId('');
    setVoices([]);
  };
  
  const handleLoginSuccess = (userData) => {
    // Set authentication state
    setIsAuthenticated(true);
    setUser(userData);
    
    // Initialize the session
    initializeSession();
  };

  const initializeSession = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Set up auth headers
      const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : 'Bearer ailevelup-mcp'
      };
      
      // Store auth headers globally for reuse
      window.authHeaders = authHeaders;
      
      console.log('Initializing MCP session...');
      
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {}
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('MCP initialization response:', data);
        
        if (data.result) {
          const sid = data.result.sessionId;
          setSessionId(sid);
          
          // Fetch voices after session initialization
          fetchVoices(sid, authHeaders);
        } else if (data.error) {
          console.error('MCP initialization error:', data.error);
          setError(`Initialization error: ${data.error.message || JSON.stringify(data.error)}`);
          setLoading(false);
        }
      } else {
        console.error('Failed to initialize MCP session:', response.status, response.statusText);
        setError(`Failed to initialize: ${response.status} ${response.statusText}`);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error initializing MCP session:', error);
      setError(`Error initializing session: ${error.message}`);
      setLoading(false);
    }
  };

  const fetchVoices = async (sid, authHeaders) => {
    try {
      console.log('Fetching available voices...');
      
      const response = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'MCP-Session-Id': sid
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/execute',
          params: {
            name: 'getVoiceOptions'
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Voices response:', data);
        
        if (data.result && data.result.voices) {
          setVoices(data.result.voices);
        } else if (data.error) {
          console.error('Error fetching voices:', data.error);
        }
      } else {
        console.error('Failed to fetch voices:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching voices:', error);
    } finally {
      setLoading(false);
    }
  };

  // This function is used by DirectCallForm, so we need to keep it
  // eslint-disable-next-line no-unused-vars
  const handlePlayVoice = (voice) => {
    setCurrentPlayingVoice(voice.id);
    
    audioRef.current.pause();
    audioRef.current = new Audio(`/api/v1/voice-samples/${voice.id}`);
    
    audioRef.current.onended = () => {
      setCurrentPlayingVoice(null);
    };
    
    audioRef.current.onerror = () => {
      console.error('Error playing audio sample');
      setCurrentPlayingVoice(null);
    };
    
    audioRef.current.play().catch(error => {
      console.error('Error playing audio:', error);
      setCurrentPlayingVoice(null);
    });
  };

  // Replace this function to use the new image
  const openImageInNewWindow = () => {
    window.open("https://ailevelup.ai/wp-content/uploads/2025/03/SendMCPPhoneCallSplash.jpeg", "_blank", "noopener,noreferrer");
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (!sessionId) {
    return <div className="loading">Initializing session...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-container">
          <h1>Phone Call MCP</h1>
        </div>
        {user && (
          <div className="user-info">
            <span>{user.email}</span>
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </header>
      
      <main className="app-content">
        {loading ? (
          <div className="loading">Initializing MCP service...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <div className="content-wrapper">
            <div className="left-panel">
              <DirectCallForm 
                voices={voices} 
                sessionId={sessionId}
                setCurrentPlayingVoice={setCurrentPlayingVoice}
                currentPlayingVoice={currentPlayingVoice}
                fetchCallHistoryRef={fetchCallHistoryRef}
              />
              <CreditsManager sessionId={sessionId} />
            </div>
            <div className="right-panel">
              <CallLogManager 
                sessionId={sessionId} 
                setFetchCallHistoryRef={setFetchCallHistoryRef} 
              />
            </div>
          </div>
        )}
      </main>
      
      <footer className="app-footer">
        <p>&copy; 2025 Sausage Software. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App; 