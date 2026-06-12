import { isHeicFile, convertHeicOnServer } from '../../src/heic.js';

function fileWithBytes(bytes, name, type = '') {
  return new File([new Uint8Array(bytes)], name, { type });
}

// 12-byte ISO BMFF header: [size(4)] 'ftyp' [brand(4)]
function ftypHeader(brand) {
  const chars = `....ftyp${brand}`.split('').map((c) => c.charCodeAt(0));
  chars[0] = 0x00;
  chars[1] = 0x00;
  chars[2] = 0x00;
  chars[3] = 0x18;
  return chars;
}

describe('heic', () => {
  describe('isHeicFile', () => {
    it('should detect by MIME type image/heic', async () => {
      expect(await isHeicFile(new File([], 'a', { type: 'image/heic' }))).to.be.true;
    });

    it('should detect by MIME type image/heif', async () => {
      expect(await isHeicFile(new File([], 'a', { type: 'image/heif' }))).to.be.true;
    });

    it('should reject non-image MIME types without sniffing', async () => {
      expect(await isHeicFile(fileWithBytes(ftypHeader('heic'), 'a.pdf', 'application/pdf'))).to.be.false;
    });

    it('should detect ftyp heic magic bytes when MIME type is empty (iOS case)', async () => {
      expect(await isHeicFile(fileWithBytes(ftypHeader('heic'), 'IMG_0001'))).to.be.true;
    });

    it('should detect ftyp mif1 brand', async () => {
      expect(await isHeicFile(fileWithBytes(ftypHeader('mif1'), 'IMG_0002'))).to.be.true;
    });

    it('should reject PNG magic bytes', async () => {
      const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0];
      expect(await isHeicFile(fileWithBytes(png, 'a.png'))).to.be.false;
    });
  });

  describe('convertHeicOnServer', () => {
    const realFetch = window.fetch;

    afterEach(() => {
      window.fetch = realFetch;
    });

    it('should return a JPEG File named after the original on success', async () => {
      window.fetch = () => Promise.resolve(new Response(new Blob(['jpegdata']), { status: 200 }));

      const result = await convertHeicOnServer(fileWithBytes(ftypHeader('heic'), 'photo.heic', 'image/heic'));

      expect(result).to.be.an.instanceOf(File);
      expect(result.name).to.equal('photo.jpg');
      expect(result.type).to.equal('image/jpeg');
    });

    it('should prefer the X-Original-Name response header for the filename', async () => {
      window.fetch = () => Promise.resolve(new Response(new Blob(['jpegdata']), {
        status: 200,
        headers: { 'X-Original-Name': 'server-name.jpg' },
      }));

      const result = await convertHeicOnServer(fileWithBytes(ftypHeader('heic'), 'photo.heic', 'image/heic'));

      expect(result.name).to.equal('server-name.jpg');
    });

    it('should throw with the server error message on failure', async () => {
      window.fetch = () => Promise.resolve(new Response(JSON.stringify({ error: 'unsupported brand' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }));

      try {
        await convertHeicOnServer(fileWithBytes(ftypHeader('heic'), 'photo.heic', 'image/heic'));
        throw new Error('expected convertHeicOnServer to throw');
      } catch (err) {
        expect(err.message).to.contain('unsupported brand');
      }
    });
  });
});
