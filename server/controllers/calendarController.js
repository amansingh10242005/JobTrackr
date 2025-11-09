import { google } from "googleapis";
import { db } from "../config/firebase.js";
import jwt from "jsonwebtoken";

/**
 * Helper: verify incoming JWT from Authorization header
 */
const verifyToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing authorization header");

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization format");
  }

  const token = parts[1];
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Initialize OAuth2 client
 */
const getOAuth2Client = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.API_BASE_URL}/api/calendar/oauth2callback`
  );
};

/**
 * Get Google OAuth consent URL for a user.
 */
export const getAuthUrl = async (req) => {
  try {
    let decoded;
    try {
      decoded = verifyToken(req);
    } catch (err) {
      console.warn("⚠️ Missing or invalid token while fetching calendar events");
      return { status: 401, body: { error: "Unauthorized: Invalid or missing token" } };
    }

    const oauth2Client = getOAuth2Client();

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state: decoded.username, // Pass username as state for security
      include_granted_scopes: true
    });

    return { 
      status: 200, 
      body: { 
        url,
        message: "Google OAuth URL generated successfully"
      } 
    };
  } catch (err) {
    console.error("getAuthUrl error:", err);
    return { 
      status: 500, 
      body: { 
        error: "Failed to generate Google OAuth URL",
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      } 
    };
  }
};

/**
 * Handle OAuth2 callback (exchange code for tokens)
 */
export const handleOAuthCallback = async (req, urlObj) => {
  try {
    const code = urlObj.searchParams.get("code");
    const state = urlObj.searchParams.get("state"); // username from state
    const error = urlObj.searchParams.get("error");

    if (error) {
      return { 
        status: 400, 
        body: { 
          error: `OAuth authorization failed: ${error}` 
        } 
      };
    }

    if (!code) {
      return { 
        status: 400, 
        body: { 
          error: "Missing authorization code" 
        } 
      };
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return { 
        status: 400, 
        body: { 
          error: "Failed to obtain access token" 
        } 
      };
    }

    let username = state;
    
    // Fallback: try to extract username from ID token if state is missing
    if (!username && tokens.id_token) {
      try {
        const payload = jwt.decode(tokens.id_token);
        username = payload.email?.split('@')[0] || payload.sub;
      } catch (e) {
        console.warn("Could not extract username from ID token:", e);
      }
    }

    if (!username) {
      return { 
        status: 400, 
        body: { 
          error: "Unable to determine user account for Google Calendar integration" 
        } 
      };
    }

    // Verify user exists
    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return { 
        status: 404, 
        body: { 
          error: "User account not found" 
        } 
      };
    }

    // Store Google tokens
    const googleData = {
      tokens: {
        ...tokens,
        expiry_date: tokens.expiry_date || (Date.now() + (tokens.expires_in * 1000))
      },
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await userRef.update({
      google: googleData,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Google Calendar connected for user: ${username}`);

    return {
      status: 200,
      body: {
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Google Calendar Connected - JobTrackr</title>
              <style>
                  body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      margin: 0;
                      padding: 0;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      color: white;
                  }
                  .container {
                      background: rgba(255, 255, 255, 0.1);
                      backdrop-filter: blur(10px);
                      padding: 3rem;
                      border-radius: 20px;
                      text-align: center;
                      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                      max-width: 500px;
                      width: 90%;
                  }
                  .success-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                  }
                  h1 {
                      margin: 0 0 1rem 0;
                      font-weight: 600;
                  }
                  p {
                      margin: 0 0 2rem 0;
                      opacity: 0.9;
                      line-height: 1.6;
                  }
                  .button {
                      background: white;
                      color: #667eea;
                      padding: 12px 30px;
                      text-decoration: none;
                      border-radius: 50px;
                      font-weight: 600;
                      transition: transform 0.2s, box-shadow 0.2s;
                      display: inline-block;
                  }
                  .button:hover {
                      transform: translateY(-2px);
                      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="success-icon">✅</div>
                  <h1>Google Calendar Connected!</h1>
                  <p>Your JobTrackr account has been successfully connected to Google Calendar. You can now close this window and return to the app.</p>
                  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}" class="button">Return to JobTrackr</a>
              </div>
              <script>
                  // Close window automatically after 3 seconds
                  setTimeout(() => {
                      window.close();
                  }, 3000);
              </script>
          </body>
          </html>
        `
      }
    };
  } catch (err) {
    console.error("OAuth callback error:", err);
    return { 
      status: 500, 
      body: { 
        error: "Failed to complete Google OAuth connection",
        details: process.env.NODE_ENV === "development" ? err.message : undefined
      } 
    };
  }
};

/**
 * Build an OAuth2 client with stored tokens for a user
 */
const getAuthClientForUser = async (username) => {
  const userDoc = await db.collection("users").doc(username).get();
  if (!userDoc.exists) {
    throw new Error("User not found");
  }

  const user = userDoc.data();
  if (!user.google || !user.google.tokens) {
    throw new Error("Google Calendar not connected for this user");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(user.google.tokens);

  // Check if token needs refresh
  if (user.google.tokens.expiry_date && Date.now() > user.google.tokens.expiry_date - 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored tokens
      await db.collection("users").doc(username).update({
        'google.tokens': credentials,
        'google.updatedAt': new Date().toISOString()
      });
      
      oauth2Client.setCredentials(credentials);
      console.log(`✅ Refreshed Google token for user: ${username}`);
    } catch (refreshError) {
      console.error(`❌ Failed to refresh Google token for ${username}:`, refreshError);
      throw new Error("Google token refresh failed");
    }
  }

  return oauth2Client;
};

/**
 * Create or update a Google Calendar event for a task.
 */
export const createOrUpdateEventForTask = async (task, username) => {
  try {
    const oauth2Client = await getAuthClientForUser(username).catch(() => null);
    if (!oauth2Client) {
      return { ok: false, reason: "google_not_connected" };
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    if (!task.due) {
      return { ok: false, reason: "no_due_date" };
    }

    const dueDate = new Date(task.due);
    if (isNaN(dueDate.getTime())) {
      return { ok: false, reason: "invalid_due_date" };
    }

    // Determine if it's an all-day event
    const isAllDay = task.due.length === 10 || /^\d{4}-\d{2}-\d{2}$/.test(task.due);

    let start, end;
    if (isAllDay) {
      const yyyy = dueDate.getFullYear();
      const mm = String(dueDate.getMonth() + 1).padStart(2, "0");
      const dd = String(dueDate.getDate()).padStart(2, "0");
      start = { date: `${yyyy}-${mm}-${dd}` };

      const nextDay = new Date(dueDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const yyyy2 = nextDay.getFullYear();
      const mm2 = String(nextDay.getMonth() + 1).padStart(2, "0");
      const dd2 = String(nextDay.getDate()).padStart(2, "0");
      end = { date: `${yyyy2}-${mm2}-${dd2}` };
    } else {
      start = { dateTime: dueDate.toISOString() };
      const endDate = new Date(dueDate);
      endDate.setHours(endDate.getHours() + 1);
      end = { dateTime: endDate.toISOString() };
    }

    const eventBody = {
      summary: task.title || "Untitled Task",
      description: task.description || `Category: ${task.category}\nPriority: ${task.priority}\nStatus: ${task.status}`,
      start,
      end,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 1440 } // 24 hours
        ]
      }
    };

    let eventId = task.googleEventId;

    // Update existing event or create new one
    if (eventId) {
      try {
        const res = await calendar.events.patch({
          calendarId: "primary",
          eventId: eventId,
          requestBody: eventBody
        });
        console.log(`✅ Updated Google Calendar event for task: ${task.id}`);
        return { ok: true, eventId: res.data.id, updated: true };
      } catch (updateError) {
        console.warn("Failed to update event, will attempt create:", updateError.message);
        eventId = null; // Clear event ID to force create
      }
    }

    // Create new event
    if (!eventId) {
      const created = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventBody
      });

      eventId = created.data.id;

      // Update task with new event ID
      await db.collection("tasks").doc(task.id).update({ 
        googleEventId: eventId,
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Created Google Calendar event for task: ${task.id}`);
      return { ok: true, eventId, created: true };
    }
  } catch (err) {
    console.error("createOrUpdateEventForTask error:", err);
    return { ok: false, reason: err.message || "unknown_error" };
  }
};

