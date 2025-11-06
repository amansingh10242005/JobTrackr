// components/Collab.js
import { useState, useEffect, useRef, useCallback } from "react";
import { 
  PlusIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  UserPlusIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  FolderIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PhotoIcon,
  DocumentIcon,
  AtSymbolIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  EnvelopeIcon,
  LinkIcon,
  CogIcon,
  ShieldCheckIcon,
  HashtagIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";


// Enhanced Backend API service with Team Features
const collabAPI = {
  baseURL: (() => {
    const envBase = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api";
    const base = envBase.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  })(),

  // In your collabAPI object, update the request function:
async request(endpoint, options = {}) {
  const url = `${this.baseURL}${endpoint}`;
  const token = localStorage.getItem('token');
  
  console.log(`API Request: ${options.method || 'GET'} ${url}`);
  
   const config = {
  method: options.method || 'GET',
  headers: {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  },
  ...options
};


  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config);
    let data;
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = { message: await response.text() };
    }
    
    console.log(`API Response: ${response.status}`, data);
    
    if (!response.ok) {
      let errorMessage = data.error || data.message || 'Request failed';
      
      // Enhanced error messages
      if (response.status === 400) {
        errorMessage = data.error || 'Bad request';
      } else if (response.status === 401) {
        errorMessage = 'Authentication required';
      } else if (response.status === 403) {
        errorMessage = 'Access denied';
      } else if (response.status === 404) {
        errorMessage = data.error || 'Resource not found';
      } else if (response.status === 409) {
        errorMessage = data.error || 'Conflict - resource already exists';
      } else if (response.status >= 500) {
        errorMessage = 'Server error, please try again later';
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
},

async createTask(teamId, projectId, taskData) {
  return this.request(`/teams/${teamId}/projects/${projectId}/tasks`, {
    method: 'POST',
    body: taskData,
  });
},

  // Team endpoints
  async createTeam(teamData) {
    return this.request('/teams', {
      method: 'POST',
      body: teamData,
    });
  },

  async getTeams() {
    return this.request('/teams');
  },

  async getTeam(teamId) {
    return this.request(`/teams/${teamId}`);
  },

  async inviteMember(teamId, memberData) {
    return this.request(`/teams/${teamId}/invite`, {
      method: 'POST',
      body: memberData,
    });
  },

  async acceptInvitation(invitationId) {
    return this.request(`/invitations/${invitationId}/accept`, {
      method: 'POST',
    });
  },

  async acceptInviteLink(inviteToken) {
    return this.request(`/teams/invite-link/${inviteToken}/accept`, {
      method: 'POST',
    });
  },

  // Chat endpoints
  async sendMessage(teamId, messageData) {
    return this.request(`/teams/${teamId}/messages`, {
      method: 'POST',
      body: messageData,
    });
  },

  async getMessages(teamId) {
    return this.request(`/teams/${teamId}/messages`);
  },

  // File upload for comments (using the same endpoint as chat)
// Replace the uploadFile function with this:
async uploadFile(teamId, taskId, formData) {
  const response = await fetch(`${this.baseURL}/teams/${teamId}/tasks/${taskId}/files`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData, // Send FormData directly, no JSON.stringify
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  
  return response.json();
},

  // Comment endpoints
  async addComment(teamId, taskId, commentData) {
    return this.request(`/teams/${teamId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: commentData,
    });
  },

  async getComments(teamId, taskId) {
    return this.request(`/teams/${teamId}/tasks/${taskId}/comments`);
  },

  // User search
  async searchUsers(query) {
    return this.request(`/users/search?q=${encodeURIComponent(query)}`);
  },



async getProjects(teamId = null) {
  const endpoint = teamId ? `/projects?teamId=${teamId}` : '/projects';
  return this.request(endpoint);
},

async createProject(projectData) {
  return this.request('/projects', {
    method: 'POST',
    body: projectData,
  });
},

async deleteProject(projectId) {
  return this.request(`/projects/${projectId}`, {
    method: 'DELETE',
  });
},

async updateProject(projectId, projectData) {
  return this.request(`/projects/${projectId}`, {
    method: 'PUT',
    body: projectData,
  });
},

async updateTask(teamId, projectId, taskId, taskData) {
  return this.request(`/teams/${teamId}/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: taskData,
  });
},

// Delete a single task from a project via server route
async deleteTask(teamId, projectId, taskId) {
  if (!teamId || !projectId || !taskId) {
    throw new Error('Missing teamId, projectId or taskId for deleteTask');
  }
  return this.request(`/teams/${teamId}/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE'
  });
},

async deleteTeam(teamId) {
  return this.request(`/teams/${teamId}`, {
    method: 'DELETE',
  });
},
};

// Toast Component 
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getToastIcon = () => {
    switch (type) {
      case 'error':
        return <ExclamationTriangleIcon width={16} color="#ef4444" />;
      case 'warning':
        return <ExclamationTriangleIcon width={16} color="#f59e0b" />;
      default:
        return <CheckCircleIcon width={16} color="#22c55e" />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--card-bg)',
      color: 'var(--text)',
      padding: '0.75rem 1rem',
      borderRadius: '6px',
      border: '1px solid var(--border)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      borderColor: type === 'warning' ? '#f59e0b' : 'var(--border)'
    }}>
      {getToastIcon()}
      {message}
    </div>
  );
};

// ✅ Add this just below the Toast component (around line 370)
let toastQueue = [];

function showToast(message, type = 'success') {
  // Create container if not already in DOM
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.background =
    type === 'error' ? '#fee2e2' : type === 'warning' ? '#fef3c7' : '#dcfce7';
  toast.style.color =
    type === 'error' ? '#b91c1c' : type === 'warning' ? '#92400e' : '#166534';
  toast.style.border = '1px solid rgba(0,0,0,0.1)';
  toast.style.padding = '0.75rem 1.5rem';
  toast.style.marginTop = '0.5rem';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '0.9rem';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.opacity = '1';

  container.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => container.removeChild(toast), 300);
  }, 4000);
}

  const toastStyles = {
  toast: { 
    position: 'fixed', 
    top: '20px', 
    left: '50%', 
    transform: 'translateX(-50%)', 
    background: 'var(--card-bg)', 
    color: 'var(--text)',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--border)', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
    zIndex: 1100, 
    display: 'flex', 
    alignItems: 'center', 
    gap: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  toastSuccess: {
    borderColor: '#22c55e',
    background: '#f0fdf4'
  },
  toastError: {
    borderColor: '#ef4444',
    background: '#fef2f2'
  },
  toastWarning: {
    borderColor: '#f59e0b',
    background: '#fffbeb'
  }
};

// Confirmation Modal Component
function ConfirmationModal({ title, message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--card-bg)',
        padding: '1.5rem',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>{title || 'Confirmation'}</h3>
        <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text)' }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button 
            onClick={onCancel}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              background: 'var(--input-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '6px',
              background: 'var(--blue)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ADD THIS MISSING FUNCTION:
const validateUserEmail = async (email) => {
  try {
    const results = await collabAPI.searchUsers(email);
    return results.users && results.users.length > 0;
  } catch (error) {
    console.error('Error validating user:', error);
    return false;
  }
};

// Generate invite link function
const generateInviteLink = (team) => {
  const baseUrl = window.location.origin;
  const token = btoa(`${team.id}:${Date.now()}`); // Simple token generation
  return `${baseUrl}?teamId=${team.id}&token=${token}`;
};

// ✅ Shared download file handler (works with external URLs like Cloudinary)
const handleFileDownload = async (url, filename) => {
  try {
    // Check if it's a data URL (base64) or same-origin URL
    if (url.startsWith('data:') || url.startsWith(window.location.origin)) {
      // For same-origin or data URLs, create a link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // For external URLs (like Cloudinary), fetch and download
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch file');
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Failed to download file:', error);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
};

// Enhanced Task Card Component with Comments
function TaskCard({ task, project, team, onUpdateStatus, onAssignTask, onAddComment, onDeleteTask, teamMembers, fileUploads, setConfirmationModal }) {
  const [showDetails, setShowDetails] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentions, setMentions] = useState([]);
  const commentInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load comments when details are shown
  useEffect(() => {
    if (showDetails && team && task.id) {
      loadComments();
    }
  }, [showDetails, team, task.id]);

  const loadComments = async () => {
  setLoadingComments(true);
  try {
    const data = await collabAPI.getComments(team.id, task.id);
    console.log('🐛 [DEBUG] FULL API RESPONSE:', {
      data: data,
      hasComments: !!data.comments,
      hasBody: !!data.body,
      hasTeam: !!data.team,
      isArray: Array.isArray(data),
      keys: Object.keys(data)
    });
    console.log('🔍 [DEBUG] Comments API response:', data);

    // ✅ SIMPLIFIED AND ROBUST COMMENT EXTRACTION
    let commentsArray = [];
    
    // Check all possible locations for comments
    if (Array.isArray(data.comments)) {
      commentsArray = data.comments;
    } else if (Array.isArray(data.body?.comments)) {
      commentsArray = data.body.comments;
    } else if (Array.isArray(data.team?.comments)) {
      commentsArray = data.team.comments;
    } else if (Array.isArray(data.body)) {
      commentsArray = data.body;
    } else if (Array.isArray(data)) {
      commentsArray = data;
    } else if (data.comment) {
      commentsArray = [data.comment];
    } else {
      console.warn("Unexpected comments response format, using empty array:", data);
      commentsArray = [];
    }
    
    console.log('✅ [DEBUG] Extracted comments:', commentsArray);
    setComments(commentsArray);
    
  } catch (err) {
    console.error('Failed to load comments:', err);
    setComments([]);
  } finally {
    setLoadingComments(false);
  }
};

// Helper function to recursively find comments in nested objects
const findCommentsInObject = (obj) => {
  if (!obj || typeof obj !== 'object') return [];
  
  // Check if this object has a comments array
  if (Array.isArray(obj.comments)) {
    return obj.comments;
  }
  
  // Recursively search in nested objects
  for (let key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
      const found = findCommentsInObject(obj[key]);
      if (found.length > 0) {
        return found;
      }
    }
  }
  
  return [];
};


  const handleCommentSubmit = async () => {
  if (!commentText.trim() && (!fileInputRef.current?.files || fileInputRef.current.files.length === 0)) return;

  try {
    let attachments = [];
    
    // Handle file uploads if any
    if (fileInputRef.current?.files && fileInputRef.current.files.length > 0) {
      const files = Array.from(fileInputRef.current.files);
      for (const file of files) {
        const base64 = await toBase64(file);
        attachments.push({
          name: file.name,
          size: file.size,
          type: file.type,
          url: base64
        });
      }
    }

    const response = await collabAPI.addComment(team.id, task.id, {
      comment: commentText,
      mentions: mentions,
      attachments: attachments
    });

    if (response.comment) {
      setComments(prev => [...prev, response.comment]);
    }

    // Clear inputs
    setCommentText("");
    setMentions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Clear file input
    }
    
    loadComments(); // Reload to ensure everything is synced
    
  } catch (err) {
    console.error('Failed to add comment:', err);
    showToast('Failed to add comment: ' + err.message, 'error');
  }
};

  const handleCommentInput = (e) => {
    const value = e.target.value;
    setCommentText(value);

    // Detect @ mentions
    const lastAtPos = value.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const query = value.slice(lastAtPos + 1).split(' ')[0];
      setMentionQuery(query);
      setShowMentions(query.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username) => {
    const lastAtPos = commentText.lastIndexOf('@');
    const beforeMention = commentText.slice(0, lastAtPos);
    const afterMention = commentText.slice(lastAtPos + mentionQuery.length + 1);
    
    setCommentText(`${beforeMention}@${username} ${afterMention}`);
    setMentions([...mentions, username]);
    setShowMentions(false);
    setMentionQuery("");
    
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  // ✅ Base64 Conversion Helper (used by file upload in comments)
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
});

// =====================
// HANDLE FILE UPLOAD
// =====================
// Replace the entire handleFileUpload function with this:
const handleFileUpload = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length || !team || !task) return;

  try {
    // Create FormData object instead of base64 conversion
    const formData = new FormData();
    
    // Append each file to FormData
    files.forEach(file => {
      formData.append('attachments', file);
    });

    // Upload files using the proper FormData approach
    const result = await collabAPI.uploadFile(team.id, task.id, formData);
    
    if (result.success) {
      showToast('File uploaded successfully', 'success');
      
      // If there's comment text, add it as a comment with file references
      if (commentText.trim() || files.length > 0) {
        const commentResult = await collabAPI.addComment(team.id, task.id, {
          comment: commentText || `Uploaded ${files.length} file(s)`,
          attachments: result.files || files.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            url: result.files?.[0]?.url || URL.createObjectURL(file)
          }))
        });
        
        if (commentResult.comment) {
          setComments(prev => [...prev, commentResult.comment]);
        }
        
        setCommentText("");
        loadComments(); // Reload to get proper file URLs
      }
    } else {
      showToast('File upload failed', 'error');
    }
  } catch (err) {
    console.error('File upload failed:', err);
    showToast('File upload failed: ' + err.message, 'error');
  }
};

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High": return "#ef4444";
      case "Medium": return "#f59e0b";
      case "Low": return "#10b981";
      default: return "#6b7280";
    }
  };

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '1rem',
      cursor: 'pointer'
    }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
  <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '0.9rem' }}>{task.title}</h4>
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
    <div style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: getPriorityColor(task.priority)
    }} />
    <button
  onClick={(e) => {
    e.stopPropagation();
    setConfirmationModal({
      title: "Delete Task",
      message: `Are you sure you want to delete the task "${task.title}"? This action cannot be undone.`,
      onConfirm: () => {
        setConfirmationModal(null);
        onDeleteTask(task.id);
      },
      onCancel: () => setConfirmationModal(null)
    });
  }}
  style={{
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--muted)',
    padding: '0.25rem'
  }}
  title="Delete task"
>
  <TrashIcon style={{ width: '12px', height: '12px' }} />
</button>
  </div>
</div>
      
      <p style={{ margin: '0 0 0.75rem 0', color: 'var(--muted)', fontSize: '0.8rem' }}>
        {task.description}
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <ClockIcon style={{ width: '12px', height: '12px', color: 'var(--muted)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <UserGroupIcon style={{ width: '12px', height: '12px', color: 'var(--muted)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {task.assignedTo?.length || 0}
          </span>
        </div>
      </div>

      {/* Assigned Users */}
      {task.assignedTo && task.assignedTo.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem' }}>
          {task.assignedTo.slice(0, 3)
            .map(userId => {
              const user = teamMembers.find(member => member.id === userId);
              return user ? { userId, user } : null;
            })
            .filter(item => item !== null)
            .map(({ userId, user }) => (
              <div
                key={userId}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#2575fc',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: '600'
                }}
                title={user.name}
              >
                {user.name?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()}
              </div>
            ))}
          {task.assignedTo.length > 3 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              +{task.assignedTo.length - 3}
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--blue)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}
        >
          <ChatBubbleLeftIcon style={{ width: '12px', height: '12px' }} />
          {showDetails ? 'Hide' : 'Details'}
          {comments.length > 0 && ` (${comments.length})`}
        </button>

        <select
          value={task.status}
          onChange={(e) => onUpdateStatus(task.id, e.target.value)}
          style={{
            padding: '0.25rem 0.5rem',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            fontSize: '0.7rem'
          }}
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Enhanced Task Details with Comments */}
      {showDetails && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          {/* Comments Section */}
          <div style={{ marginBottom: '1rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)', fontSize: '0.8rem' }}>Comments</h5>
            
            {loadingComments ? (
  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '1rem' }}>
    <div style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--border)', borderTop: '2px solid var(--blue)', borderRadius: '50%' }}></div>
    Loading comments...
  </div>
) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', padding: '1rem' }}>
                    No comments yet. Start the discussion!
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.7rem', color: 'var(--text)' }}>
                          {comment.author}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>
                          {new Date(comment.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text)' }}>{comment.comment}</p>
                      
                      {/* Comment Attachments */}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div style={{ marginTop: '0.5rem' }}>
                          {comment.attachments.map((attachment, index) => (
                            <div key={attachment.id || `comment-attachment-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                              <PaperClipIcon style={{ width: '12px', height: '12px' }} />
                              <button
                                onClick={() => handleFileDownload(attachment.url, attachment.name || `attachment-${index + 1}`)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#2563eb',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  fontSize: '0.7rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                                title={`Download ${attachment.name || 'file'}`}
                              >
                                📎 {attachment.name || `Attachment ${index + 1}`}
                                <span style={{ fontSize: '0.6rem', marginLeft: '0.25rem' }}>⬇️</span>
                              </button>
                              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                                ({attachment.size ? (attachment.size / 1024).toFixed(1) + ' KB' : 'Unknown size'})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Add Comment */}
            <div style={{ position: 'relative' }}>
              <textarea
                ref={commentInputRef}
                placeholder="Add a comment... (Use @ to mention teammates)"
                value={commentText}
                onChange={handleCommentInput}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  fontSize: '0.8rem',
                  minHeight: '60px',
                  resize: 'vertical',
                  marginBottom: '0.5rem'
                }}
              />
              
              {/* Mentions Dropdown */}
              {showMentions && teamMembers && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  zIndex: 10
                }}>
                  {teamMembers
                    .filter(member => 
                      member.name?.toLowerCase().includes(mentionQuery.toLowerCase()) ||
                      member.username?.toLowerCase().includes(mentionQuery.toLowerCase())
                    )
                    .map(member => (
                      <div
                        key={member.id}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '0.8rem'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--input-bg)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        onClick={() => insertMention(member.username)}
                      >
                        @{member.name || member.username}
                      </div>
                    ))
                  }
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--input-bg)',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <PaperClipIcon style={{ width: '12px', height: '12px' }} />
                    Attach
                  </button>
                  
                  <button
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--input-bg)',
                      borderRadius: '4px',
                      padding: '0.25rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    onClick={() => {
                      setCommentText(prev => prev + '@');
                      if (commentInputRef.current) {
                        commentInputRef.current.focus();
                      }
                    }}
                  >
                    <AtSymbolIcon style={{ width: '12px', height: '12px' }} />
                    Mention
                  </button>
                </div>
                
                <button
                  onClick={handleCommentSubmit}
                  disabled={!commentText.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    background: commentText.trim() ? 'var(--blue)' : 'var(--border)',
                    color: commentText.trim() ? '#fff' : 'var(--muted)',
                    borderRadius: '6px',
                    cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '0.8rem'
                  }}
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Component
function Modal({ children, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '1.5rem',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--muted)'
          }}
        >
          <XMarkIcon style={{ width: '20px', height: '20px' }} />
        </button>
        {children}
      </div>
    </div>
  );
}

