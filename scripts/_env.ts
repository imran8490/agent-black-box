// Tiny .env loader for the CLI scripts: reads .env.local, then .env (first one to define a key wins,
// real environment variables win over both). Import this FIRST in every script.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

for (const name of [".env.local", ".env"]) {
  const file = path.join(process.cwd(), name);
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, "").trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
