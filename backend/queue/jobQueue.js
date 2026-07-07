// const { QUEUE_CONCURRENCY, MAX_RETRIES, RETRY_BACKOFF_MS } = require("../config/extractionConfig");

// /**
//  * Minimal concurrency-limited async job queue with retry + backoff.
//  * No external dependency (e.g. Bull/BullMQ + Redis) is assumed, so this
//  * works out of the box; swap this module for a Redis-backed queue later
//  * without touching featureExtractionService.js — it only calls `enqueue()`.
//  *
//  * Note: this queue lives in the Node process's memory. If the process
//  * restarts mid-job, that job is lost (its status will remain "processing"
//  * in Mongo). For a single-instance deployment this is an acceptable
//  * trade-off; a multi-instance/production deployment should replace this
//  * with a persistent queue (BullMQ, SQS, etc.) — the interface below is
//  * intentionally small to make that swap easy.
//  */
// class JobQueue {
//   constructor(concurrency = QUEUE_CONCURRENCY) {
//     this.concurrency = concurrency;
//     this.running = 0;
//     this.pending = [];
//   }

//   /**
//    * @param {() => Promise<any>} task - the unit of work
//    * @param {object} opts
//    * @param {string} opts.label - for logging
//    * @param {number} [opts.maxRetries]
//    */
//   enqueue(task, { label = "job", maxRetries = MAX_RETRIES } = {}) {
//     return new Promise((resolve, reject) => {
//       this.pending.push({ task, label, maxRetries, attempt: 0, resolve, reject });
//       this._drain();
//     });
//   }

//   _drain() {
//     while (this.running < this.concurrency && this.pending.length > 0) {
//       const job = this.pending.shift();
//       this._runJob(job);
//     }
//   }

//   async _runJob(job) {
//     this.running += 1;
//     try {
//       const result = await job.task();
//       job.resolve(result);
//     } catch (err) {
//       job.attempt += 1;
//       console.error(`[jobQueue] ${job.label} failed (attempt ${job.attempt}/${job.maxRetries}): ${err.message}`);

//       if (job.attempt < job.maxRetries) {
//         const delay = RETRY_BACKOFF_MS * Math.pow(2, job.attempt - 1); // exponential backoff
//         setTimeout(() => {
//           this.pending.push(job);
//           this._drain();
//         }, delay);
//       } else {
//         job.reject(err);
//       }
//     } finally {
//       this.running -= 1;
//       this._drain();
//     }
//   }
// }

// // Singleton — all callers share the same concurrency budget
// module.exports = new JobQueue();

const { QUEUE_CONCURRENCY, MAX_RETRIES, RETRY_BACKOFF_MS } = require("../config/extractionConfig");

/**
 * Minimal concurrency-limited async job queue with retry + backoff.
 * No external dependency (e.g. Bull/BullMQ + Redis) is assumed, so this
 * works out of the box; swap this module for a Redis-backed queue later
 * without touching featureExtractionService.js — it only calls `enqueue()`.
 *
 * Note: this queue lives in the Node process's memory. If the process
 * restarts mid-job, that job is lost (its status will remain "processing"
 * in Mongo). For a single-instance deployment this is an acceptable
 * trade-off; a multi-instance/production deployment should replace this
 * with a persistent queue (BullMQ, SQS, etc.) — the interface below is
 * intentionally small to make that swap easy.
 */
class JobQueue {
  constructor(concurrency = QUEUE_CONCURRENCY) {
    this.concurrency = concurrency;
    this.running = 0;
    this.pending = [];
  }

  /**
   * @param {() => Promise<any>} task - the unit of work
   * @param {object} opts
   * @param {string} opts.label - for logging
   * @param {number} [opts.maxRetries]
   */
  enqueue(task, { label = "job", maxRetries = MAX_RETRIES } = {}) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, label, maxRetries, attempt: 0, resolve, reject });
      this._drain();
    });
  }

  _drain() {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      this._runJob(job);
    }
  }

  async _runJob(job) {
    this.running += 1;
    try {
      const result = await job.task();
      job.resolve(result);
    } catch (err) {
      job.attempt += 1;
      console.error(`[jobQueue] ${job.label} failed (attempt ${job.attempt}/${job.maxRetries}): ${err.message}`);

      if (job.attempt < job.maxRetries) {
        const delay = RETRY_BACKOFF_MS * Math.pow(2, job.attempt - 1); // exponential backoff
        setTimeout(() => {
          this.pending.push(job);
          this._drain();
        }, delay);
      } else {
        job.reject(err);
      }
    } finally {
      this.running -= 1;
      this._drain();
    }
  }
}

// Singleton — all callers share the same concurrency budget
module.exports = new JobQueue();
