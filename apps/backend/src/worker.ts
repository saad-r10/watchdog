import "dotenv/config";
import { startUptimeWorker } from "./workers/uptime.worker";
import { startSslWorker } from "./workers/ssl.worker";
import { startHeadersWorker } from "./workers/headers.worker";
import { startCtWorker } from "./workers/ct.worker";

startUptimeWorker();
startSslWorker();
startHeadersWorker();
startCtWorker();

console.log("All workers running");
