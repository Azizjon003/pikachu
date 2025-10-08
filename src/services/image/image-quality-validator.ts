import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';

/**
 * Image Quality Validator
 *
 * Validates image quality using technical analysis (Sharp) and AI analysis (GPT-4o Vision).
 * Provides comprehensive quality scores, issue detection, and recommendations.
 */

export interface ImageQualityMetrics {
  resolution: {
    width: number;
    height: number;
    megapixels: number;
    dpi?: number;
    score: number;
  };
  format: {
    type: string;
    hasAlpha: boolean;
    isProgressive?: boolean;
    compression?: number;
    score: number;
  };
  fileSize: {
    bytes: number;
    kilobytes: number;
    megabytes: number;
    score: number;
  };
  aspectRatio: {
    ratio: number;
    label: string;
    isStandard: boolean;
    score: number;
  };
  colorSpace: {
    space: string;
    channels: number;
    depth?: string | number;
    score: number;
  };
  sharpness: {
    estimated: boolean;
    score: number;
  };
}

export interface AIQualityAnalysis {
  visualQuality: {
    clarity: number;
    lighting: number;
    composition: number;
    colorBalance: number;
    overallScore: number;
  };
  contentAnalysis: {
    subject: string;
    complexity: 'simple' | 'moderate' | 'complex';
    professionalismScore: number;
    emotions: string[];
    keywords: string[];
  };
  usabilityAssessment: {
    presentationReadiness: number;
    backgroundSuitability: number;
    textOverlaySuitability: number;
    printQuality: number;
  };
  aiReasoning: string;
}

export interface QualityIssue {
  severity: 'critical' | 'major' | 'minor' | 'warning';
  category: 'resolution' | 'format' | 'size' | 'quality' | 'content' | 'usability';
  message: string;
  impact: string;
  recommendation: string;
}

export interface QualityScore {
  overall: number;
  technical: number;
  visual: number;
  usability: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
}

export interface ValidationResult {
  isValid: boolean;
  passed: boolean;
  score: QualityScore;
  metrics: ImageQualityMetrics;
  aiAnalysis?: AIQualityAnalysis;
  issues: QualityIssue[];
  recommendations: string[];
  metadata: {
    filePath: string;
    fileName: string;
    validatedAt: Date;
    validationDuration: number;
  };
}

export interface BatchValidationResult {
  results: ValidationResult[];
  summary: {
    totalImages: number;
    passedCount: number;
    failedCount: number;
    averageScore: number;
    issueBreakdown: Record<string, number>;
    duration: number;
  };
}

export interface ValidationOptions {
  minResolution?: { width: number; height: number };
  maxFileSize?: number; // bytes
  allowedFormats?: string[];
  minQualityScore?: number;
  enableAIAnalysis?: boolean;
  strictMode?: boolean;
}

export class ImageQualityValidator {
  private openai?: OpenAI;
  private defaultOptions: Required<ValidationOptions> = {
    minResolution: { width: 800, height: 600 },
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ['jpeg', 'jpg', 'png', 'webp'],
    minQualityScore: 0.6,
    enableAIAnalysis: false,
    strictMode: false
  };

