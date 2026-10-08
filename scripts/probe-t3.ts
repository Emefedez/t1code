import { readFileSync, writeFileSync } from "node:fs";
const { T3Transport } = await import(
  new URL("../apps/tui/src/t3Transport.ts", import.meta.url).href
);
const { origin, token } = JSON.parse(
  readFileSync("/home/m1-max/.config/t1code/t3-connection.json", "utf8"),
);
const transport = new T3Transport(origin, token, () => undefined);
try {
  const config = await transport.request("server.getConfig");
  const snapshot = await transport.request("orchestration.getSnapshot");
  writeFileSync("/tmp/t3-adapted-probe.json", JSON.stringify({ config, snapshot }, null, 2));
  console.log(
    "T3",
    config.environment.serverVersion,
    "projects",
    snapshot.projects.length,
    "threads",
    snapshot.threads.length,
    "messages",
    snapshot.threads[0].messages.length,
  );
  console.log(
    "Providers",
    config.providerInstances.map((p: Record<string, any>) => [p.instanceId, p.models.length]),
  );
} finally {
  transport.dispose();
}
