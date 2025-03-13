import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import '../styles/CallHistory.css';

const CallHistory = () => {
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 0,
    limit: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    fromDate: '',
    toDate: '',
    phoneNumber: ''
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchCalls();
  }, [pagination.page, pagination.limit, sortBy, sortOrder]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      
      // Build the query
      let query = supabase
        .from('calls')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(
          pagination.page * pagination.limit, 
          (pagination.page * pagination.limit) + pagination.limit - 1
        );
      
      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.fromDate) {
        query = query.gte('created_at', filters.fromDate);
      }
      
      if (filters.toDate) {
        // Add one day to include the entire end date
        const nextDay = new Date(filters.toDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', nextDay.toISOString());
      }
      
      if (filters.phoneNumber) {
        query = query.ilike('phone_number', `%${filters.phoneNumber}%`);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setCalls(data || []);
      setPagination(prev => ({ ...prev, total: count || 0 }));
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const applyFilters = (e) => {
    e.preventDefault();
    // Reset to first page when applying filters
    setPagination(prev => ({ ...prev, page: 0 }));
    fetchCalls();
  };

  const resetFilters = () => {
    setFilters({
      status: '',
      fromDate: '',
      toDate: '',
      phoneNumber: ''
    });
    // Reset to first page
    setPagination(prev => ({ ...prev, page: 0 }));
    // Use setTimeout to ensure the state is updated before fetching
    setTimeout(() => fetchCalls(), 0);
  };

  const nextPage = () => {
    setPagination(prev => ({ ...prev, page: prev.page + 1 }));
  };

  const prevPage = () => {
    setPagination(prev => ({ ...prev, page: Math.max(0, prev.page - 1) }));
  };

  const SortIndicator = ({ field }) => {
    if (sortBy !== field) return null;
    return <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="call-history-container">
      <h1>Call History</h1>
      
      <div className="filters-container">
        <form onSubmit={applyFilters}>
          <div className="filters-grid">
            <div className="filter-item">
              <label>Status</label>
              <select 
                name="status" 
                value={filters.status} 
                onChange={handleFilterChange}
              >
                <option value="">All</option>
                <option value="initiated">Initiated</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div className="filter-item">
              <label>From Date</label>
              <input 
                type="date" 
                name="fromDate" 
                value={filters.fromDate} 
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-item">
              <label>To Date</label>
              <input 
                type="date" 
                name="toDate" 
                value={filters.toDate} 
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="filter-item">
              <label>Phone Number</label>
              <input 
                type="text" 
                name="phoneNumber" 
                value={filters.phoneNumber} 
                onChange={handleFilterChange}
                placeholder="Search phone number"
              />
            </div>
            
            <div className="filter-actions">
              <button type="submit" className="primary-btn">Apply Filters</button>
              <button type="button" className="secondary-btn" onClick={resetFilters}>Reset</button>
            </div>
          </div>
        </form>
      </div>
      
      {loading ? (
        <div className="loading">Loading call history...</div>
      ) : calls.length > 0 ? (
        <>
          <div className="calls-table-container">
            <table className="calls-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange('created_at')} className="sortable">
                    Date <SortIndicator field="created_at" />
                  </th>
                  <th onClick={() => handleSortChange('phone_number')} className="sortable">
                    Phone Number <SortIndicator field="phone_number" />
                  </th>
                  <th onClick={() => handleSortChange('status')} className="sortable">
                    Status <SortIndicator field="status" />
                  </th>
                  <th onClick={() => handleSortChange('duration')} className="sortable">
                    Duration <SortIndicator field="duration" />
                  </th>
                  <th onClick={() => handleSortChange('credits_used')} className="sortable">
                    Credits <SortIndicator field="credits_used" />
                  </th>
                  <th>Voice</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
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
                    <td>{call.voice}</td>
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
          
          <div className="pagination">
            <div className="pagination-info">
              Showing {pagination.page * pagination.limit + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.total)} of {pagination.total} calls
            </div>
            <div className="pagination-controls">
              <button 
                onClick={prevPage} 
                disabled={pagination.page === 0}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-page">Page {pagination.page + 1}</span>
              <button 
                onClick={nextPage} 
                disabled={(pagination.page + 1) * pagination.limit >= pagination.total}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="no-calls">
          <p>No calls found matching your criteria.</p>
          {Object.values(filters).some(val => val !== '') && (
            <button onClick={resetFilters} className="primary-btn">
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CallHistory; 