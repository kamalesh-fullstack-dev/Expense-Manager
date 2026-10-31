-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Salary',
    "notes" TEXT,
    "date" DATETIME NOT NULL,
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Income_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "merchant" TEXT,
    "paymentMethod" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'Monthly',
    "anchorDay" INTEGER NOT NULL,
    "nextDate" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "accountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RecurringExpense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Bank',
    "balance" BIGINT NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#67e8f9',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("balance", "color", "createdAt", "id", "name", "type", "updatedAt", "userId") SELECT CAST(ROUND("balance" * 100) AS INTEGER), "color", "createdAt", "id", "name", "type", "updatedAt", "userId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE UNIQUE INDEX "Account_userId_name_key" ON "Account"("userId", "name");
CREATE TABLE "new_AccountTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" BIGINT NOT NULL,
    "note" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    CONSTRAINT "AccountTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AccountTransfer" ("amount", "createdAt", "date", "fromAccountId", "id", "note", "toAccountId", "updatedAt", "userId") SELECT CAST(ROUND("amount" * 100) AS INTEGER), "createdAt", "date", "fromAccountId", "id", "note", "toAccountId", "updatedAt", "userId" FROM "AccountTransfer";
DROP TABLE "AccountTransfer";
ALTER TABLE "new_AccountTransfer" RENAME TO "AccountTransfer";
CREATE INDEX "AccountTransfer_userId_date_idx" ON "AccountTransfer"("userId", "date");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "month" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("amount", "category", "createdAt", "id", "month", "updatedAt", "userId") SELECT CAST(ROUND("amount" * 100) AS INTEGER), "category", "createdAt", "id", "month", "updatedAt", "userId" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE UNIQUE INDEX "Budget_userId_category_month_key" ON "Budget"("userId", "category", "month");
CREATE TABLE "new_Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "lender" TEXT,
    "principal" BIGINT NOT NULL,
    "outstanding" BIGINT NOT NULL,
    "monthlyPayment" BIGINT NOT NULL,
    "dueDate" INTEGER,
    "interestRate" REAL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("createdAt", "dueDate", "endDate", "id", "interestRate", "lender", "monthlyPayment", "name", "outstanding", "principal", "startDate", "status", "updatedAt", "userId") SELECT "createdAt", "dueDate", "endDate", "id", "interestRate", "lender", CAST(ROUND("monthlyPayment" * 100) AS INTEGER), "name", CAST(ROUND("outstanding" * 100) AS INTEGER), CAST(ROUND("principal" * 100) AS INTEGER), "startDate", "status", "updatedAt", "userId" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "merchant" TEXT,
    "notes" TEXT,
    "paymentMethod" TEXT,
    "date" DATETIME NOT NULL,
    "accountId" TEXT,
    "debtId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("accountId", "amount", "category", "createdAt", "date", "id", "merchant", "notes", "paymentMethod", "title", "updatedAt", "userId") SELECT "accountId", CAST(ROUND("amount" * 100) AS INTEGER), "category", "createdAt", "date", "id", "merchant", "notes", "paymentMethod", "title", "updatedAt", "userId" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_userId_date_idx" ON "Expense"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Income_userId_date_idx" ON "Income"("userId", "date");

-- CreateIndex
CREATE INDEX "RecurringExpense_userId_nextDate_idx" ON "RecurringExpense"("userId", "nextDate");
