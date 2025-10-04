import ImageReplacerService from '../services/image/image-replacer';
import * as path from 'path';

/**
 * Test the Image Replacer Service
 */
async function testImageReplacer() {
  console.log('==============================================');
  console.log('Testing Image Replacer Service');
  console.log('==============================================\n');

  try {
    // Initialize the service
    const schemaPath = path.resolve('./Amir.sxema.json');
    const imageDir = path.resolve('./images');

    console.log(`Schema path: ${schemaPath}`);
    console.log(`Image directory: ${imageDir}\n`);

    const replacer = new ImageReplacerService(
      schemaPath,
      imageDir,
      true // verbose mode
    );

    // Test 1: Replace all edited images
    console.log('\n*** Test 1: Replace All Edited Images ***\n');
    const results = await replacer.replaceEditedImages();

    console.log('\n==============================================');
    console.log('Final Results:');
    console.log('==============================================');
    console.log(`Total images processed: ${results.total}`);
    console.log(`Successfully replaced: ${results.successful}`);
    console.log(`Failed replacements: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\nErrors encountered:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n==============================================');
    console.log('Test completed!');
    console.log('==============================================');

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n==============================================');
    console.error('Test failed with error:');
    console.error('==============================================');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Test replacing a single image by index
 */
async function testSingleImageReplacement() {
  console.log('==============================================');
  console.log('Testing Single Image Replacement');
  console.log('==============================================\n');

  try {
    const replacer = new ImageReplacerService(
      './Amir.sxema.json',
      './images',
      true
    );

    // Replace the image on slide 10 (index 9), element 0
    // This is the one marked as isEdited: true
    console.log('Replacing image on slide 10, element 0 with custom keyword...\n');

    const success = await replacer.replaceImageByIndex(
      10, // slide number
      0,  // element index
      'brain tumor medical imaging' // custom keyword
    );

    if (success) {
      console.log('\n✓ Successfully replaced single image!');
      process.exit(0);
    } else {
      console.error('\n✗ Failed to replace single image');
      process.exit(1);
    }

  } catch (error) {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  }
}

/**
 * Test the keyword generation
 */
async function testKeywordGeneration() {
  console.log('==============================================');
  console.log('Testing Keyword Generation');
  console.log('==============================================\n');

  // This test demonstrates the keyword generation logic
  // by simulating different slide contexts

  const testCases = [
    {
      name: 'Medical slide with tumor keywords',
      context: 'TUMORS OF NERVOUS SYSTEM Glioma Brain Cancer Treatment',
      expected: 'Should include: tumor, nervous system, glioma'
    },
    {
      name: 'Table of contents',
      context: 'Table of Contents Nervous System Tumors Diagnostic Techniques Treatment Approaches',
      expected: 'Should include: nervous system, tumor, diagnostic, treatment'
    },
    {
      name: 'Generic slide',
      context: 'Write a main idea here Lorem ipsum dolor sit amet',
      expected: 'Should use fallback keywords'
    }
  ];

  console.log('Keyword generation test cases:\n');

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`Context: "${testCase.context.substring(0, 60)}..."`);
    console.log(`Expected: ${testCase.expected}`);
    console.log('---');
  }

  console.log('\nNote: Actual keyword generation happens during the replacement process.');
  console.log('Run the main test to see it in action.');
}

// Main execution
const args = process.argv.slice(2);
const testMode = args[0] || 'all';

(async () => {
  switch (testMode) {
    case 'single':
      await testSingleImageReplacement();
      break;
    case 'keywords':
      await testKeywordGeneration();
      break;
    case 'all':
    default:
      await testImageReplacer();
      break;
  }
})();
