-- CreateEnum
CREATE TYPE "Category" AS ENUM ('gundem', 'ekonomi', 'teknoloji', 'spor', 'dunya', 'saglik', 'kultur_sanat');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('active', 'unsubscribed');

-- CreateEnum
CREATE TYPE "DigestStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rss_url" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_description" TEXT,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "canonical_title" TEXT NOT NULL,
    "ai_summary_tr" TEXT,
    "digest_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "story_articles" (
    "story_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,

    CONSTRAINT "story_articles_pkey" PRIMARY KEY ("story_id","article_id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'active',
    "preferences_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriber_categories" (
    "subscriber_id" TEXT NOT NULL,
    "category" "Category" NOT NULL,

    CONSTRAINT "subscriber_categories_pkey" PRIMARY KEY ("subscriber_id","category")
);

-- CreateTable
CREATE TABLE "digest_sends" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "digest_date" DATE NOT NULL,
    "sent_at" TIMESTAMP(3),
    "status" "DigestStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "digest_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_rss_url_key" ON "sources"("rss_url");

-- CreateIndex
CREATE UNIQUE INDEX "articles_url_key" ON "articles"("url");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_email_key" ON "subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_preferences_token_key" ON "subscribers"("preferences_token");

-- CreateIndex
CREATE UNIQUE INDEX "digest_sends_subscriber_id_digest_date_key" ON "digest_sends"("subscriber_id", "digest_date");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_articles" ADD CONSTRAINT "story_articles_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "story_articles" ADD CONSTRAINT "story_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_categories" ADD CONSTRAINT "subscriber_categories_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_sends" ADD CONSTRAINT "digest_sends_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
