/**
 * AWS Lambda function to periodically update call statuses
 * Runs on a schedule to check for pending call updates and fetch their current status
 */

const { supabase } = require('./lib/supabase');
const { logCallToGoogleSheets } = require('./services/google-sheets-logging');
const fetch = require('node-fetch');
const { lambdaWrapper } = require('../utils/lambda-wrapper');

const _update-call-statusHandler = async (event, context) => {
  console.log('Starting scheduled call status update');
  
  try {
    // Fetch calls that need updates (status is 'initiated' or 'in_progress')
    const { data: pendingCalls, error: fetchError } = await supabase
      .from('calls')
      .select('*')
      .in('status', ['initiated', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(100); // Process batches of 100 calls
    
    if (fetchError) {
      console.error('Error fetching pending calls:', fetchError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch pending calls' }) };

exports.handler = lambdaWrapper(_update-call-statusHandler);
    }
    
    console.log(`Found ${pendingCalls?.length || 0} calls to update`);
    
    if (!pendingCalls || pendingCalls.length === 0) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ message: 'No pending calls to update' })
      };
    }
    
    // Process each call
    const results = await Promise.all(
      pendingCalls.map(async (call) => {
        try {
          return await updateCallStatus(call);
        } catch (error) {
          console.error(`Error updating call ${call.call_id}:`, error);
          return {
            call_id: call.call_id,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    // Count successes and failures
    const successes = results.filter(r => r.success).length;
    const failures = results.filter(r => !r.success).length;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Updated ${successes} calls, ${failures} failures`,
        results
      })
    };
    
  } catch (error) {
    console.error('Error in scheduled task:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};

/**
 * Update the status of a specific call
 * @param {Object} call - The call record from the database
 * @returns {Promise<Object>} - Update result
 */
async function updateCallStatus(call) {
  console.log(`Updating status for call ${call.call_id}`);
  
  try {
    // Call ailevelup.AI API to get current status
    const response = await fetch(
      `${process.env.AILEVELUP_API_URL}/v1/calls/${call.call_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.AILEVELUP_ENTERPRISE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const apiData = await response.json();
    
    if (!response.ok) {
      console.error(`API error for call ${call.call_id}:`, apiData);
      return {
        call_id: call.call_id,
        success: false,
        error: apiData.message || 'API error'
      };
    }
    
    const callData = apiData.call || {};
    const newStatus = callData.status || 'unknown';
    
    // Only update if status has changed or there's new information
    if (
      call.status !== newStatus ||
      !call.duration ||
      !call.recording_url ||
      !call.concatenated_transcript
    ) {
      // Prepare data for update
      const updateData = {
        status: newStatus,
        duration: callData.call_length_seconds || call.duration,
        recording_url: callData.recording_url || call.recording_url,
        concatenated_transcript: callData.transcript || call.concatenated_transcript,
        answered_by: callData.answered_by || call.answered_by,
        call_ended_by: callData.call_ended_by || call.call_ended_by,
        updated_at: new Date().toISOString(),
        update_status: 'Updated'
      };
      
      // If call is completed, update additional fields
      if (newStatus === 'completed' && call.status !== 'completed') {
        updateData.credits_used = Math.ceil((callData.call_length_seconds || 0) / 60) || 1;
      }
      
      // Update the database
      const { error: updateError } = await supabase
        .from('calls')
        .update(updateData)
        .eq('call_id', call.call_id);
      
      if (updateError) {
        console.error(`Error updating call ${call.call_id} in database:`, updateError);
        return {
          call_id: call.call_id,
          success: false,
          error: updateError.message
        };
      }
      
      // Log update to Google Sheets
      await logCallToGoogleSheets({
        ...call,
        ...updateData
      });
      
      return {
        call_id: call.call_id,
        success: true,
        status: newStatus,
        previous_status: call.status
      };
    } else {
      // No update needed
      return {
        call_id: call.call_id,
        success: true,
        status: newStatus,
        no_change: true
      };
    }
  } catch (error) {
    console.error(`Error updating call ${call.call_id}:`, error);
    
    // Mark as failed in database if it's been stuck for too long
    const createdAt = new Date(call.created_at);
    const now = new Date();
    const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);
    
    // If call has been "initiated" or "in_progress" for over 24 hours, mark as failed
    if (hoursSinceCreation > 24) {
      await supabase
        .from('calls')
        .update({
          status: 'failed',
          error_message: 'Call update timed out after 24 hours',
          updated_at: now.toISOString(),
          update_status: 'Failed'
        })
        .eq('call_id', call.call_id);
    }
    
    return {
      call_id: call.call_id,
      success: false,
      error: error.message
    };
  }
} 