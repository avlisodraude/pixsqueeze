'use strict';

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`PixSqueeze.js demo server running at http://localhost:${PORT}`);
  console.log(`HEIC conversion endpoint: POST http://localhost:${PORT}/api/convert/heic`);
  console.log(`TIFF conversion endpoint: POST http://localhost:${PORT}/api/convert/tiff`);
  console.log(`RAW  conversion endpoint: POST http://localhost:${PORT}/api/convert/raw`);
});
