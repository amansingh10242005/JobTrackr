import { db } from "../config/firebase.js";
import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import cloudinary from "cloudinary";
import formidable from "formidable";
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: Verify JWT Token
const verifyToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing authorization header");

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization format");
  }

  const token = parts[1];
  
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Helper: Sanitize team data
const sanitizeTeam = (team) => {
  if (!team) return null;
  
  const sanitized = { ...team };
  
  // Convert Firestore Timestamps
  const dateFields = ["createdAt", "updatedAt"];
  dateFields.forEach((field) => {
    const val = sanitized[field];
    if (!val) return;

    if (typeof val.toDate === "function") {
      sanitized[field] = val.toDate().toISOString();
    } else if (val instanceof Date) {
      sanitized[field] = val.toISOString();
    } else if (typeof val === "string") {
      const parsed = new Date(val);
      sanitized[field] = isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } else if (val.seconds) {
      sanitized[field] = new Date(val.seconds * 1000).toISOString();
    }
  });

  return sanitized;
};

// ===========================
// TEAM MANAGEMENT
// ===========================

// Create Team
export const createTeam = async (req, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { name, description } = data;
    
    if (!name || name.trim().length === 0) {
      return { status: 400, body: { error: "Team name is required" } };
    }

    const teamId = uuidv4();
    const inviteToken = uuidv4();
    const now = new Date().toISOString();

    const teamData = {
      id: teamId,
      name: name.trim(),
      description: description?.trim() || "",
      owner: username,
      inviteToken,
      members: [{
        username,
        role: "owner",
        joinedAt: now,
        status: "active"
      }],
      // new helper field for efficient membership queries
      memberUsernames: [username],
      settings: {
        allowMemberInvites: true,
        defaultRole: "member"
      },
      createdAt: now,
      updatedAt: now
    };

    // Only add projectId if it exists and is not undefined
    if (data.projectId) {
      teamData.projectId = data.projectId;
    }



    await db.collection("teams").doc(teamId).set(teamData);

    return { 
      status: 201, 
      body: { 
        team: teamData,
        message: "Team created successfully"
      } 
    };
  } catch (error) {
    console.error("Error in createTeam:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    
    if (error.message.includes("Unauthorized") || error.message.includes("JWT") || error.message.includes("authorization")) {
      return { status: 401, body: { error: "Unauthorized: " + error.message } };
    }
    
    if (error.message.includes("JWT_SECRET")) {
      return { status: 500, body: { error: "Server configuration error: " + error.message } };
    }
    
    return { status: 500, body: { error: "Failed to create team: " + error.message } };
  }
};

// Get User's Teams
export const getTeams = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    // Find teams where user is a member
    const snapshot = await db.collection("teams")
  .where("memberUsernames", "array-contains", username)
  .get();

const teams = snapshot.docs.map((doc) => ({
  id: doc.id,
  ...sanitizeTeam(doc.data()),
}));


    return { 
      status: 200, 
      body: { 
        teams,
        count: teams.length
      } 
    };
  } catch (error) {
    console.error("Error in getTeams:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to fetch teams" } };
  }
};

// Get Team Details
export const getTeam = async (req, teamId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const teamDoc = await db.collection("teams").doc(teamId).get();
    
    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const team = sanitizeTeam(teamDoc.data());
    
    // Check if user is member
    const isMember = team.members.some(member => member.username === username);
    if (!isMember) {
      return { status: 403, body: { error: "Not authorized to access this team" } };
    }

    return { 
      status: 200, 
      body: { team } 
    };
  } catch (error) {
    console.error("Error in getTeam:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to fetch team" } };
  }
};

// ===========================
// TEAM INVITATIONS
// ===========================

