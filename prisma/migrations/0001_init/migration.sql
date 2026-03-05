-- CreateTable: Template
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" JSONB,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "hasPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Presentation
CREATE TABLE "Presentation" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "author" TEXT,
    "fileSize" INTEGER,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "templateId" TEXT,
    "generationTime" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "qualityScore" INTEGER,
    "validationIssues" INTEGER DEFAULT 0,
    "validationFixes" INTEGER DEFAULT 0,
    "collisionsFixed" INTEGER DEFAULT 0,
    "imagesReplaced" INTEGER DEFAULT 0,
    "imagesFailed" INTEGER DEFAULT 0,
    "failedSlides" INTEGER DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT,

    CONSTRAINT "Presentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Task
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressText" TEXT,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GenerationStep
CREATE TABLE "GenerationStep" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "model" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiCallLog
CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "fromFallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ErrorLog
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Template
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");
CREATE INDEX "Template_name_idx" ON "Template"("name");

-- CreateIndex: Presentation
CREATE UNIQUE INDEX "Presentation_filename_key" ON "Presentation"("filename");
CREATE UNIQUE INDEX "Presentation_taskId_key" ON "Presentation"("taskId");
CREATE INDEX "Presentation_createdAt_idx" ON "Presentation"("createdAt");
CREATE INDEX "Presentation_topic_idx" ON "Presentation"("topic");
CREATE INDEX "Presentation_templateId_idx" ON "Presentation"("templateId");
CREATE INDEX "Presentation_status_idx" ON "Presentation"("status");

-- CreateIndex: Task
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_createdAt_idx" ON "Task"("createdAt");

-- CreateIndex: GenerationStep
CREATE INDEX "GenerationStep_presentationId_idx" ON "GenerationStep"("presentationId");
CREATE INDEX "GenerationStep_stepName_idx" ON "GenerationStep"("stepName");

-- CreateIndex: AiCallLog
CREATE INDEX "AiCallLog_operationName_idx" ON "AiCallLog"("operationName");
CREATE INDEX "AiCallLog_createdAt_idx" ON "AiCallLog"("createdAt");
CREATE INDEX "AiCallLog_model_idx" ON "AiCallLog"("model");

-- CreateIndex: ErrorLog
CREATE INDEX "ErrorLog_level_idx" ON "ErrorLog"("level");
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Presentation" ADD CONSTRAINT "Presentation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GenerationStep" ADD CONSTRAINT "GenerationStep_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "Presentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
