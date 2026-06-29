// Recipe: Convert iPhone HEIC uploads to WebP on the fly
//
// Hits the real hosted Batch API when PIXSQUEEZE_KEY is set; otherwise runs
// against a tiny local mock server with the same response shape, so the
// example runs standalone with no credentials.
import http from "node:http";

const apiKey = process.env.PIXSQUEEZE_KEY;
let mockServer;
const baseUrl = apiKey
  ? "https://pixsqueeze-api-production.up.railway.app"
  : await startMockServer();

async function startMockServer() {
  mockServer = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        results: [{ data: Buffer.from("fake-webp-bytes").toString("base64") }],
      }),
    );
  });
  await new Promise((resolve) => mockServer.listen(0, resolve));
  return `http://localhost:${mockServer.address().port}`;
}

// Stand-in for a real HEIC File from an <input type="file"> upload.
const heicFile = new Blob([Buffer.from("pretend this is HEIC bytes from an iPhone")]);

const form = new FormData();
form.append("files[]", heicFile, "photo.heic");
form.append("mimeType", "image/webp");
form.append("quality", "0.8");

const res = await fetch(`${baseUrl}/compress/batch`, {
  method: "POST",
  headers: { Authorization: "Bearer " + (apiKey || "demo-key") },
  body: form,
});
const { results } = await res.json();
const src = "data:image/webp;base64," + results[0].data;

console.log("ready to render: <img src=\"" + src.slice(0, 40) + "...\">");
mockServer?.close();
