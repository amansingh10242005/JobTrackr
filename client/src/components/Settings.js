import { useState, useEffect } from "react";
import {
  Cog6ToothIcon,
  BellIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

// ADD this API helper function
const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`http://localhost:5000/api${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Handle 404 and other errors gracefully
    if (response.status === 404) {
      return null; // Return null instead of throwing error
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

export default function Settings() {
  // REPLACE the entire useState with:
  const [settings, setSettings] = useState({
    timezone: "UTC+5:30",
    dateFormat: "DD/MM/YYYY",
    emailNotifications: true,
    pushNotifications: true,
    profileVisibility: "team"
  });

  // state for password change
const [passwordChange, setPasswordChange] = useState({
  currentPassword: "",
  newPassword: "", 
  confirmPassword: "",
  verifying: false,
  verified: false,
  error: null
});

// state for 2FA
const [twoFA, setTwoFA] = useState({
  enabled: false,
  email: "",
  otp: "",
  step: "setup", // "setup", "verify", "enabled", "disable"
  loading: false,
  error: null
});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  // ADD this useEffect for initial data loading
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
  try {
    setLoading(true);
    // Try to load from server first, fallback to localStorage
    const serverData = await apiFetch("/users/settings");
    if (serverData) {
      // Load regular settings
      if (serverData.settings) {
        setSettings(serverData.settings);
      }
      
      // Load 2FA status from server
      if (serverData.twoFA) {
        setTwoFA(prev => ({
          ...prev,
          enabled: serverData.twoFA.enabled || false,
          email: serverData.twoFA.email || "",
          step: serverData.twoFA.enabled ? "enabled" : "setup"
        }));
      }
    } else {
      // Server returned 404 or null, use localStorage
      const saved = localStorage.getItem("jobtrackr_settings");
      if (saved) {
        setSettings(JSON.parse(saved));
      }
      // If no saved settings, keep the default ones
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    // Fallback to localStorage on any error
    const saved = localStorage.getItem("jobtrackr_settings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  } finally {
    setLoading(false);
  }
};

  // REPLACE the current useEffect with:
  useEffect(() => {
    if (!loading) {
      persistSettings(settings);
    }
  }, [settings, loading]);

 const persistSettings = async (newSettings) => {
  try {
    // Save to localStorage immediately for quick access
    localStorage.setItem("jobtrackr_settings", JSON.stringify(newSettings));
    
    // Save to server in background - don't throw error if server fails
    const token = localStorage.getItem("token");
    if (token) {
      await apiFetch("/users/settings", {
        method: "PUT",
        body: JSON.stringify(newSettings)
      }).catch(error => {
        console.log("Server sync failed, but settings saved locally:", error);
      });
    }
  } catch (error) {
    console.error("Failed to persist settings:", error);
    // Settings are still saved locally
  }
};

// Add this useEffect for CSS injection
useEffect(() => {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = `
    @keyframes spin {
      0% { transform: translateY(-50%) rotate(0deg); }
      100% { transform: translateY(-50%) rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
  
  return () => {
    document.head.removeChild(styleSheet);
  };
}, []);

  // Toast auto cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.timeout || 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // REPLACE with:
  const handleSettingsChange = async (field, value) => {
    setSaving(true);
    try {
      const newSettings = { ...settings, [field]: value };
      setSettings(newSettings);
      
      // Show saving indicator
      setToast({ message: "Saving settings...", timeout: 1000 });
      
      // Wait for persistence
      await persistSettings(newSettings);
      
      setToast({ message: "Settings saved successfully!", timeout: 3000 });
    } catch (error) {
      setToast({ 
        message: "Failed to save settings. Changes saved locally.", 
        timeout: 5000,
        type: "warning"
      });
    } finally {
      setSaving(false);
    }
  };

  // REPLACE both functions with:
  const handleLogoutAllDevices = async () => {
    setModal(null);
    setSaving(true);
    try {
      await apiFetch("/auth/logout-all", { method: "POST" });
      setToast({ 
        message: "Successfully logged out from all other devices", 
        timeout: 5000 
      });
    } catch (error) {
      console.error("Logout all devices error:", error);
      setToast({ 
        message: error.message || "Failed to logout from all devices", 
        timeout: 5000,
        type: "warning"
      });
    } finally {
      setSaving(false);
    }
  };

  // ADD handlePasswordChange function
const handlePasswordChange = async (passwordData) => {
  setSaving(true);
  try {
    await apiFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
    });
    
    setToast({ 
      message: "Password changed successfully!", 
      timeout: 3000 
    });
    setModal(null);
    // Reset password change state
    setPasswordChange({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      verifying: false,
      verified: false,
      error: null
    });
  } catch (error) {
    setToast({ 
      message: error.message || "Failed to change password", 
      timeout: 5000,
      type: "warning"
    });
  } finally {
    setSaving(false);
  }
};

