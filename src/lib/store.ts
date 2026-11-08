import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DecisionLog, IndexEntry } from "./types";

// Local convenience index for the Live Feed and an offline cache of logs.
// The chain + Walrus are the source of truth; nothing here is trusted by verify().

const DATA_DIR = path.join(process.cwd(), "data");
const INDEX_FILE = path.join(DATA_DIR, "decisions.json");
const LOG_DIR = path.join(DATA_DIR, "logs");

export async function readIndex(): Promise<IndexEntry[]> {
  try {
    const raw = await readFile(INDEX_FILE, "utf8");
    const parsed = JSON.parse(raw) as IndexEntry[];
    return parsed.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
  } catch {
    return [];
  }
}

export async function appendIndex(entry: IndexEntry): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const all = await readIndex();
  all.push(entry);
  await writeFile(INDEX_FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function findEntryByDigest(digest: string): Promise<IndexEntry | undefined> {
  return (await readIndex()).find((e) => e.digest === digest);
}

export async function cacheLog(log: DecisionLog): Promise<void> {
  await mkdir(LOG_DIR, { recursive: true });
  await writeFile(path.join(LOG_DIR, `${log.id}.json`), JSON.stringify(log, null, 2), "utf8");
}

export async function readCachedLog(id: string): Promise<DecisionLog | null> {
  try {
    return JSON.parse(await readFile(path.join(LOG_DIR, `${id}.json`), "utf8")) as DecisionLog;
  } catch {
    return null;
  }
}
