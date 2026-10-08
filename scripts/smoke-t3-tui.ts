import { readFileSync } from "node:fs";
const { origin, token } = JSON.parse(
  readFileSync("/home/m1-max/.config/t1code/t3-connection.json", "utf8"),
);
process.env.T1CODE_T3_ORIGIN = origin;
process.env.T1CODE_T3_TOKEN = token;
process.env.T1CODE_HEADLESS = "1";
process.env.T1CODE_HEADLESS_TIMEOUT_MS = "7000";
process.env.T1CODE_HEADLESS_FRAME_PATH = "/tmp/t1-t3-frame.txt";
process.env.T1CODE_CONFIG_HOME = "/tmp/t1-t3-smoke-config";
await import(new URL("../apps/tui/src/index.tsx", import.meta.url).href);
