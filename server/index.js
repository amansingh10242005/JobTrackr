import http from "http";
import dotenv from "dotenv";
import { db } from "./config/firebase.js";
import { parse } from "url";
import { parseBody } from "./utils/parseBody.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  checkUsernameAvailability,
  getCurrentUser,
  updateUserProfile,
  searchUsers,
  getUserByUsername,
  getUserSettings,
  updateUserSettings,
  changePassword,
  send2FAOTP,
  verify2FA,
  verifyLogin2FA,
  sendDisable2FAOTP,
  disable2FA,
  logoutAllDevices,
  deleteAccount
} from "./controllers/userController.js";
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask,
  getTaskAnalytics 
} from "./controllers/taskController.js";
import { 
  getNotifications, 
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  sendEmailNotification
} from "./controllers/notificationController.js";
import { 
  getAuthUrl, 
  handleOAuthCallback,
  syncTaskToCalendar,
  removeTaskFromCalendar,
  getCalendarEvents,
  checkCalendarConnection
} from "./controllers/calendarController.js";
import {
  createTeam,
  getTeams,
  getTeam,
  inviteMember,
  acceptInvitation,
  sendMessage,
  getMessages,
  addComment,
  getComments,
  uploadCommentFiles,
  acceptInviteLink
} from "./controllers/teamController.js";

// Load environment variables FIRST
dotenv.config();

