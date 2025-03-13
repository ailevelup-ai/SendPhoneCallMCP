import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-code">404</div>
        <h1>Page Not Found</h1>
        <p>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            Go to Home
          </Link>
          <Link to="/dashboard" className="btn btn-outline">
            Go to Dashboard
          </Link>
        </div>
      </div>
      
      <div className="not-found-illustration">
        <div className="phone-illustration">
          <div className="phone-screen">
            <div className="error-icon">
              <span>!</span>
            </div>
            <div className="error-text">Call Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound; 