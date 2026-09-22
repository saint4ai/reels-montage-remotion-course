import { AbsoluteFill, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, ink, lime, muted, paper, rise, titleStyle } from "./shared";

export const PrismStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(145deg, ${paper} 0%, #f2f6ff 58%, #fff3ea 100%)`,
        padding: "245px 92px 310px",
        color: ink,
      }}
    >
      <div style={{ ...eyebrowStyle, color: muted, opacity: intro }}>{project.eyebrow}</div>
      <div style={{ ...titleStyle, marginTop: 34, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div
        style={{
          marginTop: 78,
          border: "2px solid rgba(255,255,255,0.95)",
          borderRadius: 42,
          background: "rgba(255,255,255,0.66)",
          padding: "42px 40px",
          backdropFilter: "blur(18px)",
        }}
      >
        {project.points.map((point, index) => {
          const item = enter(frame, fps, 12 + index * 8);
          return (
            <div
              key={point}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                marginTop: index ? 24 : 0,
                opacity: item,
                transform: `translateX(${rise(item, 36)}px)`,
                fontFamily: "Inter, Arial, sans-serif",
                fontSize: 36,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 15,
                  background: lime,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              {point}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 72,
          fontFamily: "Instrument Serif, Georgia, serif",
          fontStyle: "italic",
          fontSize: 47,
          color: muted,
        }}
      >
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};

