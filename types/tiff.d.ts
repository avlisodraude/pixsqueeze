/** Identify a TIFF candidate; detection does not prove server decoder support. */
export function isTiffFile(file: File | Blob): Promise<boolean>;
/** Upload to the endpoint and return JPEG. Optional request settings accept signal, headers, and credentials; no timeout is added. */
export function convertTiffOnServer(file: File | Blob, endpoint?: string, options?: { signal?: AbortSignal; headers?: HeadersInit; credentials?: RequestCredentials }): Promise<File>;
