import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Topic from "../../models/topic.model.js";
import Course from "../../models/course.model.js";
import Subject from "../../models/subject.model.js";
import Module from "../../models/module.model.js";
import {
  uploadToS3,
  deleteFromS3,
  getPresignedUrl,
} from "../../utils/uploadTos3Function.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "../../uploads");

const getFolderName = async (courseId, subjectId, moduleId) => {
  const course = await Course.findById(courseId);
  const subject = await Subject.findById(subjectId);
  const module = await Module.findById(moduleId);
  if (!course || !subject || !module) throw new Error("Invalid IDs provided");
  return `${course.name}/${subject.subjectName}/${module.name}`.replace(
    /\s+/g,
    "-"
  );
};

export const createTopic = async (req, res) => {
  try {
    const {
      courseId,
      subjectId,
      moduleId,
      name,
      description,
      topicOrder,
      noteUrl,
      videoUrl,
    } = req.body;
    const folderName = await getFolderName(courseId, subjectId, moduleId);
    const topic = await Topic.create({
      courseId,
      subjectId,
      moduleId,
      name,
      description,
      topicOrder,
      folderName,
      noteUrl,
      videoUrl,
    });

    res.status(200).json({ message: "Topic created", topic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const { name, description, topicOrder } = req.body;
    const uploadedFiles = {};

    if (req.files.length) {
      for (const file of req.files) {
        const filePath = path.join(tempDir, file.filename);
        const fileBuffer = fs.readFileSync(filePath);
        const s3Key = await uploadToS3({
          folderName: topic.folderName,
          file: fileBuffer,
          fileName: file.originalname,
          mimetype: file.mimetype,
        });

        if (file.fieldname === "note") {
          await deleteFromS3(topic.noteUrl);
          uploadedFiles.noteUrl = s3Key;
        }
        if (file.fieldname === "video") {
          await deleteFromS3(topic.videoUrl);
          uploadedFiles.videoUrl = s3Key;
        }

        fs.unlinkSync(filePath);
      }
    }

    topic.name = name || topic.name;
    topic.description = description || topic.description;
    topic.topicOrder = topicOrder || topic.topicOrder;
    if (uploadedFiles.noteUrl) topic.noteUrl = uploadedFiles.noteUrl;
    if (uploadedFiles.videoUrl) topic.videoUrl = uploadedFiles.videoUrl;

    await topic.save();
    res.status(200).json({ message: "Topic updated", topic });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteTopic = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    await deleteFromS3(topic.noteUrl);
    await deleteFromS3(topic.videoUrl);
    await Topic.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Topic deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getTopicById = async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const notePresignedUrl = await getPresignedUrl(topic.noteUrl);
    const videoPresignedUrl = await getPresignedUrl(topic.videoUrl);

    res.status(200).json({
      message: "Topic found",
      topic: {
        ...topic.toObject(),
        noteUrl: notePresignedUrl,
        videoUrl: videoPresignedUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllTopics = async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const search = req.query.search || "";
    const filter = req.query.filter || "";
    const from = req.query.from;
    const to = req.query.to;

    let query = {};

    // 🔎 Search by name, description, or topicOrder
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [{ name: searchRegex }, { description: searchRegex }];

      if (!isNaN(Number(search))) {
        query.$or.push({ topicOrder: Number(search) });
      }
    }

    // 📅 Date range filters
    const now = new Date();
    if (filter === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else if (filter === "week") {
      const first = now.getDate() - now.getDay();
      const start = new Date(now.setDate(first));
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else if (filter === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      query.createdAt = { $gte: start, $lte: end };
    } else if (filter === "year") {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else if (filter === "custom" && from && to) {
      query.createdAt = { $gte: new Date(from), $lte: new Date(to) };
    }

    // ⏳ Fetch topics
    let topicsQuery = Topic.find(query).sort({ createdAt: -1 });

    let total = null;
    if (page && limit) {
      total = await Topic.countDocuments(query);
      topicsQuery = topicsQuery.skip((page - 1) * limit).limit(limit);
    }

    const topics = await topicsQuery;

    // 🔗 Add signed URLs
    const dataWithUrls = await Promise.all(
      topics.map(async (doc) => {
        const obj = doc.toObject();
        return {
          ...obj,
          videoUrl: obj.videoUrl ? await getPresignedUrl(obj.videoUrl) : null,
          noteUrl: obj.noteUrl ? await getPresignedUrl(obj.noteUrl) : null,
        };
      })
    );

    // 📤 Response
    if (page && limit) {
      return res.status(200).json({ data: dataWithUrls, total });
    } else {
      return res.status(200).json(dataWithUrls);
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getTopicByCourseId = async (req, res) => {
  try {
    const { courseId } = req.params;
    const topics = await Topic.find({ courseId });
    if (topics.length === 0) {
      return res
        .status(404)
        .json({ error: "No Topic found for this courseId" });
    }
    res.status(200).json({ message: "Topic fetched successfully", topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
