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
// Helper: Sanitize Firestore Data
// ===========================
const sanitizeTask = (task) => {
  if (!task) return null;
  const sanitized = { ...task };

  // Convert Firestore Timestamps or Dates to ISO
  const dateFields = ["due", "completedAt", "inProgressAt", "overdueAt", "createdAt", "updatedAt"];
  dateFields.forEach((field) => {
    const val = sanitized[field];
    if (!val) {
      sanitized[field] = null;
      return;
    }

    try {
      if (typeof val.toDate === "function") {
        // Firestore Timestamp
        sanitized[field] = val.toDate().toISOString();
      } else if (val instanceof Date) {
        // JavaScript Date object
        sanitized[field] = val.toISOString();
      } else if (typeof val === "string") {
        // ISO string - validate it
        const parsed = new Date(val);
        sanitized[field] = isNaN(parsed.getTime()) ? null : parsed.toISOString();
      } else if (val.seconds) {
        // Firestore Timestamp object
        sanitized[field] = new Date(val.seconds * 1000).toISOString();
      } else {
        sanitized[field] = null;
      }
    } catch (error) {
      console.warn(`Error parsing date field ${field}:`, error);
      sanitized[field] = null;
    }
  });

  // Default values and type safety
  sanitized.status = sanitized.status || "Active";
  sanitized.completed = Boolean(sanitized.completed);
  sanitized.priority = sanitized.priority || "Medium";
  sanitized.category = sanitized.category || "Uncategorized";
  sanitized.title = sanitized.title?.trim() || "Untitled Task";
  sanitized.description = sanitized.description?.trim() || "";
  sanitized.tags = Array.isArray(sanitized.tags) ? sanitized.tags : [];

  return sanitized;
};

// ===========================
// GET ALL TASKS
// ===========================
export const getTasks = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const snapshot = await db.collection("tasks")
      .where("username", "==", username)
      .orderBy("createdAt", "desc")
      .get();
    
    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...sanitizeTask(doc.data()),
    }));

    return { 
      status: 200, 
      body: { 
        tasks,
        count: tasks.length,
        message: tasks.length === 0 ? "No tasks found" : `Found ${tasks.length} tasks`
      } 
    };
  } catch (error) {
    console.error("Error in getTasks:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to fetch tasks" } };
  }
};

// ===========================
// CREATE TASK
// ===========================
export const createTask = async (req, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    const { title, description, category, priority, due, tags } = data;
    
    if (!title || title.trim().length === 0) {
      return { status: 400, body: { error: "Title is required" } };
    }

    const now = new Date().toISOString();
    
    // Validate and parse due date
    let dueDate = null;
    if (due) {
      try {
        dueDate = new Date(due).toISOString();
        if (isNaN(new Date(dueDate).getTime())) {
          dueDate = null;
        }
      } catch (error) {
        console.warn("Invalid due date provided:", due);
        dueDate = null;
      }
    }

    const newTask = {
      username,
      title: title.trim(),
      description: description?.trim() || "",
      category: category?.trim() || "Uncategorized",
      priority: priority || "Medium",
      due: dueDate,
      time: data.time || null,
      status: "Active",
      completed: false,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: now,
      updatedAt: now,
      inProgressAt: null,
      completedAt: null,
      overdueAt: null,
      googleEventId: null,
    };

    const docRef = await db.collection("tasks").add(newTask);
    const savedTask = { id: docRef.id, ...newTask };

    return { 
      status: 201, 
      body: { 
        task: savedTask,
        message: "Task created successfully"
      } 
    };
  } catch (error) {
    console.error("Error in createTask:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to create task" } };
  }
};

// ===========================
// UPDATE TASK
// ===========================
export const updateTask = async (req, taskId, data) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!taskId) {
      return { status: 400, body: { error: "Task ID is required" } };
    }

    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return { status: 404, body: { error: "Task not found" } };
    }

    const task = taskDoc.data();
    if (task.username !== username) {
      return { status: 403, body: { error: "Not authorized to update this task" } };
    }

    const now = new Date().toISOString();
    const updates = { 
      ...data, 
      updatedAt: now 
    };

    if (data.time !== undefined) {
  updates.time = data.time;
}

    // Remove fields that shouldn't be updated directly
    delete updates.id;
    delete updates.username;
    delete updates.createdAt;

    // Validate and parse due date if provided
    if (data.due !== undefined) {
      try {
        updates.due = data.due ? new Date(data.due).toISOString() : null;
        if (updates.due && isNaN(new Date(updates.due).getTime())) {
          updates.due = null;
        }
      } catch {
        updates.due = null;
      }
    }

    // Status-based timestamp logic
    if (data.status !== undefined) {
  const newStatus = data.status;
  const currentStatus = task.status;

  if (newStatus === "In Progress") {
    // Always mark inProgressAt (even for automatic transitions)
    updates.inProgressAt = now;
    updates.manualStatus = data.manualStatus !== undefined ? data.manualStatus : true;
  } else if (newStatus === "Completed" && currentStatus !== "Completed") {
    updates.completed = true;
    updates.completedAt = now;
    updates.manualStatus = data.manualStatus !== undefined ? data.manualStatus : true;
    if (!task.inProgressAt) {
      updates.inProgressAt = task.createdAt || now;
    }
  } else if (newStatus === "Overdue" && currentStatus !== "Overdue") {
    updates.overdueAt = now;
    updates.manualStatus = false; // Overdue should NOT be manual
  } else if (newStatus === "Active") {
    updates.completed = false;
    updates.completedAt = null;
    updates.overdueAt = null;
    updates.inProgressAt = null;
    updates.manualStatus = data.manualStatus !== undefined ? data.manualStatus : true;
  }
}


    // Handle explicit `completed` flag
    if (typeof data.completed === "boolean") {
      updates.completed = data.completed;
      if (data.completed && !task.completedAt) {
        updates.completedAt = now;
        updates.status = "Completed";
        if (!task.inProgressAt) {
          updates.inProgressAt = task.createdAt || now;
        }
      } else if (!data.completed) {
        updates.completedAt = null;
        updates.status = "Active";
        updates.overdueAt = null;
        updates.inProgressAt = null;
      }
    }

    // Handle tags
    if (data.tags !== undefined) {
      updates.tags = Array.isArray(data.tags) ? data.tags : [];
    }

    // Apply updates
    await taskRef.update(updates);

    // Fetch and sanitize updated document
    const updatedDoc = await taskRef.get();
    const updatedTask = sanitizeTask(updatedDoc.data());

    return {
      status: 200,
      body: {
        message: "Task updated successfully",
        task: { id: updatedDoc.id, ...updatedTask },
      },
    };
  } catch (error) {
    console.error("Error in updateTask:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to update task" } };
  }
};

