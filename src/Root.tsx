import { Composition } from "remotion";
import projectData from "../project/project.json";
import { Reel } from "./Reel";
import type { ReelProject } from "./types";

const project = projectData as ReelProject;
const previews: Array<{ id: string; style: ReelProject["style"] }> = [
  { id: "PreviewPrism", style: "prism" },
  { id: "PreviewOrbit", style: "orbit" },
  { id: "PreviewTrace", style: "trace" },
  { id: "PreviewPulse", style: "pulse" },
];

export const RemotionRoot = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={project.fps}
      durationInFrames={Math.round(project.durationSeconds * project.fps)}
      defaultProps={{ project }}
    />
    {previews.map((preview) => (
      <Composition
        key={preview.id}
        id={preview.id}
        component={Reel}
        width={1080}
        height={1920}
        fps={project.fps}
        durationInFrames={Math.round(project.durationSeconds * project.fps)}
        defaultProps={{ project: { ...project, style: preview.style } }}
      />
    ))}
  </>
);
