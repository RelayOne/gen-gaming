import type { Scene } from "@gen-gaming/regen-runtime";

export function renderScene(canvas: HTMLCanvasElement, scene: Scene): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // Clear.
  ctx.fillStyle = "#0a1018";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Map scene-units to canvas pixels.
  const sx = canvas.width / scene.width;
  const sy = canvas.height / scene.height;

  // Faint grid for context.
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < scene.width; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x * sx, 0);
    ctx.lineTo(x * sx, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < scene.height; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y * sy);
    ctx.lineTo(canvas.width, y * sy);
    ctx.stroke();
  }

  // Entities.
  for (const e of scene.entities) {
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x * sx, e.y * sy, e.w * sx, e.h * sy);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText(e.kind, e.x * sx + 3, e.y * sy + 12);
  }
}
