const absUriRegEx = new RegExp(`^${window.location.protocol}`, 'i');
const dataUriRegEx = /^data:/;
export function isDataUri(uri) {
    return !!uri.match(dataUriRegEx);
}
export function resolveUri(uri, baseUrl) {
    if (!!uri.match(absUriRegEx) || !!uri.match(dataUriRegEx)) {
        return uri;
    }
    return baseUrl + uri;
}
//# sourceMappingURL=uri-utils.js.map