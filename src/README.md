# Source Code Directory

This directory contains the reorganized application code following clean architecture principles.

## Directory Overview

```
src/
├── core/              # Core business logic (domain layer)
├── services/          # External service integrations
├── lib/               # Shared utilities and helpers
└── tests/             # All test files
```

## Module Structure

### Core (`core/`)
The heart of the application - business logic and domain models.

- **generators/** - LLM-based content generation
- **processors/** - Data transformation and analysis
- **exporters/** - Output generation (PPTX)

### Services (`services/`)
External integrations and API clients.

- **image/** - Image search and manipulation
- **api/** - HTTP API clients

### Library (`lib/`)
Reusable utilities used across the application.

- Logger
- Configuration manager
- Progress tracking
- Prompt optimization
- Quality validation

### Tests (`tests/`)
Comprehensive test suite organized by type.

- **unit/** - Isolated component tests
- **integration/** - Multi-component tests
- **e2e/** - Full workflow tests

## Import Paths

Use TypeScript path aliases for clean imports:

```typescript
// Core modules
import { generateOutline } from '@/core/generators';
import { processJSON } from '@/core/processors';
import { exportToPPTX } from '@/core/exporters';

// Services
import { searchImages } from '@/services/image';
import { apiClient } from '@/services/api';

// Library
import { EnhancedLogger } from '@/lib';

// Types & Utils (existing directories)
import { Slide } from '@/types/slides';
import { getElementRange } from '@/utils/element';
```

## Adding New Code

### New Generator
```typescript
// src/core/generators/my-generator.ts
export class MyGenerator {
  // Implementation
}

// src/core/generators/index.ts
export { MyGenerator } from './my-generator';
```

### New Service
```typescript
// src/services/my-service/service.ts
export class MyService {
  // Implementation
}

// src/services/my-service/index.ts
export { MyService } from './service';
```

### New Utility
```typescript
// src/lib/my-utility.ts
export class MyUtility {
  // Implementation
}

// src/lib/index.ts
export { MyUtility } from './my-utility';
```

## Documentation

- **ARCHITECTURE.md** - Complete architecture guide
- **MIGRATION-PLAN.md** - Migration instructions
- **RESTRUCTURE-SUMMARY.md** - Quick overview

## Best Practices

1. **Single Responsibility** - Each module has one clear purpose
2. **Dependency Injection** - Pass dependencies, don't import globally
3. **Barrel Exports** - Use `index.ts` for clean public APIs
4. **Type Safety** - Leverage TypeScript for all APIs
5. **Testing** - Test each module in isolation

## Status

**Pre-Migration State**

The directory structure is ready, but files haven't been migrated yet. Follow the migration plan to complete the restructure.
