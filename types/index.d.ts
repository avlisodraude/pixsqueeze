declare namespace PixSqueeze {
  export interface Options {
    strict?: boolean;
    checkOrientation?: boolean;
    /** Reinsert JPEG EXIF; false does not strip metadata from original-file fallback. */
    retainExif?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
    width?: number;
    height?: number;
    resize?: 'contain' | 'cover' | 'none';
    quality?: number;
    mimeType?: string;
    convertTypes?: string | string[];
    convertSize?: number;
    beforeDraw?(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
    drew?(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void;
    success?(file: File | Blob): void;
    error?(error: Error): void;
  }

  export interface ConversionOptions {
    /** Only explicitly configured formats may be uploaded. */
    heic?: string;
    tiff?: string;
    raw?: string;
    /** Let FormData set the multipart Content-Type boundary. */
    headers?: HeadersInit;
    credentials?: RequestCredentials;
  }

  export interface AsyncOptions extends Omit<Options, 'success' | 'error'> {
    /** Desired maximum output size in bytes. */
    targetSize?: number;
    /** Total browser encoding attempts, from 1 to 20. Default: 8. */
    maxAttempts?: number;
    /** Lowest quality used by the target-size search. Default: 0.4. */
    minQuality?: number;
    /** Allow reducing dimensions to reach targetSize. Default: false. */
    allowResize?: boolean;
    /** No files are uploaded unless a matching endpoint is configured. */
    conversion?: ConversionOptions;
    /** Cancel detection, uploads, and browser work; late encoder output is discarded. */
    signal?: AbortSignal;
    /** Total operation timeout in milliseconds. Default: 30000; 0 disables it. */
    timeout?: number;
  }

  export interface CompressionResult {
    /** Actual returned output, including an original-file fallback. */
    file: File | Blob;
    /** Caller input bytes before optional server conversion. */
    originalSize: number;
    /** Returned file bytes, including retained EXIF. */
    outputSize: number;
    /** Actual browser encoder result; may differ from requested mimeType. */
    mimeType: string;
    /** Output pixel dimensions. */
    width: number;
    height: number;
    /** Requested byte target, or null without a target. */
    targetSize: number | null;
    /** null when targetSize was not requested. */
    targetMet: boolean | null;
    /** Browser encoding attempts; excludes server conversion. */
    attempts: number;
    /** A configured server conversion was used once before browser encoding. */
    converted: boolean;
    /** The returned file is the same object as the caller's original input. */
    returnedOriginal: boolean;
  }
}

declare class PixSqueeze {
  constructor(file: File | Blob, options?: PixSqueeze.Options);
  abort(): void;
  static compress(file: File | Blob, options?: PixSqueeze.AsyncOptions): Promise<PixSqueeze.CompressionResult>;
  static noConflict(): typeof PixSqueeze;
  static setDefaults(options: PixSqueeze.Options): void;
}

export = PixSqueeze;
export as namespace PixSqueeze;
