import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Header.css';

const Header = () => {
  const { isAuthenticated, signOut, credits, apiKey } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <header className="header">
      <div className="container">
        <div className="logo">
          <Link to="/">
            <h1>Bland.AI <span>MCP</span></h1>
          </Link>
        </div>

        <div className="mobile-menu-button" onClick={toggleMobileMenu}>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <nav className={`main-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <ul>
            <li>
              <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            </li>
            <li>
              <Link to="/api-docs" onClick={() => setMobileMenuOpen(false)}>API Docs</Link>
            </li>
            
            {isAuthenticated ? (
              <>
                <li>
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                </li>
                <li>
                  <Link to="/call-history" onClick={() => setMobileMenuOpen(false)}>Call History</Link>
                </li>
              </>
            ) : null}
          </ul>

          <div className="auth-section">
            {isAuthenticated ? (
              <>
                <div className="user-info">
                  <div className="credits">
                    <Link to="/credits">
                      <span className="credit-amount">{credits}</span>
                      <span className="credit-label">Credits</span>
                    </Link>
                  </div>
                  {apiKey && (
                    <div className="api-key-display">
                      <span className="api-key-label">API Key:</span>
                      <span className="api-key-value">{`${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`}</span>
                    </div>
                  )}
                </div>
                <div className="auth-buttons">
                  <Link to="/profile" className="btn btn-outline" onClick={() => setMobileMenuOpen(false)}>Profile</Link>
                  <button className="btn btn-primary" onClick={handleSignOut}>Sign Out</button>
                </div>
              </>
            ) : (
              <div className="auth-buttons">
                <Link to="/login" className="btn btn-outline" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header; 