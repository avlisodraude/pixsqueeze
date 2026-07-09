export function isHeicFile(file: File | Blob): Promise<boolean>;
export function convertHeicOnServer(file: File | Blob, endpoint?: string): Promise<File>;
