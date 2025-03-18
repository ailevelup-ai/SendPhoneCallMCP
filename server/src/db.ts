import Database from 'better-sqlite3';
import path from 'path';

// Enum for call status
export enum CallStatus {
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Type for call status report
export interface CallStatusReport {
  callId: string;
  status: CallStatus;
  duration?: number;
  error?: string;
}

// Initialize database
const dbPath = path.resolve(__dirname, '../data/calls.db');
export const db = new Database(dbPath);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    task TEXT NOT NULL,
    voice_id TEXT NOT NULL,
    status TEXT NOT NULL,
    duration INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    error TEXT
  )
`);

/**
 * Insert a new call into the database
 */
export function insertCall(
  callId: string,
  sessionId: string,
  phoneNumber: string,
  task: string,
  voiceId: string
) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO calls (id, session_id, phone_number, task, voice_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(callId, sessionId, phoneNumber, task, voiceId, CallStatus.IN_PROGRESS, now, now);
  return { callId };
}

/**
 * Update the status of a call
 */
export function updateCallStatus(callId: string, status: CallStatus, duration?: number, error?: string) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE calls 
    SET status = ?, updated_at = ?, duration = ?, error = ?
    WHERE id = ?
  `);
  
  stmt.run(status, now, duration || null, error || null, callId);
  return { callId, status };
}

/**
 * Get a call by ID
 */
export function getCall(callId: string) {
  const stmt = db.prepare('SELECT * FROM calls WHERE id = ?');
  return stmt.get(callId);
}

/**
 * Get calls for a session
 */
export function getCallsForSession(sessionId: string, limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT * FROM calls 
    WHERE session_id = ? 
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(sessionId, limit, offset);
}

/**
 * Get calls for a session with a specific status
 */
export function getCallsForSessionWithStatus(
  sessionId: string, 
  status: CallStatus,
  limit = 50, 
  offset = 0
) {
  const stmt = db.prepare(`
    SELECT * FROM calls 
    WHERE session_id = ? AND status = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  return stmt.all(sessionId, status, limit, offset);
} 