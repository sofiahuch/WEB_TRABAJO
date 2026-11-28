import "dotenv/config";
import { parseArgs } from "node:util";
import { createApp } from "./app.js";

const { values } = parseArgs({
  options: {
    port: { type: "string" },
    host: { type: "string" },
    strictPort: { type: "boolean" },
  },
});
const PORT = Number(values.port || process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535)
  throw new Error("Puerto no válido.");
const app = createApp();

const server = app.listen(PORT, values.host || "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () =>
    server.close(() => {
      app.locals.db.close();
      process.exit(0);
    }),
  );
}
