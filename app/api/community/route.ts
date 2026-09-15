import { context, failure, sameOrigin, safeFile } from "@/lib/server";
import { seed, type Item } from "@/lib/content";
type StoredRecord = {
  id: string;
  kind: string;
  owner: string;
  parent: string;
  data: string;
  created: string;
};
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user, db, admin } = await context();
    const rows = await db.prepare("SELECT * FROM records").all<StoredRecord>();
    const items = new Map(seed.map((x) => [x.id, x]));
    for (const r of rows.results) {
      if (r.kind === "mark" && r.owner !== user.userId) continue;
      const item = {
        ...JSON.parse(r.data),
        id: r.id,
        kind: r.kind,
        parent: r.parent,
        owner: r.owner,
        created: r.created,
      };
      items.set(r.id, item);
    }
    const all = [...items.values()];
    const counts: Record<string, number> = {};
    for (const r of rows.results)
      if (r.kind === "confused") counts[r.parent] = (counts[r.parent] || 0) + 1;
    return Response.json(
      {
        items: all
          .filter((x) => x.kind !== "confused")
          .map((x) =>
            x.kind === "reaction"
              ? { ...x, owner: undefined, mine: x.owner === user.userId }
              : x,
          ),
        confused: counts,
        myConfused: rows.results
          .filter((r) => r.kind === "confused" && r.owner === user.userId)
          .map((r) => r.parent),
        user: {
          id: user.userId,
          name: user.fullName || "Участник группы",
          admin,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req))
      return Response.json(
        { error: "Недопустимый источник запроса" },
        { status: 403 },
      );
    const { user, db, admin } = await context();
    let b: Item;
    try {
      b = await req.json();
    } catch {
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    }
    if (!b || typeof b !== "object" || Array.isArray(b))
      return Response.json({ error: "Некорректный запрос" }, { status: 400 });
    const kinds = [
      "lecture",
      "comment",
      "request",
      "collection",
      "mark",
      "confused",
      "reaction",
    ];
    if (!kinds.includes(b.kind))
      return Response.json({ error: "Некорректный тип" }, { status: 400 });
    const parent = String(b.parent || "").slice(0, 100);
    if (["lecture", "collection"].includes(b.kind) && !admin)
      return Response.json(
        { error: "Публиковать материалы может только староста." },
        { status: 403 },
      );
    let id = typeof b.id === "string" && b.id ? b.id : crypto.randomUUID();
    const existing = await db
      .prepare("SELECT owner,kind,data FROM records WHERE id=?")
      .bind(id)
      .first<StoredRecord>();
    const preset = seed.find((x) => x.id === id);
    if (
      (existing && existing.kind !== b.kind) ||
      (preset && preset.kind !== b.kind)
    )
      return Response.json({ error: "Некорректная запись" }, { status: 400 });
    if (existing && existing.owner !== user.userId && !admin)
      return Response.json(
        { error: "Нет доступа к редактированию" },
        { status: 403 },
      );
    let data: Partial<Item> = {};
    const str = (v: unknown, n = 20000) =>
      typeof v === "string" ? v.trim().slice(0, n) : "";
    const lookup = async (target: string) => {
      const row = await db
        .prepare("SELECT id,kind,parent,data FROM records WHERE id=?")
        .bind(target)
        .first<StoredRecord>();
      return row
        ? {
            ...JSON.parse(row.data),
            id: row.id,
            kind: row.kind,
            parent: row.parent,
          }
        : seed.find((x) => x.id === target);
    };
    const invalid = (error: string) =>
      Response.json({ error }, { status: 400 });
    const validDate = (v: unknown) =>
      typeof v === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v;
    if (["comment", "mark", "confused", "reaction"].includes(b.kind)) {
      const target = await lookup(parent);
      if (
        !target ||
        (b.kind === "reaction"
          ? !["lecture", "comment"].includes(target.kind)
          : target.kind !== "lecture")
      )
        return invalid("Лекция или сообщение не найдены.");
    }
    if (b.kind === "comment" && b.replyTo) {
      const target = await lookup(String(b.replyTo));
      if (
        !target ||
        target.kind !== "comment" ||
        target.parent !== parent ||
        target.replyTo
      )
        return invalid("Сообщение для ответа не найдено в этой лекции.");
    }
    if (
      b.kind === "reaction" &&
      !["Спасибо, выручил", "❤️", "😂"].includes(b.value)
    )
      return invalid("Неизвестная реакция.");
    if (["lecture", "request"].includes(b.kind) && !validDate(b.date))
      return invalid("Укажите корректную дату.");
    if (preset && !admin)
      return Response.json(
        { error: "Примеры может изменять только староста." },
        { status: 403 },
      );
    if (b.kind === "lecture") {
      data = {
        title: str(b.title, 200),
        subject: str(b.subject, 100),
        date: str(b.date, 10),
        summary: str(b.summary),
        formula: str(b.formula, 3000),
        questions: str(b.questions, 3000),
        audio: safeFile(b.audio),
        photos: Array.isArray(b.photos)
          ? b.photos.map(safeFile).filter(Boolean).slice(0, 12)
          : [],
        demo: false,
      };
      if (
        !data.title ||
        !data.summary ||
        !data.subject ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
      )
        return Response.json(
          { error: "Заполните тему, предмет, дату и выжимку." },
          { status: 400 },
        );
    }
    if (b.kind === "comment") {
      data = {
        text: str(b.text, 4000),
        name: user.fullName || "Участник группы",
        image: safeFile(b.image),
        meme: !!b.meme,
        replyTo: str(b.replyTo, 100),
        time:
          Number.isFinite(b.time) && b.time >= 0
            ? Math.min(b.time, 86400)
            : null,
      };
      if (!parent || (!data.text && !data.image))
        return Response.json(
          { error: "Добавьте текст или фото." },
          { status: 400 },
        );
    }
    if (b.kind === "request") {
      if (b.closed && (await lookup(String(b.lectureId)))?.kind !== "lecture")
        return invalid("Выберите существующую лекцию.");
      data = {
        title: str(b.title, 200),
        subject: str(b.subject, 100),
        date: str(b.date, 10),
        closed: !!b.closed,
        lectureId: str(b.lectureId, 100),
      };
      if (!data.title)
        return Response.json({ error: "Опишите материал." }, { status: 400 });
      if (data.closed && !admin)
        return Response.json(
          { error: "Запрос закрывает староста после публикации." },
          { status: 403 },
        );
      if (data.closed && !data.lectureId)
        return Response.json(
          { error: "Укажите опубликованную лекцию." },
          { status: 400 },
        );
    }
    if (b.kind === "collection") {
      if (!Array.isArray(b.lectureIds)) return invalid("Выберите лекции.");
      for (const target of b.lectureIds) {
        if (
          typeof target !== "string" ||
          (await lookup(target))?.kind !== "lecture"
        )
          return invalid("Одна из лекций подборки не найдена.");
      }
      data = {
        title: str(b.title, 200),
        lectureIds: Array.isArray(b.lectureIds)
          ? b.lectureIds
              .filter((x: unknown) => typeof x === "string")
              .slice(0, 100)
          : [],
        formula: str(b.formula, 4000),
        questions: str(b.questions, 4000),
      };
      if (!data.title || !data.lectureIds.length)
        return Response.json(
          { error: "Добавьте название и хотя бы одну лекцию." },
          { status: 400 },
        );
    }
    if (["mark", "confused", "reaction"].includes(b.kind)) {
      if (!parent)
        return Response.json(
          { error: "Не выбрана лекция или сообщение." },
          { status: 400 },
        );
      data = { value: str(b.value, 40) };
      id = [
        b.kind,
        user.userId,
        parent,
        b.kind === "reaction" ? data.value : "",
      ].join(":");
      const toggleExists = await db
        .prepare("SELECT id FROM records WHERE id=?")
        .bind(id)
        .first();
      if (b.kind !== "mark" && toggleExists) {
        await db
          .prepare("DELETE FROM records WHERE id=? AND owner=?")
          .bind(id, user.userId)
          .run();
        return Response.json({ ok: true });
      }
      if (b.kind === "mark" && !["done", "repeat", ""].includes(data.value))
        return Response.json(
          { error: "Некорректная отметка" },
          { status: 400 },
        );
    }
    await db
      .prepare(
        "INSERT INTO records(id,kind,owner,parent,data,created) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      )
      .bind(
        id,
        b.kind,
        user.userId,
        parent,
        JSON.stringify(data),
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true, id });
  } catch (e) {
    return failure(e);
  }
}
