import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import type { ReelProject } from "../types";
import { enter, eyebrowStyle, rise, titleStyle } from "./shared";

export const AppleDefStage = ({ project, frame }: { project: ReelProject; frame: number }) => {
  const { fps } = useVideoConfig();
  const intro = enter(frame, fps);
  const float = interpolate(frame, [0, fps * 10], [-18, 24]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(165deg, #050608 0%, #111825 58%, #06070a 100%)",
        color: "#f5f7fa",
        padding: "220px 84px 300px",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 620,
          height: 620,
          borderRadius: "50%",
          left: 450,
          top: 720 + float,
          background: "radial-gradient(circle at 35% 30%, #87e9ff 0%, #3172ff 28%, #7a3cff 52%, rgba(15,20,30,0) 72%)",
          filter: "blur(6px)",
          opacity: 0.92,
        }}
      />
      <div style={{ ...eyebrowStyle, color: "#95a2b6", opacity: intro }}>APPLE DEF / PRODUCT DEPTH</div>
      <div style={{ ...titleStyle, marginTop: 32, maxWidth: 900, transform: `translateY(${rise(intro)}px)` }}>
        {project.title}
      </div>
      <div
        style={{
          position: "relative",
          marginTop: 92,
          width: 720,
          borderRadius: 48,
          border: "1px solid rgba(255,255,255,0.22)",
          background: "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))",
          backdropFilter: "blur(28px)",
          padding: "44px 46px",
        }}
      >
        {project.points.map((point, index) => {
          const item = enter(frame, fps, 14 + index * 9);
          return (
            <div
              key={point}
              style={{
                display: "grid",
                gridTemplateColumns: "54px 1fr",
                gap: 20,
                alignItems: "center",
                marginTop: index ? 28 : 0,
                opacity: item,
              }}
            >
              <span style={{ color: "#89dfff", fontFamily: "JetBrains Mono, monospace", fontSize: 24 }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 35, fontWeight: 650 }}>{point}</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "relative",
          width: "fit-content",
          marginTop: 58,
          borderRadius: 16,
          background: "rgba(4,6,10,0.78)",
          border: "1px solid rgba(255,255,255,0.16)",
          padding: "18px 22px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 27,
          color: "#dbe4f2",
        }}
      >
        {project.cta}
      </div>
    </AbsoluteFill>
  );
};
