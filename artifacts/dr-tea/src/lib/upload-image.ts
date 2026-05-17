import { requestUploadUrl, finalizeUpload } from "@workspace/api-client-react";

export async function uploadImage(file: File): Promise<string> {
  const ct = file.type || "application/octet-stream";
  const { uploadURL, objectPath } = await requestUploadUrl({
    name: file.name,
    size: file.size,
    contentType: ct,
  });
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": ct },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed: ${put.status}`);
  }
  const finalized = await finalizeUpload({ objectPath });
  return finalized.objectPath;
}
