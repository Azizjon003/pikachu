import IntegratedAIImageService from '../services/image/integrated-ai-image-service';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for the new AI Image System
 */

async function testSingleImageGeneration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 1: Single Image Generation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const service = new IntegratedAIImageService();

  try {
    const result = await service.findAndDownloadImage({
      slideTitle: 'Market Growth Analysis',
      slideContent: 'Our Q4 revenue increased by 23% compared to last year, showing strong market growth across all segments.',
      slideIndex: 0,
      elementType: 'background',
      templateName: 'test-template',
      presentationTitle: 'Annual Report 2024',
      presentationTheme: 'Corporate, Professional',
      desiredStyle: 'modern, clean, professional',
      colorScheme: 'blue, white'
    });

    console.log('\n✅ Test Result:');
    console.log(`   Success: ${result.success}`);
    if (result.success) {
      console.log(`   Image URL: ${result.imageUrl}`);
      console.log(`   Local Path: ${result.localPath}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   AI Reasoning: ${result.aiReasoning}`);
      console.log(`   Processing Time: ${(result.processingTime / 1000).toFixed(2)}s`);

      if (result.validationResult) {
        console.log(`\n   Validation:`);
        console.log(`     Valid: ${result.validationResult.isValid}`);
        console.log(`     Score: ${(result.validationResult.overallScore * 100).toFixed(1)}%`);
        console.log(`     Grade: ${result.validationResult.grade}`);
      }

      console.log(`\n   Alternatives: ${result.alternatives.length} found`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    return result.success;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

async function testBatchImageGeneration() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Batch Image Generation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const service = new IntegratedAIImageService();

  try {
    const result = await service.processBatchImages({
      templateName: 'test-batch-template',
      presentationTitle: 'Technology Trends 2025',
      presentationTheme: 'Modern, Tech',
      slides: [
        {
          slideIndex: 0,
          slideTitle: 'Artificial Intelligence',
          slideContent: 'AI is transforming industries with machine learning and neural networks',
          elementType: 'background',
          desiredStyle: 'futuristic, technological',
          colorScheme: 'blue, purple'
        },
        {
          slideIndex: 1,
          slideTitle: 'Cloud Computing',
          slideContent: 'Cloud services enable scalable and flexible infrastructure',
          elementType: 'background',
          desiredStyle: 'modern, clean',
          colorScheme: 'white, blue'
        },
        {
          slideIndex: 2,
          slideTitle: 'Cybersecurity',
          slideContent: 'Protecting data and systems from digital threats',
          elementType: 'content',
          desiredStyle: 'professional, secure',
          colorScheme: 'dark, red'
        }
      ]
    });

    console.log('\n✅ Batch Test Result:');
    console.log(`   Total Slides: ${result.totalSlides}`);
    console.log(`   Successful: ${result.successfulCount}`);
    console.log(`   Failed: ${result.failedCount}`);
    console.log(`   Average Confidence: ${(result.averageConfidence * 100).toFixed(1)}%`);
    console.log(`   Total Time: ${(result.totalProcessingTime / 1000).toFixed(2)}s`);

    console.log('\n   Individual Results:');
    result.results.forEach((r, i) => {
      console.log(`   Slide ${i + 1}: ${r.success ? '✅ Success' : '❌ Failed'} (${(r.processingTime / 1000).toFixed(2)}s)`);
      if (r.success) {
        console.log(`      Confidence: ${(r.confidence * 100).toFixed(1)}%`);
        console.log(`      Path: ${r.localPath}`);
      } else {
        console.log(`      Error: ${r.error}`);
      }
    });

    return result.successfulCount > 0;
  } catch (error) {
    console.error('❌ Batch test failed:', error);
    return false;
  }
}

async function testKeywordSearch() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Keyword Search');
  console.log('═══════════════════════════════════════════════════════════\n');

  const service = new IntegratedAIImageService();

  try {
    const result = await service.findImageByKeyword(
      'business team collaboration',
      'test-keyword-template',
      0
    );

    console.log('\n✅ Keyword Search Result:');
    console.log(`   Success: ${result.success}`);
    if (result.success) {
      console.log(`   Image URL: ${result.imageUrl}`);
      console.log(`   Local Path: ${result.localPath}`);
      console.log(`   Alternatives: ${result.alternatives.length} found`);
    } else {
      console.log(`   Error: ${result.error}`);
    }

    return result.success;
  } catch (error) {
    console.error('❌ Keyword search test failed:', error);
    return false;
  }
}

async function testTemplateManagement() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 4: Template Management');
  console.log('═══════════════════════════════════════════════════════════\n');

  const service = new IntegratedAIImageService();

  try {
    // Get template images
    console.log('📂 Getting images for test-template...');
    const images = await service.getTemplateImages('test-template');
    console.log(`   Found ${images.length} images`);

    if (images.length > 0) {
      console.log('\n   First image details:');
      const img = images[0];
      console.log(`     Filename: ${img.filename}`);
      console.log(`     Dimensions: ${img.dimensions.width}x${img.dimensions.height}`);
      console.log(`     File Size: ${(img.fileSize / 1024).toFixed(2)}KB`);
      console.log(`     Format: ${img.format}`);
      console.log(`     AI Score: ${img.aiScore ? (img.aiScore * 100).toFixed(1) + '%' : 'N/A'}`);
    }

    // Get template statistics
    console.log('\n📊 Getting template statistics...');
    const stats = await service.getTemplateStats('test-template');
    console.log(`   Total Images: ${stats.totalImages}`);
    console.log(`   Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Average Size: ${(stats.averageSize / 1024).toFixed(2)}KB`);

    // Get service info
    console.log('\n🔧 Service Information:');
    const serviceStats = service.getServiceStats();
    console.log(`   Total Templates: ${serviceStats.totalTemplates}`);
    console.log(`   Templates: ${serviceStats.templates.join(', ')}`);

    return true;
  } catch (error) {
    console.error('❌ Template management test failed:', error);
    return false;
  }
}

