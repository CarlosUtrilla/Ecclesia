-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastPulledAt" DATETIME,
    "lastPushedAt" DATETIME,
    "lastAckedChangeId" INTEGER,
    "lastAppliedSnapshotAt" DATETIME,
    "snapshotApplySequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SyncState" ("createdAt", "deviceId", "id", "lastAckedChangeId", "lastPulledAt", "lastPushedAt", "updatedAt", "workspaceId") SELECT "createdAt", "deviceId", "id", "lastAckedChangeId", "lastPulledAt", "lastPushedAt", "updatedAt", "workspaceId" FROM "SyncState";
DROP TABLE "SyncState";
ALTER TABLE "new_SyncState" RENAME TO "SyncState";
CREATE UNIQUE INDEX "SyncState_workspaceId_deviceId_key" ON "SyncState"("workspaceId", "deviceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
