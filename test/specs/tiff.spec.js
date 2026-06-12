import { isTiffFile, convertTiffOnServer } from '../../src/tiff.js';

function fileWithBytes(bytes, name, type = '') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('tiff', () => {
  describe('isTiffFile', () => {
    it('should detect by MIME type image/tiff', async () => {
      expect(await isTiffFile(new File([], 'a', { type: 'image/tiff' }))).to.be.true;
    });

    it('should detect by .tif and .tiff extensions', async () => {
      expect(await isTiffFile(new File([], 'scan.tif'))).to.be.true;
      expect(await isTiffFile(new File([], 'scan.tiff'))).to.be.true;
    });

    it('should detect little-endian magic bytes (II*\\0)', async () => {
      expect(await isTiffFile(fileWithBytes([0x49, 0x49, 0x2A, 0x00], 'mystery'))).to.be.true;
    });

    it('should detect big-endian magic bytes (MM\\0*)', async () => {
      expect(await isTiffFile(fileWithBytes([0x4D, 0x4D, 0x00, 0x2A], 'mystery'))).to.be.true;
    });

    it('should reject JPEG magic bytes', async () => {
      expect(await isTiffFile(fileWithBytes([0xFF, 0xD8, 0xFF, 0xE0], 'photo'))).to.be.false;
    });

    it('should reject non-image MIME types without sniffing', async () => {
      expect(await isTiffFile(fileWithBytes([0x49, 0x49, 0x2A, 0x00], 'a.bin', 'application/octet-stream'))).to.be.false;
    });
  });

  describe('convertTiffOnServer', () => {
    const realFetch = window.fetch;

    afterEach(() => {
      window.fetch = realFetch;
    });

    it('should return a JPEG File with the .tiff extension replaced', async () => {
      window.fetch = () => Promise.resolve(new Response(new Blob(['jpegdata']), { status: 200 }));

      const result = await convertTiffOnServer(new File([], 'scan.tiff', { type: 'image/tiff' }));

      expect(result).to.be.an.instanceOf(File);
      expect(result.name).to.equal('scan.jpg');
      expect(result.type).to.equal('image/jpeg');
    });

    it('should throw with the server error message on failure', async () => {
      window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'corrupt tiff' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }));

      try {
        await convertTiffOnServer(new File([], 'scan.tiff', { type: 'image/tiff' }));
        throw new Error('expected convertTiffOnServer to throw');
      } catch (err) {
        expect(err.message).to.contain('corrupt tiff');
      }
    });
  });
});