// ✅ Verify JWT Token for protected routes
const verifyToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing authorization header");

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization format");
  }

  const token = parts[1];
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not set in .env");
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  const { pathname } = parse(req.url, true);

  // Enhanced CORS configuration
  const origin = req.headers["origin"]; 
  const allowedOrigins = new Set([
    "https://job-trackr-dusky.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS, PUT");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Test route
    if (pathname === "/api/users/test" && req.method === "GET") {
      const testDoc = db.collection("test").doc("connection");
      await testDoc.set({ 
        message: "Firebase connected successfully 🚀",
        timestamp: new Date().toISOString()
      });
      const doc = await testDoc.get();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(doc.data()));
      return;
    }

    // Health check
    if (pathname === "/api/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        service: "JobTrackr API"
      }));
      return;
    }

    // ========== USER ROUTES ==========
    if (pathname === "/api/users/register" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await registerUser(data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/login" && req.method === "POST") {
      try {
        console.log("🔐 Login request received");
        const data = await parseBody(req);
        console.log("✅ Request body parsed successfully");
        const result = await loginUser(data);
        console.log(`📤 Login response status: ${result.status}`);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
        return;
      } catch (error) {
        console.error("❌ Login route error:", error);
        try {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message || "Login failed" }));
        } catch (responseError) {
          console.error("❌ Failed to send error response:", responseError);
        }
        return;
      }
    }

    if (pathname === "/api/users/verify-login-2fa" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await verifyLogin2FA(data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/forgot-password" && req.method === "POST") {
      try {
        console.log("🔐 Forgot password request received");
        const data = await parseBody(req);
        console.log("✅ Request body parsed successfully");
        const result = await forgotPassword(data);
        console.log(`📤 Forgot password response status: ${result.status}`);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
        return;
      } catch (error) {
        console.error("❌ Forgot password route error:", error);
        try {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message || "Failed to process reset request" }));
        } catch (responseError) {
          console.error("❌ Failed to send error response:", responseError);
        }
        return;
      }
    }

    if (pathname === "/api/users/reset-password" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await resetPassword(data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/verify-email" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await verifyEmail(data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/check-username" && req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const username = url.searchParams.get("username");
      const result = await checkUsernameAvailability({ username });
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/me" && req.method === "GET") {
      const result = await getCurrentUser(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/profile" && req.method === "PATCH") {
      const data = await parseBody(req);
      const result = await updateUserProfile(req, data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/users/search" && req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const query = { q: url.searchParams.get("q") };
      const result = await searchUsers(req, query);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    // FIXED CODE:
if (pathname.startsWith("/api/users/") && req.method === "GET") {
  const username = pathname.split("/").pop();
  if (!["me", "search", "register", "login", "forgot-password", "reset-password", "verify-email", "check-username", "profile", "settings"].includes(username)) {
    const result = await getUserByUsername(req, username);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  }
}

    // ========== TASK ROUTES ==========
    if (pathname === "/api/tasks" && req.method === "GET") {
      const result = await getTasks(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/tasks" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await createTask(req, data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname.startsWith("/api/tasks/") && req.method === "PATCH") {
      const id = pathname.split("/").pop();
      const data = await parseBody(req);
      const result = await updateTask(req, id, data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname.startsWith("/api/tasks/") && req.method === "DELETE") {
      const id = pathname.split("/").pop();
      const result = await deleteTask(req, id);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/tasks/analytics" && req.method === "GET") {
      const result = await getTaskAnalytics(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    // ========== NOTIFICATION ROUTES ==========
    if (pathname === "/api/notifications" && req.method === "GET") {
      const result = await getNotifications(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/notifications" && req.method === "POST") {
      const data = await parseBody(req);
      const result = await createNotification(req, data);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (/^\/api\/notifications\/[^/]+\/read$/.test(pathname) && req.method === "POST") {
  const parts = pathname.split("/");
  const id = parts[3]; // ensures correct ID extraction
  const result = await markNotificationAsRead(req, id);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}


    if (pathname === "/api/notifications/mark-all-read" && req.method === "POST") {
      const result = await markAllNotificationsAsRead(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (/^\/api\/notifications\/[^/]+$/.test(pathname) && req.method === "DELETE") {
  const id = pathname.split("/")[3];
  const result = await deleteNotification(req, id);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}


    if (pathname === "/api/notifications/clear" && req.method === "POST") {
      const result = await clearAllNotifications(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/notifications/email" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await sendEmailNotification(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

    // ========== CALENDAR ROUTES ==========
    if (pathname === "/api/calendar/auth" && req.method === "GET") {
      const result = await getAuthUrl(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname === "/api/calendar/oauth2callback" && req.method === "GET") {
      const fullUrl = new URL(req.url, `http://${req.headers.host}`);
      const result = await handleOAuthCallback(req, fullUrl);

      if (result.status === 200 && result.body && result.body.html) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(result.body.html);
        return;
      } else {
        res.writeHead(result.status || 500, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body || { error: "OAuth callback failed" }));
        return;
      }
    }

    if (pathname.startsWith("/api/calendar/tasks/") && pathname.endsWith("/sync") && req.method === "POST") {
      const taskId = pathname.split("/")[4];
      const result = await syncTaskToCalendar(req, taskId);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if (pathname.startsWith("/api/calendar/tasks/") && pathname.endsWith("/unsync") && req.method === "POST") {
      const taskId = pathname.split("/")[4];
      const result = await removeTaskFromCalendar(req, taskId);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    if ((pathname === "/api/calendar/events" || pathname === "/api/calendar/events/") && req.method === "GET") {
      try {
        const result = await getCalendarEvents(req);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
      } catch (err) {
        console.error("Calendar events route error:", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch calendar events" }));
      }
      return;
    }

    // Fixed calendar connection route - removed username parameter
    if (pathname === "/api/calendar/connection" && req.method === "GET") {
      const result = await checkCalendarConnection(req);
      res.writeHead(result.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result.body));
      return;
    }

    // ADD these routes to index.js
if (pathname === "/api/users/settings" && req.method === "GET") {
  const result = await getUserSettings(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/users/settings" && req.method === "PUT") {
  const data = await parseBody(req);
  const result = await updateUserSettings(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// ========== TEAM ROUTES ==========
if (pathname === "/api/teams" && req.method === "GET") {
  const result = await getTeams(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/teams" && req.method === "POST") {
  try {
    const data = await parseBody(req);
    const result = await createTeam(req, data);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  } catch (error) {
    console.error("Error in /api/teams POST route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      error: "Failed to process request: " + error.message 
    }));
    return;
  }
}

if (pathname.startsWith("/api/teams/") && pathname.endsWith("/invite") && req.method === "POST") {
  const teamId = pathname.split("/")[3];
  const data = await parseBody(req);
  const result = await inviteMember(req, teamId, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname.startsWith("/api/invitations/") && pathname.endsWith("/accept") && req.method === "POST") {
  const invitationId = pathname.split("/")[3];
  const result = await acceptInvitation(req, invitationId);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Accept Team Invite Link (via inviteToken)
if (pathname.startsWith("/api/teams/invite-link/") && pathname.endsWith("/accept") && req.method === "POST") {
  try {
    const inviteToken = pathname.split("/")[4];
    if (!inviteToken) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invite token is required" }));
      return;
    }
    const result = await acceptInviteLink(req, inviteToken);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  } catch (error) {
    console.error("Error in invite link accept route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to accept invite link: " + error.message }));
    return;
  }
}

if (pathname.startsWith("/api/teams/") && pathname.endsWith("/messages") && req.method === "POST") {
  const teamId = pathname.split("/")[3];
  const data = await parseBody(req);
  const result = await sendMessage(req, teamId, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname.startsWith("/api/teams/") && pathname.endsWith("/messages") && req.method === "GET") {
  const teamId = pathname.split("/")[3];
  const result = await getMessages(req, teamId);

  res.writeHead(result.status, { "Content-Type": "application/json" });
  
  // Ensure consistent response format
  const responseBody = {
    messages: result.body?.messages || []
  };
  
  // Only include error if it exists and we're returning 200 status
  if (result.body?.error && result.status === 200) {
    responseBody.error = result.body.error;
  }
  
  res.end(JSON.stringify(responseBody));
  return;
}

if (pathname.startsWith("/api/teams/") && pathname.includes("/tasks/") && pathname.endsWith("/comments") && req.method === "GET") {
  const parts = pathname.split("/");
  const teamId = parts[3];
  const taskId = parts[5];
  const result = await getComments(req, teamId, taskId);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname.startsWith("/api/teams/") && pathname.includes("/tasks/") && pathname.endsWith("/comments") && req.method === "POST") {
  const parts = pathname.split("/");
  const teamId = parts[3];
  const taskId = parts[5];
  const data = await parseBody(req);
  const result = await addComment(req, teamId, taskId, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// ===========================
// FILE UPLOAD ROUTE (Comments)
// ===========================
if (pathname.startsWith("/api/teams/") && pathname.includes("/tasks/") && pathname.endsWith("/files") && req.method === "POST") {
  try {
    const parts = pathname.split("/");
    const teamId = parts[3];
    const taskId = parts[5];
    
    if (!teamId || !taskId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing teamId or taskId" }));
      return;
    }
    
    const result = await uploadCommentFiles(req, teamId, taskId);
    res.writeHead(result.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result.body));
    return;
  } catch (error) {
    console.error("Error in file upload route:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to upload files: " + error.message }));
    return;
  }
}

if (pathname.startsWith("/api/teams/") && req.method === "GET") {
  const teamId = pathname.split("/")[3];
  const result = await getTeam(req, teamId);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// ========== PROJECT ROUTES ==========
if (pathname === "/api/projects" && req.method === "GET") {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    
    console.log('🔍 [DEBUG] Fetching projects for user:', username);
    
    const url = new URL(req.url, `http://${req.headers.host}`);
    const teamId = url.searchParams.get("teamId");
    
    console.log('🔍 [DEBUG] Team ID from query:', teamId);
    
    let projectsQuery;
    
    if (teamId) {
      projectsQuery = db.collection("projects")
        .where("teamId", "==", teamId)
        .where("members", "array-contains", username);
    } else {
      projectsQuery = db.collection("projects")
        .where("members", "array-contains", username);
    }
    
    const snapshot = await projectsQuery.get();
    
    console.log(`🔍 [DEBUG] Firestore returned ${snapshot.docs.length} documents`);
    
    const projects = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`🔍 [DEBUG] Project: ${data.name}, Team: ${data.teamId}`);
      return {
        id: doc.id,
        ...data
      };
    });
    
    console.log(`✅ [DEBUG] Sending ${projects.length} projects to frontend`);
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ projects }));
  } catch (error) {
    console.error("❌ [DEBUG] Get projects error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to fetch projects" }));
  }
  return;
}

if (pathname.startsWith("/api/projects/") && req.method === "DELETE") {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    const projectId = pathname.split("/")[3];
    
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project not found" }));
      return;
    }
    
    const project = projectDoc.data();
    if (project.owner !== username) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Only project owner can delete project" }));
      return;
    }
    
    await db.collection("projects").doc(projectId).delete();
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      message: "Project deleted successfully",
      projectId 
    }));
  } catch (error) {
    console.error("Delete project error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete project" }));
  }
  return;
}

