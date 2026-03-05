import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import prisma from "../../../lib/prisma";

const GENERATED_DIR = path.join(process.cwd(), "generated");

export const listPresentations = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const [presentations, total] = await Promise.all([
      prisma.presentation.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { template: { select: { name: true } } },
      }),
      prisma.presentation.count(),
    ]);

    res.json({
      success: true,
      presentations: presentations.map((p) => ({
        id: p.id,
        filename: p.filename,
        topic: p.topic,
        language: p.language,
        template: p.template?.name || null,
        size: p.fileSize,
        slideCount: p.slideCount,
        generationTime: p.generationTime,
        totalTokens: p.totalTokens,
        estimatedCost: p.estimatedCost,
        status: p.status,
        createdAt: p.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPresentation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const presentation = await prisma.presentation.findUnique({
      where: { id },
      include: {
        template: { select: { name: true, hasPreview: true } },
        task: { select: { status: true, progress: true, createdAt: true, updatedAt: true } },
      },
    });

    if (!presentation) {
      return res.status(404).json({ success: false, error: "Presentation not found" });
    }

    res.json({ success: true, presentation });
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

    // Delete from DB
    await prisma.presentation.delete({ where: { filename } });

    // Delete file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: "Presentation deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const [total, byTopic, byLanguage, byTemplate, tokenStats] = await Promise.all([
      prisma.presentation.count(),
      prisma.presentation.groupBy({
        by: ["topic"],
        _count: true,
        orderBy: { _count: { topic: "desc" } },
        take: 10,
      }),
      prisma.presentation.groupBy({
        by: ["language"],
        _count: true,
      }),
      prisma.presentation.groupBy({
        by: ["templateId"],
        _count: true,
        orderBy: { _count: { templateId: "desc" } },
        take: 5,
      }),
      prisma.presentation.aggregate({
        _sum: { totalTokens: true, fileSize: true },
        _avg: { generationTime: true, totalTokens: true, estimatedCost: true },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        byTopic: byTopic.map((t) => ({ topic: t.topic, count: t._count })),
        byLanguage: byLanguage.map((l) => ({ language: l.language, count: l._count })),
        templateUsage: byTemplate.map((t) => ({ templateId: t.templateId, count: t._count })),
        totalTokens: tokenStats._sum.totalTokens || 0,
        totalSize: tokenStats._sum.fileSize || 0,
        avgGenerationTime: Math.round(tokenStats._avg.generationTime || 0),
        avgTokens: Math.round(tokenStats._avg.totalTokens || 0),
        avgCost: tokenStats._avg.estimatedCost || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
