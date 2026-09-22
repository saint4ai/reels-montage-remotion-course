import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, orange, rise, titleStyle } from "./shared";

export const OrbitStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  const drift = interpolate(frame, [0, fps * 12], [-18, 28]);
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 55% 42%, #182333 0%, #090d16 45%, #03050a 100%)",
        color: "#f7f6f2",
        padding: "245px 92px 310px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 920,
          height: 920,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.12)",
          left: 82,
          top: 410 + drift,
        }}
      />
      <div style={{ ...eyebrowStyle, color: "#a9b5c6", opacity: intro }}>{project.eyebrow}</div>
      <div style={{ ...titleStyle, marginTop: 34, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div style={{ marginTop: 96, display: "grid", gap: 34 }}>
        {project.points.map((point, index) => {
          const item = enter(frame, fps, 12 + index * 10);
          return (
            <div
              key={point}
              style={{
                marginLeft: index * 56,
                width: 720 - index * 28,
                border: "1px solid rgba(164,190,219,0.5)",
                borderRadius: 25,
                background: "rgba(28,46,64,0.9)",
                padding: "30px 34px",
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 39,
                fontWeight: 650,
                opacity: item,
                transform: `translateX(${rise(item, 58)}px)`,
              }}
            >
              <span>{point}</span>
              <span style={{ color: orange }}>{String(index + 1).padStart(2, "0")}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 74, fontFamily: "Inter, Arial, sans-serif", fontSize: 33, color: "#a9b5c6" }}>
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};

