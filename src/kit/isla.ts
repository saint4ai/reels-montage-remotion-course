import ISLA_RAW from './data/isla-sfx.json';

// Звуки public/sfx/isla: onset (начало звука), peak (удар) и длительность в секундах. Звук ставится так, чтобы удар
// пришёлся на событие: старт = время события - peak (или - onset, если нужен сам вход). Пример: reels/swap/Sym.tsx.
export const ISLA = ISLA_RAW as Record<string, {onset: number; peak: number; dur: number}>;
