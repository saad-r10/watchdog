import "dotenv/config";
import { startUptimeWorker } from "./workers/uptime.worker";
import { startSslWorker } from "./workers/ssl.worker";
import { startHeadersWorker } from "./workers/headers.worker";
import { startCtWorker } from "./workers/ct.worker";
import { startDnsWorker } from "./workers/dns.worker";
import { startExposureWorker } from "./workers/exposure.worker";
import { startBlocklistWorker } from "./workers/blocklist.worker";

startUptimeWorker();
startSslWorker();
startHeadersWorker();
startCtWorker();
startDnsWorker();
startExposureWorker();
startBlocklistWorker();

console.log("All workers running");
