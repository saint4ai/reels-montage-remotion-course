import { AbsoluteFill, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, ink, lime, orange, rise, titleStyle } from "./shared";

export const SquareStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f6f4ee",
        backgroundImage: "radial-gradient(#b8b8ae 1.5px, transparent 1.5px)",
        backgroundSize: "28px 28px",
        color: ink,
        padding: "220px 84px 300px",
      }}
    >
      <div style={{ ...eyebrowStyle, opacity: intro }}>SQUARE / DOT GRID</div>
      <div style={{ ...titleStyle, marginTop: 32, maxWidth: 860, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div style={{ marginTop: 76, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        {project.points.slice(0, 4).map((point, index) => {
          const item = enter(frame, fps, 10 + index * 7);
          const accent = index === 0 ? lime : index === 3 ? orange : "#ffffff";
          return (
            <div
              key={point}
              style={{
                minHeight: 260,
                border: "3px solid #0a0a0a",
                background: accent,
                padding: 30,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: item,
                transform: `translateY(${rise(item, 38)}px)`,
              }}
            >
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 800, fontSize: 24 }}>
                [{String(index + 1).padStart(2, "0")}]
              </span>
              <span style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 36, lineHeight: 1.08 }}>
                {point}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 42,
          background: ink,
          color: "white",
          padding: "24px 28px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};
