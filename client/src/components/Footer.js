import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3>Bland.AI MCP</h3>
            <p>A management control panel for the Bland.AI phone call service. Make automated phone calls with AI.</p>
          </div>
          
          <div className="footer-section">
            <h3>Quick Links</h3>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/api-docs">API Documentation</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/call-history">Call History</Link></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h3>Support</h3>
            <ul>
              <li><a href="https://docs.bland.ai" target="_blank" rel="noopener noreferrer">Bland.AI Docs</a></li>
              <li><a href="https://github.com/ailevelup-ai/SendPhoneCallMCP" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a href="mailto:support@example.com">Contact Support</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {currentYear} Bland.AI MCP. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 