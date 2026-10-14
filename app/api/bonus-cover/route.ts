const maxImageSize = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function errorResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  const fileId = new URL(request.url).searchParams.get("id");
  if (!fileId || fileId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
    return errorResponse("Invalid Google Drive image ID.", 400);
  }

  let imageResponse: Response;
  try {
    imageResponse = await fetch(
      `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
  } catch {
    return errorResponse("Could not retrieve the Google Drive image.", 502);
  }

  const finalUrl = new URL(imageResponse.url);
  if (
    !imageResponse.ok
    || (finalUrl.hostname !== "drive.usercontent.google.com"
      && !finalUrl.hostname.endsWith(".googleusercontent.com"))
  ) {
    return errorResponse("Google Drive did not return an image.", 502);
  }

  const contentType = imageResponse.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!contentType || !allowedImageTypes.has(contentType)) {
    return errorResponse("The Google Drive file is not a supported image.", 415);
  }

  const contentLength = Number(imageResponse.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxImageSize) {
    return errorResponse("The Google Drive image exceeds the 5 MB limit.", 413);
  }
  if (!imageResponse.body) {
    return errorResponse("Google Drive returned an empty image.", 502);
  }

  const reader = imageResponse.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > maxImageSize) {
      await reader.cancel();
      return errorResponse("The Google Drive image exceeds the 5 MB limit.", 413);
    }
    chunks.push(value);
  }

  const image = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    image.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Content-Length": String(totalSize),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
