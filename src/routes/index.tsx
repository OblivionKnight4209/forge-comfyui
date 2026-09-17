import { createFileRoute } from "@tanstack/react-router";
import { Studio } from "@/components/forge/studio";
import { StoryNarrateDock } from "@/components/forge/story-narrate-dock";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <>
      <Studio />
      <StoryNarrateDock />
    </>
  );
}