// 2FA handler functions
const handleSendOTP = async (email) => {
  setTwoFA(prev => ({ ...prev, loading: true, error: null }));
  try {
    await apiFetch("/auth/2fa/send-otp", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    setTwoFA(prev => ({ ...prev, step: "verify", loading: false }));
    setToast({ message: "OTP sent to your email!", timeout: 3000 });
  } catch (error) {
    setTwoFA(prev => ({ ...prev, error: error.message, loading: false }));
  }
};

const handleVerifyOTP = async (email, otp) => {
  setTwoFA(prev => ({ ...prev, loading: true, error: null }));
  try {
    const result = await apiFetch("/auth/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ email, otp })
    });
    // Update state from server response to ensure consistency
    if (result && result.twoFA) {
      setTwoFA(prev => ({ 
        ...prev, 
        enabled: result.twoFA.enabled, 
        email: result.twoFA.email || email,
        step: result.twoFA.enabled ? "enabled" : "setup", 
        loading: false 
      }));
    } else {
      setTwoFA(prev => ({ ...prev, enabled: true, step: "enabled", loading: false }));
    }
    setToast({ message: "Two-Factor Authentication enabled successfully!", timeout: 3000 });
  } catch (error) {
    setTwoFA(prev => ({ ...prev, error: error.message, loading: false }));
  }
};

