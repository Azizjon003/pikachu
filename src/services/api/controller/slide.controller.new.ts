/**
 * Slide Controller (Rewritten)
 *
 * Thin controller layer — all logic lives in SlideGenerationPipeline.
 * Both async and sync endpoints use the same pipeline.
 *
 * Replaces the original 669-line controller.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { SlideGenerationPipeline } from './slide-generation-pipeline';
import { FreeSlideGenerationPipeline } from './free-slide-pipeline';
import {
  createTask,
  getTask,
  updateTask,
} from '@/src/services/api/services/task.service';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import { PipelineOptions, FreeSlideOptions, SlideModifyOptions } from '@/src/core/types/generation';
import { SlideModifier } from '@/src/core/free-generation/slide-modifier';
import { SlideEditor } from '@/src/core/generation/slide-editor';
import { ImageEditor } from '@/src/core/generation/image-editor';
import { AIClient } from '@/src/core/ai/ai-client';
import { generateSlideFromAI } from '@/src/core/processors/schema-processor';
import { exportPPTX } from '@/src/core/exporters';

const logger = new EnhancedLogger(LogLevel.INFO);

/**
 * Start async slide generation (returns immediately with taskId)
 */
export const startSlideGeneration = async (req: Request, res: Response) => {
  const params: PipelineOptions = req.body;
  const taskId = crypto.randomBytes(16).toString('hex');

  await createTask(taskId);

  const pipeline = new SlideGenerationPipeline();

  // Run in background with progress updates
  pipeline
    .execute(params, (progress, message) => {
      updateTask(taskId, { status: 'processing', progress });
    })
    .then((result) => {
      updateTask(taskId, { status: 'completed', progress: 100, result });
    })
    .catch((error: Error) => {
      logger.error('Pipeline failed', error);
      updateTask(taskId, { status: 'failed', error: error.message });
    });

  res.status(202).json({
    success: true,
    message: 'Slide generation started',
    taskId,
  });
};

/**
 * Get status of an async generation task
 */
export const getSlideGenerationStatus = async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const task = await getTask(taskId);

  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  res.json({ success: true, task });
};

/**
 * Synchronous slide generation (waits for completion)
 */
export const generateSlide = async (req: Request, res: Response) => {
  try {
    const pipeline = new SlideGenerationPipeline();
    const result = await pipeline.execute(req.body);

    res.json(result);
  } catch (error: any) {
    logger.error('Slide generation failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Edit an existing slide's content based on instructions
 */
export const editSlide = async (req: Request, res: Response) => {
  try {
    const { slide, instructions, language, topic, elementIndexes } = req.body;

    const editor = new SlideEditor(new AIClient());
    const updatedSlide = await editor.edit({
      slide,
      instructions,
      language,
      topic,
      elementIndexes,
    });

    res.json({ success: true, slide: updatedSlide });
  } catch (error: any) {
    logger.error('Slide edit failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Replace images in an existing slide using AI-powered search
 */
export const editSlideImages = async (req: Request, res: Response) => {
  try {
    const editor = new ImageEditor(new AIClient());
    const result = await editor.replaceImages(req.body);

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Image edit failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Re-render edited slides into a new PPTX file
 */
export const reRenderSlide = async (req: Request, res: Response) => {
  try {
    const { slides, template } = req.body;

    // Load original template data (full schema with theme, viewport, etc.)
    const templateJsonPath = path.join(
      process.cwd(),
      'templates',
      template.replace('.sxema.json', '.json')
    );

    if (!fs.existsSync(templateJsonPath)) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const fullSxema = JSON.parse(fs.readFileSync(templateJsonPath, 'utf-8'));

    // Merge edited slides with original template structure
    const dataFullSxema = generateSlideFromAI(slides, fullSxema);

    // Generate unique filename
    const generatedDir = path.join(process.cwd(), 'generated');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const sessionId = Date.now();
    const slideName = `${sessionId}-edited.pptx`;
    const slidePath = path.join(generatedDir, slideName);

    // Export PPTX
    exportPPTX(
      dataFullSxema.slide,
      false,
      false,
      dataFullSxema.theme,
      { width: dataFullSxema.viewportWidth, height: dataFullSxema.viewportHeight },
      slidePath
    );

    logger.info('Slide re-rendered', { slideName, template });

    res.json({
      success: true,
      slideName,
      slidePath,
      downloadUrl: `/generated/${slideName}`,
    });
  } catch (error: any) {
    logger.error('Slide re-render failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Start async template-free slide generation (returns immediately with taskId)
 */
export const startFreeSlideGeneration = async (req: Request, res: Response) => {
  const params: FreeSlideOptions = req.body;
  const taskId = crypto.randomBytes(16).toString('hex');

  await createTask(taskId);

  const pipeline = new FreeSlideGenerationPipeline();

  pipeline
    .execute(params, (progress, message) => {
      updateTask(taskId, { status: 'processing', progress });
    })
    .then((result) => {
      updateTask(taskId, { status: 'completed', progress: 100, result });
    })
    .catch((error: Error) => {
      logger.error('Free pipeline failed', error);
      updateTask(taskId, { status: 'failed', error: error.message });
    });

  res.status(202).json({
    success: true,
    message: 'Template-free slide generation started',
    taskId,
  });
};

/**
 * Modify an existing presentation using a natural language prompt
 */
export const modifySlide = async (req: Request, res: Response) => {
  try {
    const params: SlideModifyOptions = req.body;

    const modifier = new SlideModifier();
    const result = await modifier.modify(params);

    res.json(result);
  } catch (error: any) {
    logger.error('Slide modification failed', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
