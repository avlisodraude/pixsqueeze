/**
 * Check if the given value is a positive number.
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the given value is a positive number, else `false`.
 */
export const isPositiveNumber = (value) => value > 0 && value < Infinity;

const REGEXP_IMAGE_TYPE = /^image\/.+$/;

/**
 * Check if the given value is a mime type of image.
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the given is a mime type of image, else `false`.
 */
export function isImageType(value) {
  return REGEXP_IMAGE_TYPE.test(value);
}

/**
 * Convert image type to extension.
 * @param {string} value - The image type to convert.
 * @returns {boolean} Returns the image extension.
 */
export function imageTypeToExtension(value) {
  const ext = isImageType(value) ? value.slice(6) : '';

  return `.${ext === 'jpeg' ? 'jpg' : ext}`;
}

const { fromCharCode } = String;

/**
 * Check if `canvas.getContext('2d').getImageData` is available,
 * FireFox randomizes the output of that function in `privacy.resistFingerprinting` mode (#137)
 * @link https://github.com/nodeca/pica/blob/master/lib/utils.js
 * @returns {boolean} Returns `true` if it is available, else `false`.
 */
// Cached result — the canvas probe result never changes within a page session.
let canvasAvailableCache;

export function isCanvasAvailable() {
  if (canvasAvailableCache !== undefined) return canvasAvailableCache;

  try {
    const canvas = document.createElement('canvas');

    canvas.width = 2;
    canvas.height = 1;

    const context = canvas.getContext('2d');

    if (!context) {
      canvasAvailableCache = false;
      return false;
    }

    // Create 2x1 image data containing RGBA values for two pixels
    const imageData = context.createImageData(2, 1);

    // First pixel: R=12, G=23, B=34, A=255
    imageData.data[0] = 12;
    imageData.data[1] = 23;
    imageData.data[2] = 34;
    imageData.data[3] = 255;

    // Second pixel: R=45, G=56, B=67, A=255
    imageData.data[4] = 45;
    imageData.data[5] = 56;
    imageData.data[6] = 67;
    imageData.data[7] = 255;

    context.putImageData(imageData, 0, 0);

    const readBack = context.getImageData(0, 0, 2, 1);

    // Expected pixel data (matching the written values)
    const expected = [12, 23, 34, 255, 45, 56, 67, 255];

    // Compare element by element to ensure write and read consistency
    canvasAvailableCache = readBack.data.every((value, index) => value === expected[index]);
  } catch (error) {
    canvasAvailableCache = false;
  }

  return canvasAvailableCache;
}

/**
 * Transform array buffer to Data URL.
 * @param {ArrayBuffer} arrayBuffer - The array buffer to transform.
 * @param {string} mimeType - The mime type of the Data URL.
 * @returns {string} The result Data URL.
 */
export function arrayBufferToDataURL(arrayBuffer, mimeType) {
  const chunks = [];
  const chunkSize = 8192;
  let uint8 = new Uint8Array(arrayBuffer);

  while (uint8.length > 0) {
    chunks.push(fromCharCode(...uint8.subarray(0, chunkSize)));
    uint8 = uint8.subarray(chunkSize);
  }

  return `data:${mimeType};base64,${btoa(chunks.join(''))}`;
}

/**
 * Get orientation value from given array buffer.
 * @param {ArrayBuffer} arrayBuffer - The array buffer to read.
 * @returns {number} The read orientation value.
 */
export function resetAndGetOrientation(arrayBuffer) {
  const dataView = new DataView(arrayBuffer);
  let orientation;

  // Ignores range error when the image does not have correct Exif information
  try {
    let littleEndian;
    let app1Start;
    let ifdStart;

    // Only handle JPEG image (start by 0xFFD8)
    if (dataView.getUint8(0) === 0xFF && dataView.getUint8(1) === 0xD8) {
      const length = dataView.byteLength;
      let offset = 2;

      while (offset + 1 < length) {
        if (dataView.getUint8(offset) === 0xFF && dataView.getUint8(offset + 1) === 0xE1) {
          app1Start = offset;
          break;
        }

        offset += 1;
      }
    }

    if (app1Start) {
      const exifIDCode = app1Start + 4;
      const tiffOffset = app1Start + 10;

      if (new TextDecoder().decode(new Uint8Array(dataView.buffer, exifIDCode, 4)) === 'Exif') {
        const endianness = dataView.getUint16(tiffOffset);

        littleEndian = endianness === 0x4949;

        if (littleEndian || endianness === 0x4D4D /* bigEndian */) {
          if (dataView.getUint16(tiffOffset + 2, littleEndian) === 0x002A) {
            const firstIFDOffset = dataView.getUint32(tiffOffset + 4, littleEndian);

            if (firstIFDOffset >= 0x00000008) {
              ifdStart = tiffOffset + firstIFDOffset;
            }
          }
        }
      }
    }

    if (ifdStart) {
      const length = dataView.getUint16(ifdStart, littleEndian);

      for (let i = 0; i < length; i += 1) {
        let offset = ifdStart + (i * 12) + 2;

        if (dataView.getUint16(offset, littleEndian) === 0x0112 /* Orientation */) {
          // 8 is the offset of the current tag's value
          offset += 8;

          // Get the original orientation value
          orientation = dataView.getUint16(offset, littleEndian);

          // Override the orientation with its default value
          dataView.setUint16(offset, 1, littleEndian);
          break;
        }
      }
    }
  } catch (e) {
    orientation = 1;
  }

  return orientation;
}

/**
 * Parse Exif Orientation value.
 * @param {number} orientation - The orientation to parse.
 * @returns {Object} The parsed result.
 */
