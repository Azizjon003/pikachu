# Architecture Quick Reference

## File Location Cheat Sheet

### Need to generate content with LLM?
**Look in:** `src/core/generators/`
- `llm-client.ts` - Basic OpenAI calls
- `structured-generator.ts` - Structured content with validation
- `enhanced-generator.ts` - Advanced generation

### Need to process/transform data?
**Look in:** `src/core/processors/`
- `json-processor.ts` - JSON operations
- `schema-processor.ts` - Schema validation
- `content-analyzer.ts` - Content analysis

### Need to export presentations?
**Look in:** `src/core/exporters/`
- `pptx-exporter.ts` - PowerPoint export

### Need to work with images?
**Look in:** `src/services/image/`
- `image-search.ts` - Image search
- `image-replacer.ts` - Replace images in PPTX

### Need to call external APIs?
**Look in:** `src/services/api/`
- `api-client.ts` - HTTP clients

### Need utilities/helpers?
**Look in:** `src/lib/`
- `logger.ts` - Logging
- `config-manager.ts` - Configuration
- `progress-tracker.ts` - Progress tracking
- `prompt-optimizer.ts` - Prompt optimization
- `quality-validator.ts` - Quality checks

### Need type definitions?
**Look in:** `types/`
- `slides.ts` - Slide types
- `AIPPT.ts` - AI types

### Need utility functions?
**Look in:** `utils/`
- `element.ts` - Element utilities
- `image.ts` - Image utilities

### Need tests?
**Look in:** `src/tests/`
- `unit/` - Component tests
- `integration/` - Feature tests
- `e2e/` - Workflow tests

## Import Examples

```typescript
// Generators
import { generateOutline } from '@/core/generators/llm-client';
import { ResilientSlideGenerator } from '@/core/generators/structured-generator';

// Processors
import { processJSON } from '@/core/processors/json-processor';
import { OutlineSchema } from '@/core/processors/schema-processor';

// Exporters
import { exportToPPTX } from '@/core/exporters/pptx-exporter';

// Services
import { searchImages } from '@/services/image/image-search';
import { ImageReplacer } from '@/services/image/image-replacer';

// Library
import { EnhancedLogger } from '@/lib/logger';
import { ConfigManager } from '@/lib/config-manager';

// Types
import { Slide, SlideTheme } from '@/types/slides';

// Utils
import { getElementRange } from '@/utils/element';
```

## Common Tasks

### Add a New Generator
1. Create file: `src/core/generators/my-generator.ts`
2. Export from: `src/core/generators/index.ts`
3. Import: `import { MyGenerator } from '@/core/generators';`

### Add a New Service
1. Create directory: `src/services/my-service/`
2. Create file: `src/services/my-service/service.ts`
3. Export from: `src/services/my-service/index.ts`
4. Import: `import { MyService } from '@/services/my-service';`

### Add a New Test
1. Choose type: unit/integration/e2e
2. Create file: `src/tests/{type}/my-feature.test.ts`
3. Import from `@/` paths

## Migration Commands

### Backup
```bash
git add .
git commit -m "Checkpoint: Before migration"
git branch backup-before-migration
```

### Migrate a File
```bash
# 1. Copy to new location
cp old-file.ts src/core/generators/new-file.ts

# 2. Update imports in the file
# Replace: ./other-file → @/core/other-file

# 3. Test
npx tsc --noEmit

# 4. Delete old file (only after verification)
rm old-file.ts
```

### Verify Structure
```bash
npx tsc --noEmit          # Check TypeScript
npm run test              # Run all tests
npm start                 # Run application
```

### Rollback
```bash
git reset --hard backup-before-migration
```

## Directory Purposes

| Directory | Purpose | Examples |
|-----------|---------|----------|
| `src/core/generators/` | LLM content generation | OpenAI calls, structured generation |
| `src/core/processors/` | Data transformation | JSON parsing, schema validation |
| `src/core/exporters/` | Output generation | PPTX export |
| `src/services/image/` | Image operations | Search, replacement |
| `src/services/api/` | External APIs | HTTP clients |
| `src/lib/` | Shared utilities | Logger, config, validators |
| `src/tests/` | All tests | Unit, integration, e2e |
| `types/` | Type definitions | Interfaces, types |
| `utils/` | Utility functions | Helpers, parsers |
| `configs/` | Configuration | Themes, fonts, shapes |

## File Naming Conventions

- **Feature files**: `feature-name.ts` (kebab-case)
- **Test files**: `feature-name.test.ts`
- **Type files**: `feature-name.ts`
- **Barrel exports**: `index.ts`

## Import Path Rules

1. **Use `@/` for all src/ imports**
   ```typescript
   import { X } from '@/core/generators';
   ```

2. **Use `@/types/` for type imports**
   ```typescript
   import { Slide } from '@/types/slides';
   ```

3. **Use `@/utils/` for utilities**
   ```typescript
   import { getElementRange } from '@/utils/element';
   ```

4. **Avoid relative imports when possible**
   ```typescript
   // Bad
   import { X } from '../../../lib/logger';

   // Good
   import { X } from '@/lib/logger';
   ```

## Documentation Files

- **ARCHITECTURE.md** - Full architecture guide (20 min read)
- **MIGRATION-PLAN.md** - Step-by-step migration (detailed)
- **RESTRUCTURE-SUMMARY.md** - Overview and benefits (5 min read)
- **QUICK-REFERENCE.md** - This file (1 min lookup)
- **src/README.md** - Source directory guide

## Status Indicators

- ✅ Structure created
- ✅ Documentation complete
- ⏳ Files not migrated yet
- ⏳ Imports not updated yet

**Next Step**: Review MIGRATION-PLAN.md and start migration
