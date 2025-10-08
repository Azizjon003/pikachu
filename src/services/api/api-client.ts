import express from "express";
import indexRoutes from "./routes/index.routes";
import path from "path";

const app = express();

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), "public")));

// Serve generated PPTX files
app.use("/generated", express.static(path.join(process.cwd(), "generated")));

// Serve images directory (both /images and /templates/images point to same location)
// This is because JSON files reference images as ./images/ but frontend may use /templates/images/
app.use("/images", express.static(path.join(process.cwd(), "images")));
app.use("/templates/images", express.static(path.join(process.cwd(), "images")));

app.use("/api", indexRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
  console.log("Frontend available at: http://localhost:3000");
});
