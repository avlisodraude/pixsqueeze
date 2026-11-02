/** Shared transport for the three optional server conversion helpers. */
export default async function convert(file, endpoint, format, options = {}) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal: options.signal,
    headers: options.headers,
    credentials: options.credentials,
  });

  if (!res.ok) {
    let message = `Server responded ${res.status}`;
    try {
      const json = await res.json();
      if (json.error) message = json.error;
    } catch (e) { /* response was not JSON */ }
    throw new Error(`${format.toUpperCase()} conversion failed: ${message}`);
  }

  const blob = await res.blob();
  const originalName = file.name || `image.${format}`;
  const outputName = res.headers.get('X-Original-Name') || `${originalName.replace(/\.[^.]+$/, '')}.jpg`;
  return new File([blob], outputName, { type: 'image/jpeg' });
}
