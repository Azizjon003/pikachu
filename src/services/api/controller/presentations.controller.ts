import { Request, Response } from "express";
import fs from "fs";
import path from "path";

const GENERATED_DIR = path.join(process.cwd(), "generated");

export const listPresentations = async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GENERATED_DIR)) {
      return res.json({ success: true, presentations: [] });
    }

    const allFiles = fs.readdirSync(GENERATED_DIR);

    const presentations = allFiles
      .filter((file) => file.endsWith(".pptx"))
      .map((file) => {
        const filePath = path.join(GENERATED_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const jsonFiles = allFiles
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const filePath = path.join(GENERATED_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    res.json({ success: true, presentations, jsonFiles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const downloadPresentation = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(GENERATED_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    res.download(filePath, filename);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deletePresentation = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(GENERATED_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: "File deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(GENERATED_DIR)) {
      return res.json({
        success: true,
        stats: { total: 0, totalSize: 0, avgSize: 0 },
      });
    }

    const files = fs
      .readdirSync(GENERATED_DIR)
      .filter((file) => file.endsWith(".pptx"));

    const totalSize = files.reduce((sum, file) => {
      const stats = fs.statSync(path.join(GENERATED_DIR, file));
      return sum + stats.size;
    }, 0);

    res.json({
      success: true,
      stats: {
        total: files.length,
        totalSize,
        avgSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
