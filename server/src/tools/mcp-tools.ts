import { makeCall } from "../bland-api/api";
import { getAllCredits, getCreditsRemaining, transferCredits } from "../credits/credits";
import { CallStatus, CallStatusReport, db } from "../db";

// Define tools array
const tools: Array<{
  name: string;
  description: string;
  parameters: any;
  handler: (args: any, sessionId: string) => Promise<any>;
}> = [];

tools.push({
  name: "makePhoneCall",
  description:
    "Make a phone call to the given phone number with the given task. A task is a description of what the AI should do on this call, in the form of a prompt.",
  parameters: {
    type: "object",
    properties: {
      phoneNumber: {
        type: "string",
        description: "Phone number to call, must be in E.164 format (e.g., +12125551234)",
      },
      task: {
        type: "string",
        description:
          "Task for the AI to complete in the form of a prompt. What should the AI do on this call?",
      },
      voice: {
        type: "string",
        description: "Voice ID to use for this call",
      },
      maxDuration: {
        type: "number",
        default: 300,
        description: "Maximum duration of the call in seconds. Default is 300 seconds (5 minutes).",
      },
      temperature: {
        type: "number",
        default: 1,
        description: "Temperature for the AI. Higher values make the AI more creative but less predictable.",
      },
      model: {
        type: "string",
        default: "turbo",
        description: "Model to use for the call. Defaults to 'turbo'.",
      },
    },
    required: ["phoneNumber", "task", "voice"],
  },
  handler: async (args: any, sessionId: string) => {
    // Implementation of the makePhoneCall handler
    console.log("Making phone call with parameters:", args);
    
    // Validate phone number format
    if (!args.phoneNumber.startsWith('+')) {
      throw new Error("Phone number must be in E.164 format (e.g., +12125551234)");
    }
    
    try {
      // Call the Bland API to initiate the call
      const callResult = await makeCall({
        phoneNumber: args.phoneNumber,
        task: args.task,
        voiceId: args.voice,
        maxDuration: args.maxDuration || 300,
        temperature: args.temperature || 1,
        model: args.model || 'turbo',
        sessionId
      });
      
      return callResult;
    } catch (error) {
      console.error("Error making phone call:", error);
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  },
});

tools.push({
  name: "getCallHistory",
  description: "Get a list of calls made by the authenticated user.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        default: 50,
        description: "Maximum number of calls to return. Default is 50.",
      },
      offset: {
        type: "number",
        default: 0,
        description: "Offset for pagination. Default is 0.",
      },
      status: {
        type: "string",
        enum: ["completed", "failed", "in-progress"],
        description: "Filter by call status. Optional.",
      },
    },
  },
  handler: async (args: any, sessionId: string) => {
    try {
      console.log("Getting call history", { args, sessionId });
      
      // Extract parameters with defaults
      const limit = args.limit || 50;
      const offset = args.offset || 0;
      
      // Build the query
      let query = db.prepare(`
        SELECT * FROM calls
        WHERE session_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      
      // If status filter is provided, filter by status
      if (args.status) {
        query = db.prepare(`
          SELECT * FROM calls
          WHERE session_id = ? AND status = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `);
        
        const calls = query.all(sessionId, args.status, limit, offset);
        return { calls };
      }
      
      const calls = query.all(sessionId, limit, offset);
      return { calls };
    } catch (error) {
      console.error("Error getting call history:", error);
      throw new Error(`Failed to retrieve call history: ${error.message}`);
    }
  },
});

// Export the tools array
export default tools; 