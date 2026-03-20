import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { Sequelize } from "sequelize";

import { initModels } from "@web-speed-hackathon-2026/server/src/models";
import { DATABASE_PATH } from "@web-speed-hackathon-2026/server/src/paths";

let _sequelize: Sequelize | null = null;
let _currentTempDir: string | null = null;

export async function initializeSequelize() {
  const prevSequelize = _sequelize;
  const oldTempDir = _currentTempDir;

  const tempDir = await fs.mkdtemp(path.resolve(os.tmpdir(), "./wsh-"));
  const TEMP_PATH = path.resolve(tempDir, "./database.sqlite");
  await fs.copyFile(DATABASE_PATH, TEMP_PATH);

  const newSequelize = new Sequelize({
    dialect: "sqlite",
    logging: false,
    storage: TEMP_PATH,
  });
  initModels(newSequelize);
  _sequelize = newSequelize;
  _currentTempDir = tempDir;

  await prevSequelize?.close();

  // 古い temp ディレクトリを削除
  if (oldTempDir) {
    await fs.rm(oldTempDir, { recursive: true, force: true }).catch(() => {});
  }
}