  constructor(openaiApiKey?: string) {
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Validate image quality
   */
  async validateImage(
    imagePath: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const opts = { ...this.defaultOptions, ...options };

    console.log(`🔍 Validating image: ${path.basename(imagePath)}`);

    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Load image with Sharp
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const stats = fs.statSync(imagePath);

      // Technical analysis
      const metrics = await this.analyzeTechnicalMetrics(image, metadata, stats.size);

      // AI analysis (if enabled and OpenAI available)
      let aiAnalysis: AIQualityAnalysis | undefined;
      if (opts.enableAIAnalysis && this.openai) {
        console.log('   Running AI visual analysis...');
        aiAnalysis = await this.analyzeWithAI(imagePath, metadata);
      }

      // Detect issues
      const issues = this.detectIssues(metrics, aiAnalysis, opts);

      // Calculate scores
      const score = this.calculateQualityScore(metrics, aiAnalysis);

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues, metrics, aiAnalysis);

      // Determine pass/fail
      const passed = this.determinePassFail(score, issues, opts);

      const duration = Date.now() - startTime;

      const result: ValidationResult = {
        isValid: passed,
        passed,
        score,
        metrics,
        aiAnalysis,
        issues,
        recommendations,
        metadata: {
          filePath: imagePath,
          fileName: path.basename(imagePath),
          validatedAt: new Date(),
          validationDuration: duration
        }
      };

      this.logValidationResult(result);

      return result;

    } catch (error) {
      console.error(`❌ Validation failed for ${imagePath}:`, error);

      const duration = Date.now() - startTime;

      return {
        isValid: false,
        passed: false,
        score: { overall: 0, technical: 0, visual: 0, usability: 0, grade: 'F' },
        metrics: this.getDefaultMetrics(),
        issues: [{
          severity: 'critical',
          category: 'quality',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          impact: 'Cannot process image',
          recommendation: 'Check if file is a valid image format'
        }],
        recommendations: ['Fix validation errors before using this image'],
        metadata: {
          filePath: imagePath,
          fileName: path.basename(imagePath),
          validatedAt: new Date(),
          validationDuration: duration
        }
      };
    }
  }

  /**
   * Analyze technical metrics using Sharp
   */
  private async analyzeTechnicalMetrics(
    image: sharp.Sharp,
    metadata: sharp.Metadata,
    fileSize: number
  ): Promise<ImageQualityMetrics> {
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const megapixels = (width * height) / 1000000;

    // Resolution scoring
    const resolutionScore = this.scoreResolution(width, height);

    // Format scoring
    const formatScore = this.scoreFormat(metadata.format || 'unknown', metadata.hasAlpha || false);

    // File size scoring
    const fileSizeScore = this.scoreFileSize(fileSize, width, height);

    // Aspect ratio analysis
    const aspectRatio = width / height;
    const aspectRatioInfo = this.analyzeAspectRatio(aspectRatio);

    // Color space scoring
    const colorSpaceScore = this.scoreColorSpace(metadata.space || 'unknown', metadata.channels || 3);

    // Sharpness estimation (basic)
    const sharpnessScore = 0.7; // Placeholder - would need actual sharpness detection

    return {
      resolution: {
        width,
        height,
        megapixels,
        dpi: metadata.density,
        score: resolutionScore
      },
      format: {
        type: metadata.format || 'unknown',
        hasAlpha: metadata.hasAlpha || false,
        isProgressive: metadata.isProgressive,
        score: formatScore
      },
      fileSize: {
        bytes: fileSize,
        kilobytes: fileSize / 1024,
        megabytes: fileSize / 1024 / 1024,
        score: fileSizeScore
      },
      aspectRatio: {
        ratio: aspectRatio,
        label: aspectRatioInfo.label,
        isStandard: aspectRatioInfo.isStandard,
        score: aspectRatioInfo.score
      },
      colorSpace: {
        space: metadata.space || 'unknown',
        channels: metadata.channels || 3,
        depth: metadata.depth as string | number | undefined,
        score: colorSpaceScore
      },
      sharpness: {
        estimated: true,
        score: sharpnessScore
      }
    };
  }

  /**
   * Score resolution quality
   */
  private scoreResolution(width: number, height: number): number {
    const pixels = width * height;

    if (pixels >= 1920 * 1080) return 1.0; // Full HD+
    if (pixels >= 1280 * 720) return 0.85; // HD
    if (pixels >= 800 * 600) return 0.7; // Standard
    if (pixels >= 640 * 480) return 0.5; // Low
    return 0.3; // Very low
  }

  /**
   * Score format quality
   */
  private scoreFormat(format: string, hasAlpha: boolean): number {
    let score = 0.5;

    switch (format.toLowerCase()) {
      case 'png':
        score = 0.95;
        break;
      case 'jpeg':
      case 'jpg':
        score = 0.85;
        break;
      case 'webp':
        score = 0.9;
        break;
      case 'gif':
        score = 0.6;
        break;
      case 'svg':
        score = 1.0;
        break;
      default:
        score = 0.4;
    }

    // Bonus for transparency support when needed
    if (hasAlpha && ['png', 'webp'].includes(format.toLowerCase())) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Score file size appropriateness
   */
  private scoreFileSize(fileSize: number, width: number, height: number): number {
    const pixels = width * height;
    const bytesPerPixel = fileSize / pixels;

    // Ideal: 0.5-3 bytes per pixel
    if (bytesPerPixel >= 0.5 && bytesPerPixel <= 3) return 1.0;
    if (bytesPerPixel < 0.5) return 0.7; // Over-compressed
    if (bytesPerPixel > 3 && bytesPerPixel <= 5) return 0.8; // Slightly large
    if (bytesPerPixel > 5 && bytesPerPixel <= 10) return 0.6; // Large
    return 0.4; // Too large or too small
  }

  /**
   * Analyze aspect ratio
   */
  private analyzeAspectRatio(ratio: number): { label: string; isStandard: boolean; score: number } {
    const ratios = [
      { name: '16:9', value: 16 / 9, tolerance: 0.05 },
      { name: '4:3', value: 4 / 3, tolerance: 0.05 },
      { name: '1:1', value: 1, tolerance: 0.05 },
      { name: '3:2', value: 3 / 2, tolerance: 0.05 },
      { name: '21:9', value: 21 / 9, tolerance: 0.05 }
    ];

    for (const standard of ratios) {
      if (Math.abs(ratio - standard.value) < standard.tolerance) {
        return { label: standard.name, isStandard: true, score: 1.0 };
      }
    }

    return { label: `${ratio.toFixed(2)}:1`, isStandard: false, score: 0.7 };
  }

  /**
   * Score color space
   */
  private scoreColorSpace(space: string, channels: number): number {
    if (space === 'srgb' && channels === 3) return 1.0;
    if (space === 'rgb' && channels === 3) return 0.95;
    if (channels === 4) return 0.9; // RGBA
    if (space === 'cmyk') return 0.8;
    return 0.6;
  }

  /**
   * Analyze image with AI (GPT-4o Vision)
   */
  private async analyzeWithAI(
    imagePath: string,
    metadata: sharp.Metadata
  ): Promise<AIQualityAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    try {
      // Convert image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = this.getMimeType(metadata.format || 'jpeg');

      const prompt = `Analyze this image for use in professional presentations. Rate the following aspects on a scale of 0-1:

1. Visual Quality:
   - Clarity (sharpness, focus)
   - Lighting (exposure, balance)
   - Composition (framing, rule of thirds)
   - Color balance (saturation, harmony)

2. Content Analysis:
   - Main subject description
   - Complexity level (simple/moderate/complex)
   - Professionalism score
   - Emotional tone/keywords

3. Usability Assessment:
   - Presentation readiness
   - Background suitability (can text be overlaid?)
   - Text overlay suitability
   - Print quality potential

Provide scores and reasoning in JSON format:
{
  "visualQuality": {
    "clarity": 0-1,
    "lighting": 0-1,
    "composition": 0-1,
    "colorBalance": 0-1,
    "overallScore": 0-1
  },
  "contentAnalysis": {
    "subject": "description",
    "complexity": "simple|moderate|complex",
    "professionalismScore": 0-1,
    "emotions": ["emotion1", "emotion2"],
    "keywords": ["keyword1", "keyword2"]
  },
  "usabilityAssessment": {
    "presentationReadiness": 0-1,
    "backgroundSuitability": 0-1,
    "textOverlaySuitability": 0-1,
    "printQuality": 0-1
  },
  "aiReasoning": "brief explanation of assessment"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const analysis: AIQualityAnalysis = JSON.parse(jsonMatch[0]);
      return analysis;

    } catch (error) {
      console.warn('AI analysis failed:', error);

      // Return default analysis
      return {
        visualQuality: {
          clarity: 0.7,
          lighting: 0.7,
          composition: 0.7,
          colorBalance: 0.7,
          overallScore: 0.7
        },
        contentAnalysis: {
          subject: 'Unknown',
          complexity: 'moderate',
          professionalismScore: 0.7,
          emotions: [],
          keywords: []
        },
        usabilityAssessment: {
          presentationReadiness: 0.7,
          backgroundSuitability: 0.7,
          textOverlaySuitability: 0.7,
          printQuality: 0.7
        },
        aiReasoning: 'AI analysis unavailable - using default scores'
      };
    }
  }

  /**
   * Get MIME type from format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'jpeg': 'image/jpeg',
      'jpg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'svg': 'image/svg+xml'
    };

    return mimeTypes[format.toLowerCase()] || 'image/jpeg';
  }

  /**
   * Detect quality issues
   */
  private detectIssues(
    metrics: ImageQualityMetrics,
    aiAnalysis: AIQualityAnalysis | undefined,
    options: Required<ValidationOptions>
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Resolution issues
    if (metrics.resolution.width < options.minResolution.width ||
        metrics.resolution.height < options.minResolution.height) {
      issues.push({
        severity: 'critical',
        category: 'resolution',
        message: `Image resolution too low: ${metrics.resolution.width}x${metrics.resolution.height}`,
        impact: 'May appear pixelated or blurry in presentations',
        recommendation: `Use images with minimum ${options.minResolution.width}x${options.minResolution.height} resolution`
      });
    } else if (metrics.resolution.score < 0.7) {
      issues.push({
        severity: 'warning',
        category: 'resolution',
        message: 'Resolution is below optimal',
        impact: 'May not look sharp on large displays',
        recommendation: 'Consider using higher resolution images (1920x1080 or higher)'
      });
    }

    // File size issues
    if (metrics.fileSize.bytes > options.maxFileSize) {
      issues.push({
        severity: 'major',
        category: 'size',
        message: `File size too large: ${metrics.fileSize.megabytes.toFixed(2)} MB`,
        impact: 'Will increase presentation file size and load time',
        recommendation: `Compress image to under ${(options.maxFileSize / 1024 / 1024).toFixed(1)} MB`
      });
    } else if (metrics.fileSize.score < 0.6) {
      issues.push({
        severity: 'minor',
        category: 'size',
        message: 'File size not optimal',
        impact: 'Either over-compressed or unnecessarily large',
        recommendation: 'Adjust compression settings for better balance'
      });
    }

    // Format issues
    if (!options.allowedFormats.includes(metrics.format.type.toLowerCase())) {
      issues.push({
        severity: 'major',
        category: 'format',
        message: `Unsupported format: ${metrics.format.type}`,
        impact: 'May not display correctly in all viewers',
        recommendation: `Convert to supported format: ${options.allowedFormats.join(', ')}`
      });
    }

    // Aspect ratio issues
    if (!metrics.aspectRatio.isStandard) {
      issues.push({
        severity: 'minor',
        category: 'quality',
        message: `Non-standard aspect ratio: ${metrics.aspectRatio.label}`,
        impact: 'May not fit well in standard layouts',
        recommendation: 'Crop to standard aspect ratio (16:9, 4:3, or 1:1)'
      });
    }

    // AI-detected issues
    if (aiAnalysis) {
      if (aiAnalysis.visualQuality.overallScore < 0.6) {
        issues.push({
          severity: 'major',
          category: 'quality',
          message: 'Visual quality below acceptable level',
          impact: 'Poor visual impression on audience',
          recommendation: 'Use higher quality images with better lighting and composition'
        });
      }

      if (aiAnalysis.usabilityAssessment.presentationReadiness < 0.6) {
        issues.push({
          severity: 'major',
          category: 'usability',
          message: 'Not suitable for presentation use',
          impact: 'May not convey intended message effectively',
          recommendation: aiAnalysis.aiReasoning
        });
      }

      if (aiAnalysis.usabilityAssessment.textOverlaySuitability < 0.5) {
        issues.push({
          severity: 'warning',
          category: 'usability',
          message: 'Poor text overlay suitability',
          impact: 'Text may be hard to read if overlaid on this image',
          recommendation: 'Choose images with clearer backgrounds or add text boxes'
        });
      }
    }

    return issues;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    metrics: ImageQualityMetrics,
    aiAnalysis: AIQualityAnalysis | undefined
  ): QualityScore {
    // Technical score (from metrics)
    const technical = (
      metrics.resolution.score * 0.3 +
      metrics.format.score * 0.2 +
      metrics.fileSize.score * 0.2 +
      metrics.aspectRatio.score * 0.15 +
      metrics.colorSpace.score * 0.15
    );

    // Visual score (from AI or default)
    const visual = aiAnalysis?.visualQuality.overallScore || 0.7;

    // Usability score (from AI or default)
    const usability = aiAnalysis ? (
      aiAnalysis.usabilityAssessment.presentationReadiness * 0.4 +
      aiAnalysis.usabilityAssessment.backgroundSuitability * 0.3 +
      aiAnalysis.usabilityAssessment.textOverlaySuitability * 0.2 +
      aiAnalysis.usabilityAssessment.printQuality * 0.1
    ) : 0.7;

    // Overall score
    const overall = (technical * 0.4 + visual * 0.35 + usability * 0.25);

    // Determine grade
    let grade: QualityScore['grade'];
    if (overall >= 0.95) grade = 'A+';
    else if (overall >= 0.85) grade = 'A';
    else if (overall >= 0.80) grade = 'B+';
    else if (overall >= 0.70) grade = 'B';
    else if (overall >= 0.60) grade = 'C';
    else if (overall >= 0.50) grade = 'D';
    else grade = 'F';

    return { overall, technical, visual, usability, grade };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    issues: QualityIssue[],
    metrics: ImageQualityMetrics,
    aiAnalysis: AIQualityAnalysis | undefined
  ): string[] {
    const recommendations: string[] = [];

    // From issues
    issues.forEach(issue => {
      if (!recommendations.includes(issue.recommendation)) {
        recommendations.push(issue.recommendation);
      }
    });

    // General best practices
    if (metrics.resolution.megapixels < 2) {
      recommendations.push('Use images with at least 2 megapixels for presentations');
    }

    if (metrics.format.type !== 'png' && metrics.format.type !== 'webp') {
      recommendations.push('Consider PNG or WebP formats for better quality');
    }

    if (aiAnalysis && aiAnalysis.contentAnalysis.professionalismScore < 0.7) {
      recommendations.push('Choose more professional-looking images for business presentations');
    }

    if (recommendations.length === 0) {
      recommendations.push('Image meets all quality standards - ready for use');
    }

    return recommendations;
  }

  /**
   * Determine pass/fail
   */
  private determinePassFail(
    score: QualityScore,
    issues: QualityIssue[],
    options: Required<ValidationOptions>
  ): boolean {
    // Check score threshold
    if (score.overall < options.minQualityScore) {
      return false;
    }

    // Check for critical issues
    const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
    if (hasCriticalIssues) {
      return false;
    }

    // Strict mode: check for major issues
    if (options.strictMode) {
      const hasMajorIssues = issues.some(issue => issue.severity === 'major');
      if (hasMajorIssues) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get default metrics (for error cases)
   */
  private getDefaultMetrics(): ImageQualityMetrics {
    return {
      resolution: { width: 0, height: 0, megapixels: 0, score: 0 },
      format: { type: 'unknown', hasAlpha: false, score: 0 },
      fileSize: { bytes: 0, kilobytes: 0, megabytes: 0, score: 0 },
      aspectRatio: { ratio: 0, label: 'unknown', isStandard: false, score: 0 },
      colorSpace: { space: 'unknown', channels: 0, score: 0 },
      sharpness: { estimated: true, score: 0 }
    };
  }

  /**
   * Log validation result
   */
  private logValidationResult(result: ValidationResult): void {
    console.log(`\n📋 Validation Result: ${result.metadata.fileName}`);
    console.log('═══════════════════════════════════════');
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Grade: ${result.score.grade} (${(result.score.overall * 100).toFixed(1)}%)`);
    console.log(`  Technical: ${(result.score.technical * 100).toFixed(1)}%`);
    console.log(`  Visual: ${(result.score.visual * 100).toFixed(1)}%`);
    console.log(`  Usability: ${(result.score.usability * 100).toFixed(1)}%`);

    if (result.issues.length > 0) {
      console.log(`\n⚠️  Issues Found: ${result.issues.length}`);
      result.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      });
    }

    if (result.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      result.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    console.log(`\nValidation took ${result.metadata.validationDuration}ms`);
    console.log('═══════════════════════════════════════\n');
  }

  /**
   * Batch validate multiple images
   */
  async validateBatch(
    imagePaths: string[],
    options: ValidationOptions = {}
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();

    console.log(`📦 Starting batch validation of ${imagePaths.length} images`);

    const results: ValidationResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let totalScore = 0;
    const issueBreakdown: Record<string, number> = {};

    for (const imagePath of imagePaths) {
      const result = await this.validateImage(imagePath, options);
      results.push(result);

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }

      totalScore += result.score.overall;

      // Count issues by severity
      result.issues.forEach(issue => {
        issueBreakdown[issue.severity] = (issueBreakdown[issue.severity] || 0) + 1;
      });
    }

    const duration = Date.now() - startTime;
    const averageScore = totalScore / imagePaths.length;

    const summary = {
      totalImages: imagePaths.length,
      passedCount,
      failedCount,
      averageScore,
      issueBreakdown,
      duration
    };

    console.log(`\n📊 Batch Validation Summary:`);
    console.log('═══════════════════════════════════════');
    console.log(`Total Images: ${summary.totalImages}`);
    console.log(`Passed: ${summary.passedCount} (${((passedCount / imagePaths.length) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${summary.failedCount} (${((failedCount / imagePaths.length) * 100).toFixed(1)}%)`);
    console.log(`Average Score: ${(summary.averageScore * 100).toFixed(1)}%`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);

    if (Object.keys(issueBreakdown).length > 0) {
      console.log(`\nIssue Breakdown:`);
      Object.entries(issueBreakdown).forEach(([severity, count]) => {
        console.log(`  ${severity}: ${count}`);
      });
    }
    console.log('═══════════════════════════════════════\n');

    return { results, summary };
  }

  /**
   * Quick validation (technical only, no AI)
   */
  async quickValidate(imagePath: string): Promise<boolean> {
    const result = await this.validateImage(imagePath, {
      enableAIAnalysis: false,
      strictMode: false
    });

    return result.passed;
  }

  /**
   * Export validation report to JSON
   */
  exportReport(result: ValidationResult | BatchValidationResult, outputPath: string): void {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📄 Validation report exported to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to export report:', error);
      throw error;
    }
  }
}

export default ImageQualityValidator;
