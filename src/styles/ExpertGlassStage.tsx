import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, rise, titleStyle } from "./shared";

export const ExpertGlassStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  const drift = interpolate(frame, [0, fps * 10], [-24, 30]);

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 18% 18%, #40516a 0%, #171e28 34%, #080a0e 82%)",
        color: "#f8fafc",
        padding: "220px 86px 300px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,120,42,0.32), rgba(255,120,42,0) 68%)",
          right: -280,
          top: 280 + drift,
        }}
      />
      <div style={{ ...eyebrowStyle, color: "#aeb9c7", opacity: intro }}>EXPERT GLASS / PRESENTER</div>
      <div style={{ ...titleStyle, marginTop: 32, transform: `translateY(${rise(intro)}px)` }}>{project.title}</div>
      <div
        style={{
          marginTop: 74,
          padding: 34,
          borderRadius: 44,
          border: "1px solid rgba(255,255,255,0.34)",
          background: "linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.07))",
          backdropFilter: "blur(22px)",
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 34,
        }}
      >
        <div
          style={{
            height: 310,
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.42)",
            background: "linear-gradient(160deg, #e8edf2, #8391a3)",
            display: "grid",
            placeItems: "center",
            color: "#11151b",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          SPEAKER
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          {project.points.map((point, index) => {
            const item = enter(frame, fps, 12 + index * 8);
            return (
              <div
                key={point}
                style={{
                  borderRadius: 20,
                  background: "rgba(12,16,22,0.52)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  padding: "24px 26px",
                  fontFamily: "Arial, sans-serif",
                  fontSize: 31,
                  fontWeight: 700,
                  opacity: item,
                  transform: `translateX(${rise(item, 34)}px)`,
                }}
              >
                <span style={{ color: "#ff7a2f", fontFamily: "JetBrains Mono, monospace", marginRight: 18 }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {point}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ marginTop: 54, fontFamily: "JetBrains Mono, monospace", fontSize: 27, color: "#bec8d4" }}>
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};
