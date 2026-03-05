/**
 * Migration Script: Import existing filesystem data into PostgreSQL
 *
 * Run: npx tsx src/scripts/migrate-to-db.ts
 *
 * Migrates:
 * 1. Templates from templates/*.sxema.json → Template table (schema JSON stored directly in DB)
 * 2. Presentations from generated/*.pptx → Presentation table
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function migrateTemplates() {
  const templatesDir = path.join(process.cwd(), 'templates');
  if (!fs.existsSync(templatesDir)) {
    console.log('No templates directory found, skipping...');
    return 0;
  }

  const schemaFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.sxema.json'));
  let count = 0;

  // Load metadata for previews
  let metadata: Record<string, string> = {};
  const metadataPath = path.join(templatesDir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }

  for (const schemaFile of schemaFiles) {
    const templateName = schemaFile.replace('.sxema.json', '');

    // Read schema JSON content
    let schema: any = null;
    let slideCount = 0;
    let imageCount = 0;
    try {
      schema = JSON.parse(fs.readFileSync(path.join(templatesDir, schemaFile), 'utf-8'));
      slideCount = Array.isArray(schema) ? schema.length : 0;
      imageCount = Array.isArray(schema)
        ? schema.reduce((sum: number, slide: any) => {
            return sum + (slide.elements?.filter((e: any) => e.type === 'image').length || 0);
          }, 0)
        : 0;
    } catch { /* ignore */ }

    const previewFilename = metadata[templateName];
    const hasPreview = previewFilename
      ? fs.existsSync(path.join(templatesDir, 'previews', previewFilename))
      : false;

    try {
      await prisma.template.upsert({
        where: { name: templateName },
        update: { schema: schema, slideCount, imageCount, hasPreview },
        create: {
          name: templateName,
          schema: schema,
          slideCount,
          imageCount,
          hasPreview,
        },
      });
      count++;
      console.log(`  [+] Template: ${templateName} (${slideCount} slides, ${imageCount} images, schema in DB)`);
    } catch (e: any) {
      console.error(`  [!] Failed: ${templateName} — ${e.message}`);
    }
  }

  return count;
}

async function migratePresentations() {
  const generatedDir = path.join(process.cwd(), 'generated');
  if (!fs.existsSync(generatedDir)) {
    console.log('No generated directory found, skipping...');
    return 0;
  }

  const pptxFiles = fs.readdirSync(generatedDir).filter((f) => f.endsWith('.pptx'));
  let count = 0;

  for (const pptxFile of pptxFiles) {
    const filePath = path.join(generatedDir, pptxFile);
    const stats = fs.statSync(filePath);

    // Try to extract topic from filename: sessionId-topic.pptx
    const parts = pptxFile.replace('.pptx', '').split('-');
    const topic = parts.length > 1 ? parts.slice(1).join('-').replace(/-/g, ' ') : pptxFile;

    try {
      await prisma.presentation.upsert({
        where: { filename: pptxFile },
        update: { fileSize: stats.size },
        create: {
          filename: pptxFile,
          filePath: `generated/${pptxFile}`,
          topic: topic || 'Unknown',
          language: 'uz',
          fileSize: stats.size,
          status: 'completed',
          createdAt: stats.birthtime,
        },
      });
      count++;
      console.log(`  [+] Presentation: ${pptxFile} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    } catch (e: any) {
      console.error(`  [!] Failed: ${pptxFile} — ${e.message}`);
    }
  }

  return count;
}

async function main() {
  console.log('=== Database Migration Script ===\n');

  console.log('1. Migrating templates...');
  const templateCount = await migrateTemplates();
  console.log(`   Done: ${templateCount} templates migrated\n`);

  console.log('2. Migrating presentations...');
  const presentationCount = await migratePresentations();
  console.log(`   Done: ${presentationCount} presentations migrated\n`);

  console.log('=== Migration Complete ===');
  console.log(`Templates: ${templateCount}, Presentations: ${presentationCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  prisma.$disconnect();
  process.exit(1);
});
