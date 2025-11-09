// src/components/MyTasks.js
import React, { useState, useEffect, useRef } from "react";
import {
  ViewColumnsIcon,
  ListBulletIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  CalendarIcon,
  TrashIcon,
  CheckCircleIcon,
   ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const API_BASE = (() => {
  const base = (process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
})();

export default function MyTasks({ tasks, setTasks, onToggleTask }) {
  const [viewMode, setViewMode] = useState("list");
  const [filters, setFilters] = useState({ category: "", priority: "", dueDate: "", fromDate: "", toDate: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  // auto-scroll refs
  const scrollRAF = useRef(null);
  const currentDragX = useRef(null);

  // styles (inline as requested)
  const styles = {
    myTasks: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem" },
    tasksHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" },
    tasksControls: { display: "flex", alignItems: "center", gap: "1rem" },
    viewToggle: { display: "flex", gap: "0.5rem" },
    viewBtn: {
      padding: "0.4rem 0.8rem",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      gap: "0.3rem",
      fontSize: "0.85rem",
      background: "var(--card-bg)",
      cursor: "pointer",
    },
    bulkBtn: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      border: "1px solid var(--border)",
      background: "var(--card-bg)",
      color: "var(--text)",
      transition: "opacity 0.2s ease",
    },
    activeView: { background: "var(--hover)", borderColor: "var(--active)", fontWeight: 600 },
    searchFilter: { display: "flex", alignItems: "center", gap: "1rem" },
    searchWrapper: { position: "relative" },
    searchIcon: { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", color: "var(--muted)" },
    searchInput: { padding: "0.5rem 0.5rem 0.5rem 2rem", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--input-bg)", color: "var(--text)", fontSize: "0.9rem", minWidth: 220 },
    filterBtn: { display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.4rem 0.8rem", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer", background: "var(--card-bg)" },
    filtersPanel: { display: "flex", gap: "1rem", flexWrap: "wrap", padding: "1rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--hover)" },
    filterSelect: { padding: "0.4rem 0.8rem", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--input-bg)", color: "var(--text)", fontSize: "0.9rem" },
    filterInput: { padding: "0.4rem 0.8rem", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--input-bg)", color: "var(--text)", fontSize: "0.9rem" },
    listView: { display: "flex", flexDirection: "column", gap: "1rem" },
    taskCard: { background: "var(--card-bg)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", alignItems: "center", gap: "1rem", transition: "opacity 0.3s ease" },
    taskCheckbox: { width: "18px", height: "18px", cursor: "pointer" },
    taskContent: { flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" },
    taskTitle: { margin: 0, fontSize: "1rem", fontWeight: 600 },
    taskMeta: { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" },
    chip: { padding: "0.25rem 0.5rem", borderRadius: "999px", fontSize: "0.75rem", border: "1px solid transparent" },
    chipLow: { background: "#f1f5f9", color: "#334155" },
    chipMedium: { background: "#fef9c3", color: "#ca8a04" },
    chipHigh: { background: "#fee2e2", color: "#dc2626" },
    chipCategory: { background: "#eff6ff", color: "#2563eb" },
    chipDue: { background: "transparent", color: "var(--muted)", border: "1px dashed rgba(0,0,0,0.04)" },
    taskDescription: { fontSize: "0.9rem", color: "var(--muted)", margin: 0 },
    taskActions: { display: "flex", gap: "0.5rem", alignItems: "center" },
    statusBtn: { padding: "0.4rem 0.8rem", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--card-bg)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 },
    kanbanView: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", alignItems: "start" },
    kanbanColumn: { display: "flex", flexDirection: "column", gap: "1rem", background: "var(--hover)", padding: "1rem", borderRadius: "8px", border: "1px solid var(--border)", minHeight: "400px" },
    columnHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" },
    columnTitle: { margin: 0, fontSize: "1rem", fontWeight: 600 },
    taskCount: { background: "var(--card-bg)", color: "var(--text)", borderRadius: "999px", padding: "0.25rem 0.5rem", fontSize: "0.75rem", fontWeight: 600 },
    kanbanTasks: { display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 },
    kanbanTask: { background: "var(--card-bg)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", cursor: "grab", userSelect: "none" },
    dragging: { transform: "rotate(5deg)", boxShadow: "0 5px 15px rgba(0,0,0,0.1)" },
    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modalContent: { background: "var(--card-bg)", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--border)", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", maxWidth: "400px", width: "90%" },
    modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" },
    btn: { padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", border: "1px solid var(--border)" },
    btnPrimary: { background: "var(--blue)", color: "#fff", border: "none" },
    btnDanger: { background: "#ef4444", color: "#fff", border: "none" },
    toast: { position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)", background: "var(--card-bg)", color: "var(--text)",padding: "0.75rem 1rem",borderRadius: "6px",border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1100, display: "flex", alignItems: "center", gap: "0.5rem",},

    // card styles
    kanbanCard: { background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.6rem 0.75rem", marginBottom: "0.5rem", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "stretch", minHeight: "68px" },
    card: { background: "var(--card-bg)", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" },
    cardRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px" },
    rightInfo: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" },
    headerRightRow: { display: "flex", alignItems: "flex-start", gap: "12px", justifyContent: "flex-end" },
    priorityBadge: (priority) => ({ padding: "6px 10px", borderRadius: "999px", fontSize: "0.8rem", ...(priority === "Low" ? { background: "#f1f5f9", color: "#334155" } : priority === "Medium" ? { background: "#fef9c3", color: "#ca8a04" } : { background: "#fee2e2", color: "#dc2626" }) }),
    categoryBadge: { background: "#eff6ff", color: "#2563eb", padding: "6px 10px", borderRadius: "999px", fontSize: "0.8rem" },
    dateRow: { display: "flex", alignItems: "center", gap: "6px" },
    dateInProgress: { color: "#f0ad4e" },
    dateCompleted: { color: "#22c55e" },
    dateOverdue: { color: "#dc2626" },
    headerTitle: { margin: 0, fontSize: "1.05rem", fontWeight: 700 },
    description: { fontSize: "0.95rem", color: "var(--muted)", marginTop: "8px" },
    actionBtn: (completed) => ({
      borderRadius: "999px",
      border: "1px solid rgba(0,0,0,0.08)",
      padding: "8px 14px",
      fontWeight: 700,
      cursor: "default",
      background: "white",
      color: "var(--text)",
      boxShadow: "none",
      minWidth: 90,
      textAlign: "center",
    }),

    // bulk bar
    bulkBar: {
      position: "relative",
      marginTop: "0.5rem",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "8px 14px",
      borderRadius: "10px",
      border: "1px solid var(--border)",
      background: "var(--card-bg)",
      boxShadow: "var(--shadow)",
      minWidth: 360,
      justifyContent: "flex-start",
      alignSelf: "flex-start",
      zIndex: 20,
    },

    // Kanban column base + colored borders
    kanbanColumnBase: {
      flex: "0 0 340px",
      borderRadius: 10,
      padding: "12px",
      maxHeight: "calc(100vh - 180px)",
      overflowY: "auto",
      boxSizing: "border-box",
      background: "var(--card-bg)",
      border: "none",
      minHeight: "260px",
    },
  };

  // === Kanban card color helper ===
  const getCardColor = (status) => {
    switch (status) {
      case "Active":
        return "#f8fafc";
      case "In Progress":
        return "#fff4d6";
      case "Overdue":
        return "#ffe5e5";
      case "Completed":
        return "#e7f8ec";
      default:
        return "var(--card-bg)";
    }
  };

  

  // ---------------- API helper ----------
  const apiFetch = async (path, { method = "GET", body } = {}) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try { 
      data = text ? JSON.parse(text) : {}; 
    } catch (e) { 
      data = { message: text }; 
    }

    if (!res.ok) {
      const errMsg = data.error || data.message || `HTTP ${res.status}: ${res.statusText}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  } catch (error) {
    console.error(`API fetch error for ${path}:`, error);
    throw error;
  }
};

  // ---------------- Notifications ----------------
  const addNotification = (title, message) => {
  try {
    const newNotification = { 
      id: Date.now().toString(), 
      title, 
      message, 
      timestamp: new Date().toISOString(), 
      read: false 
    };
    
    // Update global state in home.js by using a custom event with data
    const event = new CustomEvent('newNotification', { 
      detail: newNotification 
    });
    window.dispatchEvent(event);
    
    // Also update localStorage for persistence
    const globalNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
    const updatedNotifications = [newNotification, ...globalNotifications];
    localStorage.setItem("notifications", JSON.stringify(updatedNotifications));
    
  } catch (err) { 
    console.error("addNotification error:", err); 
  }
};
  // ---------------- date helpers ----------------
  const areDatesEqual = (d1, d2) => { 
    if (!d1 || !d2) return false; 
    return new Date(d1).toDateString() === new Date(d2).toDateString(); 
  };
  
  const formatDate = (d) => { 
    if (!d) return ""; 
    try { 
      return new Date(d).toLocaleDateString("en-GB"); 
    } catch { 
      return String(d); 
    } 
  };
  
  const isToday = (d) => { 
    if (!d) return false; 
    return areDatesEqual(d, new Date()); 
  };
  
  const isYesterday = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    dt.setHours(0,0,0,0);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0,0,0,0);
    return dt.getTime() === yesterday.getTime();
  };
  
  const isOverdue = (dueDate) => { 
    if (!dueDate) return false; 
    const today = new Date(); 
    today.setHours(0,0,0,0); 
    const due = new Date(dueDate); 
    due.setHours(0,0,0,0); 
    return due < today; 
  };

  // ---------------- status calculation ----------------
  const calculateTaskStatus = (task) => {
  if (!task) return "Active";
  
  // Only respect manual status for Active/In Progress/Completed - NOT Overdue
  if (task.manualStatus && task.status !== "Overdue") {
    return task.status || "Active";
  }
  
  if (task.completed) return "Completed";
  if (!task.due) return "Active";

  const now = new Date();
  
  // Calculate in-progress time (due date + task time)
  let inProgressDateTime = new Date(task.due);
  if (task.time) {
    const [hours, minutes] = task.time.split(':');
    inProgressDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  } else {
    inProgressDateTime.setHours(0, 0, 0, 0);
  }
  
  // Calculate overdue time (5:00 AM on day after due date)
  const overdueDateTime = new Date(task.due);
  overdueDateTime.setDate(overdueDateTime.getDate() + 1);
  overdueDateTime.setHours(5, 0, 0, 0);
  
  console.log(`Task ${task.id}:`, {
    now: now.toISOString(),
    inProgress: inProgressDateTime.toISOString(),
    overdue: overdueDateTime.toISOString(),
    currentStatus: task.status
  });
  
  // FIXED LOGIC: Check Overdue first, then In Progress
  if (now >= overdueDateTime) return "Overdue";
  if (now >= inProgressDateTime) return "In Progress";
  
  return "Active";
};

  // ---------------- updateTaskStatus (server + local) ----------------
const updateTaskStatus = async (taskId, newStatus, task = {}, opts = {}) => {
  const token = localStorage.getItem("token");
  
  try {
    const now = new Date().toISOString();
    const updateData = { 
      status: newStatus,
      // CRITICAL: Always include manualStatus when it's a manual update
      manualStatus: opts.manual ? true : (task.manualStatus || false)
    };

    // ... rest of your updateData logic

    console.log("Sending to server:", { taskId, updateData }); // DEBUG

    // Use the API helper for consistent error handling
    const data = await apiFetch(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: updateData
    });

    console.log("Server response:", data); // DEBUG

    // Use server response data (which includes updated timestamps)
    const updatedTask = data.task || data;
    
    setTasks((prev) =>
      prev.map((t) =>
        String(t.id) === String(taskId)
          ? {
              ...t,
              status: newStatus,
              inProgressAt: updatedTask.inProgressAt ?? t.inProgressAt,
              overdueAt: updatedTask.overdueAt ?? t.overdueAt,
              completedAt: updatedTask.completedAt ?? t.completedAt,
              completed: updatedTask.completed ?? t.completed,
              manualStatus: updatedTask.manualStatus ?? t.manualStatus,
            }
          : t
      )
    );

    if (!opts.silent) setToast({ message: "Task updated successfully", timeout: 7000 });
    return true;
  } catch (err) {
    console.error("updateTaskStatus error:", err);
    setToast({ message: err.message || "Failed to update task", timeout: 7000, type: "warning" });
    return false;
  }
};

// ---------------- automatic status updater ----------------
useEffect(() => {
  let intervalId;
  
  const updateTaskStatuses = () => {
    setTasks(prevTasks => 
      prevTasks.map(task => {
        // Skip completed tasks
        if (task.completed) {
          return task;
        }
        
        // Allow automatic updates to Overdue status regardless of manualStatus
        const newStatus = calculateTaskStatus(task);
        const shouldUpdate = 
          newStatus === "Overdue" || // Always update to Overdue
          (newStatus !== task.status && !task.manualStatus); // Update other statuses only if not manually set
        
        if (shouldUpdate) {
  console.log(`Auto-updating task ${task.id} from ${task.status} to ${newStatus}`);

  // ✅ Immediately update the backend so timestamps (inProgressAt, overdueAt) get saved
  apiFetch(`/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: { 
      status: newStatus, 
      manualStatus: false 
    }
  })
  .then(() => {
    console.log(`✅ Auto-update persisted for task ${task.id}`);
  })
  .catch((err) => {
    console.error(`❌ Auto-update failed for task ${task.id}:`, err);
  });

  // ✅ Update local state too, keeping manualStatus consistent
  return { 
    ...task, 
    status: newStatus,
    manualStatus: newStatus === "Overdue" ? false : task.manualStatus,
    // Optional: record inProgressAt immediately on frontend for instant UI reflection
    inProgressAt: newStatus === "In Progress" ? new Date().toISOString() : task.inProgressAt,
    overdueAt: newStatus === "Overdue" ? new Date().toISOString() : task.overdueAt
  };
}

return task;
      })
    );
  };
  
  // Update immediately and then every minute
  updateTaskStatuses();
  intervalId = setInterval(updateTaskStatuses, 60000);
  
  return () => {
    if (intervalId) clearInterval(intervalId);
  };
}, []);

  // ---------------- fetch tasks on mount ----------------
