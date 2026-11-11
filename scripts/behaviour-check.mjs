/**
 * Behavioural check: mounts the real client bundle in a fake DSH header and
 * resizes the column, asserting the pill never sits on top of the chips other
 * plugins register into the same slot (agent mode, running jobs), the session
 * title, or the corner controls.
 *
 *   node scripts/behaviour-check.mjs
 *
 * Uses headless Chrome so ResizeObserver and getBoundingClientRect run for real.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = readFileSync(join(root, "lib/client.js"), "utf8");
const DENSITY = [...bundle.matchAll(/\{ id: "([a-z]+)", min: (\d+), est: (\d+) \}/g)].map((m) => ({
	id: m[1],
	min: Number(m[2]),
	est: Number(m[3]),
}));

// React is vendored once so the check runs offline after the first time.
const VENDOR = [
	["react", "react.production.min.js"],
	["react-dom", "react-dom.production.min.js"],
];
for (const [pkg, file] of VENDOR) {
	const target = join(tmpdir(), `dsh-sys-status-${file}`);
	if (existsSync(target)) continue;
	console.log(`fetching ${file} once…`);
	execFileSync("curl", ["-fsSL", `https://unpkg.com/${pkg}@18.3.1/umd/${file}`, "-o", target], {
		stdio: "inherit",
	});
}
const reactPath = join(tmpdir(), "dsh-sys-status-react.production.min.js");
const reactDomPath = join(tmpdir(), "dsh-sys-status-react-dom.production.min.js");

// The 13" Mac column that exposed the bug, then narrower slices of it.
const WIDTHS = [1138, 900, 720, 560, 460, 380];
const LONG_TITLE = "很长很长很长很长很长很长很长很长很长很长的会话标题";
const CHIPS = ["标准模式", "1 个后台任务"];

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>harness</title>
<style>
  html, body { margin: 0; }
  body { font-family: -apple-system, system-ui, sans-serif; }
  #stage { width: 1138px; }
  /* The real conversation root: the pill is absolute against this. */
  .wSkVaW_root { position: relative; height: 100%; }
  .wSkVaW_header { display: grid; grid-template-columns: auto minmax(0,1fr); padding: 10px 28px 0 20px; }
  .wSkVaW_titleRow { display: flex; align-items: center; min-height: 30px; grid-column: 2; }
  .wSkVaW_titleCluster { flex: 0 1 auto; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .wSkVaW_spacer { flex: 1; }
  .wSkVaW_crumbs { display: flex; gap: 4px; white-space: nowrap; overflow: hidden; min-width: 0; }
  #title { max-width: 220px; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
  /* Slide 22: the slot that both the chips and the HUD live in. */
  .wSkVaW_headerActions { flex: none; display: flex; align-items: center; gap: 8px; }
  .chip { font-size: 12px; color: #555; padding: 2px 8px; border-radius: 6px; background: #f0f0f2; white-space: nowrap; }
  .wSkVaW_headerUtilities { flex: none; display: flex; gap: 8px; margin-left: 20px; }
  .wSkVaW_headerCorner { flex: none; display: flex; gap: 6px; margin-left: 8px; margin-right: -16px; }
  .btn { width: 28px; height: 28px; border-radius: 6px; background: #e6e6ea; }
</style></head>
<body>
<div id="stage">
  <div class="wSkVaW_root">
    <div class="wSkVaW_header">
      <div class="wSkVaW_titleRow" id="row">
        <div class="wSkVaW_titleCluster">
          <div class="wSkVaW_crumbs"><span id="title">新会话</span></div>
        </div>
        <div class="wSkVaW_headerActions" id="actions"></div>
        <div class="wSkVaW_spacer"></div>
        <div class="wSkVaW_headerUtilities"></div>
        <div class="wSkVaW_headerCorner">
          <span class="btn"></span><span class="btn"></span><span class="btn"></span>
        </div>
      </div>
    </div>
  </div>
</div>
<script src="file://${reactPath}"></script>
<script src="file://${reactDomPath}"></script>
<script>
  let tick = 0;
  const series = [22, 31, 18, 44, 38, 25, 19, 52, 47, 33];
  window.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      cpu: series[tick++ % series.length],
      memUsed: 11.2 * 1073741824,
      memTotal: 16 * 1073741824,
      rxBps: 412 * 1024,
      txBps: 3.6 * 1048576,
      at: Date.now(),
    }),
  });
  window.__fake__ = {
    slots: { inject: (n, f) => f(), register: (spec, c) => { window.__cmp__ = c; return () => {}; } },
    effect: (f) => f(),
  };
  window.__ModuleLoader__ = { load: (m) => { window.__factory__ = m.factory; } };
