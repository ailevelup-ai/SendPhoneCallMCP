import React from 'react';

/**
 * Component for displaying call status badges with appropriate colors
 * 
 * @param {Object} props
 * @param {string} props.status - The status of the call
 * @param {string} props.size - The size of the badge ('sm', 'md', 'lg')
 * @param {boolean} props.withDot - Whether to show a colored dot next to the status
 */
const StatusBadge = ({ status, size = 'md', withDot = true }) => {
  // Normalize status to handle different formats
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  
  // Determine badge class based on status
  let badgeClass = 'status-badge';
  
  // Add size class
  badgeClass += ` ${size}`;
  
  // Add status-specific class
  if (normalizedStatus.includes('initiated') || normalizedStatus.includes('pending')) {
    badgeClass += ' status-initiated';
  } else if (normalizedStatus.includes('in_progress') || normalizedStatus.includes('in progress') || normalizedStatus.includes('ringing')) {
    badgeClass += ' status-in-progress';
  } else if (normalizedStatus.includes('completed') || normalizedStatus.includes('success')) {
    badgeClass += ' status-completed';
  } else if (normalizedStatus.includes('failed') || normalizedStatus.includes('error')) {
    badgeClass += ' status-failed';
  } else if (normalizedStatus.includes('no_answer') || normalizedStatus.includes('no answer')) {
    badgeClass += ' status-no-answer';
  } else if (normalizedStatus.includes('busy')) {
    badgeClass += ' status-busy';
  } else if (normalizedStatus.includes('voicemail')) {
    badgeClass += ' status-voicemail';
  } else {
    badgeClass += ' status-unknown';
  }
  
  // Format status for display
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    
    // Replace underscores with spaces
    let formatted = status.replace(/_/g, ' ');
    
    // Capitalize first letter of each word
    formatted = formatted
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formatted;
  };

  return (
    <span className={badgeClass}>
      {withDot && <span className="status-dot"></span>}
      {formatStatus(status)}
    </span>
  );
};

export default StatusBadge; 