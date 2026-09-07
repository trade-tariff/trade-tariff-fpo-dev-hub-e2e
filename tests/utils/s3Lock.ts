import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { setTimeout as sleep } from "timers/promises";

interface LockData {
  lockedAt: string;
  pid: number;
}

export default class S3Lock {
  private bucket: string;
  private lockKey: string;
  private s3Client: S3Client;
  private maxWaitMs: number;
  private pollIntervalMs: number;
  private staleAfterMs: number;

  constructor(
    bucket: string,
    lockKey: string = "locks/myott-e2e.lock",
    region: string = "eu-west-2",
    maxWaitMs: number = 60000,
    pollIntervalMs: number = 5000,
    // A held lock is only ever supposed to live for the duration of one
    // login flow (well under a minute). A process that dies hard (killed
    // runner, cancelled job) can't run its `finally` release, so a lock
    // that's stuck around far longer than that is abandoned, not held.
    staleAfterMs: number = 120000,
  ) {
    this.bucket = bucket;
    this.lockKey = lockKey;
    this.s3Client = new S3Client({ region });
    this.maxWaitMs = maxWaitMs;
    this.pollIntervalMs = pollIntervalMs;
    this.staleAfterMs = staleAfterMs;
  }

  async acquire(): Promise<boolean> {
    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.lockKey,
          Body: JSON.stringify({
            lockedAt: new Date().toISOString(),
            pid: process.pid,
          } as LockData),
          IfNoneMatch: "*",
        }),
      );
      return true;
    } catch (error: unknown) {
      if ((error as Error).name === "PreconditionFailed") {
        await this.reapIfStale();
        return false;
      }
      throw error;
    }
  }

  private async reapIfStale(): Promise<void> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.lockKey }),
      );
      const body = await response.Body?.transformToString();
      const lock = body ? (JSON.parse(body) as LockData) : null;
      const age = lock ? Date.now() - new Date(lock.lockedAt).getTime() : 0;

      if (lock && age > this.staleAfterMs) {
        console.log(`Reaping abandoned lock held by pid ${lock.pid}, age ${age}ms`);
        await this.release();
      }
    } catch {
      // Lock may have been released or reaped concurrently by another
      // waiter; nothing to do either way.
    }
  }

  async exists(): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.lockKey,
        }),
      );
      return true;
    } catch (error: unknown) {
      if ((error as Error).name === "NotFound") return false;
      throw error;
    }
  }

  async release(): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.lockKey,
      }),
    );
  }

  async withLock<T>(callback: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.registerShutdownHandlers();
    while (Date.now() - start < this.maxWaitMs) {
      if (await this.acquire()) {
        try {
          return await callback();
        } finally {
          await this.release();
        }
      }
      await sleep(this.pollIntervalMs);
    }
    throw new Error(`Failed to acquire lock after ${this.maxWaitMs}ms`);
  }

  private registerShutdownHandlers(): void {
    process.once("SIGTERM", async () => {
      console.log("SIGTERM received; attempting lock release");
      await this.release();
      process.exit(0);
    });
    process.once("SIGINT", async () => {
      console.log("SIGINT (Ctrl+C) received; attempting lock release");
      await this.release();
      process.exit(0);
    });
    // Unhandled errors
    process.once("uncaughtException", async (err: Error) => {
      console.error("Uncaught exception; attempting lock release", err);
      await this.release();
      process.exit(1);
    });
    process.once("unhandledRejection", async (reason: unknown) => {
      console.error("Unhandled rejection; attempting lock release", reason);
      await this.release();
      process.exit(1);
    });
    process.once("exit", (code: number) => {
      console.log(
        `Process exiting with code ${code}; attempting sync lock release`,
      );
      // Note: 'exit' is synchronous, so async release() is fire-and-forget
      void this.release();
    });
  }
}
