-- DropIndex
DROP INDEX "StageScreenConfig_themeId_idx";

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastPulledAt" DATETIME,
    "lastPushedAt" DATETIME,
    "lastAckedChangeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncOutboxChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "entityUpdatedAt" DATETIME,
    "deletedAt" DATETIME,
    "ackedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncInboxChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "sourceDeviceId" TEXT NOT NULL,
    "remoteChangeId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "entityUpdatedAt" DATETIME,
    "deletedAt" DATETIME,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_workspaceId_deviceId_key" ON "SyncState"("workspaceId", "deviceId");

-- CreateIndex
CREATE INDEX "SyncOutboxChange_workspaceId_deviceId_ackedAt_id_idx" ON "SyncOutboxChange"("workspaceId", "deviceId", "ackedAt", "id");

-- CreateIndex
CREATE INDEX "SyncOutboxChange_workspaceId_id_idx" ON "SyncOutboxChange"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "SyncInboxChange_workspaceId_appliedAt_id_idx" ON "SyncInboxChange"("workspaceId", "appliedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncInboxChange_workspaceId_sourceDeviceId_remoteChangeId_key" ON "SyncInboxChange"("workspaceId", "sourceDeviceId", "remoteChangeId");
