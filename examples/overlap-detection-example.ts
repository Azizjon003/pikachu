/**
 * Text Overlap Detection & Resolution - Usage Example
 *
 * This example demonstrates how to use the overlap detection and AI optimization system
 */

import TextOverlapDetector from '../src/services/layout/text-overlap-detector';
import AITextLayoutOptimizer from '../src/services/layout/ai-layout-optimizer';

// Example 1: Basic Overlap Detection
async function example1_basicDetection() {
  console.log('\n=== Example 1: Basic Overlap Detection ===\n');

  const detector = new TextOverlapDetector(1920, 1080);

  // Sample elements with overlaps
  const elements = [
    {
      id: 'el1',
      type: 'shape',
      content: 'Title Text',
      left: 100,
      top: 100,
      width: 500,
      height: 100,
      fontSize: 48,
      elementIndex: 0
    },
    {
      id: 'el2',
      type: 'shape',
      content: 'Subtitle that overlaps with title',
      left: 150,
      top: 150, // Overlaps with title
      width: 600,
      height: 120,
      fontSize: 32,
      elementIndex: 1
    },
    {
      id: 'el3',
      type: 'shape',
      content: 'Content text that is way too long for this small box and will definitely overflow the boundaries of the element',
      left: 100,
      top: 400,
      width: 300,
      height: 80, // Too small for content
      fontSize: 24,
      elementIndex: 2
    }
  ];

  // Analyze the slide
  const analysis = detector.analyzeSlide(elements);

  // Print detailed report
  detector.printAnalysisReport(analysis);

  console.log('✅ Analysis complete!\n');
}

// Example 2: AI-Powered Optimization
async function example2_aiOptimization() {
  console.log('\n=== Example 2: AI-Powered Optimization ===\n');

  const optimizer = new AITextLayoutOptimizer(1920, 1080);

  // Same problematic elements
  const elements = [
    {
      id: 'el1',
      type: 'shape',
      content: 'Main Title',
      left: 200,
      top: 150,
      width: 800,
      height: 120,
      fontSize: 56,
      elementIndex: 0
    },
    {
      id: 'el2',
      type: 'shape',
      content: 'Subtitle with overlapping content that needs to be fixed',
      left: 250,
      top: 200, // Overlaps
      width: 700,
      height: 100,
      fontSize: 36,
      elementIndex: 1
    },
    {
      id: 'el3',
      type: 'shape',
      content: 'Body text content',
      left: 200,
      top: 350,
      width: 800,
      height: 200,
      fontSize: 24,
      elementIndex: 2
    }
  ];

  // Optimize layout
  const result = await optimizer.optimizeLayout(elements);

  console.log('\n📊 Optimization Results:');
  console.log(`   Success: ${result.success}`);
  console.log(`   Fixes Applied: ${result.appliedFixes.length}`);
  console.log(`   Improvement: ${result.improvementScore.toFixed(1)}%`);
  console.log(`   Iterations: ${result.iterationsUsed}`);

  // Show what changed
  if (result.appliedFixes.length > 0) {
    console.log('\n🔧 Applied Fixes:');
    result.appliedFixes.forEach((fix, i) => {
      console.log(`\n   Fix ${i + 1}: ${fix.action} on element ${fix.elementIndex}`);
      console.log(`   Reasoning: ${fix.reasoning}`);
      fix.changes.forEach(change => {
        console.log(`      ${change.field}: ${change.oldValue} → ${change.newValue}`);
      });
    });
  }

  console.log('\n✅ Optimization complete!\n');
}

