import fs from "node:fs";
import path from "node:path";

export default async function globalSetup(): Promise<void> {
  const db = path.resolve(process.cwd(), ".data", "e2e.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(db + suffix, { force: true });
  }
  fs.rmSync(path.resolve(process.cwd(), "test-results"), {
    recursive: true,
    force: true,
  });
}
