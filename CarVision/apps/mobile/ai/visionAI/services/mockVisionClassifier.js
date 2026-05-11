/**
 * Mock “vision” classifier — keyword / heuristic scoring only (no cloud).
 * Future: replace scoring input with model label probabilities from ONNX / YOLO / API.
 */

import { CAR_PART_KNOWLEDGE } from "../data/carPartKnowledge.js";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  const n = normalize(text);
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/**
 * @param {{ uri?: string|null, fileName?: string|null, userHint?: string|null }} input
 * @returns {{ entry: object|null, score: number, hits: string[] }}
 */
export function mockClassifyVisual(input) {
  const blob = [input.fileName, input.uri, input.userHint].filter(Boolean).join(" ");
  const toks = new Set(tokens(blob));

  let best = /** @type {typeof CAR_PART_KNOWLEDGE[0] | null} */ (null);
  let bestScore = 0;
  const hits = [];

  for (const entry of CAR_PART_KNOWLEDGE) {
    let s = 0;
    const localHits = [];
    for (const kw of entry.keywords) {
      const kt = normalize(kw);
      if (!kt) continue;
      if (toks.has(kt) || blob.toLowerCase().includes(kt)) {
        s += 1.2;
        localHits.push(kw);
      } else {
        for (const t of toks) {
          if (t.includes(kt) || kt.includes(t)) {
            s += 0.55;
            localHits.push(kw);
            break;
          }
        }
      }
    }
    if (s > bestScore) {
      bestScore = s;
      best = entry;
      hits.length = 0;
      hits.push(...localHits);
    }
  }

  if (!best || bestScore < 0.5) {
    return { entry: null, score: 0, hits: [] };
  }

  return { entry: best, score: Math.min(12, bestScore), hits: [...new Set(hits)] };
}

/**
 * Map raw score to 0..1 confidence (mock calibration).
 * @param {number} score
 */
export function scoreToConfidence01(score) {
  const c = 0.35 + 0.12 * score;
  return Math.max(0.22, Math.min(0.96, c));
}
