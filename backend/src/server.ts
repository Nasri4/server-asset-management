import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.port, () => {
	// eslint-disable-next-line no-console
	console.log(`[SAM API] listening on http://localhost:${env.port}`);
});

function shutdown(signal: string) {
	// eslint-disable-next-line no-console
	console.log(`[SAM API] received ${signal}, shutting down...`);
	server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