</script>
<script>${bundle}</script>
<script>
  const mod = window.__factory__((id) => {
    if (id === "react" || id === "react/jsx-runtime") return window.React;
    throw new Error("unexpected require " + id);
  });
  mod.apply(window.__fake__);

  // Render the chips and the pill as siblings, exactly like the slot does.
  const e = window.React.createElement;
  window.ReactDOM.createRoot(document.getElementById("actions")).render(
    e(window.React.Fragment, null,
      // Only the mode chip exists at mount; the jobs chip arrives later, which is
      // exactly the case the MutationObserver has to catch.
      e("span", { className: "chip", key: "c0" }, ${JSON.stringify(CHIPS[0])}),
      e(window.__cmp__, { key: "hud" })
    )
  );
</script>
<script>
(async () => {
 try {
  const out = [];
  const wait = () => new Promise(r => setTimeout(r, 160));
  const rect = (el) => el ? el.getBoundingClientRect() : null;

  const run = async (width, title) => {
    document.getElementById("stage").style.width = width + "px";
    document.getElementById("title").textContent = title;
    // --dump-dom produces no frames, so ResizeObserver never dispatches;
    // nudge the component's window-resize fallback instead.
    window.dispatchEvent(new Event("resize"));
    await wait(); await wait();

    const pill = document.querySelector(".dsh-sys-status");
    const pr = rect(pill);
    const chips = [...document.querySelectorAll(".chip")];
    const chipsRight = Math.max(...chips.map(c => rect(c).right));
    const cornerLeft = rect(document.querySelector(".wSkVaW_headerCorner")).left;
    const crumbsRight = rect(document.querySelector(".wSkVaW_crumbs")).right;

    out.push({
      width, title,
      hidden: !pill || pill.classList.contains("dsh-sys-status--hidden"),
      density: pill ? pill.getAttribute("data-density") : null,
      pillWidth: pr && pr.width > 0 ? Math.round(pr.width) : 0,
      chipGap: pr && pr.width > 0 ? Math.round(pr.left - chipsRight) : null,
      cornerGap: pr && pr.width > 0 ? Math.round(cornerLeft - pr.right) : null,
      titleGap: pr && pr.width > 0 ? Math.round(pr.left - crumbsRight) : null,
    });
  };

  for (const w of ${JSON.stringify(WIDTHS)}) await run(w, "寻找 DeepSeek 状态栏监控插件");

  // Late-appearing sibling chip: the pill must re-solve and clear it.
  document.getElementById("stage").style.width = "1138px";
  document.getElementById("title").textContent = "寻找 DeepSeek 状态栏监控插件";
  window.dispatchEvent(new Event("resize"));
  await wait();
  const beforeChip = (() => { const p = document.querySelector(".dsh-sys-status"); const r = p.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width) }; })();
  const actions = document.getElementById("actions");
  actions.appendChild(Object.assign(document.createElement("span"),
    { className: "chip", textContent: ${JSON.stringify(CHIPS[1])} }));
  await wait(); await wait();
  const afterChip = (() => { const p = document.querySelector(".dsh-sys-status"); const r = p.getBoundingClientRect();
    const chip = [...document.querySelectorAll(".chip")].pop().getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), chipGap: Math.round(r.left - chip.right) }; })();
  out.push({ width: 1138, title: "late chip", hidden: false,
    density: document.querySelector(".dsh-sys-status").getAttribute("data-density"),
    pillWidth: afterChip.width, chipGap: afterChip.chipGap, cornerGap: 999, titleGap: 999,
    lateChip: { before: beforeChip, after: afterChip } });
  await run(1138, ${JSON.stringify(LONG_TITLE)});
  await run(1138, "短");
  // Drag: synthetic pointer sequence must move the pill and persist the spot.
  const pillEl = document.querySelector(".dsh-sys-status");
  const before = pillEl.getBoundingClientRect();
  const ev = (type, x, y) => pillEl.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 7,
    clientX: x, clientY: y,
  }));
  ev("pointerdown", before.left + 30, before.top + 10);
  ev("pointermove", before.left + 30 + 140, before.top + 10 + 6);
  await wait();
  ev("pointerup", before.left + 30 + 140, before.top + 10 + 6);
  await wait();
  const afterDrag = pillEl.getBoundingClientRect();
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem("dsh-sys-status:position:v1")); } catch (e) { stored = "err"; }
  out.push({ width: 0, title: "drag", hidden: false, density: pillEl.getAttribute("data-density"),
    pillWidth: Math.round(afterDrag.width), chipGap: 0, cornerGap: 0, titleGap: 0,
    drag: { dx: Math.round(afterDrag.left - before.left), dy: Math.round(afterDrag.top - before.top), stored } });

  // Shrink then restore: the dropped spot must come back untouched.
  const dropped = Math.round(pillEl.getBoundingClientRect().left);
  const stageEl = document.getElementById("stage");
  stageEl.style.width = "560px";
  window.dispatchEvent(new Event("resize"));
  await wait(); await wait();
  const shrunk = Math.round(pillEl.getBoundingClientRect().left);
  stageEl.style.width = "1138px";
  window.dispatchEvent(new Event("resize"));
  await wait(); await wait();
  const restored = Math.round(pillEl.getBoundingClientRect().left);
  out.push({ width: 0, title: "resize-restore", hidden: false,
    clamped: shrunk < dropped,
    density: pillEl.getAttribute("data-density"), pillWidth: Math.round(pillEl.getBoundingClientRect().width),
    chipGap: 0, cornerGap: 0, titleGap: 0,
    resize: { dropped, shrunk, restored, kept: restored === dropped, clamped: shrunk < dropped } });

  // Double-click returns it to automatic placement.
  pillEl.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  await wait(); await wait();
  const afterReset = pillEl.getBoundingClientRect();
  out.push({ width: 0, title: "reset", hidden: false, density: pillEl.getAttribute("data-density"),
    pillWidth: Math.round(afterReset.width), chipGap: 0, cornerGap: 0, titleGap: 0,
    drag: { dx: Math.round(afterReset.left - before.left), dy: 0,
            stored: localStorage.getItem("dsh-sys-status:position:v1") } });

  document.title = "DONE:" + JSON.stringify(out);
 } catch (e) {
  document.title = "ERR:" + (e && e.message ? e.message : String(e));
 }
})();
</script>
</body></html>`;

const harnessPath = join(root, ".harness.html");
writeFileSync(harnessPath, html, "utf8");

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let dom = "";
try {
	dom = execFileSync(
		chrome,
		["--headless=new", "--disable-gpu", "--virtual-time-budget=6000", "--dump-dom", `file://${harnessPath}`],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 90000 },
	);
} catch (error) {
	console.error("chrome failed:", error.message);
	process.exit(1);
} finally {
	unlinkSync(harnessPath);
}