useEffect(() => {
  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        // Use local storage if no token
        const saved = localStorage.getItem("tasks");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const fixed = Array.isArray(parsed) ? parsed.map((t) => ({
              ...t,
              status: t.manualStatus ? t.status : calculateTaskStatus(t)
            })) : [];
            setTasks(fixed);
          } catch (e) {
            console.error("Failed to parse saved tasks:", e);
          }
        }
        return;
      }

      const data = await apiFetch("/tasks");
      const tasksFromServer = Array.isArray(data.tasks) ? data.tasks : (data || []);
      
      // FIX: Properly preserve manualStatus from server
      const fixed = tasksFromServer.map((t) => ({ 
        ...t, 
        // CRITICAL FIX: Check if task has manualStatus set to true
        status: t.manualStatus ? (t.status || "Active") : calculateTaskStatus(t),
        // Ensure manualStatus is preserved from server data
        manualStatus: t.manualStatus || false
      }));
      
      setTasks(fixed);
    } catch (err) { 
      console.error("Fetch tasks error:", err);
      // Fallback to local storage
      const saved = localStorage.getItem("tasks");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setTasks(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
          console.error("Failed to parse saved tasks:", e);
        }
      }
    }
  };

  fetchTasks();
}, []);

  // ---------------- notification on status transitions ---------------- 
    useEffect(() => {
  const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications");
    return false;
  }
  
  try {
    if (Notification.permission === "granted") {
      return true;
    } else if (Notification.permission === "default") {
      // Request permission - must be triggered by user interaction
      const permission = await Notification.requestPermission();
      console.log("Notification permission:", permission);
      return permission === "granted";
    } else {
      console.log("Notification permission was denied");
      return false;
    }
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

  const showBrowserNotification = (title, body) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    console.log("Cannot show notification: No permission or not supported");
    return;
  }
  
  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico", // Ensure this path is correct
      badge: "/favicon.ico",
      tag: "task-notification",
      requireInteraction: false
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      notification.close();
    }, 5000);
    
  } catch (error) {
    console.error("Error showing browser notification:", error);
  }
};

  const sendEmailNotification = async (title, message) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await fetch(`${API_BASE}/notifications/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          message,
          type: "task_status_change"
        })
      });
    } catch (error) {
      console.error("Failed to send email notification:", error);
    }
  };

  try {
    const mapKey = "taskLastStatuses_v1";
    const raw = localStorage.getItem(mapKey);
    const lastMap = raw ? JSON.parse(raw) : {};

    console.log("Status transition effect running. Tasks count:", tasks.length);
    console.log("Checking for status changes...");

    
    tasks.forEach((task) => {
      if (!task || !task.id) return;
      const prev = lastMap[task.id];
      const curr = task.status || calculateTaskStatus(task);
      
      if (prev && prev !== curr) {
        let notificationTitle = "";
        let notificationMessage = "";
        
        if (prev === "Active" && curr === "In Progress") {
          notificationTitle = "Task Started";
          notificationMessage = `"${task.title}" is now In Progress`;
        } else if (prev === "In Progress" && curr === "Overdue") {
          notificationTitle = "Task Overdue";
          notificationMessage = `"${task.title}" is now overdue`;
        } else if (prev === "Overdue" && curr === "Completed") {
          notificationTitle = "Task Completed";
          notificationMessage = `"${task.title}" has been completed`;
        }
        
        if (notificationTitle && notificationMessage) {
          // In-app notification
          addNotification(notificationTitle, notificationMessage);
          
          // Browser push notification
          // Browser push notification with better timing
setTimeout(() => {
  requestNotificationPermission().then(hasPermission => {
    if (hasPermission) {
      showBrowserNotification(notificationTitle, notificationMessage);
    }
  });
}, 1000); // Small delay to ensure permission check completes
          
          // Email notification
          sendEmailNotification(notificationTitle, notificationMessage);
        }
      }
      lastMap[task.id] = curr;
    });
    
    localStorage.setItem(mapKey, JSON.stringify(lastMap));
  } catch (err) { 
    console.error("Status transition notification error:", err);
  }
}, [tasks]);

  // ---------------- filtering & sorting ----------------
  const filteredTasks = (tasks || []).filter((task) => {
    if (!task || typeof task !== "object") return false;
    
    // Category filter
    if (filters.category && task.category !== filters.category) return false;
    
    // Priority filter
    if (filters.priority && task.priority !== filters.priority) return false;
    
    // Due date filters
    if (filters.dueDate) {
      const today = new Date(); 
      today.setHours(0,0,0,0);
      const taskDue = task.due ? new Date(task.due) : null;
      
      if (filters.dueDate === "today" && (!taskDue || !areDatesEqual(taskDue, today))) return false;
      if (filters.dueDate === "week") { 
        const weekEnd = new Date(today); 
        weekEnd.setDate(weekEnd.getDate() + 7); 
        if (!taskDue || taskDue < today || taskDue > weekEnd) return false; 
      }
    }
    
    // Date range filters
    if (filters.fromDate || filters.toDate) {
      const taskDue = task.due ? new Date(task.due).setHours(0,0,0,0) : null;
      const from = filters.fromDate ? new Date(filters.fromDate).setHours(0,0,0,0) : null;
      const to = filters.toDate ? new Date(filters.toDate).setHours(0,0,0,0) : null;
      
      if (from && (!taskDue || taskDue < from)) return false;
      if (to && (!taskDue || taskDue > to)) return false;
    }
    
    // Search term filter
    if (searchTerm && !String(task.title || "").toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
  // 1️⃣ Completed tasks always at bottom
  if ((a.completed || false) !== (b.completed || false)) return a.completed ? 1 : -1;

  // 2️⃣ Sort by due date (earlier first)
  const aDate = a.due ? new Date(a.due) : new Date(8640000000000000);
  const bDate = b.due ? new Date(b.due) : new Date(8640000000000000);
  const dateDiff = aDate - bDate;
  if (dateDiff !== 0) return dateDiff;

  // 3️⃣ For tasks on the SAME date: order by status
  // In Progress → Active → Overdue → Completed
  const order = ["In Progress", "Active", "Overdue", "Completed"];
  const aOrder = order.indexOf(a.status || "Active");
  const bOrder = order.indexOf(b.status || "Active");
  return aOrder - bOrder;
});


  // ---------------- auto-scroll during drag ----------------
  const startAutoScroll = () => {
    const container = document.querySelector("#kanban-scroll"); 
    if (!container || scrollRAF.current) return;
    
    const SCROLL_THRESHOLD = 50; 
    const SCROLL_SPEED = 20;
    
    const step = () => {
      const clientX = typeof currentDragX.current === "number" ? currentDragX.current : null;
      if (clientX == null) { 
        scrollRAF.current = requestAnimationFrame(step); 
        return; 
      }
      
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const maxScroll = container.scrollWidth - container.clientWidth;
      const currentScroll = container.scrollLeft;
      let scrollDelta = 0;
      
      if (x > rect.width - SCROLL_THRESHOLD && currentScroll < maxScroll) {
        const intensity = Math.min((x - (rect.width - SCROLL_THRESHOLD)) / SCROLL_THRESHOLD, 1);
        scrollDelta = SCROLL_SPEED * intensity;
      } else if (x < SCROLL_THRESHOLD && currentScroll > 0) {
        const intensity = Math.min((SCROLL_THRESHOLD - x) / SCROLL_THRESHOLD, 1);
        scrollDelta = -SCROLL_SPEED * intensity;
      }
      
      if (scrollDelta !== 0) container.scrollLeft += scrollDelta;
      scrollRAF.current = requestAnimationFrame(step);
    };
    
    if (!scrollRAF.current) scrollRAF.current = requestAnimationFrame(step);
  };

  const stopAutoScroll = () => { 
  if (scrollRAF.current) { 
    cancelAnimationFrame(scrollRAF.current); 
    scrollRAF.current = null; 
  } 
  currentDragX.current = null; 
};

  // ---------------- drag & drop ----------------
  const onDragStart = () => {
    document.body.style.cursor = "grabbing";
    setIsDragging(true); 
    if (scrollRAF.current) stopAutoScroll();
    document.body.style.cursor = "default"; // Reset drag cursor immediately
  };

  const onDragUpdate = (update) => {
    if (!isDragging) setIsDragging(true);
    if (update?.clientOffset?.x !== undefined) {
      currentDragX.current = update.clientOffset.x;
      const container = document.querySelector("#kanban-scroll");
      if (container && !scrollRAF.current) startAutoScroll();
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    setIsDragging(false);
    stopAutoScroll();
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const movedTask = tasks.find((t) => String(t.id) === String(draggableId));
    if (!movedTask) return;
    
    const prevStatus = movedTask.status;
    const newStatus = destination.droppableId;
    const srcStatus = source.droppableId;

    // ---------------- VALIDATION RULES ----------------
    // In onDragEnd function, replace the validation section:

// 1) Overdue cannot be set manually - FIX THIS
if (newStatus === "Overdue") {
  setToast({ 
    message: "Overdue status is set automatically; cannot move manually.", 
    timeout: 7000,
    type: "warning"
  });
  return;
}

// 2) Cannot move OUT of Overdue to other statuses except Completed
if (srcStatus === "Overdue" && newStatus !== "Completed") {
  setToast({ message: "Overdue tasks can only be moved to Completed.", timeout: 7000, type: "warning" });
  return;
}

// 3) Fix date comparisons - use your existing date helpers
const today = new Date();
today.setHours(0,0,0,0);
const taskDue = movedTask.due ? new Date(movedTask.due) : null;
taskDue?.setHours(0,0,0,0);

if (taskDue && areDatesEqual(taskDue, today) && (newStatus === "Active" || newStatus === "Overdue")) {
  setToast({ message: "Task due today cannot be set to Active or Overdue manually.", timeout: 7000, type: "warning" });
  return;
}

// 4) If due date was yesterday, cannot be Active or In Progress
if (taskDue && isYesterday(movedTask.due) && (newStatus === "Active" || newStatus === "In Progress")) {
  setToast({ message: "Task due yesterday cannot be Active or In Progress; it should be Overdue.", timeout: 7000, type: "warning" });
  return;
}

    // 5) If moving to In Progress, and due date isn't today — confirm with modal
    if (newStatus === "In Progress" && movedTask.due) {
      const today = new Date(); 
      today.setHours(0,0,0,0);
      const dueDate = new Date(movedTask.due); 
      dueDate.setHours(0,0,0,0);
      
      if (dueDate.getTime() !== today.getTime()) {
        setModal({
          message: "Task due date is not today. Do you want to set status to In Progress anyway?",
          onConfirm: async () => {
            setModal(null);
            const nowISO = new Date().toISOString();
            
            // Optimistic update
            setTasks((prev) => prev.map((t) => 
              t.id === movedTask.id ? { 
                ...t, 
                status: "In Progress", 
                inProgressAt: nowISO, 
                manualStatus: true 
              } : t
            ));
            
            const ok = await updateTaskStatus(movedTask.id, "In Progress", movedTask, { manual: true });
            if (!ok) {
              // Revert on failure
              setTasks((prev) => prev.map((t) => 
                t.id === movedTask.id ? { ...t, status: prevStatus } : t
              ));
            } else {
              setToast({ message: "Task set to In Progress", timeout: 7000 });
            }
          },
          onCancel: () => setModal(null),
        });
        return;
      }
    }

    // ---------------- Optimistic update ----------------
const prevCopy = { ...movedTask };
const nowISO = new Date().toISOString();

setTasks((prevList) =>
  prevList.map((t) =>
    String(t.id) === String(movedTask.id)
      ? {
          ...t,
          status: newStatus,
          completed: newStatus === "Completed" ? true : t.completed,
          completedAt: newStatus === "Completed" ? nowISO : newStatus === "Active" ? null : t.completedAt,
          // Set inProgressAt when transitioning TO In Progress (not when already in progress)
          inProgressAt: newStatus === "In Progress" 
            ? (prevStatus !== "In Progress" ? nowISO : (t.inProgressAt || nowISO))
            : newStatus === "Active" ? null 
            : newStatus === "Overdue" ? null 
            : t.inProgressAt,
          manualStatus: true, // ← THIS IS CRITICAL
        }
      : t
  )
);
    // Add notifications for status transitions
    if (prevStatus === "Active" && newStatus === "In Progress") {
      addNotification("Task Started", `"${movedTask.title}" is now In Progress`);
    }
    if (prevStatus === "In Progress" && newStatus === "Overdue") {
      addNotification("Task Overdue", `"${movedTask.title}" is now overdue`);
    }
    if (newStatus === "Completed") {
      addNotification("Task Completed", `"${movedTask.title}" has been completed`);
    }

    const ok = await updateTaskStatus(movedTask.id, newStatus, movedTask, { manual: true });
    if (!ok) {
      // Revert on failure
      setTasks((prevList) => prevList.map((t) => 
        (String(t.id) === String(movedTask.id) ? prevCopy : t)
      ));
    } else {
      setToast({ message: `Task moved to ${newStatus}`, timeout: 5000 });
    }
  };

  // ---------------- bulk actions ----------------
  const handleBulkComplete = async () => {
    if (selectedTasks.length === 0) return;
    
    const toComplete = selectedTasks.filter((id) => {
      const task = tasks.find((t) => t.id === id);
      return task && !task.completed;
    });
    
    if (toComplete.length === 0) {
      setToast({ message: "Selected task(s) already completed", timeout: 5000 });
      return;
    }

    const now = new Date().toISOString();
    
    // Optimistic update
    setTasks((prev) => prev.map((t) => 
      toComplete.includes(t.id) ? { 
        ...t, 
        completed: true, 
        status: "Completed", 
        inProgressAt: t.inProgressAt || now, 
        completedAt: now, 
        manualStatus: true 
      } : t
    ));
    
    setToast({ message: `${toComplete.length} task(s) completed`, timeout: 5000 });
    
    // Server calls
    const promises = toComplete.map((id) => 
      updateTaskStatus(id, "Completed", tasks.find((t) => t.id === id) || {}, { manual: true })
    );
    await Promise.allSettled(promises);
  };

  const handleBulkUndo = async () => {
  if (selectedTasks.length === 0) return;
  
  const toUndo = selectedTasks.filter((id) => {
    const task = tasks.find((t) => t.id === id);
    return task && task.completed;
  });

  // Filter out overdue tasks that shouldn't be reactivated
  const validToUndo = toUndo.filter(id => {
    const task = tasks.find(t => t.id === id);
    return !isOverdue(task.due);
  });

  const excludedTasks = toUndo.filter(id => {
    const task = tasks.find(t => t.id === id);
    return isOverdue(task.due);
  });
  
  if (excludedTasks.length > 0) {
    setToast({ 
      message: `${excludedTasks.length} overdue task(s) cannot be reactivated`, 
      timeout: 5000,
      type: "warning"
    });
  }
  
  if (validToUndo.length === 0) {
    setToast({ message: "No valid tasks to undo", timeout: 7000, type: "warning" });
    return;
  }

  // Optimistic update - restore to previous status
  setTasks((prev) => prev.map((t) => {
    if (!validToUndo.includes(t.id)) return t;
    
    // Determine correct status to revert to
    let newStatus = "Active";
    if (isOverdue(t.due)) {
      newStatus = "Overdue";
    } else if (t.inProgressAt) {
      newStatus = "In Progress";
    }
    
    return { 
      ...t, 
      completed: false, 
      status: newStatus,
      completedAt: null, 
      manualStatus: true 
    };
  }));
    
    setToast({ message: `Undo: ${toUndo.length} task(s) set to Active`, timeout: 5000 });
    
    // Server calls
    const promises = toUndo.map((id) => 
      updateTaskStatus(id, "Active", tasks.find((t) => t.id === id) || {}, { manual: true })
    );
    await Promise.allSettled(promises);
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;
    
    setModal({
      title: "Delete Tasks",
      message: `Are you sure you want to delete ${selectedTasks.length} task(s)? This action cannot be undone.`,
      onConfirm: async () => {
        setModal(null);
        
        // Optimistic update
        const tasksToDelete = selectedTasks;
        setTasks((prev) => prev.filter((t) => !tasksToDelete.includes(t.id)));
        setSelectedTasks([]);
        
        // Server calls
        const token = localStorage.getItem("token");
        if (token) {
          const promises = tasksToDelete.map((id) =>
            apiFetch(`/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })
          );
          await Promise.allSettled(promises);
        }
        
        setToast({ message: `${tasksToDelete.length} task(s) deleted`, timeout: 5000 });
      },
      onCancel: () => setModal(null),
    });
  };

  // ---------------- render date info ----------------
  const renderDateInfo = (task) => {
    const dates = [];
    
    if (task.due) {
      const isLate = isOverdue(task.due) && !task.completed;
      dates.push(
        <div key="due" style={{ ...styles.dateRow, color: isLate ? "#dc2626" : "inherit" }}>
          <CalendarIcon width={14} />
          <span>{formatDate(task.due)}</span>
        </div>
      );
    }
    
    if (task.inProgressAt) {
      dates.push(
        <div key="inProgress" style={{ ...styles.dateRow, ...styles.dateInProgress }}>
          <ViewColumnsIcon width={14} />
          <span>{formatDate(task.inProgressAt)}</span>
        </div>
      );
    }
    
    if (task.completed && task.completedAt) {
      dates.push(
        <div key="completed" style={{ ...styles.dateRow, ...styles.dateCompleted }}>
          <CheckCircleIcon width={14} />
          <span>{formatDate(task.completedAt)}</span>
        </div>
      );
    }
    
    return dates;
  };

  // ---------------- helper for list-action: setStatusFromList ----------------
  const setStatusFromList = async (task, newStatus) => {
    // Enforce rules on pill-click as well
   if (newStatus === "Overdue") {
  setToast({ 
    message: "Overdue status is set automatically from due date; cannot set manually.", 
    timeout: 3000,
    type: "warning" 
  });
  return;
}
    
    if (task.due && isToday(task.due) && (newStatus === "Active" || newStatus === "Overdue")) {
      setToast({ message: "Task due today cannot be set to Active or Overdue manually.", timeout: 7000, type: "warning" });
      return;
    }
    
    if (task.due && isYesterday(task.due) && (newStatus === "Active" || newStatus === "In Progress")) {
      setToast({ message: "Task due yesterday cannot be set to Active or In Progress; it should be Overdue.", timeout: 7000, type: "warning" });
      return;
    }

    const prev = { ...task };

    // Optimistic update
    const now = new Date().toISOString();
    let updateFields = {};
    
    if (newStatus === "In Progress") {
      updateFields = { 
        status: "In Progress", 
        // Set inProgressAt when transitioning TO In Progress
        inProgressAt: task.status !== "In Progress" ? now : (task.inProgressAt || now), 
        manualStatus: true, 
        completed: false 
      };
    } else if (newStatus === "Completed") {
      updateFields = { 
        status: "Completed", 
        completed: true, 
        completedAt: now, 
        manualStatus: true 
      };
    } else if (newStatus === "Active") {
      updateFields = { 
        status: "Active", 
        completed: false, 
        completedAt: null, 
        inProgressAt: null, 
        manualStatus: true 
      };
    }

    setTasks((prevList) => prevList.map((t) => (t.id === task.id ? { ...t, ...updateFields } : t)));

    const ok = await updateTaskStatus(task.id, newStatus, task, { manual: true });
    if (!ok) {
      setTasks((prevList) => prevList.map((t) => (t.id === task.id ? prev : t)));
    } else {
      setToast({ message: `Task set to ${newStatus}`, timeout: 5000 });
    }
  };

  // ---------------- counts for kanban header ----------------
  const tasksByStatus = {
    Active: filteredTasks.filter((t) => t.status === "Active" && !t.completed),
    "In Progress": filteredTasks.filter((t) => t.status === "In Progress" && !t.completed),
    Overdue: filteredTasks.filter((t) => t.status === "Overdue" && !t.completed),
    Completed: filteredTasks.filter((t) => t.completed || t.status === "Completed"),
  };

  // ---------------- toast auto cleanup ----------------
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.timeout || 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // cleanup RAF
  useEffect(() => {
  return () => {
    if (scrollRAF.current) cancelAnimationFrame(scrollRAF.current);
  };
}, []);

  // clear selection when switching view
  useEffect(() => { 
    if (viewMode === "kanban") setSelectedTasks([]); 
  }, [viewMode]);

  // ---------------- UI ----------------
  return (
    <div style={styles.myTasks}>
      {/* Modal */}
      {modal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={{ margin: "0 0 1rem 0" }}>{modal.title || "Confirmation"}</h3>
            <p style={{ margin: "0 0 1.5rem 0" }}>{modal.message}</p>
            <div style={styles.modalActions}>
              <button 
                onClick={() => {
                  modal.onConfirm();
                }} 
                style={{ ...styles.btn, ...styles.btnPrimary }}
              >
                Confirm
              </button>
              <button 
                onClick={() => {
                  modal.onCancel();
                }} 
                style={styles.btn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
  <div style={{
    ...styles.toast,
    borderColor: toast.type === "warning" ? "#f59e0b" : "var(--border)"
  }}>
    {toast.type === "warning" ? (
      <ExclamationTriangleIcon width={16} color="#f59e0b" />
    ) : (
      <CheckCircleIcon width={16} color="#22c55e" /> // Green tick
    )}
    {toast.message}
  </div>
)}

      {/* Header */}
      <div style={styles.tasksHeader}>
        <h2>My Tasks</h2>
        <div style={styles.tasksControls}>
          <div style={styles.viewToggle}>
            <button 
              style={{ ...styles.viewBtn, ...(viewMode === "list" ? styles.activeView : {}) }} 
              onClick={() => setViewMode("list")}
            >
              <ListBulletIcon width={16} /> 
              <span style={{ marginLeft: 6 }}>List</span>
            </button>
            <button 
              style={{ ...styles.viewBtn, ...(viewMode === "kanban" ? styles.activeView : {}) }} 
              onClick={() => setViewMode("kanban")}
            >
              <ViewColumnsIcon width={16} /> 
              <span style={{ marginLeft: 6 }}>Kanban</span>
            </button>
          </div>

          <div style={styles.searchFilter}>
            <div style={styles.searchWrapper}>
              <MagnifyingGlassIcon style={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search tasks..." 
                style={styles.searchInput} 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>

            <button 
              style={styles.filterBtn} 
              onClick={() => setShowFilters((s) => !s)}
            >
              <FunnelIcon width={16} /> 
              <span style={{ marginLeft: 6 }}>Filters</span> 
              <ChevronDownIcon width={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTasks.length > 0 && (
        <div style={styles.bulkBar}>
          <span style={{ fontWeight: 700 }}>{selectedTasks.length} selected</span>

          <button 
            style={styles.bulkBtn} 
            onClick={() => {
              if (selectedTasks.length === sortedTasks.length) {
                setSelectedTasks([]);
              } else {
                setSelectedTasks(sortedTasks.map(task => task.id));
              }
            }}
          >
            {selectedTasks.length === sortedTasks.length ? "Deselect All" : "Select All"}
          </button>
  
          <button 
            style={styles.bulkBtn} 
            onClick={handleBulkComplete}
            disabled={loading}
          >
            <CheckCircleIcon width={16} /> 
            <span style={{ marginLeft: 6 }}>Complete</span>
          </button>
          
          {selectedTasks.some((id) => tasks.find((t) => t.id === id && t.completed)) && (
            <button 
              style={styles.bulkBtn} 
              onClick={handleBulkUndo}
              disabled={loading}
            >
              Undo
            </button>
          )}
          
          <button 
            style={styles.bulkBtn} 
            onClick={handleBulkDelete}
            disabled={loading}
          >
            <TrashIcon width={16} /> 
            <span style={{ marginLeft: 6 }}>Delete</span>
          </button>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div style={styles.filtersPanel}>
          <select 
            value={filters.category} 
            onChange={(e) => setFilters({ ...filters, category: e.target.value })} 
            style={styles.filterSelect}
          >
            <option value="">All Categories</option>
            <option value="Work">Work</option>
            <option value="Personal">Personal</option>
            <option value="Other">Other</option>
          </select>

          <select 
            value={filters.priority} 
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })} 
            style={styles.filterSelect}
          >
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>

          <select 
            value={filters.dueDate} 
            onChange={(e) => setFilters({ ...filters, dueDate: e.target.value })} 
            style={styles.filterSelect}
          >
            <option value="">Any due</option>
            <option value="today">Due Today</option>
            <option value="week">Due This Week</option>
          </select>

          <input 
            type="date" 
            value={filters.fromDate} 
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} 
            style={styles.filterInput} 
          />
          <input 
            type="date" 
            value={filters.toDate} 
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} 
            style={styles.filterInput} 
          />

          <button 
            style={{ ...styles.btn, ...styles.btnPrimary }} 
            onClick={() => setFilters({ category: "", priority: "", dueDate: "", fromDate: "", toDate: "" })}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* List View */}
      {viewMode === "list" ? (
        <div style={styles.listView}>
          {sortedTasks.length === 0 ? (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: "2rem" }}>
              No tasks found matching your criteria.
            </p>
          ) : (
            sortedTasks.map((task) => (
              <div 
                key={task.id} 
                style={{ ...styles.card, opacity: task.completed ? 0.6 : 1 }}
              >
                <div style={styles.cardRow}>
                  <div style={{ maxWidth: "55%", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTasks((s) => [...s, task.id]);
                        } else {
                          setSelectedTasks((s) => s.filter((id) => id !== task.id));
                        }
                      }}
                      style={{ marginTop: "4px" }}
                    />
                    <div>
                      <h4 style={{ 
                        ...styles.headerTitle, 
                        textDecoration: task.completed ? "line-through" : "none" 
                      }}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p style={styles.description}>{task.description}</p>
                      )}
                    </div>
                  </div>

                  <div style={styles.rightInfo}>
                    <div style={styles.headerRightRow}>
                      {task.priority && (
                        <span style={styles.priorityBadge(task.priority)}>
                          {task.priority}
                        </span>
                      )}
                      
                      <span style={styles.categoryBadge}>
                        {task.category}
                      </span>

                      <div style={{ 
                        display: "flex", 
                        flexDirection: "column", 
                        alignItems: "flex-end", 
                        gap: "6px", 
                        minWidth: "120px" 
                      }}>
                        {renderDateInfo(task)}
                      </div>

                      {/* Status Pill */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (task.status === "Overdue") {
                            setStatusFromList(task, "Completed");
                            return;
                          }
                          
                          if (task.status === "Active") {
                            if (task.due && isYesterday(task.due)) {
                              setToast({ 
                                message: "Task due yesterday cannot be set to In Progress; it should be Overdue.", 
                                timeout: 7000,
                                type: "warning" 
                              });
                              return;
                            }
                            
                            if (task.due && !isToday(task.due)) {
                              setModal({
                                message: "Task due date is not today. Set to In Progress anyway?",
                                onConfirm: () => {
                                  setModal(null);
                                  setStatusFromList(task, "In Progress");
                                },
                                onCancel: () => setModal(null),
                              });
                              return;
                            }
                            
                            setStatusFromList(task, "In Progress");
                            return;
                          }
                          
                          if (task.status === "In Progress") {
                            setStatusFromList(task, "Completed");
                            return;
                          }
                          
                          if (task.status === "Completed") {
                            if (task.due && isOverdue(task.due)) {
                              setToast({ 
                                message: "Completed task with overdue due date cannot be reactivated", 
                                timeout: 7000,
                                type: "warning"
                              });
                              return;
                            }
                            
                            setStatusFromList(task, "Active");
                            return;
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}
                        style={{ 
                          ...styles.actionBtn(task.completed), 
                          cursor: "pointer", 
                          userSelect: "none" 
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        // Kanban View
        <DragDropContext 
          onDragStart={onDragStart} 
          onDragUpdate={onDragUpdate} 
          onDragEnd={onDragEnd}
        >
          <div 
            id="kanban-scroll" 
            style={{ 
              display: "flex", 
              gap: "1rem", 
              overflowX: "auto", 
              overflowY: "visible", 
              paddingBottom: "1rem", 
              paddingTop: "6px", 
              scrollBehavior: "smooth", 
              WebkitOverflowScrolling: "touch", 
              scrollbarWidth: "thin", 
              cursor: isDragging ? "grabbing" : "default" 
            }}
          >
            {["Active", "In Progress", "Overdue", "Completed"].map((status) => (
              <Droppable droppableId={status} key={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      ...styles.kanbanColumnBase,
                      background: snapshot.isDraggingOver ? "var(--hover)" : "var(--card-bg)",
                      padding: "12px",
                    }}
                  >
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      marginBottom: 8 
                    }}>
                      <h3 style={{ margin: 0 }}>{status}</h3>
                      <span style={styles.taskCount}>
                        {tasksByStatus[status]?.length || 0}
                      </span>
                    </div>

                    <div style={styles.kanbanTasks}>
                      {filteredTasks
                        .filter((t) => {
                          if (status === "Completed") {
                            return t.completed || t.status === "Completed";
                          }
                          return t.status === status && !t.completed;
                        })
                        .sort((a, b) => {
                          // Sort by due date (earliest first), then by created date
                          const aDate = a.due ? new Date(a.due) : new Date(8640000000000000);
                          const bDate = b.due ? new Date(b.due) : new Date(8640000000000000);
                          if (aDate.getTime() !== bDate.getTime()) {
                            return aDate - bDate;
                          }
                          // If same due date, sort by created date (newest first)
                          const aCreated = a.createdAt ? new Date(a.createdAt) : new Date(0);
                          const bCreated = b.createdAt ? new Date(b.createdAt) : new Date(0);
                          return bCreated - aCreated;
                        })
                        .map((task, index) => (
                          <Draggable 
                            key={task.id} 
                            draggableId={String(task.id)} 
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  ...styles.kanbanCard,
                                  ...provided.draggableProps.style,
                                  opacity: snapshot.isDragging ? 0.95 : 1,
                                  boxShadow: snapshot.isDragging ? "0 5px 15px rgba(0,0,0,0.25)" : "var(--shadow)",
                                  cursor: snapshot.isDragging ? "grabbing" : "grab",
                                  marginBottom: "0.6rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  background: getCardColor(status),
                                }}
                              >
                                <div style={{ 
                                  display: "flex", 
                                  justifyContent: "space-between", 
                                  alignItems: "flex-start", 
                                  marginBottom: "6px" 
                                }}>
                                  <div style={{ 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    gap: "12px", 
                                    maxWidth: "70%" 
                                  }}>
                                    <h4 style={{ 
                                      fontSize: "0.95rem", 
                                      fontWeight: "600", 
                                      margin: 0, 
                                      wordBreak: "break-word", 
                                      lineHeight: "1.4" 
                                    }}>
                                      {task.title}
                                    </h4>
                                    <div style={{ 
                                      display: "flex", 
                                      gap: "6px", 
                                      flexWrap: "wrap", 
                                      alignItems: "center", 
                                      marginTop: "2px" 
                                    }}>
                                      {task.priority && (
                                        <span style={{ 
                                          ...styles.priorityBadge(task.priority), 
                                          fontSize: "0.72rem", 
                                          padding: "3px 8px" 
                                        }}>
                                          {task.priority}
                                        </span>
                                      )}
                                      {task.category && (
                                        <span style={{ 
                                          ...styles.categoryBadge, 
                                          fontSize: "0.72rem", 
                                          padding: "3px 8px" 
                                        }}>
                                          {task.category}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ 
                                    minWidth: "110px", 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    alignItems: "flex-end", 
                                    gap: "6px", 
                                    minHeight: "48px" 
                                  }}>
                                    {renderDateInfo(task)}
                                  </div>
                                </div>
                                
                                {task.description && (
                                  <p style={{
                                    fontSize: "0.85rem",
                                    color: "var(--muted)",
                                    margin: "4px 0 0 0",
                                    lineHeight: "1.3"
                                  }}>
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}