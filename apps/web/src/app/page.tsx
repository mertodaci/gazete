import { HomeShell } from "./HomeShell";
import { getTodaysStories } from "../lib/publicStories";

// This page queries the database directly (today's stories), so it must
// render per-request, not be statically prerendered at `next build` time —
// no database is reachable yet during the Docker image build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await getTodaysStories();
  return <HomeShell stories={stories} />;
}
