/**
 * dsh-sys-status — host half.
 *
 * Serves one read-only JSON snapshot of host load for the browser half:
 *   GET /plugins/dsh-sys-status/stats
 *     -> { cpu, memUsed, memTotal, rxBps, txBps, at }
 *
 * CPU and memory come from `node:os`; memory is refined on macOS with `vm_stat`
 * so the number matches Activity Monitor instead of counting cached pages as
 * used. Network throughput needs byte counters, which `node:os` does not expose,
 * so macOS parses `netstat -ib` and Linux reads `/proc/net/dev`.
 */
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Absolute pathname of the snapshot route. */
const STATS_PATH = "/plugins/dsh-sys-status/stats";
/** Reuse a snapshot this long so several tabs do not spawn a subprocess storm. */
const CACHE_MS = 400;
/** Give a wedged system tool this long before degrading its section. */
const TOOL_TIMEOUT_MS = 2000;

let prevCpu = os.cpus();

function cpuPercent() {
  const now = os.cpus();
  let idle = 0;
  let total = 0;
  const n = Math.min(now.length, prevCpu.length);
  for (let i = 0; i < n; i++) {
    const a = prevCpu[i].times;
    const b = now[i].times;
    const dIdle = b.idle - a.idle;
    const dTotal =
      b.user - a.user + (b.nice - a.nice) + (b.sys - a.sys) + (b.irq - a.irq) + dIdle;
    idle += dIdle;
    total += dTotal;
  }
  prevCpu = now;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - idle / total) * 100)));
}

function memoryFallback() {
  const total = os.totalmem();
  return { used: total - os.freemem(), total };
}

async function memory() {
  if (process.platform !== "darwin") return memoryFallback();
  try {
    const { stdout } = await execFileAsync("vm_stat", [], { timeout: TOOL_TIMEOUT_MS });
    const size = stdout.match(/page size of (\d+) bytes/);
    const pageSize = size ? Number(size[1]) : 16384;
    const pages = (key) => {
      const m = stdout.match(new RegExp(`${key}:\\s+(\\d+)\\.`));
      return m ? Number(m[1]) : 0;
    };
    const active = pages("Pages active");
    const wired = pages("Pages wired down");
    const compressed = pages("Pages occupied by compressor");
    const total = os.totalmem();
    const used = (active + wired + compressed) * pageSize;
    if (used > 0 && used <= total) return { used, total };
  } catch {
    // vm_stat missing or wedged — fall through to the portable estimate
  }
  return memoryFallback();
}

let prevNet = null;

async function readCounters() {
  let rx = 0;
  let tx = 0;
  if (process.platform === "darwin") {
    const { stdout } = await execFileAsync("netstat", ["-ib"], { timeout: TOOL_TIMEOUT_MS });
    for (const line of stdout.split("\n")) {
      // Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
      const f = line.trim().split(/\s+/);
      if (f.length < 10) continue;
      if (!/^en\d+$/.test(f[0])) continue;
      // `netstat -ib` prints one row per address family; only <Link#> holds counters
      if (!f[2] || !f[2].startsWith("<Link")) continue;
      rx += Number(f[6]) || 0;
      tx += Number(f[9]) || 0;
    }
  } else if (process.platform === "linux") {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile("/proc/net/dev", "utf8");
    for (const line of raw.split("\n").slice(2)) {
      const [name, rest] = line.split(":");
      if (!name || !rest) continue;
      if (name.trim() === "lo") continue;
      const f = rest.trim().split(/\s+/);
      rx += Number(f[0]) || 0;
      tx += Number(f[8]) || 0;
    }
  }
  return { rx, tx };
}

async function network() {
  const at = Date.now();
  let counters;
  try {
    counters = await readCounters();
  } catch {
    return { rxBps: 0, txBps: 0 };
  }
  const prev = prevNet;
  prevNet = { ...counters, at };
  if (prev === null) return { rxBps: 0, txBps: 0 };
  const dt = (at - prev.at) / 1000;
  if (dt <= 0) return { rxBps: 0, txBps: 0 };
  return {
    rxBps: Math.max(0, Math.round((counters.rx - prev.rx) / dt)),
    txBps: Math.max(0, Math.round((counters.tx - prev.tx) / dt)),
  };
}

let cached = null;

async function snapshot() {
  const now = Date.now();
  if (cached !== null && now - cached.at < CACHE_MS) return cached.body;
  const [mem, net] = await Promise.all([memory(), network()]);
  const body = {
    cpu: cpuPercent(),
    memUsed: mem.used,
    memTotal: mem.total,
    rxBps: net.rxBps,
    txBps: net.txBps,
    at: now,
  };
  cached = { at: now, body };
  return body;
}

export const name = "dsh-sys-status";
export const inject = ["webServer"];

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: STATS_PATH,
        resource: async (request) => {
          // Same-origin read only: a cross-site page must not read host metrics.
          if (request.headers.get("sec-fetch-site") === "cross-site") {
            return new Response(null, { status: 403 });
          }
          try {
            return new Response(JSON.stringify(await snapshot()), {
              status: 200,
              headers: {
                "content-type": "application/json; charset=utf-8",
                "cache-control": "no-store",
              },
            });
          } catch (error) {
            return new Response(JSON.stringify({ error: String(error) }), {
              status: 500,
              headers: { "content-type": "application/json; charset=utf-8" },
            });
          }
        },
      }),
    `dsh-sys-status: GET ${STATS_PATH}`,
  );
}
