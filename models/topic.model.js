import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const topicSchema = new Schema(
  {
    courseId: {
      type: Types.ObjectId,
      ref: "Course",
      required: true,
    },
    subjectId:{
        type: Types.ObjectId,
        ref: "Subject",
        required: true,
    },
    moduleId: {
        type: Types.ObjectId,
        ref: "Module",
        required: true, 
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    noteUrl: { type: String, required: true },
    videoUrl: { type: String, required: true },
    folderName: { type: String, required: true },
    topicOrder: { type: Number, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

const Topic = model("Topic", topicSchema);

export default Topic;