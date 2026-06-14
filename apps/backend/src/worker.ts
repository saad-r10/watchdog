import "dotenv/config";
import { startUptimeWorker } from "./workers/uptime.worker";
import { startSslWorker } from "./workers/ssl.worker";
import { startHeadersWorker } from "./workers/headers.worker";
import { startCtWorker } from "./workers/ct.worker";
import { startDnsWorker } from "./workers/dns.worker";

startUptimeWorker();
startSslWorker();
startHeadersWorker();
startCtWorker();
startDnsWorker();

console.log("All workers running");
