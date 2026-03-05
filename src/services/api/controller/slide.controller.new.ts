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
import { SlideGenerationPipeline } from './slide-generation-pipeline';
import {
  createTask,
  getTask,
  updateTask,
} from '@/src/services/api/services/task.service';
import { EnhancedLogger, LogLevel } from '@/src/lib/logger';
import { PipelineOptions } from '@/src/core/types/generation';
import { SlideEditor } from '@/src/core/generation/slide-editor';
import { AIClient } from '@/src/core/ai/ai-client';

const logger = new EnhancedLogger(LogLevel.INFO);

/**
 * Start async slide generation (returns immediately with taskId)
 */
export const startSlideGeneration = async (req: Request, res: Response) => {
  const params: PipelineOptions = req.body;
  const taskId = crypto.randomBytes(16).toString('hex');

  createTask(taskId);

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
  const task = getTask(taskId);

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
