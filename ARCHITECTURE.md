# Project Architecture

## Overview

This document outlines the reorganized architecture for the TypeScript presentation generation project. The new structure emphasizes maintainability, scalability, and clear separation of concerns.

## Directory Structure

```
src/
├── core/                    # Core business logic
│   ├── generators/          # LLM-based content generation
│   │   ├── llm-client.ts
│   │   ├── structured-generator.ts
│   │   ├── enhanced-generator.ts
│   │   └── index.ts
│   ├── processors/          # Data processing and transformation
│   │   ├── json-processor.ts
│   │   ├── schema-processor.ts
│   │   ├── content-analyzer.ts
│   │   └── index.ts
│   └── exporters/           # Export functionality
│       ├── pptx-exporter.ts
│       └── index.ts
│
├── services/                # External services and integrations
│   ├── image/               # Image search and replacement
│   │   ├── image-search.ts
│   │   ├── image-replacer.ts
│   │   └── index.ts
│   └── api/                 # API client services
│       ├── api-client.ts
│       └── index.ts
│
├── lib/                     # Utilities and helper functions
│   ├── logger.ts
│   ├── config-manager.ts
│   ├── progress-tracker.ts
│   ├── prompt-optimizer.ts
│   ├── quality-validator.ts
│   └── index.ts
│
├── types/                   # TypeScript type definitions (existing)
│   ├── slides.ts
│   ├── AIPPT.ts
│   ├── edit.ts
│   └── ...
│
├── utils/                   # Utility functions (existing)
│   ├── element.ts
│   ├── image.ts
│   ├── common.ts
│   └── ...
│
├── configs/                 # Configuration files (existing)
│   ├── animation.ts
│   ├── chart.ts
│   ├── theme.ts
│   └── ...
│
├── tests/                   # All test files
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── e2e/                 # End-to-end tests
│
├── schemas/                 # JSON schemas (existing)
├── templates/               # Templates (existing)
│
└── index.ts                 # Main entry point

Root directories (remain unchanged):
├── public/                  # Static assets
├── uploads/                 # User uploads
├── output/                  # Generated outputs
└── images/                  # Image assets
```

## Module Responsibilities

### Core Modules (`src/core/`)

The core modules contain the primary business logic of the application.

#### Generators (`src/core/generators/`)
Handles all LLM-based content generation:

- **llm-client.ts**: Base OpenAI client wrapper, handles API communication
  - Migrated from: `llma.ts`
  - Exports: `generateOutline()`

- **structured-generator.ts**: Structured content generation with schema validation
  - Migrated from: `llma-structured.ts` + `integrated-generator.ts` + `resilient-generator.ts`
  - Exports: `generateStructuredContent()`, `ResilientSlideGenerator`, `IntegratedSlideGenerator`

- **enhanced-generator.ts**: Advanced generation with quality checks
  - Migrated from: `llma-structured-enhanced.ts`
  - Exports: `generateEnhancedContent()`

#### Processors (`src/core/processors/`)
Data transformation and processing:

- **json-processor.ts**: JSON parsing and manipulation
  - Migrated from: `json.ts`
  - Exports: `processJSON()`, `parseSlides()`

- **schema-processor.ts**: Schema generation and validation
  - Migrated from: `schema.ts` + `sxema.ts` (merged)
  - Exports: `OutlineSchema`, `SlideSchema`, `generateFullSchema()`

- **content-analyzer.ts**: Content quality analysis
  - Migrated from: `content-analyzer.ts`
  - Exports: `ContentIntelligence`, `ElementAnalysis`

#### Exporters (`src/core/exporters/`)
Export functionality:

- **pptx-exporter.ts**: PowerPoint export logic
  - Migrated from: `main.ts`
  - Exports: `exportToPPTX()`, `formatSlide()`

### Services (`src/services/`)

External service integrations and API clients.

#### Image Services (`src/services/image/`)
- **image-search.ts**: Image search functionality
  - Migrated from: `services/image.search.ts`
  - Exports: `searchImages()`, `ImageSearchService`

- **image-replacer.ts**: Image replacement in presentations
  - Migrated from: `services/image-replacer.ts`
  - Exports: `ImageReplacer`, `replaceImagesInPPTX()`

#### API Services (`src/services/api/`)
- **api-client.ts**: External API communication
  - Migrated from: `api.ts`
  - Exports: `apiClient`, `makeRequest()`

