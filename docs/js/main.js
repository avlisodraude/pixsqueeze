window.addEventListener('DOMContentLoaded', function () {
  var Vue = window.Vue;
  var URL = window.URL || window.webkitURL;
  var XMLHttpRequest = window.XMLHttpRequest;
  var PixSqueeze = window.PixSqueeze;

  // ── HEIC helpers (inline, no import needed in plain-JS demo) ─────────────

  var HEIC_MIME_RE = /^image\/hei[cf]/i;

  /**
   * Returns a Promise<boolean> — true if the file is HEIC/HEIF.
   * Checks the MIME type first; falls back to reading the first 12 bytes so
   * that iOS files with an empty `type` field are still detected correctly.
   */
  function isHeicFile(file) {
    if (HEIC_MIME_RE.test(file.type)) return Promise.resolve(true);
    if (file.type && !file.type.startsWith('image/')) return Promise.resolve(false);
    return file.slice(0, 12).arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
      var brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      return ftyp === 'ftyp' && /^hei[cfxs]|^hevc|^mif1|^msf1/.test(brand);
    }).catch(function () { return false; });
  }

  /**
   * POST the HEIC file to the server, get back a JPEG File object.
   */
  function convertHeicOnServer(file) {
    return convertOnServer(file, '/api/convert/heic', 'HEIC', /\.heic$/i, '.jpg');
  }

  // ── TIFF helpers ─────────────────────────────────────────────────────────

  var TIFF_MIME_RE = /^image\/tiff/i;
  var TIFF_EXT_RE = /\.tiff?$/i;

  /**
   * Returns a Promise<boolean> — true if the file is a TIFF image.
   */
  function isTiffFile(file) {
    if (TIFF_MIME_RE.test(file.type)) return Promise.resolve(true);
    if (TIFF_EXT_RE.test(file.name || '')) return Promise.resolve(true);
    if (file.type && !file.type.startsWith('image/')) return Promise.resolve(false);
    return file.slice(0, 4).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      return (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00)
          || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A);
    }).catch(function () { return false; });
  }

  /**
   * POST the TIFF file to the server, get back a JPEG File object.
   */
  function convertTiffOnServer(file) {
    return convertOnServer(file, '/api/convert/tiff', 'TIFF', /\.tiff?$/i, '.jpg');
  }

  // ── Camera RAW helpers ───────────────────────────────────────────────────

  var RAW_MIME_RE = /^image\/(x-adobe-dng|x-canon-cr[23]|x-nikon-nef|x-sony-arw|x-fuji-raf|x-panasonic-rw2|x-pentax-pef|x-olympus-orf|x-samsung-srw)/i;
  var RAW_EXT_RE = /\.(dng|cr2|cr3|nef|arw|raf|rw2|pef|orf|srw|3fr|dcr|kdc|mrw|nrw|rwl|x3f)$/i;

  /**
   * Returns a Promise<boolean> — true if the file is a camera RAW image.
   */
  function isRawFile(file) {
    if (RAW_MIME_RE.test(file.type)) return Promise.resolve(true);
    if (RAW_EXT_RE.test(file.name || '')) return Promise.resolve(true);
    return file.slice(0, 8).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf);
      var raf = String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]);
      if (raf === 'FUJIFILM') return true;
      return b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x55 && b[3] === 0x00;
    }).catch(function () { return false; });
  }

  /**
   * POST the RAW file to the server, get back a JPEG File object.
   */
  function convertRawOnServer(file) {
    return convertOnServer(file, '/api/convert/raw', 'RAW', RAW_EXT_RE, '.jpg');
  }

  // ── Shared server-convert helper ─────────────────────────────────────────

  function convertOnServer(file, endpoint, label, extRe, outputExt) {
    var form = new FormData();
    form.append('file', file);
    return fetch(endpoint, { method: 'POST', body: form })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            throw new Error(label + ' conversion failed: ' + (json.error || res.status));
          });
        }
        var serverName = res.headers.get('X-Original-Name');
        var outputName = serverName || (file.name || ('image' + outputExt)).replace(extRe, outputExt);
        return res.blob().then(function (blob) {
          return new File([blob], outputName, { type: 'image/jpeg' });
        });
      });
  }

  // ─────────────────────────────────────────────────────────────────────────

  Vue.component('VueCompareImage', window.vueCompareImage);

  new Vue({
    el: '#app',

    data: function () {
      var vm = this;

      return {
        options: {
          strict: true,
          checkOrientation: true,
          retainExif: false,
          maxWidth: undefined,
          maxHeight: undefined,
          minWidth: 0,
          minHeight: 0,
          width: undefined,
          height: undefined,
          resize: 'none',
          quality: 0.8,
          mimeType: '',
          convertTypes: 'image/png',
          convertSize: 5000000,
          success: function (result) {
            if (URL) {
              vm.outputURL = URL.createObjectURL(result);
            }

            vm.output = result;
            vm.$refs.input.value = '';
          },
          error: function (err) {
            window.alert(err.message);
          },
        },
        inputURL: '',
        outputURL: '',
        input: {},
        output: {},
      };
    },

    filters: {
      prettySize: function (size) {
        var kilobyte = 1024;
        var megabyte = kilobyte * kilobyte;

        if (size > megabyte) {
          return (size / megabyte).toFixed(2) + ' MB';
        } else if (size > kilobyte) {
          return (size / kilobyte).toFixed(2) + ' KB';
        } else if (size >= 0) {
          return size + ' B';
        }

        return 'N/A';
      },
    },

    methods: {
      compress: function (file) {
        if (!file) {
          return;
        }

        var vm = this;

        isHeicFile(file).then(function (heic) {
          if (!heic) return file;
          return convertHeicOnServer(file);
        }).then(function (resolvedFile) {
          return isTiffFile(resolvedFile).then(function (tiff) {
            if (!tiff) return resolvedFile;
            return convertTiffOnServer(resolvedFile);
          });
        }).then(function (resolvedFile) {
          return isRawFile(resolvedFile).then(function (raw) {
            if (!raw) return resolvedFile;
            return convertRawOnServer(resolvedFile);
          });
        }).then(function (resolvedFile) {
          if (URL) {
            vm.inputURL = URL.createObjectURL(resolvedFile);
          }
          vm.input = resolvedFile;
          new PixSqueeze(resolvedFile, vm.options);
        }).catch(function (err) {
          window.alert(err.message);
        });
      },

      change: function (e) {
        this.compress(e.target.files ? e.target.files[0] : null);
      },

      dragover: function(e) {
        e.preventDefault();
      },

      drop: function(e) {
        e.preventDefault();
        this.compress(e.dataTransfer.files ? e.dataTransfer.files[0] : null);
      },
    },

    watch: {
      options: {
        deep: true,
        handler: function () {
          this.compress(this.input);
        },
      },
    },

    mounted: function () {
      if (!XMLHttpRequest) {
        return;
      }

      var vm = this;
      var xhr = new XMLHttpRequest();

      xhr.onload = function () {
        var blob = xhr.response;
        var date = new Date();

        blob.lastModified = date.getTime();
        blob.lastModifiedDate = date;
        blob.name = 'alosha.png';
        vm.compress(blob);
      };
      xhr.open('GET', 'images/alosha.png');
      xhr.responseType = 'blob';
      xhr.send();
    },
  });
});
