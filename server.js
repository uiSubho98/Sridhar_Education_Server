import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import indexRoutes from "./routes/index.js";
import { config } from "./config/config.js";
import userRoutes from "./routes/user/user.routes.js";
import adminRoutes from "./routes/admin/admin.routes.js";
import cors from "cors";
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets
app.use(express.static(path.join(__dirname, "public")));

app.get("/reset-password/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

// Middlewares
app.use(express.json());
app.use(cors({
  origin: "*", // or your frontend origin
  credentials: true,
}));
// Routes
app.use("/", indexRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

// DB connection
mongoose
  .connect(config.mongoURI, {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
  })
  .then(() => {
    console.log(`✅ MongoDB connected to ${config.mongoURI}`);
    app.listen(config.port, () => {
      console.log(
        `🚀 Server running at http://localhost:${config.port} in ${config.env} mode`
      );
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