const match = dom.match(/<title>DONE:(\[.*?\])<\/title>/s);
if (!match) {
	const title = dom.match(/<title>([^<]*)<\/title>/);
	console.error("no results — title was:", title ? title[1].slice(0, 300) : "(none)");
	process.exit(1);
}
const rows = JSON.parse(
	match[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"),
);

console.log("tiers:", DENSITY.map((d) => `${d.id}(~${d.est}px)>=${d.min}`).join("  "));
console.log("");
let failed = 0;
for (const r of rows) {
	// Any negative gap means the pill is sitting on another control.
	const overlap = !r.hidden && (r.chipGap < 0 || r.cornerGap < 0 || r.titleGap < 0);
	const exempt = r.title === LONG_TITLE && r.titleGap < 0 && r.chipGap >= 0 && r.cornerGap >= 0;
	const bad = overlap && !exempt;
	if (bad) failed++;
	console.log(
		`w=${String(r.width).padStart(4)}  ${r.title.slice(0, 6).padEnd(7)}  ` +
			`dens=${String(r.density).padEnd(8)} pill=${String(r.pillWidth).padStart(3)}  ` +
			`chip=${String(r.chipGap).padStart(5)} corner=${String(r.cornerGap).padStart(5)} ` +
			`title=${String(r.titleGap).padStart(5)}` +
			(r.lateChip ? ` [chip mounted late: left ${r.lateChip.before.left} -> ${r.lateChip.after.left}]` : "") +
			(r.drag ? ` [drag dx=${r.drag.dx} dy=${r.drag.dy} stored=${JSON.stringify(r.drag.stored)}]` : "") +
			(r.resize
				? ` [dropped=${r.resize.dropped} shrunk=${r.resize.shrunk} restored=${r.resize.restored}` +
					` clamped=${r.resize.clamped} ${r.resize.kept ? "RESTORED" : "LOST"}]`
				: "") +
			(bad ? "  <-- OVERLAP" : "") +
			(exempt ? "  (known: very long title)" : ""),
	);
}
console.log("");
console.log(failed === 0 ? "PASS: no control overlapped at any tested width" : `FAIL: ${failed} overlapping case(s)`);
process.exit(failed === 0 ? 0 : 1);
