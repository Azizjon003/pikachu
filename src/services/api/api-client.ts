import express from "express";
import indexRoutes from "./routes/index.routes";

const app = express();

app.use(express.json());

app.use("/api", indexRoutes);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