// Team Chat Component
function TeamChat({ team, onClose }) {
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatFiles, setChatFiles] = useState([]);
  const chatFileInputRef = useRef(null);
  
  
  // Draggable state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Drag handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('input, button, textarea')) return;
    
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  useEffect(() => {
  if (team) {
    loadMessages();
    
    // Set up more reliable polling for new messages
    const interval = setInterval(() => {
      loadMessages();
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }
}, [team]);

  const loadMessages = async () => {
  try {
    if (!team || !team.id) {
      console.warn('No team selected for loading messages');
      return;
    }

    console.log('🔄 Loading messages for team:', team.id);
    const data = await collabAPI.getMessages(team.id);
    console.log('📨 Raw API response:', data);

if (!data || !data.messages) {
  console.warn('⚠️ No messages in API response:', data);
  setMessages([]);
  return;
}
    console.log("🔎 Messages received from API:", data);

    
    
    let messagesArray = [];
    
    // Handle different response formats
    if (data && data.messages && Array.isArray(data.messages)) {
      messagesArray = data.messages;
    } else if (data && Array.isArray(data)) {
      messagesArray = data;
    } else if (data && data.body && Array.isArray(data.body.messages)) {
      messagesArray = data.body.messages;
    } else {
      console.warn('Unexpected messages format, using empty array:', data);
      messagesArray = [];
    }
    
    console.log(`📊 Processed ${messagesArray.length} messages`);
    
    // Process messages with proper fallbacks
    const processedMessages = messagesArray.map(msg => ({
      id: msg.id || `temp-${Date.now()}-${Math.random()}`,
      sender: msg.sender || 'unknown',
      message: msg.message || msg.text || '',
      timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
      attachments: msg.attachments || [],
      type: msg.type || 'text'
    }));
    
    setMessages(processedMessages);
  } catch (err) {
    console.error('❌ Failed to load messages:', err);
    setError('Failed to load messages: ' + err.message);
    setMessages([]);
  }
};

// Helper: convert file -> base64
const toBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (error) => reject(error);
});

  // sendMessage function