// Invite Member to Team
export const inviteMember = async (req, teamId, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { email, role = "member" } = data;
    
    if (!email) {
      return { status: 400, body: { error: "Email is required" } };
    }

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    
    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const team = teamDoc.data();
    
    // Check if user has permission to invite
    const userMember = team.members.find(m => m.username === username);
    if (!userMember || (userMember.role !== "owner" && userMember.role !== "admin")) {
      return { status: 403, body: { error: "Not authorized to invite members" } };
    }

    // Check if user already exists
    const userQuery = await db.collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();

    if (userQuery.empty) {
  // Handle case: invited user not yet registered
  const invitationId = uuidv4();
  const pendingInvite = {
    id: invitationId,
    teamId,
    teamName: team.name,
    invitedBy: username,
    email: email.toLowerCase(),
    role,
    status: "pending",
    createdAt: new Date().toISOString(),
    isRegisteredUser: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
  };

  await db.collection("teamInvitations").doc(invitationId).set(pendingInvite);

  // Send invitation email anyway
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const joinLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}?invitationId=${invitationId}`;

    const mailOptions = {
      from: `"JobTrackr Teams" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `You’ve been invited to join ${team.name} on JobTrackr`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Team Invitation 🎉</h2>
          <p>Hello,</p>
          <p>You’ve been invited by ${username} to join the team <strong>${team.name}</strong> on JobTrackr.</p>
          <p><strong>Role:</strong> ${role}</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${joinLink}" 
              style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Join Team
            </a>
          </div>
          <p>This invitation will expire in 7 days.</p>
          <p style="color: #6b7280; font-size: 14px;">
            If you don’t yet have a JobTrackr account, you’ll be guided to create one first.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (emailError) {
    console.error("Failed to send invitation email to unregistered user:", emailError);
  }

  return {
    status: 200,
    body: { message: "Invitation sent to unregistered user (pending registration)" },
  };
}


    const invitedUser = userQuery.docs[0].data();
    
    // Check if user is already a member
    const isAlreadyMember = team.members.some(m => m.username === invitedUser.username);
    if (isAlreadyMember) {
      return { status: 400, body: { error: "User is already a team member" } };
    }

    // Create invitation
    const invitationId = uuidv4();
    const invitation = {
      id: invitationId,
      teamId,
      teamName: team.name,
      invitedBy: username,
      invitedTo: invitedUser.username,
      email: invitedUser.email,
      role,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    await db.collection("teamInvitations").doc(invitationId).set(invitation);

    // Send invitation email
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const joinLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}?invitationId=${invitationId}`;

      const mailOptions = {
        from: `"JobTrackr Teams" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `You've been invited to join ${team.name} on JobTrackr`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Team Invitation 🎉</h2>
            <p>Hello ${invitedUser.name || invitedUser.username},</p>
            <p>You've been invited by ${username} to join the team <strong>${team.name}</strong> on JobTrackr.</p>
            <p><strong>Role:</strong> ${role}</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${joinLink}" 
                style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Join Team
              </a>
            </div>
            <p>This invitation will expire in 7 days.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              If the button doesn't work, copy and paste this link in your browser:<br>
              ${joinLink}
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
    }

    return { 
      status: 201, 
      body: { 
        invitation: {
          id: invitationId,
          teamName: team.name,
          invitedTo: invitedUser.username,
          role,
          status: "pending"
        },
        message: "Invitation sent successfully"
      } 
    };
  } catch (error) {
    console.error("Error in inviteMember:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to send invitation" } };
  }
};

// Accept Team Invitation (via invitation document)
export const acceptInvitation = async (req, invitationId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const invitationRef = db.collection("teamInvitations").doc(invitationId);
    const invitationDoc = await invitationRef.get();
    
    if (!invitationDoc.exists) {
      return { status: 404, body: { error: "Invitation not found" } };
    }

    const invitation = invitationDoc.data();
    
    // Check if invitation is for this user
    if (invitation.invitedTo !== username && invitation.email !== decoded.email) {
  return { status: 403, body: { error: "Not authorized to accept this invitation" } };
}

    // Check if invitation is still valid
    if (invitation.status !== "pending") {
      return { status: 400, body: { error: "Invitation already used or expired" } };
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return { status: 400, body: { error: "Invitation has expired" } };
    }

    const teamRef = db.collection("teams").doc(invitation.teamId);
    const teamDoc = await teamRef.get();
    
    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const team = teamDoc.data();
    
    
// Add user to team members
const newMemberUsername = invitation.invitedTo || decoded.username; // prefer explicit invitedTo, fallback to logged-in username
const updatedMembers = [
  ...(team.members || []),
  {
    username: newMemberUsername,
    role: invitation.role || 'member',
    joinedAt: new Date().toISOString(),
    status: "active"
  }
];

// compute updated usernames (avoid duplicates)
const existingUsernames = Array.isArray(team.memberUsernames) ? [...team.memberUsernames] : [];
if (!existingUsernames.includes(newMemberUsername)) {
  existingUsernames.push(newMemberUsername);
}

await teamRef.update({
  members: updatedMembers,
  memberUsernames: existingUsernames,
  updatedAt: new Date().toISOString()
});



    // Update invitation status
    await invitationRef.update({
      status: "accepted",
      acceptedAt: new Date().toISOString()
    });

    // Create notification for team members
    const notification = {
      username: invitation.invitedBy,
      title: "Team Member Joined",
      message: `${username} has joined your team ${team.name}`,
      type: "success",
      actionUrl: `/teams/${invitation.teamId}`,
      createdAt: new Date().toISOString()
    };

    await db.collection("notifications").add(notification);

    return { 
      status: 200, 
      body: { 
        message: "Successfully joined the team",
        team: {
          id: invitation.teamId,
          name: team.name
        }
      } 
    };
  } catch (error) {
    console.error("Error in acceptInvitation:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to accept invitation" } };
  }
};

