/**
 * Usage Examples for Image Replacer Service
 *
 * This file demonstrates how to integrate the Image Replacer Service
 * into your main application workflow.
 */

import ImageReplacerService from './image-replacer';

// ============================================================
// Example 1: Simple - Replace all edited images
// ============================================================

export async function replaceAllEditedImages() {
  const replacer = new ImageReplacerService();

  try {
    const results = await replacer.replaceEditedImages();

    console.log(`\nImage Replacement Complete:`);
    console.log(`  Total: ${results.total}`);
    console.log(`  Success: ${results.successful}`);
    console.log(`  Failed: ${results.failed}`);

    return results;
  } catch (error) {
    console.error('Error replacing images:', error);
    throw error;
  }
}

// ============================================================
// Example 2: Replace with custom configuration
// ============================================================

export async function replaceImagesCustomConfig() {
  const replacer = new ImageReplacerService(
    './Amir.sxema.json',      // Custom schema path
    './custom-images',         // Custom image directory
    true                       // Enable verbose logging
  );

  const results = await replacer.replaceEditedImages();
  return results;
}

// ============================================================
// Example 3: Replace a specific image
// ============================================================

export async function replaceSingleImage(
  slideNumber: number,
  elementIndex: number,
  keyword?: string
) {
  const replacer = new ImageReplacerService();

  const success = await replacer.replaceImageByIndex(
    slideNumber,
    elementIndex,
    keyword
  );

  if (success) {
    console.log(`✓ Image on slide ${slideNumber} replaced successfully`);
  } else {
    console.log(`✗ Failed to replace image on slide ${slideNumber}`);
  }

  return success;
}

// ============================================================
// Example 4: Integration with presentation generation workflow
// ============================================================

export async function generatePresentationWithImageReplacement() {
  console.log('Step 1: Generate presentation schema...');
  // Your existing presentation generation code here

  console.log('Step 2: Replace edited images...');
  const replacer = new ImageReplacerService();
  const results = await replacer.replaceEditedImages();

  console.log('Step 3: Generate final PowerPoint...');
  // Your existing PPTX generation code here

  return {
    imageReplacements: results,
    // other generation results
  };
}

// ============================================================
// Example 5: Batch processing with error handling
// ============================================================

export async function batchReplaceImages(schemaFiles: string[]) {
  const allResults = [];

  for (const schemaFile of schemaFiles) {
    console.log(`\nProcessing: ${schemaFile}`);

    try {
      const replacer = new ImageReplacerService(schemaFile);
      const results = await replacer.replaceEditedImages();

      allResults.push({
        file: schemaFile,
        ...results
      });
    } catch (error) {
      console.error(`Failed to process ${schemaFile}:`, error);
      allResults.push({
        file: schemaFile,
        error: error.message
      });
    }
  }

  return allResults;
}

// ============================================================
// Example 6: Conditional replacement based on slide content
// ============================================================

export async function replaceImagesWithCustomKeywords() {
  const replacer = new ImageReplacerService();

  // Define custom keywords for specific slides
  const customReplacements = [
    { slide: 10, element: 0, keyword: 'brain tumor MRI scan medical' },
    { slide: 5, element: 3, keyword: 'nervous system diagram anatomy' },
    { slide: 8, element: 2, keyword: 'cancer treatment chemotherapy' }
  ];

  const results = [];

  for (const { slide, element, keyword } of customReplacements) {
    const success = await replacer.replaceImageByIndex(slide, element, keyword);
    results.push({ slide, element, success });
  }

  return results;
}

// ============================================================
// Example 7: Replace images with progress tracking
// ============================================================

export async function replaceImagesWithProgress() {
  const replacer = new ImageReplacerService('./Amir.sxema.json', './images', false);

  // Read schema to get count
  const schema = JSON.parse(
    require('fs').readFileSync('./Amir.sxema.json', 'utf-8')
  );

  const editedImages = schema
    .flatMap((slide: any) => slide.elements)
    .filter((el: any) => el.type === 'image' && el.isEdited);

  console.log(`Found ${editedImages.length} images to replace`);

  // Create a progress bar or tracking mechanism
  let completed = 0;

  const results = await replacer.replaceEditedImages();

  console.log(`\nCompleted: ${results.successful}/${results.total}`);

  return results;
}

// ============================================================
// Example 8: Integration into main.ts
// ============================================================

/**
 * Add this to your main.ts file:
 *
 * import ImageReplacerService from './services/image-replacer';
 *
 * // After generating your schema but before final PPTX generation:
 * async function generatePresentation() {
 *   // ... your existing code ...
 *
 *   // Replace edited images
 *   console.log('\nReplacing edited images...');
 *   const imageReplacer = new ImageReplacerService();
 *   const imageResults = await imageReplacer.replaceEditedImages();
 *
 *   if (imageResults.failed > 0) {
 *     console.warn(`Warning: ${imageResults.failed} images failed to replace`);
 *   }
 *
 *   // ... continue with PPTX generation ...
 * }
 */

// ============================================================
// Example 9: Dry run mode (check what would be replaced)
// ============================================================

export async function dryRunImageReplacement() {
  const schema = JSON.parse(
    require('fs').readFileSync('./Amir.sxema.json', 'utf-8')
  );

  console.log('Dry Run - Images that would be replaced:\n');

  for (const slide of schema) {
    for (const element of slide.elements) {
      if (element.type === 'image' && element.isEdited) {
        console.log(`  Slide ${slide.slide}, Element ${element.elementIndex}`);
        console.log(`    Current: ${element.src}`);
        console.log(`    Status: Would be replaced\n`);
      }
    }
  }
}

// ============================================================
// Example 10: Replace images with retry logic
// ============================================================

export async function replaceImagesWithRetry(maxRetries: number = 3) {
  const replacer = new ImageReplacerService();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\nAttempt ${attempt}/${maxRetries}`);

    const results = await replacer.replaceEditedImages();

    if (results.failed === 0) {
      console.log('All images replaced successfully!');
      return results;
    }

    if (attempt < maxRetries) {
      console.log(`${results.failed} images failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }
  }

  console.log('Max retries reached, some images could not be replaced');
}
