export type MontageStyle =
  | "prism"
  | "orbit"
  | "trace"
  | "pulse"
  | "expert-glass"
  | "square"
  | "apple-def"
  | "podcast";

export interface CaptionSegment {
  from: number;
  to: number;
  text: string;
}

export interface ReelProject {
  title: string;
  eyebrow: string;
  style: MontageStyle;
  durationSeconds: number;
  fps: number;
  sourceVideo: string | null;
  sourceAudio: string | null;
  cta: string;
  points: string[];
  captions: CaptionSegment[];
}
