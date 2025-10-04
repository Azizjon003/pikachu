import express from "express";
import indexRoutes from "./routes/index.routes";
import path from "path";

const app = express();

app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), "public")));

// Serve generated PPTX files
app.use("/generated", express.static(path.join(process.cwd(), "generated")));

app.use("/api", indexRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
  console.log("Frontend available at: http://localhost:3000");
});
