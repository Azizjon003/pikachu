# Migration Plan: Project Restructuring

## Overview

This document provides a detailed, step-by-step plan for migrating the existing TypeScript project to the new architecture outlined in `ARCHITECTURE.md`.

## Pre-Migration Checklist

- [x] Current structure analyzed
- [x] New directory structure created
- [x] Architecture documented
- [ ] Backup created (recommended: `git commit` current state)
- [ ] Team review completed
- [ ] Migration approved

## File Migration Map

### Core Modules

#### Exporters
| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `main.ts` | `src/core/exporters/pptx-exporter.ts` | Main PPTX export logic |

**Dependencies to update in pptx-exporter.ts:**
- `./types/slides` → `@/types/slides`
- `./utils/element` → `@/utils/element`
- `./utils/svgPathParser` → `@/utils/svgPathParser`
- `./utils/svg2Base64` → `@/utils/svg2Base64`
- `./utils/htmlParser/index` → `@/utils/htmlParser/index`

#### Processors
| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `json.ts` | `src/core/processors/json-processor.ts` | JSON processing |
| `schema.ts` + `sxema.ts` | `src/core/processors/schema-processor.ts` | Merge both files |
| `content-analyzer.ts` | `src/core/processors/content-analyzer.ts` | Content analysis |

**Merge Strategy for schema-processor.ts:**
1. Copy `schema.ts` content as base
2. Add exports from `sxema.ts`
3. Remove duplicates
4. Export unified schema interface

**Dependencies to update:**
- `./types/slides` → `@/types/slides`
- Internal cross-references between merged files

#### Generators
| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `llma.ts` | `src/core/generators/llm-client.ts` | Base LLM client |
| `llma-structured.ts` + `integrated-generator.ts` + `resilient-generator.ts` | `src/core/generators/structured-generator.ts` | Merge all three |
| `llma-structured-enhanced.ts` | `src/core/generators/enhanced-generator.ts` | Enhanced generator |

**Merge Strategy for structured-generator.ts:**
1. Start with `llma-structured.ts` as base
2. Integrate `ResilientSlideGenerator` from `resilient-generator.ts`
3. Add `IntegratedSlideGenerator` from `integrated-generator.ts`
4. Resolve dependency conflicts
5. Create unified export interface

**Dependencies to update:**
- `./schema` → `@/core/processors/schema-processor`
- `./types/slides` → `@/types/slides`
- `./resilient-generator` → remove (now internal)
- `./quality-validator` → `@/lib/quality-validator`
- `./content-analyzer` → `@/core/processors/content-analyzer`
- `./prompt-optimizer` → `@/lib/prompt-optimizer`
- `./progress-tracker` → `@/lib/progress-tracker`
- `./enhanced-logger` → `@/lib/logger`
- `./config-manager` → `@/lib/config-manager`

### Services

#### Image Services
| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `services/image.search.ts` | `src/services/image/image-search.ts` | Image search |
| `services/image-replacer.ts` | `src/services/image/image-replacer.ts` | Image replacement |

**Dependencies to update:**
- `../types/slides` → `@/types/slides`
- Cross-service references

#### API Services
| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `api.ts` | `src/services/api/api-client.ts` | API client |

### Library

| Current Location | New Location | Notes |
|-----------------|--------------|-------|
| `enhanced-logger.ts` | `src/lib/logger.ts` | Rename file |
| `config-manager.ts` | `src/lib/config-manager.ts` | Keep name |
| `progress-tracker.ts` | `src/lib/progress-tracker.ts` | Keep name |
| `prompt-optimizer.ts` | `src/lib/prompt-optimizer.ts` | Keep name |
| `quality-validator.ts` | `src/lib/quality-validator.ts` | Keep name |

**Dependencies to update:**
- `./enhanced-logger` → `@/lib/logger`
- `./config-manager` → `@/lib/config-manager`
- Cross-lib references

### Tests

