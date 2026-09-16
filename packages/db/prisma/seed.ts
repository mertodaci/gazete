import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

const sources: { name: string; rssUrl: string; category: Category }[] = [
  { name: "AA Güncel", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=guncel", category: "gundem" },
  { name: "AA Ekonomi", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi", category: "ekonomi" },
  { name: "AA Spor", rssUrl: "https://www.aa.com.tr/tr/rss/default?cat=spor", category: "spor" },
  { name: "Hürriyet Spor", rssUrl: "https://www.hurriyet.com.tr/rss/spor", category: "spor" },
  { name: "Hürriyet Gündem", rssUrl: "https://www.hurriyet.com.tr/rss/gundem", category: "gundem" },
  { name: "Hürriyet Ekonomi", rssUrl: "https://www.hurriyet.com.tr/rss/ekonomi", category: "ekonomi" },
  { name: "Bloomberg HT", rssUrl: "https://www.bloomberght.com/rss", category: "ekonomi" },
  { name: "Hürriyet Teknoloji", rssUrl: "https://www.hurriyet.com.tr/rss/teknoloji", category: "teknoloji" },
  { name: "Webrazzi", rssUrl: "https://webrazzi.com/feed/", category: "teknoloji" },
  { name: "TechCrunch AI", rssUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", category: "teknoloji" },
  { name: "Hürriyet Dünya", rssUrl: "https://www.hurriyet.com.tr/rss/dunya", category: "dunya" },
  { name: "NTV Sağlık", rssUrl: "https://www.ntv.com.tr/saglik.rss", category: "saglik" },
  // NTV retired its dedicated "Sanat" section (the old rss URL now returns a
  // soft-redirect with no real Location header, which no RSS client can
  // follow) and folded that content into "Yaşam" — this is the closest
  // living replacement for kultur_sanat coverage from this publisher.
  { name: "NTV Yaşam", rssUrl: "https://www.ntv.com.tr/yasam.rss", category: "kultur_sanat" }
];

async function main() {
  for (const source of sources) {
    await prisma.source.upsert({
      where: { rssUrl: source.rssUrl },
      update: { name: source.name, category: source.category, active: true },
      create: source
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
