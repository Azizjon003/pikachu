import express from "express";
import indexRoutes from "./routes/index.routes";
import path from "path";

const app = express();

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), "public")));

// Serve generated PPTX files
app.use("/generated", express.static(path.join(process.cwd(), "generated")));

// Serve images directory with template-specific paths
// Format: /templatename/images/* -> images/templatename/*
// This allows JSON files to reference images as /templatename/images/filename
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.use("/:templateName/images", (req, res, next) => {
  const templateName = req.params.templateName;
  const imagePath = path.join(process.cwd(), "images", templateName);
  express.static(imagePath)(req, res, next);
});

// Legacy support for old format
app.use("/templates/images", express.static(path.join(process.cwd(), "images")));

app.use("/api", indexRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
  console.log("Frontend available at: http://localhost:3000");
});