| Current Location | New Location | Category |
|-----------------|--------------|----------|
| `testLlm.ts` | `src/tests/unit/llm-client.test.ts` | Unit |
| `testJson.ts` | `src/tests/unit/json-processor.test.ts` | Unit |
| `testSxema.ts` | `src/tests/unit/schema-processor.test.ts` | Unit |
| `testFullSxema.ts` | `src/tests/unit/schema-full.test.ts` | Unit |
| `testContentGeneration.ts` | `src/tests/integration/content-generation.test.ts` | Integration |
| `testLlm-enhanced.ts` | `src/tests/integration/llm-enhanced.test.ts` | Integration |
| `testImageReplacer.ts` | `src/tests/integration/image-replacer.test.ts` | Integration |
| `test.ts` | `src/tests/e2e/full-workflow.test.ts` | E2E |
| `openaiTest.ts` | `src/tests/e2e/openai-integration.test.ts` | E2E |

**Dependencies to update:**
- All test imports to use `@/` paths
- Update to import from new module locations

## Migration Steps

### Step 1: Create Backup
```bash
git add .
git commit -m "Checkpoint: Before architecture migration"
git branch backup-before-migration
```

### Step 2: Update TypeScript Configuration

**File: `tsconfig.json`**

Current:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts"]
}
```

Updated:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/types/*": ["./types/*"],
      "@/utils/*": ["./utils/*"],
      "@/configs/*": ["./configs/*"]
    }
  },
  "include": ["src/**/*.ts", "types/**/*.ts", "utils/**/*.ts", "configs/**/*.ts"]
}
```

### Step 3: Migrate Library First (Foundation)

These have the fewest dependencies:

1. **Copy files to new locations:**
```bash
cp enhanced-logger.ts src/lib/logger.ts
cp config-manager.ts src/lib/config-manager.ts
cp progress-tracker.ts src/lib/progress-tracker.ts
cp prompt-optimizer.ts src/lib/prompt-optimizer.ts
cp quality-validator.ts src/lib/quality-validator.ts
```

2. **Update imports in each lib file:**
   - Change relative imports to `@/` imports
   - Update cross-lib references

3. **Create barrel export:**
```typescript
// src/lib/index.ts
export { EnhancedLogger, LogLevel } from './logger';
export { ConfigManager } from './config-manager';
export { ProgressTracker, ProgressStage } from './progress-tracker';
export { PromptOptimizer, OptimizedPrompt, TokenUsage } from './prompt-optimizer';
export { QualityValidator, ValidationResult } from './quality-validator';
```

### Step 4: Migrate Processors

1. **Copy and merge schema files:**
```bash
# Create new file combining both
cat schema.ts > src/core/processors/schema-processor.ts
cat sxema.ts >> src/core/processors/schema-processor.ts
# Manually remove duplicates and conflicts
```

2. **Copy other processors:**
```bash
cp json.ts src/core/processors/json-processor.ts
cp content-analyzer.ts src/core/processors/content-analyzer.ts
```

3. **Update imports:**
   - Replace `./enhanced-logger` with `@/lib/logger`
   - Replace `./types/slides` with `@/types/slides`

4. **Create barrel export:**
```typescript
// src/core/processors/index.ts
export * from './json-processor';
export * from './schema-processor';
export * from './content-analyzer';
```

### Step 5: Migrate Generators

1. **Copy base client:**
```bash
cp llma.ts src/core/generators/llm-client.ts
```

2. **Merge structured generators:**
   - Start with `llma-structured.ts`
   - Add classes from `integrated-generator.ts`
   - Add classes from `resilient-generator.ts`
   - Save as `src/core/generators/structured-generator.ts`

3. **Copy enhanced:**
```bash
cp llma-structured-enhanced.ts src/core/generators/enhanced-generator.ts
```

4. **Update all imports:**
   - `./schema` → `@/core/processors/schema-processor`
   - `./quality-validator` → `@/lib/quality-validator`
   - `./enhanced-logger` → `@/lib/logger`
   - etc.

5. **Create barrel export:**
```typescript
// src/core/generators/index.ts
export * from './llm-client';
export * from './structured-generator';
export * from './enhanced-generator';
```

### Step 6: Migrate Exporters

1. **Copy file:**
```bash
cp main.ts src/core/exporters/pptx-exporter.ts
```

2. **Update imports:**
   - `./types/slides` → `@/types/slides`
   - `./utils/*` → `@/utils/*`

3. **Create barrel export:**
```typescript
// src/core/exporters/index.ts
export * from './pptx-exporter';
```

### Step 7: Migrate Services

1. **Copy image services:**
```bash
cp services/image.search.ts src/services/image/image-search.ts
cp services/image-replacer.ts src/services/image/image-replacer.ts
```