// ===========================
// DELETE TASK
// ===========================
export const deleteTask = async (req, taskId) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    if (!taskId) {
      return { status: 400, body: { error: "Task ID is required" } };
    }

    const taskRef = db.collection("tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return { status: 404, body: { error: "Task not found" } };
    }

    const task = taskDoc.data();
    if (task.username !== username) {
      return { status: 403, body: { error: "Not authorized to delete this task" } };
    }

    // Delete task from Firestore
    await taskRef.delete();

    return { 
      status: 200, 
      body: { 
        message: "Task deleted successfully",
        taskId 
      } 
    };
  } catch (error) {
    console.error("Error in deleteTask:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to delete task" } };
  }
};

// ===========================
// GET TASK ANALYTICS
// ===========================
export const getTaskAnalytics = async (req) => {
  try {
    const decoded = verifyToken(req);
    const username = decoded.username;

    // Get all tasks for the user
    const snapshot = await db.collection("tasks")
      .where("username", "==", username)
      .get();
    
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...sanitizeTask(doc.data())
    }));

    // Analytics calculations
    const analytics = {
      summary: {
        total: tasks.length,
        completed: tasks.filter(t => t.completed).length,
        overdue: tasks.filter(t => t.status === "Overdue").length,
        inProgress: tasks.filter(t => t.status === "In Progress").length,
        active: tasks.filter(t => t.status === "Active").length,
      },
      statusDistribution: {},
      categoryDistribution: {},
      priorityDistribution: {},
      completionRate: 0,
      averageCompletionTime: 0,
      streak: 0,
      weeklyTrend: {},
      monthlyTrend: {},
    };

    // Calculate completion rate
    analytics.summary.completionRate = analytics.summary.total > 0 
      ? Math.round((analytics.summary.completed / analytics.summary.total) * 100) 
      : 0;

    // Status distribution
    tasks.forEach(task => {
      const status = task.status || "Active";
      analytics.statusDistribution[status] = (analytics.statusDistribution[status] || 0) + 1;
    });

    // Category distribution
    tasks.forEach(task => {
      const category = task.category || "Uncategorized";
      analytics.categoryDistribution[category] = (analytics.categoryDistribution[category] || 0) + 1;
    });

    // Priority distribution
    tasks.forEach(task => {
      const priority = task.priority || "Medium";
      analytics.priorityDistribution[priority] = (analytics.priorityDistribution[priority] || 0) + 1;
    });

    // Calculate average completion time
    const completedTasks = tasks.filter(t => t.completed && t.completedAt && (t.inProgressAt || t.createdAt));
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((sum, task) => {
        const start = new Date(task.inProgressAt || task.createdAt);
        const end = new Date(task.completedAt);
        return sum + (end - start);
      }, 0);
      analytics.averageCompletionTime = Math.round(totalTime / completedTasks.length / (1000 * 60 * 60 * 24)); // in days
    }

    // Calculate current streak (consecutive days with completed tasks)
    const completedDates = completedTasks
      .map(t => new Date(t.completedAt).toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index)
      .sort()
      .reverse();

    let currentStreak = 0;
    let currentDate = new Date();
    
    for (let i = 0; i < completedDates.length; i++) {
      const completedDate = new Date(completedDates[i]);
      if (completedDate.toDateString() === currentDate.toDateString()) {
        currentStreak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    analytics.streak = currentStreak;

    // Weekly trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    analytics.weeklyTrend = last7Days.reduce((trend, day) => {
      trend[day] = completedTasks.filter(t => 
        new Date(t.completedAt).toDateString() === day
      ).length;
      return trend;
    }, {});

    // Monthly trend (last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toDateString();
    }).reverse();

    analytics.monthlyTrend = last30Days.reduce((trend, day) => {
      trend[day] = completedTasks.filter(t => 
        new Date(t.completedAt).toDateString() === day
      ).length;
      return trend;
    }, {});

    return {
      status: 200,
      body: {
        analytics,
        tasks: tasks, // Include tasks for frontend analytics processing
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error("Error in getTaskAnalytics:", error);
    if (error.message.includes("Unauthorized") || error.message.includes("JWT")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to generate analytics" } };
  }
};