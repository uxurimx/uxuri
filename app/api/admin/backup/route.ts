import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { isLocalDb } from "@/db";

const STATE_FILE = `${process.cwd()}/backups/backup_state.json`;

interface BackupState {
  lastBackup: string | null;
  lastDirection: "push" | "pull" | "merge" | null;
  schedule: "manual" | "hourly" | "daily" | "weekly";
  scheduleDirection: "push" | "pull"; // solo para botones manuales
}

function readState(): BackupState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { lastBackup: null, lastDirection: null, schedule: "manual", scheduleDirection: "push" };
  }
}

function writeState(state: BackupState) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state)); } catch {}
}

// Flag en memoria para evitar backups paralelos
let _running = false;

export async function GET() {
  const state = readState();
  return NextResponse.json({
    ...state,
    isLocal: isLocalDb(),
    isRunning: _running,
    available: process.env.NODE_ENV === "development",
  });
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Solo disponible en desarrollo" }, { status: 403 });
  }
  if (_running) {
    return NextResponse.json({ error: "Ya hay un respaldo en curso" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));

  // Guardar config de ciclo si viene en el body (sin lanzar backup)
  if (body.schedule !== undefined || body.scheduleDirection !== undefined) {
    const state = readState();
    writeState({
      ...state,
      schedule: body.schedule ?? state.schedule,
      scheduleDirection: body.scheduleDirection ?? state.scheduleDirection,
    });
    if (body.direction === undefined && body.action === undefined) {
      return NextResponse.json({ ok: true });
    }
  }

  // "merge" usa sync-merge.ts (bidireccional, sin pérdida de datos)
  // "push" / "pull" usan sync-db.ts (destructivo, manual deliberado)
  const action = (body.action ?? body.direction ?? "push") as "push" | "pull" | "merge";
  const isMerge = action === "merge";
  const script  = isMerge ? "scripts/sync-merge.ts" : "scripts/sync-db.ts";
  const args    = isMerge ? [] : [action];

  _running = true;
  const start = Date.now();

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("npx", ["tsx", script, ...args], {
      stdio: "pipe",
      cwd: process.cwd(),
    });

    const lines: string[] = [];
    proc.stdout?.on("data", (d) => lines.push(d.toString().trim()));
    proc.stderr?.on("data", (d) => lines.push(d.toString().trim()));

    proc.on("close", (code) => {
      _running = false;
      const state = readState();
      const now = new Date().toISOString();
      writeState({ ...state, lastBackup: now, lastDirection: action });

      if (code === 0) {
        resolve(NextResponse.json({ ok: true, lastBackup: now, duration: Date.now() - start, log: lines }));
      } else {
        resolve(NextResponse.json({ ok: false, error: lines.join("\n") }, { status: 500 }));
      }
    });

    proc.on("error", (e) => {
      _running = false;
      resolve(NextResponse.json({ ok: false, error: e.message }, { status: 500 }));
    });
  });
}
