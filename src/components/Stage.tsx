import type { ReelProject } from "../types";
import { OrbitStage } from "../styles/OrbitStage";
import { PrismStage } from "../styles/PrismStage";
import { PulseStage } from "../styles/PulseStage";
import { TraceStage } from "../styles/TraceStage";
import { AppleDefStage } from "../styles/AppleDefStage";
import { ExpertGlassStage } from "../styles/ExpertGlassStage";
import { PodcastStage } from "../styles/PodcastStage";
import { SquareStage } from "../styles/SquareStage";

interface StageProps {
  project: ReelProject;
  frame: number;
}

export const Stage = ({ project, frame }: StageProps) => {
  switch (project.style) {
    case "orbit":
      return <OrbitStage project={project} frame={frame} />;
    case "trace":
      return <TraceStage project={project} frame={frame} />;
    case "pulse":
      return <PulseStage project={project} frame={frame} />;
    case "expert-glass":
      return <ExpertGlassStage project={project} frame={frame} />;
    case "square":
      return <SquareStage project={project} frame={frame} />;
    case "apple-def":
      return <AppleDefStage project={project} frame={frame} />;
    case "podcast":
      return <PodcastStage project={project} frame={frame} />;
    case "prism":
    default:
      return <PrismStage project={project} frame={frame} />;
  }
};
