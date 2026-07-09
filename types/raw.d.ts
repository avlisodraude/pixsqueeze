export function isRawFile(file: File | Blob): Promise<boolean>;
export function convertRawOnServer(file: File | Blob, endpoint?: string): Promise<File>;
