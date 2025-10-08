import TextPlacementValidator from '../services/validation/text-placement-validator';
import fs from 'fs';
import path from 'path';

/**
 * Test Text Placement Validation System
 */

// Mock slide data
const mockTitleSlide = {
  id: 'slide-0',
  index: 0,
  slide: 0,
  elements: [
    {
      type: 'shape',
      content: 'Sun\'iy Intellekt va Texnologiya',
      fontSize: 44,
      left: 100,
      top: 200,
      width: 800,
      height: 100,
      elementIndex: 0
    },
    {
      type: 'shape',
      content: 'Abdullayev Jasur',
      fontSize: 24,
      left: 100,
      top: 400,
      width: 600,
      height: 50,
      elementIndex: 1
    },
    {
      type: 'image',
      src: 'background.jpg',
      elementIndex: 2
    }
  ]
};

const mockOutlineSlide = {
  id: 'slide-1',
  index: 1,
  slide: 1,
  elements: [
    {
      type: 'shape',
      content: 'Reja:',
      fontSize: 40,
      left: 100,
      top: 100,
      width: 300,
      height: 80,
      elementIndex: 0
    },
    {
      type: 'shape',
      content: '1. Kirish va tarix',
      fontSize: 22,
      left: 150,
      top: 250,
      width: 700,
      height: 50,
      elementIndex: 1
    },
    {
      type: 'shape',
      content: '2. AI ning asosiy turlari',
      fontSize: 22,
      left: 150,
      top: 320,
      width: 700,
      height: 50,
      elementIndex: 2
    },
    {
      type: 'shape',
      content: '3. Amaliy qo\'llanmalar',
      fontSize: 22,
      left: 150,
      top: 390,
      width: 700,
      height: 50,
      elementIndex: 3
    }
  ]
};

const mockContentSlide = {
  id: 'slide-2',
  index: 2,
  slide: 2,
  elements: [
    {
      type: 'shape',
      content: 'Kirish va tarix',
      fontSize: 36,
      left: 100,
      top: 80,
      width: 800,
      height: 70,
      elementIndex: 0
    },
    {
      type: 'shape',
      content: 'Sun\'iy intellekt (AI) - bu kompyuterlar va mashinalarning inson aqlini taqlid qilish qobiliyati. AI ning tarixi 1950-yillarda boshlangan va hozirgi kunda u hayotimizning deyarli barcha sohalarida qo\'llanilmoqda.',
      fontSize: 20,
      left: 100,
      top: 200,
      width: 800,
      height: 200,
      elementIndex: 1
    },
    {
      type: 'shape',
      content: '• 1950: Alan Turing "Turing Test" yaratdi\n• 1956: Dartmouth konferensiyasida "AI" termini paydo bo\'ldi\n• 1997: Deep Blue shaxmat bo\'yicha jahon chempionini mag\'lub etdi\n• 2011: IBM Watson "Jeopardy!" o\'yinida g\'olib bo\'ldi',
      fontSize: 18,
      left: 100,
      top: 420,
      width: 800,
      height: 150,
      elementIndex: 2
    }
  ]
};

async function testTitleSlideValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 1: Title Slide Validation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const validator = new TextPlacementValidator();

  // Test with correct data
  console.log('📝 Test 1a: Correct title and author');
  const result1 = await validator.validateTitleSlide(
    mockTitleSlide,
    'Sun\'iy Intellekt va Texnologiya',
    'Abdullayev Jasur'
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result1.isValid}`);
  console.log(`  Issues: ${result1.issues.length}`);
  console.log(`  Fixes: ${result1.fixes.length}`);
  console.log(`  Confidence: ${(result1.confidence * 100).toFixed(1)}%`);

  // Test with incorrect data
  console.log('\n📝 Test 1b: Wrong title');
  const result2 = await validator.validateTitleSlide(
    mockTitleSlide,
    'Mashinali O\'rganish',  // Different title
    'Abdullayev Jasur'
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result2.isValid}`);
  console.log(`  Issues: ${result2.issues.length}`);
  console.log(`  Fixes: ${result2.fixes.length}`);
  console.log(`  Confidence: ${(result2.confidence * 100).toFixed(1)}%`);

  if (result2.fixes.length > 0) {
    console.log('\n  Applied Fixes:');
    result2.fixes.forEach(fix => {
      console.log(`    - Element ${fix.elementIndex}: ${fix.field}`);
      console.log(`      Old: "${fix.oldValue}"`);
      console.log(`      New: "${fix.newValue}"`);
    });
  }

  return result1.isValid && !result2.isValid;
}

async function testOutlineSlideValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 2: Outline Slide Validation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const validator = new TextPlacementValidator();

  const expectedOutline = [
    'Kirish va tarix',
    'AI ning asosiy turlari',
    'Amaliy qo\'llanmalar'
  ];

  // Test with correct outline
  console.log('📝 Test 2a: Correct outline');
  const result1 = await validator.validateOutlineSlide(
    mockOutlineSlide,
    expectedOutline
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result1.isValid}`);
  console.log(`  Issues: ${result1.issues.length}`);
  console.log(`  Fixes: ${result1.fixes.length}`);
  console.log(`  Confidence: ${(result1.confidence * 100).toFixed(1)}%`);

  // Test with incorrect outline
  console.log('\n📝 Test 2b: Different outline');
  const wrongOutline = [
    'Introduction',
    'Types of AI',
    'Applications'
  ];

  const result2 = await validator.validateOutlineSlide(
    mockOutlineSlide,
    wrongOutline
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result2.isValid}`);
  console.log(`  Issues: ${result2.issues.length}`);
  console.log(`  Fixes: ${result2.fixes.length}`);
  console.log(`  Confidence: ${(result2.confidence * 100).toFixed(1)}%`);

  if (result2.issues.length > 0) {
    console.log('\n  Issues Found:');
    result2.issues.slice(0, 3).forEach(issue => {
      console.log(`    - [${issue.severity}] ${issue.issue}`);
      console.log(`      Expected: "${issue.expectedContent}"`);
      console.log(`      Actual: "${issue.actualContent}"`);
    });
  }

  return result1.isValid;
}

