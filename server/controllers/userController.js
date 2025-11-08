import { db } from "../config/firebase.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

// ===========================
// Environment Variables Validation
// ===========================
const validateEnvVars = () => {
  const required = ['JWT_SECRET', 'VERIFY_EMAIL_SECRET', 'RESET_TOKEN_SECRET', 'EMAIL_USER', 'EMAIL_PASS'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

// ===========================
// Helper: Verify JWT Token
// ===========================
const verifyToken = async (req) => {
  validateEnvVars();
  
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new Error("Missing authorization header");

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid authorization format");
  }

  const token = parts[1];
  
const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
// Check token version
const userDoc = await db.collection("users").doc(decoded.username).get();
if (!userDoc.exists) {
  throw new Error("User not found");
}

const user = userDoc.data();
const currentTokenVersion = user.tokenVersion || 0;

if (decoded.tokenVersion !== currentTokenVersion) {
  throw new Error("Token invalidated - please login again");
}
  return decoded;
};

// ===========================
// Helper: Sanitize User Data
// ===========================
const sanitizeUser = (user) => {
  if (!user) return null;
  
  const sanitized = { ...user };
  
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
    }
  });

  return sanitized;
};

// ===========================
// GET CURRENT USER
// ===========================
export const getCurrentUser = async (req) => {
  try {
    validateEnvVars();
    const decoded = await verifyToken(req);
    const username = decoded.username;
    
    const doc = await db.collection("users").doc(username).get();
    if (!doc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = sanitizeUser(doc.data());
    // Remove sensitive data
    delete user.password;
    delete user.google;

    return { 
      status: 200, 
      body: { 
        user: {
          ...user,
          id: doc.id
        }
      } 
    };
  } catch (err) {
    console.error("Get current user error:", err);
    if (err.message.includes("Missing required environment variables")) {
      return { status: 500, body: { error: "Server configuration error" } };
    }
    return { status: 401, body: { error: "Unauthorized" } };
  }
};

// ===========================
// REGISTER (with Email Verification)
// ===========================
export const registerUser = async (data) => {
  try {
    validateEnvVars();
    
    const { username, email, password, confirmPassword, name } = data;

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      return { status: 400, body: { error: "All fields are required" } };
    }

    if (password !== confirmPassword) {
      return { status: 400, body: { error: "Passwords do not match" } };
    }

    if (password.length < 6) {
      return { status: 400, body: { error: "Password must be at least 6 characters" } };
    }

    if (username.length < 3) {
      return { status: 400, body: { error: "Username must be at least 3 characters" } };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { status: 400, body: { error: "Invalid email format" } };
    }

    // Check username availability
    const userDoc = await db.collection("users").doc(username.toLowerCase()).get();
    if (userDoc.exists) {
      return { status: 400, body: { error: "Username already taken" } };
    }

    // Check email availability
    const emailQuery = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    if (!emailQuery.empty) {
      return { status: 400, body: { error: "Email already registered" } };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user document
    const userData = {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      name: name || username,
      password: hashedPassword,
      verified: false,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferences: {
        emailNotifications: true,
        theme: "light",
        language: "en"
      },
      profile: {
        position: "",
        department: "",
        phone: "",
        bio: "",
        photo: ""
      }
    };

    await db.collection("users").doc(username.toLowerCase()).set(userData);

    // Generate verification token
    const token = jwt.sign(
      { username: username.toLowerCase() }, 
      process.env.VERIFY_EMAIL_SECRET, 
      { expiresIn: "24h" }
    );

    const verifyLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email/${token}`;

    // Send verification email
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify your JobTrackr account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to JobTrackr! 🎉</h2>
            <p>Hello ${name || username},</p>
            <p>Thank you for registering with JobTrackr. Please verify your email address to get started:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyLink}" 
                style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 14px;">
              If the button doesn't work, copy and paste this link in your browser:<br>
              ${verifyLink}
            </p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Verification email sent to ${email}`);

      return {
        status: 201,
        body: { 
          message: "Registration successful. Please check your email for verification instructions.",
          user: {
            username: userData.username,
            email: userData.email,
            name: userData.name
          }
        },
      };
    } catch (err) {
      console.error("❌ Email send error:", err);
      
      // Delete user if email fails
      await db.collection("users").doc(username.toLowerCase()).delete();
      
      return { 
        status: 500, 
        body: { 
          error: "Failed to send verification email. Please try again." 
        } 
      };
    }
  } catch (error) {
    console.error("Register error:", error);
    return { status: 500, body: { error: "Registration failed" } };
  }
};

