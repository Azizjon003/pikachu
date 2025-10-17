/**
 * Test script for Template Preview Upload System
 *
 * This script demonstrates how to:
 * 1. Get all templates
 * 2. Upload a preview image for a template
 * 3. Verify the preview was uploaded
 *
 * Usage: node test-preview-upload.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Create a test image using sharp
 */
async function createTestImage(filename, text) {
  const width = 800;
  const height = 600;

  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#4A90E2"/>
      <text x="50%" y="40%" text-anchor="middle" font-size="48" fill="white" font-family="Arial">
        ${text}
      </text>
      <text x="50%" y="55%" text-anchor="middle" font-size="32" fill="white" font-family="Arial">
        Template Preview
      </text>
      <text x="50%" y="70%" text-anchor="middle" font-size="24" fill="rgba(255,255,255,0.7)" font-family="Arial">
        ${new Date().toLocaleDateString()}
      </text>
    </svg>
  `;

  const buffer = Buffer.from(svg);

  await sharp(buffer)
    .resize(800, 600)
    .jpeg({ quality: 90 })
    .toFile(filename);

  console.log(`✓ Test image created: ${filename}`);
}

/**
 * Get all templates
 */
async function getTemplates() {
  console.log('\n1. Fetching all templates...');
  try {
    const response = await axios.get(`${API_BASE_URL}/template/templates`);

    if (response.data.success) {
      console.log(`✓ Found ${response.data.totalTemplates} template(s)`);

      response.data.templates.forEach((template, index) => {
        console.log(`\n   ${index + 1}. ${template.templateName}`);
        console.log(`      - Preview: ${template.previewImage || 'None'}`);
        console.log(`      - Images: ${template.imageCount}`);
      });

      return response.data.templates;
    }
  } catch (error) {
    console.error('✗ Error fetching templates:', error.message);
    return [];
  }
}

/**
 * Upload a preview image for a template
 */
async function uploadPreview(templateName, imagePath) {
  console.log(`\n2. Uploading preview for template: ${templateName}`);

  try {
    const form = new FormData();
    form.append('preview', fs.createReadStream(imagePath));

    const response = await axios.post(
      `${API_BASE_URL}/template/${templateName}/preview`,
      form,
      {
        headers: form.getHeaders()
      }
    );

    if (response.data.success) {
      console.log('✓ Preview uploaded successfully!');
      console.log(`   URL: ${response.data.previewUrl}`);
      console.log(`   Message: ${response.data.message}`);
      return true;
    }
  } catch (error) {
    if (error.response) {
      console.error('✗ Upload failed:', error.response.data.error);
    } else {
      console.error('✗ Upload error:', error.message);
    }
    return false;
  }
}

/**
 * Verify the preview was uploaded
 */
async function verifyPreview(templateName) {
  console.log(`\n3. Verifying preview for template: ${templateName}`);

  try {
    const response = await axios.get(`${API_BASE_URL}/template/templates`);

    if (response.data.success) {
      const template = response.data.templates.find(
        t => t.templateName === templateName
      );

      if (template) {
        if (template.previewImage) {
          console.log('✓ Preview found!');
          console.log(`   Preview URL: ${template.previewImage}`);

          // Try to access the preview image
          try {
            const previewResponse = await axios.head(
              `http://localhost:3000${template.previewImage}`
            );
            console.log('✓ Preview image is accessible');
            console.log(`   Content-Type: ${previewResponse.headers['content-type']}`);
          } catch (error) {
            console.error('✗ Preview image not accessible');
          }
        } else {
          console.log('✗ No preview found for this template');
        }
      } else {
        console.log('✗ Template not found');
      }
    }
  } catch (error) {
    console.error('✗ Error verifying preview:', error.message);
  }
}

/**
 * Test invalid scenarios
 */
async function testErrorScenarios() {
  console.log('\n4. Testing error scenarios...');

  // Test 1: Upload without file
  console.log('\n   a) Testing upload without file...');
  try {
    const form = new FormData();
    const response = await axios.post(
      `${API_BASE_URL}/template/test-template/preview`,
      form,
      {
        headers: form.getHeaders()
      }
    );
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('   ✓ Correctly rejected upload without file');
    }
  }

  // Test 2: Upload invalid file type
  console.log('\n   b) Testing upload with invalid file type...');
  const txtFile = path.join(__dirname, 'test-invalid.txt');
  fs.writeFileSync(txtFile, 'This is not an image');

  try {
    const form = new FormData();
    form.append('preview', fs.createReadStream(txtFile), {
      filename: 'test.txt',
      contentType: 'text/plain'
    });

    const response = await axios.post(
      `${API_BASE_URL}/template/test-template/preview`,
      form,
      {
        headers: form.getHeaders()
      }
    );
  } catch (error) {
    if (error.response && error.response.status === 500) {
      console.log('   ✓ Correctly rejected invalid file type');
    }
  } finally {
    fs.unlinkSync(txtFile);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Template Preview Upload System - Test Suite      ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Check if server is running
  try {
    await axios.get('http://localhost:3000/health');
    console.log('✓ API server is running\n');
  } catch (error) {
    console.error('✗ API server is not running. Please start it first.');
    console.error('  Run: npm run api');
    process.exit(1);
  }

  // Get available templates
  const templates = await getTemplates();

  if (templates.length === 0) {
    console.log('\n✗ No templates found. Please upload a template first.');
    return;
  }

  // Select first template for testing
  const testTemplateName = templates[0].templateName;
  const testImagePath = path.join(__dirname, 'test-preview-image.jpg');

  try {
    // Create a test image
    await createTestImage(testImagePath, testTemplateName);

    // Upload the preview
    const uploadSuccess = await uploadPreview(testTemplateName, testImagePath);

    if (uploadSuccess) {
      // Verify the upload
      await verifyPreview(testTemplateName);
    }

    // Test error scenarios
    await testErrorScenarios();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              Test Suite Completed                     ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\nYou can now:');
    console.log(`1. View the preview at: http://localhost:3000/templates/previews/${testTemplateName}.jpg`);
    console.log(`2. Get all templates: curl http://localhost:3000/api/template/templates`);
    console.log(`3. Upload more previews using the API`);

  } finally {
    // Cleanup test image
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
      console.log('\n✓ Test image cleaned up');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  getTemplates,
  uploadPreview,
  verifyPreview,
  createTestImage
};