2. **Copy API service:**
```bash
cp api.ts src/services/api/api-client.ts
```

3. **Update imports in all service files**

4. **Create barrel exports:**
```typescript
// src/services/image/index.ts
export * from './image-search';
export * from './image-replacer';

// src/services/api/index.ts
export * from './api-client';

// src/services/index.ts
export * from './image';
export * from './api';
```

### Step 8: Migrate Tests

1. **Copy and rename test files** according to the mapping table

2. **Update all test imports** to use `@/` paths

3. **Create test runners:**
```typescript
// src/tests/run-unit.ts
// src/tests/run-integration.ts
// src/tests/run-e2e.ts
// src/tests/run-all.ts
```

### Step 9: Create Main Entry Point

```typescript
// src/index.ts
// Export all public APIs
export * from './core/generators';
export * from './core/processors';
export * from './core/exporters';
export * from './services';
export * from './lib';
```

### Step 10: Update Package.json

```json
{
  "main": "src/index.ts",
  "scripts": {
    "start": "ts-node src/core/exporters/pptx-exporter.ts",
    "dev": "ts-node --watch src/index.ts",
    "build": "tsc",
    "test": "ts-node src/tests/run-all.ts",
    "test:unit": "ts-node src/tests/run-unit.ts",
    "test:integration": "ts-node src/tests/run-integration.ts",
    "test:e2e": "ts-node src/tests/run-e2e.ts",
    "test:image-replacer": "ts-node src/tests/integration/image-replacer.test.ts",
    "test:image-replacer:single": "ts-node src/tests/integration/image-replacer.test.ts single",
    "test:image-replacer:keywords": "ts-node src/tests/integration/image-replacer.test.ts keywords"
  }
}
```

### Step 11: Verification

1. **Check TypeScript compilation:**
```bash
npx tsc --noEmit
```

2. **Run tests:**
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

3. **Run application:**
```bash
npm start
```

### Step 12: Cleanup

Only after verification passes:

1. **Delete old files from root:**
```bash
rm api.ts
rm config-manager.ts
rm content-analyzer.ts
rm enhanced-logger.ts
rm integrated-generator.ts
rm json.ts
rm llma-structured-enhanced.ts
rm llma-structured.ts
rm llma.ts
rm main.ts
rm openaiTest.ts
rm progress-tracker.ts
rm prompt-optimizer.ts
rm quality-validator.ts
rm resilient-generator.ts
rm schema.ts
rm sxema.ts
rm test.ts
rm testContentGeneration.ts
rm testFullSxema.ts
rm testImageReplacer.ts
rm testJson.ts
rm testLlm-enhanced.ts
rm testLlm.ts
rm testSxema.ts
```

2. **Delete old services directory:**
```bash
rm -rf services/
```

3. **Commit migration:**
```bash
git add .
git commit -m "Migrate to new architecture structure"
```

## Rollback Plan

If migration fails:

```bash
git reset --hard backup-before-migration
git branch -D backup-before-migration
```

## Post-Migration Tasks

- [ ] Update documentation
- [ ] Update CI/CD pipelines
- [ ] Update deployment scripts
- [ ] Inform team of new structure
- [ ] Update onboarding docs
- [ ] Archive old branch

## Common Issues & Solutions

### Issue: Import resolution fails
**Solution:** Check `tsconfig.json` paths configuration, ensure `baseUrl` is set correctly

### Issue: Circular dependencies
**Solution:** Use barrel exports carefully, import specific modules instead of entire directories

### Issue: Tests fail after migration
**Solution:** Check test imports are updated, verify mock paths are correct

### Issue: Type definitions not found
**Solution:** Ensure `types/` directory is in `tsconfig.json` include paths

## Timeline Estimate

- Step 1-2: 15 minutes
- Step 3: 30 minutes
- Step 4: 30 minutes
- Step 5: 45 minutes
- Step 6: 20 minutes
- Step 7: 30 minutes
- Step 8: 45 minutes
- Step 9-10: 30 minutes
- Step 11: 30 minutes
- Step 12: 15 minutes

**Total: ~5-6 hours**

## Notes

- Test after each major step
- Commit after each successful phase
- Don't delete old files until verification passes
- Keep backup branch for at least one sprint
- Document any deviations from this plan