/**
 * Delete Google Calendar event for a task.
 */
export const deleteEventForTask = async (taskId, username, googleEventId) => {
  try {
    if (!googleEventId) {
      return { ok: false, reason: "no_event_id" };
    }

    const oauth2Client = await getAuthClientForUser(username).catch(() => null);
    if (!oauth2Client) {
      return { ok: false, reason: "google_not_connected" };
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    
    await calendar.events.delete({ 
      calendarId: "primary", 
      eventId: googleEventId 
    });

    // Remove googleEventId from Firestore
    await db.collection("tasks").doc(taskId).update({ 
      googleEventId: null,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Deleted Google Calendar event for task: ${taskId}`);
    return { ok: true };
  } catch (err) {
    console.error("deleteEventForTask error:", err);
    return { ok: false, reason: err.message || "unknown_error" };
  }
};

/**
 * Check if user has Google Calendar connected
 */
export const checkCalendarConnection = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = userDoc.data();
    const connected = !!(user.google && user.google.tokens);
    
    return { 
      status: 200, 
      body: { 
        connected,
        connectedAt: connected ? user.google.connectedAt : null
      } 
    };
  } catch (error) {
    console.error("checkCalendarConnection error:", error);
    return { 
      status: 500, 
      body: { 
        error: "Failed to check calendar connection",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      } 
    };
  }
};

/**
 * Sync task to Google Calendar
 */
import { parseBody } from "../utils/parseBody.js"; // ⬅️ add this at top if not already

export const syncTaskToCalendar = async (req, taskId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    // ✅ Parse body to get extra fields like 'time'
    let bodyData = {};
    try {
      bodyData = await parseBody(req);
    } catch {
      bodyData = {};
    }

    // Get task from Firestore
    const taskDoc = await db.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return { status: 404, body: { error: "Task not found" } };
    }

    // Merge Firestore data with incoming body data
    const task = { id: taskDoc.id, ...taskDoc.data(), ...bodyData };

    // Verify task belongs to user
    if (task.username !== username) {
      return { status: 403, body: { error: "Not authorized to sync this task" } };
    }

    // Debug log to confirm merged data
    console.log("🧭 Syncing task with merged data:", task);

    const result = await createOrUpdateEventForTask(task, username);
    
    if (result.ok) {
      return { 
        status: 200, 
        body: { 
          message: "Task synced to Google Calendar successfully",
          eventId: result.eventId,
          synced: true
        } 
      };
    } else {
      return { 
        status: 400, 
        body: { 
          error: "Failed to sync task to Google Calendar",
          reason: result.reason
        } 
      };
    }
  } catch (error) {
    console.error("syncTaskToCalendar error:", error);
    return { 
      status: 500, 
      body: { 
        error: "Failed to sync task to Google Calendar",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      } 
    };
  }
};


/**
 * Remove task from Google Calendar
 */
export const removeTaskFromCalendar = async (req, taskId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    // Get task from Firestore
    const taskDoc = await db.collection("tasks").doc(taskId).get();
    if (!taskDoc.exists) {
      return { status: 404, body: { error: "Task not found" } };
    }

    const task = { id: taskDoc.id, ...taskDoc.data() };
    
    // Verify task belongs to user
    if (task.username !== username) {
      return { status: 403, body: { error: "Not authorized to modify this task" } };
    }

    if (!task.googleEventId) {
      return { status: 400, body: { error: "Task is not synced with Google Calendar" } };
    }

    const result = await deleteEventForTask(taskId, username, task.googleEventId);
    
    if (result.ok) {
      return { 
        status: 200, 
        body: { 
          message: "Task removed from Google Calendar successfully",
          removed: true
        } 
      };
    } else {
      return { 
        status: 400, 
        body: { 
          error: "Failed to remove task from Google Calendar",
          reason: result.reason
        } 
      };
    }
  } catch (error) {
    console.error("removeTaskFromCalendar error:", error);
    return { 
      status: 500, 
      body: { 
        error: "Failed to remove task from Google Calendar",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      } 
    };
  }
};

/**
 * Get calendar events for a date range
 */
export const getCalendarEvents = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    const startDate = startParam ? new Date(startParam) : new Date();
    const endDate = endParam ? new Date(endParam) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const oauth2Client = await getAuthClientForUser(username).catch(() => null);
    if (!oauth2Client) {
      return { status: 200, body: { events: [], message: "Google Calendar not connected" } };
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const events = await calendar.events.list({
      calendarId: "primary",
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const formattedEvents = events.data.items.map(event => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      start: event.start,
      end: event.end,
      type: 'google',
      htmlLink: event.htmlLink
    }));

    // Also get tasks for the same date range
    const tasksSnapshot = await db.collection("tasks")
      .where("username", "==", username)
      .where("due", ">=", startDate.toISOString())
      .where("due", "<=", endDate.toISOString())
      .get();

    const taskEvents = tasksSnapshot.docs.map(doc => {
      const task = doc.data();
      return {
        id: doc.id,
        title: task.title,
        description: task.description,
        start: { dateTime: task.due },
        end: { dateTime: new Date(new Date(task.due).getTime() + 60 * 60 * 1000).toISOString() }, // 1 hour duration
        type: 'task',
        task: task
      };
    });

    const allEvents = [...formattedEvents, ...taskEvents];

    return { 
      status: 200, 
      body: { 
        events: allEvents,
        count: allEvents.length
      } 
    };
  } catch (error) {
    console.error("getCalendarEvents error:", error);
    return { 
      status: 500, 
      body: { 
        error: "Failed to fetch calendar events",
        details: process.env.NODE_ENV === "development" ? error.message : undefined
      } 
    };
  }
};