// Add project update route
if (pathname.startsWith("/api/projects/") && req.method === "PUT") {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    const projectId = pathname.split("/")[3];
    const data = await parseBody(req);
    
    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project not found" }));
      return;
    }
    
    const project = projectDoc.data();
    
    // Check if user has access to this project
    if (!project.members.includes(username)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authorized to modify this project" }));
      return;
    }
    
    // Update project
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    await projectRef.update(updateData);
    
    // Get updated project
    const updatedDoc = await projectRef.get();
    const updatedProject = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      project: updatedProject,
      message: "Project updated successfully" 
    }));
  } catch (error) {
    console.error("Update project error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to update project" }));
  }
  return;
}

if (pathname === "/api/auth/change-password" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await changePassword(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// ========== DELETE TEAM ROUTE ==========
if (pathname.startsWith("/api/teams/") && req.method === "DELETE") {
  try {
    const teamId = pathname.split("/")[3];
    const decoded = verifyToken(req);
    const username = decoded.username;

    console.log('🔍 [DEBUG] Deleting team:', teamId, 'by user:', username);

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    
    if (!teamDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Team not found" }));
      return;
    }

    const team = teamDoc.data();
    
    // Check if user is team owner
    const userMember = team.members.find(m => m.username === username);
    if (!userMember || userMember.role !== "owner") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Only team owner can delete the team" }));
      return;
    }

    // Delete the team
    await teamRef.delete();

    // Also delete all projects associated with this team
    const projectsSnapshot = await db.collection("projects")
      .where("teamId", "==", teamId)
      .get();
    
    const deletePromises = projectsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Delete team messages
    const messagesSnapshot = await db.collection("teamMessages")
      .where("teamId", "==", teamId)
      .get();
    
    const messageDeletePromises = messagesSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(messageDeletePromises);

    console.log('✅ [DEBUG] Team deleted successfully:', teamId);
    
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      message: "Team deleted successfully",
      teamId 
    }));
    
  } catch (error) {
    console.error("❌ [DEBUG] Delete team error:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete team" }));
  }
  return;
}