// Accept Team Invite Link (via inviteToken)
export const acceptInviteLink = async (req, inviteToken) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    console.log(`🔗 acceptInviteLink called with inviteToken: ${inviteToken}, username: ${username}`);

    // Find team by inviteToken
    const teamsSnapshot = await db.collection("teams")
      .where("inviteToken", "==", inviteToken)
      .limit(1)
      .get();

    console.log(`🔍 Teams found by inviteToken: ${teamsSnapshot.size}`);

    if (teamsSnapshot.empty) {
      console.log(`⚠️ No team found by inviteToken, trying as team ID...`);
      // Also try if inviteToken is actually a team ID (backward compatibility)
      const teamDoc = await db.collection("teams").doc(inviteToken).get();
      if (!teamDoc.exists) {
        console.error(`❌ Team not found with ID: ${inviteToken}`);
        return { status: 404, body: { error: "Invalid invite link - team not found" } };
      }
      const team = teamDoc.data();
      console.log(`✅ Found team by ID: ${teamDoc.id}, name: ${team.name}`);
      
      // Check if user is already a member
      const isAlreadyMember = team.memberUsernames && team.memberUsernames.includes(username);
      if (isAlreadyMember) {
        console.log(`ℹ️ User ${username} is already a member`);
        return { status: 400, body: { error: "You are already a member of this team" } };
      }

      // Add user to team
      const updatedMembers = [
        ...(team.members || []),
        {
          username: username,
          role: 'member',
          joinedAt: new Date().toISOString(),
          status: "active"
        }
      ];

      const existingUsernames = Array.isArray(team.memberUsernames) ? [...team.memberUsernames] : [];
      if (!existingUsernames.includes(username)) {
        existingUsernames.push(username);
      }

      console.log(`➕ Adding user ${username} to team ${teamDoc.id}`);
      await db.collection("teams").doc(teamDoc.id).update({
        members: updatedMembers,
        memberUsernames: existingUsernames,
        updatedAt: new Date().toISOString()
      });

      // Create notification for team owner
      if (team.owner) {
        const notification = {
          username: team.owner,
          title: "Team Member Joined",
          message: `${username} has joined your team ${team.name}`,
          type: "success",
          actionUrl: `/teams/${teamDoc.id}`,
          createdAt: new Date().toISOString()
        };
        await db.collection("notifications").add(notification);
      }

      console.log(`✅ Successfully added ${username} to team ${teamDoc.id}`);
      return { 
        status: 200, 
        body: { 
          message: "Successfully joined the team",
          team: {
            id: teamDoc.id,
            name: team.name
          }
        } 
      };
    }

    const teamDoc = teamsSnapshot.docs[0];
    const team = teamDoc.data();
    console.log(`✅ Found team by inviteToken: ${teamDoc.id}, name: ${team.name}`);

    // Check if user is already a member
    const isAlreadyMember = team.memberUsernames && team.memberUsernames.includes(username);
    if (isAlreadyMember) {
      console.log(`ℹ️ User ${username} is already a member`);
      return { status: 400, body: { error: "You are already a member of this team" } };
    }

    // Add user to team
    const updatedMembers = [
      ...(team.members || []),
      {
        username: username,
        role: 'member',
        joinedAt: new Date().toISOString(),
        status: "active"
      }
    ];

    const existingUsernames = Array.isArray(team.memberUsernames) ? [...team.memberUsernames] : [];
    if (!existingUsernames.includes(username)) {
      existingUsernames.push(username);
    }

    console.log(`➕ Adding user ${username} to team ${teamDoc.id}`);
    await db.collection("teams").doc(teamDoc.id).update({
      members: updatedMembers,
      memberUsernames: existingUsernames,
      updatedAt: new Date().toISOString()
    });

    // Create notification for team owner
    if (team.owner) {
      const notification = {
        username: team.owner,
        title: "Team Member Joined",
        message: `${username} has joined your team ${team.name}`,
        type: "success",
        actionUrl: `/teams/${teamDoc.id}`,
        createdAt: new Date().toISOString()
      };
      await db.collection("notifications").add(notification);
    }

    console.log(`✅ Successfully added ${username} to team ${teamDoc.id}`);
    return { 
      status: 200, 
      body: { 
        message: "Successfully joined the team",
        team: {
          id: teamDoc.id,
          name: team.name
        }
      } 
    };
  } catch (error) {
    console.error("Error in acceptInviteLink:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to accept invite link" } };
  }
};