const sendMessage = async () => {
  // if nothing to send, return
  if (!newMessage.trim() && (!chatFiles || chatFiles.length === 0)) return;

  setLoading(true);
  setError(null);

  try {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    // Convert files to data URLs (base64). We'll send these to the backend,
    // which will upload them to Cloudinary (or any server-side storage).
    const attachments = [];
    for (const file of chatFiles || []) {
      const base64 = await toBase64(file); // toBase64 helper already in your file
      attachments.push({
        name: file.name,
        size: file.size,
        type: file.type,
        url: base64 // data:<mime>;base64,... — backend will detect & upload
      });
    }

    // Build payload
    const messageData = {
      message: newMessage.trim(), // may be empty string if upload-only
      type: "text",
      attachments
    };

    console.log("📨 Sending message to backend:", messageData);

    // Send to backend API — backend will upload attachments to Cloudinary and
    // return the saved message object (with final URLs)
    const result = await collabAPI.sendMessage(team.id, messageData);
    console.log("✅ Message sent:", result);

    // Clear UI inputs and reload messages
    setNewMessage("");
    setChatFiles([]);
    setTimeout(() => loadMessages(), 300);
  } catch (err) {
    console.error("❌ Failed to send message:", err);
    setError(err.message || "Failed to send message");
  } finally {
    setLoading(false);
  }
};



// Get current user from JWT token
const getCurrentUser = () => {
  // Try localStorage first
  const storedUsername = localStorage.getItem('username');
  if (storedUsername) {
    return storedUsername;
  }
  
  // Fallback: decode from token
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.username) {
      // Save to localStorage for future use
      localStorage.setItem('username', payload.username);
      return payload.username;
    }
    return null;
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
};

