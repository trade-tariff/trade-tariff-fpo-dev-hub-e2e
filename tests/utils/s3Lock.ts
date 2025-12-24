import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
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
  private handlersRegistered: boolean = false;
  private isLocked: boolean = false;

  constructor(
    bucket: string,
    lockKey: string = "locks/myott-e2e.lock",
    region: string = "eu-west-2",
    maxWaitMs: number = 60000,
    pollIntervalMs: number = 5000,
  ) {
    this.bucket = bucket;
    this.lockKey = lockKey;
    this.s3Client = new S3Client({ region });
    this.maxWaitMs = maxWaitMs;
    this.pollIntervalMs = pollIntervalMs;
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
      this.isLocked = true;
      return true;
    } catch (error: unknown) {
      if ((error as Error).name === "PreconditionFailed") {
        // Check if the existing lock is stale
        const isStale = await this.isLockStale();
        if (isStale) {
          console.log("Detected stale lock, attempting to remove it");
          await this.forceRelease();
          // Try to acquire again
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
            this.isLocked = true;
            return true;
          } catch (retryError: unknown) {
            if ((retryError as Error).name === "PreconditionFailed") {
              return false;
            }
            throw retryError;
          }
        }
        return false;
      }
      throw error;
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
    if (!this.isLocked) {
      return;
    }
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.lockKey,
        }),
      );
      this.isLocked = false;
    } catch (error: unknown) {
      // Log but don't throw - lock might have been released already
      console.warn("Error releasing lock (may have been released already):", error);
      this.isLocked = false;
    }
  }

  private async forceRelease(): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.lockKey,
        }),
      );
      this.isLocked = false;
    } catch (error: unknown) {
      // Ignore errors when force releasing
      console.warn("Error force releasing lock:", error);
    }
  }

  private async isLockStale(): Promise<boolean> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.lockKey,
        }),
      );

      // Check if lock is older than 5 minutes (likely stale)
      const lockAge = Date.now() - (response.LastModified?.getTime() ?? 0);
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      if (lockAge > staleThreshold) {
        return true;
      }

      // Try to get the lock data to check PID
      try {
        const getResponse = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: this.lockKey,
          }),
        );
        const body = await getResponse.Body?.transformToString();
        if (body) {
          const lockData: LockData = JSON.parse(body);
          // Check if the PID is still running (Unix only)
          try {
            process.kill(lockData.pid, 0); // Signal 0 checks if process exists
            return false; // Process is still running
          } catch {
            return true; // Process doesn't exist, lock is stale
          }
        }
      } catch {
        // If we can't read the lock data, assume it's not stale
        return false;
      }

      return false;
    } catch (error: unknown) {
      if ((error as Error).name === "NotFound") {
        return false; // No lock exists, so it's not stale
      }
      // If we can't check, assume it's not stale to be safe
      return false;
    }
  }

  async withLock<T>(callback: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.registerShutdownHandlers();
    let attempt = 0;
    while (Date.now() - start < this.maxWaitMs) {
      attempt++;
      if (await this.acquire()) {
        try {
          return await callback();
        } finally {
          await this.release();
        }
      }
      const elapsed = Date.now() - start;
      if (elapsed < this.maxWaitMs) {
        await sleep(this.pollIntervalMs);
      }
    }
    throw new Error(`Failed to acquire lock after ${this.maxWaitMs}ms (${attempt} attempts)`);
  }

  private registerShutdownHandlers(): void {
    // Only register handlers once per instance
    if (this.handlersRegistered) {
      return;
    }
    this.handlersRegistered = true;

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
    // Note: 'exit' handler removed as it can cause issues with normal cleanup
    // The finally block in withLock should handle normal cleanup
  }
}
