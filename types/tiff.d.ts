export function isTiffFile(file: File | Blob): Promise<boolean>;
export function convertTiffOnServer(file: File | Blob, endpoint?: string): Promise<File>;
