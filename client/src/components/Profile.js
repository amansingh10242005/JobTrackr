import { useState, useEffect, useCallback } from "react";
import { 
  UserCircleIcon, 
  CameraIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import Cropper from "react-easy-crop";

const API_BASE = (() => {
  const base = (process.env.NEXT_PUBLIC_API_BASE || "https://jobtrackr-4e48.onrender.com/api").replace(/\/+$/, "");
  return base.endsWith("/api") ? base : `${base}/api`;
})();

const styles = {
  btn: { 
    padding: "0.5rem 1rem", 
    borderRadius: "6px", 
    cursor: "pointer", 
    fontSize: "0.9rem", 
    border: "1px solid var(--border)" 
  },
  btnPrimary: { 
    background: "var(--blue)", 
    color: "#fff", 
    border: "none" 
  },
  btnDanger: { 
    background: "#ef4444", 
    color: "#fff", 
    border: "none" 
  }
};

export default function Profile() {
  const [userData, setUserData] = useState({
    username: "",
    name: "",
    email: "",
    position: "",
    department: "",
    phone: "",
    bio: "",
    photo: null,
    createdAt: null
  });

  const [isEditing, setIsEditing] = useState(false);
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // CROPPING STATES
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch user data from backend
  useEffect(() => {
    fetchUserData();
    fetchActivityLog();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/users/me`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
  console.error('Failed to fetch user data:', response.status, response.statusText);
  // Fallback to localStorage if backend fails
  const saved = localStorage.getItem("jobtrackr_user");
  if (saved) {
    setUserData(JSON.parse(saved));
  }
  return;
}

// If we get here, response is OK, so process the data
const data = await response.json();
if (data.user) {
  // Handle nested profile object if it exists
  const profile = data.user.profile || {};
  const photo = data.user.photo || data.user.avatar || profile.photo || null;
  setUserData(prev => ({
    ...prev,
    username: data.user.username || "",
    name: data.user.name || "",
    email: data.user.email || "",
    position: data.user.position || profile.position || "",
    department: data.user.department || profile.department || "",
    phone: data.user.phone || data.user.phoneNumber || profile.phone || "",
    bio: data.user.bio || data.user.about || profile.bio || "",
    photo: photo, // Ensure photo is properly set
    createdAt: data.user.createdAt || null
  }));
  
  // Also update localStorage to persist photo
  if (photo) {
    const saved = localStorage.getItem("jobtrackr_user");
    const savedData = saved ? JSON.parse(saved) : {};
    localStorage.setItem("jobtrackr_user", JSON.stringify({
      ...savedData,
      photo: photo
    }));
  }
}
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      // Fallback to localStorage if backend fails
      const saved = localStorage.getItem("jobtrackr_user");
      if (saved) {
        setUserData(JSON.parse(saved));
      }
    }

  };

  const fetchActivityLog = async () => {
    try {
      setLoadingActivities(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/users/activity-log`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleUserDataChange = (field, value) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };const uploadPhoto = async (photoDataUrl) => {
  try {
    const token = localStorage.getItem("token");
    
    // Save photo directly via profile update endpoint
    const response = await fetch(`${API_BASE}/users/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ photo: photoDataUrl })
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.user?.photo || photoDataUrl; // Return saved photo URL
    }
  } catch (error) {
    console.error('Photo upload failed:', error);
  }
  return null;
};

  // ----- CROPPING FUNCTIONS -----
  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const getCroppedImg = (imageSrc, croppedAreaPixels) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );
        // Convert to data URL so it persists after reload
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        resolve(dataUrl);
      };
      image.onerror = (err) => reject(err);
    });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFile(reader.result);
        setShowCrop(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
  if (selectedFile && croppedAreaPixels) {
    const croppedImageUrl = await getCroppedImg(selectedFile, croppedAreaPixels);
    
    // Upload to backend and get the URL
    const uploadedPhotoUrl = await uploadPhoto(croppedImageUrl);
    
    // Update local state with the saved photo URL
    const finalPhotoUrl = uploadedPhotoUrl || croppedImageUrl;
    setUserData(prev => ({ 
      ...prev, 
      photo: finalPhotoUrl
    }));
    
    // Also update localStorage to persist immediately
    const saved = localStorage.getItem("jobtrackr_user");
    const savedData = saved ? JSON.parse(saved) : {};
    localStorage.setItem("jobtrackr_user", JSON.stringify({
      ...savedData,
      ...userData,
      photo: finalPhotoUrl
    }));
    
    setShowCrop(false);
    setSelectedFile(null);
  }
};
  const handlePhotoRemove = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // Remove photo from backend
      await fetch(`${API_BASE}/users/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ photo: null })
      });
      
      // Update local state
      setUserData(prev => ({ ...prev, photo: null }));
      
      // Update localStorage
      const updatedUserData = { ...userData, photo: null };
      localStorage.setItem("jobtrackr_user", JSON.stringify(updatedUserData));
    } catch (error) {
      console.error('Failed to remove photo:', error);
      // Still update local state even if backend fails
      setUserData(prev => ({ ...prev, photo: null }));
    }
  };

  // ----- SAVE FUNCTION WITH BACKEND INTEGRATION -----
  const handleSave = async () => {
  const requiredFields = ["name", "position", "department", "phone", "bio"];
  for (let field of requiredFields) {
    if (!userData[field] || userData[field].trim() === "") {
      setWarning("Please fill in all fields before saving.");
      return;
    }
  }

  setLoading(true);
  setWarning("");

  try {
    const token = localStorage.getItem("token");
    
    // Create a clean payload with only the fields your backend expects
    const profileData = {
      name: userData.name,
      position: userData.position,
      department: userData.department,
      phone: userData.phone,
      bio: userData.bio,
      photo: userData.photo || null // Include photo in the save
    };

    const response = await fetch(`${API_BASE}/users/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(profileData) // ← FIXED: Sending only necessary data
    });

      if (response.ok) {
        const data = await response.json();
        const updatedData = {
          ...userData,
          ...data.user,
          photo: data.user?.photo || userData.photo // Preserve photo
        };
        setUserData(prev => ({ ...prev, ...updatedData }));
        localStorage.setItem("jobtrackr_user", JSON.stringify(updatedData));
        setIsEditing(false);
        // Refresh activity log after profile update
        fetchActivityLog();
      } else {
        const errorData = await response.json();
        setWarning(errorData.error || "Failed to save profile");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
      setWarning("Failed to save profile. Please try again.");
      // Fallback to localStorage
      localStorage.setItem("jobtrackr_user", JSON.stringify(userData));
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      background: "var(--card-bg)", 
      padding: "2rem", 
      borderRadius: "14px",
      boxShadow: "var(--shadow)",
      border: "1px solid var(--border)",
      minHeight: "600px"
    }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>Profile</h2>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={loading}
          style={{
            background: isEditing ? "#10b981" : "var(--blue)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.2rem",
            fontSize: "0.9rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "600",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? "Saving..." : isEditing ? "Save Changes" : "Edit Profile"}
        </button>
      </div>

      {/* WARNING */}
      {warning && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
          fontWeight: "600"
        }}>
          ⚠️ {warning}
        </div>
      )}

      {/* PROFILE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "2rem", marginBottom: "2rem" }}>
        <div style={{ position: "relative" }}>
          {userData.photo ? (
            <img
              src={userData.photo}
              alt="Profile"
              style={{ width: "100px", height: "100px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <UserCircleIcon style={{ width: "100px", height: "100px", color: "var(--blue)" }} />
          )}

          {isEditing && (
            <div style={{ display: "flex", gap: "0.5rem", position: "absolute", bottom: "-10px", right: "-10px" }}>
              <label
                style={{
                  background: "var(--blue)",
                  color: "white",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <CameraIcon style={{ width: "16px", height: "16px" }} />
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
              </label>
              {userData.photo && (
                <button
  onClick={handlePhotoRemove}
  style={{
    background: "#ef4444",
    color: "white",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    border: "none"
  }}
>
  <XMarkIcon style={{ width: "16px", height: "16px" }} />
</button>
              )}
            </div>
          )}
        </div>
        <div>
          <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem" }}>{userData.name || "Your Name"}</h3>
          <p style={{ color: "var(--muted)", margin: "0 0 0.5rem 0" }}>{userData.position || "Your Position"}</p>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.9rem" }}>
            Member since {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "recently"}
          </p>
        </div>
      </div>

      {/* PROFILE FIELDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <FormField label="Username" value={userData.username} onChange={(v) => handleUserDataChange("username", v)} disabled={true} />
        <FormField label="Full Name" value={userData.name} onChange={(v) => handleUserDataChange("name", v)} disabled={!isEditing} />
        <FormField label="Email" value={userData.email} disabled={true} />
        <FormField label="Position" value={userData.position} onChange={(v) => handleUserDataChange("position", v)} disabled={!isEditing} />
        <FormField label="Department" value={userData.department} onChange={(v) => handleUserDataChange("department", v)} disabled={!isEditing} />
        <FormField label="Phone" value={userData.phone} onChange={(v) => handleUserDataChange("phone", v)} disabled={!isEditing} />
      </div>

      {/* ABOUT ME */}
      <div style={{ marginTop: "2rem" }}>
        <FormField label="About Me" type="textarea" value={userData.bio} onChange={(v) => handleUserDataChange("bio", v)} disabled={!isEditing} />
      </div>

      {/* ACTIVITY LOG */}
      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", fontWeight: "600" }}>Activity Log</h3>
        {loadingActivities ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
            Loading activities...
          </div>
        ) : activities.length === 0 ? (
          <div style={{ 
            padding: "2rem", 
            textAlign: "center", 
            color: "var(--muted)",
            background: "var(--input-bg)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}>
            No activities yet. Your recent actions will appear here.
          </div>
        ) : (
          <div style={{
            background: "var(--input-bg)",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            maxHeight: "400px",
            overflowY: "auto"
          }}>
            {activities.map((activity) => (
              <div
                key={activity.id}
                style={{
                  padding: "1rem",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "1rem"
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 0.25rem 0", fontWeight: "500" }}>
                    {activity.description}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                    {activity.timestamp 
                      ? new Date(activity.timestamp).toLocaleString()
                      : "Recently"}
                  </p>
                </div>
                <div style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  background: "var(--blue)",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase"
                }}>
                  {activity.type?.replace("_", " ") || "Activity"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CROP MODAL */}
      {showCrop && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 999
        }}>
          <div style={{ background: "#fff", padding: "1rem", borderRadius: "12px", width: "400px", height: "400px", position: "relative" }}>
            <Cropper
              image={selectedFile}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <div style={{ position: "absolute", bottom: "10px", width: "calc(100% - 2rem)", display: "flex", justifyContent: "space-between", gap: "0.5rem", left: "1rem", right: "1rem" }}>
  <button 
    onClick={() => setShowCrop(false)}
    style={styles.btn}
  >
    Cancel
  </button>
  <button 
    onClick={handleCropSave}
    style={{ ...styles.btn, ...styles.btnPrimary }}
  >
    Crop & Save
  </button>
</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable FormField Component (keep this the same)
function FormField({ label, type = "text", value, onChange, disabled = false }) {
  if (type === "textarea") {
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>{label}</label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: `1px solid ${disabled ? "var(--border)" : "var(--blue)"}`,
            background: disabled ? "var(--input-bg)" : "var(--card-bg)",
            color: "var(--text)",
            opacity: disabled ? 0.7 : 1,
            cursor: disabled ? "not-allowed" : "text",
            resize: "none"
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: `1px solid ${disabled ? "var(--border)" : "var(--blue)"}`,
          background: disabled ? "var(--input-bg)" : "var(--card-bg)",
          color: "var(--text)",
          opacity: disabled ? 0.7 : 1,
          cursor: disabled ? "not-allowed" : "text"
        }}
      />
    </div>
  );
}