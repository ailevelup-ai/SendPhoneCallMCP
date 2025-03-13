import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

/**
 * DirectCallForm Component
 * 
 * Provides a UI for users to directly initiate phone calls without using the MCP server.
 * Handles form validation, API calls, and displays feedback to the user.
 */
const DirectCallForm = ({ onCallInitiated }) => {
  const { user } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    phoneNumber: '',
    task: '',
    maxDuration: 5, // Default 5 minutes
    voice: 'nat', // Default voice
    model: 'turbo', // Default model
    temperature: 0.7, // Default temperature
    voicemailAction: 'hangup', // Default voicemail action
    answeredByEnabled: true, // Default answered by detection
  });
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  
  // Fetch available voices and models on component mount
  useEffect(() => {
    const fetchVoiceOptions = async () => {
      try {
        const response = await axios.get('/api/v1/voice-options');
        if (response.data && response.data.voices) {
          setAvailableVoices(response.data.voices);
        }
      } catch (error) {
        console.error('Error fetching voice options:', error);
        // Fallback to default voices
        setAvailableVoices([
          { id: 'nat', name: 'Nat (Male)' },
          { id: 'nova', name: 'Nova (Female)' },
          { id: 'dave', name: 'Dave (Male)' },
          { id: 'bella', name: 'Bella (Female)' },
          { id: 'amy', name: 'Amy (Female)' },
          { id: 'josh', name: 'Josh (Male)' }
        ]);
      }
    };
    
    const fetchModelOptions = async () => {
      try {
        const response = await axios.get('/api/v1/model-options');
        if (response.data && response.data.models) {
          setAvailableModels(response.data.models);
        }
      } catch (error) {
        console.error('Error fetching model options:', error);
        // Fallback to default models
        setAvailableModels([
          { id: 'turbo', name: 'Turbo (Fast & Efficient)' },
          { id: 'claude', name: 'Claude (Balanced)' },
          { id: 'gpt-4', name: 'GPT-4 (Advanced)' }
        ]);
      }
    };
    
    fetchVoiceOptions();
    fetchModelOptions();
  }, []);
  
  // Fetch user credits
  useEffect(() => {
    const fetchUserCredits = async () => {
      try {
        const response = await axios.get('/api/v1/credits');
        setUserCredits(response.data.balance || 0);
      } catch (error) {
        console.error('Error fetching user credits:', error);
        setUserCredits(0);
      }
    };
    
    if (user) {
      fetchUserCredits();
    }
  }, [user]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle different input types
    const inputValue = type === 'checkbox' ? checked : 
                      type === 'number' ? parseFloat(value) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: inputValue
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate phone number
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        throw new Error('Please enter a valid phone number in E.164 format (e.g., +15551234567)');
      }
      
      // Validate task
      if (!formData.task.trim()) {
        throw new Error('Please enter a task for the call');
      }
      
      // Check if user has enough credits
      if (userCredits < 1) {
        throw new Error(`You don't have enough credits for this call. Required: 1, Available: ${userCredits}`);
      }
      
      // Prepare request data
      const requestData = {
        phone_number: formData.phoneNumber,
        task: formData.task,
        max_duration: formData.maxDuration,
        voice: formData.voice,
        model: formData.model,
        temperature: parseFloat(formData.temperature),
        voicemail_action: formData.voicemailAction,
        answered_by_enabled: formData.answeredByEnabled,
      };
      
      // Make API call to backend
      const response = await axios.post('/api/v1/call', requestData);
      
      // Handle success
      setSuccess('Call initiated successfully!');
      setUserCredits(prev => prev - 1); // Reduce credits immediately for UI feedback
      
      // Call the callback function if provided
      if (onCallInitiated && typeof onCallInitiated === 'function') {
        onCallInitiated(response.data);
      }
      
    } catch (error) {
      console.error('Error initiating call:', error);
      setError(error.response?.data?.message || error.message || 'An error occurred while initiating the call');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="direct-call-form-container">
      <h2>Make a Direct Call</h2>
      
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <strong>Success:</strong> {success}
        </div>
      )}
      
      <div className="credit-info">
        <div className="credit-balance">
          <span>Available Credits:</span>
          <strong>{userCredits}</strong>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="direct-call-form">
        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            placeholder="+15551234567"
            required
            className="form-control"
          />
          <small className="form-text text-muted">Enter phone number in E.164 format (e.g., +15551234567)</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="task">Task/Prompt</label>
          <textarea
            id="task"
            name="task"
            value={formData.task}
            onChange={handleInputChange}
            placeholder="Describe what the AI should do on this call..."
            required
            className="form-control"
            rows={5}
          />
          <small className="form-text text-muted">Be specific about what you want the AI to accomplish</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="maxDuration">Maximum Duration (minutes)</label>
          <input
            type="number"
            id="maxDuration"
            name="maxDuration"
            value={formData.maxDuration}
            onChange={handleInputChange}
            min={1}
            max={30}
            required
            className="form-control"
          />
          <small className="form-text text-muted">Maximum call duration in minutes (1-30)</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="voice">Voice</label>
          <select
            id="voice"
            name="voice"
            value={formData.voice}
            onChange={handleInputChange}
            className="form-control"
          >
            {availableVoices.map(voice => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="model">AI Model</label>
          <select
            id="model"
            name="model"
            value={formData.model}
            onChange={handleInputChange}
            className="form-control"
          >
            {availableModels.map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="temperature">Temperature</label>
          <input
            type="range"
            id="temperature"
            name="temperature"
            value={formData.temperature}
            onChange={handleInputChange}
            min={0}
            max={1}
            step={0.1}
            className="form-control-range"
          />
          <div className="temperature-display">
            <span>Predictable</span>
            <span className="temperature-value">{formData.temperature}</span>
            <span>Creative</span>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="voicemailAction">Voicemail Action</label>
          <select
            id="voicemailAction"
            name="voicemailAction"
            value={formData.voicemailAction}
            onChange={handleInputChange}
            className="form-control"
          >
            <option value="hangup">Hang Up</option>
            <option value="leave_message">Leave Message</option>
          </select>
          <small className="form-text text-muted">What should the AI do if it reaches voicemail?</small>
        </div>
        
        <div className="form-group form-check">
          <input
            type="checkbox"
            id="answeredByEnabled"
            name="answeredByEnabled"
            checked={formData.answeredByEnabled}
            onChange={handleInputChange}
            className="form-check-input"
          />
          <label className="form-check-label" htmlFor="answeredByEnabled">
            Enable Answered By Detection
          </label>
          <small className="form-text text-muted">Detect if a human, voicemail, or machine answers</small>
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary btn-block"
          disabled={isLoading}
        >
          {isLoading ? 'Initiating Call...' : 'Make Call'}
        </button>
      </form>
    </div>
  );
};

export default DirectCallForm; 