import { useState, useEffect, useCallback } from "react";
import { 
  UserCircleIcon, 
  CameraIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
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
    joinDate: "",
    phone: "",
    bio: "",
    photo: null
  });

  const [recentLogins, setRecentLogins] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);

  // CROPPING STATES
  const [showCrop, setShowCrop] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch user data from backend
  useEffect(() => {
    fetchUserData();
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
  setUserData(prev => ({
    ...prev,
    username: data.user.username || "",
    name: data.user.name || "",
    email: data.user.email || "",
    position: data.user.position || "",
    department: data.user.department || "",
    joinDate: data.user.joinDate || data.user.joinedAt || data.user.createdAt || "",
    phone: data.user.phone || data.user.phoneNumber || "",
    bio: data.user.bio || data.user.about || "",
    photo: data.user.photo || data.user.avatar || null
  }));
}
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      // Fallback to localStorage if backend fails
      const saved = localStorage.getItem("jobtrackr_user");
      if (saved) {
        setUserData(JSON.parse(saved));
      }
    }

    // Load recent logins from localStorage
    const savedLogins = localStorage.getItem("jobtrackr_recentLogins");
    if (savedLogins) {
      setRecentLogins(JSON.parse(savedLogins));
    }
  };

  const handleUserDataChange = (field, value) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };const uploadPhoto = async (photoDataUrl) => {
  try {
    const token = localStorage.getItem("token");
    
    // Convert data URL to blob
    const response = await fetch(photoDataUrl);
    const blob = await response.blob();
    
    const formData = new FormData();
    formData.append('photo', blob, 'profile.jpg');
    
    const uploadResponse = await fetch(`${API_BASE}/users/upload-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (uploadResponse.ok) {
      const result = await uploadResponse.json();
      return result.photoUrl; // URL from backend
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
        canvas.toBlob((blob) => {
          if (!blob) reject(new Error("Canvas is empty"));
          else resolve(URL.createObjectURL(blob));
        }, "image/jpeg");
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
    
    setUserData(prev => ({ 
      ...prev, 
      photo: uploadedPhotoUrl || croppedImageUrl // Use backend URL or fallback to local
    }));
    setShowCrop(false);
    setSelectedFile(null);
  }
};
  const handlePhotoRemove = () => {
    setUserData(prev => ({ ...prev, photo: null }));
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
      bio: userData.bio
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
        setUserData(prev => ({ ...prev, ...data.user }));
        localStorage.setItem("jobtrackr_user", JSON.stringify(userData));
        setIsEditing(false);
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
  {userData.joinDate ? `Member since ${new Date(userData.joinDate).toLocaleDateString()}` : "Member since unknown"}
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
        <FormField label="Join Date" type="date" value={userData.joinDate} disabled={true} />
      </div>

      {/* ABOUT ME */}
      <div style={{ marginTop: "2rem" }}>
        <FormField label="About Me" type="textarea" value={userData.bio} onChange={(v) => handleUserDataChange("bio", v)} disabled={!isEditing} />
      </div>

      {/* RECENT LOGIN ACTIVITY */}
      <div style={{
        marginTop: "2rem",
        background: "var(--card-bg)",
        padding: "1.5rem",
        borderRadius: "12px",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)"
      }}>
        <h3 style={{ marginBottom: "1rem" }}>Recent Login Activity</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {recentLogins.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No recent logins available.</p>
          )}
          {recentLogins.map((login, index) => (
            <div key={index} style={{
              padding: "0.75rem",
              background: "var(--input-bg)",
              borderRadius: "8px",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              {login.isSuspicious ? (
                <ExclamationCircleIcon style={{ width: "16px", height: "16px", color: "#f59e0b" }} />
              ) : (
                <CheckCircleIcon style={{ width: "16px", height: "16px", color: "#10b981" }} />
              )}
              {login.date} — {login.device} — {login.location}
            </div>
          ))}
        </div>
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