import "dotenv/config";
import { startUptimeWorker } from "./workers/uptime.worker";
import { startSslWorker } from "./workers/ssl.worker";
import { startHeadersWorker } from "./workers/headers.worker";

startUptimeWorker();
startSslWorker();
startHeadersWorker();

console.log("All workers running");
