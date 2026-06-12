import { isRawFile, convertRawOnServer } from '../../src/raw.js';

function fileWithBytes(bytes, name, type = '') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('raw', () => {
  describe('isRawFile', () => {
    it('should detect by MIME type (image/x-adobe-dng)', async () => {
      expect(await isRawFile(new File([], 'a', { type: 'image/x-adobe-dng' }))).to.be.true;
    });

    it('should detect common RAW extensions', async () => {
      expect(await isRawFile(new File([], 'IMG_0001.dng'))).to.be.true;
      expect(await isRawFile(new File([], 'shot.CR2'))).to.be.true;
      expect(await isRawFile(new File([], 'shot.nef'))).to.be.true;
      expect(await isRawFile(new File([], 'shot.arw'))).to.be.true;
      expect(await isRawFile(new File([], 'shot.x3f'))).to.be.true;
    });

    it('should detect Fujifilm RAF magic bytes', async () => {
      const fuji = 'FUJIFILM'.split('').map((c) => c.charCodeAt(0));
      expect(await isRawFile(fileWithBytes(fuji, 'mystery'))).to.be.true;
    });

    it('should detect Panasonic RW2 magic bytes (II U\\0)', async () => {
      expect(await isRawFile(fileWithBytes([0x49, 0x49, 0x55, 0x00, 0, 0, 0, 0], 'mystery'))).to.be.true;
    });

    it('should not flag a plain TIFF without a RAW extension', async () => {
      // DNG/CR2/NEF/ARW share TIFF magic — detection relies on the extension.
      expect(await isRawFile(fileWithBytes([0x49, 0x49, 0x2A, 0x00, 0, 0, 0, 0], 'scan'))).to.be.false;
    });

    it('should reject a regular JPEG', async () => {
      expect(await isRawFile(fileWithBytes([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0], 'photo.jpeg', 'image/jpeg'))).to.be.false;
    });
  });

  describe('convertRawOnServer', () => {
    const realFetch = window.fetch;

    afterEach(() => {
      window.fetch = realFetch;
    });

    it('should return a JPEG File with the RAW extension replaced', async () => {
      window.fetch = () => Promise.resolve(new Response(new Blob(['jpegdata']), { status: 200 }));

      const result = await convertRawOnServer(new File([], 'DSC_0001.NEF'));

      expect(result).to.be.an.instanceOf(File);
      expect(result.name).to.equal('DSC_0001.jpg');
      expect(result.type).to.equal('image/jpeg');
    });

    it('should throw with the server error message on failure', async () => {
      window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'libraw unsupported' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }));

      try {
        await convertRawOnServer(new File([], 'DSC_0001.NEF'));
        throw new Error('expected convertRawOnServer to throw');
      } catch (err) {
        expect(err.message).to.contain('libraw unsupported');
      }
    });
  });
});
