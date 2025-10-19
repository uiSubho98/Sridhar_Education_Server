import express from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  verifyOtpAndRegister,
  changePassword,
} from "../../controllers/user/Auth/user.auth.controller.js";
import path from "path";
import { fileURLToPath } from "url";
import { createOrUpdateProfile } from "../../controllers/user/Profile/user.profile.controller.js";
import { raiseDeviceChangeRequest } from "../../controllers/user/DeviceChangeRequest/user.deviceChangeRequest.controller.js";
import { getBanners } from "../../controllers/admin/Banner_Management/admin.banner.controller.js";
import {
  getAllAnnouncements,
  getAnnouncementById,
} from "../../controllers/admin/Announcement/admin.announcement.controller.js";
import {
  getAllCourses,
  getCourseDetailsById,
  getTopicsByModule,
} from "../../controllers/user/Courses/user.courses.controller.js";

// Fix __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// POST /api/users
router.post("/signup", registerUser); // Step 1: send OTP
router.post("/verify-otp", verifyOtpAndRegister); // Step 2: verify OTP and create user
router.post("/login", loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/profile/:userId", createOrUpdateProfile);
router.post("/change-password/:userId", changePassword);
router.get("/reset-password/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/reset-password.html"));
});

router.post("/request-device-change", raiseDeviceChangeRequest);

// NOTE: 📝 This is Banner Carousel Routes

router.get("/get/banners", getBanners); // get all

// NOTE: 📝 This is Annnouncement Routes

router.get("/getall/announcement", getAllAnnouncements);
router.get("/get/announcement/:id", getAnnouncementById);

// * This is Courses Routes
router.get("/get/all/courses/", getAllCourses);
router.get("/get/course/:courseId", getCourseDetailsById);
router.get("/get/topics/:courseId/:subjectId/:moduleId", getTopicsByModule);

export default router;
