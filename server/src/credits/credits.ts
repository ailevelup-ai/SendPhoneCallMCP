import { db } from '../db';

// Initialize credits table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS credits (
    session_id TEXT PRIMARY KEY,
    balance INTEGER NOT NULL DEFAULT 0,
    total_added INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

/**
 * Get the remaining credits for a session
 */
export async function getCreditsRemaining(sessionId: string): Promise<number> {
  try {
    const stmt = db.prepare('SELECT balance FROM credits WHERE session_id = ?');
    const result = stmt.get(sessionId);
    
    if (!result) {
      // If no record exists, create one with initial credits
      const initialCredits = 10; // Provide some initial credits
      await initializeCredits(sessionId, initialCredits);
      return initialCredits;
    }
    
    return result.balance;
  } catch (error) {
    console.error('Error getting credits:', error);
    throw new Error(`Failed to get credits: ${error.message}`);
  }
}

/**
 * Get all credit information for a session
 */
export async function getAllCredits(sessionId: string): Promise<{
  balance: number;
  totalAdded: number;
  totalUsed: number;
  lastUpdated: string;
}> {
  try {
    const stmt = db.prepare('SELECT * FROM credits WHERE session_id = ?');
    const result = stmt.get(sessionId);
    
    if (!result) {
      // If no record exists, create one with initial credits
      const initialCredits = 10; // Provide some initial credits
      await initializeCredits(sessionId, initialCredits);
      
      return {
        balance: initialCredits,
        totalAdded: initialCredits,
        totalUsed: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    return {
      balance: result.balance,
      totalAdded: result.total_added,
      totalUsed: result.total_used,
      lastUpdated: result.updated_at
    };
  } catch (error) {
    console.error('Error getting all credits:', error);
    throw new Error(`Failed to get all credit info: ${error.message}`);
  }
}

/**
 * Initialize credits for a new session
 */
export async function initializeCredits(sessionId: string, initialBalance: number): Promise<void> {
  try {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO credits (session_id, balance, total_added, total_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(sessionId, initialBalance, initialBalance, 0, now, now);
  } catch (error) {
    console.error('Error initializing credits:', error);
    throw new Error(`Failed to initialize credits: ${error.message}`);
  }
}

/**
 * Use credits for a call
 */
export async function useCredits(sessionId: string, amount: number): Promise<boolean> {
  try {
    // Get current balance
    const currentBalance = await getCreditsRemaining(sessionId);
    
    // Check if there are enough credits
    if (currentBalance < amount) {
      return false;
    }
    
    // Update credits
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE credits
      SET balance = balance - ?, total_used = total_used + ?, updated_at = ?
      WHERE session_id = ?
    `);
    
    stmt.run(amount, amount, now, sessionId);
    return true;
  } catch (error) {
    console.error('Error using credits:', error);
    throw new Error(`Failed to use credits: ${error.message}`);
  }
}

/**
 * Add credits to a session
 */
export async function addCredits(sessionId: string, amount: number): Promise<void> {
  try {
    const now = new Date().toISOString();
    
    // Check if credits record exists
    const existing = await getCreditsRemaining(sessionId).catch(() => null);
    
    if (existing !== null) {
      // Update existing record
      const stmt = db.prepare(`
        UPDATE credits
        SET balance = balance + ?, total_added = total_added + ?, updated_at = ?
        WHERE session_id = ?
      `);
      
      stmt.run(amount, amount, now, sessionId);
    } else {
      // Create new record
      await initializeCredits(sessionId, amount);
    }
  } catch (error) {
    console.error('Error adding credits:', error);
    throw new Error(`Failed to add credits: ${error.message}`);
  }
}

/**
 * Transfer credits between sessions
 */
export async function transferCredits(
  fromSessionId: string,
  toSessionId: string,
  amount: number
): Promise<boolean> {
  try {
    // Get current balance of sender
    const fromBalance = await getCreditsRemaining(fromSessionId);
    
    // Check if sender has enough credits
    if (fromBalance < amount) {
      return false;
    }
    
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      const now = new Date().toISOString();
      
      // Deduct from sender
      const deductStmt = db.prepare(`
        UPDATE credits
        SET balance = balance - ?, total_used = total_used + ?, updated_at = ?
        WHERE session_id = ?
      `);
      
      deductStmt.run(amount, amount, now, fromSessionId);
      
      // Add to receiver
      const receiverExists = await getCreditsRemaining(toSessionId).catch(() => null);
      
      if (receiverExists !== null) {
        // Update existing receiver
        const addStmt = db.prepare(`
          UPDATE credits
          SET balance = balance + ?, total_added = total_added + ?, updated_at = ?
          WHERE session_id = ?
        `);
        
        addStmt.run(amount, amount, now, toSessionId);
      } else {
        // Create new receiver record
        await initializeCredits(toSessionId, amount);
      }
      
      // Commit transaction
      db.exec('COMMIT');
      return true;
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error transferring credits:', error);
    throw new Error(`Failed to transfer credits: ${error.message}`);
  }
} 