// Local-only API verification; never run against a hosted site.
import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:5176";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local URL required");
const login = await fetch(base + "/signin-with-chatgpt?return_to=%2F", {
  redirect: "manual",
});
const cookie = login.headers.get("set-cookie")?.split(";")[0];
assert(cookie, "local sign-in cookie");
const call = async (data) => {
  const r = await fetch(base + "/api/community", {
    method: data ? "POST" : "GET",
    headers: {
      cookie,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const v = await r.json();
  assert.equal(r.status, 200, JSON.stringify(v));
  return v;
};
assert.equal((await fetch(base + "/api/community")).status, 401);
const initial = await call();
assert.equal(initial.user.admin, true);
const lecture = await call({
  kind: "lecture",
  title: "API: локальная проверка",
  subject: "Физика",
  date: "2026-09-15",
  summary: "Проверка всех операций хранения.",
  audio: "javascript:bad",
  photos: ["https://bad.example/"],
});
await call({
  kind: "lecture",
  id: lecture.id,
  title: "API: отредактировано",
  subject: "Физика",
  date: "2026-09-15",
  summary: "Обновлённая выжимка",
});
await call({ kind: "mark", parent: lecture.id, value: "done" });
await call({ kind: "confused", parent: lecture.id });
const q = await call({
  kind: "comment",
  parent: lecture.id,
  text: "Почему так?",
  time: 65,
});
await call({
  kind: "comment",
  parent: lecture.id,
  text: "Ответ на вопрос",
  replyTo: q.id,
});
await call({ kind: "reaction", parent: q.id, value: "Спасибо, выручил" });
const request = await call({
  kind: "request",
  title: "Нужно фото",
  subject: "Физика",
  date: "2026-09-15",
});
await call({
  kind: "request",
  id: request.id,
  title: "Нужно фото",
  subject: "Физика",
  date: "2026-09-15",
  closed: true,
  lectureId: lecture.id,
});
await call({
  kind: "collection",
  title: "Проверочная подборка",
  lectureIds: [lecture.id],
  formula: "F=ma",
  questions: "Что такое сила?",
});
const state = await call();
assert(
  state.items.some(
    (x) => x.id === lecture.id && x.title === "API: отредактировано",
  ),
);
assert(
  state.items.some(
    (x) => x.parent === lecture.id && x.kind === "mark" && x.value === "done",
  ),
);
assert.equal(state.confused[lecture.id], 1);
assert(!state.items.some((x) => x.kind === "confused"));
assert(state.items.some((x) => x.replyTo === q.id));
assert(state.items.some((x) => x.id === request.id && x.closed));
await call({ kind: "confused", parent: lecture.id });
await call({ kind: "reaction", parent: q.id, value: "Спасибо, выручил" });
const toggled = await call();
assert(!toggled.confused[lecture.id]);
assert(!toggled.items.some((x) => x.kind === "reaction" && x.parent === q.id));
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=",
  "base64",
);
const f = new FormData();
f.append("file", new Blob([bytes], { type: "image/png" }), "test.png");
const upload = await fetch(base + "/api/files", {
  method: "POST",
  headers: { cookie },
  body: f,
});
assert.equal(upload.status, 200);
const asset = await upload.json();
const downloaded = await fetch(base + asset.url, { headers: { cookie } });
assert.equal(downloaded.status, 200);
assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
assert.equal((await fetch(base + asset.url)).status, 401);
const invalid = new FormData();
invalid.append(
  "file",
  new Blob(["<svg/>"], { type: "image/svg+xml" }),
  "test.svg",
);
assert.equal(
  (
    await fetch(base + "/api/files", {
      method: "POST",
      headers: { cookie },
      body: invalid,
    })
  ).status,
  400,
);
for (const [range, expected] of [
  ["bytes=0-9", bytes.subarray(0, 10)],
  ["bytes=-8", bytes.subarray(-8)],
]) {
  const response = await fetch(base + asset.url, {
    headers: { cookie, range },
  });
  assert.equal(response.status, 206);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  assert(response.headers.get("content-range")?.startsWith("bytes "));
}
assert.equal(
  (
    await fetch(base + asset.url, {
      headers: { cookie, range: "bytes=999999-" },
    })
  ).status,
  416,
);
for (const data of [
  null,
  { kind: "comment", parent: "missing", text: "test" },
  { kind: "reaction", parent: lecture.id, value: "fake" },
  {
    kind: "lecture",
    title: "Invalid date",
    subject: "Физика",
    date: "2026-02-31",
    summary: "test",
  },
  { kind: "collection", title: "Invalid target", lectureIds: ["missing"] },
  {
    kind: "request",
    title: "Invalid target",
    subject: "Физика",
    date: "2026-09-15",
    closed: true,
    lectureId: "missing",
  },
  { kind: "comment", parent: "demo-1", text: "Wrong lecture", replyTo: q.id },
]) {
  const response = await fetch(base + "/api/community", {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  assert.equal(response.status, 400, JSON.stringify(data));
}
console.log(
  "PASS: publication/editing, saved marks, questions/replies, reactions, collections, request closure, image files, byte ranges, invalid dates/references/payloads, and authentication.",
);
