import { Request, Response } from 'express';
import IntegratedAIImageService from '@/src/services/image/integrated-ai-image-service';
import path from 'path';
import fs from 'fs';

let imageService: IntegratedAIImageService | null = null;

/**
 * Initialize the image service
 */
function getImageService(): IntegratedAIImageService {
  if (!imageService) {
    imageService = new IntegratedAIImageService(
      process.env.OPENAI_API_KEY,
      process.env.BING_API_KEY,
      path.join(process.cwd(), 'images')
    );
  }
  return imageService;
}

/**
 * Generate image for a single slide
 * POST /api/images/generate
 */
export const generateSlideImage = async (req: Request, res: Response) => {
  try {
    const {
      slideTitle,
      slideContent,
      slideIndex,
      elementType,
      templateName,
      presentationTitle,
      presentationTheme,
      desiredStyle,
      colorScheme
    } = req.body;

    // Validation
    if (!slideTitle || !slideContent || slideIndex === undefined || !elementType || !templateName || !presentationTitle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slideTitle, slideContent, slideIndex, elementType, templateName, presentationTitle'
      });
    }

    const service = getImageService();

    const result = await service.findAndDownloadImage({
      slideTitle,
      slideContent,
      slideIndex,
      elementType,
      templateName,
      presentationTitle,
      presentationTheme,
      desiredStyle,
      colorScheme
    });

    if (result.success) {
      res.json({
        success: true,
        result: {
          imageUrl: result.imageUrl,
          localPath: result.localPath,
          confidence: result.confidence,
          aiReasoning: result.aiReasoning,
          alternatives: result.alternatives,
          metadata: result.metadata,
          validationResult: result.validationResult ? {
            isValid: result.validationResult.isValid,
            overallScore: result.validationResult.overallScore,
            grade: result.validationResult.grade,
            issues: result.validationResult.issues.map(i => ({
              severity: i.severity,
              category: i.category,
              description: i.description
            }))
          } : null,
          processingTime: result.processingTime
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate image',
        aiReasoning: result.aiReasoning
      });
    }

  } catch (error) {
    console.error('Error generating slide image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Generate images for multiple slides (batch)
 * POST /api/images/generate-batch
 */
export const generateBatchImages = async (req: Request, res: Response) => {
  try {
    const {
      templateName,
      presentationTitle,
      presentationTheme,
      slides
    } = req.body;

    // Validation
    if (!templateName || !presentationTitle || !slides || !Array.isArray(slides)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: templateName, presentationTitle, slides (array)'
      });
    }

    const service = getImageService();

    const batchResult = await service.processBatchImages({
      templateName,
      presentationTitle,
      presentationTheme,
      slides
    });

    res.json({
      success: true,
      result: {
        totalSlides: batchResult.totalSlides,
        successfulCount: batchResult.successfulCount,
        failedCount: batchResult.failedCount,
        averageConfidence: batchResult.averageConfidence,
        totalProcessingTime: batchResult.totalProcessingTime,
        results: batchResult.results.map(r => ({
          success: r.success,
          imageUrl: r.imageUrl,
          localPath: r.localPath,
          confidence: r.confidence,
          error: r.error,
          processingTime: r.processingTime
        }))
      }
    });

  } catch (error) {
    console.error('Error generating batch images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Search image by keyword (simple search)
 * POST /api/images/search
 */
export const searchImageByKeyword = async (req: Request, res: Response) => {
  try {
    const { keyword, templateName, slideIndex } = req.body;

    if (!keyword || !templateName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: keyword, templateName'
      });
    }

    const service = getImageService();

    const result = await service.findImageByKeyword(
      keyword,
      templateName,
      slideIndex || 0
    );

    if (result.success) {
      res.json({
        success: true,
        result: {
          imageUrl: result.imageUrl,
          localPath: result.localPath,
          confidence: result.confidence,
          alternatives: result.alternatives,
          processingTime: result.processingTime
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Image search failed'
      });
    }

  } catch (error) {
    console.error('Error searching image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all images for a template
 * GET /api/images/template/:templateName
 */
export const getTemplateImages = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const service = getImageService();
    const images = await service.getTemplateImages(templateName);

    res.json({
      success: true,
      templateName,
      totalImages: images.length,
      images: images.map(img => ({
        filename: img.filename,
        localPath: img.localPath,
        originalUrl: img.originalUrl,
        slideIndex: img.slideIndex,
        elementType: img.elementType,
        searchQuery: img.searchQuery,
        dimensions: img.dimensions,
        fileSize: img.fileSize,
        format: img.format,
        downloadedAt: img.downloadedAt,
        aiScore: img.aiScore,
        validationScore: img.validationScore
      }))
    });

  } catch (error) {
    console.error('Error getting template images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get template statistics
 * GET /api/images/stats/:templateName
 */
export const getTemplateStats = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const service = getImageService();
    const stats = await service.getTemplateStats(templateName);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting template stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Cleanup template images
 * POST /api/images/cleanup/:templateName
 */
export const cleanupTemplateImages = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;
    const { olderThanDays, keepLatest, minQualityScore } = req.body;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const service = getImageService();
    const result = await service.cleanupTemplateImages(templateName, {
      olderThanDays,
      keepLatest,
      minQualityScore
    });

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error cleaning up images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete all images for a template
 * DELETE /api/images/template/:templateName
 */
export const deleteTemplateImages = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const service = getImageService();
    await service.deleteTemplateImages(templateName);

    res.json({
      success: true,
      message: `All images for template "${templateName}" have been deleted`
    });

  } catch (error) {
    console.error('Error deleting template images:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Validate an image URL
 * POST /api/images/validate
 */
export const validateImage = async (req: Request, res: Response) => {
  try {
    const { imageUrl, context } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'imageUrl is required'
      });
    }

    const service = getImageService();
    const validationResult = await service.validateExistingImage(imageUrl, context);

    res.json({
      success: true,
      validation: {
        isValid: validationResult.isValid,
        overallScore: validationResult.overallScore,
        grade: validationResult.grade,
        scores: validationResult.scores,
        issues: validationResult.issues,
        recommendations: validationResult.recommendations,
        metadata: validationResult.metadata
      }
    });

  } catch (error) {
    console.error('Error validating image:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get service statistics
 * GET /api/images/service/stats
 */
export const getServiceStats = async (req: Request, res: Response) => {
  try {
    const service = getImageService();
    const stats = service.getServiceStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting service stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Export template metadata
 * GET /api/images/export/:templateName
 */
export const exportTemplateMetadata = async (req: Request, res: Response) => {
  try {
    const { templateName } = req.params;

    if (!templateName) {
      return res.status(400).json({
        success: false,
        error: 'Template name is required'
      });
    }

    const service = getImageService();
    const metadata = await service.exportTemplateMetadata(templateName);

    res.json({
      success: true,
      templateName,
      metadata
    });

  } catch (error) {
    console.error('Error exporting metadata:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};