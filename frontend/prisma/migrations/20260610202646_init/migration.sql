-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "ageConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT,
    "riskProfile" TEXT,
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssetMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "prospectus" TEXT,
    "prospectusModel" TEXT,
    "prospectusAt" DATETIME,
    "fairValue" REAL,
    "fairValueCategory" TEXT,
    "fairValueStatus" TEXT,
    "fairValueRaw" TEXT,
    "fairValueAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "walletAddress" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "usdcAmount" TEXT NOT NULL,
    "priceAfter" TEXT NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AssetMetadata_contractAddress_key" ON "AssetMetadata"("contractAddress");

-- CreateIndex
CREATE INDEX "AssetMetadata_contractAddress_idx" ON "AssetMetadata"("contractAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_txHash_key" ON "Trade"("txHash");

-- CreateIndex
CREATE INDEX "Trade_walletAddress_idx" ON "Trade"("walletAddress");

-- CreateIndex
CREATE INDEX "Trade_contractAddress_idx" ON "Trade"("contractAddress");
