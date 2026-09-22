import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, ink, lime, muted, orange, paper, rise, titleStyle } from "./shared";

export const TraceStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  const progress = interpolate(frame, [0, fps * 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: paper,
        backgroundImage:
          "linear-gradient(#e8ecef 1px, transparent 1px), linear-gradient(90deg, #e8ecef 1px, transparent 1px)",
        backgroundSize: "52px 52px",
        color: ink,
        padding: "245px 92px 310px",
      }}
    >
      <div style={{ ...eyebrowStyle, color: muted, opacity: intro }}>{project.eyebrow}</div>
      <div style={{ ...titleStyle, marginTop: 34, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div style={{ height: 7, width: 480 * progress, background: orange, borderRadius: 8, marginTop: 30 }} />
      <div style={{ marginTop: 130, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "Inter Tight, Inter, sans-serif", fontSize: 160, fontWeight: 800 }}>
          {Math.max(1, Math.ceil(progress * project.points.length))}
          <span style={{ color: "#9aa2aa", fontSize: 70 }}> / {project.points.length}</span>
        </div>
        <div style={{ ...eyebrowStyle, color: muted }}>ШАГА</div>
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 52 }}>
        {project.points.map((point, index) => {
          const item = enter(frame, fps, 14 + index * 9);
          return (
            <div
              key={point}
              style={{
                flex: 1,
                minHeight: 220,
                background: "rgba(255,255,255,0.85)",
                border: "1px solid #dce1e4",
                borderRadius: 28,
                padding: "30px 22px",
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 28,
                fontWeight: 650,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                opacity: item,
                transform: `translateY(${rise(item, 36)}px)`,
              }}
            >
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: muted }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              {point}
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: lime }} />
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 74, fontFamily: "Inter, Arial, sans-serif", fontSize: 33, color: muted }}>
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};