const handleDisable2FA = async (otp) => {
  setTwoFA(prev => ({ ...prev, loading: true, error: null }));
  try {
    const result = await apiFetch("/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ otp })
    });
    // Update state from server response to ensure consistency
    if (result && result.twoFA) {
      setTwoFA(prev => ({ 
        ...prev, 
        enabled: result.twoFA.enabled, 
        step: result.twoFA.enabled ? "enabled" : "setup", 
        loading: false 
      }));
    } else {
      setTwoFA(prev => ({ ...prev, enabled: false, step: "setup", loading: false }));
    }
    setModal(null);
    setToast({ message: "Two-Factor Authentication disabled successfully!", timeout: 3000 });
  } catch (error) {
    setTwoFA(prev => ({ ...prev, error: error.message, loading: false }));
  }
};

  const handleDeleteAccount = async () => {
    setModal(null);
    setSaving(true);
    try {
      await apiFetch("/account/delete", { method: "DELETE" });
      
      // Clear all local data
      localStorage.clear();
      sessionStorage.clear();
      
      setToast({ 
        message: "Account deleted successfully", 
        timeout: 3000 
      });
      
      // Redirect to home page after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (error) {
      console.error("Delete account error:", error);
      setToast({ 
        message: error.message || "Failed to delete account", 
        timeout: 5000,
        type: "warning"
      });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Cog6ToothIcon },
    { id: "notifications", label: "Notifications", icon: BellIcon },
    { id: "privacy", label: "Privacy & Security", icon: ShieldCheckIcon }
  ];

  // Toast styles
  const toastStyle = {
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
  };

  return (
    <div
      style={{
        background: "var(--card-bg)",
        padding: "2rem",
        borderRadius: "14px",
        boxShadow: "var(--shadow)",
        border: "1px solid var(--border)",
        minHeight: "600px"
      }}
    >
      {/* Modal */}
      {modal && (
  <div style={{
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000
  }}>
    <div style={{
      background: "var(--card-bg)",
      padding: "1.5rem",
      borderRadius: "8px",
      border: "1px solid var(--border)",
      boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
      maxWidth: (modal.message === "change-password-form" || modal.message === "2fa-setup") ? "450px" : "400px", width: "90%"
    }}>
      {/* Password Change Form */}
      {modal.message === "change-password-form" ? (
        <PasswordChangeForm 
          passwordChange={passwordChange}
          setPasswordChange={setPasswordChange}
          onClose={() => setModal(null)}
          onConfirm={handlePasswordChange}
          saving={saving}
        />
      ) :  modal.message === "2fa-setup" ? (
  <TwoFASetupForm 
    twoFA={twoFA}
    setTwoFA={setTwoFA}
    onClose={() => setModal(null)}
    onSendOTP={handleSendOTP}
    onVerifyOTP={handleVerifyOTP}
    onDisable2FA={handleDisable2FA}
    saving={saving}
  />
) : (
        /* Existing Confirmation Modal */
        <>
          <h3 style={{ margin: "0 0 1rem 0", color: modal.destructive ? "#dc2626" : "inherit" }}>
            {modal.title || "Confirmation"}
          </h3>
          <p style={{ margin: "0 0 1.5rem 0" }}>{modal.message}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button 
              onClick={modal.onConfirm}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                background: modal.destructive ? "#dc2626" : "var(--blue)",
                color: "white",
                border: "none"
              }}
            >
              Confirm
            </button>
            <button 
              onClick={modal.onCancel}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: "var(--card-bg)"
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}

      {/* ADD loading overlay */}
      {loading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <div style={{
            background: "var(--card-bg)",
            padding: "2rem",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div>Loading settings...</div>
          </div>
        </div>
      )}

      {/* ADD saving indicator */}
      {saving && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          background: "var(--blue)",
          color: "white",
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          zIndex: 2000
        }}>
          Saving...
        </div>
      )}

      {/* Enhanced Toast System */}
      {toast && (
        <div style={{
          ...toastStyle,
          borderColor: toast.type === "warning" ? "#f59e0b" : 
                      toast.type === "error" ? "#dc2626" : "var(--border)"
        }}>
          {toast.type === "warning" ? (
            <ExclamationTriangleIcon width={16} color="#f59e0b" />
          ) : toast.type === "error" ? (
            <ExclamationTriangleIcon width={16} color="#dc2626" />
          ) : (
            <CheckCircleIcon width={16} color="#22c55e" />
          )}
          {toast.message}
        </div>
      )}

      <div style={{ display: "flex", gap: "2rem", minHeight: "500px" }}>
        {/* Sidebar */}
        <div
          style={{
            width: "250px",
            borderRight: "1px solid var(--border)",
            paddingRight: "1rem"
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                cursor: "pointer",
                marginBottom: "0.5rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                background:
                  activeTab === tab.id ? "var(--blue)" : "transparent",
                color: activeTab === tab.id ? "white" : "var(--text)",
                transition: "all 0.2s ease"
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon style={{ width: "20px", height: "20px" }} />
              <span>{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          <h2
            style={{
              marginBottom: "2rem",
              fontSize: "1.5rem",
              fontWeight: "700"
            }}
          >
            {tabs.find((tab) => tab.id === activeTab)?.label} Settings
          </h2>

          {/* General Tab */}
          {activeTab === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <SettingSection title="Region & Time">
                <SettingSelect
                  label="Timezone"
                  value={settings.timezone}
                  onChange={(value) => handleSettingsChange("timezone", value)}
                  options={timezones}
                  disabled={saving}
                />
                <SettingSelect
                  label="Date Format"
                  value={settings.dateFormat}
                  onChange={(value) => handleSettingsChange("dateFormat", value)}
                  options={[
                    { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                    { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                    { value: "YYYY-MM-DD", label: "YYYY-MM-DD" }
                  ]}
                  disabled={saving}
                />
              </SettingSection>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <SettingSection title="Notification Preferences">
                <SettingToggle
                  label="Email Notifications"
                  description="Receive updates and reminders via email"
                  checked={settings.emailNotifications}
                  onChange={(checked) =>
                    handleSettingsChange("emailNotifications", checked)
                  }
                  disabled={saving}
                />
                <SettingToggle
                  label="Push Notifications"
                  description="Receive push notifications on your device"
                  checked={settings.pushNotifications}
                  onChange={(checked) =>
                    handleSettingsChange("pushNotifications", checked)
                  }
                  disabled={saving}
                />
              </SettingSection>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              <SettingSection title="Privacy Settings">
                <SettingSelect
                  label="Profile Visibility"
                  value={settings.profileVisibility}
                  onChange={(value) =>
                    handleSettingsChange("profileVisibility", value)
                  }
                  options={[
                    { value: "public", label: "Public" },
                    { value: "team", label: "Team Only" },
                    { value: "private", label: "Private" }
                  ]}
                  disabled={saving}
                />
              </SettingSection>

              <SettingSection title="Security">
                <button
  style={buttonStyle}
  onClick={() => setModal({
    title: "Change Password",
    message: "change-password-form" // Special identifier for our form
  })}
  disabled={saving}
>
  Change Password
</button>
                <button
  style={buttonStyle}
  onClick={() => setModal({
    title: twoFA.enabled ? "Disable Two-Factor Authentication" : "Enable Two-Factor Authentication",
    message: "2fa-setup"
  })}
  disabled={saving}
>
  {twoFA.enabled ? "✅ Two-Factor Authentication Enabled" : "Two-Factor Authentication"}
</button>
              </SettingSection>

              {/* Session Management Section */}
              <SettingSection title="Session Management">
                <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--input-bg)" }}>
                  <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Logout from all devices</div>
                  <div style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "1rem" }}>
                    This will log you out from all active sessions except this one.
                  </div>
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      marginBottom: 0
                    }}
                    onClick={() => setModal({
                      title: "Logout from all devices",
                      message: "Are you sure you want to logout from all other devices? You will need to login again on those devices.",
                      onConfirm: handleLogoutAllDevices,
                      onCancel: () => setModal(null)
                    })}
                    disabled={saving}
                  >
                    Logout from All Devices
                  </button>
                </div>
              </SettingSection>

              {/* Account Management Section */}
              <SettingSection title="Account Management">
                <div style={{ 
                  padding: "1rem", 
                  border: "1px solid #dc2626", 
                  borderRadius: "8px", 
                  background: "#fef2f2",
                  borderLeft: "4px solid #dc2626"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "0.5rem", color: "#dc2626" }}>
                    Delete Account
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#b91c1c", marginBottom: "1rem" }}>
                    This action cannot be undone. All your data will be permanently deleted.
                  </div>
                  <button
                    style={{
                      ...buttonStyle,
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      marginBottom: 0
                    }}
                    onClick={() => setModal({
                      title: "Delete Account",
                      message: "This will permanently delete your account and all associated data. This action cannot be undone. Are you sure?",
                      onConfirm: handleDeleteAccount,
                      onCancel: () => setModal(null),
                      destructive: true
                    })}
                    disabled={saving}
                  >
                    Delete My Account
                  </button>
                </div>
              </SettingSection>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Helper Components ---------------- */

function SettingSection({ title, children }) {
  return (
    <div>
      <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem", fontWeight: "600" }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {children}
      </div>
    </div>
  );
}

// UPDATE SettingToggle with disabled state
function SettingToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        background: "var(--input-bg)",
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>{label}</div>
        <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>{description}</div>
      </div>
      <label
        style={{
          position: "relative",
          display: "inline-block",
          width: "50px",
          height: "24px",
          opacity: disabled ? 0.6 : 1
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
          disabled={disabled}
        />
        <span
          style={{
            position: "absolute",
            cursor: "pointer",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: checked ? "var(--blue)" : "var(--border)",
            transition: "0.4s",
            borderRadius: "24px"
          }}
        >
          <span
            style={{
              position: "absolute",
              height: "16px",
              width: "16px",
              left: checked ? "26px" : "4px",
              bottom: "4px",
              backgroundColor: "white",
              transition: "0.4s",
              borderRadius: "50%"
            }}
          />
        </span>
      </label>
    </div>
  );
}

// UPDATE SettingSelect with disabled state
function SettingSelect({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "0.5rem",
          fontWeight: "600",
          color: "var(--text)"
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          background: "var(--input-bg)",
          color: "var(--text)",
          opacity: disabled ? 0.6 : 1,
          pointerEvents: disabled ? 'none' : 'auto'
        }}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ADD PasswordChangeForm Component
function PasswordChangeForm({ passwordChange, setPasswordChange, onClose, onConfirm, saving }) {
  const handleCurrentPasswordVerify = async () => {
    if (!passwordChange.currentPassword) return;
    
    setPasswordChange(prev => ({ ...prev, verifying: true, error: null }));
    
    // Simulate API verification - replace with actual API call
    setTimeout(() => {
      // Mock verification - in real app, call your API
      const isValid = passwordChange.currentPassword.length >= 6; // Simple mock
      
      setPasswordChange(prev => ({ 
        ...prev, 
        verifying: false, 
        verified: isValid,
        error: isValid ? null : "Current password is incorrect"
      }));
    }, 1500);
  };

  const canSubmit = passwordChange.verified && 
                   passwordChange.newPassword && 
                   passwordChange.newPassword === passwordChange.confirmPassword &&
                   passwordChange.newPassword.length >= 6;

  return (
    <div>
      <h3 style={{ margin: "0 0 1.5rem 0" }}>Change Password</h3>
      
      {/* Current Password */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
          Current Password
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="password"
            value={passwordChange.currentPassword}
            onChange={(e) => setPasswordChange(prev => ({ 
              ...prev, 
              currentPassword: e.target.value,
              verified: false // Reset verification when password changes
            }))}
            disabled={passwordChange.verifying || passwordChange.verified}
            style={{
              width: "100%",
              padding: "0.75rem 3rem 0.75rem 1rem",
              borderRadius: "6px",
              border: passwordChange.error ? "1px solid #dc2626" : "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text)",
              opacity: (passwordChange.verifying || passwordChange.verified) ? 0.7 : 1
            }}
            placeholder="Enter current password"
          />
          <div style={{
            position: "absolute",
            right: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center"
          }}>
            {passwordChange.verifying && (
              <div style={{
                width: "16px",
                height: "16px",
                border: "2px solid var(--border)",
                borderTop: "2px solid var(--blue)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }} />
            )}
            {passwordChange.verified && !passwordChange.verifying && (
              <CheckCircleIcon width={20} color="#22c55e" />
            )}
            {passwordChange.error && !passwordChange.verifying && (
              <ExclamationTriangleIcon width={20} color="#dc2626" />
            )}
            {!passwordChange.verifying && !passwordChange.verified && !passwordChange.error && (
              <button
                onClick={handleCurrentPasswordVerify}
                disabled={!passwordChange.currentPassword}
                style={{
                  background: "var(--blue)",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.75rem",
                  cursor: passwordChange.currentPassword ? "pointer" : "not-allowed",
                  opacity: passwordChange.currentPassword ? 1 : 0.5
                }}
              >
                Verify
              </button>
            )}
          </div>
        </div>
        {passwordChange.error && (
          <div style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {passwordChange.error}
          </div>
        )}
        <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
          <button
            onClick={() => alert("Forgot password flow would open here")}
            style={{
              background: "none",
              border: "none",
              color: "var(--blue)",
              fontSize: "0.875rem",
              cursor: "pointer",
              textDecoration: "underline"
            }}
          >
            Forgot password?
          </button>
        </div>
      </div>

      {/* New Password - Only show after verification */}
      {passwordChange.verified && (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
              New Password
            </label>
            <input
              type="password"
              value={passwordChange.newPassword}
              onChange={(e) => setPasswordChange(prev => ({ ...prev, newPassword: e.target.value }))}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text)"
              }}
              placeholder="Enter new password (min 6 characters)"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwordChange.confirmPassword}
              onChange={(e) => setPasswordChange(prev => ({ ...prev, confirmPassword: e.target.value }))}
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                borderRadius: "6px",
                border: passwordChange.newPassword !== passwordChange.confirmPassword ? "1px solid #dc2626" : "1px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text)"
              }}
              placeholder="Confirm new password"
            />
            {passwordChange.newPassword && passwordChange.confirmPassword && passwordChange.newPassword !== passwordChange.confirmPassword && (
              <div style={{ color: "#dc2626", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                Passwords do not match
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
        <button 
          onClick={onClose}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            cursor: "pointer",
            border: "1px solid var(--border)",
            background: "var(--card-bg)"
          }}
        >
          Cancel
        </button>
        <button 
          onClick={() => onConfirm(passwordChange)}
          disabled={!canSubmit || saving}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            cursor: canSubmit ? "pointer" : "not-allowed",
            background: canSubmit ? "var(--blue)" : "var(--border)",
            color: "white",
            border: "none",
            opacity: canSubmit ? 1 : 0.6
          }}
        >
          {saving ? "Changing..." : "Change Password"}
        </button>
      </div>
    </div>
  );
}