// Example 3: Slide-by-Slide Processing
async function example3_multipleSlides() {
  console.log('\n=== Example 3: Processing Multiple Slides ===\n');

  const optimizer = new AITextLayoutOptimizer(1920, 1080);

  const slides = [
    {
      slideNumber: 1,
      elements: [
        {
          id: 'title',
          type: 'shape',
          content: 'Presentation Title',
          left: 360,
          top: 340,
          width: 1200,
          height: 200,
          fontSize: 72,
          elementIndex: 0
        },
        {
          id: 'author',
          type: 'shape',
          content: 'Author Name',
          left: 360,
          top: 600,
          width: 1200,
          height: 100,
          fontSize: 36,
          elementIndex: 1
        }
      ]
    },
    {
      slideNumber: 2,
      elements: [
        {
          id: 'header',
          type: 'shape',
          content: 'Reja:',
          left: 200,
          top: 150,
          width: 400,
          height: 80,
          fontSize: 48,
          elementIndex: 0
        },
        {
          id: 'item1',
          type: 'shape',
          content: '1. First topic item with very long text',
          left: 200,
          top: 280,
          width: 1400,
          height: 80,
          fontSize: 28,
          elementIndex: 1
        },
        {
          id: 'item2',
          type: 'shape',
          content: '2. Second topic item',
          left: 200,
          top: 320, // Potential overlap
          width: 1400,
          height: 80,
          fontSize: 28,
          elementIndex: 2
        }
      ]
    }
  ];

  let totalFixes = 0;
  let slidesOptimized = 0;

  for (const slide of slides) {
    console.log(`\n📄 Processing Slide ${slide.slideNumber}...`);

    const result = await optimizer.optimizeLayout(slide.elements);

    if (result.appliedFixes.length > 0) {
      totalFixes += result.appliedFixes.length;
      slidesOptimized++;
      console.log(`   ✅ Applied ${result.appliedFixes.length} fixes`);
    } else {
      console.log(`   ✅ No issues detected`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Slides Processed: ${slides.length}`);
  console.log(`   Slides Optimized: ${slidesOptimized}`);
  console.log(`   Total Fixes: ${totalFixes}`);
  console.log('\n✅ Batch processing complete!\n');
}

// Example 4: Custom Configuration
function example4_customConfiguration() {
  console.log('\n=== Example 4: Custom Configuration ===\n');

  // Create detector with custom slide dimensions
  const customDetector = new TextOverlapDetector(1280, 720); // 720p

  // The detector will now use these dimensions for analysis
  console.log('✅ Custom detector created with 1280x720 dimensions\n');

  // Create optimizer with custom dimensions and API key
  const customOptimizer = new AITextLayoutOptimizer(
    1280, // width
    720,  // height
    process.env.OPENAI_API_KEY // optional: provide custom API key
  );

  console.log('✅ Custom optimizer created\n');

  // You can also adjust thresholds by extending the class
  console.log('💡 Tip: To adjust detection thresholds, extend TextOverlapDetector class\n');
}

// Example 5: Error Handling
async function example5_errorHandling() {
  console.log('\n=== Example 5: Error Handling ===\n');

  const optimizer = new AITextLayoutOptimizer(1920, 1080);

  const elements = [
    {
      id: 'el1',
      type: 'shape',
      content: 'Element 1',
      left: 100,
      top: 100,
      width: 400,
      height: 100,
      fontSize: 32,
      elementIndex: 0
    }
  ];

  try {
    const result = await optimizer.optimizeLayout(elements);

    if (!result.success) {
      console.log('⚠️  Optimization completed with some issues remaining');
      console.log(`   Critical issues: ${result.newAnalysis.criticalIssues}`);
      console.log(`   Major issues: ${result.newAnalysis.majorIssues}`);
      console.log(`   Recommendations:`);
      result.newAnalysis.recommendations.forEach(rec => {
        console.log(`      - ${rec}`);
      });
    } else {
      console.log('✅ Optimization successful!');
    }
  } catch (error) {
    console.error('❌ Error during optimization:', error);
    console.log('💡 The system will fall back to heuristic fixes automatically');
  }

  console.log('\n✅ Error handling example complete!\n');
}

// Run examples
async function runExamples() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     Text Overlap Detection & Resolution Examples         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  // Uncomment the examples you want to run:

  await example1_basicDetection();
  // await example2_aiOptimization();
  // await example3_multipleSlides();
  // example4_customConfiguration();
  // await example5_errorHandling();

  console.log('\n✅ All examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  example1_basicDetection,
  example2_aiOptimization,
  example3_multipleSlides,
  example4_customConfiguration,
  example5_errorHandling
};