// ===========================
// VERIFY EMAIL
// ===========================
export const verifyEmail = async (data) => {
  try {
    validateEnvVars();
    
    const { token } = data;
    if (!token) {
      return { status: 400, body: { error: "Verification token is required" } };
    }

    const decoded = jwt.verify(token, process.env.VERIFY_EMAIL_SECRET);
    const { username } = decoded;

    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = userDoc.data();

    if (user.verified) {
      return {
        status: 400,
        body: { error: "Email already verified" },
      };
    }

    await userRef.update({ 
      verified: true,
      updatedAt: new Date().toISOString()
    });

    return { 
      status: 200, 
      body: { 
        message: "Email verified successfully! You can now log in." 
      } 
    };
  } catch (err) {
    console.error("Verification error:", err);
    if (err.name === 'JsonWebTokenError') {
      return { status: 400, body: { error: "Invalid verification token" } };
    }
    if (err.name === 'TokenExpiredError') {
      return { status: 400, body: { error: "Verification token expired" } };
    }
    return { status: 500, body: { error: "Verification failed" } };
  }
};

// ===========================
// LOGIN (Username or Email)
// ===========================
export const loginUser = async (data) => {
  try {
    // Validate environment variables first
    try {
      validateEnvVars();
    } catch (envError) {
      console.error("Environment variables validation failed:", envError.message);
      return {
        status: 500,
        body: { error: "Server configuration error. Please contact support." },
      };
    }
    
    const { username, password } = data;

    if (!username || !password) {
      return {
        status: 400,
        body: { error: "Username/Email and password are required" },
      };
    }

    let userDoc;

    // Try username first
    const usernameDoc = await db.collection("users").doc(username.toLowerCase()).get();
    if (usernameDoc.exists) {
      userDoc = usernameDoc;
    } else {
      // Try email
      const emailQuery = await db
        .collection("users")
        .where("email", "==", username.toLowerCase())
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        userDoc = emailQuery.docs[0];
      }
    }

    if (!userDoc) {
      return { status: 401, body: { error: "Invalid credentials" } };
    }

    const user = sanitizeUser(userDoc.data());

    // Check if email is verified
    if (!user.verified) {
      return { 
        status: 403, 
        body: { 
          error: "Please verify your email before logging in" 
        } 
      };
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return { status: 401, body: { error: "Invalid credentials" } };
    }

    // Check if 2FA is enabled
    const twoFA = user.twoFA || {};
    if (twoFA.enabled && twoFA.email) {
      // Generate 6-digit OTP for login
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP with expiration (10 minutes) - use username as key for login 2FA
      await db.collection("login2FACodes").doc(user.username).set({
        otp,
        email: twoFA.email,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        createdAt: new Date().toISOString()
      });

      // Send OTP via email
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
          to: twoFA.email,
          subject: "Your Login Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Login Verification</h2>
              <p>Hello ${user.name || user.username},</p>
              <p>Someone is trying to log into your JobTrackr account. Please use the verification code below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">
                  ${otp}
                </div>
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't attempt to log in, please ignore this email or secure your account.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 14px;">
                This is an automated message from JobTrackr.
              </p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Login OTP sent to ${twoFA.email}`);

        return {
          status: 200,
          body: {
            message: "Two-factor authentication required",
            requires2FA: true,
            email: twoFA.email, // Send email so client can show which email received OTP
            username: user.username // Send username for the verification step
          },
        };
      } catch (emailError) {
        console.error("❌ Failed to send login OTP:", emailError);
        return { 
          status: 500, 
          body: { error: "Failed to send verification code. Please try again." } 
        };
      }
    }

// Get current token version
const userRef = db.collection("users").doc(user.username);
const currentUserDoc = await userRef.get();
const currentTokenVersion = currentUserDoc.data().tokenVersion || 0;

// Generate JWT token with version
const token = jwt.sign(
  { 
    username: user.username,
    tokenVersion: currentTokenVersion
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

    // Remove sensitive data
    const userResponse = { ...user };
    delete userResponse.password;
    delete userResponse.google;

    return {
      status: 200,
      body: {
        message: "Login successful",
        token,
        user: userResponse
      },
    };
  } catch (error) {
    console.error("Login error:", error);
    // Provide more detailed error message in development
    const errorMessage = process.env.NODE_ENV === "production" 
      ? "Login failed. Please try again." 
      : error.message || "Login failed";
    return { status: 500, body: { error: errorMessage } };
  }
};

// ===========================
// FORGOT PASSWORD
// ===========================
export const forgotPassword = async (data) => {
  try {
    // Validate environment variables first
    try {
      validateEnvVars();
    } catch (envError) {
      console.error("Environment variables validation failed:", envError.message);
      return {
        status: 500,
        body: { error: "Server configuration error. Please contact support." },
      };
    }
    
    const { username } = data;
    if (!username) {
      return { status: 400, body: { error: "Username or email is required" } };
    }

    let userDoc;

    // Try username first
    const usernameDoc = await db.collection("users").doc(username.toLowerCase()).get();
    if (usernameDoc.exists) {
      userDoc = usernameDoc;
    } else {
      // Try email
      const emailQuery = await db
        .collection("users")
        .where("email", "==", username.toLowerCase())
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        userDoc = emailQuery.docs[0];
      }
    }

    if (!userDoc) {
      // Don't reveal if user exists or not
      return { 
        status: 200, 
        body: { 
          message: "If an account exists with this username/email, a reset link has been sent." 
        } 
      };
    }

    const user = sanitizeUser(userDoc.data());

    // Generate reset token
    const token = jwt.sign(
      { username: user.username },
      process.env.RESET_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    // Store reset token
    await db.collection("passwordResetTokens").doc(user.username).set({
      token,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${token}`;

    // Send reset email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Reset Your JobTrackr Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello ${user.name || user.username},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
              style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>This link will expire in 15 minutes for security reasons.</p>
          <p>If you didn't request this reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            If the button doesn't work, copy and paste this link in your browser:<br>
            ${resetLink}
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return { 
      status: 200, 
      body: { 
        message: "If an account exists with this username/email, a reset link has been sent." 
      } 
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    // Provide more detailed error message in development
    const errorMessage = process.env.NODE_ENV === "production" 
      ? "Failed to process reset request. Please try again." 
      : error.message || "Failed to process reset request";
    return { status: 500, body: { error: errorMessage } };
  }
};

// ===========================
// RESET PASSWORD
// ===========================
export const resetPassword = async (data) => {
  try {
    validateEnvVars();
    
    const { token, password } = data;
    if (!token || !password) {
      return { status: 400, body: { error: "Token and password are required" } };
    }

    if (password.length < 6) {
      return { status: 400, body: { error: "Password must be at least 6 characters" } };
    }

    const decoded = jwt.verify(token, process.env.RESET_TOKEN_SECRET);
    const { username } = decoded;

    // Check if token exists and is valid
    const tokenDoc = await db.collection("passwordResetTokens").doc(username).get();
    if (!tokenDoc.exists) {
      return { status: 400, body: { error: "Invalid or expired reset link" } };
    }

    const tokenData = tokenDoc.data();
    
    if (tokenData.used || tokenData.token !== token) {
      return { status: 400, body: { error: "Reset link already used or invalid" } };
    }

    if (tokenData.expiresAt < Date.now()) {
      return { status: 400, body: { error: "Reset link expired" } };
    }

    // Check if user exists
    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await db.collection("users").doc(username).update({
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    // Mark token as used
    await db.collection("passwordResetTokens").doc(username).update({ used: true });

    return { 
      status: 200, 
      body: { 
        message: "Password reset successfully. You can now log in with your new password." 
      } 
    };
  } catch (error) {
    console.error("Reset password error:", error);
    if (error.name === 'JsonWebTokenError') {
      return { status: 400, body: { error: "Invalid reset token" } };
    }
    if (error.name === 'TokenExpiredError') {
      return { status: 400, body: { error: "Reset token expired" } };
    }
    return { status: 500, body: { error: "Password reset failed" } };
  }
};

// ===========================
// CHANGE PASSWORD
// ===========================
export const changePassword = async (req, data) => {
  try {
    validateEnvVars();
    
    const { currentPassword, newPassword } = data;
    
    if (!currentPassword || !newPassword) {
      return { status: 400, body: { error: "Current and new password are required" } };
    }

    if (newPassword.length < 6) {
      return { status: 400, body: { error: "New password must be at least 6 characters" } };
    }

    const decoded = await verifyToken(req);
    const username = decoded.username;

    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = userDoc.data();

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return { status: 400, body: { error: "Current password is incorrect" } };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password in Firestore
    await userRef.update({
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    return { 
      status: 200, 
      body: { 
        message: "Password changed successfully" 
      } 
    };
  } catch (error) {
    console.error("Change password error:", error);
    if (error.message.includes("Unauthorized")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to change password" } };
  }
};

// ===========================
// 2FA - SEND OTP
// ===========================
export const send2FAOTP = async (req, data) => {
  try {
    validateEnvVars();
    
    const { email } = data;
    const decoded = await verifyToken(req);
    const username = decoded.username;

    if (!email) {
      return { status: 400, body: { error: "Email is required" } };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (10 minutes)
    await db.collection("twoFACodes").doc(username).set({
      otp,
      email,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      createdAt: new Date().toISOString()
    });

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Two-Factor Authentication Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Two-Factor Authentication</h2>
          <p>Hello,</p>
          <p>Your verification code for Two-Factor Authentication is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">
              ${otp}
            </div>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from JobTrackr.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return { 
      status: 200, 
      body: { 
        message: "OTP sent successfully" 
      } 
    };
  } catch (error) {
    console.error("Send 2FA OTP error:", error);
    return { status: 500, body: { error: "Failed to send OTP" } };
  }
};

// ===========================
// 2FA - VERIFY & ENABLE
// ===========================
export const verify2FA = async (req, data) => {
  try {
    const { email, otp } = data;
    const decoded = await verifyToken(req);
    const username = decoded.username;

    if (!otp || !email) {
      return { status: 400, body: { error: "OTP and email are required" } };
    }

    // Get stored OTP
    const otpDoc = await db.collection("twoFACodes").doc(username).get();
    if (!otpDoc.exists) {
      return { status: 400, body: { error: "OTP not found or expired" } };
    }

    const otpData = otpDoc.data();

    if (otpData.expiresAt < Date.now()) {
      await db.collection("twoFACodes").doc(username).delete();
      return { status: 400, body: { error: "OTP expired" } };
    }

    if (otpData.otp !== otp || otpData.email !== email) {
      return { status: 400, body: { error: "Invalid OTP" } };
    }

    // Enable 2FA for user
    const twoFAData = {
      enabled: true,
      email: email,
      enabledAt: new Date().toISOString()
    };
    
    await db.collection("users").doc(username).update({
      twoFA: twoFAData,
      updatedAt: new Date().toISOString()
    });

    // Clean up OTP
    await db.collection("twoFACodes").doc(username).delete();

    return { 
      status: 200, 
      body: { 
        message: "Two-Factor Authentication enabled successfully",
        twoFA: twoFAData
      } 
    };
  } catch (error) {
    console.error("Verify 2FA error:", error);
    return { status: 500, body: { error: "Failed to enable 2FA" } };
  }
};

// ===========================
// 2FA - VERIFY LOGIN OTP
// ===========================
export const verifyLogin2FA = async (data) => {
  try {
    const { username, otp } = data;
    
    if (!username || !otp) {
      return { status: 400, body: { error: "Username and OTP are required" } };
    }

    // Get stored login OTP
    const otpDoc = await db.collection("login2FACodes").doc(username.toLowerCase()).get();
    if (!otpDoc.exists) {
      return { status: 400, body: { error: "OTP not found or expired" } };
    }

    const otpData = otpDoc.data();

    if (otpData.expiresAt < Date.now()) {
      await db.collection("login2FACodes").doc(username.toLowerCase()).delete();
      return { status: 400, body: { error: "OTP expired. Please try logging in again." } };
    }

    if (otpData.otp !== otp) {
      return { status: 400, body: { error: "Invalid OTP" } };
    }

    // Get user
    const userDoc = await db.collection("users").doc(username.toLowerCase()).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = sanitizeUser(userDoc.data());

    // Get current token version
    const userRef = db.collection("users").doc(username.toLowerCase());
    const currentUserDoc = await userRef.get();
    const currentTokenVersion = currentUserDoc.data().tokenVersion || 0;

    // Generate JWT token with version
    const token = jwt.sign(
      { 
        username: user.username,
        tokenVersion: currentTokenVersion
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Clean up OTP
    await db.collection("login2FACodes").doc(username.toLowerCase()).delete();

    // Remove sensitive data
    const userResponse = { ...user };
    delete userResponse.password;
    delete userResponse.google;

    return { 
      status: 200, 
      body: { 
        message: "Login successful",
        token,
        user: userResponse
      } 
    };
  } catch (error) {
    console.error("Verify login 2FA error:", error);
    return { status: 500, body: { error: "Failed to verify OTP" } };
  }
};

// ===========================
// 2FA - SEND DISABLE OTP
// ===========================
export const sendDisable2FAOTP = async (req) => {
  try {
    validateEnvVars();
    const decoded = await verifyToken(req);
    const username = decoded.username;

    // Get user to check 2FA status and email
    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = userDoc.data();
    const twoFA = user.twoFA || {};

    if (!twoFA.enabled) {
      return { status: 400, body: { error: "Two-factor authentication is not enabled" } };
    }

    if (!twoFA.email) {
      return { status: 400, body: { error: "2FA email not found" } };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP with expiration (10 minutes)
    await db.collection("twoFACodes").doc(username).set({
      otp,
      email: twoFA.email,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      createdAt: new Date().toISOString(),
      purpose: "disable" // Mark this OTP as for disabling 2FA
    });

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
      to: twoFA.email,
      subject: "Disable Two-Factor Authentication - Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Disable Two-Factor Authentication</h2>
          <p>Hello ${user.name || user.username},</p>
          <p>You requested to disable two-factor authentication for your account. Please use the verification code below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #2563eb;">
              ${otp}
            </div>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #dc2626; font-weight: 600;">If you didn't request to disable 2FA, please ignore this email and secure your account.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from JobTrackr.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Disable 2FA OTP sent to ${twoFA.email}`);

    return { 
      status: 200, 
      body: { 
        message: "OTP sent successfully",
        email: twoFA.email
      } 
    };
  } catch (error) {
    console.error("Send disable 2FA OTP error:", error);
    return { status: 500, body: { error: "Failed to send OTP" } };
  }
};

// ===========================
// 2FA - DISABLE
// ===========================
export const disable2FA = async (req, data) => {
  try {
    const { otp } = data;
    const decoded = await verifyToken(req);
    const username = decoded.username;

    if (!otp) {
      return { status: 400, body: { error: "OTP is required" } };
    }

    // Get stored OTP (for disable verification)
    const otpDoc = await db.collection("twoFACodes").doc(username).get();
    if (!otpDoc.exists) {
      return { status: 400, body: { error: "OTP not found or expired. Please request a new OTP." } };
    }

    const otpData = otpDoc.data();

    if (otpData.expiresAt < Date.now()) {
      await db.collection("twoFACodes").doc(username).delete();
      return { status: 400, body: { error: "OTP expired. Please request a new OTP." } };
    }

    if (otpData.otp !== otp) {
      return { status: 400, body: { error: "Invalid OTP" } };
    }

    // Verify this OTP is for disabling (optional check)
    if (otpData.purpose && otpData.purpose !== "disable") {
      return { status: 400, body: { error: "This OTP is not valid for disabling 2FA" } };
    }

    // Disable 2FA for user
    const twoFAData = {
      enabled: false,
      disabledAt: new Date().toISOString()
    };
    
    await db.collection("users").doc(username).update({
      twoFA: twoFAData,
      updatedAt: new Date().toISOString()
    });

    // Clean up OTP
    await db.collection("twoFACodes").doc(username).delete();

    return { 
      status: 200, 
      body: { 
        message: "Two-Factor Authentication disabled successfully",
        twoFA: twoFAData
      } 
    };
  } catch (error) {
    console.error("Disable 2FA error:", error);
    return { status: 500, body: { error: "Failed to disable 2FA" } };
  }
};

// ===========================
// LOGOUT ALL DEVICES
// ===========================
export const logoutAllDevices = async (req) => {
  try {
    const decoded = await verifyToken(req);
    const username = decoded.username;

    // Invalidate all previous tokens by updating user's token version
    const userRef = db.collection("users").doc(username);
    await userRef.update({
      tokenVersion: (await userRef.get()).data().tokenVersion + 1 || 1,
      updatedAt: new Date().toISOString()
    });

    return { 
      status: 200, 
      body: { 
        message: "Logged out from all devices successfully" 
      } 
    };
  } catch (error) {
    console.error("Logout all devices error:", error);
    return { status: 500, body: { error: "Failed to logout from all devices" } };
  }
};

// ===========================
// DELETE ACCOUNT
// ===========================
export const deleteAccount = async (req) => {
  try {
    const decoded = await verifyToken(req);
    const username = decoded.username;

    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    // Delete user data from all collections
    const batch = db.batch();

    // Delete user document
    batch.delete(userRef);

    // Delete user's tasks
    const tasksSnapshot = await db.collection("tasks")
      .where("username", "==", username)
      .get();
    tasksSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete user's notifications
    const notificationsSnapshot = await db.collection("notifications")
      .where("username", "==", username)
      .get();
    notificationsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete user's 2FA data
    const twoFARef = db.collection("twoFACodes").doc(username);
    batch.delete(twoFARef);

    // Delete password reset tokens
    const resetTokenRef = db.collection("passwordResetTokens").doc(username);
    batch.delete(resetTokenRef);

    await batch.commit();

    return { 
      status: 200, 
      body: { 
        message: "Account deleted successfully" 
      } 
    };
  } catch (error) {
    console.error("Delete account error:", error);
    return { status: 500, body: { error: "Failed to delete account" } };
  }
};

// ===========================
// CHECK USERNAME AVAILABILITY
// ===========================
export const checkUsernameAvailability = async (query) => {
  try {
    const { username } = query;
    if (!username) {
      return { status: 400, body: { error: "Username is required" } };
    }

    if (username.length < 3) {
      return { status: 400, body: { error: "Username must be at least 3 characters" } };
    }

    const userDoc = await db.collection("users").doc(username.toLowerCase()).get();
    
    return {
      status: 200,
      body: { 
        available: !userDoc.exists,
        username: username.toLowerCase()
      },
    };
  } catch (error) {
    console.error("Check username error:", error);
    return { status: 500, body: { error: "Failed to check username availability" } };
  }
};

// ===========================
// UPDATE USER PROFILE
// ===========================
export const updateUserProfile = async (req, data) => {
  try {
    validateEnvVars();
    
    const decoded = await verifyToken(req);
    const username = decoded.username;

    const userRef = db.collection("users").doc(username);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    // Fields that can be updated
    const allowedFields = ['name', 'position', 'department', 'phone', 'bio', 'photo', 'preferences'];
    const updates = {
      updatedAt: new Date().toISOString()
    };
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        updates[field] = data[field];
      }
    });

    await userRef.update(updates);

    // Get updated user data
    const updatedDoc = await userRef.get();
    const userData = sanitizeUser(updatedDoc.data());
    
    // Remove sensitive data
    delete userData.password;
    delete userData.google;

    return {
      status: 200,
      body: { 
        message: "Profile updated successfully",
        user: userData
      }
    };
  } catch (error) {
    console.error("Error in updateUserProfile:", error);
    if (error.message.includes("Missing required environment variables")) {
      return { status: 500, body: { error: "Server configuration error" } };
    }
    if (error.message.includes("Unauthorized")) {
      return { status: 401, body: { error: "Unauthorized" } };
    }
    return { status: 500, body: { error: "Failed to update profile" } };
  }
};

// ===========================
// SEARCH USERS
// ===========================
export const searchUsers = async (req, query) => {
  try {
    const { q } = query;
    
    if (!q || q.length < 2) {
      return { status: 400, body: { error: "Search query must be at least 2 characters" } };
    }

    const searchTerm = q.toLowerCase();
    
    // Search in username, name, and email
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();
    const users = [];

    snapshot.forEach(doc => {
      const user = sanitizeUser(doc.data());
      const username = user.username?.toLowerCase() || '';
      const name = user.name?.toLowerCase() || '';
      const email = user.email?.toLowerCase() || '';
      
      if (username.includes(searchTerm) || 
          name.includes(searchTerm) || 
          email.includes(searchTerm)) {
        // Don't send sensitive data
        users.push({
          id: doc.id,
          username: user.username,
          name: user.name,
          email: user.email,
          position: user.position,
          department: user.department,
          photo: user.photo,
          verified: user.verified
        });
      }
    });

    return {
      status: 200,
      body: { users }
    };
  } catch (error) {
    console.error("Error in searchUsers:", error);
    return { status: 500, body: { error: "Failed to search users" } };
  }
};

// ===========================
// EMAIL NOTIFICATION
// ===========================

// Add this function before the existing functions
export const sendEmailNotification = async (userEmail, title, message) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"JobTrackr" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: title,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">${title}</h2>
          <p>${message}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from JobTrackr.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email notification sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error("❌ Email notification failed:", error);
    return false;
  }
};

// GET user settings
export const getUserSettings = async (req) => {
  try {
    const decoded = await verifyToken(req);
    const username = decoded.username;
    
    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }
    
    const user = userDoc.data();
    return {
      status: 200,
      body: {
        settings: user.settings || {},
        twoFA: user.twoFA || { enabled: false }
      }
    };
  } catch (error) {
    console.error("Get user settings error:", error);
    return { status: 500, body: { error: "Failed to get settings" } };
  }
};

// UPDATE user settings
export const updateUserSettings = async (req, data) => {
  try {
    const decoded = await verifyToken(req);
    const username = decoded.username;
    
    await db.collection("users").doc(username).update({
      settings: data,
      updatedAt: new Date().toISOString()
    });
    
    return {
      status: 200,
      body: { message: "Settings updated successfully" }
    };
  } catch (error) {
    console.error("Update user settings error:", error);
    return { status: 500, body: { error: "Failed to update settings" } };
  }
};

// ===========================
// GET USER BY USERNAME
// ===========================
export const getUserByUsername = async (req, username) => {
  try {
    const doc = await db.collection("users").doc(username.toLowerCase()).get();
    
    if (!doc.exists) {
      return { status: 404, body: { error: "User not found" } };
    }

    const user = sanitizeUser(doc.data());
    
    // Don't send sensitive data
    const publicProfile = {
      id: doc.id,
      username: user.username,
      name: user.name,
      email: user.email,
      position: user.position,
      department: user.department,
      bio: user.bio,
      photo: user.photo,
      createdAt: user.createdAt,
      verified: user.verified
    };

    return {
      status: 200,
      body: { user: publicProfile }
    };
  } catch (error) {
    console.error("Error in getUserByUsername:", error);
    return { status: 500, body: { error: "Failed to get user" } };
  }
  
};