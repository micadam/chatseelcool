/*
  Warnings:

  - A unique constraint covering the columns `[streamId,start]` on the table `Segment` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Segment_streamId_start_key";

-- CreateIndex
CREATE UNIQUE INDEX "Segment_streamId_start_key" ON "Segment"("streamId" DESC, "start");