const currentUser = getCurrentUser();

  return (
    <div 
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '400px',
        height: '500px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Chat Header - Make this the drag handle */}
      <div 
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--blue)',
          color: '#fff',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          cursor: 'move'
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem' }}>{team.name} Chat</h4>
          <div style={{ fontSize: '0.8rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            {team.members ? team.members.length : 0} members online
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#fff',
            cursor: 'pointer',
            padding: '0.25rem'
          }}
        >
          <XMarkIcon style={{ width: '20px', height: '20px' }} />
        </button>
      </div>

       {/* ADD THIS ERROR DISPLAY */}
    {error && (
      <div style={{
        background: '#fee2e2',
        color: '#dc2626',
        padding: '0.5rem 1rem',
        fontSize: '0.8rem',
        borderBottom: '1px solid #fecaca'
      }}>
        {error}
        <button
          onClick={() => setError(null)}
          style={{
            float: 'right',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#dc2626'
          }}
        >
          <XMarkIcon style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    )}

      {/* Messages Area */}
      <div style={{
        flex: 1,
        padding: '1rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '2rem' }}>
            <ChatBubbleLeftIcon style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No messages yet</p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>Start the conversation!</p>
          </div>
        ) : (
          messages.map(message => (
  <div
    key={message.id || `msg-${message.timestamp}-${Math.random()}`}
    style={{
      display: 'flex',
      gap: '0.5rem',
      maxWidth: '85%',
      alignSelf: message.sender === currentUser ? 'flex-end' : 'flex-start'
    }}
  >
    {message.sender !== currentUser && (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#6b7280',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.7rem',
        fontWeight: '500',
        flexShrink: 0
      }}>
        {message.sender?.charAt(0).toUpperCase() || 'U'}
      </div>
    )}
    
    <div style={{
      background: message.sender === currentUser 
        ? 'var(--blue)' 
        : 'var(--input-bg)',
      color: message.sender === currentUser ? '#fff' : 'var(--text)',
      padding: '0.6rem 0.8rem',
      borderRadius: '16px',
      borderBottomLeftRadius: message.sender === currentUser ? '16px' : '4px',
      borderBottomRightRadius: message.sender === currentUser ? '4px' : '16px'
    }}>
      {message.sender !== currentUser && (
        <div style={{ fontWeight: '600', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
          {message.sender}
        </div>
      )}
      <div style={{ fontSize: '0.9rem', wordBreak: 'break-word' }}>
        {message.message || message.text}
      </div>
      
      {/* Show attachments if any */}
      {message.attachments && message.attachments.length > 0 && (
        <div style={{ marginTop: "0.5rem" }}>
          {message.attachments.map((attachment, index) => (
            <button
              key={index}
              onClick={() => handleFileDownload(attachment.url, attachment.name || `Attachment_${index + 1}`)}
              style={{
                background: 'transparent',
                border: 'none',
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8rem",
                color: message.sender === currentUser ? "#fff" : "var(--link)",
                textDecoration: "underline",
                cursor: "pointer",
                marginTop: "0.25rem",
                padding: 0
              }}
              title={`Download ${attachment.name || 'file'}`}
            >
              <PaperClipIcon style={{ width: "14px", height: "14px" }} />
              {attachment.name || `Attachment ${index + 1}`}
              <span style={{ fontSize: '0.7rem' }}>⬇️</span>
            </button>
          ))}
        </div>
      )}

      
      <div style={{
        fontSize: '0.7rem',
        opacity: 0.7,
        marginTop: '0.2rem',
        textAlign: 'right'
      }}>
        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 'Just now'}
      </div>
    </div>
  </div>
)))}
      </div>

      {/* Message Input */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        gap: '0.5rem',
        position: 'relative'
      }}>
        {/* Selected files display - Enhanced from updated version */}
        {chatFiles.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.5rem',
            marginBottom: '0.5rem',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: '600' }}>Attachments:</span>
              <button
                onClick={() => setChatFiles([])}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                Clear all
              </button>
            </div>
            {chatFiles.map((file, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <PaperClipIcon style={{ width: '12px', height: '12px' }} />
                <span style={{ flex: 1 }}>{file.name}</span>
                <button
                  onClick={() => setChatFiles(prev => prev.filter((_, i) => i !== index))}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            fontSize: '0.9rem'
          }}
        />
        
        {/* Attachment button */}
        <input
          ref={chatFileInputRef}
          type="file"
          id="chat-attachment"
          style={{ display: 'none' }}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setChatFiles(files);
            // Reset the input to allow selecting same file again
            e.target.value = '';
          }}
        />
        <button
          onClick={() => chatFileInputRef.current?.click()}
          style={{
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PaperClipIcon style={{ width: '16px', height: '16px' }} />
        </button>
        
        {/* Send message button - Enhanced logic from updated version */}
        <button
          onClick={sendMessage}
          disabled={(!newMessage.trim() && chatFiles.length === 0) || loading}
          style={{
            background: (newMessage.trim() || chatFiles.length > 0) ? 'var(--blue)' : 'var(--border)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: (newMessage.trim() || chatFiles.length > 0) ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PaperAirplaneIcon style={{ width: '16px', height: '16px' }} />
        </button>
      </div>
    </div>
  );
}

// Main Collab Component
export default function Collab() {
  const [activeTab, setActiveTab] = useState("workspace");
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 const [toast, setToast] = useState(null);
 

  // Add this useEffect for toast auto-cleanup
useEffect(() => {
  if (!toast) return;
  const timer = setTimeout(() => setToast(null), toast.timeout || 5000);
  return () => clearTimeout(timer);
}, [toast]);


// Toast helper function
const showToast = (message, type = 'success', timeout = 5000) => {
  setToast({ message, type, timeout });
};

  const [activities, setActivities] = useState([]);
useEffect(() => {
  const saved = localStorage.getItem("collabActivities");
  const allActivities = saved ? JSON.parse(saved) : [];
  
  if (activeTeam) {
    // Filter activities by current team
    const teamActivities = allActivities.filter(
      activity => activity.teamId === activeTeam.id
    );
    setActivities(teamActivities);
  } else {
    setActivities([]);
  }
}, [activeTeam]);

// UPDATE the addActivity function to include teamId:
const addActivity = (type, userId, projectId, taskId, message, teamId) => {
  const activity = {
    id: Date.now(),
    type,
    user: userId,
    projectId,
    taskId,
    teamId: teamId || activeTeam?.id, // Add teamId
    timestamp: new Date().toISOString(),
    message
  };

  setActivities(prev => {
    const updated = [activity, ...prev.slice(0, 49)];
    localStorage.setItem("collabActivities", JSON.stringify(updated));
    return updated;
  });
};

useEffect(() => {
  // Verify CSS variables are available
  const root = document.documentElement;
  const bgColor = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (!bgColor) {
    console.warn('CSS variables not loaded properly');
  }
}, []);

  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Form states
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: [],
    dueDate: "",
    priority: "Medium"
  });
  const [newInvite, setNewInvite] = useState({ email: "", role: "member" });

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], tasks: [] });
  const [showSearch, setShowSearch] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
 const [fileUploads, setFileUploads] = useState({});
const [confirmationModal, setConfirmationModal] = useState(null);

const updateProjectInState = useCallback((projectId, updates) => {
  const updatedProjects = projects.map(project => 
    project.id === projectId 
      ? { ...project, ...updates, updatedAt: new Date().toISOString() }
      : project
  );
  
  setProjects(updatedProjects);
  // REMOVE this line: projectHelpers.saveProjects(updatedProjects);
  
  if (activeProject?.id === projectId) {
    setActiveProject(prev => ({ ...prev, ...updates }));
  }
  
  // Update in backend
  collabAPI.updateProject(projectId, updates).catch(err => {
    console.error('Failed to update project in backend:', err);
  });
}, [projects, activeProject]);
  

  // Add this function INSIDE the component
  const isUserAlreadyMember = (email) => {
  if (!activeTeam || !activeTeam.members) return false;
  return activeTeam.members.some(member => 
    member.email?.toLowerCase() === email.toLowerCase() || 
    member.username?.toLowerCase() === email.toLowerCase()
  );
};

  // Load projects and teams on component mount
  useEffect(() => {
  loadTeams();
}, []);



// ADD THIS useEffect in Collab.js after your existing useEffects
useEffect(() => {
  // Clear active project when team changes
  if (activeTeam && activeProject && activeProject.teamId !== activeTeam.id) {
    setActiveProject(null);
  }
}, [activeTeam, activeProject]);


