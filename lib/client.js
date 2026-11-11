/**
 * dsh-sys-status — browser half.
 *
 * Registers a compact instrument pill into the session header's utility slot,
 * then positions it absolutely so it centres on the conversation column
 * (the middle of the top strip) instead of riding the right-aligned slot.
 *
 * Styling lives in one injected stylesheet rather than inline styles so the
 * light and dark themes can each get their own hairline, highlight and shadow.
 */
window.__ModuleLoader__.load({
	id: "dsh-sys-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		var React = require("react");
		var h = React.createElement;

		var STATS_PATH = "/plugins/dsh-sys-status/stats";
		var POLL_MS = 2000;
		var HISTORY = 30;
		var STYLE_ID = "dsh-sys-status-styles";
		var POS_KEY = "dsh-sys-status:position:v1";
		var AUTO_TOP = 13;
		var GRADIENT_ID = "dsh-sys-status-spark-fill";
		var SPARK_W = 32;
		var SPARK_H = 13;
		var SEGMENTS = 9;
		// Progressive density by the width of the column the pill is centred on.
		// Thresholds are the pill's own need plus clearance for the header's
		// left-hand crumbs and mode controls, which share the same row.
		var DENSITY = [
			{ id: "full", min: 639, est: 372 },
			{ id: "compact", min: 519, est: 288 },
			{ id: "minimal", min: 429, est: 216 },
			{ id: "pico", min: 339, est: 156 },
		];

		var CSS = `
.dsh-sys-status {
  --hud-sep: rgba(0, 0, 0, 0.09);
  --hud-empty: rgba(0, 0, 0, 0.085);
  --hud-sheen: rgba(255, 255, 255, 0.85);
  --hud-surface: rgba(255, 255, 255, 0.72);
  --hud-ring: rgba(0, 0, 0, 0.10);
  position: absolute;
  left: 0;
  top: 13px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 24px;
  padding: 0 13px;
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  cursor: grab;
  max-width: 100%;
  touch-action: none;
  background: var(--hud-surface);
  backdrop-filter: blur(18px) saturate(1.6);
  -webkit-backdrop-filter: blur(18px) saturate(1.6);
  box-shadow:
    0 0 0 0.5px var(--hud-ring),
    0 1px 0 0 inset var(--hud-sheen),
    0 2px 3px -1px rgba(0, 0, 0, 0.07),
    0 8px 20px -8px rgba(0, 0, 0, 0.16);
  transition-property: transform, box-shadow;
  transition-duration: 180ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
.dsh-sys-status:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 0.5px var(--hud-ring),
    0 1px 0 0 inset var(--hud-sheen),
    0 3px 6px -2px rgba(0, 0, 0, 0.09),
    0 12px 28px -10px rgba(0, 0, 0, 0.22);
}
body[data-ds-dark-theme] .dsh-sys-status {
  --hud-sep: rgba(255, 255, 255, 0.10);
  --hud-empty: rgba(255, 255, 255, 0.11);
  --hud-sheen: rgba(255, 255, 255, 0.06);
  --hud-surface: rgba(38, 38, 42, 0.72);
  --hud-ring: rgba(255, 255, 255, 0.09);
  box-shadow:
    0 0 0 0.5px var(--hud-ring),
    0 1px 0 0 inset var(--hud-sheen),
    0 2px 3px -1px rgba(0, 0, 0, 0.28),
    0 10px 24px -8px rgba(0, 0, 0, 0.52);
}
body[data-ds-dark-theme] .dsh-sys-status:hover {
  box-shadow:
    0 0 0 0.5px var(--hud-ring),
    0 1px 0 0 inset var(--hud-sheen),
    0 3px 6px -2px rgba(0, 0, 0, 0.34),
    0 14px 32px -10px rgba(0, 0, 0, 0.60);
}
.dsh-sys-status--hidden {
  display: none;
}
.dsh-sys-status[data-dragging="true"] {
  cursor: grabbing;
  transform: none;
  transition-duration: 1ms;
}
.dsh-sys-status__cluster {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
}
.dsh-sys-status__label {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.085em;
  line-height: 1;
  color: var(--dsw-alias-label-caption, #9a9a9a);
}
.dsh-sys-status__value {
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-secondary, #5a5a5a);
  transition-property: color;
  transition-duration: 260ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
.dsh-sys-status__value--pct {
  min-width: 4ch;
  text-align: right;
}
.dsh-sys-status__value--net {
  min-width: 6ch;
  text-align: right;
}
.dsh-sys-status__value--net-tight {
  min-width: 4ch;
}
.dsh-sys-status__sep {
  flex: none;
  width: 1px;
  height: 11px;
  border-radius: 1px;
  background: var(--hud-sep);
}
.dsh-sys-status__spark {
  display: block;
  width: ${SPARK_W}px;
  height: ${SPARK_H}px;
  overflow: visible;
  flex: none;
}
.dsh-sys-status__spark-line {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsh-sys-status__spark-dot {
  fill: currentColor;
}
.dsh-sys-status__spark-area {
  fill: url(#${GRADIENT_ID});
}
.dsh-sys-status__segbar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
}
.dsh-sys-status__seg {
  width: 3px;
  height: 9px;
  border-radius: 1px;
  background: var(--hud-empty);
  transition-property: background-color;
  transition-duration: 260ms;
  transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
.dsh-sys-status__seg--on {
  background: var(--hud-accent);
}
.dsh-sys-status__net {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
}
.dsh-sys-status__arrow {
  font-size: 10px;
  line-height: 1;
  color: var(--hud-net);
  transform: translateY(-0.5px);
}
@media (prefers-reduced-motion: reduce) {
  .dsh-sys-status,
  .dsh-sys-status__value,
  .dsh-sys-status__seg {
    transition-duration: 1ms;
  }
}
`;

		var LEVEL = {
			calm: "#3fb950",
			warm: "#d29922",
			hot: "#f85149",
		};

		function ensureStyles() {
			var existing = document.getElementById(STYLE_ID);
			if (existing) return null;
			var style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = CSS;
			document.head.appendChild(style);
			return function () {
				if (style.parentNode) style.parentNode.removeChild(style);
			};
		}

		function levelOf(pct) {
			if (pct >= 85) return LEVEL.hot;
			if (pct >= 65) return LEVEL.warm;
			return LEVEL.calm;
		}

		function formatRate(bytes) {
			if (!bytes || bytes < 1) return "0";
			var units = ["B", "K", "M", "G"];
			var i = 0;
			var v = bytes;
			while (v >= 1024 && i < units.length - 1) {
				v /= 1024;
				i++;
			}
			var text = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(1);
			if (text === "0.0") text = "0";
			return text + units[i];
		}

		function formatMem(bytes) {
			if (!bytes || bytes < 1) return "0";
			var g = bytes / 1073741824;
			return g >= 1 ? g.toFixed(1) + "G" : Math.round(bytes / 1048576) + "M";
		}

		/** Points for the CPU sparkline, oldest sample on the left. */
		function sparkPoints(values) {
			if (values.length === 0) return [];
			var innerWidth = SPARK_W - 2;
			var step = values.length === 1 ? 0 : innerWidth / (values.length - 1);
			return values.map(function (value, index) {
				var clamped = Math.max(0, Math.min(100, value)) / 100;
				return {
					x: Number((index * step).toFixed(2)),
					y: Number((SPARK_H - 1.5 - clamped * (SPARK_H - 3)).toFixed(2)),
				};
			});
		}

		function Spark(props) {
			var points = props.points;
			var line = points.map((p) => p.x + "," + p.y).join(" ");
			var last = points[points.length - 1];
			var area =
				points.length > 1
					? "M0," + SPARK_H + " L" + points.map((p) => p.x + "," + p.y).join(" L") + " L" + last.x + "," + SPARK_H + " Z"
					: "";
			return h(
				"svg",
				{
					className: "dsh-sys-status__spark",
					viewBox: "0 0 " + SPARK_W + " " + SPARK_H,
					preserveAspectRatio: "none",
					"aria-hidden": "true",
					style: { color: props.color },
				},
				h(
					"defs",
					null,
					h(
						"linearGradient",
						{ id: GRADIENT_ID, x1: "0", y1: "0", x2: "0", y2: "1" },
						h("stop", { offset: "0%", stopColor: "currentColor", stopOpacity: 0.42 }),
						h("stop", { offset: "100%", stopColor: "currentColor", stopOpacity: 0 }),
					),
				),
				area ? h("path", { className: "dsh-sys-status__spark-area", d: area }) : null,
				points.length > 1 ? h("polyline", { className: "dsh-sys-status__spark-line", points: line }) : null,
				last
					? h("circle", {
							className: "dsh-sys-status__spark-dot",
							cx: last.x,
							cy: last.y,
							r: 1.5,
						})
					: null,
			);
		}

		function Segments(props) {
			var filled = Math.round((props.percent / 100) * SEGMENTS);
			var children = [];
			for (var i = 0; i < SEGMENTS; i++) {
				children.push(
					h("span", {
						key: i,
						className:
							"dsh-sys-status__seg" + (i < filled ? " dsh-sys-status__seg--on" : ""),
						style: i < filled ? { "--hud-accent": props.color } : undefined,
					}),
				);
			}
			return h("span", { className: "dsh-sys-status__segbar" }, children);
		}

		/** Pick the density tier whose minimum width the container still satisfies. */
		function densityFor(width) {
			for (var i = 0; i < DENSITY.length; i++) {
				if (width >= DENSITY[i].min) return DENSITY[i].id;
			}
			return "none";
		}

		/**
		 * Limit an intended position to the column without recording the limit, so
		 * the intent survives a temporary shrink.
		 * @param intended - the dropped position.
		 * @param host - the containing column, or null before the first measure.
		 * @param pill - the rendered pill, or null before the first paint.
		 * @returns the position to render.
		 */
		function clampPos(intended, host, pill) {
			if (!host || !pill) return intended;
			return {
				left: Math.max(0, Math.min(Math.max(0, host.width - pill.width), intended.left)),
				top: Math.max(0, Math.min(Math.max(0, host.height - pill.height), intended.top)),
			};
		}

		/**
		 * Centre the pill in the title row when nothing is in the way; otherwise push
		 * it past the chips and shrink until it fits the remaining band. Centring is
		 * a preference, never a reason to sit on top of another control.
		 * @param band - measured row geometry, the chip edge and the trailing bound.
		 * @param widthOf - resolves a tier's rendered width (measured, then estimate).
		 * @returns the tier to render and its centre offset from the containing block.
		 */
		function place(band, widthOf) {
			var startIndex = DENSITY.findIndex(function (tier) {
				return tier.id === band.floor;
			});
			if (startIndex < 0) startIndex = DENSITY.length;

			var gapStart = band.chipsRight + 12;
			for (var i = startIndex; i < DENSITY.length; i++) {
				var width = widthOf(DENSITY[i].id);
				if (width <= 0) continue;
				var left = band.rowLeft + band.rowWidth / 2 - width / 2;
				if (left < gapStart) left = gapStart;
				if (left + width + 12 > band.rightBound) continue;
				return { tier: DENSITY[i].id, left: Math.round(left - band.hostLeft) };
			}
			return { tier: "none", left: null };
		}

		function sep(key) {
			return h("span", { key: key, className: "dsh-sys-status__sep" });
		}

		function cluster(key, children) {
			return h("span", { key: key, className: "dsh-sys-status__cluster" }, children);
		}

		/** Live CPU / memory / network instrument for the top of the conversation. */
		function HwHud() {
			var state = React.useState(null);
			var stats = state[0];
			var setStats = state[1];

			var histState = React.useState([]);
			var history = histState[0];
			var setHistory = histState[1];

			var tierState = React.useState("full");
			var tier = tierState[0];
			var setTier = tierState[1];

			var autoState = React.useState(null);
			var autoPos = autoState[0];
			var setAutoPos = autoState[1];

			var manualState = React.useState(null);
			var manualPos = manualState[0];
			var setManualPos = manualState[1];

			var manualRef = React.useRef(null);
			var dragRef = React.useRef(null);

			var dragState = React.useState(false);
			var dragging = dragState[0];
			var setDragging = dragState[1];

			var hostBoxState = React.useState(null);
			var hostBox = hostBoxState[0];
			var setHostBox = hostBoxState[1];

			var pillBoxState = React.useState(null);
			var pillBox = pillBoxState[0];
			var setPillBox = pillBoxState[1];

			// `manualPos` is the user's intent and is never rewritten. The visible
			// position is derived from it against the *current* column size, so
			// shrinking the window hides part of it and growing back restores it
			// exactly where it was dropped.
			var pos = manualPos === null ? autoPos : clampPos(manualPos, hostBox, pillBox);

			var nodeRef = React.useRef(null);
			var observerRef = React.useRef(null);
			var bandRef = React.useRef(null);
			// Real rendered width per tier, filled in after the first paint of each.
			// Nothing here is hard-coded: a tier's estimate is only a seed for the
			// very first frame, and is replaced by the measured value immediately.
			var widthsRef = React.useRef({});

			var widthOf = React.useCallback(function (id) {
				var measured = widthsRef.current[id];
				if (measured > 0) return measured;
				for (var i = 0; i < DENSITY.length; i++) {
					if (DENSITY[i].id === id) return DENSITY[i].est;
				}
				return 0;
			}, []);

			/** Re-solve placement against the current band and the known widths. */
			var resolve = React.useCallback(function () {
				var band = bandRef.current;
				if (band === null) return;
				if (manualRef.current !== null) {
					setTier(densityFor(band.rowWidth));
					return;
				}
				var placed = place(band, widthOf);
				setTier(placed.tier);
				setAutoPos(placed.left === null ? null : { left: placed.left, top: AUTO_TOP });
			}, [widthOf]);

			// A stable callback ref: the pill renders nothing until the first sample,
			// so an effect with `[]` deps would run before the node exists.
			var setRoot = React.useCallback(
				function (node) {
					nodeRef.current = node;
					if (observerRef.current !== null) {
						observerRef.current.disconnect();
						observerRef.current = null;
					}
					if (!node) return;

					var row = node.closest('[class*="titleRow"]') || node.offsetParent;
					if (!row) {
						setTier(densityFor(window.innerWidth));
						return;
					}
					var host = node.offsetParent || node.parentElement;
					if (!host) return;

					function measure() {
						var rect = row.getBoundingClientRect();
						if (rect.width <= 0) return;

						// Other plugins register chips (agent mode, running jobs) into this
						// very slot, so the free band starts after them. Measure the chips
						// themselves — the slot box is only as wide as its contents.
						var chipsRight = rect.left;
						var slot = node.parentElement;
						if (slot) {
							for (var i = 0; i < slot.children.length; i++) {
								var child = slot.children[i];
								if (child === node) continue;
								var childBox = child.getBoundingClientRect();
								if (childBox.width > 0 && childBox.right > chipsRight) {
									chipsRight = childBox.right;
								}
							}
						}

						// The band ends at the header's own trailing controls. Query them by
						// role rather than walking siblings: the row holds flexible spacers
						// that look like the next occupant but occupy no real room.
						var rightBound = rect.right;
						var anchors = row.querySelectorAll(
							'[class*="headerUtilities"], [class*="headerCorner"]',
						);
						for (var a = 0; a < anchors.length; a++) {
							var anchorBox = anchors[a].getBoundingClientRect();
							if (anchorBox.width > 0 && anchorBox.left < rightBound) {
								rightBound = anchorBox.left;
							}
						}

						var hostRect = host.getBoundingClientRect();
						bandRef.current = {
							rowLeft: rect.left,
							rowWidth: rect.width,
							chipsRight: chipsRight,
							rightBound: rightBound,
							hostLeft: hostRect.left,
							floor: densityFor(rect.width),
						};
						setHostBox({ width: hostRect.width, height: hostRect.height });
						resolve();
					}

					measure();
					// Three triggers on purpose:
					//  - ResizeObserver for column changes the window never hears about
					//    (sidebar toggle, right panel);
					//  - window resize for environments that throttle frames;
					//  - MutationObserver because sibling chips mount *after* this pill and
					//    do not change the row's width, so nothing else would notice them.
					//    Without it the free band keeps starting at the row's left edge and
					//    the pill sits on top of a job counter that appeared later.
					window.addEventListener("resize", measure);
					var observer =
						typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
					if (observer !== null) observer.observe(row);
					var mutations =
						typeof MutationObserver === "undefined"
							? null
							: new MutationObserver(measure);
					if (mutations !== null && node.parentElement) {
						mutations.observe(node.parentElement, { childList: true });
					}
					observerRef.current = {
						disconnect: function () {
							window.removeEventListener("resize", measure);
							if (observer !== null) observer.disconnect();
							if (mutations !== null) mutations.disconnect();
						},
					};
				},
				[resolve],
			);


			/** Restore a dragged position saved by an earlier visit. */
			React.useEffect(function () {
				try {
					var raw = window.localStorage.getItem(POS_KEY);
					if (!raw) return;
					var saved = JSON.parse(raw);
					if (typeof saved.left !== "number" || typeof saved.top !== "number") return;
					manualRef.current = { left: saved.left, top: saved.top };
					setManualPos(manualRef.current);
				} catch (error) {
					/* private mode or corrupt payload: keep the automatic position */
				}
			}, []);

			function clampToHost(left, top) {
				var node = nodeRef.current;
				var host = node && (node.offsetParent || node.parentElement);
				if (!node || !host) return { left: left, top: top };
				var hostBox = host.getBoundingClientRect();
				var maxLeft = Math.max(0, hostBox.width - node.offsetWidth);
				var maxTop = Math.max(0, hostBox.height - node.offsetHeight);
				return {
					left: Math.max(0, Math.min(maxLeft, Math.round(left))),
					top: Math.max(0, Math.min(maxTop, Math.round(top))),
				};
			}

			function onPointerDown(event) {
				if (event.button !== 0 || !nodeRef.current) return;
				var box = nodeRef.current.getBoundingClientRect();
				dragRef.current = {
					offsetX: event.clientX - box.left,
					offsetY: event.clientY - box.top,
					id: event.pointerId,
				};
				setDragging(true);
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch (error) {
					/* capture is an optimisation for leaving the element mid-drag */
				}
				event.preventDefault();
			}

			function onPointerMove(event) {
				var drag = dragRef.current;
				var node = nodeRef.current;
				if (!drag || !node) return;
				var host = node.offsetParent || node.parentElement;
				if (!host) return;
				var hostBox = host.getBoundingClientRect();
				var next = clampToHost(
					event.clientX - drag.offsetX - hostBox.left,
					event.clientY - drag.offsetY - hostBox.top,
				);
				manualRef.current = next;
				setManualPos(next);
			}

			function onPointerUp(event) {
				if (!dragRef.current) return;
				dragRef.current = null;
				setDragging(false);
				try {
					event.currentTarget.releasePointerCapture(event.pointerId);
				} catch (error) {
					/* already released */
				}
				if (manualRef.current === null) return;
				try {
					window.localStorage.setItem(POS_KEY, JSON.stringify(manualRef.current));
				} catch (error) {
					/* a read-only storage must not break dragging */
				}
			}

			/** Double-click forgets the saved spot and returns to automatic placement. */
			function onReset() {
				manualRef.current = null;
				setManualPos(null);
				try {
					window.localStorage.removeItem(POS_KEY);
				} catch (error) {
					/* ignore */
				}
				// The automatic spot was not recomputed while the manual one was in
				// force, so re-solve it now rather than snapping to a stale position.
				resolve();
			}

			// After each paint, record the tier's true width and correct if the seed
			// estimate was too optimistic for the band we actually have.
			React.useLayoutEffect(function () {
				var node = nodeRef.current;
				var band = bandRef.current;
				if (!node || !band || tier === "none") return;
				var measured = node.getBoundingClientRect().width;
				if (measured <= 0) return;
				if (widthsRef.current[tier] !== measured) widthsRef.current[tier] = measured;
				var height = node.getBoundingClientRect().height;
				if (!pillBox || pillBox.width !== measured || pillBox.height !== height) {
					setPillBox({ width: measured, height: height });
				}

				if (manualRef.current !== null) return;
				var gapStart = band.chipsRight + 12;
				var realLeft = node.getBoundingClientRect().left;
				var overflows = realLeft < gapStart - 0.5 || realLeft + measured + 12 > band.rightBound + 0.5;
				if (!overflows) return;

				var placed = place(band, widthOf);
				if (placed.tier !== tier) setTier(placed.tier);
				else if (placed.left !== null && autoPos !== null && placed.left !== autoPos.left) {
					setAutoPos({ left: placed.left, top: AUTO_TOP });
				}
			});

			React.useEffect(function () {
				if (tier === "none") return;
				var alive = true;
				var timer = null;

				function poll() {
					fetch(STATS_PATH, { headers: { accept: "application/json" } })
						.then(function (response) {
							return response.ok ? response.json() : null;
						})
						.then(function (body) {
							if (!alive || !body) return;
							setStats(body);
							setHistory(function (previous) {
								return previous.concat([body.cpu]).slice(-HISTORY);
							});
						})
						.catch(function () {
							/* keep the last known reading */
						});
				}

				function start() {
					if (timer !== null) return;
					poll();
					timer = setInterval(poll, POLL_MS);
				}

				function stop() {
					if (timer === null) return;
					clearInterval(timer);
					timer = null;
				}

				function onVisibility() {
					if (document.hidden) stop();
					else start();
				}

				document.addEventListener("visibilitychange", onVisibility);
				if (!document.hidden) start();

				return function () {
					alive = false;
					document.removeEventListener("visibilitychange", onVisibility);
					stop();
				};
			}, [tier]);

			if (!stats) return null;

			var density = tier;
			var memPercent =
				stats.memTotal > 0 ? Math.round((stats.memUsed / stats.memTotal) * 100) : 0;
			var cpuColor = levelOf(stats.cpu);
			var memColor = levelOf(memPercent);

			var tooltip = [
				"CPU  " + stats.cpu + "%",
				"内存  " + formatMem(stats.memUsed) + " / " + formatMem(stats.memTotal) + "  (" + memPercent + "%)",
				"下载  " + formatRate(stats.rxBps) + "/s",
				"上传  " + formatRate(stats.txBps) + "/s",
				"",
				"拖动可移动位置，双击复位",
			].join("\n");

			var showSpark = density === "full";
			var showBars = density === "full";
			var showMem = density === "full" || density === "compact";
			var showUnits = density !== "pico";
			var showUp = density !== "pico";
			var showNet = density !== "none";

			var parts = [];

			parts.push(
				cluster("cpu", [
					h("span", { key: "l", className: "dsh-sys-status__label" }, "CPU"),
					showSpark ? h(Spark, { key: "s", points: sparkPoints(history), color: cpuColor }) : null,
					h(
						"span",
						{
							key: "v",
							className: "dsh-sys-status__value dsh-sys-status__value--pct",
							style: stats.cpu >= 65 ? { color: cpuColor } : undefined,
						},
						stats.cpu + "%",
					),
				]),
			);

			if (showMem) {
				parts.push(sep("s1"));
				parts.push(
					cluster("mem", [
						h("span", { key: "l", className: "dsh-sys-status__label" }, "MEM"),
						showBars ? h(Segments, { key: "b", percent: memPercent, color: memColor }) : null,
						h(
							"span",
							{
								key: "v",
								className: "dsh-sys-status__value dsh-sys-status__value--pct",
								style: memPercent >= 65 ? { color: memColor } : undefined,
							},
							memPercent + "%",
						),
					]),
				);
			}

			if (showNet) {
				parts.push(sep("s2"));
				parts.push(
					h(
						"span",
						{ key: "net", className: "dsh-sys-status__net" },
						h(
							"span",
							{ className: "dsh-sys-status__arrow", style: { "--hud-net": "#4fc1ff" } },
							"↓",
						),
						h(
							"span",
							{
								className:
									"dsh-sys-status__value dsh-sys-status__value--net" +
									(showUnits ? "" : " dsh-sys-status__value--net-tight"),
							},
							formatRate(stats.rxBps) + (showUnits ? "/s" : ""),
						),
					),
				);
				if (showUp) {
					parts.push(
						h(
							"span",
							{ key: "netup", className: "dsh-sys-status__net" },
							h(
								"span",
								{ className: "dsh-sys-status__arrow", style: { "--hud-net": "#3fb950" } },
								"↑",
							),
							h(
								"span",
								{
									className:
										"dsh-sys-status__value dsh-sys-status__value--net" +
										(showUnits ? "" : " dsh-sys-status__value--net-tight"),
								},
								formatRate(stats.txBps) + (showUnits ? "/s" : ""),
							),
						),
					);
				}
			}

			return h(
				"div",
				{
					ref: setRoot,
					"data-density": density,
					className: "dsh-sys-status" + (density === "none" ? " dsh-sys-status--hidden" : ""),
					title: tooltip,
					"aria-label": "CPU " + stats.cpu + "%, 内存 " + memPercent + "%, 下载 " + formatRate(stats.rxBps) + "/s, 上传 " + formatRate(stats.txBps) + "/s",
					"data-dragging": dragging ? "true" : undefined,
					onPointerDown: onPointerDown,
					onPointerMove: onPointerMove,
					onPointerUp: onPointerUp,
					onPointerCancel: onPointerUp,
					onDoubleClick: onReset,
					// Until a position exists there is no anchor; stay invisible instead
					// of flashing at the stylesheet default.
					style:
						pos === null
							? { visibility: "hidden" }
							: { left: pos.left + "px", top: pos.top + "px" },
				},
				parts,
			);
		}

		var inject = ["slots"];

		function apply(ctx) {
			ctx.effect(ensureStyles, "dsh-sys-status: styles");
			// `header.actions` has no margin of its own, so an absolutely positioned
			// child leaves the row's geometry untouched; `header.utilities` would
			// add its 20px margin-left once the slot stops being empty.
			ctx.slots.inject("conversation.session.header.actions", function () {
				return ctx.slots.register(
					{
						name: "conversation.session.header.actions",
						id: "dsh-sys-status",
						order: 10,
					},
					HwHud,
				);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
