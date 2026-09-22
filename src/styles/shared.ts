import { interpolate, spring } from "remotion";

export const ink = "#0a0a0a";
export const muted = "#66707b";
export const lime = "#c7ff1a";
export const orange = "#ff5c1a";
export const paper = "#fafafa";

export const enter = (frame: number, fps: number, delay = 0) =>
  spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 130 } });

export const rise = (value: number, amount = 48) =>
  interpolate(value, [0, 1], [amount, 0]);

export const titleStyle: React.CSSProperties = {
  fontFamily: "Benzin, Arial Black, sans-serif",
  fontWeight: 800,
  fontSize: 78,
  lineHeight: 1.04,
  letterSpacing: -1.5,
  textTransform: "uppercase",
};

export const eyebrowStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontWeight: 600,
  fontSize: 26,
  letterSpacing: 4,
};

export const bodyStyle: React.CSSProperties = {
  fontFamily: "Arial, sans-serif",
  fontSize: 34,
  lineHeight: 1.25,
};
