/**
 * Mock feature vector for Vision scans.
 * Future: replace with CNN embedding, CLIP vector, or ONNX output tensor flattened.
 *
 * @param {object} params
 * @param {string} params.matchedKnowledgeId
 * @param {number} params.confidence01
 * @param {string[]} params.matchedKeywords
 * @param {number} [params.dim=32]
 * @returns {number[]}
 */
export function buildMockVisionFeatureVector({ matchedKnowledgeId, confidence01, matchedKeywords, dim = 32 }) {
  const vec = new Array(dim).fill(0);
  const seed = hashString(`${matchedKnowledgeId}|${(matchedKeywords || []).join(",")}`);
  vec[0] = clamp01(confidence01);
  vec[1] = (seed % 997) / 997;
  vec[2] = matchedKeywords?.length ? Math.min(1, matchedKeywords.length / 8) : 0;
  for (let i = 3; i < dim; i++) {
    vec[i] = pseudoRand(seed + i * 131);
  }
  return vec;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pseudoRand(n) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
