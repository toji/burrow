interface MultiCacheValue {
    [x: string]: object | string | ArrayBuffer | Blob;
}
export declare class CacheHelper {
    cache: Cache;
    constructor(cache: Cache);
    setMulti(url: string, values: MultiCacheValue): void;
    getMulti(url: string): Promise<MultiCacheValue | null>;
}
export {};
