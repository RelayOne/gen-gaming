import type { Scene } from "@gen-gaming/regen-runtime";

export function initialScene(tenantId: string): Scene {
  return {
    version: 0,
    width: 320,
    height: 180,
    tenantId,
    caption: "Initial scene. Type a prompt and hit Regenerate.",
    entities: [
      { id: "hero", kind: "hero", x: 30, y: 80, w: 16, h: 16, color: "#6cf" },
      { id: "exit", kind: "exit", x: 270, y: 80, w: 18, h: 18, color: "#9f6" },
      { id: "wall1", kind: "wall", x: 140, y: 40, w: 8, h: 100, color: "#445" },
    ],
  };
}