// 2FA Routes
if (pathname === "/api/auth/2fa/send-otp" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await send2FAOTP(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/verify" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await verify2FA(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/send-disable-otp" && req.method === "POST") {
  const result = await sendDisable2FAOTP(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/disable" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await disable2FA(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Logout all devices
if (pathname === "/api/auth/logout-all" && req.method === "POST") {
  const result = await logoutAllDevices(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Delete account
if (pathname === "/api/account/delete" && req.method === "DELETE") {
  const result = await deleteAccount(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// ADD this route to index.js (around line 400, after other project routes)
if (pathname.startsWith("/api/projects/") && pathname.includes("/tasks/") && req.method === "DELETE") {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    const parts = pathname.split("/");
    const projectId = parts[3];
    const taskId = parts[5];

    const projectRef = db.collection("projects").doc(projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project not found" }));
      return;
    }
    const project = projectDoc.data();
    if (!Array.isArray(project.members) || !project.members.includes(username)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authorized to modify this project" }));
      return;
    }

    const updatedTasks = (project.tasks || []).filter(task => task.id !== taskId);
    await projectRef.update({ tasks: updatedTasks, updatedAt: new Date().toISOString() });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Task deleted successfully", taskId }));
  } catch (error) {
    console.error("Delete task error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete task" }));
  }
  return;
}

// ========== TEAM PROJECT TASK ROUTES ==========
if (pathname.startsWith("/api/teams/") && pathname.includes("/projects/") && pathname.endsWith("/tasks") && req.method === "POST") {
  try {
    const parts = pathname.split("/");
    const teamId = parts[3];
    const projectId = parts[5];
    
    const data = await parseBody(req);
    
    console.log('🔍 [DEBUG] Creating team project task:', {
      teamId, projectId, data
    });

    // Verify team access first
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Team not found" }));
      return;
    }

    const team = teamDoc.data();
    const decoded = verifyToken(req);
    const username = decoded.username;
    
    // Check if user is team member
    const isMember = team.members.some(member => member.username === username);
    if (!isMember) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authorized to create tasks in this team" }));
      return;
    }

    // Verify project exists and belongs to team
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project not found" }));
      return;
    }

    const project = projectDoc.data();
    if (project.teamId !== teamId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project does not belong to this team" }));
      return;
    }

    // Create the task
    const taskId = uuidv4();
    const taskData = {
      id: taskId,
      teamId: teamId,
      projectId: projectId,
      title: data.title,
      description: data.description,
      assignedTo: data.assignedTo || [],
      dueDate: data.dueDate,
      priority: data.priority || "Medium",
      status: data.status || "todo",
      createdBy: username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('✅ [DEBUG] Task data to save:', taskData);

    // Update project's tasks array
    const updatedTasks = [...(project.tasks || []), taskData];
    await db.collection("projects").doc(projectId).update({
      tasks: updatedTasks,
      updatedAt: new Date().toISOString()
    });

    console.log('✅ [DEBUG] Task created successfully in project');

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      task: taskData,
      message: "Task created successfully"
    }));

  } catch (error) {
    console.error("❌ [DEBUG] Create team project task error:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to create task: " + error.message }));
  }
  return;
}

