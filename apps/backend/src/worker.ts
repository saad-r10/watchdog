import "dotenv/config";
import { startUptimeWorker } from "./workers/uptime.worker";
import { startSslWorker } from "./workers/ssl.worker";
import { startHeadersWorker } from "./workers/headers.worker";
import { startCtWorker } from "./workers/ct.worker";
import { startDnsWorker } from "./workers/dns.worker";
import { startExposureWorker } from "./workers/exposure.worker";
import { startBlocklistWorker } from "./workers/blocklist.worker";
import { startSyntheticWorker } from "./workers/synthetic.worker";
import { startAnomalyDetectionWorker } from "./workers/anomaly-detection.worker";
import { startLighthouseWorker } from "./workers/lighthouse.worker";

startUptimeWorker();
startSslWorker();
startHeadersWorker();
startCtWorker();
startDnsWorker();
startExposureWorker();
startBlocklistWorker();
startSyntheticWorker();
startAnomalyDetectionWorker();
startLighthouseWorker();

console.log("All workers running");
