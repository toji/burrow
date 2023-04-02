import { BufferManager } from './buffer-manager.js';
import { ImageManager } from './image-manager.js';
import { CacheHelper } from '../common/cache-helper.js';
const GLB_MAGIC = 0x46546C67;
const CHUNK_TYPE = {
    JSON: 0x4E4F534A,
    BIN: 0x004E4942,
};
const CACHE_NAME = 'gltf-loader';
export class GltfLoader {
    supportedFormatList = [];
    textureLoader;
    preCacheTransforms = [];
    postCacheTransforms = [];
    constructor(textureLoader, transforms = [], loaderOptions = {}) {
        this.textureLoader = textureLoader;
        const preCacheTransformList = [];
        const postCacheTransformList = [];
        const dependencyStack = [];
        function resolveDependency(transform) {
            const transformList = transform.preCache ? preCacheTransformList : postCacheTransformList;
            const index = transformList.indexOf(transform);
            if (index !== -1) {
                return; // Already inserted
            }
            // Ensure there are no circular dependencies;
            const circularIndex = dependencyStack.indexOf(transform);
            if (circularIndex !== -1) {
                let errorMessage = `${transform.name} has a circular dependency: \n  ${transform.name} ->`;
                for (let i = dependencyStack.length - 1; i > circularIndex; --i) {
                    errorMessage += `\n  ${dependencyStack[i].name} ->`;
                }
                errorMessage += `\n  ${transform.name}`;
                throw new Error(errorMessage);
            }
            dependencyStack.push(transform);
            for (const dependency of transform.Dependencies) {
                if (transform.preCache == true && dependency.preCache == false) {
                    throw new Error('Pre-cache transforms may not have a dependency on post-cache transforms.');
                }
                resolveDependency(dependency);
            }
            dependencyStack.pop();
            transformList.push(transform);
        }
        for (const transform of transforms) {
            resolveDependency(transform);
        }
        for (const transform of preCacheTransformList) {
            this.preCacheTransforms.push(new transform(loaderOptions));
        }
        for (const transform of postCacheTransformList) {
            this.postCacheTransforms.push(new transform(loaderOptions));
        }
        this.supportedFormatList = loaderOptions.supportedFormatList ?? [];
    }
    async loadFromUrl(url, userOptions = {}) {
        const options = structuredClone(userOptions);
        options.startTime = performance.now();
        options.url = url;
        // Populate options defaults
        if (options.baseUrl === undefined) {
            const i = url.lastIndexOf('/');
            options.baseUrl = (i !== -1) ? url.substring(0, i + 1) : undefined;
            options.filename = url.substring(i + 1);
        }
        if (options.extension === undefined) {
            const i = url.lastIndexOf('.');
            options.extension = (i !== -1) ? url.substring(i + 1) : undefined;
        }
        // Check to see if a pre-transformed version of this asset is already in the cache.
        if (url && !options.disableCache) {
            const cache = new CacheHelper(await caches.open(CACHE_NAME));
            const values = await cache.getMulti(url);
            if (values) {
                options.glbBinaryChunk = values.glbBinaryChunk;
                options.loadStats = { fetchTime: performance.now() - options.startTime, fetchCount: 1 };
                options.loadedFromCache = true;
                return this.loadFromJson(values.json, options);
            }
        }
        switch (options.extension) {
            case 'gltf': {
                const response = await fetch(url);
                options.loadStats = { fetchTime: performance.now() - options.startTime, fetchCount: 1 };
                return this.loadFromJson(await response.json(), options);
            }
            case 'glb': {
                const response = await fetch(url);
                options.loadStats = { fetchTime: performance.now() - options.startTime, fetchCount: 1 };
                return this.loadFromBinary(await response.arrayBuffer(), options);
            }
            default:
                throw new Error(`Unrecognized file extension: ${options.extension}`);
        }
    }
    async loadFromBinary(arrayBuffer, options = {}) {
        if (!options.startTime) {
            options.startTime = performance.now();
        }
        const headerView = new DataView(arrayBuffer, 0, 12);
        const magic = headerView.getUint32(0, true);
        const version = headerView.getUint32(4, true);
        const length = headerView.getUint32(8, true);
        if (magic != GLB_MAGIC) {
            throw new Error('Invalid magic string in binary header.');
        }
        if (version != 2) {
            throw new Error('Incompatible version in binary header.');
        }
        let chunks = {};
        let chunkOffset = 12;
        while (chunkOffset < length) {
            const chunkHeaderView = new DataView(arrayBuffer, chunkOffset, 8);
            const chunkLength = chunkHeaderView.getUint32(0, true);
            const chunkType = chunkHeaderView.getUint32(4, true);
            chunks[chunkType] = arrayBuffer.slice(chunkOffset + 8, chunkOffset + 8 + chunkLength);
            chunkOffset += chunkLength + 8;
        }
        if (!chunks[CHUNK_TYPE.JSON]) {
            throw new Error('File contained no json chunk.');
        }
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(chunks[CHUNK_TYPE.JSON]);
        const gltf = JSON.parse(jsonString);
        gltf.buffers = [{
                byteLength: chunks[CHUNK_TYPE.BIN].byteLength,
            }];
        options.glbBinaryChunk = chunks[CHUNK_TYPE.BIN];
        return this.loadFromJson(gltf, options);
    }
    async loadFromJson(gltf, options = {}) {
        if (!options.startTime) {
            options.startTime = performance.now();
        }
        // Attach the loading statistics to the returned glTF
        if (gltf.extras === undefined) {
            gltf.extras = {};
        }
        const extras = gltf.extras;
        extras.url = options.url;
        extras.filename = options.filename;
        const baseUrl = options.baseUrl;
        if (baseUrl === undefined) {
            throw new Error(`baseUrl option must be specified.`);
        }
        const asset = gltf.asset;
        if (!asset) {
            throw new Error('Missing asset description.');
        }
        if (asset.minVersion != '2.0' && asset.version != '2.0') {
            throw new Error('Incompatible asset version.');
        }
        if (!options.loadStats) {
            options.loadStats = { fetchTime: 0, fetchCount: 0 };
        }
        options.loadStats.transforms = {};
        const cache = new CacheHelper(await caches.open(CACHE_NAME));
        const buffers = new BufferManager(gltf, baseUrl, options.glbBinaryChunk);
        const images = new ImageManager(gltf, baseUrl, buffers, this.textureLoader);
        const transformResults = new Map();
        if (!options.loadedFromCache) {
            for (const transform of this.preCacheTransforms) {
                const transformStartTime = performance.now();
                const result = transform.transform(gltf, buffers, images, options, transformResults);
                const syncTime = performance.now() - transformStartTime;
                transformResults.set(transform.constructor, result);
                if (result instanceof Promise) {
                    result.then(() => {
                        options.loadStats.transforms[transform.constructor.name] = {
                            resolveTime: performance.now() - transformStartTime,
                            syncTime
                        };
                    });
                }
                else {
                    options.loadStats.transforms[transform.constructor.name] = {
                        syncTime
                    };
                }
            }
            // Sync up all the pre-cache transforms before moving on.
            await Promise.all(transformResults.values());
            // Cache the transformed version of the gltf to make future loads faster.
            const url = options.url;
            if (url && !options.disableCache) {
                const cacheStart = performance.now();
                // Don't block on caching
                buffers.updateCache(gltf, cache).then(() => {
                    options.loadStats.cacheTimeNonBlocking = performance.now() - cacheStart;
                });
            }
        }
        if (!options.cacheOnly) {
            // These transforms should not update the buffers!
            for (const transform of this.postCacheTransforms) {
                const transformStartTime = performance.now();
                const result = transform.transform(gltf, buffers, images, options, transformResults);
                const syncTime = performance.now() - transformStartTime;
                transformResults.set(transform.constructor, result);
                if (result instanceof Promise) {
                    result.then(() => {
                        options.loadStats.transforms[transform.constructor.name] = {
                            resolveTime: performance.now() - transformStartTime,
                            syncTime
                        };
                    });
                }
                else {
                    options.loadStats.transforms[transform.constructor.name] = {
                        syncTime
                    };
                }
            }
        }
        await Promise.all(transformResults.values());
        // @ts-ignore
        gltf.bufferViews = [...buffers.bufferViews];
        options.loadStats.loadTime = performance.now() - options.startTime;
        extras.loadStats = options.loadStats;
        return gltf;
    }
    clearCache() {
        caches.delete(CACHE_NAME);
    }
}
//# sourceMappingURL=gltf-loader.js.map