### Library (`src/lib/`)

Reusable utilities and helper classes.

- **logger.ts**: Enhanced logging functionality
  - Migrated from: `enhanced-logger.ts`
  - Exports: `EnhancedLogger`, `LogLevel`

- **config-manager.ts**: Configuration management
  - Migrated from: `config-manager.ts`
  - Exports: `ConfigManager`

- **progress-tracker.ts**: Progress tracking
  - Migrated from: `progress-tracker.ts`
  - Exports: `ProgressTracker`, `ProgressStage`

- **prompt-optimizer.ts**: LLM prompt optimization
  - Migrated from: `prompt-optimizer.ts`
  - Exports: `PromptOptimizer`, `OptimizedPrompt`

- **quality-validator.ts**: Quality validation
  - Migrated from: `quality-validator.ts`
  - Exports: `QualityValidator`, `ValidationResult`

### Tests (`src/tests/`)

All test files organized by type:

#### Unit Tests (`src/tests/unit/`)
- `llm-client.test.ts` (from: `testLlm.ts`)
- `json-processor.test.ts` (from: `testJson.ts`)
- `schema-processor.test.ts` (from: `testSxema.ts`, `testFullSxema.ts`)

#### Integration Tests (`src/tests/integration/`)
- `content-generation.test.ts` (from: `testContentGeneration.ts`)
- `llm-enhanced.test.ts` (from: `testLlm-enhanced.ts`)
- `image-replacer.test.ts` (from: `testImageReplacer.ts`)

#### E2E Tests (`src/tests/e2e/`)
- `full-workflow.test.ts` (from: `test.ts`)
- `openai-integration.test.ts` (from: `openaiTest.ts`)

## Import Conventions

### Absolute Imports

Use TypeScript path aliases for clean imports:

```typescript
// Instead of: import { Slide } from '../../../types/slides'
import { Slide } from '@/types/slides';

// Instead of: import { logger } from '../../lib/logger'
import { logger } from '@/lib/logger';
```

### Barrel Exports

Each directory has an `index.ts` that exports all public APIs:

```typescript
// src/core/generators/index.ts
export { generateOutline } from './llm-client';
export { generateStructuredContent, ResilientSlideGenerator } from './structured-generator';
export { generateEnhancedContent } from './enhanced-generator';
```

Usage:
```typescript
import { generateOutline, generateStructuredContent } from '@/core/generators';
```

### Import Order

Follow this convention:

1. External dependencies (Node built-ins, npm packages)
2. Internal absolute imports from `@/`
3. Relative imports (if needed)

```typescript
// 1. External
import fs from 'fs';
import OpenAI from 'openai';

// 2. Internal
import { Slide } from '@/types/slides';
import { EnhancedLogger } from '@/lib/logger';

// 3. Relative (avoid when possible)
import { helperFunction } from './helpers';
```

## Migration Plan

### Phase 1: Create Structure (DONE)
- Created `src/` directory with all subdirectories
- Documented architecture in this file

### Phase 2: Migrate Core Modules
1. **Exporters**:
   - Move `main.ts` → `src/core/exporters/pptx-exporter.ts`
   - Update imports to use `@/` aliases

2. **Processors**:
   - Move `json.ts` → `src/core/processors/json-processor.ts`
   - Merge `schema.ts` + `sxema.ts` → `src/core/processors/schema-processor.ts`
   - Move `content-analyzer.ts` → `src/core/processors/content-analyzer.ts`

3. **Generators**:
   - Move `llma.ts` → `src/core/generators/llm-client.ts`
   - Merge `llma-structured.ts` + `integrated-generator.ts` + `resilient-generator.ts` → `src/core/generators/structured-generator.ts`
   - Move `llma-structured-enhanced.ts` → `src/core/generators/enhanced-generator.ts`

### Phase 3: Migrate Services
1. **Image Services**:
   - Move `services/image.search.ts` → `src/services/image/image-search.ts`
   - Move `services/image-replacer.ts` → `src/services/image/image-replacer.ts`

2. **API Services**:
   - Move `api.ts` → `src/services/api/api-client.ts`

### Phase 4: Migrate Library
- Move all utility files from root to `src/lib/`:
  - `enhanced-logger.ts` → `src/lib/logger.ts`
  - `config-manager.ts` → `src/lib/config-manager.ts`
  - `progress-tracker.ts` → `src/lib/progress-tracker.ts`
  - `prompt-optimizer.ts` → `src/lib/prompt-optimizer.ts`
  - `quality-validator.ts` → `src/lib/quality-validator.ts`

