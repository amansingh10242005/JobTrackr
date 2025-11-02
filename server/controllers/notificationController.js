import { db } from "../config/firebase.js";
import jwt from "jsonwebtoken";

// ===========================
// Helper: Verify JWT Token
// ===========================
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

// ===========================
// Helper: Sanitize Notification Data
// ===========================
const sanitizeNotification = (notification) => {
  if (!notification) return null;
  
  const sanitized = { ...notification };
  
  // Convert Firestore Timestamps
  const dateFields = ["createdAt", "readAt"];
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
// GET NOTIFICATIONS
// ===========================
export const getNotifications = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const snapshot = await db.collection("notifications")
      .where("username", "==", username)
      .orderBy("createdAt", "desc")
      .limit(50) // Limit to recent 50 notifications
      .get();
    
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...sanitizeNotification(doc.data())
    }));

    const unreadCount = notifications.filter(n => !n.read).length;

    return { 
      status: 200, 
      body: { 
        notifications,
        unreadCount,
        total: notifications.length
      } 
    };
  } catch (error) {
    console.error("Error in getNotifications:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to fetch notifications" } };
  }
};

// ===========================
// CREATE NOTIFICATION
// ===========================
export const createNotification = async (req, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { title, message, type, actionUrl, priority } = data;
    
    if (!title || !message) {
      return { status: 400, body: { error: "Title and message are required" } };
    }

    const notification = {
      username,
      title: title.trim(),
      message: message.trim(),
      type: type || "info", // info, success, warning, error
      priority: priority || "medium", // low, medium, high
      actionUrl: actionUrl || null,
      read: false,
      createdAt: new Date().toISOString(),
      readAt: null,
    };

    const docRef = await db.collection("notifications").add(notification);
    
    return { 
      status: 201, 
      body: { 
        notification: { 
          id: docRef.id, 
          ...notification 
        },
        message: "Notification created successfully"
      } 
    };
  } catch (error) {
    console.error("Error in createNotification:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to create notification" } };
  }
};

// ===========================
// MARK NOTIFICATION AS READ
// ===========================
export const markNotificationAsRead = async (req, notificationId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!notificationId) {
      return { status: 400, body: { error: "Notification ID is required" } };
    }

    const notificationRef = db.collection("notifications").doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
  console.warn(`Notification not found: ${notificationId} for user: ${username}`);
  return { status: 404, body: { error: "Notification not found" } };
}

    const notification = notificationDoc.data();
    if (notification.username !== username) {
      return { status: 403, body: { error: "Not authorized to modify this notification" } };
    }

    await notificationRef.update({
      read: true,
      readAt: new Date().toISOString()
    });

    return { 
      status: 200, 
      body: { 
        message: "Notification marked as read",
        notificationId 
      } 
    };
  } catch (error) {
    console.error("Error in markNotificationAsRead:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to mark notification as read" } };
  }
};

// ===========================
// MARK ALL NOTIFICATIONS AS READ
// ===========================
export const markAllNotificationsAsRead = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const snapshot = await db.collection("notifications")
      .where("username", "==", username)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    const now = new Date().toISOString();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: now
      });
    });

    await batch.commit();

    return { 
      status: 200, 
      body: { 
        message: `Marked ${snapshot.size} notifications as read`,
        markedCount: snapshot.size
      } 
    };
  } catch (error) {
    console.error("Error in markAllNotificationsAsRead:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to mark all notifications as read" } };
  }
};

// ===========================
// DELETE NOTIFICATION
// ===========================
export const deleteNotification = async (req, notificationId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!notificationId) {
      return { status: 400, body: { error: "Notification ID is required" } };
    }

    const notificationRef = db.collection("notifications").doc(notificationId);
    const notificationDoc = await notificationRef.get();

    if (!notificationDoc.exists) {
  console.warn(`Notification not found: ${notificationId} for user: ${username}`);
  // Return success instead of error to prevent frontend issues
  return { 
    status: 200, 
    body: { 
      message: "Notification marked as read (was already processed)",
      notificationId 
    } 
  };
}

    const notification = notificationDoc.data();
    if (notification.username !== username) {
      return { status: 403, body: { error: "Not authorized to delete this notification" } };
    }

    await notificationRef.delete();

    return { 
      status: 200, 
      body: { 
        message: "Notification deleted successfully",
        notificationId 
      } 
    };
  } catch (error) {
    console.error("Error in deleteNotification:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to delete notification" } };
  }
};

// ===========================
// EMAIL NOTIFICATIONS
// ===========================

// Add this function to notificationController.js
export const sendEmailNotification = async (req, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { title, message, type = "task_status_change" } = data;
    
    if (!title || !message) {
      return { status: 400, body: { error: "Title and message are required" } };
    }

    // Get user email
    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = userDoc.data();
    
    // Import the email function (you'll need to adjust the import path)
    const { sendEmailNotification: sendEmail } = await import('./userController.js');
    
    const emailSent = await sendEmail(user.email, title, message);
    
    return { 
      status: 200, 
      body: { 
        message: "Email notification sent successfully",
        emailSent
      } 
    };
  } catch (error) {
    console.error("Error in sendEmailNotification:", error);
    return { status: 500, body: { error: "Failed to send email notification" } };
  }
};

// ===========================
// CLEAR ALL NOTIFICATIONS
// ===========================
export const clearAllNotifications = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const snapshot = await db.collection("notifications")
      .where("username", "==", username)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return { 
      status: 200, 
      body: { 
        message: `Cleared ${snapshot.size} notifications`,
        clearedCount: snapshot.size
      } 
    };
  } catch (error) {
    console.error("Error in clearAllNotifications:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to clear notifications" } };
  }
};