// loadProjects function
const loadProjects = useCallback(async () => {
  try {
    if (!activeTeam) {
      console.log('No active team, clearing projects');
      setProjects([]);
      return;
    }
    
    console.log('Loading projects for team:', activeTeam.id);
    setLoading(true);
    
    const data = await collabAPI.getProjects(activeTeam.id);
    console.log('Projects API response:', data);
    
    const teamProjects = data.projects || [];
    console.log('Setting projects:', teamProjects);
    
    setProjects(teamProjects);
    
    if (teamProjects.length === 0) {
      console.log('No projects found for team:', activeTeam.id);
    }
    
  } catch (err) {
    console.error('Failed to load projects:', err);
    setProjects([]);
    showToast('Failed to load projects: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}, [activeTeam]);


const loadTeams = useCallback(async () => {
  try {
    console.log('Loading teams...');
    const data = await collabAPI.getTeams();
    const teamsData = data.teams || data || [];
    setTeams(teamsData);
    console.log('Teams loaded:', teamsData);
  } catch (err) {
    console.error('Failed to load teams:', err);
    showToast('Failed to load teams', 'error');
    setTeams([]);
  }
}, []);

// Load teams on component mount
useEffect(() => {
  loadTeams();
}, [loadTeams]);

// Load projects when active team changes
useEffect(() => {
  if (activeTeam) {
    console.log('Active team changed, loading projects:', activeTeam.id);
    loadProjects();
  } else {
    setProjects([]); // Clear projects when no team selected
    setActiveProject(null);
  }
}, [activeTeam, loadProjects]);


// Function to handle pending invitations
const acceptPendingInvitation = useCallback(async (invitationId) => {
  if (!invitationId) return;
  
  try {
    console.log('🔄 Processing invitation:', invitationId);
    setLoading(true);
    
    // First try accepting via invite link (inviteToken)
    // This handles the case where someone clicks a team invite link
    try {
      console.log('📎 Trying invite link method...');
      const result = await collabAPI.acceptInviteLink(invitationId);
      console.log('✅ Invite link result:', result);
      
      if (result && (result.message || result.team)) {
        showToast('Successfully joined the team!', 'success');
        
        // Remove the invitationId from URL and localStorage
        window.history.replaceState({}, '', window.location.pathname);
        localStorage.removeItem('pendingInvitation');
        
        // Refresh teams list
        await loadTeams();
        
        // Switch to teams tab
        setActiveTab("teams");
        return;
      }
    } catch (inviteLinkError) {
      console.log('⚠️ Invite link method failed, trying invitation document method:', inviteLinkError);
      console.error('Invite link error details:', inviteLinkError);
      // Fall through to try invitation document method
    }
    
    // Fallback: Try accepting via invitation document (for email-based invitations)
    console.log('📧 Trying invitation document method...');
    const result = await collabAPI.acceptInvitation(invitationId);
    console.log('✅ Invitation document result:', result);
    
    if (result && (result.message || result.team)) {
      showToast('Successfully joined the team!', 'success');
      
      // Remove the invitationId from URL and localStorage
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.removeItem('pendingInvitation');
      
      // Refresh teams list
      await loadTeams();
      
      // Switch to teams tab
      setActiveTab("teams");
    } else {
      throw new Error('Invalid response from server');
    }
    
  } catch (err) {
    console.error('❌ Failed to accept invitation:', err);
    const errorMsg = err.message || err.error || 'Failed to join team';
    showToast('Failed to join team: ' + errorMsg, 'error');
    
    // Don't clean up on error - user might want to retry
    // But clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  } finally {
    setLoading(false);
  }
}, [loadTeams, setActiveTab, showToast]);

// Check for invitation ID in URL when component mounts or when user navigates to Collab
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const invitationId = urlParams.get('invitationId');
  
  if (invitationId) {
    console.log('🔗 Found invitation ID in URL:', invitationId);
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    
    if (!token || !username) {
      // Store invitation ID for later use after login
      localStorage.setItem('pendingInvitation', invitationId);
      console.log('💾 Stored pending invitation:', invitationId);
      showToast('Please log in to accept the team invitation', 'warning');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    
    // Auto-accept invitation when user is logged in
    console.log('✅ User is logged in, accepting invitation...');
    acceptPendingInvitation(invitationId);
  }
}, [acceptPendingInvitation]);

// Check for pending invitations after login or when component becomes active
useEffect(() => {
  const checkPendingInvitation = () => {
    const token = localStorage.getItem('token');
    const pendingInvitation = localStorage.getItem('pendingInvitation');
    
    if (pendingInvitation && token) {
      console.log('🔍 Found pending invitation after login or when Collab became active:', pendingInvitation);
      // Small delay to ensure everything is loaded (teams, etc.)
      const timer = setTimeout(() => {
        acceptPendingInvitation(pendingInvitation);
      }, 1000); // Increased delay to ensure teams are loaded
      
      return timer;
    }
    return null;
  };

  // Check immediately
  let timer = checkPendingInvitation();
  
  // Also check periodically (in case token wasn't available immediately)
  const interval = setInterval(() => {
    if (timer) clearTimeout(timer);
    timer = checkPendingInvitation();
  }, 2000);

  return () => {
    if (timer) clearTimeout(timer);
    clearInterval(interval);
  };
}, [acceptPendingInvitation]);


  // REPLACE the createProject function with this:
const createProject = async () => {
  setError(null);
  if (!activeTeam) {
    showToast('Select a team first before creating a project', 'error');
    return;
  }
  if (!newProject.name.trim()) return;

  setLoading(true);
  try {
    const projectData = {
      name: newProject.name.trim(),
      description: newProject.description?.trim() || "",
      teamId: activeTeam.id, 
      teamName: activeTeam.name,
    };
    
    // ALWAYS use backend - remove localStorage fallback
    const result = await collabAPI.createProject(projectData);
    const project = result.project;
    console.log('Project created in backend:', project);
    
    // Update state with the created project
    setProjects(prev => [...prev, project]);
    setActiveProject(project);
    
    addActivity("project_created", 1, project.id, null, `created project '${project.name}'`, activeTeam.id);
    showToast('Project created successfully!', 'success');
    setShowProjectModal(false);
    setNewProject({ name: "", description: "" });
    
  } catch (err) {
    console.error('Create project error:', err);
    setError(err.message || 'Failed to create project');
    showToast('Failed to create project: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
};

const deleteProject = async (projectId) => {
  const projectToDelete = projects.find(p => p.id === projectId);
  
  setConfirmationModal({
    title: "Delete Project",
    message: `Are you sure you want to delete "${projectToDelete?.name}"? This action cannot be undone.`,
    onConfirm: async () => {
      setConfirmationModal(null);
      // ... rest of the original delete logic here
      setLoading(true);
      setError(null);
      try {
        // Try backend first
        try {
          await collabAPI.deleteProject(projectId);
        } catch (err) {
          console.error('Backend delete failed, using localStorage fallback:', err);
        }
        
        // Always update local state
        const updatedProjects = projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);
        
        // Update active project if needed
        if (activeProject?.id === projectId) {
          setActiveProject(updatedProjects[0] || null);
        }
        
        // Add activity
        const deletedProject = projects.find(p => p.id === projectId);
        if (deletedProject) {
          addActivity("project_deleted", 1, deletedProject.id, null, `deleted project '${deletedProject.name}'`, activeTeam.id);
        }
        
        showToast('Project deleted successfully!', 'success');
        
      } catch (err) {
        setError(err.message || 'Failed to delete project');
        console.error('Failed to delete project:', err);
        
        // Fallback: update local state even if backend fails
        const updatedProjects = projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);
        
        if (activeProject?.id === projectId) {
          setActiveProject(updatedProjects[0] || null);
        }
      } finally {
        setLoading(false);
      }
    },
    onCancel: () => setConfirmationModal(null)
  });
};

  // Team Management
  const createTeam = async () => {
  setError(null);
  if (!newTeam.name.trim()) {
    showToast('Team name is required', 'error');
    return;
  }
  
  setLoading(true);
  try {
    const teamData = {
      name: newTeam.name.trim(),
      description: newTeam.description?.trim() || "",
      // Remove projectId dependency
    };
    
    console.log('Creating team with data:', teamData);
    
    const result = await collabAPI.createTeam(teamData);
    
    if (result.team) {
  const createdTeam = result.team;
  
  // Update teams state immediately
  setTeams(prev => [...prev, createdTeam]);
  
  showToast('Team created successfully!', 'success');
  setShowTeamModal(false);
  setNewTeam({ name: "", description: "" });
  
  // Switch to teams tab to see the new team
  setActiveTab("teams");
} else if (result.error) {
  throw new Error(result.error);
} else {
  throw new Error('Failed to create team - no team data returned');
}
  } catch (err) {
    console.error('Team creation error:', err);
    const errorMsg = err.message || 'Failed to create team';
    setError(errorMsg);
    showToast(errorMsg, 'error');
  } finally {
    setLoading(false);
  }
};


 const inviteMember = async () => {
  setError(null);
  if (isUserAlreadyMember(newInvite.email)) {
  setError('This user is already a team member');
  return;
}
  if (!newInvite.email || !activeTeam) return;

  setLoading(true);
  try {
    // First try direct invitation
    await collabAPI.inviteMember(activeTeam.id, newInvite);
    setError(null);
    showToast('Invitation sent successfully!', 'success');
    setShowInviteModal(false);
    setNewInvite({ email: "", role: "member" });
  } catch (err) {
    if (err.message.includes('User not found')) {
      // If user not found, create a pending invitation
      setError('User not found. They will receive an invitation to create an account.');
      // You could implement a pending invitations system here
      console.log('Would create pending invitation for:', newInvite.email);
    } else if (err.message.includes('already a team member')) {
      setError('This user is already a member of the team');
    } else {
      setError(err.message || 'Failed to send invitation');
    }
  } finally {
    setLoading(false);
  }
};

  const getInviteLink = (team) => {
  const baseUrl = window.location.origin;
  // Use the actual inviteToken from the team data
  const token = team.inviteToken || team.id;
  // Point to login page so users can log in if needed, or home page if already logged in
  return `${baseUrl}/login?invitationId=${token}`;
};

  const copyInviteLink = async (team) => {
    const inviteLink = getInviteLink(team);
    
    try {
      // Try modern Clipboard API first (requires HTTPS or localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        showToast('Invite link copied to clipboard!', 'success');
        return;
      }
      
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          showToast('Invite link copied to clipboard!', 'success');
        } else {
          // If both methods fail, show the link in an alert or let user copy manually
          prompt('Copy this invite link:', inviteLink);
          showToast('Please copy the link manually', 'warning');
        }
      } catch (err) {
        document.body.removeChild(textArea);
        // Fallback: show prompt with the link
        prompt('Copy this invite link:', inviteLink);
        showToast('Please copy the link manually', 'warning');
      }
    } catch (error) {
      console.error('Failed to copy invite link:', error);
      // Last resort: show prompt
      prompt('Copy this invite link:', inviteLink);
      showToast('Please copy the link manually', 'warning');
    }
  };

// UPDATE the deleteTeam function:
const deleteTeam = async (teamId) => {
  const teamToDelete = teams.find(t => t.id === teamId);
  setConfirmationModal({
    title: "Delete Team",
    message: `Are you sure you want to delete the team "${teamToDelete?.name}"? This will remove all team projects, messages, and member access.`,
    onConfirm: async () => {
      setConfirmationModal(null);
      setLoading(true);
      try {
        // Call backend to delete team
        await collabAPI.deleteTeam(teamId);
        
        // Update local state after successful backend deletion
        const updated = teams.filter(t => t.id !== teamId);
        setTeams(updated);
        
        // Clear active team if it was deleted
        if (activeTeam?.id === teamId) {
          setActiveTeam(null);
          setActiveProject(null);
        }
        
        showToast('Team deleted successfully', 'success');
      } catch (err) {
        console.error('Failed to delete team:', err);
        
        // Show specific error message
        if (err.status === 403) {
          showToast('Only team owner can delete the team', 'error');
        } else if (err.status === 404) {
          showToast('Team not found', 'error');
        } else {
          showToast(err.message || 'Failed to delete team', 'error');
        }
        
        // Even if backend fails, update local state to remove from UI
        const updated = teams.filter(t => t.id !== teamId);
        setTeams(updated);
        
        if (activeTeam?.id === teamId) {
          setActiveTeam(null);
          setActiveProject(null);
        }
      } finally {
        setLoading(false);
      }
    },
    onCancel: () => setConfirmationModal(null)
  });
};

  // Task Management
