-- CreateTable
CREATE TABLE "Streamer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Streamer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" SERIAL NOT NULL,
    "twitchId" TEXT,
    "vodId" TEXT,
    "streamerId" INTEGER NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "live" BOOLEAN NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" SERIAL NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "streamId" INTEGER NOT NULL,
    "game" TEXT NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "segmentId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "secondsSinceStart" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Streamer_name_key" ON "Streamer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_twitchId_key" ON "Stream"("twitchId");

-- CreateIndex
CREATE UNIQUE INDEX "Stream_vodId_key" ON "Stream"("vodId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_streamId_start_key" ON "Segment"("streamId", "start");

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "Streamer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
