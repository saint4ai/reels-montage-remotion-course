import type { ReelProject } from "../types";
import { OrbitStage } from "../styles/OrbitStage";
import { PrismStage } from "../styles/PrismStage";
import { PulseStage } from "../styles/PulseStage";
import { TraceStage } from "../styles/TraceStage";

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
    case "prism":
    default:
      return <PrismStage project={project} frame={frame} />;
  }
};

