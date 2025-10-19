import mongoose from "mongoose";
import Course from "../../../models/course.model.js";
import Module from "../../../models/module.model.js";
import Topic from "../../../models/topic.model.js";
import Subject from "../../../models/subject.model.js";
import { getPresignedUrl } from "../../../utils/uploadTos3Function.js";

export const getAllCourses = async (req, res) => {
  try {
    const courses = await Course.find({ isActive: true }).select(
      "name description totalTopics courseImgUrl"
    );
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCourseDetailsById = async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    // Find course and ensure it's active
    const course = await Course.findOne({
      _id: courseId,
      isActive: true,
    }).select(
      "name description totalTopics courseImgUrl originalPrice discountedPrice isCouponCode couponCode duration"
    );

    if (!course) {
      return res.status(404).json({ error: "Course not found or inactive" });
    }

    // Fetch active subjects for the course
    const subjects = await Subject.find({ courseId, isActive: true }).lean();

    // For each subject, fetch modules and topic count per module
    for (let subject of subjects) {
      const modules = await Module.find({
        courseId,
        subjectId: subject._id,
        isActive: true,
      }).lean();

      // Add topicCount for each module
      for (let module of modules) {
        const topicCount = await Topic.countDocuments({
          moduleId: module._id,
          isActive: true,
        });
        module.topicCount = topicCount;
      }

      subject.modules = modules;
      // Optionally total topics in subject
      subject.totalTopics = modules.reduce(
        (sum, mod) => sum + mod.topicCount,
        0
      );
    }

    // Total modules and topics for the course
    const moduleCount = await Module.countDocuments({
      courseId,
      isActive: true,
    });
    const topicCount = await Topic.countDocuments({ courseId, isActive: true });

    res.status(200).json({
      course,
      moduleCount,
      topicCount,
      subjects,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTopicsByModule = async (req, res) => {
  try {
    const { courseId, subjectId, moduleId } = req.params;

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(courseId) ||
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(moduleId)
    ) {
      return res.status(400).json({ error: "Invalid IDs provided" });
    }

    // Fetch topics for this module
    const topics = await Topic.find({
      courseId,
      subjectId,
      moduleId,
      isActive: true,
    }).sort({ topicOrder: 1 });

    // Add pre-signed URLs for videos and notes
    const topicsWithUrls = await Promise.all(
      topics.map(async (doc) => {
        const obj = doc.toObject();
        return {
          ...obj,
          videoUrl: obj.videoUrl ? await getPresignedUrl(obj.videoUrl) : null,
          noteUrl: obj.noteUrl ? await getPresignedUrl(obj.noteUrl) : null,
        };
      })
    );
    console.log({ topicsWithUrls });
    res.status(200).json({ data: topicsWithUrls });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: error.message });
  }
};
