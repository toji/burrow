export class CacheHelper {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    setMulti(url, values) {
        const description = {};
        for (const key in values) {
            const value = values[key];
            const valueUrl = `${url}__${key}__`;
            if (value instanceof ArrayBuffer) {
                this.cache.put(valueUrl, new Response(value));
                description[key] = { type: 'arrayBuffer', url: valueUrl };
            }
            else if (value instanceof Blob) {
                this.cache.put(valueUrl, new Response(value));
                description[key] = { type: 'blob', url: valueUrl };
            }
            else {
                description[key] = { type: 'literal', value };
            }
        }
        this.cache.put(url, new Response(JSON.stringify(description)));
    }
    async getMulti(url) {
        const response = await this.cache.match(url);
        if (!response) {
            return null;
        }
        const description = await response.json();
        const values = {};
        for (const key in description) {
            const entry = description[key];
            if (entry.type == 'literal') {
                values[key] = entry.value;
            }
            else {
                const valueResponse = await this.cache.match(entry.url);
                if (!valueResponse) {
                    // This indicates something has gotten corrupted, as we don't have
                    // the full cache values available any more. Clear the entry.
                    // TODO: Clear all value entries too.
                    this.cache.delete(url);
                    return null;
                }
                values[key] = await valueResponse[entry.type]();
            }
        }
        return values;
    }
}
//# sourceMappingURL=cache-helper.js.map