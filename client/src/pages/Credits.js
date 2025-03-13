import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import axios from 'axios';

const Credits = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { supabase } = useSupabase();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [userCredits, setUserCredits] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [usageHistory, setUsageHistory] = useState([]);
  
  // Credit packages
  const creditPackages = [
    { id: 'basic', name: 'Basic', credits: 50, price: 25, popular: false },
    { id: 'standard', name: 'Standard', credits: 100, price: 45, popular: true },
    { id: 'premium', name: 'Premium', credits: 250, price: 100, popular: false },
    { id: 'enterprise', name: 'Enterprise', credits: 1000, price: 350, popular: false },
  ];
  
  // Fetch user data and transaction history on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        navigate('/login');
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Fetch user credits from Supabase
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('credits')
          .eq('id', user.id)
          .single();
          
        if (userError) throw userError;
        
        if (userData) {
          setUserCredits(userData.credits || 0);
        }
        
        // Fetch transaction history
        const { data: transactions, error: transactionError } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (transactionError) throw transactionError;
        
        setTransactionHistory(transactions || []);
        
        // Fetch usage history
        const { data: usage, error: usageError } = await supabase
          .from('api_usage')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
          
        if (usageError) throw usageError;
        
        setUsageHistory(usage || []);
        
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load user data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, [user, supabase, navigate]);
  
  // Handle package selection
  const handlePackageSelect = (packageId) => {
    setSelectedPackage(packageId);
    setError(null);
  };
  
  // Handle payment method selection
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
  };
  
  // Handle credit purchase
  const handlePurchase = async () => {
    if (!selectedPackage) {
      setError('Please select a credit package');
      return;
    }
    
    setIsPurchasing(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Find selected package
      const packageData = creditPackages.find(pkg => pkg.id === selectedPackage);
      
      if (!packageData) {
        throw new Error('Invalid package selected');
      }
      
      // In a real application, this would integrate with a payment processor
      // For this demo, we'll simulate a successful payment
      
      // Simulate API call to process payment
      const response = await axios.post('/api/v1/credits/add', {
        packageId: selectedPackage,
        paymentMethod,
        amount: packageData.price,
        credits: packageData.credits,
      });
      
      // Update user credits
      setUserCredits(prev => prev + packageData.credits);
      
      // Add transaction to history
      const newTransaction = {
        id: `txn_${Date.now()}`,
        user_id: user.id,
        amount: packageData.price,
        credits: packageData.credits,
        payment_method: paymentMethod,
        status: 'completed',
        created_at: new Date().toISOString(),
      };
      
      setTransactionHistory(prev => [newTransaction, ...prev]);
      
      // Show success message
      setSuccess(`Successfully purchased ${packageData.credits} credits!`);
      
      // Reset selection
      setSelectedPackage(null);
      
    } catch (error) {
      console.error('Error purchasing credits:', error);
      setError(error.response?.data?.message || error.message || 'Failed to process payment. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  if (isLoading) {
    return (
      <div className="credits-page loading">
        <div className="loading-spinner"></div>
        <p>Loading credits information...</p>
      </div>
    );
  }
  
  return (
    <div className="credits-page">
      <div className="page-header">
        <h1>Credits</h1>
        <p>Manage your credits and purchase more</p>
      </div>
      
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}
      
      <div className="credits-content">
        <div className="credits-overview">
          <div className="current-credits-card">
            <h2>Available Credits</h2>
            <div className="credits-amount">{userCredits}</div>
            <p className="credits-info">
              1 credit = 1 minute of call time
            </p>
          </div>
          
          <div className="credits-usage">
            <h3>Recent Usage</h3>
            {usageHistory.length > 0 ? (
              <div className="usage-list">
                {usageHistory.map(usage => (
                  <div key={usage.id} className="usage-item">
                    <div className="usage-details">
                      <span className="usage-date">{formatDate(usage.created_at)}</span>
                      <span className="usage-type">{usage.type}</span>
                    </div>
                    <span className="usage-amount">-{usage.credits} credits</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No recent usage</p>
            )}
          </div>
        </div>
        
        <div className="purchase-credits">
          <h2>Purchase Credits</h2>
          
          <div className="package-selection">
            {creditPackages.map(pkg => (
              <div 
                key={pkg.id}
                className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''} ${pkg.popular ? 'popular' : ''}`}
                onClick={() => handlePackageSelect(pkg.id)}
              >
                {pkg.popular && <div className="popular-badge">Most Popular</div>}
                <h3>{pkg.name}</h3>
                <div className="package-credits">{pkg.credits} credits</div>
                <div className="package-price">${pkg.price}</div>
                <div className="package-value">
                  ${(pkg.price / pkg.credits).toFixed(2)} per credit
                </div>
              </div>
            ))}
          </div>
          
          {selectedPackage && (
            <div className="payment-section">
              <h3>Payment Method</h3>
              
              <div className="payment-methods">
                <div 
                  className={`payment-method ${paymentMethod === 'card' ? 'selected' : ''}`}
                  onClick={() => handlePaymentMethodChange('card')}
                >
                  <div className="payment-icon">💳</div>
                  <div className="payment-name">Credit Card</div>
                </div>
                
                <div 
                  className={`payment-method ${paymentMethod === 'paypal' ? 'selected' : ''}`}
                  onClick={() => handlePaymentMethodChange('paypal')}
                >
                  <div className="payment-icon">🅿️</div>
                  <div className="payment-name">PayPal</div>
                </div>
                
                <div 
                  className={`payment-method ${paymentMethod === 'crypto' ? 'selected' : ''}`}
                  onClick={() => handlePaymentMethodChange('crypto')}
                >
                  <div className="payment-icon">₿</div>
                  <div className="payment-name">Cryptocurrency</div>
                </div>
              </div>
              
              <button
                onClick={handlePurchase}
                className="btn btn-primary btn-lg"
                disabled={isPurchasing}
              >
                {isPurchasing ? 'Processing...' : 'Complete Purchase'}
              </button>
              
              <p className="payment-disclaimer">
                * This is a demo application. No actual payment will be processed.
              </p>
            </div>
          )}
        </div>
        
        <div className="transaction-history">
          <h2>Transaction History</h2>
          
          {transactionHistory.length > 0 ? (
            <div className="transaction-list">
              <div className="transaction-header">
                <span className="transaction-date-header">Date</span>
                <span className="transaction-details-header">Details</span>
                <span className="transaction-amount-header">Amount</span>
                <span className="transaction-status-header">Status</span>
              </div>
              
              {transactionHistory.map(transaction => (
                <div key={transaction.id} className="transaction-item">
                  <span className="transaction-date">
                    {formatDate(transaction.created_at)}
                  </span>
                  <span className="transaction-details">
                    {transaction.credits} credits
                    <small className="payment-method">
                      via {transaction.payment_method}
                    </small>
                  </span>
                  <span className="transaction-amount">
                    ${transaction.amount.toFixed(2)}
                  </span>
                  <span className={`transaction-status status-${transaction.status}`}>
                    {transaction.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No transaction history</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Credits; 