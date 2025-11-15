import User from "../../../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../../../config/config.js";
import crypto from "crypto";
import { sendEmail } from "../../../utils/sendEmail.js";
import PendingUser from "../../../models/pendingUser.model.js";
import DeviceChangeRequest from "../../../models/deviceChangeRequest.model.js"; // adjust path

// NOTE: 📝 ==========================
// @desc   Register new user
// NOTE: 📝 ==========================

export const registerUser = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "Email already registered" });

    const existingPending = await PendingUser.findOne({ email });
    if (existingPending) await PendingUser.deleteOne({ email }); // clear any old pending attempts

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP

    const pendingUser = new PendingUser({
      email,
      hashedPassword,
      deviceId,
      otp,
    });
    await pendingUser.save();

    await sendEmail({
      to: email,
      subject: "Verify your OTP - Sridhar LMS",
      html: `<p>Your OTP is <b>${otp}</b>. It will expire in 10 minutes.</p>`,
    });

    res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NOTE: 📝 =====================================
// @desc   User Login
// NOTE: 📝 =====================================



export const loginUser = async (req, res) => {
  try {
    const { email, password, deviceId } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Device ID check
    // if (
    //   !user.deviceId ||
    //   user.deviceId.trim().toLowerCase() !== deviceId.trim().toLowerCase()
    // ) {
    //   // Lookup the device change request for approval status
    //   const deviceRequest = await DeviceChangeRequest.findOne({
    //     userId: user._id,
    //     newDeviceId: deviceId,
    //   }).sort({ createdAt: -1 });

    //   if (!deviceRequest) {
    //     return res.status(403).json({
    //       message: "Unauthorized device access. Device ID does not match and no pending device change request found.",
    //     });
    //   }

    //   // If there is a device change request, check if it is approved or pending
    //   if (deviceRequest.status === "approved") {
    //     // Optionally update user's deviceId to newDeviceId here if approved
    //     user.deviceId = deviceId;
    //     await user.save();
    //   } else if (deviceRequest.status === "pending") {
    //     return res.status(403).json({
    //       message: "Device change request is pending admin approval.",
    //     });
    //   } else {
    //     return res.status(403).json({
    //       message: "Device change request was rejected.",
    //     });
    //   }
    // }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    // Generate tokens
    const accessToken = jwt.sign({ id: user._id }, config.jwtSecret, {
      expiresIn: "30d",
    });

    const refreshToken = jwt.sign({ id: user._id }, config.jwtSecret, {
      expiresIn: "90d",
    });

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    // Remove sensitive fields
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.createdAt;
    delete userObj.refreshToken;

    // Also return the latest device change request status in response if any
    const latestDeviceRequest = await DeviceChangeRequest.findOne({
      userId: user._id,
    }).sort({ createdAt: -1 });

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: userObj,
      deviceChangeRequestStatus: latestDeviceRequest ? latestDeviceRequest.status : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// NOTE: 📝 =====================================
// @desc   Google Sign Up or Login
//  NOTE: 📝=====================================
// export const googleAuth = async (req, res) => {
//   try {
//     const { email, firstName, lastName, deviceId } = req.body;

//     // Try to find user
//     let user = await User.findOne({ email });

//     if (!user) {
//       // If not found, register new user
//       user = new User({
//         email,
//         firstName,
//         lastName,
//         phone: "",
//         password: "", // no password
//         deviceId,
//         profileUpdated: false,
//       });
//       await user.save();
//     }

//     // Generate token
//     const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });

//     res.status(200).json({
//       message: "Authenticated via Google",
//       token,
//       user,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// NOTE: 📝 ==========================
// Get all users
// NOTE: 📝 ==========================
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }); // latest first
    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch users", detail: error.message });
  }
};

//  NOTE: 📝 ==========================
// Get user by ID
// NOTE: 📝 ==========================

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error: "Invalid user ID", detail: error.message });
  }
};

// NOTE: 📝 ==========================
// Refresh Token Regeneration
// NOTE: 📝 ==========================

export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    // Verify the incoming refresh token
    const decoded = jwt.verify(refreshToken, config.jwtSecret);

    // Find the user
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new access & refresh tokens
    const newAccessToken = jwt.sign({ id: user._id }, config.jwtSecret, {
      expiresIn: "30d",
    });

    const newRefreshToken = jwt.sign({ id: user._id }, config.jwtSecret, {
      expiresIn: "90d",
    });

    // Save new refresh token in DB (rotate)
    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      message: "New access token generated",
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Token expired or invalid", detail: error.message });
  }
};

// NOTE: 📝 =========================
// forgot password
// NOTE: 📝 =========================

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetToken = hashedToken;
    user.resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    await user.save();

    const resetUrl = `http://localhost:8080/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Sridhar Education LMS password",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
    });

    res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NOTE: 📝 ========================
// reset password
// NOTE: 📝 ========================
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetToken: hashedToken,
      resetTokenExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NOTE: 📝 ==========================
// Verfy OTP
// NOTE: 📝 ==========================
export const verifyOtpAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const pendingUser = await PendingUser.findOne({ email });
    if (!pendingUser)
      return res.status(404).json({ message: "No OTP found or expired" });

    if (pendingUser.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (pendingUser.expiresAt < Date.now()) {
      await PendingUser.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    const user = new User({
      email,
      password: pendingUser.hashedPassword,
      deviceId: pendingUser.deviceId,
    });

    await user.save();
    await PendingUser.deleteOne({ email });

    res
      .status(201)
      .json({ message: "User registered successfully", userId: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NOTE: 📝 ==========================
//change password
// NOTE: 📝 ==========================

export const changePassword = async (req, res) => {
  try {
    const { userId } = req.params; // or from req.user if using auth middleware
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both current and new passwords are required" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Compare current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and update new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
