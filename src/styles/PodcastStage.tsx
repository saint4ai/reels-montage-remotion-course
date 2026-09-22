import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, orange, rise, titleStyle } from "./shared";

export const PodcastStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  const bars = Array.from({ length: 18 }, (_, index) => 28 + Math.abs(Math.sin((frame + index * 4) / 8)) * 92);
  const quoteShift = interpolate(frame, [0, fps * 8], [18, -12]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(155deg, #17130f 0%, #090909 66%, #111820 100%)",
        color: "#fffaf2",
        padding: "210px 82px 300px",
      }}
    >
      <div style={{ ...eyebrowStyle, color: "#c6b8a7", opacity: intro }}>PODCAST / EDITORIAL CUT</div>
      <div style={{ ...titleStyle, marginTop: 30, maxWidth: 900, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div
        style={{
          marginTop: 72,
          display: "grid",
          gridTemplateColumns: "330px 1fr",
          gap: 34,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: "50% 50% 36px 36px",
            minHeight: 460,
            background: "linear-gradient(160deg, #f2d2b6, #7a4a32 55%, #201712)",
            border: "2px solid rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 34,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          SPEAKER A
        </div>
        <div
          style={{
            borderLeft: `8px solid ${orange}`,
            padding: "24px 0 24px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transform: `translateY(${quoteShift}px)`,
          }}
        >
          <div style={{ fontFamily: "Benzin, Arial Black, sans-serif", fontSize: 116, lineHeight: 0.6, color: orange }}>“</div>
          <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 800, fontSize: 42, lineHeight: 1.14 }}>
            {project.points[0] ?? project.cta}
          </div>
          <div style={{ marginTop: 32, fontFamily: "JetBrains Mono, monospace", fontSize: 22, color: "#c6b8a7" }}>
            СИЛЬНАЯ ЗАКОНЧЕННАЯ МЫСЛЬ
          </div>
        </div>
      </div>
      <div style={{ height: 140, marginTop: 70, display: "flex", alignItems: "center", gap: 12 }}>
        {bars.map((height, index) => (
          <div key={index} style={{ width: 36, height, borderRadius: 18, background: index % 5 === 0 ? orange : "#f4eee6" }} />
        ))}
      </div>
      <div style={{ marginTop: 48, fontFamily: "JetBrains Mono, monospace", fontSize: 27, color: "#c6b8a7" }}>
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};
