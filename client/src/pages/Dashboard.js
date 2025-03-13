import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import DirectCallForm from '../components/DirectCallForm';
import '../styles/Dashboard.css';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dashboard = () => {
  const { user, apiKey, credits, refreshUserDetails } = useAuth();
  const { supabase } = useSupabase();
  const [recentCalls, setRecentCalls] = useState([]);
  const [callStats, setCallStats] = useState({ total: 0, completed: 0, failed: 0, initiated: 0 });
  const [loading, setLoading] = useState(true);
  const [apiUsage, setApiUsage] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // Add state for active tab

  useEffect(() => {
    refreshUserDetails();
    fetchDashboardData();
  }, []);

  // Handle successful call initiation
  const handleCallInitiated = (callData) => {
    // Refresh dashboard data to show the new call
    fetchDashboardData();
    
    // Set the active tab back to dashboard to show the updated stats
    setTimeout(() => {
      setActiveTab('dashboard');
    }, 2000);
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch recent calls
      const { data: calls, error: callsError } = await supabase
        .from('calls')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (callsError) throw callsError;
      setRecentCalls(calls || []);

      // Get call statistics
      const { data: statsData, error: statsError } = await supabase
        .from('calls')
        .select('status, count', { count: 'exact' })
        .eq('user_id', user.id)
        .group('status');

      if (statsError) throw statsError;

      // Process stats data
      const stats = {
        total: 0,
        completed: 0,
        failed: 0,
        initiated: 0
      };

      if (statsData && statsData.length > 0) {
        statsData.forEach(item => {
          stats.total += parseInt(item.count);
          if (item.status === 'completed') stats.completed = parseInt(item.count);
          else if (item.status === 'failed') stats.failed = parseInt(item.count);
          else if (item.status === 'initiated') stats.initiated = parseInt(item.count);
        });
      }

      setCallStats(stats);

      // Fetch API usage
      const { data: usageData, error: usageError } = await supabase
        .from('api_usage')
        .select('created_at, endpoint, credits_used')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (usageError) throw usageError;
      setApiUsage(usageData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data for call status
  const statusChartData = {
    labels: ['Completed', 'Failed', 'Initiated'],
    datasets: [
      {
        label: 'Calls by Status',
        data: [callStats.completed, callStats.failed, callStats.initiated],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for API usage chart (last 7 days)
  const getApiUsageChartData = () => {
    const last7Days = [];
    const labels = [];
    
    // Create date labels for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      labels.push(dateString);
      last7Days.push({ date: dateString, usage: 0 });
    }
    
    // Aggregate usage by day
    apiUsage.forEach(entry => {
      const entryDate = new Date(entry.created_at).toISOString().split('T')[0];
      const dayIndex = last7Days.findIndex(day => day.date === entryDate);
      if (dayIndex !== -1) {
        last7Days[dayIndex].usage += entry.credits_used || 0;
      }
    });
    
    return {
      labels: labels.map(date => {
        const d = new Date(date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
      }),
      datasets: [
        {
          label: 'Credits Used',
          data: last7Days.map(day => day.usage),
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1,
        },
      ],
    };
  };

  // Options for bar chart
  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Credits Used Last 7 Days',
      },
    },
  };

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-title">Dashboard</h1>
      
      {/* Add tabs for dashboard and direct call */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`tab-button ${activeTab === 'direct-call' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct-call')}
        >
          Make a Call
        </button>
      </div>
      
      {activeTab === 'dashboard' ? (
        // Dashboard content
        <>
          <div className="dashboard-stats">
            <div className="stat-card">
              <h3>Credits</h3>
              <div className="stat-value">{credits}</div>
              <Link to="/credits" className="action-link">Add Credits</Link>
            </div>
            
            <div className="stat-card">
              <h3>Total Calls</h3>
              <div className="stat-value">{callStats.total}</div>
              <Link to="/call-history" className="action-link">View All</Link>
            </div>
            
            <div className="stat-card">
              <h3>API Key</h3>
              <div className="stat-value api-key">
                {apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'None'}
              </div>
              <Link to="/profile" className="action-link">Manage</Link>
            </div>
          </div>
          
          <div className="dashboard-charts">
            <div className="chart-container">
              <h3>Call Status Distribution</h3>
              <div className="pie-chart">
                <Pie data={statusChartData} />
              </div>
            </div>
            
            <div className="chart-container">
              <h3>Recent API Usage</h3>
              <div className="bar-chart">
                <Bar data={getApiUsageChartData()} options={barChartOptions} />
              </div>
            </div>
          </div>
          
          <div className="recent-calls">
            <div className="section-header">
              <h3>Recent Calls</h3>
              <Link to="/call-history">View All</Link>
            </div>
            
            {recentCalls.length > 0 ? (
              <div className="calls-table-container">
                <table className="calls-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Phone Number</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Credits</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map((call) => (
                      <tr key={call.id}>
                        <td>{new Date(call.created_at).toLocaleString()}</td>
                        <td>{call.phone_number}</td>
                        <td>
                          <span className={`status-badge status-${call.status.toLowerCase()}`}>
                            {call.status}
                          </span>
                        </td>
                        <td>{call.duration || 0} min</td>
                        <td>{call.credits_used || 1}</td>
                        <td>
                          <Link to={`/call/${call.call_id}`} className="view-btn">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-calls">
                <p>You haven't made any calls yet.</p>
                <button 
                  className="primary-btn"
                  onClick={() => setActiveTab('direct-call')}
                >
                  Make Your First Call
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        // Direct call form
        <DirectCallForm onCallInitiated={handleCallInitiated} />
      )}
    </div>
  );
};

export default Dashboard; 