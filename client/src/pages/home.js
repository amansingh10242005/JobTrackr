// home.js (with integrated user search and toasts) - PRODUCTION READY
import { useState, useEffect, useRef } from "react";
import {
  BellIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
  ChevronLeftIcon,
  Bars3Icon,
  HomeIcon,
  BriefcaseIcon,
  ChartBarIcon,
  UsersIcon,
  CalendarIcon,
  UserIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  TrashIcon,
  CheckIcon,
  UserPlusIcon,
  CheckCircleIcon,
   ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import MyTasks from "../components/MyTasks";
import Analytics from "../components/Analytics";
import Collab from "../components/Collab";
import Calendar from "../components/Calendar";
import Profile from "../components/Profile";
import Settings from "../components/Settings";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api";

// User Search Component
function UserSearch({ onUserSelect, onInviteUser, currentProject, isCollabActive }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        return;
      }

      const response = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.users || []);
      setShowResults(true);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (value.length >= 2) {
      searchUsers(value);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleUserClick = (user) => {
    if (onUserSelect) {
      onUserSelect(user);
    }
    setShowResults(false);
    setSearchTerm("");
  };

  const handleInviteClick = (user, e) => {
    e.stopPropagation();
    if (onInviteUser) {
      onInviteUser(user);
    }
    setShowResults(false);
    setSearchTerm("");
  };

  if (!isCollabActive) return null;

  return (
    <div ref={searchRef} style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "8px", zIndex: 1000 }}>
      <div style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        boxShadow: "var(--shadow)",
        maxHeight: "300px",
        overflowY: "auto"
      }}>
        {isSearching ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
            Searching users...
          </div>
        ) : searchResults.length === 0 ? (
          searchTerm.length >= 2 ? (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
              No users found
            </div>
          ) : (
            <div style={{ padding: "1rem", textAlign: "center", color: "var(--muted)" }}>
              Type at least 2 characters to search users
            </div>
          )
        ) : (
          searchResults.map(user => (
            <div
              key={user.username}
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
              onClick={() => handleUserClick(user)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {user.photo ? (
                  <img
                    src={user.photo}
                    alt={user.name || user.username}
                    style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "var(--blue)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "600",
                  fontSize: "0.8rem",
                  display: user.photo ? 'none' : 'flex'
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: "600", color: "var(--text)" }}>
                    {user.name || user.username}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {user.position && `${user.position} • `}{user.email}
                  </div>
                </div>
              </div>

              {onInviteUser && currentProject && (
                <button
                  onClick={(e) => handleInviteClick(user, e)}
                  style={{
                    background: "var(--blue)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem"
                  }}
                >
                  <UserPlusIcon style={{ width: "14px", height: "14px" }} />
                  Invite
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Home() {
  // ---------- State ----------
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "Work",
    priority: "Medium",
    due: "",
    time: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [activePage, setActivePage] = useState("Home");
  const [taskFilter, setTaskFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // User search state
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [activeProject, setActiveProject] = useState(null);

  // Notifications (UI only - triggers moved to MyTasks)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const menuItems = [
    { label: "Home", icon: HomeIcon },
    { label: "My Tasks", icon: BriefcaseIcon },
    { label: "Analytics", icon: ChartBarIcon },
    { label: "Collab", icon: UsersIcon },
    { label: "Calendar", icon: CalendarIcon },
    { label: "My Profile", icon: UserIcon },
    { label: "Settings", icon: Cog6ToothIcon },
  ];

  // ---------- Styles (unchanged) ----------
  const styles = {
    taskCardMain: {
      background: "var(--card-bg)",
      padding: "26px",
      borderRadius: "14px",
      marginBottom: "24px",
      boxShadow: "var(--shadow)",
      border: "1px solid var(--border)",
    },
    taskCardHeader: { margin: 0, fontSize: "1.25rem" },
    taskCardBody: { marginTop: "14px" },
    inputTitle: {
      width: "100%",
      padding: "0.9rem 1rem",
      fontSize: "1rem",
      borderRadius: "10px",
      border: "1px solid var(--border)",
      background: "var(--input-bg)",
      marginBottom: "12px",
    },
    inputDesc: {
      width: "100%",
      padding: "0.9rem 1rem",
      fontSize: "1rem",
      borderRadius: "10px",
      border: "1px solid var(--border)",
      background: "var(--input-bg)",
      marginBottom: "12px",
      minHeight: "86px",
      resize: "vertical",
    },
    formRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
      gap: "16px",
      alignItems: "center",
    },
    select: {
      minWidth: "150px",
      padding: "0.8rem 0.9rem",
      borderRadius: "10px",
      border: "1px solid var(--border)",
      background: "var(--input-bg)",
    },
    inputDate: {
      minWidth: "150px",
      padding: "0.8rem 0.9rem",
      borderRadius: "10px",
      border: "1px solid var(--border)",
      background: "var(--input-bg)",
    },
    btnPrimary: {
      background: "var(--blue)",
      color: "#fff",
      border: "none",
      borderRadius: "12px",
      padding: "0.7rem 1.2rem",
      fontSize: "0.95rem",
      cursor: "pointer",
    },
    analyticsCards: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px",
      margin: "24px 0 20px",
    },
    card: {
      background: "var(--card-bg)",
      padding: "18px",
      borderRadius: "12px",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      fontWeight: 600,
      fontSize: "1rem",
      cursor: "pointer",
    },
    cardActive: { color: "#f97316" },
    cardOverdue: { color: "#ef4444" },
    cardCompleted: { color: "#22c55e" },
    taskList: {
      display: "flex",
      flexDirection: "column",
      gap: "18px",
      marginBottom: "32px",
    },
    noTasks: { color: "var(--muted)" },
    taskCard: {
      background: "var(--card-bg)",
      padding: "18px 20px",
      borderRadius: "12px",
      border: "1px solid var(--border)",
      boxShadow: "var(--shadow)",
      transition: "opacity 0.3s ease",
    },
    taskHeaderRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    },
    taskTitle: { margin: 0, fontSize: "1.05rem", fontWeight: 700 },
    taskMeta: { display: "flex", gap: "8px", alignItems: "center" },
    chip: {
      padding: "6px 10px",
      borderRadius: "999px",
      fontSize: "0.8rem",
      border: "1px solid transparent",
    },
    chipLow: { background: "#f1f5f9", color: "#334155" },
    chipMedium: { background: "#fef9c3", color: "#ca8a04" },
    chipHigh: { background: "#fee2e2", color: "#dc2626" },
    chipCategory: { background: "#eff6ff", color: "#2563eb" },
    chipDue: {
      background: "transparent",
      color: "var(--muted)",
      border: "1px dashed rgba(0,0,0,0.04)",
    },
    taskDescription: {
      fontSize: "0.95rem",
      color: "var(--muted)",
      margin: "12px 0",
    },
    taskFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    statusBtn: {
      borderRadius: "10px",
      border: "1px solid #e6eefb",
      padding: "8px 14px",
      background: "var(--card-bg)",
      cursor: "pointer",
      fontWeight: 600,
      color: "var(--text)",
    },
    statusBtnCompleted: { background: "transparent", color: "var(--muted)" },
  };

  // ---------- API helper ----------
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

      if (!res.ok) {
        console.error(`API Error ${res.status}: ${path}`, {
          status: res.status,
          statusText: res.statusText
        });

        const text = await res.text();
        let data;
        try { 
          data = text ? JSON.parse(text) : {}; 
        } catch (e) { 
          data = { message: text }; 
        }

        const errMsg = data.error || data.message || "API request failed";
        const err = new Error(errMsg);
        err.response = data;
        throw err;
      }
      
      const text = await res.text();
      let data;
      try { 
        data = text ? JSON.parse(text) : {}; 
      } catch (e) { 
        data = { message: text }; 
      }
      return data;
    } catch (error) {
      console.error(`API fetch error for ${path}:`, error);
      throw error;
    }
  };

  // ---------- Effects ----------
  useEffect(() => {
    setHydrated(true);

    const init = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (token) {
        try {
          const data = await apiFetch("/tasks");
          const tasksFromServer = Array.isArray(data.tasks) ? data.tasks : (data || []);
          const fixed = tasksFromServer.map((t) => {
            const completedVal = typeof t.completed === "boolean" ? t.completed : t.status === "Completed";
            return {
              ...t,
              completed: completedVal,
              status: completedVal ? "Completed" : t.status || "Active",
            };
          });
          setTasks(fixed);
        } catch (err) {
          console.error("Failed to fetch tasks from backend, falling back to local cache:", err);
          const saved = localStorage.getItem("tasks");
          if (saved) {
            try {
              setTasks(JSON.parse(saved));
            } catch (e) {
              console.error("Failed to parse saved tasks:", e);
            }
          }
        }
      } else {
        const saved = localStorage.getItem("tasks");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const fixed = Array.isArray(parsed)
              ? parsed.map((t) => {
                  const completedVal = typeof t.completed === "boolean" ? t.completed : t.status === "Completed";
                  return {
                    ...t,
                    completed: completedVal,
                    status: completedVal ? "Completed" : t.status || "Active",
                  };
                })
              : [];
            setTasks(fixed);
          } catch (err) {
            console.error("Failed to parse saved tasks:", err);
          }
        }
      }

      const theme = localStorage.getItem("theme");
      if (theme === "dark") {
        setDarkMode(true);
        document.documentElement.setAttribute("data-theme", "dark");
      }

      // Load notifications
      // Load notifications
try {
  const token = localStorage.getItem("token");
  if (token) {
    // Try to load from backend first
    const data = await apiFetch("/notifications");
    if (data && data.notifications) {
      setNotifications(data.notifications);
    }
  } else {
    // Fallback to local storage
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
  }
} catch (err) {
  console.error("Failed to load notifications:", err);
  // Fallback to local storage
  const savedNotifications = localStorage.getItem("notifications");
  if (savedNotifications) {
    setNotifications(JSON.parse(savedNotifications));
  }
}
    };

    init();
  }, []);
  

  // Persist notifications
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("notifications", JSON.stringify(notifications));
    } catch (err) {
      console.error("Failed to save notifications:", err);
    }
  }, [notifications, hydrated]);

  // Persist tasks to localStorage when not using backend
  useEffect(() => {
    if (!hydrated) return;
    const token = localStorage.getItem("token");
    if (!token) {
      try {
        localStorage.setItem("tasks", JSON.stringify(tasks));
      } catch (err) {
        console.error("Failed to save tasks:", err);
      }
    }
  }, [tasks, hydrated]);

  // Toast auto cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.timeout || 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Add this useEffect to listen for new notifications from MyTasks