async function testImageValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 5: Image Validation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const service = new IntegratedAIImageService();

  try {
    // Test with a known good image
    const testImageUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920';

    console.log('🔍 Validating test image...');
    const validation = await service.validateExistingImage(testImageUrl, {
      minWidth: 1280,
      minHeight: 720,
      expectedContent: 'business analytics',
      expectedStyle: 'professional'
    });

    console.log('\n✅ Validation Result:');
    console.log(`   Valid: ${validation.isValid}`);
    console.log(`   Overall Score: ${(validation.overallScore * 100).toFixed(1)}%`);
    console.log(`   Grade: ${validation.grade}`);
    console.log('\n   Detailed Scores:');
    console.log(`     Technical: ${(validation.scores.technical * 100).toFixed(1)}%`);
    console.log(`     Visual: ${(validation.scores.visual * 100).toFixed(1)}%`);
    console.log(`     Usability: ${(validation.scores.usability * 100).toFixed(1)}%`);

    if (validation.issues.length > 0) {
      console.log('\n   Issues Found:');
      validation.issues.forEach(issue => {
        console.log(`     [${issue.severity}] ${issue.description}`);
      });
    }

    if (validation.recommendations.length > 0) {
      console.log('\n   Recommendations:');
      validation.recommendations.forEach((rec, i) => {
        console.log(`     ${i + 1}. ${rec}`);
      });
    }

    return validation.isValid;
  } catch (error) {
    console.error('❌ Validation test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║          AI Image System - Comprehensive Tests            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const tests = [
    { name: 'Single Image Generation', fn: testSingleImageGeneration },
    { name: 'Batch Image Generation', fn: testBatchImageGeneration },
    { name: 'Keyword Search', fn: testKeywordSearch },
    { name: 'Template Management', fn: testTemplateManagement },
    { name: 'Image Validation', fn: testImageValidation }
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      console.error(`Error running test "${test.name}":`, error);
      results.push({ name: test.name, passed: false });
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                     TEST SUMMARY                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`   ${status}: ${result.name}`);
  });

  console.log(`\n   Total: ${results.length} tests`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Success Rate: ${((passed / results.length) * 100).toFixed(1)}%\n`);

  if (failed === 0) {
    console.log('🎉 All tests passed! The AI Image System is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.\n');
  }
}

// Run tests
if (require.main === module) {
  runAllTests().then(() => {
    console.log('Test run completed.');
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error during test run:', error);
    process.exit(1);
  });
}

export { runAllTests, testSingleImageGeneration, testBatchImageGeneration, testKeywordSearch, testTemplateManagement, testImageValidation };