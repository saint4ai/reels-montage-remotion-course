import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReelProject } from "./types";
import { Stage } from "./components/Stage";

export interface ReelProps {
  [key: string]: unknown;
  project: ReelProject;
}

export const Reel = ({ project }: ReelProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeCaption = project.captions.find(
    (caption) => frame >= caption.from * fps && frame < caption.to * fps,
  );
  const darkCaption = ["orbit", "expert-glass", "apple-def", "podcast"].includes(project.style);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fafafa", overflow: "hidden" }}>
      {project.sourceVideo ? (
        <OffthreadVideo
          src={staticFile(project.sourceVideo)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      {project.sourceAudio ? <Audio src={staticFile(project.sourceAudio)} /> : null}

      <Stage project={project} frame={frame} />

      {activeCaption ? (
        <Sequence from={Math.round(activeCaption.from * fps)}>
          <div
            style={{
              position: "absolute",
              left: 84,
              right: 168,
              bottom: 178,
              textAlign: "center",
              fontFamily: "Inter, Arial, sans-serif",
              fontSize: 38,
              lineHeight: 1.28,
              fontWeight: 500,
              color: darkCaption ? "#edf1f5" : "#56636c",
            }}
          >
            {activeCaption.text}
          </div>
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
