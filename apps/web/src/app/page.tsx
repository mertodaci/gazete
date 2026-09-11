import { HomeShell } from "./HomeShell";
import { getAllStories } from "../lib/publicStories";

// This page queries the database directly, so it must render per-request,
// not be statically prerendered at `next build` time — no database is
// reachable yet during the Docker image build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await getAllStories();
  return <HomeShell stories={stories} />;
}
