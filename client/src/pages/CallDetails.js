import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import '../styles/CallDetails.css';

const CallDetails = () => {
  const { id } = useParams();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [call, setCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCallDetails();
  }, [id]);

  const fetchCallDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('call_id', id)
        .single();
      
      if (error) throw error;
      
      if (!data) {
        setError('Call not found');
        return;
      }
      
      // Check if the call belongs to the current user
      if (data.user_id !== user.id) {
        setError('You do not have permission to view this call');
        return;
      }
      
      setCall(data);
    } catch (error) {
      console.error('Error fetching call details:', error);
      setError(error.message || 'An error occurred while fetching call details');
    } finally {
      setLoading(false);
    }
  };

  const refreshCallDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/v1/call/${id}`, {
        headers: {
          'X-API-Key': localStorage.getItem('api_key') || ''
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh call');
      }
      
      await fetchCallDetails();
    } catch (error) {
      console.error('Error refreshing call details:', error);
      setError(error.message || 'An error occurred while refreshing call details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading call details...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="primary-btn">
          Go Back
        </button>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="not-found-container">
        <h1>Call Not Found</h1>
        <p>The call you're looking for doesn't exist or you don't have permission to view it.</p>
        <Link to="/call-history" className="primary-btn">
          Back to Call History
        </Link>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'initiated':
        return 'status-initiated';
      default:
        return '';
    }
  };

  return (
    <div className="call-details-container">
      <div className="call-details-header">
        <h1>Call Details</h1>
        <div className="action-buttons">
          <button onClick={refreshCallDetails} className="refresh-btn">
            <i className="fa fa-refresh"></i> Refresh
          </button>
          <button onClick={() => navigate(-1)} className="back-btn">
            Back
          </button>
        </div>
      </div>
      
      <div className="call-status-card">
        <div className="call-id">
          <span className="label">Call ID:</span>
          <span className="value">{call.call_id}</span>
        </div>
        
        <div className="call-status">
          <span className="label">Status:</span>
          <span className={`value ${getStatusClass(call.status)}`}>
            {call.status}
          </span>
        </div>
        
        <div className="call-date">
          <span className="label">Date:</span>
          <span className="value">{formatDate(call.created_at)}</span>
        </div>
      </div>
      
      <div className="call-details-grid">
        <div className="details-card">
          <h3>Call Information</h3>
          <div className="details-list">
            <div className="detail-item">
              <span className="label">Phone Number:</span>
              <span className="value">{call.phone_number || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Duration:</span>
              <span className="value">{call.duration || 0} minutes</span>
            </div>
            <div className="detail-item">
              <span className="label">Credits Used:</span>
              <span className="value">{call.credits_used || 1}</span>
            </div>
            <div className="detail-item">
              <span className="label">From Number:</span>
              <span className="value">{call.from_number || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Last Updated:</span>
              <span className="value">{formatDate(call.last_updated)}</span>
            </div>
          </div>
        </div>
        
        <div className="details-card">
          <h3>AI Configuration</h3>
          <div className="details-list">
            <div className="detail-item">
              <span className="label">Voice:</span>
              <span className="value">{call.voice || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Model:</span>
              <span className="value">{call.model || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Temperature:</span>
              <span className="value">{call.temperature || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Voicemail Action:</span>
              <span className="value">{call.voicemail_action || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Answered By Enabled:</span>
              <span className="value">{call.answered_by_enabled ? 'Yes' : 'No'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Max Duration:</span>
              <span className="value">{call.max_duration || 'N/A'} minutes</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="call-content-sections">
        <div className="content-section">
          <h3>Task/Prompt</h3>
          <div className="content-box">
            <p>{call.task || 'No task provided'}</p>
          </div>
        </div>
        
        {call.call_summary && (
          <div className="content-section">
            <h3>Call Summary</h3>
            <div className="content-box">
              <p>{call.call_summary}</p>
            </div>
          </div>
        )}
        
        {call.concatenated_transcript && (
          <div className="content-section">
            <h3>Call Transcript</h3>
            <div className="content-box transcript">
              <pre>{call.concatenated_transcript}</pre>
            </div>
          </div>
        )}
        
        {call.recording_url && (
          <div className="content-section">
            <h3>Recording</h3>
            <div className="content-box">
              <audio controls src={call.recording_url} className="audio-player">
                Your browser does not support the audio element.
              </audio>
              <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="download-link">
                Download Recording
              </a>
            </div>
          </div>
        )}
      </div>
      
      {call.error_message && (
        <div className="error-section">
          <h3>Error Message</h3>
          <div className="error-box">
            {call.error_message}
          </div>
        </div>
      )}
      
      <div className="call-additional-info">
        <h3>Additional Information</h3>
        <div className="details-list">
          <div className="detail-item">
            <span className="label">Answered By:</span>
            <span className="value">{call.answered_by || 'N/A'}</span>
          </div>
          {call.call_ended_by && (
            <div className="detail-item">
              <span className="label">Call Ended By:</span>
              <span className="value">{call.call_ended_by}</span>
            </div>
          )}
          {call.transfer_number && (
            <div className="detail-item">
              <span className="label">Transfer Number:</span>
              <span className="value">{call.transfer_number}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallDetails; 