// ========== PROJECT CREATION ROUTE ==========
if (pathname === "/api/projects" && req.method === "POST") {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    const data = await parseBody(req);
    
    console.log('🔍 [DEBUG] Creating project with data:', data);
    
    const { name, description, teamId, teamName } = data;
    
    if (!name || !teamId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project name and team ID are required" }));
      return;
    }

    // Verify team access
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Team not found" }));
      return;
    }

    const team = teamDoc.data();
    const isMember = team.members.some(member => member.username === username);
    if (!isMember) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authorized to create projects in this team" }));
      return;
    }

    const projectId = uuidv4();
    const now = new Date().toISOString();
    
    const projectData = {
      id: projectId,
      name: name.trim(),
      description: description?.trim() || "",
      teamId: teamId,
      teamName: teamName || team.name,
      owner: username,
      members: [username],
      tasks: [],
      createdAt: now,
      updatedAt: now
    };

    await db.collection("projects").doc(projectId).set(projectData);

    console.log('✅ [DEBUG] Project created successfully:', projectId);
    
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      project: projectData,
      message: "Project created successfully" 
    }));
    
  } catch (error) {
    console.error("❌ [DEBUG] Create project error:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to create project" }));
  }
  return;
}

// Delete task from team project
if (pathname.startsWith("/api/teams/") && pathname.includes("/projects/") && pathname.includes("/tasks/") && req.method === "DELETE") {
  try {
    const parts = pathname.split("/");
    const teamId = parts[3];
    const projectId = parts[5];
    const taskId = parts[7];

    // Verify team access
    const teamDoc = await db.collection("teams").doc(teamId).get();
    if (!teamDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Team not found" }));
      return;
    }

    const team = teamDoc.data();
    const decoded = verifyToken(req);
    const username = decoded.username;
    
    // Check if user is team member
    const isMember = team.members.some(member => member.username === username);
    if (!isMember) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not authorized to delete tasks in this team" }));
      return;
    }

    // Verify project exists
    const projectDoc = await db.collection("projects").doc(projectId).get();
    if (!projectDoc.exists) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Project not found" }));
      return;
    }

    const project = projectDoc.data();
    
    // Remove task from project
    const updatedTasks = (project.tasks || []).filter(task => task.id !== taskId);
    await db.collection("projects").doc(projectId).update({
      tasks: updatedTasks,
      updatedAt: new Date().toISOString()
    });

    // Also delete from tasks collection if it exists there
    try {
      await db.collection("tasks").doc(taskId).delete();
    } catch (err) {
      console.log("Task not found in separate collection, continuing...");
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      message: "Task deleted successfully",
      taskId 
    }));

  } catch (error) {
    console.error("Delete team project task error:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to delete task" }));
  }
  return;
}

// ========== SETTINGS & SECURITY ROUTES ==========

// User Settings
if (pathname === "/api/users/settings" && req.method === "GET") {
  const result = await getUserSettings(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/users/settings" && req.method === "PUT") {
  const data = await parseBody(req);
  const result = await updateUserSettings(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Password Change
if (pathname === "/api/auth/change-password" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await changePassword(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// 2FA Routes
if (pathname === "/api/auth/2fa/send-otp" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await send2FAOTP(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/verify" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await verify2FA(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/send-disable-otp" && req.method === "POST") {
  const result = await sendDisable2FAOTP(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

if (pathname === "/api/auth/2fa/disable" && req.method === "POST") {
  const data = await parseBody(req);
  const result = await disable2FA(req, data);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Logout all devices
if (pathname === "/api/auth/logout-all" && req.method === "POST") {
  const result = await logoutAllDevices(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

// Delete account
if (pathname === "/api/account/delete" && req.method === "DELETE") {
  const result = await deleteAccount(req);
  res.writeHead(result.status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result.body));
  return;
}

  if (pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      message: "JobTrackr API",
      health: "ok",
      docs: "/api/health",
    }));
    return;
  }
  // ========== 404 HANDLER ==========
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ 
    message: "Route not found",
    path: pathname,
    method: req.method 
  }));
  } catch (error) {
    console.error("Server Error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ 
        message: "Internal server error", 
        error: process.env.NODE_ENV === "production" ? "Something went wrong" : error.message 
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`🚀 JobTrackr API server running on port ${PORT}`);
  console.log(`📊 Analytics endpoint: /api/tasks/analytics`);
  console.log(`🔐 Authentication endpoints: /api/users/*`);
  console.log(`📝 Task endpoints: /api/tasks/*`);
  console.log(`📅 Calendar endpoints: /api/calendar/*`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});