// ADD TwoFASetupForm Component
function TwoFASetupForm({ twoFA, setTwoFA, onClose, onSendOTP, onVerifyOTP, onDisable2FA, saving }) {
  // Check if 2FA is already enabled (from database)
  const isSetup = !twoFA.enabled && twoFA.step === "setup";
  const isVerify = !twoFA.enabled && twoFA.step === "verify";
  // If 2FA is enabled, show enabled state regardless of step value
  const isEnabled = twoFA.enabled && (twoFA.step === "enabled" || !twoFA.step);
  const isDisable = twoFA.enabled && twoFA.step === "disable";
  
  // If 2FA is enabled, always show enabled state
  const effectiveEnabled = twoFA.enabled;

  const handleAction = () => {
  if (isSetup) {
    onSendOTP(twoFA.email);
  } else if (isVerify) {
    onVerifyOTP(twoFA.email, twoFA.otp);
  } else if (isDisable) {
    onDisable2FA(twoFA.otp);
  }
};

  return (
    <div>
      <h3 style={{ margin: "0 0 1.5rem 0" }}>
        {isSetup && "Enable Two-Factor Authentication"}
        {isVerify && "Verify OTP"}
        {isEnabled && "Two-Factor Authentication Enabled"}
        {isDisable && "Disable Two-Factor Authentication"}
      </h3>

      {/* Setup Step - Enter Email */}
      {isSetup && (
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Email Address for 2FA
          </label>
          <input
            type="email"
            value={twoFA.email}
            onChange={(e) => setTwoFA(prev => ({ ...prev, email: e.target.value, error: null }))}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              border: twoFA.error ? "1px solid #dc2626" : "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text)"
            }}
            placeholder="Enter email to receive OTP"
          />
          <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            This can be different from your account email
          </div>
        </div>
      )}

      {/* Verify Step - Enter OTP */}
      {(isVerify || isDisable) && (
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Enter 6-digit OTP
          </label>
          <input
            type="text"
            maxLength="6"
            value={twoFA.otp}
            onChange={(e) => setTwoFA(prev => ({ 
              ...prev, 
              otp: e.target.value.replace(/\D/g, '').slice(0, 6),
              error: null 
            }))}
            style={{
              width: "100%",
              padding: "0.75rem 1rem",
              borderRadius: "6px",
              border: twoFA.error ? "1px solid #dc2626" : "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text)",
              textAlign: "center",
              fontSize: "1.25rem",
              letterSpacing: "0.5rem"
            }}
            placeholder="000000"
          />
          {isVerify && (
            <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              OTP sent to: {twoFA.email}
            </div>
          )}
          {isDisable && (
            <div style={{ fontSize: "0.875rem", color: "var(--muted)", marginTop: "0.5rem" }}>
              Enter the verification code sent to: {twoFA.email}
            </div>
          )}
        </div>
      )}

      {/* Enabled Step - Success Message */}
      {(isEnabled || effectiveEnabled) && (
        <div style={{ 
          padding: "1.5rem", 
          background: "#f0fdf4", 
          border: "1px solid #22c55e",
          borderRadius: "8px",
          textAlign: "center",
          marginBottom: "1.5rem"
        }}>
          <CheckCircleIcon width={48} color="#22c55e" style={{ marginBottom: "1rem" }} />
          <div style={{ fontWeight: "600", color: "#166534", marginBottom: "0.5rem" }}>
            Two-Factor Authentication Enabled
          </div>
          <div style={{ color: "#166534", fontSize: "0.875rem" }}>
            Your account is now protected with two-factor authentication.
            {twoFA.email && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
                Email: {twoFA.email}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disable Step - Warning Message */}
      {isDisable && (
        <div style={{ 
          padding: "1rem", 
          background: "#fef2f2", 
          border: "1px solid #dc2626",
          borderRadius: "8px",
          marginBottom: "1.5rem"
        }}>
          <div style={{ fontWeight: "600", color: "#dc2626", marginBottom: "0.5rem" }}>
            Are you sure?
          </div>
          <div style={{ color: "#b91c1c", fontSize: "0.875rem" }}>
            Disabling 2FA will make your account less secure.
          </div>
        </div>
      )}

      {/* Error Message */}
      {twoFA.error && (
        <div style={{ 
          color: "#dc2626", 
          fontSize: "0.875rem", 
          marginBottom: "1rem",
          padding: "0.75rem",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "6px"
        }}>
          {twoFA.error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
        {/* Cancel Button - Show in setup, verify, and disable steps */}
        {(isSetup || isVerify || isDisable) && (
          <button 
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              border: "1px solid var(--border)",
              background: "var(--card-bg)"
            }}
          >
            Cancel
          </button>
        )}

        {/* Action Buttons */}
        {isSetup && (
          <button 
            onClick={handleAction}
            disabled={!twoFA.email || twoFA.loading || saving}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: twoFA.email ? "pointer" : "not-allowed",
              background: twoFA.email ? "var(--blue)" : "var(--border)",
              color: "white",
              border: "none",
              opacity: twoFA.email ? 1 : 0.6
            }}
          >
            {twoFA.loading ? "Sending..." : "Send OTP"}
          </button>
        )}

        {(isVerify || isDisable) && (
          <button 
            onClick={handleAction}
            disabled={!twoFA.otp || twoFA.otp.length !== 6 || twoFA.loading || saving}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: (twoFA.otp && twoFA.otp.length === 6) ? "pointer" : "not-allowed",
              background: (twoFA.otp && twoFA.otp.length === 6) ? 
                         (isDisable ? "#dc2626" : "var(--blue)") : "var(--border)",
              color: "white",
              border: "none",
              opacity: (twoFA.otp && twoFA.otp.length === 6) ? 1 : 0.6
            }}
          >
            {twoFA.loading ? "Verifying..." : (isDisable ? "Disable 2FA" : "Verify OTP")}
          </button>
        )}

        {/* Close Button for Enabled State */}
        {(isEnabled || effectiveEnabled) && (
          <button 
            onClick={onClose}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
              background: "var(--blue)",
              color: "white",
              border: "none"
            }}
          >
            Close
          </button>
        )}
        
        {/* Show disable button if 2FA is enabled */}
        {(isEnabled || effectiveEnabled) && twoFA.step !== "disable" && (
          <button 
            onClick={async () => {
              // First send OTP for disabling
              setTwoFA(prev => ({ ...prev, loading: true, error: null }));
              try {
                const result = await apiFetch("/auth/2fa/send-disable-otp", {
                  method: "POST"
                });
                if (result && result.message) {
                  setTwoFA(prev => ({ 
                    ...prev, 
                    step: "disable", 
                    otp: "", 
                    error: null,
                    loading: false
                  }));
                  setToast({ 
                    message: `Verification code sent to ${result.email || twoFA.email}. Please check your email.`, 
                    timeout: 5000 
                  });
                } else {
                  throw new Error("Failed to send OTP");
                }
              } catch (error) {
                setTwoFA(prev => ({ 
                  ...prev, 
                  error: error.message || "Failed to send verification code",
                  loading: false
                }));
              }
            }}
            disabled={twoFA.loading}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: twoFA.loading ? "not-allowed" : "pointer",
              background: "#dc2626",
              color: "white",
              border: "none",
              marginLeft: "0.5rem",
              opacity: twoFA.loading ? 0.6 : 1
            }}
          >
            {twoFA.loading ? "Sending..." : "Disable 2FA"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Shared Styles ---------------- */

const buttonStyle = {
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "0.75rem 1.5rem",
  cursor: "pointer",
  fontWeight: "600",
  marginBottom: "1rem"
};

/* ---------------- Timezones ---------------- */

const timezones = [
  { value: "UTC-12", label: "UTC-12:00 — Baker Island" },
  { value: "UTC-11", label: "UTC-11:00 — American Samoa" },
  { value: "UTC-10", label: "UTC-10:00 — Hawaii" },
  { value: "UTC-9", label: "UTC-09:00 — Alaska" },
  { value: "UTC-8", label: "UTC-08:00 — Pacific Time (US & Canada)" },
  { value: "UTC-7", label: "UTC-07:00 — Mountain Time (US & Canada)" },
  { value: "UTC-6", label: "UTC-06:00 — Central Time (US & Canada)" },
  { value: "UTC-5", label: "UTC-05:00 — Eastern Time (US & Canada)" },
  { value: "UTC-4", label: "UTC-04:00 — Atlantic Time (Canada)" },
  { value: "UTC-3", label: "UTC-03:00 — Argentina, Brazil" },
  { value: "UTC-2", label: "UTC-02:00 — South Georgia" },
  { value: "UTC-1", label: "UTC-01:00 — Azores" },
  { value: "UTC+0", label: "UTC+00:00 — GMT, London" },
  { value: "UTC+1", label: "UTC+01:00 — Central Europe" },
  { value: "UTC+2", label: "UTC+02:00 — Eastern Europe, South Africa" },
  { value: "UTC+3", label: "UTC+03:00 — Moscow, Nairobi" },
  { value: "UTC+4", label: "UTC+04:00 — Dubai, Baku" },
  { value: "UTC+5", label: "UTC+05:00 — Pakistan, Uzbekistan" },
  { value: "UTC+5:30", label: "UTC+05:30 — India, Sri Lanka" },
  { value: "UTC+6", label: "UTC+06:00 — Bangladesh, Bhutan" },
  { value: "UTC+7", label: "UTC+07:00 — Thailand, Vietnam" },
  { value: "UTC+8", label: "UTC+08:00 — China, Singapore" },
  { value: "UTC+9", label: "UTC+09:00 — Japan, Korea" },
  { value: "UTC+10", label: "UTC+10:00 — Australia (Sydney)" },
  { value: "UTC+11", label: "UTC+11:00 — Solomon Islands" },
  { value: "UTC+12", label: "UTC+12:00 — Fiji, New Zealand" },
  { value: "UTC+13", label: "UTC+13:00 — Tonga" },
  { value: "UTC+14", label: "UTC+14:00 — Line Islands" }
];