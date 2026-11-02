/** Identify a camera RAW candidate; detection does not prove server decoder support. */
export function isRawFile(file: File | Blob): Promise<boolean>;
/** Upload to the endpoint and return JPEG. Optional request settings accept signal, headers, and credentials; no timeout is added. */
export function convertRawOnServer(file: File | Blob, endpoint?: string, options?: { signal?: AbortSignal; headers?: HeadersInit; credentials?: RequestCredentials }): Promise<File>;