const addTaskToProject = async () => {

  if (!activeTeam || !activeProject) {
  showToast('Please select a team and project first', 'error');
  return;
}

  if (!newTask.title.trim() || !activeProject) {
    showToast('Task title is required', 'error');
    return;
  }
  
  if (newTask.assignedTo.length === 0) {
    showToast('Please assign at least one user to the task', 'error');
    return;
  }
  
  setLoading(true);
  setError(null);
  try {
    // ✅ Use backend API to create task properly
    // ✅ Use backend API to create task properly
const taskData = {
  title: newTask.title,
  description: newTask.description,
  assignedTo: newTask.assignedTo,
  dueDate: newTask.dueDate,
  priority: newTask.priority,
  status: "todo"
};

console.log('🔍 [DEBUG] Creating task with data:', {
  teamId: activeTeam.id,
  projectId: activeProject.id,
  taskData
});

// ✅ Call your backend task creation endpoint
const result = await collabAPI.createTask(activeTeam.id, activeProject.id, taskData);
console.log('✅ [DEBUG] Task creation result:', result);
    const createdTask = result.task;
    
    // ✅ Update local state with the properly created task
    const updatedTasks = [...(activeProject.tasks || []), createdTask];
    
    const updatedProjects = projects.map(project =>
      project.id === activeProject.id
        ? { ...project, tasks: updatedTasks }
        : project
    );
    
    setProjects(updatedProjects);
    setActiveProject(prev => ({
      ...prev,
      tasks: updatedTasks
    }));

    addActivity("task_created", 1, activeProject.id, createdTask.id, `created task '${createdTask.title}'`, activeTeam.id);
    
    setShowTaskModal(false);
    setNewTask({
      title: "",
      description: "",
      assignedTo: [],
      dueDate: "",
      priority: "Medium"
    });
    
    showToast('Task created successfully!', 'success');
  } catch (err) {
    setError(err.message || 'Failed to create task');
    showToast('Failed to create task: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
};

  const updateTaskStatus = async (taskId, newStatus) => {
  if (!activeProject) return;
  
  setLoading(true);
  try {
    // Try backend first
    try {
      await collabAPI.updateTask(activeTeam.id, activeProject.id, taskId, { status: newStatus });
    } catch (err) {
      console.error('Backend update failed, using localStorage fallback:', err);
    }
    
    // Always update local state
    const updatedProjects = projects.map(project => 
      project.id === activeProject.id 
        ? {
            ...project,
            tasks: project.tasks.map(task =>
              task.id === taskId
                ? { ...task, status: newStatus }
                : task
            )
          }
        : project
    );
    
    setProjects(updatedProjects);
    
    setActiveProject(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? { ...task, status: newStatus }
          : task
      )
    }));

    const task = activeProject.tasks.find(t => t.id === taskId);
    if (task) {
      addActivity("task_updated", 1, activeProject.id, taskId, `updated task '${task.title}' status to ${newStatus}`,activeTeam.id);
    }
  } catch (err) {
    console.error('Failed to update task:', err);
  } finally {
    setLoading(false);
  }
};

const deleteTask = async (taskId) => {
  if (!activeProject) return;

  setLoading(true);
  try {
    // call server delete
    await collabAPI.deleteTask(activeTeam.id, activeProject.id, taskId);

    // update local state
    const updatedTasks = (activeProject.tasks || []).filter(task => task.id !== taskId);
    const updatedProjects = projects.map(project =>
      project.id === activeProject.id
        ? { ...project, tasks: updatedTasks }
        : project
    );

    setProjects(updatedProjects);
    setActiveProject(prev => ({ ...prev, tasks: updatedTasks }));
    addActivity("task_deleted", /* userId */ 1, activeProject.id, taskId, `deleted task`, activeTeam?.id);
    showToast('Task deleted successfully', 'success');
  } catch (err) {
    console.error('Failed to delete task:', err);
    showToast('Failed to delete task: ' + (err.message || err), 'error');
  } finally {
    setLoading(false);
  }
};


