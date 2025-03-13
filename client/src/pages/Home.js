import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { user } = useAuth();
  
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>AI Phone Calls Made Simple</h1>
          <p className="hero-subtitle">
            Make automated phone calls powered by AI that sound natural and get results
          </p>
          
          <div className="hero-cta">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Get Started
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
        
        <div className="hero-image">
          {/* Placeholder for hero image */}
          <div className="placeholder-image">
            <div className="phone-illustration">
              <div className="phone-screen">
                <div className="call-animation">
                  <div className="call-wave"></div>
                  <div className="call-wave"></div>
                  <div className="call-wave"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="features-section">
        <h2>Powerful Features</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📞</div>
            <h3>Natural Voice Calls</h3>
            <p>
              Our AI makes phone calls that sound natural and conversational,
              with multiple voice options to choose from.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🧠</div>
            <h3>Advanced AI Models</h3>
            <p>
              Powered by state-of-the-art language models like GPT-4 and Claude,
              our AI can handle complex conversations.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Detailed Analytics</h3>
            <p>
              Track call performance, listen to recordings, and review transcripts
              to improve your results.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⚙️</div>
            <h3>Customizable Settings</h3>
            <p>
              Configure call parameters like duration, voicemail handling,
              and AI temperature to suit your needs.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>Call Transfers</h3>
            <p>
              Seamlessly transfer calls to a human when needed, ensuring
              important conversations are never missed.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure & Private</h3>
            <p>
              Your data is encrypted and handled securely, with privacy
              controls to protect sensitive information.
            </p>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2>How It Works</h2>
        
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Create an Account</h3>
            <p>
              Sign up for an account and receive credits to start making calls.
            </p>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <h3>Configure Your Call</h3>
            <p>
              Enter the phone number, describe what you want the AI to do,
              and customize settings.
            </p>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <h3>AI Makes the Call</h3>
            <p>
              Our AI calls the number and handles the conversation based on
              your instructions.
            </p>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <h3>Review Results</h3>
            <p>
              Listen to recordings, read transcripts, and analyze call performance.
            </p>
          </div>
        </div>
      </section>
      
      {/* Use Cases Section */}
      <section className="use-cases-section">
        <h2>Popular Use Cases</h2>
        
        <div className="use-cases-grid">
          <div className="use-case-card">
            <h3>Appointment Reminders</h3>
            <p>
              Remind customers of upcoming appointments and reduce no-shows.
            </p>
          </div>
          
          <div className="use-case-card">
            <h3>Lead Qualification</h3>
            <p>
              Screen potential leads to identify the most promising opportunities.
            </p>
          </div>
          
          <div className="use-case-card">
            <h3>Customer Surveys</h3>
            <p>
              Collect feedback and insights from customers through natural conversation.
            </p>
          </div>
          
          <div className="use-case-card">
            <h3>Order Confirmations</h3>
            <p>
              Verify order details and delivery preferences with customers.
            </p>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Get Started?</h2>
          <p>
            Create an account today and make your first AI phone call in minutes.
          </p>
          
          <div className="cta-buttons">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-lg">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-lg">
                  Sign Up Now
                </Link>
                <Link to="/login" className="btn btn-outline btn-lg">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 