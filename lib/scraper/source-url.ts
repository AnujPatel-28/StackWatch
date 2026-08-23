export type SourceUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: string };

export function validateSourceUrl(value: string): SourceUrlValidation {
  const candidate = value.trim();
  if (!candidate) return { ok: false, reason: "Enter a documentation URL." };

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "Documentation URLs must use HTTP or HTTPS." };
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return { ok: true, url: url.toString() };
  } catch {
    return { ok: false, reason: "Enter a valid public HTTP or HTTPS URL." };
  }
}
