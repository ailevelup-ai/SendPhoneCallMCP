import React, { useState } from 'react';

/**
 * Component for displaying call transcripts with formatting for different speakers
 * 
 * @param {Object} props
 * @param {string} props.transcript - The full transcript text
 * @param {boolean} props.isLoading - Whether the transcript is still loading
 */
const CallTranscript = ({ transcript, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Function to format transcript with speaker labels
  const formatTranscript = (text) => {
    if (!text) return [];
    
    // Split by new lines and process each line
    const lines = text.split('\n').filter(line => line.trim());
    
    return lines.map((line, index) => {
      // Check if line starts with a speaker label (AI: or Human:)
      const aiMatch = line.match(/^(AI|Assistant|ailevelup|System):\s*(.*)/i);
      const humanMatch = line.match(/^(Human|User|Person|Customer|Caller):\s*(.*)/i);
      
      if (aiMatch) {
        return (
          <div key={index} className="transcript-line ai">
            <span className="speaker ai-speaker">AI:</span>
            <span className="content">{aiMatch[2]}</span>
          </div>
        );
      } else if (humanMatch) {
        return (
          <div key={index} className="transcript-line human">
            <span className="speaker human-speaker">Human:</span>
            <span className="content">{humanMatch[2]}</span>
          </div>
        );
      } else {
        // Try to detect if this is part of a previous speaker's message
        const isAIPart = index > 0 && lines[index - 1].match(/^(AI|Assistant|ailevelup|System):/i);
        const isHumanPart = index > 0 && lines[index - 1].match(/^(Human|User|Person|Customer|Caller):/i);
        
        if (isAIPart) {
          return (
            <div key={index} className="transcript-line ai continuation">
              <span className="content">{line}</span>
            </div>
          );
        } else if (isHumanPart) {
          return (
            <div key={index} className="transcript-line human continuation">
              <span className="content">{line}</span>
            </div>
          );
        } else {
          // If we can't determine the speaker, use a neutral style
          return (
            <div key={index} className="transcript-line neutral">
              <span className="content">{line}</span>
            </div>
          );
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="call-transcript loading">
        <div className="transcript-header">
          <h3>Call Transcript</h3>
        </div>
        <div className="transcript-content">
          <p className="loading-text">Loading transcript...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="call-transcript not-available">
        <div className="transcript-header">
          <h3>Call Transcript</h3>
        </div>
        <div className="transcript-content">
          <p className="not-available-text">No transcript is available for this call.</p>
          <p className="not-available-subtext">This may be because the call didn't complete or transcription was disabled.</p>
        </div>
      </div>
    );
  }

  // Calculate if transcript is long (more than 10 lines)
  const lines = transcript.split('\n').filter(line => line.trim());
  const isLongTranscript = lines.length > 10;
  
  // Determine how many lines to show in collapsed state
  const previewLines = isLongTranscript && !isExpanded ? 10 : lines.length;
  
  // Get preview text
  const previewText = lines.slice(0, previewLines).join('\n');

  return (
    <div className="call-transcript">
      <div className="transcript-header">
        <h3>Call Transcript</h3>
        {isLongTranscript && (
          <button 
            className="toggle-expand-button"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>
      
      <div className="transcript-content">
        <div className="transcript-lines">
          {formatTranscript(previewText)}
        </div>
        
        {isLongTranscript && !isExpanded && (
          <div className="transcript-fade-out"></div>
        )}
      </div>
    </div>
  );
};

export default CallTranscript; 