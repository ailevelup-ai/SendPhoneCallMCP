import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import axios from 'axios';

const NewCall = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { supabase } = useSupabase();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    phoneNumber: '',
    task: '',
    maxDuration: 5, // Default 5 minutes
    voice: 'nat', // Default voice
    model: 'turbo', // Default model
    temperature: 1, // Default temperature
    voicemailAction: 'hangup', // Default voicemail action
    answeredByEnabled: true, // Default answered by detection
    transferNumber: '', // Optional transfer number
  });
  
  // Fetch user credits on component mount
  useEffect(() => {
    const fetchUserCredits = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('credits')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setUserCredits(data.credits || 0);
        }
      } catch (error) {
        console.error('Error fetching user credits:', error);
      }
    };
    
    if (user) {
      fetchUserCredits();
    }
  }, [user, supabase]);
  
  // Calculate estimated cost based on max duration
  useEffect(() => {
    // Assuming 1 credit = 1 minute
    setEstimatedCost(formData.maxDuration);
  }, [formData.maxDuration]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Handle different input types
    const inputValue = type === 'checkbox' ? checked : value;
    
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
      if (userCredits < estimatedCost) {
        throw new Error(`You don't have enough credits for this call. Required: ${estimatedCost}, Available: ${userCredits}`);
      }
      
      // Prepare request data
      const requestData = {
        phoneNumber: formData.phoneNumber,
        task: formData.task,
        maxDuration: formData.maxDuration,
        voice: formData.voice,
        model: formData.model,
        temperature: parseFloat(formData.temperature),
        voicemailAction: formData.voicemailAction,
        answeredByEnabled: formData.answeredByEnabled,
      };
      
      // Add optional transfer number if provided
      if (formData.transferNumber) {
        requestData.transferNumber = formData.transferNumber;
      }
      
      // Make API call to backend
      const response = await axios.post('/api/v1/call', requestData);
      
      // Handle success
      setSuccess('Call initiated successfully!');
      
      // Navigate to call details page after a short delay
      setTimeout(() => {
        navigate(`/calls/${response.data.callId}`);
      }, 2000);
      
    } catch (error) {
      console.error('Error initiating call:', error);
      setError(error.response?.data?.message || error.message || 'An error occurred while initiating the call');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="new-call-page">
      <div className="page-header">
        <h1>Make a New Call</h1>
        <p>Fill out the form below to initiate a new AI phone call</p>
      </div>
      
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
        <div className="estimated-cost">
          <span>Estimated Cost:</span>
          <strong>{estimatedCost} credits</strong>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="call-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          
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
        </div>
        
        <div className="form-section">
          <h2>Call Settings</h2>
          
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
              <option value="nat">Nat (Male)</option>
              <option value="nova">Nova (Female)</option>
              <option value="dave">Dave (Male)</option>
              <option value="bella">Bella (Female)</option>
              <option value="amy">Amy (Female)</option>
              <option value="josh">Josh (Male)</option>
            </select>
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
          
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="answeredByEnabled"
              name="answeredByEnabled"
              checked={formData.answeredByEnabled}
              onChange={handleInputChange}
              className="form-check-input"
            />
            <label htmlFor="answeredByEnabled" className="form-check-label">
              Enable "Answered By" Detection
            </label>
            <small className="form-text text-muted">Detect if a human or voicemail system answered the call</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="transferNumber">Transfer Number (Optional)</label>
            <input
              type="tel"
              id="transferNumber"
              name="transferNumber"
              value={formData.transferNumber}
              onChange={handleInputChange}
              placeholder="+15551234567"
              className="form-control"
            />
            <small className="form-text text-muted">Number to transfer the call to if needed (E.164 format)</small>
          </div>
        </div>
        
        <div className="form-section">
          <h2>AI Configuration</h2>
          
          <div className="form-group">
            <label htmlFor="model">AI Model</label>
            <select
              id="model"
              name="model"
              value={formData.model}
              onChange={handleInputChange}
              className="form-control"
            >
              <option value="turbo">GPT-3.5 Turbo (Faster, cheaper)</option>
              <option value="gpt4">GPT-4 (More capable, expensive)</option>
              <option value="claude">Claude (Balanced)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="temperature">Temperature ({formData.temperature})</label>
            <input
              type="range"
              id="temperature"
              name="temperature"
              value={formData.temperature}
              onChange={handleInputChange}
              min={0}
              max={2}
              step={0.1}
              className="form-control-range"
            />
            <div className="temperature-labels">
              <small>More Predictable</small>
              <small>More Creative</small>
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Initiating Call...' : 'Make Call'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewCall; 