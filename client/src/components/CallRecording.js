import React, { useState, useEffect } from 'react';

/**
 * Component for displaying call recording audio player
 * 
 * @param {Object} props
 * @param {string} props.recordingUrl - URL to the call recording audio file
 * @param {string} props.callId - ID of the call for reference
 * @param {boolean} props.isLoading - Whether the recording is still loading
 */
const CallRecording = ({ recordingUrl, callId, isLoading }) => {
  const [error, setError] = useState(null);
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);

  useEffect(() => {
    // Reset states when recordingUrl changes
    setError(null);
    setIsAudioLoaded(false);
  }, [recordingUrl]);

  const handleAudioError = () => {
    setError('Unable to load recording. The file may not be available yet or there was an error.');
  };

  const handleAudioLoad = () => {
    setIsAudioLoaded(true);
  };

  if (isLoading) {
    return (
      <div className="call-recording loading">
        <div className="recording-header">
          <h3>Call Recording</h3>
        </div>
        <div className="recording-content">
          <p className="loading-text">Loading recording...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!recordingUrl) {
    return (
      <div className="call-recording not-available">
        <div className="recording-header">
          <h3>Call Recording</h3>
        </div>
        <div className="recording-content">
          <p className="not-available-text">No recording is available for this call.</p>
          <p className="not-available-subtext">This may be because the call didn't complete or recording was disabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="call-recording">
      <div className="recording-header">
        <h3>Call Recording</h3>
        {isAudioLoaded && (
          <a 
            href={recordingUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="download-link"
            download={`call-${callId}.mp3`}
          >
            Download
          </a>
        )}
      </div>
      
      <div className="recording-content">
        {error ? (
          <div className="error-message">
            <p>{error}</p>
            <button 
              className="retry-button"
              onClick={() => {
                setError(null);
                // Force reload of audio by creating a new URL with cache buster
                const cacheBusterUrl = `${recordingUrl}${recordingUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
                const audioElement = document.getElementById(`audio-${callId}`);
                if (audioElement) {
                  audioElement.src = cacheBusterUrl;
                  audioElement.load();
                }
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <audio 
            id={`audio-${callId}`}
            controls 
            className="audio-player"
            onError={handleAudioError}
            onLoadedData={handleAudioLoad}
          >
            <source src={recordingUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        )}
      </div>
    </div>
  );
};

export default CallRecording; 