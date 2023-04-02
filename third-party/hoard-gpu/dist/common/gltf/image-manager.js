import { resolveUri, isDataUri } from '../common/uri-utils.js';
const SRGB_TEXTURE_SLOTS = ['baseColorTexture', 'diffuseTexture', 'emissiveTexture'];
export class ImageManager {
    #imageResponses = [];
    baseUrl;
    textureLoader;
    constructor(gltf, baseUrl, buffers, textureLoader) {
        this.baseUrl = baseUrl;
        this.textureLoader = textureLoader;
        // Fetch all images with a uri as blobs, and create blobs from all images that point at a
        // bufferView. Caches them as well. By caching the images separately from the gltf binary
        // blobs we make it possible for different files to share cached textures.
        // TODO: Defer actual loading until the image is requested, to account for things like
        // fallback images, multiple materials, etc.
        if (gltf.images) {
            this.annotateImages(gltf);
            for (let i = 0; i < gltf.images.length; ++i) {
                this.#imageResponses[i] = this.#loadImage(i, gltf, buffers);
            }
        }
    }
    // Associates every image with a list of the material slots they are used in,
    // which helps with things like identifying which textures need to be uploaded
    // as sRGB.
    annotateImages(gltf) {
        if (!gltf.materials?.length) {
            return;
        }
        const materialsSlotsByImage = new Map();
        const markSource = (source, key) => {
            if (source === undefined) {
                return;
            }
            const image = gltf.images[source];
            let materialSlots = materialsSlotsByImage.get(image);
            if (!materialSlots) {
                materialSlots = [key];
                materialsSlotsByImage.set(image, materialSlots);
            }
            else {
                materialSlots.push(key);
            }
            // Indicate if the texture should be treated as sRGB
            if (SRGB_TEXTURE_SLOTS.indexOf(key) !== -1) {
                this.setExtras(image, { sRgb: true });
            }
        };
        const annotateImages = (materialProperties) => {
            if (!materialProperties) {
                return;
            }
            for (const [key, value] of Object.entries(materialProperties)) {
                if (key.endsWith('Texture')) {
                    //@ts-ignore
                    const texture = gltf.textures[value.index];
                    // If an image is associated with a material texture slot, add it to
                    // the list of slots for this image.
                    markSource(texture.source, key);
                    markSource(texture.extensions?.KHR_texture_basisu?.source, key);
                }
                else if (key !== 'extras' && typeof value === 'object') {
                    // Recurse
                    annotateImages(value);
                }
            }
        };
        // Check every material in the glTF file.
        for (const material of gltf.materials) {
            annotateImages(material);
        }
        for (const image of gltf.images) {
            const materialSlots = materialsSlotsByImage.get(image) ?? [];
            this.setExtras(image, { materialSlots });
        }
    }
    setExtras(obj, extras) {
        if (obj.extras === undefined) {
            obj.extras = extras;
        }
        else {
            Object.assign(obj.extras, extras);
        }
    }
    // Loads an image from it's original source. Caches if requested.
    async #loadImage(index, gltf, buffers) {
        const image = gltf.images[index];
        let textureOptions = { colorSpace: image.extras.sRgb ? 'sRGB' : 'linear' };
        let blob;
        if (image.uri) {
            const uri = resolveUri(image.uri, this.baseUrl);
            if (!isDataUri(uri)) {
                return this.textureLoader.fromUrl(uri, textureOptions);
            }
            // Data URIs are loaded as blobs
            if (this.textureLoader.isCaching) {
                // Re-write the image URI so that it can be looked up from the cache in the future.
                image.uri = `${gltf.extras.filename}_IMAGE_${index}`;
                textureOptions['cacheUrl'] = image.uri;
            }
            const response = await fetch(uri);
            blob = await response.blob();
        }
        else {
            // For images loaded from a buffer view, load them from a byte array initially but cache
            // them as separate image blobs and remove that portion of the buffer from the cache.
            // This appears to speed up loading of images significantly!
            const bufferView = buffers.getBufferView(image.bufferView);
            const byteArray = await bufferView.asByteArray();
            blob = new Blob([byteArray], { type: image.mimeType });
            if (this.textureLoader.isCaching) {
                image.uri = `${gltf.extras.filename}_IMAGE_${index}`;
                textureOptions['cacheUrl'] = image.uri;
                buffers.removeBufferView(image.bufferView);
                delete image.bufferView;
            }
        }
        return this.textureLoader.fromBlob(blob, textureOptions);
    }
    getImage(index) {
        return this.#imageResponses[index];
    }
}
//# sourceMappingURL=image-manager.js.map