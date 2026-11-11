/**
 * Renders a self-contained design preview of the HUD pill from the real CSS in
 * `lib/client.js`, so the mock can never drift from the shipped styles.
 *
 *   node scripts/preview.mjs
 *   -> preview.html (open in a browser or screenshot with agent-browser)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "lib/client.js"), "utf8");

const match = source.match(/var CSS = `([\s\S]*?)`;\n/);
if (!match) throw new Error("could not locate the CSS template in lib/client.js");

// Read the geometry from the bundle so the mock cannot drift from it.
const SPARK_W = Number(source.match(/var SPARK_W = (\d+);/)[1]);
const SPARK_H = Number(source.match(/var SPARK_H = (\d+);/)[1]);
const SEGMENTS = Number(source.match(/var SEGMENTS = (\d+);/)[1]);

// The CSS is a runtime template literal in the bundle; resolve its placeholders
// here so the preview gets the same values the component interpolates.
const css = match[1]
	.replaceAll("${SPARK_W}", String(SPARK_W))
	.replaceAll("${SPARK_H}", String(SPARK_H))
	.replaceAll("${GRADIENT_ID}", "dsh-sys-status-spark-fill")
	.replaceAll("body[data-ds-dark-theme] ", ".theme-dark ");

function spark(values, color) {
	const innerWidth = SPARK_W - 2;
	const step = values.length === 1 ? 0 : innerWidth / (values.length - 1);
	const points = values.map((v, i) => [
		+(i * step).toFixed(2),
		+(SPARK_H - 1.5 - (v / 100) * (SPARK_H - 3)).toFixed(2),
	]);
	const last = points[points.length - 1];
	const line = points.map(([x, y]) => `${x},${y}`).join(" ");
	const area =
		points.length > 1
			? `M0,${SPARK_H} L` + points.map(([x, y]) => `${x},${y}`).join(" L") + ` L${last[0]},${SPARK_H} Z`
			: "";
	return `<svg class="dsh-sys-status__spark" viewBox="0 0 ${SPARK_W} ${SPARK_H}" preserveAspectRatio="none" style="color:${color}">
    <defs><linearGradient id="g-${color.slice(1)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
    </linearGradient></defs>
    ${area ? `<path class="dsh-sys-status__spark-area" d="${area}" fill="url(#g-${color.slice(1)})"/>` : ""}
    ${points.length > 1 ? `<polyline class="dsh-sys-status__spark-line" points="${line}"/>` : ""}
    ${last ? `<circle class="dsh-sys-status__spark-dot" cx="${last[0]}" cy="${last[1]}" r="1.5"/>` : ""}
  </svg>`;
}

function segments(percent, color) {
	const filled = Math.round((percent / 100) * SEGMENTS);
	let out = '<span class="dsh-sys-status__segbar">';
	for (let i = 0; i < SEGMENTS; i++) {
		out +=
			i < filled
				? `<span class="dsh-sys-status__seg dsh-sys-status__seg--on" style="--hud-accent:${color}"></span>`
				: '<span class="dsh-sys-status__seg"></span>';
	}
	return out + "</span>";
}

function hud({ cpu, mem, down, up, series, density = "full" }) {
	const level = (p) => (p >= 85 ? "#f85149" : p >= 65 ? "#d29922" : "#3fb950");
	const cpuColor = level(cpu);
	const memColor = level(mem);
	const tinted = (p, c) => (p >= 65 ? ` style="color:${c}"` : "");
	const showSpark = density === "full";
	const showBars = density === "full";
	const showMem = density === "full" || density === "compact";
	const showUnits = density !== "pico";
	const showUp = density !== "pico";
	const showNet = density !== "none";
	const unit = showUnits ? "/s" : "";

	let out = `<div class="dsh-sys-status${density === "none" ? " dsh-sys-status--hidden" : ""}">
  <span class="dsh-sys-status__cluster">
    <span class="dsh-sys-status__label">CPU</span>
    ${showSpark ? spark(series, cpuColor) : ""}
    <span class="dsh-sys-status__value dsh-sys-status__value--pct"${tinted(cpu, cpuColor)}>${cpu}%</span>
  </span>`;

	if (showMem) {
		out += `
  <span class="dsh-sys-status__sep"></span>
  <span class="dsh-sys-status__cluster">
    <span class="dsh-sys-status__label">MEM</span>
    ${showBars ? segments(mem, memColor) : ""}
    <span class="dsh-sys-status__value dsh-sys-status__value--pct"${tinted(mem, memColor)}>${mem}%</span>
  </span>`;
	}

	if (showNet) {
		out += `
  <span class="dsh-sys-status__sep"></span>
  <span class="dsh-sys-status__net"><span class="dsh-sys-status__arrow" style="--hud-net:#4fc1ff">↓</span><span class="dsh-sys-status__value dsh-sys-status__value--net${showUnits ? "" : " dsh-sys-status__value--net-tight"}">${down}${unit}</span></span>`;
		if (showUp) {
			out += `
  <span class="dsh-sys-status__net"><span class="dsh-sys-status__arrow" style="--hud-net:#3fb950">↑</span><span class="dsh-sys-status__value dsh-sys-status__value--net${showUnits ? "" : " dsh-sys-status__value--net-tight"}">${up}${unit}</span></span>`;
		}
	}

	return out + "\n</div>";
}

const calmSeries = [12, 9, 14, 22, 18, 11, 8, 16, 25, 30, 21, 14, 10, 7, 13, 19, 26, 22, 17, 12];
const busySeries = [55, 62, 70, 66, 73, 81, 77, 69, 64, 72, 79, 84, 76, 68, 71, 66, 74, 80, 72, 68];
const hotSeries = [78, 84, 91, 88, 93, 96, 90, 86, 92, 95, 89, 94, 97, 92, 88, 93, 96, 91, 94, 97];

const rows = [
	["full · ≥639px", { cpu: 68, mem: 74, down: "412K", up: "3.6M", series: busySeries, density: "full" }],
	["compact · ≥519px", { cpu: 68, mem: 74, down: "412K", up: "3.6M", series: busySeries, density: "compact" }],
	["minimal · ≥429px", { cpu: 68, mem: 74, down: "412K", up: "3.6M", series: busySeries, density: "minimal" }],
	["pico · ≥339px", { cpu: 68, mem: 74, down: "412K", up: "3.6M", series: busySeries, density: "pico" }],
	["<339px · 隐藏", { cpu: 68, mem: 74, down: "412K", up: "3.6M", series: busySeries, density: "none" }],
];

function panel(theme) {
	const body = rows
		.map(
			([label, data]) => `<div class="stage${data.density === "none" ? " stage--hidden" : ""}">
      <span class="stage-label">${label}</span>
      ${hud(data)}
    </div>`,
		)
		.join("\n");
	return `<section class="panel ${theme}">
  <header class="panel-head">${theme === "theme-dark" ? "深色主题" : "浅色主题"}</header>
  ${body}
</section>`;
}

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>dsh-sys-status design preview</title>
<style>
  ${css}
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 28px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    background: #f3f3f4; color: #1b1b1f;
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
  p.sub { font-size: 12px; color: #6b6b73; margin: 0 0 22px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .panel { border-radius: 16px; overflow: hidden; box-shadow: 0 0 0 0.5px rgba(0,0,0,.12), 0 8px 24px -12px rgba(0,0,0,.25); }
  .panel.theme-dark { background: #1c1c1f; }
  .panel:not(.theme-dark) { background: #ffffff; }
  .panel-head { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; padding: 14px 18px 10px; opacity: .55; }
  .theme-dark .panel-head { color: #fff; }
  .stage { position: relative; height: 82px; border-top: 0.5px solid rgba(127,127,127,.16); }
  .stage:first-of-type { border-top: none; }
  .stage .dsh-sys-status { top: 42px; }
  .stage--hidden::after {
    content: "整条隐藏，不占位";
    position: absolute; left: 50%; top: 58%; transform: translate(-50%, -50%);
    font-size: 11px; color: #9a9aa2; font-family: ui-monospace, monospace;
  }
  .stage-label { position: absolute; left: 18px; top: 9px; font-size: 11px; color: #8a8a92; font-family: ui-monospace, monospace; }
  .theme-dark .stage-label { color: #86868e; }
</style>
</head>
<body>
  <h1>dsh-sys-status · 顶部状态条</h1>
  <p class="sub">真实 CSS 渲染 · 四种状态 × 浅色/深色主题</p>
  <div class="grid">
    ${panel("theme-light")}
    ${panel("theme-dark")}
  </div>
</body>
</html>`;

writeFileSync(join(root, "preview.html"), html, "utf8");
console.log("wrote preview.html");
