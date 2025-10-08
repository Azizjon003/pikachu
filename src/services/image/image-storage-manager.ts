import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';

/**
 * Image Storage Manager
 *
 * Manages template-specific image storage with intelligent organization,
 * metadata tracking, and advanced storage operations.
 *
 * Storage Structure: images/{templateName}/images/{filename}
 */

export interface ImageMetadata {
  filename: string;
  originalUrl: string;
  downloadedAt: Date;
  fileSize: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  hash: string;
  templateName: string;
  slideIndex?: number;
  elementType?: string;
  tags?: string[];
  searchQuery?: string;
  aiReasoning?: string;
}

export interface StorageStats {
  totalImages: number;
  totalSize: number;
  averageSize: number;
  formatDistribution: Record<string, number>;
  oldestImage?: Date;
  newestImage?: Date;
  duplicateCount: number;
  templateCount: number;
}

export interface DownloadResult {
  success: boolean;
  filename?: string;
  localPath?: string;
  metadata?: ImageMetadata;
  error?: string;
  skipReason?: string;
}

export interface BatchDownloadResult {
  successful: DownloadResult[];
  failed: DownloadResult[];
  duplicates: DownloadResult[];
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
  totalDuplicates: number;
  duration: number;
}

export interface CleanupOptions {
  olderThan?: Date;
  smallerThan?: number;
  formats?: string[];
  templateName?: string;
  dryRun?: boolean;
}

export interface CleanupResult {
  deletedFiles: string[];
  freedSpace: number;
  remainingFiles: number;
  errors: Array<{ file: string; error: string }>;
}

