-- CreateTable
CREATE TABLE "OutsideEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,

    CONSTRAINT "OutsideEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OutsideEvent" ADD CONSTRAINT "OutsideEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
