export declare class WorkerPool {
    #private;
    constructor(workerPath: any, maxWorkerPoolSize?: any);
    dispatch(args: any, transfer?: Transferable[]): Promise<unknown>;
}
