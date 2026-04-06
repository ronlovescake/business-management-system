-- CreateTable
CREATE TABLE "message_hidden_for_users" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_hidden_for_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_hidden_for_users_messageId_userId_key" ON "message_hidden_for_users"("messageId", "userId");

-- CreateIndex
CREATE INDEX "message_hidden_for_users_messageId_idx" ON "message_hidden_for_users"("messageId");

-- CreateIndex
CREATE INDEX "message_hidden_for_users_userId_idx" ON "message_hidden_for_users"("userId");

-- CreateIndex
CREATE INDEX "message_hidden_for_users_hiddenAt_idx" ON "message_hidden_for_users"("hiddenAt");

-- AddForeignKey
ALTER TABLE "message_hidden_for_users" ADD CONSTRAINT "message_hidden_for_users_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_hidden_for_users" ADD CONSTRAINT "message_hidden_for_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
