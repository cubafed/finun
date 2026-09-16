import { env } from "cloudflare:workers";
import { context, failure, sameOrigin } from "@/lib/server";
export const dynamic = "force-dynamic";

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const audioTypes = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
    const { admin } = await context();
    if (!env.BUCKET) throw new Error("STORAGE");
    if (!req.body)
      return Response.json({ error: "Выберите файл" }, { status: 400 });
    const type = req.headers.get("content-type")?.split(";", 1)[0] || "";
    const declaredSize = Number(req.headers.get("x-file-size") || "0");
    const image = imageTypes.includes(type);
    const audio = audioTypes.includes(type);
    if (!image && !(audio && admin))
      return Response.json(
        {
          error:
            "Допустимы JPG, PNG, WebP, GIF; старосте также MP3, M4A, WAV, OGG и WebM.",
        },
        { status: 400 },
      );
    if (
      !Number.isSafeInteger(declaredSize) ||
      declaredSize <= 0 ||
      declaredSize > (image ? 8 : 50) * 1024 * 1024
    )
      return Response.json(
        {
          error: image
            ? "Фото должно быть меньше 8 МБ."
            : "Аудио должно быть меньше 50 МБ.",
        },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.BUCKET.put(id, req.body, {
      httpMetadata: { contentType: type },
    });
    return Response.json({ url: "/api/files?id=" + id });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    await context();
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[a-f0-9-]+$/.test(id) || !env.BUCKET)
      return new Response("Not found", { status: 404 });
    let range: { offset: number; length: number } | undefined;
    const requested = req.headers.get("range");
    if (requested) {
      const info = await env.BUCKET.head(id);
      if (!info) return new Response("Not found", { status: 404 });
      const match = /^bytes=(\d*)-(\d*)$/.exec(requested);
      const reject = () =>
        new Response(null, {
          status: 416,
          headers: { "Content-Range": "bytes */" + info.size },
        });
      if (!match || (!match[1] && !match[2])) return reject();
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, info.size - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), info.size - 1)
          : info.size - 1;
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start >= info.size ||
        end < start
      )
        return reject();
      range = { offset: start, length: end - start + 1 };
    }
    const f = await env.BUCKET.get(id, range ? { range } : {});
    if (!f) return new Response("Not found", { status: 404 });
    return new Response(f.body, {
      status: range ? 206 : 200,
      headers: {
        ...(range
          ? {
              "Content-Range": `bytes ${range.offset}-${range.offset + range.length - 1}/${f.size}`,
            }
          : {}),
        "Accept-Ranges": "bytes",
        "Content-Type":
          f.httpMetadata?.contentType || "application/octet-stream",
        "Content-Length": String(range ? range.length : f.size),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
