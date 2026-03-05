import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import indexRoutes from "./routes/index.routes";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
    contentSecurityPolicy: false, // Disable CSP for now (customize as needed)
  })
);

// CORS - Cross-Origin Resource Sharing
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : "*", // Allow all origins if not specified
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "50mb" })); // Increased limit for large requests
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// STATIC FILE SERVING
// ============================================

// Serve static files from public directory
app.use(express.static(path.join(process.cwd(), "public")));

// Serve generated PPTX files
app.use("/generated", express.static(path.join(process.cwd(), "generated")));

// Serve template preview images
app.use(
  "/templates/previews",
  express.static(path.join(process.cwd(), "templates", "previews"))
);

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
app.use(
  "/templates/images",
  express.static(path.join(process.cwd(), "images"))
);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================

app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// ============================================
// API ROUTES
// ============================================

app.use("/api", indexRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

// ============================================
// GLOBAL ERROR HANDLERS (prevent crash on socket errors)
// ============================================

process.on('uncaughtException', (error: Error) => {
  // Socket hang up / ECONNRESET — tashqi server ulanishni uzganda
  // Bu xato process ni crash qilmasligi kerak
  if (error.message === 'socket hang up' || (error as any).code === 'ECONNRESET') {
    console.error(`⚠️ Socket error (non-fatal): ${error.message}`);
    return;
  }
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️ Unhandled Rejection:', reason?.message || reason);
});

app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║           🚀 Pikachu API Server Started              ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log(`\n📡 Server running on port ${PORT}`);
  console.log(`🌐 Frontend available at: http://localhost:${PORT}`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 Security: CORS, Helmet, Rate Limiting enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("\n════════════════════════════════════════════════════════\n");
});