// ADD this function near your other task functions:
const cleanupDeletedTasks = (projectId, currentTasks) => {
  const project = projects.find(p => p.id === projectId);
  if (!project || !project.tasks) return currentTasks;
  
  // Filter out tasks that don't exist in the project anymore
  return currentTasks.filter(task => 
    project.tasks.some(projectTask => projectTask.id === task.id)
  );
};

  const assignTask = async (taskId, userIds) => {
  if (!activeProject) return;
  
  setLoading(true);
  try {
    // Try backend first
    try {
      await collabAPI.updateTask(activeTeam.id, activeProject.id, taskId, { assignedTo: userIds });
    } catch (err) {
      console.error('Backend update failed, using localStorage fallback:', err);
    }
    
    // Always update local state
    const updatedProjects = projects.map(project => 
      project.id === activeProject.id 
        ? {
            ...project,
            tasks: project.tasks.map(task =>
              task.id === taskId
                ? { ...task, assignedTo: userIds }
                : task
            )
          }
        : project
    );
    
    setProjects(updatedProjects);
    
    setActiveProject(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId
          ? { ...task, assignedTo: userIds }
          : task
      )
    }));

    const task = activeProject.tasks.find(t => t.id === taskId);
    const assignedNames = userIds.map(id => activeTeam?.members?.find(m => m.id === id)?.name).join(", ");
    if (task) {
      addActivity("task_assigned", 1, activeProject.id, taskId, `assigned task '${task.title}' to ${assignedNames}`,activeTeam.id);
    }
  } catch (err) {
    console.error('Failed to assign task:', err);
  } finally {
    setLoading(false);
  }
};

  // User Search
  const searchUsers = async (query) => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    setUserSearchResults([]);
    return;
  }
  
  setSearchingUsers(true);
  try {
    const results = await collabAPI.searchUsers(trimmedQuery);
    setUserSearchResults(results.users || []);
  } catch (err) {
    console.error('User search failed:', err);
    setUserSearchResults([]);
  } finally {
    setSearchingUsers(false);
  }
};

  

  // Filter tasks by status
  const getTasksByStatus = (status) => {
    if (!activeProject) return [];
    return activeProject.tasks.filter(task => task.status === status);
  };

  const statusColumns = [
    { key: "todo", title: "To Do", color: "#6b7280", icon: ClockIcon },
    { key: "in-progress", title: "In Progress", color: "#f59e0b", icon: EllipsisVerticalIcon },
    { key: "review", title: "Review", color: "#8b5cf6", icon: EyeIcon },
    { key: "completed", title: "Completed", color: "#10b981", icon: CheckCircleIcon }
  ];

  

  // Enhanced styles
  const styles = {
    page: { padding: '1rem 0', minHeight: '100vh', background: 'var(--bg)' },
    card: {
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: 'var(--shadow)',
      marginBottom: '1rem'
    },
    btnPrimary: {
      background: 'var(--blue)',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      cursor: 'pointer',
      fontSize: '0.9rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    btnSecondary: {
      background: 'var(--input-bg)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '0.5rem 1rem',
      cursor: 'pointer',
      fontSize: '0.9rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      background: 'var(--input-bg)',
      color: 'var(--text)',
      marginBottom: '1rem',
      fontSize: '0.9rem'
    },
    textarea: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      background: 'var(--input-bg)',
      color: 'var(--text)',
      marginBottom: '1rem',
      fontSize: '0.9rem',
      minHeight: '80px',
      resize: 'vertical'
    },
    select: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      background: 'var(--input-bg)',
      color: 'var(--text)',
      marginBottom: '1rem',
      fontSize: '0.9rem'
    }
  };

  return (
    <div style={styles.page}>
      {toast && (
  <Toast 
    message={toast.message} 
    type={toast.type} 
    onClose={() => setToast(null)}
  />
)}
      {/* Header with Search and Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text)' }}>Team Collaboration</h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Chat button that's conditionally rendered */}
          {activeTeam && (
  <button 
    style={{
      padding: '0.5rem 1rem',
      border: '1px solid var(--border)',
      background: 'var(--input-bg)',
      borderRadius: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.9rem',
      color: 'var(--text)',
    }}
    onClick={() => setShowChat(!showChat)}
  >
    <ChatBubbleLeftIcon style={{ width: '16px', height: '16px' }} />
    Team Chat
  </button>
)}

          {/* Tabs */}
          <div style={{ display: 'flex', background: 'var(--input-bg)', borderRadius: '8px', padding: '4px' }}>
            <button
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeTab === "workspace" ? 'var(--blue)' : 'transparent',
                color: activeTab === "workspace" ? '#fff' : 'var(--muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={() => setActiveTab("workspace")}
            >
              Workspace
            </button>
            
            <button
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeTab === "teams" ? 'var(--blue)' : 'transparent',
                color: activeTab === "teams" ? '#fff' : 'var(--muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={() => setActiveTab("teams")}
            >
              Teams
            </button>
            
            <button
              style={{
                padding: '0.5rem 1rem',
                border: 'none',
                background: activeTab === "activity" ? 'var(--blue)' : 'transparent',
                color: activeTab === "activity" ? '#fff' : 'var(--muted)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              onClick={() => setActiveTab("activity")}
            >
              Activity Feed
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{
              float: 'right',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            <XMarkIcon style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      

      {/* Workspace Tab */}
{activeTab === "workspace" && (
  <div>
    {!activeTeam && (
      <div style={styles.card}>
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'var(--muted)', 
          padding: '3rem'
        }}>
          <UserGroupIcon style={{ width: '48px', height: '48px', marginBottom: '1rem', opacity: 0.5 }} />
          <h3 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>Select a Team</h3>
          <p style={{ marginBottom: '1.5rem' }}>
            Please select a team from the Teams tab to view and manage projects.
          </p>
          <button 
            style={styles.btnPrimary}
            onClick={() => setActiveTab("teams")}
          >
            Go to Teams
          </button>
        </div>
      </div>
    )}
    
    {activeTeam && projects.length === 0 && !loading && (
  <div style={styles.card}>
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      color: 'var(--muted)', 
      padding: '3rem'
    }}>
      <FolderIcon style={{ width: '48px', height: '48px', marginBottom: '1rem', opacity: 0.5 }} />
      <h3 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No Project Yet</h3>
      <p style={{ marginBottom: '1.5rem' }}>
        Create a new project to start collaborating with your team.
      </p>
      <button 
        style={styles.btnPrimary}
        onClick={() => setShowProjectModal(true)}
      >
        <PlusIcon style={{ width: '16px', height: '16px' }} />
        Create Your First Project
      </button>
    </div>
  </div>
)}

          {activeTeam && projects.length > 0 && !activeProject && !loading && (
  <div>
    <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
      <button 
        style={styles.btnPrimary}
        onClick={() => setShowProjectModal(true)}
      >
        <PlusIcon style={{ width: '16px', height: '16px' }} />
        New Project
      </button>
    </div>
    <div style={{ display: 'grid', gap: '1rem' }}>
      {projects .map(project => (
    <div 
      key={project.id}
      style={{ ...styles.card, cursor: 'pointer', position: 'relative' }}
      onClick={() => setActiveProject(project)}
    >
          <button
            onClick={(e) => {
              e.stopPropagation(); 
              deleteProject(project.id);
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--muted)'
            }}
            title="Delete project"
          >
            <TrashIcon style={{ width: '16px', height: '16px' }} />
          </button>

          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}>
            {project.name}
          </h3>
          <p style={{ margin: 0, color: 'var(--muted)' }}>{project.description}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
            <span>{project.tasks?.length || 0} tasks</span>
            <span>{project.members?.length || 0} members</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

          {activeProject && !loading && (
            <div>
              <button 
                style={{ ...styles.btnSecondary, marginBottom: '1rem' }}
                onClick={() => setActiveProject(null)}
              >
                ← Back to Projects
              </button>

              <div style={{ ...styles.card, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ color: 'var(--text)', margin: 0 }}>{activeProject.name}</h2>
                  <button 
                    style={{ ...styles.btnPrimary, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowTaskModal(true)}
                  >
                    <PlusIcon style={{ width: '16px', height: '16px' }} />
                    Add Task
                  </button>
                </div>
                <p style={{ color: 'var(--muted)', margin: 0 }}>{activeProject.description}</p>
              </div>

              {/* Kanban Board */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: 'flex', gap: '1rem', minWidth: '1000px' }}>
                  {statusColumns.map(column => (
                    <div key={column.key} style={{ flex: '1 0 250px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <column.icon style={{ width: '16px', height: '16px', color: column.color }} />
                        <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                          {column.title} ({getTasksByStatus(column.key).length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {getTasksByStatus(column.key).map(task => (
                          <TaskCard 
  key={task.id} 
  task={task} 
  project={activeProject}
  team={activeTeam}
  onUpdateStatus={updateTaskStatus}
  onAssignTask={assignTask}
  onDeleteTask={deleteTask}
  onAddComment={() => {}}
  teamMembers={activeTeam?.members || []}
  fileUploads={fileUploads[task.id] || []}
  setConfirmationModal={setConfirmationModal} // ADD THIS PROP
/>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === "teams" && (
        <div>
          {/* FIXED: Remove project dependency from teams display */}
          {(!teams || teams.length === 0) && !loading ? (
            <div style={styles.card}>
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--muted)', 
                padding: '3rem'
              }}>
                <UserGroupIcon style={{ width: '48px', height: '48px', marginBottom: '1rem', opacity: 0.5 }} />
                <h3 style={{ color: 'var(--text)', marginBottom: '0.5rem' }}>No Teams Yet</h3>
                <p style={{ marginBottom: '1.5rem' }}>
                  Create your first team to start collaborating with others.
                </p>
                <button 
                  style={styles.btnPrimary}
                  onClick={() => setShowTeamModal(true)}
                >
                  <PlusIcon style={{ width: '16px', height: '16px' }} />
                  Create Your First Team
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Team Cards */}
              {teams.map(team => (
                <div
                  key={team.id}
                  style={{
                    background: 'var(--card-bg)',
                    border: `1px solid ${activeTeam?.id === team.id ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: '12px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setActiveTeam(team)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}>{team.name}</h3>
                      {team.description && (
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{team.description}</p>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {/* Role Badge */}
                      <span style={{
                        background: team.members?.find(m => m.username === localStorage.getItem('username'))?.role === 'owner' 
                          ? '#dcfce7' 
                          : team.members?.find(m => m.username === localStorage.getItem('username'))?.role === 'admin'
                          ? '#dbeafe'
                          : '#f3f4f6',
                        color: team.members?.find(m => m.username === localStorage.getItem('username'))?.role === 'owner'
                          ? '#166534'
                          : team.members?.find(m => m.username === localStorage.getItem('username'))?.role === 'admin'
                          ? '#1e40af'
                          : '#374151',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {team.members?.find(m => m.username === localStorage.getItem('username'))?.role || 'member'}
                      </span>

                      <button
  onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }}
  style={{
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--muted)',
    padding: '0.25rem'
  }}
  title="Delete team"
>
  <TrashIcon style={{ width: '16px', height: '16px' }} />
</button>
                    </div>
                  </div>

                  {/* Team Members */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {team.members?.slice(0, 3).map((member, index) => (
                          <div
                            key={member.username}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#6b7280',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              marginLeft: index > 0 ? '-8px' : '0',
                              border: '2px solid var(--card-bg)'
                            }}
                            title={member.username}
                          >
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {team.members && team.members.length > 3 && (
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--input-bg)',
                            color: 'var(--muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            marginLeft: '-8px',
                            border: '2px solid var(--card-bg)'
                          }}>
                            +{team.members.length - 3}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                        {team.members?.length || 0} members
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        style={{
                          border: '1px solid var(--border)',
                          background: 'transparent',
                          color: 'var(--text)',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteLink(team);
                        }}
                      >
                        <LinkIcon style={{ width: '14px', height: '14px' }} />
                        Copy Invite
                      </button>
                      
                      <button
                        style={{
                          background: 'var(--blue)',
                          color: '#fff',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTeam(team);
                          setShowInviteModal(true);
                        }}
                      >
                        <UserPlusIcon style={{ width: '14px', height: '14px' }} />
                        Invite
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Create Team Card */}
              <div
                style={{
                  background: 'var(--card-bg)',
                  border: '2px dashed var(--border)',
                  borderRadius: '12px',
                  padding: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => setShowTeamModal(true)}
              >
                <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  <PlusIcon style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem' }} />
                  <p style={{ margin: 0 }}>Create New Team</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Feed Tab */}
      {activeTab === "activity" && (
        <div style={{ width: "100%" }}>
          {/* FIXED: Remove project dependency from activity feed */}
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activities.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No activity yet.</p>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2575fc', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.8rem', flexShrink: 0 }}>
                      U{activity.user}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)' }}>{activity.message}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {new Date(activity.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      

      {/* Team Chat */}
      {showChat && activeTeam && (
        <TeamChat team={activeTeam} onClose={() => setShowChat(false)} />
      )}

      {/* Modals */}
      {showProjectModal && (
        <Modal onClose={() => setShowProjectModal(false)}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>Create New Project</h3>
          <input
            type="text"
            placeholder="Project Name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder="Project Description"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            style={styles.textarea}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button 
              style={styles.btnSecondary}
              onClick={() => setShowProjectModal(false)}
            >
              Cancel
            </button>
            <button 
              style={styles.btnPrimary}
              onClick={createProject}
              disabled={!newProject.name.trim() || loading}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirmation Modal */}
{confirmationModal && (
  <ConfirmationModal
    title={confirmationModal.title}
    message={confirmationModal.message}
    onConfirm={confirmationModal.onConfirm}
    onCancel={confirmationModal.onCancel}
  />
)}

      {showTeamModal && (
        <Modal onClose={() => setShowTeamModal(false)}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>Create New Team</h3>
          <input
            type="text"
            placeholder="Team Name"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder="Team Description"
            value={newTeam.description}
            onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
            style={styles.textarea}
          />
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button 
              style={styles.btnSecondary}
              onClick={() => setShowTeamModal(false)}
            >
              Cancel
            </button>
            <button 
              style={styles.btnPrimary}
              onClick={createTeam}
              disabled={!newTeam.name.trim() || loading}
            >
              {loading ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </Modal>
      )}

      

      {showTaskModal && (
        <Modal onClose={() => setShowTaskModal(false)}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>Add New Task</h3>
          <input
            type="text"
            placeholder="Task Title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            style={styles.input}
          />
          <textarea
            placeholder="Task Description"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            style={styles.textarea}
          />
          
          {/* User Search for Assignment */}
<div style={{ position: 'relative', marginBottom: '1rem' }}>
  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem' }}>
  Search User
</label>
<div style={{ display: 'flex', alignItems: 'center', background: 'var(--input-bg)', borderRadius: '8px', padding: '0.5rem', border: '1px solid var(--border)', marginBottom: '1rem' }}>
  <MagnifyingGlassIcon style={{ width: '16px', height: '16px', color: 'var(--muted)' }} />
  <input
    type="text"
    placeholder="Search users"
    value={userSearchQuery}
    onChange={(e) => {
      setUserSearchQuery(e.target.value);
      searchUsers(e.target.value);
    }}
    style={{
      border: 'none',
      background: 'transparent',
      color: 'var(--text)',
      marginLeft: '0.5rem',
      outline: 'none',
      flex: 1
    }}
  />
  </div>

{/* Member List Section */}
<div style={{ marginBottom: '1rem' }}>
  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)', fontSize: '0.8rem' }}>Team Members</h5>
  <select
    multiple
    value={newTask.assignedTo || []}
    onChange={(e) => {
      const selected = Array.from(e.target.selectedOptions, option => option.value);
      setNewTask(prev => {
  const selected = Array.from(e.target.selectedOptions, option => option.value);
  return { ...prev, assignedTo: [...new Set([...prev.assignedTo, ...selected])] };
});

    }}
    style={{
      width: '100%',
      padding: '0.5rem',
      border: '1px solid var(--border)',
      borderRadius: '6px',
      background: 'var(--input-bg)',
      color: 'var(--text)',
      fontSize: '0.8rem',
      minHeight: '80px'
    }}
  >
    {(userSearchQuery ? userSearchResults : activeTeam?.members || []).map(member => (
      <option key={member.id} value={member.id}>
        {member.name || member.username} ({member.role || 'member'})
      </option>
    ))}
  </select>
  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
  </div>
</div>
</div>

{/* Selected Users */}
{newTask.assignedTo.length > 0 && (
  <div style={{ marginBottom: '1rem' }}>
    <div style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.5rem' }}>Assigned to:</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {newTask.assignedTo
        .map(userId => {
          const user = activeTeam?.members.find(m => m.id === userId) || userSearchResults.find(u => u.id === userId);
          return user ? { userId, user } : null;
        })
        .filter(item => item !== null)
        .map(({ userId, user }) => (
          <div
            key={userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--input-bg)',
              padding: '0.25rem 0.5rem',
              borderRadius: '16px',
              fontSize: '0.8rem'
            }}
          >
            <span>{user.name || user.username}</span>
            <button
              onClick={() => setNewTask({
                ...newTask,
                assignedTo: newTask.assignedTo.filter(id => id !== userId)
              })}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '0.8rem'
              }}
            >
              <XMarkIcon style={{ width: '12px', height: '12px' }} />
            </button>
          </div>
        ))}
    </div>
  </div>
)}

          <input
            type="date"
            value={newTask.dueDate}
            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            style={styles.input}
          />
          <select
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            style={styles.select}
          >
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button 
              style={styles.btnSecondary}
              onClick={() => setShowTaskModal(false)}
            >
              Cancel
            </button>
            <button 
  style={{
    ...styles.btnPrimary,
    background: (newTask.title.trim() && newTask.assignedTo.length > 0) ? 'var(--blue)' : 'var(--border)',
    cursor: (newTask.title.trim() && newTask.assignedTo.length > 0) ? 'pointer' : 'not-allowed'
  }}
  onClick={addTaskToProject}
  disabled={!newTask.title.trim() || newTask.assignedTo.length === 0 || loading}
>
  {loading ? 'Creating...' : 'Create Task'}
</button>
          </div>
        </Modal>
      )}

      

      {showInviteModal && activeTeam && (
  <Modal onClose={() => setShowInviteModal(false)}>
    <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>
      Invite to {activeTeam.name}
    </h3>
    
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)', fontSize: '0.9rem' }}>
        Email Address or Username
      </label>
      <input
        type="text"
        placeholder="Enter email or username"
        value={newInvite.email}
        onChange={(e) => {
          setNewInvite({ ...newInvite, email: e.target.value });
          if (error) setError(null);
        }}
        style={{
          ...styles.input,
          borderColor: isUserAlreadyMember(newInvite.email) ? '#ef4444' : 'var(--border)'
        }}
      />
      {isUserAlreadyMember(newInvite.email) && (
        <div style={{ 
          color: '#ef4444', 
          fontSize: '0.8rem', 
          marginTop: '-0.5rem',
          marginBottom: '1rem'
        }}>
          This user is already a team member
        </div>
      )}
      
      {/* Help text */}
      <div style={{ 
        fontSize: '0.8rem', 
        color: 'var(--muted)',
        marginTop: '0.25rem'
      }}>
        User must have an existing account to be invited
      </div>
    </div>

    <select
      value={newInvite.role}
      onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
      style={styles.select}
    >
      <option value="member">Member</option>
      <option value="admin">Admin</option>
      {activeTeam.members?.find(m => m.username === localStorage.getItem('username'))?.role === 'owner' && (
        <option value="owner">Owner</option>
      )}
    </select>

    {/* Invite link section remains the same */}
    <div style={{ 
      background: 'var(--input-bg)', 
      borderRadius: '8px', 
      padding: '1rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <LinkIcon style={{ width: '16px', height: '16px', color: 'var(--muted)' }} />
        <span style={{ fontWeight: '500', color: 'var(--text)' }}>Invite Link</span>
      </div>
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem',
        alignItems: 'center'
      }}>
        <input
          type="text"
          readOnly
          value={getInviteLink(activeTeam)}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--card-bg)',
            color: 'var(--text)',
            fontSize: '0.8rem',
            fontFamily: 'monospace'
          }}
        />
        <button
          onClick={() => copyInviteLink(activeTeam)}
          style={{
            padding: '0.5rem',
            border: '1px solid var(--border)',
            background: 'transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            color: 'var(--text)'
          }}
        >
          Copy
        </button>
      </div>
      <div style={{ 
        fontSize: '0.75rem', 
        color: 'var(--muted)',
        marginTop: '0.5rem'
      }}>
        Share this link for users to join without an email invitation
      </div>
    </div>

    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
      <button 
        style={styles.btnSecondary}
        onClick={() => setShowInviteModal(false)}
      >
        Cancel
      </button>
      <button 
        style={styles.btnPrimary}
        onClick={inviteMember}
        disabled={!newInvite.email || loading || isUserAlreadyMember(newInvite.email)}
      >
        {loading ? 'Sending...' : 'Send Invitation'}
      </button>
    </div>
  </Modal>
      )}
      
    </div>
  );
}