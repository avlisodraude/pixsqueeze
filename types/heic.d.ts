/** Identify a HEIC/HEIF candidate; detection does not prove server decoder support. */
export function isHeicFile(file: File | Blob): Promise<boolean>;
/** Upload to the endpoint and return JPEG. Optional request settings accept signal, headers, and credentials; no timeout is added. */
export function convertHeicOnServer(file: File | Blob, endpoint?: string, options?: { signal?: AbortSignal; headers?: HeadersInit; credentials?: RequestCredentials }): Promise<File>;