export function parseOrientation(orientation) {
  let rotate = 0;
  let scaleX = 1;
  let scaleY = 1;

  switch (orientation) {
    // Flip horizontal
    case 2:
      scaleX = -1;
      break;

    // Rotate left 180°
    case 3:
      rotate = -180;
      break;

    // Flip vertical
    case 4:
      scaleY = -1;
      break;

    // Flip vertical and rotate right 90°
    case 5:
      rotate = 90;
      scaleY = -1;
      break;

    // Rotate right 90°
    case 6:
      rotate = 90;
      break;

    // Flip horizontal and rotate right 90°
    case 7:
      rotate = 90;
      scaleX = -1;
      break;

    // Rotate left 90°
    case 8:
      rotate = -90;
      break;

    default:
  }

  return {
    rotate,
    scaleX,
    scaleY,
  };
}

const REGEXP_DECIMALS = /\.\d*(?:0|9){12}\d*$/;

/**
 * Normalize decimal number.
 * Check out {@link https://0.30000000000000004.com/}
 * @param {number} value - The value to normalize.
 * @param {number} [times=100000000000] - The times for normalizing.
 * @returns {number} Returns the normalized number.
 */
export function normalizeDecimalNumber(value, times = 100000000000) {
  return REGEXP_DECIMALS.test(value) ? (Math.round(value * times) / times) : value;
}

/**
 * Get the max sizes in a rectangle under the given aspect ratio.
 * @param {Object} data - The original sizes.
 * @param {string} [type='contain'] - The adjust type.
 * @returns {Object} The result sizes.
 */
export function getAdjustedSizes(
  {
    aspectRatio,
    height,
    width,
  },

  // 'none' | 'contain' | 'cover'
  type = 'none',
) {
  const isValidWidth = isPositiveNumber(width);
  const isValidHeight = isPositiveNumber(height);

  if (isValidWidth && isValidHeight) {
    const adjustedWidth = height * aspectRatio;

    if ((['contain', 'none'].includes(type) && adjustedWidth > width) || (type === 'cover' && adjustedWidth < width)) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }
  } else if (isValidWidth) {
    height = width / aspectRatio;
  } else if (isValidHeight) {
    width = height * aspectRatio;
  }

  return {
    width,
    height,
  };
}

/**
 * Get Exif information from the given array buffer.
 * @param {ArrayBuffer} arrayBuffer - The array buffer to read.
 * @returns {Array} The read Exif information.
 */
export function getExif(arrayBuffer) {
  // Work directly on the typed array — avoids copying the entire image buffer
  // into a plain JS Array (which was the previous toArray() call).
  const uint8 = new Uint8Array(arrayBuffer);
  const { length } = uint8;
  const exifSegments = [];
  let start = 0;

  while (start + 3 < length) {
    const value = uint8[start];
    const next = uint8[start + 1];

    // SOS (Start of Scan)
    if (value === 0xFF && next === 0xDA) {
      break;
    }

    // SOI (Start of Image)
    if (value === 0xFF && next === 0xD8) {
      start += 2;
    } else {
      const offset = uint8[start + 2] * 256 + uint8[start + 3];
      const end = start + offset + 2;

      // Collect only APP1 (0xFF 0xE1) segments — those carry Exif data.
      // Slicing here is intentional: we keep only the small Exif segments,
      // not the full image, so total memory is proportional to Exif size.
      if (value === 0xFF && next === 0xE1) {
        exifSegments.push(uint8.slice(start, end));
      }

      start = end;
    }
  }

  // Flatten the collected Uint8Array segments into a single plain Array
  // (the return type expected by insertExif).
  if (exifSegments.length === 0) return [];

  let totalLength = 0;

  for (const seg of exifSegments) totalLength += seg.length;

  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const seg of exifSegments) {
    result.set(seg, pos);
    pos += seg.length;
  }

  return result;
}

/**
 * Insert Exif information into the given array buffer.
 * @param {ArrayBuffer} arrayBuffer - The array buffer to transform.
 * @param {Uint8Array} exifArray - The Exif data (returned by getExif).
 * @returns {ArrayBuffer} The transformed array buffer.
 */
export function insertExif(arrayBuffer, exifArray) {
  // Work directly on the typed array — avoids copying the entire compressed
  // JPEG buffer into a plain JS Array before building the output.
  const src = new Uint8Array(arrayBuffer);

  if (src[2] !== 0xFF || src[3] !== 0xE0) {
    return arrayBuffer;
  }

  const app0Length = src[2 + 2] * 256 + src[2 + 3]; // bytes 4–5
  const bodyStart = 4 + app0Length;                  // skip SOI (2) + APP0
  const bodyLength = src.length - bodyStart;

  // Output layout: SOI (2) + Exif segments + remainder of JPEG
  const out = new Uint8Array(2 + exifArray.length + bodyLength);
  out[0] = 0xFF;
  out[1] = 0xD8;
  out.set(exifArray, 2);
  out.set(src.subarray(bodyStart), 2 + exifArray.length);

  return out.buffer;
}

/**
 * Check if the given value is a Blob or File object.
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the given value is a Blob, else `false`.
 */
export function isBlob(value) {
  return value instanceof Blob || Object.prototype.toString.call(value) === '[object Blob]';
}

/**
 * Convert a data URL to a Blob object.
 * @param {string} dataURL - The data URL to convert.
 * @returns {Blob} The result Blob object.
 */
export function dataURLtoBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(arr[1]), (c) => c.charCodeAt(0));

  return new Blob([bytes], { type: mime });
}