### Phase 5: Migrate Tests
- Move all test files to `src/tests/` organized by type
- Update test imports to use new structure

### Phase 6: Update Configuration
1. Update `tsconfig.json` paths
2. Update `package.json` scripts
3. Create barrel exports (`index.ts`) in each directory
4. Create main `src/index.ts` entry point

### Phase 7: Cleanup
- Delete old files from root
- Delete old `services/` directory
- Verify all imports work correctly
- Run tests to ensure nothing broke

## Adding New Features

### Adding a New Generator

1. Create file in `src/core/generators/`:
```typescript
// src/core/generators/my-new-generator.ts
import { EnhancedLogger } from '@/lib/logger';
import { Slide } from '@/types/slides';

export class MyNewGenerator {
  // Implementation
}
```

2. Export from barrel:
```typescript
// src/core/generators/index.ts
export { MyNewGenerator } from './my-new-generator';
```

3. Use in application:
```typescript
import { MyNewGenerator } from '@/core/generators';
```

### Adding a New Service

1. Determine if it's a new category or fits existing
2. Create directory if needed: `src/services/my-service/`
3. Implement service with clear interface
4. Export from barrel
5. Document in this file

### Adding Tests

1. Determine test type (unit/integration/e2e)
2. Create test file in appropriate directory
3. Follow naming convention: `*.test.ts`
4. Import from `@/` paths, not relative paths

## TypeScript Configuration

The `tsconfig.json` has been updated to support the new structure:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    // ... other options
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Package Scripts

Updated scripts for the new structure:

```json
{
  "scripts": {
    "start": "ts-node src/index.ts",
    "dev": "ts-node --watch src/index.ts",
    "build": "tsc",
    "test": "ts-node src/tests/run-all.ts",
    "test:unit": "ts-node src/tests/run-unit.ts",
    "test:integration": "ts-node src/tests/run-integration.ts",
    "test:e2e": "ts-node src/tests/run-e2e.ts"
  }
}
```

## Best Practices

### 1. Single Responsibility Principle
Each module should have one clear purpose. Don't mix concerns.

### 2. Dependency Injection
Pass dependencies through constructors instead of importing directly:

```typescript
// Good
export class MyService {
  constructor(private logger: EnhancedLogger) {}
}

// Avoid
import { logger } from '@/lib/logger';
export class MyService {
  // Direct import makes testing harder
}
```

### 3. Clear Interfaces
Define clear TypeScript interfaces for all public APIs:

```typescript
export interface GeneratorOptions {
  maxRetries: number;
  timeout: number;
}

export interface GenerationResult {
  success: boolean;
  data: any;
  metadata: GenerationMetadata;
}
```

### 4. Error Handling
Use consistent error handling patterns:

```typescript
try {
  const result = await generateContent();
  return { success: true, data: result };
} catch (error) {
  logger.error('Generation failed', error);
  return { success: false, error: error.message };
}
```

### 5. Documentation
Document all public APIs with JSDoc:

```typescript
/**
 * Generates a structured presentation outline
 * @param slides - Existing slides to analyze
 * @param language - Target language for content
 * @param page - Number of pages to generate
 * @param topic - Presentation topic
 * @returns Promise resolving to outline response
 */
export async function generateOutline(
  slides: Slide[],
  language: string,
  page: number,
  topic: string
): Promise<OutlineResponse>
```

## Migration Status

- [ ] Phase 1: Create Structure ✅ COMPLETE
- [ ] Phase 2: Migrate Core Modules
- [ ] Phase 3: Migrate Services
- [ ] Phase 4: Migrate Library
- [ ] Phase 5: Migrate Tests
- [ ] Phase 6: Update Configuration
- [ ] Phase 7: Cleanup

## Next Steps

1. Review this architecture document
2. Get approval for structure
3. Begin Phase 2 migration
4. Update imports progressively
5. Test after each phase
6. Complete cleanup

## Notes

- Keep existing `types/`, `utils/`, `configs/` directories unchanged
- Asset directories (`public/`, `uploads/`, `output/`, `images/`) remain in root
- Generated files (`.json`, `.pptx`) can stay in root temporarily
- Consider moving to `output/` directory in future