// ===========================
// TEAM CHAT & COMMUNICATION
// ===========================

// Send Team Message
export const sendMessage = async (req, teamId, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { message, type = "text", attachments = [] } = data;
    const processedAttachments = attachments.map(a => ({
  name: a.name,
  type: a.type,
  size: a.size,
  url: a.url || null, // file download URL
}));
    
    if ((!message || message.trim().length === 0) &&
    (!attachments || attachments.length === 0)) {
  return { status: 400, body: { error: "Message or attachment is required" } };
}

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    
    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const team = teamDoc.data();
    
    // Check if user is member
    const isMember = team.members.some(member => member.username === username);
    if (!isMember) {
      return { status: 403, body: { error: "Not authorized to send messages in this team" } };
    }

    // ☁️ Handle Cloudinary File Uploads
let uploadedAttachments = [];

if (data.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
  for (const file of data.attachments) {
    try {
      // Upload to Cloudinary (auto-detects file type)
      const result = await cloudinary.v2.uploader.upload(file.url || file.tempFilePath, {
        resource_type: "auto",
        folder: `team-attachments/${teamId}`,
      });

      uploadedAttachments.push({
        name: file.name,
        url: result.secure_url,
        type: file.type,
        size: file.size,
      });
    } catch (uploadErr) {
      console.error("❌ Cloudinary upload failed:", uploadErr);
    }
  }
}


    const messageId = uuidv4();
const messageData = {
  id: messageId,
  teamId,
  sender: username,
  message: message && message.trim() ? message.trim() : "",
  type,
  attachments: Array.isArray(attachments)
    ? attachments.map(a => ({
        name: a.name?.trim() || "Unnamed File",
        url: a.url || null,
        type: a.type || "application/octet-stream",
        size: a.size || 0,
      }))
    : [],
  timestamp: new Date().toISOString(),
  readBy: [username], // optional: marks sender as having read it
};


    await db.collection("teamMessages").doc(messageId).set(messageData);

    // Create notifications for other team members
    const otherMembers = team.members.filter(m => m.username !== username);
    
    for (const member of otherMembers) {
      const notification = {
        username: member.username,
        title: "New Team Message",
        message: `${username} sent a message in ${team.name}`,
        type: "info",
        actionUrl: `/teams/${teamId}?tab=chat`,
        createdAt: new Date().toISOString()
      };
      await db.collection("notifications").add(notification);
    }

    return { 
      status: 201, 
      body: { 
        message: messageData,
        notification: "Message sent successfully"
      } 
    };
  } catch (error) {
    console.error("Error in sendMessage:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to send message" } };
  }
};

