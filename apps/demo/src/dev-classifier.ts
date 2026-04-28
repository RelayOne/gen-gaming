/**
 * Dev classifier — used only when no AEGIS endpoint is configured.
 * Heuristic: block prompts containing obvious unsafe keywords; allow
 * everything else. This is a stand-in until AEGIS-DETECTOR-BUILD ships.
 */

import type { AegisClassifier } from "@gen-gaming/aegis-gate";

const DENY = [
  "kill",
  "blood",
  "gore",
  "nude",
  "sexual",
  "harassment",
  "suicide",
  "csam",
];

export const devClassifier: AegisClassifier = {
  async classify({ prompt, scene }) {
    const haystack = (
      prompt +
      " " +
      scene.entities.map((e) => `${e.kind} ${e.description ?? ""}`).join(" ")
    ).toLowerCase();
    for (const word of DENY) {
      if (haystack.includes(word)) {
        return {
          verdict: "block",
          category: "policy-violation",
          rationale: `dev classifier matched keyword "${word}"`,
          latencyMs: 1,
        };
      }
    }
    return { verdict: "allow", latencyMs: 1 };
  },
};
