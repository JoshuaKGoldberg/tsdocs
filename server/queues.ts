import { Queue, QueueEvents } from "bullmq";
import { Worker, Job } from "bullmq";
import InstallationUtils from "./package/installation.utils";
import os from "os";
import { generateDocsForPackage } from "./package/extractor/doc-generator";

const redisOptions = {
  port: 6379,
  host: "localhost",
  password: "",
};

type InstallWorkerOptions = {
  packageName: string;
  packageVersion: string;
  installPath: string;
};

export const installQueue = new Queue<InstallWorkerOptions>("install-package", {
  connection: redisOptions,
});

export const installQueueEvents = new QueueEvents(installQueue.name, {
  connection: redisOptions,
});

const installWorker = new Worker<InstallWorkerOptions>(
  installQueue.name,
  async (job: Job) => {
    await InstallationUtils.installPackage(
      [`${job.data.packageName}@${job.data.packageVersion}`],
      job.data.installPath,
      { client: "npm" }
    );
  },
  { concurrency: os.cpus().length - 1, connection: redisOptions }
);

type GenerateDocsWorkerOptions = {
  packageJSON: object;
  force: boolean;
};

export const generateDocsQueue = new Queue<GenerateDocsWorkerOptions>(
  "generate-docs-package",
  {
    connection: redisOptions,
  }
);

export const generateDocsQueueEvents = new QueueEvents(generateDocsQueue.name, {
  connection: redisOptions,
});

const generateDocsWorker = new Worker<GenerateDocsWorkerOptions>(
  generateDocsQueue.name,
  async (job: Job) => {
    return await generateDocsForPackage(job.data.packageJSON, {
      force: job.data.force,
    });
  },
  { concurrency: os.cpus().length - 1, connection: redisOptions }
);

export const queues = [installQueue, generateDocsQueue];

// Remove events from queue every 5 seconds
setInterval(() => {
  queues.forEach((queue) => {
    queue.clean(1000, 1000, "completed");
  });
}, 5000).unref();