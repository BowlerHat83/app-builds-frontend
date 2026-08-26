// Fetches a same-origin image (served from public/) and converts it to a
// base64 data URL, which is what jsPDF's addImage() needs. Returns null on
// any failure so PDF generation can fall back to a text wordmark instead of
// throwing and losing the whole download.
export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
