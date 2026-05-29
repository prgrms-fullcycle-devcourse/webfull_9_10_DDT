/*
  Warnings:

  - The primary key for the `ROOM` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ROOM` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `ROOM_MEMBER` table. All the data in the column will be lost.
  - You are about to drop the column `room_id` on the `ROOM_RESULT` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[room_code,user_id]` on the table `ROOM_MEMBER` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `room_code` to the `ROOM_MEMBER` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_code` to the `ROOM_RESULT` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ROOM_MEMBER" DROP CONSTRAINT "ROOM_MEMBER_room_id_fkey";

-- DropForeignKey
ALTER TABLE "ROOM_RESULT" DROP CONSTRAINT "ROOM_RESULT_room_id_fkey";

-- DropIndex
DROP INDEX "ROOM_code_key";

-- DropIndex
DROP INDEX "ROOM_MEMBER_room_id_user_id_key";

-- AlterTable
ALTER TABLE "ROOM" DROP CONSTRAINT "ROOM_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "ROOM_pkey" PRIMARY KEY ("code");

-- AlterTable
ALTER TABLE "ROOM_MEMBER" DROP COLUMN "room_id",
ADD COLUMN     "room_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ROOM_RESULT" DROP COLUMN "room_id",
ADD COLUMN     "room_code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ROOM_MEMBER_room_code_user_id_key" ON "ROOM_MEMBER"("room_code", "user_id");

-- AddForeignKey
ALTER TABLE "ROOM_MEMBER" ADD CONSTRAINT "ROOM_MEMBER_room_code_fkey" FOREIGN KEY ("room_code") REFERENCES "ROOM"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ROOM_RESULT" ADD CONSTRAINT "ROOM_RESULT_room_code_fkey" FOREIGN KEY ("room_code") REFERENCES "ROOM"("code") ON DELETE CASCADE ON UPDATE CASCADE;