export class ImageStorageManager {
  private baseStoragePath: string;
  private metadataCache: Map<string, ImageMetadata>;
  private readonly METADATA_FILE = 'metadata.json';
  private readonly MAX_FILENAME_LENGTH = 200;
  private readonly ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];

  constructor(baseStoragePath: string = './storage/images') {
    this.baseStoragePath = path.resolve(baseStoragePath);
    this.metadataCache = new Map();
    this.initializeStorage();
  }

  /**
   * Initialize storage directory structure
   */
  private initializeStorage(): void {
    try {
      if (!fs.existsSync(this.baseStoragePath)) {
        fs.mkdirSync(this.baseStoragePath, { recursive: true });
        console.log(`📁 Created base storage directory: ${this.baseStoragePath}`);
      }
      console.log(`✓ Image storage initialized at: ${this.baseStoragePath}`);
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
      throw new Error(`Storage initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get template-specific storage path
   */
  private getTemplatePath(templateName: string): string {
    const sanitizedName = this.sanitizeFilename(templateName);
    return path.join(this.baseStoragePath, sanitizedName, 'images');
  }

  /**
   * Get metadata file path for template
   */
  private getMetadataPath(templateName: string): string {
    const sanitizedName = this.sanitizeFilename(templateName);
    return path.join(this.baseStoragePath, sanitizedName, this.METADATA_FILE);
  }

  /**
   * Ensure template directory exists
   */
  private ensureTemplateDirectory(templateName: string): void {
    const templatePath = this.getTemplatePath(templateName);
    if (!fs.existsSync(templatePath)) {
      fs.mkdirSync(templatePath, { recursive: true });
      console.log(`📁 Created template directory: ${templatePath}`);
    }
  }

  /**
   * Generate unique filename using MD5 hash
   */
  private generateUniqueFilename(url: string, originalExtension?: string): string {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    const ext = originalExtension || this.extractExtensionFromUrl(url) || 'jpg';
    return `${hash}.${ext}`;
  }

  /**
   * Extract file extension from URL
   */
  private extractExtensionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname).toLowerCase().replace('.', '');

      if (this.ALLOWED_FORMATS.includes(ext)) {
        return ext;
      }

      // Try to get from query parameters
      const format = urlObj.searchParams.get('format') || urlObj.searchParams.get('fmt');
      if (format && this.ALLOWED_FORMATS.includes(format.toLowerCase())) {
        return format.toLowerCase();
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, this.MAX_FILENAME_LENGTH);
  }

  /**
   * Calculate MD5 hash of file content
   */
  private calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Download image from URL with error handling and retries
   */
  async downloadImage(
    url: string,
    templateName: string,
    options: {
      slideIndex?: number;
      elementType?: string;
      tags?: string[];
      searchQuery?: string;
      aiReasoning?: string;
      forceDownload?: boolean;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Promise<DownloadResult> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    const timeout = options.timeout || 30000;

    console.log(`📥 Downloading image from: ${url}`);
    console.log(`   Template: ${templateName}`);

    try {
      // Ensure directory exists
      this.ensureTemplateDirectory(templateName);

      // Check for duplicates
      if (!options.forceDownload) {
        const existingMetadata = await this.findImageByUrl(url, templateName);
        if (existingMetadata) {
          console.log(`⏭️  Image already exists: ${existingMetadata.filename}`);
          return {
            success: true,
            filename: existingMetadata.filename,
            localPath: path.join(this.getTemplatePath(templateName), existingMetadata.filename),
            metadata: existingMetadata,
            skipReason: 'duplicate'
          };
        }
      }

      // Download with retries
      let lastError: Error | null = null;
      let response: any = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/${maxRetries}...`);

          response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: timeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5
          });

          break; // Success
        } catch (error) {
          lastError = error as Error;
          console.warn(`   Attempt ${attempt} failed:`, error instanceof Error ? error.message : 'Unknown error');

          if (attempt < maxRetries) {
            await this.delay(1000 * attempt); // Exponential backoff
          }
        }
      }

      if (!response) {
        throw lastError || new Error('Download failed after retries');
      }

      const imageBuffer = Buffer.from(response.data);

      // Get image metadata using Sharp
      const sharpImage = sharp(imageBuffer);
      const imageInfo = await sharpImage.metadata();

      if (!imageInfo.width || !imageInfo.height || !imageInfo.format) {
        throw new Error('Invalid image: missing dimensions or format');
      }

      // Generate unique filename
      const filename = this.generateUniqueFilename(url, imageInfo.format);
      const localPath = path.join(this.getTemplatePath(templateName), filename);

      // Save image file
      await sharpImage.toFile(localPath);

      // Calculate file hash
      const fileHash = this.calculateFileHash(localPath);

      // Create metadata
      const metadata: ImageMetadata = {
        filename,
        originalUrl: url,
        downloadedAt: new Date(),
        fileSize: imageBuffer.length,
        dimensions: {
          width: imageInfo.width,
          height: imageInfo.height
        },
        format: imageInfo.format,
        hash: fileHash,
        templateName,
        slideIndex: options.slideIndex,
        elementType: options.elementType,
        tags: options.tags,
        searchQuery: options.searchQuery,
        aiReasoning: options.aiReasoning
      };

      // Save metadata
      await this.saveMetadata(templateName, metadata);

      const duration = Date.now() - startTime;
      console.log(`✅ Image downloaded successfully: ${filename}`);
      console.log(`   Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Dimensions: ${imageInfo.width}x${imageInfo.height}`);
      console.log(`   Duration: ${duration}ms`);

      return {
        success: true,
        filename,
        localPath,
        metadata
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Download failed for ${url}:`, errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Batch download multiple images
   */
  async downloadBatch(
    images: Array<{
      url: string;
      slideIndex?: number;
      elementType?: string;
      tags?: string[];
      searchQuery?: string;
      aiReasoning?: string;
    }>,
    templateName: string,
    options: {
      concurrency?: number;
      forceDownload?: boolean;
      onProgress?: (current: number, total: number, result: DownloadResult) => void;
    } = {}
  ): Promise<BatchDownloadResult> {
    const startTime = Date.now();
    const concurrency = options.concurrency || 3;

    console.log(`📦 Starting batch download of ${images.length} images`);
    console.log(`   Concurrency: ${concurrency}`);

    const results: BatchDownloadResult = {
      successful: [],
      failed: [],
      duplicates: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalDuplicates: 0,
      duration: 0
    };

    // Process in batches with concurrency control
    for (let i = 0; i < images.length; i += concurrency) {
      const batch = images.slice(i, i + concurrency);

      const batchPromises = batch.map(async (image) => {
        const result = await this.downloadImage(image.url, templateName, {
          ...image,
          forceDownload: options.forceDownload
        });

        results.totalProcessed++;

        if (result.success) {
          if (result.skipReason === 'duplicate') {
            results.duplicates.push(result);
            results.totalDuplicates++;
          } else {
            results.successful.push(result);
            results.totalSuccess++;
          }
        } else {
          results.failed.push(result);
          results.totalFailed++;
        }

        if (options.onProgress) {
          options.onProgress(results.totalProcessed, images.length, result);
        }

        return result;
      });

      await Promise.all(batchPromises);
    }

    results.duration = Date.now() - startTime;

    console.log(`📊 Batch download complete:`);
    console.log(`   Successful: ${results.totalSuccess}`);
    console.log(`   Duplicates: ${results.totalDuplicates}`);
    console.log(`   Failed: ${results.totalFailed}`);
    console.log(`   Duration: ${(results.duration / 1000).toFixed(2)}s`);

    return results;
  }

  /**
   * Save metadata to JSON file
   */
  private async saveMetadata(templateName: string, metadata: ImageMetadata): Promise<void> {
    try {
      const metadataPath = this.getMetadataPath(templateName);
      const existingMetadata = await this.loadAllMetadata(templateName);

      // Add or update metadata
      const metadataArray = existingMetadata.filter(m => m.filename !== metadata.filename);
      metadataArray.push(metadata);

      // Save to file
      fs.writeFileSync(metadataPath, JSON.stringify(metadataArray, null, 2), 'utf-8');

      // Update cache
      const cacheKey = `${templateName}:${metadata.filename}`;
      this.metadataCache.set(cacheKey, metadata);

      console.log(`💾 Metadata saved for: ${metadata.filename}`);
    } catch (error) {
      console.error('❌ Failed to save metadata:', error);
      throw error;
    }
  }

  /**
   * Load all metadata for a template
   */
  async loadAllMetadata(templateName: string): Promise<ImageMetadata[]> {
    try {
      const metadataPath = this.getMetadataPath(templateName);

      if (!fs.existsSync(metadataPath)) {
        return [];
      }

      const data = fs.readFileSync(metadataPath, 'utf-8');
      const metadata: ImageMetadata[] = JSON.parse(data);

      // Update cache
      metadata.forEach(m => {
        const cacheKey = `${templateName}:${m.filename}`;
        this.metadataCache.set(cacheKey, m);
      });

      return metadata;
    } catch (error) {
      console.error('❌ Failed to load metadata:', error);
      return [];
    }
  }

  /**
   * Find image by URL
   */
  async findImageByUrl(url: string, templateName: string): Promise<ImageMetadata | null> {
    const allMetadata = await this.loadAllMetadata(templateName);
    return allMetadata.find(m => m.originalUrl === url) || null;
  }

  /**
   * Find image by hash (detect duplicates)
   */
  async findImageByHash(hash: string, templateName: string): Promise<ImageMetadata | null> {
    const allMetadata = await this.loadAllMetadata(templateName);
    return allMetadata.find(m => m.hash === hash) || null;
  }

  /**
   * Get image local path
   */
  getImagePath(filename: string, templateName: string): string {
    return path.join(this.getTemplatePath(templateName), filename);
  }

  /**
   * Check if image exists
   */
  imageExists(filename: string, templateName: string): boolean {
    const imagePath = this.getImagePath(filename, templateName);
    return fs.existsSync(imagePath);
  }

  /**
   * Delete image and its metadata
   */
  async deleteImage(filename: string, templateName: string): Promise<boolean> {
    try {
      const imagePath = this.getImagePath(filename, templateName);

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️  Deleted image: ${filename}`);
      }

      // Remove from metadata
      const allMetadata = await this.loadAllMetadata(templateName);
      const updatedMetadata = allMetadata.filter(m => m.filename !== filename);

      const metadataPath = this.getMetadataPath(templateName);
      fs.writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf-8');

      // Remove from cache
      const cacheKey = `${templateName}:${filename}`;
      this.metadataCache.delete(cacheKey);

      return true;
    } catch (error) {
      console.error(`❌ Failed to delete image ${filename}:`, error);
      return false;
    }
  }

  /**
   * Cleanup old or unused images
   */
  async cleanup(options: CleanupOptions): Promise<CleanupResult> {
    console.log('🧹 Starting cleanup operation...');

    const result: CleanupResult = {
      deletedFiles: [],
      freedSpace: 0,
      remainingFiles: 0,
      errors: []
    };

    try {
      const templates = options.templateName
        ? [options.templateName]
        : this.getAllTemplates();

      for (const templateName of templates) {
        const allMetadata = await this.loadAllMetadata(templateName);

        for (const metadata of allMetadata) {
          let shouldDelete = false;

          // Check age
          if (options.olderThan && new Date(metadata.downloadedAt) < options.olderThan) {
            shouldDelete = true;
          }

          // Check size
          if (options.smallerThan && metadata.fileSize < options.smallerThan) {
            shouldDelete = true;
          }

          // Check format
          if (options.formats && options.formats.includes(metadata.format)) {
            shouldDelete = true;
          }

          if (shouldDelete) {
            if (options.dryRun) {
              console.log(`   Would delete: ${metadata.filename} (${(metadata.fileSize / 1024).toFixed(2)} KB)`);
              result.deletedFiles.push(metadata.filename);
              result.freedSpace += metadata.fileSize;
            } else {
              const success = await this.deleteImage(metadata.filename, templateName);
              if (success) {
                result.deletedFiles.push(metadata.filename);
                result.freedSpace += metadata.fileSize;
              } else {
                result.errors.push({
                  file: metadata.filename,
                  error: 'Failed to delete'
                });
              }
            }
          } else {
            result.remainingFiles++;
          }
        }
      }

      console.log(`✅ Cleanup complete:`);
      console.log(`   Deleted: ${result.deletedFiles.length} files`);
      console.log(`   Freed: ${(result.freedSpace / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Remaining: ${result.remainingFiles} files`);
      if (options.dryRun) {
        console.log(`   (DRY RUN - no files actually deleted)`);
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }

    return result;
  }

  /**
   * Get storage statistics
   */
  async getStatistics(templateName?: string): Promise<StorageStats> {
    const templates = templateName ? [templateName] : this.getAllTemplates();

    const stats: StorageStats = {
      totalImages: 0,
      totalSize: 0,
      averageSize: 0,
      formatDistribution: {},
      duplicateCount: 0,
      templateCount: templates.length
    };

    const seenHashes = new Set<string>();
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    for (const template of templates) {
      const metadata = await this.loadAllMetadata(template);

      for (const image of metadata) {
        stats.totalImages++;
        stats.totalSize += image.fileSize;

        // Format distribution
        stats.formatDistribution[image.format] = (stats.formatDistribution[image.format] || 0) + 1;

        // Check for duplicates
        if (seenHashes.has(image.hash)) {
          stats.duplicateCount++;
        } else {
          seenHashes.add(image.hash);
        }

        // Track dates
        const downloadDate = new Date(image.downloadedAt);
        if (!oldestDate || downloadDate < oldestDate) {
          oldestDate = downloadDate;
        }
        if (!newestDate || downloadDate > newestDate) {
          newestDate = downloadDate;
        }
      }
    }

    stats.averageSize = stats.totalImages > 0 ? stats.totalSize / stats.totalImages : 0;
    stats.oldestImage = oldestDate;
    stats.newestImage = newestDate;

    return stats;
  }

  /**
   * Get all template names
   */
  getAllTemplates(): string[] {
    try {
      if (!fs.existsSync(this.baseStoragePath)) {
        return [];
      }

      const entries = fs.readdirSync(this.baseStoragePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (error) {
      console.error('❌ Failed to get templates:', error);
      return [];
    }
  }

  /**
   * Export metadata to JSON file
   */
  async exportMetadata(templateName: string, outputPath: string): Promise<void> {
    try {
      const metadata = await this.loadAllMetadata(templateName);
      fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), 'utf-8');
      console.log(`📤 Metadata exported to: ${outputPath}`);
    } catch (error) {
      console.error('❌ Failed to export metadata:', error);
      throw error;
    }
  }

  /**
   * Import metadata from JSON file
   */
  async importMetadata(templateName: string, inputPath: string): Promise<void> {
    try {
      const data = fs.readFileSync(inputPath, 'utf-8');
      const metadata: ImageMetadata[] = JSON.parse(data);

      const metadataPath = this.getMetadataPath(templateName);
      this.ensureTemplateDirectory(templateName);

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      console.log(`📥 Metadata imported from: ${inputPath}`);
    } catch (error) {
      console.error('❌ Failed to import metadata:', error);
      throw error;
    }
  }

  /**
   * Utility: Delay for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print storage summary
   */
  async printStorageSummary(templateName?: string): Promise<void> {
    const stats = await this.getStatistics(templateName);

    console.log('\n📊 Storage Statistics:');
    console.log('═══════════════════════════════════════');
    console.log(`Total Images: ${stats.totalImages}`);
    console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average Size: ${(stats.averageSize / 1024).toFixed(2)} KB`);
    console.log(`Templates: ${stats.templateCount}`);
    console.log(`Duplicates: ${stats.duplicateCount}`);

    if (stats.oldestImage) {
      console.log(`Oldest Image: ${stats.oldestImage.toISOString()}`);
    }
    if (stats.newestImage) {
      console.log(`Newest Image: ${stats.newestImage.toISOString()}`);
    }

    console.log('\nFormat Distribution:');
    Object.entries(stats.formatDistribution).forEach(([format, count]) => {
      console.log(`  ${format}: ${count} (${((count / stats.totalImages) * 100).toFixed(1)}%)`);
    });
    console.log('═══════════════════════════════════════\n');
  }
}

export default ImageStorageManager;
