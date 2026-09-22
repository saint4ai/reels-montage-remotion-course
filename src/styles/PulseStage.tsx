import { AbsoluteFill, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, ink, orange, paper, rise, titleStyle } from "./shared";

export const PulseStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${paper} 0%, #f5f7fb 70%, #fff0e5 100%)`,
        color: ink,
        padding: "245px 92px 310px",
      }}
    >
      <div style={{ ...eyebrowStyle, color: "#69737e", opacity: intro }}>{project.eyebrow}</div>
      <div style={{ ...titleStyle, marginTop: 34, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 100 }}>
        {project.points.map((point, index) => {
          const item = enter(frame, fps, 12 + index * 8);
          return (
            <div
              key={point}
              style={{
                flex: 1,
                minHeight: 258,
                borderRadius: 34,
                border: "1px solid #dce2ea",
                background: "rgba(255,255,255,0.82)",
                padding: "34px 20px",
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 29,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "center",
                opacity: item,
                transform: `translateY(${rise(item, 42)}px)`,
              }}
            >
              <div style={{ fontSize: 74 }}>{["◆", "◉", "↗"][index] ?? "●"}</div>
              {point}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 92,
          width: 190,
          height: 190,
          borderRadius: "50%",
          background: orange,
          border: "4px solid #0a0a0a",
          display: "grid",
          placeItems: "center",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 70,
          fontWeight: 700,
        }}
      >
        VO
      </div>
      <div style={{ marginTop: 62, fontFamily: "Inter, Arial, sans-serif", fontSize: 33, color: "#69737e" }}>
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};

