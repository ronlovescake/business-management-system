-- CreateTable
CREATE TABLE "installed_modules" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" VARCHAR(50) NOT NULL,
    "installPath" VARCHAR(500),
    "config" JSONB NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "installedBy" VARCHAR(100),

    CONSTRAINT "installed_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_marketplace" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "version" VARCHAR(50) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "authorEmail" VARCHAR(255),
    "downloadUrl" VARCHAR(1000) NOT NULL,
    "repository" VARCHAR(500),
    "license" VARCHAR(100),
    "size" INTEGER,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "screenshots" TEXT[],
    "keywords" TEXT[],
    "config" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installed_modules_moduleId_key" ON "installed_modules"("moduleId");

-- CreateIndex
CREATE INDEX "installed_modules_moduleId_idx" ON "installed_modules"("moduleId");

-- CreateIndex
CREATE INDEX "installed_modules_enabled_idx" ON "installed_modules"("enabled");

-- CreateIndex
CREATE INDEX "installed_modules_source_idx" ON "installed_modules"("source");

-- CreateIndex
CREATE UNIQUE INDEX "module_marketplace_moduleId_key" ON "module_marketplace"("moduleId");

-- CreateIndex
CREATE INDEX "module_marketplace_moduleId_idx" ON "module_marketplace"("moduleId");

-- CreateIndex
CREATE INDEX "module_marketplace_published_idx" ON "module_marketplace"("published");

-- CreateIndex
CREATE INDEX "module_marketplace_author_idx" ON "module_marketplace"("author");

-- CreateIndex
CREATE INDEX "module_marketplace_downloads_idx" ON "module_marketplace"("downloads");
