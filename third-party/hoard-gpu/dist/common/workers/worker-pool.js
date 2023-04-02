// This utility eases some of the pain points around worker communication and makes setting up pools
// of workers that all do the same thing trivial.
//========
// Client
//========
const WORKER_DIR = import.meta.url.replace(/[^\/]*$/, '/../../../workers/');
export class WorkerPool {
    #workerPath;
    #maxWorkerPoolSize;
    #onMessage;
    #pendingWorkItems = new Map();
    #nextWorkItemId = 1;
    #workerPool = [];
    #nextWorker = 0;
    constructor(workerPath, maxWorkerPoolSize = undefined) {
        this.#workerPath = WORKER_DIR + workerPath;
        this.#maxWorkerPoolSize = maxWorkerPoolSize;
        if (this.#maxWorkerPoolSize === undefined) {
            this.#maxWorkerPoolSize = Math.min(4, navigator.hardwareConcurrency);
        }
        this.#onMessage = (msg) => {
            const id = msg.data.id;
            const workItem = this.#pendingWorkItems.get(id);
            if (!workItem) {
                console.error(`Got a result for unknown work item ${id}`);
                return;
            }
            this.#pendingWorkItems.delete(id);
            if (msg.data.error) {
                workItem.reject(msg.data.error);
                return;
            }
            workItem.resolve(msg.data.result);
        };
    }
    #selectWorker(id, resolver) {
        this.#pendingWorkItems.set(id, resolver);
        if (this.#pendingWorkItems.size >= this.#workerPool.length &&
            this.#workerPool.length < this.#maxWorkerPoolSize) {
            // Add a new worker
            const worker = new Worker(this.#workerPath);
            worker.addEventListener('message', this.#onMessage);
            this.#workerPool.push(worker);
            return worker;
        }
        return this.#workerPool[this.#nextWorker++ % this.#workerPool.length];
    }
    dispatch(args, transfer) {
        return new Promise((resolve, reject) => {
            const id = this.#nextWorkItemId++;
            this.#selectWorker(id, { resolve, reject }).postMessage({
                id,
                args
            }, transfer);
        });
    }
}
//# sourceMappingURL=worker-pool.js.map