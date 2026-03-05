/**
 * Cost Estimation Controller
 *
 * Predicts the cost of generating a presentation BEFORE starting.
 * Uses: template element counts + historical averages from DB.
 */

import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import { DEFAULT_GENERATION_CONFIG } from '@/src/core/types/generation';

// ===== Pricing per 1M tokens =====
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':      { input: 2.50,  output: 10.00 },
  'gpt-4o-mini': { input: 0.15,  output: 0.60  },
};

// ===== Base token estimates per operation =====
interface OperationEstimate {
  name: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  count: number;
}

function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const pricing = PRICING[model] || PRICING['gpt-4o'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function buildEstimates(pageCount: number, templateSlideCount: number, imageCount: number): OperationEstimate[] {
  const model = DEFAULT_GENERATION_CONFIG.model;
  const miniModel = 'gpt-4o-mini';

  // Content slides = total slides minus title(1), outline(1), conclusion(1), references(1), thankYou(1)
  const contentSlideCount = Math.max(0, pageCount - 5);

  const estimates: OperationEstimate[] = [
    {
      name: 'outline',
      model,
      inputTokens: 1500,
      outputTokens: 500,
      count: 1,
    },
    {
      name: 'title_placement',
      model,
      inputTokens: 500,
      outputTokens: 250,
      count: 1,
    },
    {
      name: 'outline_placement',
      model,
      inputTokens: 700,
      outputTokens: 350,
      count: 1,
    },
    {
      name: 'content_generation',
      model,
      inputTokens: 2000,
      outputTokens: 800,
      count: contentSlideCount,
    },
    {
      name: 'conclusion',
      model,
      inputTokens: 900,
      outputTokens: 400,
      count: 1,
    },
    {
      name: 'references',
      model,
      inputTokens: 1100,
      outputTokens: 550,
      count: 1,
    },
    {
      name: 'thank_you',
      model,
      inputTokens: 700,
      outputTokens: 250,
      count: 1,
    },
    {
      name: 'quality_review',
      model: miniModel,
      inputTokens: 300,
      outputTokens: 100,
      count: Math.ceil(imageCount * 0.3), // ~30% of images may need review
    },
  ];

  return estimates;
}

/**
 * POST /api/slide/estimate-cost
 *
 * Request body: { template, language, page, topic }
 * Returns estimated token usage, cost breakdown, and historical comparison.
 */
export const estimateCostHandler = async (req: Request, res: Response) => {
  try {
    const { template, page, topic } = req.body;

    if (!template || !page) {
      return res.status(400).json({
        success: false,
        error: 'template and page are required',
      });
    }

    const pageCount = parseInt(page, 10);
    if (isNaN(pageCount) || pageCount < 1 || pageCount > 100) {
      return res.status(400).json({
        success: false,
        error: 'page must be between 1 and 100',
      });
    }

    // Get template info from DB
    const templateName = template.replace('.sxema.json', '');
    const dbTemplate = await prisma.template.findFirst({
      where: { name: { contains: templateName } },
      select: { slideCount: true, imageCount: true, name: true },
    });

    const templateSlideCount = dbTemplate?.slideCount || pageCount;
    const imageCount = dbTemplate?.imageCount || 0;

    // Build operation-level estimates
    const operations = buildEstimates(pageCount, templateSlideCount, imageCount);

    // Calculate totals
    const breakdown = operations
      .filter(op => op.count > 0)
      .map(op => {
        const totalInput = op.inputTokens * op.count;
        const totalOutput = op.outputTokens * op.count;
        const cost = estimateCost(totalInput, totalOutput, op.model);
        return {
          operation: op.name,
          model: op.model,
          calls: op.count,
          inputTokens: totalInput,
          outputTokens: totalOutput,
          cost: Math.round(cost * 100000) / 100000, // 5 decimal places
        };
      });

    const totalInputTokens = breakdown.reduce((s, b) => s + b.inputTokens, 0);
    const totalOutputTokens = breakdown.reduce((s, b) => s + b.outputTokens, 0);
    const totalCost = breakdown.reduce((s, b) => s + b.cost, 0);

    // Get historical average from similar presentations
    const historical = await getHistoricalAverage(pageCount, templateName);

    res.json({
      success: true,
      estimate: {
        breakdown,
        summary: {
          totalInputTokens,
          totalOutputTokens,
          totalTokens: totalInputTokens + totalOutputTokens,
          estimatedCost: Math.round(totalCost * 100000) / 100000,
          currency: 'USD',
          model: DEFAULT_GENERATION_CONFIG.model,
        },
        factors: {
          pageCount,
          contentSlides: Math.max(0, pageCount - 5),
          templateSlideCount,
          imageCount,
          topic: topic || null,
        },
        historical,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to estimate cost',
    });
  }
};

/**
 * Get historical average cost for similar presentations from DB.
 */
async function getHistoricalAverage(
  pageCount: number,
  templateName: string
): Promise<{
  avgCost: number | null;
  avgTokens: number | null;
  avgDuration: number | null;
  sampleSize: number;
} | null> {
  try {
    // Find similar presentations: same template or similar page count (±3)
    const similar = await prisma.presentation.aggregate({
      where: {
        status: 'completed',
        totalTokens: { not: null },
        estimatedCost: { not: null },
        OR: [
          { template: { name: { contains: templateName } } },
          {
            pageCount: {
              gte: Math.max(1, pageCount - 3),
              lte: pageCount + 3,
            },
          },
        ],
      },
      _avg: {
        estimatedCost: true,
        totalTokens: true,
        generationTime: true,
      },
      _count: true,
    });

    if (similar._count === 0) return null;

    return {
      avgCost: similar._avg.estimatedCost
        ? Math.round(similar._avg.estimatedCost * 100000) / 100000
        : null,
      avgTokens: similar._avg.totalTokens
        ? Math.round(similar._avg.totalTokens)
        : null,
      avgDuration: similar._avg.generationTime
        ? Math.round(similar._avg.generationTime / 1000) // seconds
        : null,
      sampleSize: similar._count,
    };
  } catch {
    return null;
  }
}