useEffect(() => {
  const handleNewNotification = (event) => {
    if (event.detail) {
      setNotifications(prev => [event.detail, ...prev]);
    }
  };

  window.addEventListener('newNotification', handleNewNotification);
  
  return () => {
    window.removeEventListener('newNotification', handleNewNotification);
  };
}, []);

  // ---------- Notification UI helpers (no triggers) ----------
  const markNotificationAsRead = async (id) => {
  // Update local state immediately
  setNotifications((prev) => {
    const next = prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif));
    try { localStorage.setItem("notifications", JSON.stringify(next)); } catch (e) {}
    return next;
  });

  try {
    // Only call API if we have a valid token AND the notification has a proper ID format
    const token = localStorage.getItem("token");
    if (token && id && typeof id === 'string' && id.length > 0) {
      // Check if it's a Firestore-like ID (not a numeric local storage ID)
      if (!/^\d+$/.test(id)) { // If it's not just numbers (local storage IDs are usually numbers)
        await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
      }
    }
  } catch (err) {
    console.warn("Failed to mark notification read on server", err);
    // Don't revert the local state - keep it as read in UI
  }
};

  const markAllNotificationsAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await apiFetch("/notifications/mark-all-read", { method: "POST" });
    } catch (err) {
      console.warn("Failed to mark-all-read on server", err);
    }
  };

  const deleteNotification = async (id) => {
  setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  try {
    const token = localStorage.getItem("token");
    if (token && id && typeof id === 'string' && id.length > 0 && !/^\d+$/.test(id)) {
      await apiFetch(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  } catch (err) {
    console.warn("Failed to delete notification on server", err);
  }
};

  const clearAllNotifications = async () => {
    setNotifications([]);
    try {
      await apiFetch("/notifications/clear", { method: "POST" });
    } catch (err) {
      console.warn("Failed to clear notifications on server", err);
    }
  };

  // ---------- Helpers ----------
  const toggleTheme = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      document.documentElement.setAttribute("data-theme", newMode ? "dark" : "light");
      localStorage.setItem("theme", newMode ? "dark" : "light");
      return newMode;
    });
  };

  const addTask = async () => {
  if (!newTask.title.trim()) {
    setToast({ message: "Please enter a task title", timeout: 2000 });
    return;
  }
  setLoading(true);

  const body = {
    title: newTask.title,
    description: newTask.description,
    category: newTask.category,
    priority: newTask.priority,
    due: newTask.due || null,
    time: newTask.time || null, 
  };

  const optimisticTask = { 
    ...body, 
    id: Date.now(), 
    completed: false, 
    status: "Active",
    time: newTask.time || null 
  };

    setTasks((prev) => [optimisticTask, ...prev]);

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const data = await apiFetch("/tasks", { method: "POST", body });
        const createdTask = data.task || data;
        setTasks((prev) => {
          const withoutOpt = prev.filter((t) => t.id !== optimisticTask.id);
          return [createdTask, ...withoutOpt];
        });
        setToast({ message: "Task added successfully", timeout: 2000 });
      } else {
        // Local storage only
        setToast({ message: "Task added successfully", timeout: 2000 });
      }
    } catch (err) {
      console.error("Failed to create task on server, keeping optimistic item in UI", err);
      setToast({ message: "Failed to add task", timeout: 2000 });
    } finally {
      setNewTask({
        title: "",
        description: "",
        category: "Work",
        priority: "Medium",
        due: "",
        time: ""
      });
      setLoading(false);
    }
  };

  const toggleTask = async (id) => {
    const prevTasks = tasks;
    const target = prevTasks.find((t) => t.id === id);
    if (!target) return;

    // === RESTRICTION  ===
  if (target.completed && isOverdue(target.due)) {
    setToast({ 
      message: "Completed task with overdue due date cannot be reactivated", 
      timeout: 3000,
      type: "warning"
    });
    return;
  }

    const newCompleted = !target.completed;
    const optimistic = prevTasks.map((t) =>
      t.id === id
        ? {
            ...t,
            completed: newCompleted,
            status: newCompleted ? "Completed" : "Active",
            completedAt: newCompleted ? new Date().toISOString() : null,
          }
        : t
    );

    setTasks(optimistic);

    try {
      const token = localStorage.getItem("token");
      if (token) {
        await apiFetch(`/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: { completed: newCompleted },
        });
        setToast({ message: `Task marked as ${newCompleted ? 'completed' : 'active'}`, timeout: 2000 });
      }
    } catch (err) {
      console.error("Failed to toggle task on server; reverting", err);
      setTasks(prevTasks);
      setToast({ message: "Failed to update task", timeout: 2000 });
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  const filteredByStatus = tasks.filter((task) => {
    if (taskFilter === "Active") return !task.completed;
    if (taskFilter === "Completed") return task.completed;
    if (taskFilter === "Overdue")
      return !task.completed && task.due && isOverdue(task.due);
    return true;
  });

  const filteredTasks = filteredByStatus.filter((task) =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    if (a.due && b.due) return new Date(a.due) - new Date(b.due);
    return 0;
  });

  const handleProfileAction = (action) => {
    if (action === "logout") {
      localStorage.removeItem("token");
      localStorage.removeItem("tasks");
      localStorage.removeItem("notifications");
      if (typeof window !== "undefined") window.location.href = "/login";
      return;
    }
    if (action === "profile") {
      setActivePage("My Profile");
    }
  };

  // User search handlers
  const handleUserSearchChange = (e) => {
    const value = e.target.value;
    setUserSearchTerm(value);
    setShowUserSearch(value.length >= 2);
  };

  const handleUserSelect = (user) => {
    setToast({ message: `Selected user: ${user.name || user.username}`, timeout: 2000 });
    // You can add more user selection logic here
  };

  const handleInviteUser = (user) => {
    setToast({ message: `Invited ${user.name || user.username} to the project`, timeout: 2000 });
    // This will be handled by the Collab component when active
  };

  if (!hydrated) return <div>Loading...</div>;

  const renderActivePage = () => {
    switch (activePage) {
      case "Home":
        return (
          <>
            <section style={styles.taskCardMain}>
              <div style={styles.taskCardHeader}>
                <h3>Add New Task</h3>
              </div>

              <div style={styles.taskCardBody}>
                <input
                  style={styles.inputTitle}
                  type="text"
                  placeholder="Task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && addTask()}
                />
                <textarea
                  style={styles.inputDesc}
                  placeholder="Short description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                />

                <div style={styles.formRow}>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    style={styles.select}
                  >
                    <option>Work</option>
                    <option>Personal</option>
                    <option>Other</option>
                  </select>

                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    style={styles.select}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>

                  <input
                    type="date"
                    style={styles.inputDate}
                    value={newTask.due}
                    onChange={(e) => setNewTask({ ...newTask, due: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <input
                  type="time"
                  style={styles.inputDate}
                  value={newTask.time || ""}
                  onChange={(e) => setNewTask({ ...newTask, time: e.target.value })}
                  />
                  <div>
                    <button
                      onClick={addTask}
                      style={styles.btnPrimary}
                      aria-label="Add task"
                      disabled={loading || !newTask.title.trim()}
                    >
                      {loading ? "Adding..." : "Add Task"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.analyticsCards}>
              {["Active", "Overdue", "Completed", "Total"].map((status) => {
                let count = 0;
                if (status === "Active") count = tasks.filter((t) => !t.completed).length;
                else if (status === "Overdue")
                  count = tasks.filter((t) => !t.completed && t.due && isOverdue(t.due)).length;
                else if (status === "Completed") count = tasks.filter((t) => t.completed).length;
                else count = tasks.length;

                const isActiveFilter = taskFilter === status;
                const cardStyle = isActiveFilter
                  ? { border: "2px solid #2563eb", color: "#2563eb" }
                  : status === "Active"
                  ? styles.cardActive
                  : status === "Overdue"
                  ? styles.cardOverdue
                  : status === "Completed"
                  ? styles.cardCompleted
                  : {};

                return (
                  <div
                    key={status}
                    style={{ ...styles.card, ...cardStyle }}
                    onClick={() => setTaskFilter(status)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && setTaskFilter(status)}
                  >
                    <div>
                      {status}: {count}
                    </div>
                  </div>
                );
              })}
            </section>

            <section style={styles.taskList}>
              {sortedTasks.length === 0 ? (
                <p style={styles.noTasks}>No tasks match your search or filter.</p>
              ) : (
                sortedTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      ...styles.taskCard,
                      opacity: task.completed ? 0.6 : 1,
                    }}
                  >
                    <div style={styles.taskHeaderRow}>
                      <h4 style={styles.taskTitle}>{task.title}</h4>
                      <div style={styles.taskMeta}>
                        <span
                          style={{
                            ...styles.chip,
                            ...(task.priority === "Low"
                              ? styles.chipLow
                              : task.priority === "Medium"
                              ? styles.chipMedium
                              : styles.chipHigh),
                          }}
                        >
                          {task.priority}
                        </span>
                        <span style={{ ...styles.chip, ...styles.chipCategory }}>
                          {task.category}
                        </span>
                        {task.due && (
                          <span
                            style={{
                              ...styles.chip,
                              ...styles.chipDue,
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              color: isOverdue(task.due) && !task.completed ? '#ef4444' : 'var(--muted)'
                            }}
                          >
                            <CalendarIcon style={{ width: "16px", height: "16px" }} />
                            <span>{new Date(task.due).toLocaleDateString()}</span>
                          </span>
                        )}

                        <button
                          onClick={() => toggleTask(task.id)}
                          style={{
                            ...styles.statusBtn,
                            ...(task.completed ? { background: "#22c55e", color: "#fff" } : {}),
                          }}
                          aria-label={task.completed ? "Undo complete" : "Mark complete"}
                        >
                          {task.completed ? "Undo" : "Complete"}
                        </button>
                      </div>
                    </div>

                    {task.description && (
                      <p style={styles.taskDescription}>{task.description}</p>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        );
      case "My Tasks":
        return <MyTasks tasks={tasks} setTasks={setTasks} onToggleTask={toggleTask} />;
      case "Analytics":
        return <Analytics tasks={tasks} />;
      case "Collab":
        return <Collab onProjectChange={setActiveProject} />;
      case "Calendar":
        return <Calendar tasks={tasks} />;
      case "My Profile":
        return <Profile />;
      case "Settings":
        return <Settings />;
      default:
        return null;
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`appLayout ${collapsed ? "collapsed" : ""}`}>
      <header className="header">
        <div className="headerLeft">
          <span className="logo">JobTrackr</span>
        </div>

        <div className="headerMiddle" style={{ position: "relative", width: "100%" }}>
          <div className="searchWrapper" style={{ position: "relative" }}>
            <MagnifyingGlassIcon className="searchIcon" />
            <input
              type="text"
              placeholder={activePage === "Collab" ? "Search tasks or users..." : "Search tasks..."}
              className="searchInput"
              value={activePage === "Collab" ? userSearchTerm : searchTerm}
              onChange={activePage === "Collab" ? handleUserSearchChange : (e) => setSearchTerm(e.target.value)}
              style={{ width: "100%" }}
            />
            
            {/* User search dropdown - only shows on Collab page */}
            {activePage === "Collab" && showUserSearch && (
              <UserSearch 
                onUserSelect={handleUserSelect}
                onInviteUser={handleInviteUser}
                currentProject={activeProject}
                isCollabActive={activePage === "Collab"}
              />
            )}
          </div>
        </div>

        <div className="headerRight" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={toggleTheme} className="iconBtn" aria-label="Toggle theme">
            {darkMode ? <SunIcon className="icon" /> : <MoonIcon className="icon" />}
          </button>

          <div style={{ position: "relative" }}>
            <BellIcon
              className="icon"
              style={{ width: 24, height: 24, cursor: "pointer" }}
              onClick={() => setNotificationsOpen((p) => !p)}
              aria-label={`Notifications ${unreadNotificationsCount > 0 ? `(${unreadNotificationsCount} unread)` : ''}`}
            />
            {unreadNotificationsCount > 0 && (
              <span style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "var(--blue)",
                color: "#fff",
                borderRadius: "50%",
                minWidth: 16,
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
              }}>
                {unreadNotificationsCount}
              </span>
            )}
          </div>

          {notificationsOpen && (
            <>
              <div
                onClick={() => setNotificationsOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.12)",
                  zIndex: 999,
                }}
              />

              <div
                className="notificationOverlay"
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "min(900px, calc(100% - 48px))",
                  maxHeight: "90vh",
                  background: "var(--card-bg)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
                  display: "flex",
                  flexDirection: "column",
                  zIndex: 1000,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Notifications panel"
              >
                <div
                  style={{
                    padding: "16px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Notifications</h3>
                  <button
                    className="notif-close"
                    onClick={() => setNotificationsOpen(false)}
                    aria-label="Close notifications"
                    title="Close"
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    <XMarkIcon style={{ width: 18, height: 18 }} />
                  </button>
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "12px 16px",
                  }}
                  className="notificationsList"
                >
                  {notifications.length === 0 ? (
                    <p style={{ color: "var(--muted)" }}>No notifications</p>
                  ) : (
                    <>
                      {notifications.some((n) => !n.read) && (
                        <>
                          <h4 style={{ margin: "8px 0 6px", fontWeight: "700", color: "var(--text)" }}>
                            Unread Notifications
                          </h4>
                          {notifications
                            .filter((n) => !n.read)
                            .map((n) => (
                              <div
                                key={`unread-${n.id}`}
                                className="notif-item unread"
                                onClick={() => {
  // Only mark as read if it's not already read
  if (!n.read) {
    markNotificationAsRead(n.id);
  } else {
    // If already read, just close the notification panel
    setNotificationsOpen(false);
  }
}}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "12px",
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  marginBottom: "8px",
                                  cursor: "pointer",
                                  background: "rgba(37,99,235,0.08)",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                    {n.title || "Task Update"}
                                  </p>
                                  <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "6px 0 0" }}>
                                    {n.message}
                                  </p>
                                  <small style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>
                                    {new Date(n.timestamp).toLocaleString()}
                                  </small>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(n.id);
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 6,
                                    cursor: "pointer",
                                  }}
                                  title="Delete"
                                  aria-label="Delete notification"
                                >
                                  <TrashIcon style={{ width: 16, height: 16 }} />
                                </button>
                              </div>
                            ))}
                        </>
                      )}

                      {notifications.length > 0 && (
                        <>
                          <h4 style={{ margin: "18px 0 6px", fontWeight: "700", color: "var(--text)" }}>
                            Read Notifications
                          </h4>
                          {notifications
                            .filter((n) => n.read)
                            .map((n) => (
                              <div
                                key={`read-${n.id}`}
                                className="notif-item read"
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "12px",
                                  padding: "12px",
                                  borderBottom: "1px solid var(--border)",
                                  borderRadius: "8px",
                                  marginBottom: "8px",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                                    {n.title || "Task Update"}
                                  </p>
                                  <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "6px 0 0" }}>
                                    {n.message}
                                  </p>
                                  <small style={{ display: "block", marginTop: 6, color: "var(--muted)" }}>
                                    {new Date(n.timestamp).toLocaleString()}
                                  </small>
                                </div>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteNotification(n.id);
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 6,
                                    cursor: "pointer",
                                  }}
                                  title="Delete"
                                  aria-label="Delete notification"
                                >
                                  <TrashIcon style={{ width: 16, height: 16 }} />
                                </button>
                              </div>
                            ))}
                        </>
                      )}
                    </>
                  )}
                </div>

                <div
                  style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border)",
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "8px",
                  }}
                >
                  <button
                    className="notif-btn notif-btn-ghost"
                    onClick={markAllNotificationsAsRead}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      padding: "8px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CheckIcon style={{ width: 16, height: 16 }} />
                    <span style={{ marginLeft: 0 }}>Mark All Read</span>
                  </button>

                  <button
                    className="notif-btn notif-btn-primary"
                    onClick={clearAllNotifications}
                    style={{
                      background: "var(--blue)",
                      color: "#fff",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <TrashIcon style={{ width: 16, height: 16, color: "#fff" }} />
                    <span style={{ marginLeft: 0 }}>Clear All</span>
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            className="iconBtn"
            title="Logout"
            onClick={() => handleProfileAction("logout")}
            aria-label="Logout"
          >
            <ArrowRightOnRectangleIcon className="icon" />
          </button>
        </div>
      </header>

      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        {!collapsed ? (
          <div className="logoWithChevron">
            <span className="logo">JobTrackr</span>
            <ChevronLeftIcon 
              className="icon" 
              onClick={() => setCollapsed(true)} 
              style={{ cursor: "pointer" }}
              aria-label="Collapse sidebar"
            />
          </div>
        ) : (
          <div className="collapsedHeader">
            <Bars3Icon 
              className="icon" 
              onClick={() => setCollapsed(false)} 
              style={{ cursor: "pointer" }}
              aria-label="Expand sidebar"
            />
          </div>
        )}
        {menuItems.map(({ label, icon: IconComp }) => (
          <div
            key={label}
            className={`navItem ${activePage === label ? "activeNav" : ""}`}
            onClick={() => setActivePage(label)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && setActivePage(label)}
            aria-label={`Navigate to ${label}`}
          >
            <IconComp className="navIcon" />
            {!collapsed && <span>{label}</span>}
          </div>
        ))}
      </aside>

      <main className="mainContent">
        <div className="container">{renderActivePage()}</div>
      </main>

      <footer className="footer">© {new Date().getFullYear()} JobTrackr</footer>

      {/* Toast Messages */}
      {toast && (
  <div style={{
    position: "fixed",
    top: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "var(--card-bg)",
    color: "var(--text)",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    borderColor: toast.type === "warning" ? "#f59e0b" : "var(--border)"
  }}>
    {toast.type === "warning" ? (
      <ExclamationTriangleIcon width={16} color="#f59e0b" />
    ) : (
      <CheckCircleIcon width={16} color="#22c55e" />
    )}
    {toast.message}
  </div>
)}

    </div>
  );
}