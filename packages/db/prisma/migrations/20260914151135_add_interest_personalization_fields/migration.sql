-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "interest_embedding" DOUBLE PRECISION[];

-- AlterTable
ALTER TABLE "subscribers" ADD COLUMN     "interest_embedding" DOUBLE PRECISION[],
ADD COLUMN     "interest_text" TEXT;
