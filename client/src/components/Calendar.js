// components/Calendar.js
import { useState, useEffect, useMemo } from "react";
import { 
  CalendarIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";

const CalendarAPI = {
  baseURL: (() => {
    const base = (process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api").replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  })(),

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('token');
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  // Google Calendar OAuth
  async getAuthUrl() {
    return this.request('/calendar/auth');
  },

  async checkCalendarConnection() {
    // Fixed: Remove username from endpoint - backend uses token
    return this.request('/calendar/connection');
  },

  // Task events
  async syncTaskToCalendar(taskId , data = {}) {
    return this.request(`/calendar/tasks/${taskId}/sync`, { method: 'POST', body: data });
  },

  async removeTaskFromCalendar(taskId) {
    return this.request(`/calendar/tasks/${taskId}/unsync`, { method: 'POST' });
  },

  // Get calendar events
  async getCalendarEvents(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('start', startDate.toISOString());
    if (endDate) params.append('end', endDate.toISOString());
    
    return this.request(`/calendar/events?${params}`);
  }
};

export default function Calendar({ tasks: tasksFromProps = null, collapsed }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [tasks, setTasks] = useState(tasksFromProps || []);
  const [loading, setLoading] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState({});
  const [oauthLoading, setOauthLoading] = useState(false);
  const [connectionCheckLoading, setConnectionCheckLoading] = useState(false);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  // ADD THESE HELPERS AT THE TOP OF YOUR COMPONENT:
const formatDateForComparison = (dateString) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const hasValidTime = (task) => {
  return task.time && typeof task.time === 'string' && task.time.trim() !== '';
};

  // Load tasks from backend if not provided as props
  useEffect(() => {
    if (tasksFromProps) return;
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const data = await CalendarAPI.request('/tasks');
        if (data.tasks) {
          setTasks(data.tasks);
          
          // Initialize sync status
          const status = {};
          data.tasks.forEach(task => {
            status[task.id] = {
              synced: !!task.googleEventId,
              loading: false
            };
          });
          setSyncStatus(status);
        }
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [tasksFromProps]);

  // Check Google connection on component mount
  useEffect(() => {
    checkGoogleConnected();
  }, []);

  // Auto-sync new tasks when Google is connected
useEffect(() => {
  if (googleConnected && autoSync) {
    const unsyncedTasks = tasks.filter(task => 
      !syncStatus[task.id]?.synced && 
      task.due && 
      !task.completed &&
      !syncStatus[task.id]?.loading &&
      task.time 
    );
    
    // Add debouncing to prevent multiple rapid syncs
    if (unsyncedTasks.length > 0) {
      const syncTimer = setTimeout(() => {
        unsyncedTasks.forEach(task => {
          if (!syncStatus[task.id]?.loading) {
            syncTask(task.id);
          }
        });
      }, 1000); // 1 second delay
      
      return () => clearTimeout(syncTimer);
    }
  }
}, [googleConnected, autoSync, tasks, syncStatus]);

  // Helper: check if a date is today
  const isToday = (dateStr) => {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00'); // Force local time
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d.getTime() === todayStart.getTime();
};

  // Helper: check if a task is overdue
  const isOverdue = (task) => {
    if (task.completed) return false;
    const due = new Date(task.due);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return due.getTime() < todayStart;
  };

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Prepare calendar days - compute tasks per date
  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const tasksDue = tasks.filter((task) => {
        if (!task.due) return false;
        const taskDate = new Date(task.due);
        const taskDateStr = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, "0")}-${String(taskDate.getDate()).padStart(2, "0")}`;
        return taskDateStr === dateStr;
      });

      days.push({
        day,
        date: dateStr,
        hasTasks: tasksDue.length > 0,
        tasksCount: tasksDue.length,
        tasksDue,
      });
    }
    return days;
  }, [month, year, tasks, firstDay, daysInMonth]);

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(year, month + direction, 1));
    setSelectedDate(null);
  };

  // Google Calendar integration functions
  const checkGoogleConnected = async () => {
    try {
      setConnectionCheckLoading(true);
      const result = await CalendarAPI.checkCalendarConnection();
      setGoogleConnected(result.connected);
    } catch (err) {
      console.error('Failed to check Google connection:', err);
      setGoogleConnected(false);
    } finally {
      setConnectionCheckLoading(false);
    }
  };

  const connectGoogleCalendar = async () => {
    setOauthLoading(true);
    try {
      const result = await CalendarAPI.getAuthUrl();
      
      // Open OAuth in new window
      const width = 600;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authWindow = window.open(
        result.url,
        'google_auth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      // Check for OAuth completion
      const checkAuth = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkAuth);
          setTimeout(() => {
            checkGoogleConnected();
            setOauthLoading(false);
          }, 2000); // Wait 2 seconds for backend to process
        }
      }, 1000);

    } catch (err) {
      console.error('Failed to connect Google Calendar:', err);
      alert('Failed to connect to Google Calendar. Please try again.');
      setOauthLoading(false);
    }
  };

  const syncTask = async (taskId) => {
  if (!googleConnected) {
    alert('Please connect Google Calendar first');
    return;
  }

  // Get the task to ensure we have time data
  const taskToSync = tasks.find(task => task.id === taskId);
  if (!taskToSync) {
    console.error('Task not found for sync:', taskId);
    return;
  }

  setSyncStatus(prev => ({
    ...prev,
    [taskId]: { ...prev[taskId], loading: true }
  }));

  try {
    // Ensure time is included in sync request
    await CalendarAPI.syncTaskToCalendar(taskId, {
    time: taskToSync.time
  });
    
    setSyncStatus(prev => ({
      ...prev,
      [taskId]: { synced: true, loading: false }
    }));

    // Reload tasks to get updated googleEventId
    if (!tasksFromProps) {
      const data = await CalendarAPI.request('/tasks');
      if (data.tasks) setTasks(data.tasks);
    }
    
    console.log('Task synced with time:', taskToSync.time); // Debug log
  } catch (err) {
    console.error('Failed to sync task:', err);
    alert(err.message || 'Failed to sync task to Google Calendar');
    setSyncStatus(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], loading: false }
    }));
  }
};
  const unsyncTask = async (taskId) => {
    setSyncStatus(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], loading: true }
    }));

    try {
      await CalendarAPI.removeTaskFromCalendar(taskId);
      
      setSyncStatus(prev => ({
        ...prev,
        [taskId]: { synced: false, loading: false }
      }));

      // Reload tasks
      if (!tasksFromProps) {
        const data = await CalendarAPI.request('/tasks');
        if (data.tasks) setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to unsync task:', err);
      alert(err.message || 'Failed to remove task from Google Calendar');
      setSyncStatus(prev => ({
        ...prev,
        [taskId]: { ...prev[taskId], loading: false }
      }));
    }
  };

  const syncAllTasks = async () => {
    if (!googleConnected) {
      alert('Please connect Google Calendar first');
      return;
    }

    const unsyncedTasks = tasks.filter(task => 
      !syncStatus[task.id]?.synced && 
      task.due && 
      !task.completed
    );
    
    if (unsyncedTasks.length === 0) {
      alert('All tasks are already synced!');
      return;
    }

    for (const task of unsyncedTasks) {
      await syncTask(task.id);
    }
    
    alert(`Successfully synced ${unsyncedTasks.length} tasks to Google Calendar!`);
  };

  // Styles matching Home.js exactly
  const styles = {
  calendar: {
    background: "var(--card-bg)",
    padding: "26px",
    borderRadius: "14px",
    marginBottom: "24px",
    boxShadow: "var(--shadow)",
    border: "1px solid var(--border)",
    minHeight: collapsed ? "auto" : "500px",
  },
  collapsed: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "0.5rem",
    cursor: "pointer"
  },
  calendarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px"
  },
  calendarNav: {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    color: "var(--text)",
    padding: "0.7rem",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    transition: "all 0.2s ease",
  },
  calendarTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "var(--text)",
    margin: 0,
    minWidth: "200px",
    textAlign: "center"
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "6px" // Reduced gap for smaller boxes
  },
  calendarDayHeader: {
    textAlign: "center",
    fontWeight: "600",
    color: "var(--muted)",
    padding: "8px 4px", // Reduced padding
    fontSize: "0.8rem", // Smaller font
  },
  calendarDay: {
    textAlign: "center",
    padding: "8px 4px", // Reduced padding for smaller boxes
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.85rem", // Smaller font
    position: "relative",
    transition: "all 0.2s ease",
    userSelect: "none",
    minHeight: "60px", // Reduced height
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center", // Center content vertically and horizontally
    border: "1px solid var(--border)",
    background: "var(--card-bg)"
  },
  emptyDay: {
    background: "transparent",
    cursor: "default",
    border: "none"
  },
  hasTasks: {
  background: "var(--card-bg)",
  border: "1px solid var(--border)",
  cursor: "pointer"
},
  selectedDate: {
  background: "var(--blue)",
  color: "white",
  transform: "scale(1.02)",
  boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
  border: "2px solid var(--blue)",
  position: "relative"
},

  todayDate: {
    border: "2px solid #0099ffff",
    background: "var(--card-bg)",
    fontWeight: "bold"
  },
 taskIndicator: {
  position: "absolute",
  bottom: "4px",
  right: "4px",
  width: "18px",
  height: "18px",
  background: "var(--blue)",
  color: "white",
  borderRadius: "50%",
  fontSize: "0.65rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "600",
},


  dateTasks: {
    marginTop: "24px",
    paddingTop: "24px",
    borderTop: "1px solid var(--border)",
    animation: "fadeIn 0.3s ease"
  },
  miniTask: {
    background: "var(--card-bg)",
    padding: "16px 20px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow)",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    transition: "all 0.2s ease",
  },
  completed: {
    textDecoration: "line-through",
    color: "var(--muted)",
    opacity: 0.7,
  },
  overdue: {
    borderLeft: "4px solid #ef4444",
  },
  upcoming: {
    borderLeft: "4px solid #22c55e",
  },
  controlRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap"
  },
  smallBtn: {
    padding: "0.7rem 1.2rem",
    borderRadius: "10px",
    border: "1px solid var(--border)",
    cursor: "pointer",
    background: "var(--card-bg)",
    color: "var(--text)",
    fontSize: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.2s ease",
    fontWeight: "500",
  },
  btnPrimary: {
    background: "var(--blue)",
    color: "#fff",
    border: "none",
  },
  successBtn: {
    background: "#22c55e",
    color: "white",
    border: "none",
  },
  syncButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontSize: "0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    transition: "all 0.2s ease",
    fontWeight: "500",
    minWidth: "32px",
    justifyContent: "center"
  },
  syncSynced: {
    background: "#22c55e",
    color: "white"
  },
  syncUnsynced: {
    background: "var(--muted)",
    color: "white"
  },
  taskTitle: {
    flex: 1,
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: "500"
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.8rem",
    padding: "4px 8px",
    borderRadius: "6px",
    background: "var(--muted-bg)",
    color: "var(--muted)"
  },
  upcomingBadge: {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    background: "var(--blue)",
    color: "white",
    borderRadius: "50%",
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.7rem",
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(255, 255, 255, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "14px",
    zIndex: 10
  },
   dropdown: {
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    padding: "0.7rem",
    borderRadius: "10px",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    minWidth: "120px"
  },
  checkboxLabel: {
    fontSize: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "var(--card-bg)",
    border: "1px solid var(--border)",
  }
};
  return (
    <div style={collapsed ? {...styles.calendar, ...styles.collapsed} : styles.calendar}>
      {!collapsed && (
        <>
          <div style={styles.calendarHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
  <button 
    onClick={() => navigateMonth(-1)} 
    style={styles.calendarNav}
    disabled={loading}
  >
    <ChevronLeftIcon style={{ width: "18px", height: "18px" }} />
  </button>
  
  {/* MONTH DROPDOWN */}
  <select 
    value={month}
    onChange={(e) => setCurrentDate(new Date(year, parseInt(e.target.value), 1))}
    style={styles.dropdown}
  >
    {monthNames.map((monthName, index) => (
      <option key={index} value={index}>{monthName}</option>
    ))}
  </select>
  
  {/* YEAR DROPDOWN */}
  <select 
    value={year}
    onChange={(e) => setCurrentDate(new Date(parseInt(e.target.value), month, 1))}
    style={styles.dropdown}
  >
    {Array.from({ length: 10 }, (_, i) => year - 5 + i).map((yr) => (
      <option key={yr} value={yr}>{yr}</option>
    ))}
  </select>
  
  <button 
    onClick={() => navigateMonth(1)} 
    style={styles.calendarNav}
    disabled={loading}
  >
    <ChevronRightIcon style={{ width: "18px", height: "18px" }} />
  </button>
</div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={styles.checkboxLabel}>
                <input 
                  type="checkbox" 
                  checked={autoSync} 
                  onChange={() => setAutoSync(v => !v)} 
                  disabled={!googleConnected}
                /> 
                Auto-sync
              </label>
              
              {googleConnected && (
                <button 
                  onClick={syncAllTasks}
                  style={{...styles.smallBtn, ...styles.successBtn}}
                  disabled={loading}
                  title="Sync all unsynced tasks to Google Calendar"
                >
                  <ArrowPathIcon style={{ width: "16px", height: "16px" }} />
                  Sync All
                </button>
              )}
              
              <button 
                onClick={connectGoogleCalendar} 
                style={{
                  ...styles.smallBtn,
                  ...styles.btnPrimary
                }} 
                disabled={oauthLoading || connectionCheckLoading}
              >
                {oauthLoading || connectionCheckLoading ? (
                  <ArrowPathIcon style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                ) : googleConnected ? (
                  <CheckCircleIcon style={{ width: "16px", height: "16px" }} />
                ) : null}
                {googleConnected ? "Connected" : "Connect Google"}
              </button>
            </div>
          </div>

          {/* Days of week */}
          <div style={styles.calendarGrid}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={styles.calendarDayHeader}>{d}</div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((dayInfo, idx) => (
              <div
                key={idx}
                style={{
  ...styles.calendarDay,
  ...(dayInfo ? (dayInfo.hasTasks ? styles.hasTasks : {}) : styles.emptyDay),
  ...(dayInfo && isToday(dayInfo.date) ? styles.todayDate : {}),
  ...(selectedDate === dayInfo?.date ? styles.selectedDate : {}),
}}
                onClick={() => dayInfo && setSelectedDate(selectedDate === dayInfo.date ? null : dayInfo.date)}
                title={dayInfo?.hasTasks ? `${dayInfo.tasksCount} task(s) due` : `No tasks due`}
              >
                {dayInfo && (
                  <>
                    <span style={{ 
                      fontWeight: isToday(dayInfo.date) ? "bold" : "normal",
                      fontSize: "0.95rem",
                      marginBottom: "4px"
                    }}>
                      {dayInfo.day}
                    </span>
                    {dayInfo.hasTasks && (
                      <div
                      style={{ ...styles.taskIndicator,
                        background: selectedDate === dayInfo.date ? "#ffffff" : "var(--blue)",
                        color: selectedDate === dayInfo.date ? "var(--blue)" : "white",
                        border: selectedDate === dayInfo.date ? "1px solid var(--blue)" : "none",
                      }}>
                        {dayInfo.tasksCount}
                        </div>
                      )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Tasks for selected date */}
          {selectedDate && (
            <div style={styles.dateTasks}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h4 style={{ margin: 0, color: "var(--text)", fontSize: "1.1rem", fontWeight: "600" }}>
                  Tasks for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h4>
                <span style={styles.statusBadge}>
                  {calendarDays.find(day => day?.date === selectedDate)?.tasksCount || 0} task(s)
                </span>
              </div>
              {calendarDays.find(day => day?.date === selectedDate)?.tasksDue?.length === 0 ? (
                <div style={{ 
                  textAlign: "center", 
                  padding: "2rem", 
                  color: "var(--muted)",
                  background: "var(--card-bg)",
                  borderRadius: "12px",
                  border: "1px dashed var(--border)"
                }}>
                  <CalendarIcon style={{ width: "48px", height: "48px", marginBottom: "1rem", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.95rem" }}>No tasks due on this date</p>
                </div>
              ) : (
                <div>
                  {calendarDays.find(day => day?.date === selectedDate)?.tasksDue?.map(task => {
                    const taskSyncStatus = syncStatus[task.id] || { synced: false, loading: false };
                    let style = {...styles.miniTask};
                    if (task.completed) style = {...style, ...styles.completed};
                    else if (isOverdue(task)) style = {...style, ...styles.overdue};
                    else style = {...style, ...styles.upcoming};

                    return (
                      <div 
                        key={task.id} 
                        style={style}
                        onClick={() => {
                          // You can implement task detail modal here
                          console.log('Task clicked:', task);
                        }}
                      >
                        <span style={styles.taskTitle} title={task.title}>
                          {task.title}
                          {task.completed && " ✓"}
                        </span>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {task.priority && (
                            <span style={{
                              fontSize: "0.7rem",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background: 
                                task.priority === 'High' ? '#ef4444' : 
                                task.priority === 'Medium' ? '#f59e0b' : '#10b981',
                              color: 'white',
                              fontWeight: '500'
                            }}>
                              {task.priority}
                            </span>
                          )}
                          
                          {googleConnected && task.due && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (taskSyncStatus.synced) {
                                  unsyncTask(task.id);
                                } else {
                                  syncTask(task.id);
                                }
                              }}
                              style={{
                                ...styles.syncButton,
                                ...(taskSyncStatus.synced ? styles.syncSynced : styles.syncUnsynced)
                              }}
                              disabled={taskSyncStatus.loading}
                              title={taskSyncStatus.synced ? "Remove from Google Calendar" : "Add to Google Calendar"}
                            >
                              {taskSyncStatus.loading ? (
                                <ArrowPathIcon style={{ width: "12px", height: "12px", animation: "spin 1s linear infinite" }} />
                              ) : taskSyncStatus.synced ? (
                                <CheckCircleIcon style={{ width: "12px", height: "12px" }} />
                              ) : (
                                <XCircleIcon style={{ width: "12px", height: "12px" }} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div style={styles.loadingOverlay}>
              <div style={{ textAlign: "center" }}>
                <ArrowPathIcon style={{ width: "32px", height: "32px", animation: "spin 1s linear infinite", marginBottom: "1rem" }} />
                <p style={{ margin: 0, color: "var(--muted)" }}>Loading calendar...</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Collapsed view */}
      {collapsed && (
        <div style={{ position: "relative" }}>
          <CalendarIcon style={{ width: "24px", height: "24px", color: "var(--text)" }} />
          {tasks.filter(task => !task.completed && task.due && new Date(task.due) >= new Date()).length > 0 && (
            <div style={styles.upcomingBadge}>
              {tasks.filter(task => !task.completed && task.due && new Date(task.due) >= new Date()).length}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}