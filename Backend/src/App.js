import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import protectedTestRoutes from "./routes/protectedTestRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VeriWrite Backend API is running",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Frontend can connect to Backend!",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api", protectedTestRoutes);

export default app;