// ✅ Get Team Messages (Fixed Version)
export const getMessages = async (req, teamId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!teamId) {
      return { status: 400, body: { error: "Team ID required", messages: [] } };
    }

    // Check if team exists and user has access
    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found", messages: [] } };
    }

    const team = teamDoc.data();
    
    // Check if user is member using memberUsernames array for better performance
    const isMember = team.memberUsernames && team.memberUsernames.includes(username);
    if (!isMember) {
      return { status: 403, body: { error: "Not authorized to view messages", messages: [] } };
    }

    // Query teamMessages collection
    const messagesSnapshot = await db
      .collection("teamMessages")
      .where("teamId", "==", teamId)
      .orderBy("timestamp", "asc")
      .get();

    const messages = messagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ getMessages() fetched ${messages.length} messages for team ${teamId}`);

    return {
      status: 200,
      body: { messages }
    };
  } catch (error) {
    console.error("❌ Error in getMessages:", error);
    
    // Return empty messages array even on error to prevent frontend crashes
    return {
      status: 200, // Change to 200 to prevent frontend errors
      body: { 
        messages: [],
        error: "Failed to load messages, but continuing with empty list"
      }
    };
  }
};

// ===========================
// TASK COMMENTS
// ===========================

// Get Task Comments
export const getComments = async (req, teamId, taskId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!teamId || !taskId) {
      return { status: 400, body: { error: "Missing teamId or taskId" } };
    }

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const team = teamDoc.data();
    const isMember = team.members?.some(m => m.username === username);
    if (!isMember) {
      return { status: 403, body: { error: "Access denied" } };
    }

    // Fetch comments
    const commentsRef = db
      .collection("teams")
      .doc(teamId)
      .collection("tasks")
      .doc(taskId)
      .collection("comments");

    const snapshot = await commentsRef.orderBy("timestamp", "asc").get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { status: 200, body: { comments } };
  } catch (error) {
    console.error("Error in getComments:", error);
    return { status: 500, body: { error: "Failed to fetch comments" } };
  }
};

// Add Comment to Task
// In the addComment function, update the file upload section:
export const addComment = async (req, teamId, taskId, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;
    const { comment, mentions = [], attachments = [] } = data;

    if (!comment || !comment.trim()) {
      return { status: 400, body: { error: "Comment text is required" } };
    }

    const teamRef = db.collection("teams").doc(teamId);
    const teamDoc = await teamRef.get();

    if (!teamDoc.exists) {
      return { status: 404, body: { error: "Team not found" } };
    }

    const commentRef = db
      .collection("teams")
      .doc(teamId)
      .collection("tasks")
      .doc(taskId)
      .collection("comments")
      .doc();

    // Handle file attachments for comments (same as chat)
    let uploadedAttachments = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const file of attachments) {
        try {
          // For base64 files, upload to Cloudinary
          if (file.url && file.url.startsWith('data:')) {
            const result = await cloudinary.v2.uploader.upload(file.url, {
              resource_type: "auto",
              folder: `teams/${teamId}/tasks/${taskId}/comments`,
            });

            uploadedAttachments.push({
              name: file.name,
              url: result.secure_url,
              type: file.type,
              size: file.size,
            });
          } else if (file.url) {
            // If it's already a URL (from previous upload), use it directly
            uploadedAttachments.push(file);
          }
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload failed for comment attachment:", uploadErr);
          // Fallback: use the original file data
          uploadedAttachments.push(file);
        }
      }
    }

    const newComment = {
      id: commentRef.id,
      author: username,
      comment: comment.trim(),
      mentions,
      attachments: uploadedAttachments,
      timestamp: new Date().toISOString(),
    };

    await commentRef.set(newComment);

    return { status: 201, body: { comment: newComment } };
  } catch (error) {
    console.error("Error in addComment:", error);
    return { status: 500, body: { error: "Failed to add comment" } };
  }
};
// ===========================
// FILE UPLOAD FOR COMMENTS
// ===========================
export const uploadCommentFiles = async (req, teamId, taskId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    // ✅ Use formidable for multipart form-data
    const form = formidable({ multiples: true });

    return await new Promise((resolve, reject) => {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error("Formidable parse error:", err);
          return resolve({ status: 400, body: { error: "Invalid form data" } });
        }

        const uploadedFiles = [];
        const attachments = Array.isArray(files.attachments)
          ? files.attachments
          : files.attachments ? [files.attachments] : [];

        for (const file of attachments) {
          if (!file || !file.filepath) continue;

          try {
            // Upload to Cloudinary
            const result = await cloudinary.v2.uploader.upload(file.filepath, {
              folder: `teams/${teamId}/tasks/${taskId}`,
              resource_type: "auto",
            });

            uploadedFiles.push({
              id: uuidv4(),
              name: file.originalFilename || file.name || "Unnamed file",
              size: file.size || 0,
              type: file.mimetype || file.type || "application/octet-stream",
              url: result.secure_url,
            });
          } catch (uploadError) {
            console.error("Failed to upload file to Cloudinary:", uploadError);
            // Continue with other files even if one fails
          }
        }

        if (uploadedFiles.length === 0) {
          return resolve({
            status: 400,
            body: {
              error: "No files were successfully uploaded",
            },
          });
        }

        // Return uploaded files - they will be attached to comments when comments are created
        return resolve({
          status: 200,
          body: {
            success: true,
            message: "Files uploaded successfully",
            files: uploadedFiles,
          },
        });
      });
    });
  } catch (error) {
    console.error("Error in uploadCommentFiles:", error);
    return { status: 500, body: { error: "Failed to upload files" } };
  }
};