async function testContentSlideValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 3: Content Slide Validation (AI)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const validator = new TextPlacementValidator();

  // Test with relevant content
  console.log('📝 Test 3a: Relevant content');
  const result1 = await validator.validateContentSlide(
    mockContentSlide,
    'Sun\'iy Intellekt va Texnologiya',
    2
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result1.isValid}`);
  console.log(`  Issues: ${result1.issues.length}`);
  console.log(`  Confidence: ${(result1.confidence * 100).toFixed(1)}%`);

  // Test with irrelevant topic
  console.log('\n📝 Test 3b: Irrelevant topic');
  const result2 = await validator.validateContentSlide(
    mockContentSlide,
    'Iqtisodiyot va Moliya',  // Unrelated topic
    2
  );

  console.log('\nResult:');
  console.log(`  Valid: ${result2.isValid}`);
  console.log(`  Issues: ${result2.issues.length}`);
  console.log(`  Confidence: ${(result2.confidence * 100).toFixed(1)}%`);

  if (result2.issues.length > 0) {
    console.log('\n  Issues Found:');
    result2.issues.forEach(issue => {
      console.log(`    - [${issue.severity}] ${issue.issue}`);
    });
  }

  return result1.isValid;
}

async function testBatchValidation() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 4: Batch Validation');
  console.log('═══════════════════════════════════════════════════════════\n');

  const validator = new TextPlacementValidator();

  const slides = [mockTitleSlide, mockOutlineSlide, mockContentSlide];
  const topic = 'Sun\'iy Intellekt va Texnologiya';
  const author = 'Abdullayev Jasur';
  const outline = [
    'Kirish va tarix',
    'AI ning asosiy turlari',
    'Amaliy qo\'llanmalar'
  ];

  const result = await validator.validatePresentation(
    slides,
    topic,
    author,
    outline
  );

  validator.printValidationReport(result);

  console.log('\n✅ Batch Validation Complete');
  console.log(`   Total Slides: ${result.totalSlides}`);
  console.log(`   Valid: ${result.validSlides}`);
  console.log(`   Fixed: ${result.fixedSlides}`);
  console.log(`   Success Rate: ${(result.validSlides / result.totalSlides * 100).toFixed(1)}%`);

  return result.validSlides >= result.totalSlides / 2;
}

async function testWithRealData() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST 5: Real Data Validation (if available)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const generatedPath = path.join(process.cwd(), 'generated');

  if (!fs.existsSync(generatedPath)) {
    console.log('⚠️  No generated slides found. Skipping real data test.');
    return true;
  }

  const files = fs.readdirSync(generatedPath)
    .filter(f => f.endsWith('.full-filled-slides.json'))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(generatedPath, a));
      const statB = fs.statSync(path.join(generatedPath, b));
      return statB.mtimeMs - statA.mtimeMs;
    });

  if (files.length === 0) {
    console.log('⚠️  No .full-filled-slides.json files found. Skipping real data test.');
    return true;
  }

  const latestFile = files[0];
  console.log(`📂 Testing with: ${latestFile}`);

  try {
    const filePath = path.join(generatedPath, latestFile);
    const slidesData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!Array.isArray(slidesData) || slidesData.length === 0) {
      console.log('⚠️  Invalid slides data format');
      return false;
    }

    const validator = new TextPlacementValidator();

    // Validate first slide
    console.log('\n📝 Validating first slide...');
    const titleResult = await validator.validateTitleSlide(
      slidesData[0],
      'Sample Topic',  // Would need actual topic
      'Sample Author'
    );

    console.log(`  Valid: ${titleResult.isValid}`);
    console.log(`  Issues: ${titleResult.issues.length}`);
    console.log(`  Confidence: ${(titleResult.confidence * 100).toFixed(1)}%`);

    return true;

  } catch (error) {
    console.error('❌ Error testing real data:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Text Placement Validation - Test Suite             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const tests = [
    { name: 'Title Slide Validation', fn: testTitleSlideValidation },
    { name: 'Outline Slide Validation', fn: testOutlineSlideValidation },
    { name: 'Content Slide Validation (AI)', fn: testContentSlideValidation },
    { name: 'Batch Validation', fn: testBatchValidation },
    { name: 'Real Data Validation', fn: testWithRealData }
  ];

  const results: { name: string; passed: boolean }[] = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      console.error(`\n❌ Error in test "${test.name}":`, error);
      results.push({ name: test.name, passed: false });
    }

    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                           ║');
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
    console.log('🎉 All tests passed! Validation system is working correctly.\n');
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

export {
  runAllTests,
  testTitleSlideValidation,
  testOutlineSlideValidation,
  testContentSlideValidation,
  testBatchValidation,
  testWithRealData
};