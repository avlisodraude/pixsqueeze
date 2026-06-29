// Recipe: Compress and store user uploads in your Node backend
//
// Hits the real hosted Batch API at https://pixsqueeze-api-production.up.railway.app
// when PIXSQUEEZE_KEY is set. Without a key, this runs against a tiny local
// mock server returning the same response shape, so the example runs
// standalone with no credentials.
import { writeFile } from "node:fs/promises";
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
        results: [{ originalName: "upload.jpg", data: Buffer.from("fake-compressed-bytes").toString("base64") }],
        usage: { remaining: 4998 },
      }),
    );
  });
  await new Promise((resolve) => mockServer.listen(0, resolve));
  return `http://localhost:${mockServer.address().port}`;
}

const buffer = Buffer.from("pretend this is JPEG bytes from a real upload");
const form = new FormData();
form.append("files[]", new Blob([buffer]), "upload.jpg");
form.append("quality", "0.7");
form.append("maxWidth", "1600");

const res = await fetch(`${baseUrl}/compress/batch`, {
  method: "POST",
  headers: { Authorization: "Bearer " + (apiKey || "demo-key") },
  body: form,
});
const { results, usage } = await res.json();

for (const img of results) {
  await writeFile(img.originalName, Buffer.from(img.data, "base64"));
}
console.log(usage.remaining + " compressions left this month");
mockServer?.close();
