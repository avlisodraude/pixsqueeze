window.addEventListener('DOMContentLoaded', function () {
  var Vue = window.Vue;
  var URL = window.URL || window.webkitURL;
  var XMLHttpRequest = window.XMLHttpRequest;
  var Compressor = window.Compressor;

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
    var form = new FormData();
    form.append('file', file);
    return fetch('/api/convert/heic', { method: 'POST', body: form })
      .then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (json) {
            throw new Error('HEIC conversion failed: ' + (json.error || res.status));
          });
        }
        var serverName = res.headers.get('X-Original-Name');
        var outputName = serverName || (file.name || 'image.heic').replace(/\.heic$/i, '.jpg');
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
            console.log('Output: ', result);

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

        console.log('Input: ', file);

        var vm = this;

        isHeicFile(file).then(function (heic) {
          if (!heic) return file;
          console.log('HEIC detected — converting on server…');
          return convertHeicOnServer(file);
        }).then(function (resolvedFile) {
          if (URL) {
            vm.inputURL = URL.createObjectURL(resolvedFile);
          }
          vm.input = resolvedFile;
          new Compressor(resolvedFile, vm.options);
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
        blob.name = 'picture.jpg';
        vm.compress(blob);
      };
      xhr.open('GET', 'images/picture.jpg');
      xhr.responseType = 'blob';
      xhr.send();
    },
  });
});
