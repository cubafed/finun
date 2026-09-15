"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Search,
  Plus,
  ArrowUpRight,
  MessageCircle,
  Headphones,
  Image as ImageIcon,
  Check,
  Bookmark,
  GraduationCap,
  Clock,
  ArrowLeft,
  Send,
  HelpCircle,
  CalendarDays,
  FileText,
  Upload,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Toaster, toast } from "sonner";
import { seed, subjects, Item } from "@/lib/content";
import { useStudyHistory } from "@/hooks/use-study-history";
const date = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const blank = {
  id: "",
  kind: "lecture",
  title: "",
  subject: subjects[0],
  date: today(),
  summary: "",
  formula: "",
  questions: "",
  audio: "",
  photos: [],
  lectureIds: [],
} as Item;
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((x) => (
          <SelectItem key={x} value={x}>
            {x}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export default function Community() {
  const [items, setItems] = useState<Item[]>(seed),
    [user, setUser] = useState<{
      id: string;
      name: string;
      admin: boolean;
    } | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("library"),
    [selected, setSelected] = useState(""),
    [subject, setSubject] = useState("Все предметы"),
    [query, setQuery] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [status, setStatus] = useState("Все отметки");
  const [edit, setEdit] = useState<Item | null>(null),
    [studentView, setStudentView] = useState(false),
    [confused, setConfused] = useState<Record<string, number>>({}),
    [myConfused, setMyConfused] = useState<string[]>([]),
    [reply, setReply] = useState<Item | null>(null),
    [text, setText] = useState(""),
    [image, setImage] = useState(""),
    [meme, setMeme] = useState(false),
    [time, setTime] = useState(""),
    [activity, setActivity] = useState("active");
  const audio = useRef<HTMLAudioElement>(null);
  const { position, remember } = useStudyHistory();
  const [week] = useState(() => Date.now() - 7 * 86400000);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true),
    [authRequired, setAuthRequired] = useState(false);
  async function refresh() {
    try {
      const r = await fetch("/api/community");
      const d: {
        items: Item[];
        user: { id: string; name: string; admin: boolean };
        confused: Record<string, number>;
        myConfused: string[];
        error?: string;
      } = await r.json();
      setAuthRequired(r.status === 401);
      if (!r.ok) throw Error(d.error);
      setItems(d.items);
      setUser(d.user);
      setConfused(d.confused);
      setMyConfused(d.myConfused);
      setError("");
      setReady(true);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить библиотеку.",
      );
      setReady(false);
      return false;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // Hydrate browser-only URL state and fetch the authenticated library once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const sync = () => {
      const p = new URLSearchParams(location.search);
      setSelected(p.get("lecture") || "");
      const t = p.get("tab") || "library";
      setShowFilters(t === "missed");
      setTab(
        ["library", "missed", "session", "discussions", "requests"].includes(t)
          ? t
          : "library",
      );
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  async function save(data: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d: { id?: string; error?: string } = await r.json();
      if (!r.ok) throw Error(d.error);
      const refreshed = await refresh();
      if (refreshed) toast.success("Сохранено");
      else
        toast.warning(
          "Запись сохранена, но список не обновился. Нажмите «Повторить».",
        );
      return d.id || "saved";
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить. Попробуйте ещё раз.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return "";
    setBusy(true);
    try {
      const f = new FormData();
      f.append("file", file);
      const r = await fetch("/api/files", { method: "POST", body: f });
      const d: { url?: string; error?: string } = await r.json();
      if (!r.ok) throw Error(d.error);
      return d.url || "";
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Не удалось сохранить. Попробуйте ещё раз.",
      );
      return "";
    } finally {
      setBusy(false);
    }
  }
  const admin = user?.admin && !studentView;
  const lectures = items
    .filter((x) => x.kind === "lecture")
    .sort((a, b) => b.date.localeCompare(a.date));
  const marks = items.filter((x) => x.kind === "mark");
  const mark = (id: string) => marks.find((x) => x.parent === id)?.value;
  const normalize = (s: string) =>
    s.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filtered = lectures.filter(
    (l) =>
      (subject === "Все предметы" || l.subject === subject) &&
      words.every((w) =>
        normalize(
          [
            l.title,
            l.subject,
            l.summary,
            l.formula,
            l.questions,
            l.date,
            date(l.date),
          ].join(" "),
        ).includes(w),
      ) &&
      (!from || l.date >= from) &&
      (!to || l.date <= to) &&
      (status === "Все отметки" ||
        mark(l.id) === (status === "Разобрался" ? "done" : "repeat")),
  );
  const lecture = lectures.find((x) => x.id === selected);
  const comments = items.filter((x) => x.kind === "comment");
  const requests = items.filter((x) => x.kind === "request");
  const packs = items.filter((x) => x.kind === "collection");
  function open(id: string) {
    setSelected(id);
    setReply(null);
    setText("");
    setImage("");
    setTime("");
    setMeme(false);
    remember(id);
    history.pushState(
      null,
      "",
      "?tab=" + tab + "&lecture=" + encodeURIComponent(id),
    );
    window.scrollTo({ top: 0 });
  }
  function back() {
    setSelected("");
    history.pushState(null, "", tab === "library" ? "/" : "?tab=" + tab);
    window.scrollTo({ top: 0 });
  }
  function nav(t: string) {
    setShowFilters(t === "missed");
    setSelected("");
    setTab(t);
    history.pushState(null, "", t === "library" ? "/" : "?tab=" + t);
    window.scrollTo({ top: 0 });
  }
  function reaction(target: string, value: string) {
    save({ kind: "reaction", parent: target, value });
  }
  function count(target: string, value: string) {
    return items.filter(
      (x) => x.kind === "reaction" && x.parent === target && x.value === value,
    ).length;
  }
  function reactions(target: string) {
    return (
      <div className="reactions">
        {["Спасибо, выручил", "❤️", "😂"].map((v) => (
          <button
            key={v}
            disabled={!ready || busy}
            className={
              items.some(
                (x) =>
                  x.kind === "reaction" &&
                  x.parent === target &&
                  x.value === v &&
                  x.mine,
              )
                ? "on"
                : ""
            }
            onClick={() => reaction(target, v)}
          >
            {v === "Спасибо, выручил" ? "↗ " + v : v}{" "}
            <span>{count(target, v) || ""}</span>
          </button>
        ))}
      </div>
    );
  }
  function card(l: Item) {
    const m = mark(l.id);
    return (
      <button
        key={l.id}
        className={"lecture-card subject-" + subjects.indexOf(l.subject)}
        onClick={() => open(l.id)}
      >
        <div className="card-top">
          <span className="tag">{l.subject}</span>
          <span className="meta">{date(l.date)}</span>
        </div>
        <h3>{l.title}</h3>
        <p>
          {l.summary
            .split("\n")
            .filter(Boolean)
            .find((s: string) => s.length > 45) || l.summary.slice(0, 110)}
        </p>
        <div className="card-bottom">
          <span>
            <FileText size={15} /> Выжимка {l.audio && <Headphones size={15} />}{" "}
            {l.photos?.length > 0 && <ImageIcon size={15} />}
          </span>
          <span>
            {m === "done" ? (
              <>
                <Check size={16} /> Разобрался
              </>
            ) : m === "repeat" ? (
              <>
                <Bookmark size={15} /> Повторить
              </>
            ) : (
              <>
                <MessageCircle size={15} />
                {comments.filter((c) => c.parent === l.id).length}
              </>
            )}
            <ArrowUpRight size={18} />
          </span>
        </div>
        {l.demo && (
          <small className="demo-label">Демонстрационная лекция</small>
        )}
      </button>
    );
  }
  function comment(c: Item, nested = false) {
    const replies = comments.filter((x) => x.replyTo === c.id);
    return (
      <article className={"comment " + (nested ? "reply" : "")} key={c.id}>
        <div className="comment-head">
          <span className="avatar">{(c.name || "У").slice(0, 1)}</span>
          <strong>{c.name || "Участник"}</strong>
          <small>
            {c.demo
              ? "Пример обсуждения"
              : new Date(c.created!).toLocaleDateString("ru-RU")}
          </small>
          {c.meme && <span className="tag">Мем</span>}
        </div>
        {c.time != null && (
          <button
            className="timestamp"
            disabled={!lecture?.audio}
            onClick={() => {
              if (audio.current) {
                audio.current.currentTime = c.time;
                audio.current
                  .play()
                  .catch(() =>
                    toast.error(
                      "Не удалось воспроизвести запись. Попробуйте запустить её вручную.",
                    ),
                  );
              }
            }}
          >
            <Clock size={14} />
            {Math.floor(c.time / 60)}:
            {String(Math.floor(c.time % 60)).padStart(2, "0")}
          </button>
        )}
        <p className="pre">{c.text}</p>
        {c.image && (
          <a href={c.image} target="_blank" rel="noreferrer">
            <img
              className="comment-image"
              src={c.image}
              alt="Фото в обсуждении"
            />
          </a>
        )}
        <div className="row">
          {reactions(c.id)}
          {!nested && (
            <button
              className="text-button"
              onClick={() => {
                setReply(c);
                document.getElementById("question")?.focus();
              }}
            >
              Ответить
            </button>
          )}
        </div>
        {!nested && replies.map((r) => comment(r, true))}
      </article>
    );
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <Toaster position="bottom-right" richColors />
      <header className="header">
        <button
          className="brand"
          onClick={() => nav("library")}
          aria-label="Ильич, главная"
        >
          <span className="brand-icon" aria-hidden="true">
            ★
          </span>
          ильич<span className="brand-dot">.</span>
        </button>
        <span className="group-name">
          Учиться, учиться <span>/</span> и сдать
        </span>
        <div className="header-right">
          {user?.admin && (
            <button
              className="view-switch"
              onClick={() => setStudentView(!studentView)}
            >
              {studentView ? "Вернуться к старосте" : "Вид студента"}
            </button>
          )}
          <span className="user-avatar">{admin ? "СТ" : "Я"}</span>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <span className="eyebrow">УЧЕБНЫЙ КОМИТЕТ</span>
          <nav>
            {(
              [
                ["library", "Библиотека", BookOpen],
                ["missed", "Что я пропустил?", CalendarDays],
                ["session", "К сессии", GraduationCap],
                ["discussions", "Обсуждения", MessageCircle],
                ["requests", "Нужны материалы", HelpCircle],
              ] as [string, string, typeof BookOpen][]
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                aria-current={tab === k ? "page" : undefined}
                className={tab === k ? "active" : ""}
                onClick={() => nav(k)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {k === "requests" && (
                  <span className="nav-count">
                    {requests.filter((x) => !x.closed).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-subjects">
            <span className="eyebrow">ПРЕДМЕТЫ</span>
            {subjects.map((s, i) => (
              <button
                key={s}
                onClick={() => {
                  nav("library");
                  setSubject(s);
                }}
              >
                <span className={"subject-dot dot-" + i} />
                {s}
              </button>
            ))}
          </div>
          <div className="sidebar-note">
            <BookOpen size={22} />
            <p>
              Пролетарии всех пар,
              <br />
              объединяйтесь.
            </p>
            <span>От каждого — по конспекту.</span>
          </div>
        </aside>
        <main className="main" id="main-content">
          <div className="demo-banner">
            <span>
              Библиотека своей группы <span aria-hidden="true">/</span>{" "}
              Стартовые лекции отмечены как примеры
            </span>
            <details>
              <summary>О доступе</summary>
              <p>
                Сайт сейчас доступен только владельцу через ChatGPT. Владелец
                управляет материалами группы. «Вид студента» меняет интерфейс,
                но не является отдельной учётной записью. Доступ всей группе
                пока не включён. Личные отметки видны только вам; у «Не понял»
                публикуется лишь количество.
              </p>
            </details>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              {authRequired && (
                <a
                  href={
                    "/signin-with-chatgpt?return_to=" +
                    encodeURIComponent(location.pathname + location.search)
                  }
                  target="_top"
                >
                  Войти через ChatGPT
                </a>
              )}
              <button
                onClick={() => {
                  setLoading(true);
                  refresh();
                }}
              >
                Повторить
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-state" role="status">
              Загружаем библиотеку…
            </div>
          )}
          {selected && !lecture && !loading && (
            <div className="panel empty">
              <h2>Лекция не найдена</h2>
              <p>Возможно, ссылка устарела.</p>
              <button onClick={back}>Вернуться к списку</button>
            </div>
          )}
          {lecture ? (
            <>
              <button className="back" onClick={back}>
                <ArrowLeft size={16} /> Назад к списку
              </button>
              <div className="detail-title">
                <span className="tag">{lecture.subject}</span>
                <span className="meta">{date(lecture.date)}</span>
                <h1>{lecture.title}</h1>
                {lecture.demo && (
                  <p className="muted">
                    Демонстрационный материал. Настоящая аудиозапись и
                    фотографии не загружены.
                  </p>
                )}
              </div>
              <nav className="lecture-sections" aria-label="Разделы лекции">
                <a href="#lecture-summary">Конспект</a>
                {lecture.audio && <a href="#lecture-audio">Аудио</a>}
                <a href="#lecture-discussion">Обсуждение</a>
                <a href="#lecture-progress">Прогресс</a>
              </nav>
              <div className="detail-layout">
                <section>
                  <article className="panel summary-panel" id="lecture-summary">
                    <div className="section-heading">
                      <h2>
                        <FileText size={21} /> Выжимка лекции
                      </h2>
                      {admin && (
                        <button
                          className="text-button"
                          onClick={() => setEdit({ ...lecture })}
                        >
                          Редактировать
                        </button>
                      )}
                    </div>
                    <div className="summary-text">
                      {lecture.summary
                        .split(/\n\n+/)
                        .map((block: string, i: number) => (
                          <p className="pre" key={i}>
                            {block}
                          </p>
                        ))}
                    </div>
                    {lecture.formula && (
                      <div className="formula">{lecture.formula}</div>
                    )}
                  </article>
                  <article className="panel" id="lecture-audio">
                    <h2>
                      <Headphones size={21} /> Аудиозапись
                    </h2>
                    {lecture.audio ? (
                      <audio
                        key={lecture.id}
                        ref={audio}
                        controls
                        preload="metadata"
                        src={lecture.audio}
                        onLoadedMetadata={(e) => {
                          if (
                            position?.lectureId === lecture.id &&
                            Number.isFinite(e.currentTarget.duration)
                          )
                            e.currentTarget.currentTime = Math.min(
                              position.seconds,
                              e.currentTarget.duration,
                            );
                        }}
                        onTimeUpdate={(e) => {
                          if (
                            Math.abs(
                              (position?.seconds || 0) -
                                e.currentTarget.currentTime,
                            ) >= 5
                          )
                            remember(lecture.id, e.currentTarget.currentTime);
                        }}
                        onSeeked={(e) =>
                          remember(lecture.id, e.currentTarget.currentTime)
                        }
                        onPause={(e) =>
                          remember(lecture.id, e.currentTarget.currentTime)
                        }
                        onError={() =>
                          toast.error(
                            "Аудио не загрузилось. Обновите страницу или попросите старосту заменить запись.",
                          )
                        }
                      />
                    ) : (
                      <div className="empty-inline">
                        Записи пока нет. Староста может добавить аудио в форме
                        редактирования.
                      </div>
                    )}
                  </article>
                  <article className="panel">
                    <h2>
                      <ImageIcon size={21} /> Доска и слайды
                    </h2>
                    {lecture.photos?.length ? (
                      <div className="photos">
                        {lecture.photos.map((p: string, i: number) => (
                          <a key={p} href={p} target="_blank" rel="noreferrer">
                            <img src={p} alt={"Материал лекции " + (i + 1)} />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">Фото ещё не добавлены.</p>
                    )}
                  </article>
                  <article className="panel" id="lecture-discussion">
                    <h2>
                      <MessageCircle size={21} /> Обсуждение{" "}
                      <span className="muted">
                        {comments.filter((c) => c.parent === lecture.id).length}
                      </span>
                    </h2>
                    {comments
                      .filter((c) => c.parent === lecture.id && !c.replyTo)
                      .map((c) => comment(c))}
                    {!comments.some((c) => c.parent === lecture.id) && (
                      <p className="muted">Есть вопрос? Начните обсуждение.</p>
                    )}
                    <form
                      className="question-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const parts = time.split(":").map(Number);
                        const seconds = time
                          ? parts.length === 2
                            ? parts[0] * 60 + parts[1]
                            : NaN
                          : null;
                        if (
                          time &&
                          (!/^\d{1,4}:[0-5]\d$/.test(time) ||
                            !Number.isFinite(seconds))
                        ) {
                          toast.error("Укажите время в формате мм:сс");
                          return;
                        }
                        if (
                          await save({
                            kind: "comment",
                            parent: lecture.id,
                            text,
                            image,
                            meme,
                            time: seconds,
                            replyTo: reply?.id || "",
                          })
                        ) {
                          setText("");
                          setImage("");
                          setReply(null);
                          setTime("");
                          setMeme(false);
                        }
                      }}
                    >
                      {reply && (
                        <div className="reply-label">
                          Ответ: {reply.text.slice(0, 70)}{" "}
                          <button type="button" onClick={() => setReply(null)}>
                            Отмена
                          </button>
                        </div>
                      )}
                      <label htmlFor="question">
                        {reply ? "Ваш ответ" : "Вопрос, мысль или удачный мем"}
                      </label>
                      <textarea
                        id="question"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Здесь можно спросить даже про самое начало"
                        maxLength={4000}
                        rows={3}
                      />
                      <div className="form-inline">
                        <label className="upload-small">
                          <ImageIcon size={17} /> Фото
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={busy || !ready}
                            onChange={async (e) => {
                              const url = await upload(e.target.files?.[0]);
                              if (url) setImage(url);
                            }}
                          />
                        </label>
                        <label className="check-label">
                          <Checkbox
                            checked={meme}
                            onCheckedChange={(v) => setMeme(v === true)}
                          />{" "}
                          Это мем
                        </label>
                        {lecture.audio && (
                          <label className="time-label">
                            <Clock size={16} />
                            <input
                              aria-label="Время аудио"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              placeholder="мм:сс"
                            />
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => {
                                const t = Math.floor(
                                  audio.current?.currentTime || 0,
                                );
                                setTime(
                                  Math.floor(t / 60) +
                                    ":" +
                                    String(t % 60).padStart(2, "0"),
                                );
                              }}
                            >
                              Текущее
                            </button>
                          </label>
                        )}
                      </div>
                      {image && (
                        <div>
                          <img
                            className="attachment"
                            src={image}
                            alt="Прикреплённое фото"
                          />
                          <button type="button" onClick={() => setImage("")}>
                            Убрать фото
                          </button>
                        </div>
                      )}
                      <button
                        className="primary"
                        disabled={!ready || busy || (!text.trim() && !image)}
                      >
                        <Send size={16} /> {busy ? "Сохраняем…" : "Отправить"}
                      </button>
                    </form>
                  </article>
                </section>
                <aside className="detail-side" id="lecture-progress">
                  <article className="panel">
                    <span className="eyebrow">МОЙ ПРОГРЕСС</span>
                    <h3>Как идёт?</h3>
                    <button
                      aria-pressed={mark(lecture.id) === "done"}
                      className={
                        "progress-button " +
                        (mark(lecture.id) === "done" ? "selected" : "")
                      }
                      disabled={!ready || busy}
                      onClick={() =>
                        save({
                          kind: "mark",
                          parent: lecture.id,
                          value: mark(lecture.id) === "done" ? "" : "done",
                        })
                      }
                    >
                      <Check size={18} /> Разобрался
                    </button>
                    <button
                      aria-pressed={mark(lecture.id) === "repeat"}
                      className={
                        "progress-button " +
                        (mark(lecture.id) === "repeat" ? "selected" : "")
                      }
                      disabled={!ready || busy}
                      onClick={() =>
                        save({
                          kind: "mark",
                          parent: lecture.id,
                          value: mark(lecture.id) === "repeat" ? "" : "repeat",
                        })
                      }
                    >
                      <Bookmark size={18} /> Нужно повторить
                    </button>
                    <small>Отметки видны только вам</small>
                    <hr />
                    <button
                      className={
                        "progress-button " +
                        (myConfused.includes(lecture.id) ? "selected" : "")
                      }
                      disabled={!ready || busy}
                      onClick={() =>
                        save({ kind: "confused", parent: lecture.id })
                      }
                    >
                      <HelpCircle size={18} /> Не понял ·{" "}
                      {confused[lecture.id] || 0}
                    </button>
                    <small>Без публичного списка имён</small>
                  </article>
                  <article className="panel">
                    <h3>Сказать спасибо</h3>
                    {reactions(lecture.id)}
                  </article>
                  {lecture.questions && (
                    <article className="panel">
                      <h3>Проверь себя</h3>
                      <p className="pre muted">{lecture.questions}</p>
                    </article>
                  )}
                </aside>
              </div>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {tab === "library"
                      ? "ЗНАНИЯ — ОБЩЕЕ ДОСТОЯНИЕ"
                      : "СВОЯ ГРУППА"}
                  </p>
                  <h1>
                    {
                      {
                        library: "Лекции",
                        missed: "Что я пропустил?",
                        session: "К сессии",
                        discussions: "Обсуждения",
                        requests: "Нужны материалы",
                      }[tab]
                    }
                  </h1>
                  <p className="muted">
                    {
                      {
                        library: "Всё для учёбы. Кроме воли к учёбе.",
                        missed:
                          "Выберите даты — соберём пропущенные темы в одном месте.",
                        session:
                          "Лекции, формулы и вопросы — без ночного квеста.",
                        discussions: "Продолжаем разговор после пары.",
                        requests:
                          "Не хватает записи или фото? Попросите здесь.",
                      }[tab]
                    }
                  </p>
                </div>
                {admin && (tab === "library" || tab === "missed") && (
                  <button
                    className="primary"
                    onClick={() => setEdit({ ...blank })}
                  >
                    <Plus size={18} /> Добавить лекцию
                  </button>
                )}
                {tab === "requests" && (
                  <button
                    className="primary"
                    disabled={!ready}
                    onClick={() =>
                      setEdit({
                        id: "",
                        kind: "request",
                        title: "",
                        date: today(),
                        subject: subjects[0],
                      } as Item)
                    }
                  >
                    <Plus size={18} /> Попросить материал
                  </button>
                )}
                {tab === "session" && admin && (
                  <button
                    className="primary"
                    onClick={() =>
                      setEdit({ ...blank, kind: "collection", title: "" })
                    }
                  >
                    <Plus size={18} /> Создать подборку
                  </button>
                )}
              </div>
              {(tab === "library" || tab === "missed") && (
                <>
                  <div className="stats-strip">
                    <span>
                      Разобрано{" "}
                      <strong>
                        {lectures.filter((l) => mark(l.id) === "done").length} /{" "}
                        {lectures.length}
                      </strong>
                    </span>
                    <progress
                      aria-label="Прогресс изучения лекций"
                      max={lectures.length || 1}
                      value={
                        lectures.filter((l) => mark(l.id) === "done").length
                      }
                    />
                    <button
                      className="text-button"
                      onClick={() =>
                        setStatus(
                          status === "Нужно повторить"
                            ? "Все отметки"
                            : "Нужно повторить",
                        )
                      }
                    >
                      Повторить:{" "}
                      {lectures.filter((l) => mark(l.id) === "repeat").length}
                    </button>
                  </div>
                  {position &&
                    lectures.some((l) => l.id === position.lectureId) && (
                      <button
                        className="continue-reading"
                        onClick={() => open(position.lectureId)}
                      >
                        <BookOpen size={20} />
                        <span>
                          <small>
                            Продолжить{" "}
                            {position.seconds > 0
                              ? "с " +
                                Math.floor(position.seconds / 60) +
                                ":" +
                                String(
                                  Math.floor(position.seconds % 60),
                                ).padStart(2, "0")
                              : "изучение"}
                          </small>
                          <strong>
                            {
                              lectures.find((l) => l.id === position.lectureId)
                                ?.title
                            }
                          </strong>
                        </span>
                        <ArrowUpRight size={20} />
                      </button>
                    )}
                  <div className="workspace-columns">
                    <section>
                      <div className="filters">
                        <label className="search">
                          <Search size={20} />
                          <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Найти тему, предмет или формулу"
                            aria-label="Поиск лекций"
                          />
                          {query && (
                            <button
                              onClick={() => setQuery("")}
                              aria-label="Очистить поиск"
                            >
                              ×
                            </button>
                          )}
                        </label>
                        <button
                          className="filter-toggle"
                          aria-expanded={showFilters}
                          aria-controls="library-filters"
                          onClick={() => setShowFilters(!showFilters)}
                        >
                          Фильтры
                          {subject !== "Все предметы" ||
                          status !== "Все отметки" ||
                          from ||
                          to
                            ? " · применены"
                            : ""}{" "}
                          <span>{showFilters ? "−" : "+"}</span>
                        </button>
                        <div
                          id="library-filters"
                          className={
                            "filter-controls " +
                            (showFilters ? "expanded" : "")
                          }
                        >
                          <div className="filter-row">
                            <Pick
                              label="Предмет"
                              options={["Все предметы", ...subjects]}
                              value={subject}
                              onChange={setSubject}
                            />
                            <Pick
                              label="Личная отметка"
                              options={[
                                "Все отметки",
                                "Разобрался",
                                "Нужно повторить",
                              ]}
                              value={status}
                              onChange={setStatus}
                            />
                          </div>
                          <div className="date-row">
                            <CalendarDays size={18} />
                            <label>
                              С{" "}
                              <input
                                aria-label="С даты"
                                type="date"
                                value={from}
                                onInput={(e) => setFrom(e.currentTarget.value)}
                                onChange={(e) => setFrom(e.target.value)}
                              />
                            </label>
                            <label>
                              По{" "}
                              <input
                                aria-label="По дату"
                                type="date"
                                value={to}
                                min={from}
                                onInput={(e) => setTo(e.currentTarget.value)}
                                onChange={(e) => setTo(e.target.value)}
                              />
                            </label>
                            {(from ||
                              to ||
                              query ||
                              subject !== "Все предметы" ||
                              status !== "Все отметки") && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setFrom("");
                                  setTo("");
                                  setQuery("");
                                  setSubject("Все предметы");
                                  setStatus("Все отметки");
                                }}
                              >
                                Сбросить
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="section-heading">
                        <h2>
                          {tab === "missed"
                            ? "Лекции за период"
                            : "Свежие лекции"}{" "}
                          <span className="count">{filtered.length}</span>
                        </h2>
                        <span className="meta" role="status" aria-live="polite">
                          Найдено: {filtered.length}
                        </span>
                      </div>
                      {from && to && from > to ? (
                        <div className="panel">
                          Начальная дата должна быть раньше конечной.
                        </div>
                      ) : filtered.length ? (
                        <div className="lecture-grid">{filtered.map(card)}</div>
                      ) : (
                        <div className="panel empty">
                          <Search />
                          <h3>Лекций не нашлось</h3>
                          <p>
                            Попробуйте другой предмет или расширьте диапазон
                            дат.
                          </p>
                          <button
                            onClick={() => {
                              setQuery("");
                              setFrom("");
                              setTo("");
                              setSubject("Все предметы");
                              setStatus("Все отметки");
                            }}
                          >
                            Показать все лекции
                          </button>
                        </div>
                      )}
                    </section>
                    <aside className="right-rail">
                      <article className="rail-card">
                        <div className="section-heading">
                          <h3>Нужна помощь</h3>
                          <HelpCircle size={18} />
                        </div>
                        {requests
                          .filter((x) => !x.closed)
                          .slice(0, 2)
                          .map((r) => (
                            <button
                              key={r.id}
                              className="request-link"
                              onClick={() => nav("requests")}
                            >
                              <span>{r.title}</span>
                              <ChevronRight size={17} />
                            </button>
                          ))}
                        {!requests.some((x) => !x.closed) && (
                          <p className="muted">Все запросы закрыты 🎉</p>
                        )}
                      </article>
                      <article className="meme-card">
                        <span className="eyebrow">МИНУТКА АГИТАЦИИ</span>
                        {(() => {
                          const m = comments
                            .filter(
                              (c) =>
                                c.meme &&
                                new Date(c.created || 0).getTime() >= week,
                            )
                            .sort(
                              (a, b) => count(b.id, "😂") - count(a.id, "😂"),
                            )[0];
                          return m ? (
                            <>
                              <p className="pre">{m.text}</p>
                              {m.image && (
                                <img src={m.image} alt="Мем недели" />
                              )}
                              {reactions(m.id)}
                              <button
                                className="text-button"
                                onClick={() => open(m.parent!)}
                              >
                                К обсуждению ↗
                              </button>
                              {m.demo && <small>Демонстрационный мем</small>}
                            </>
                          ) : (
                            <p>Пока тихо. Добавьте мем в обсуждение лекции.</p>
                          );
                        })()}
                      </article>
                    </aside>
                  </div>
                </>
              )}
              {tab === "session" && (
                <div className="pack-grid">
                  {!packs.length && (
                    <div className="panel empty">
                      <h2>Подборок пока нет</h2>
                      <p>
                        Староста может собрать лекции для подготовки к зачёту.
                      </p>
                    </div>
                  )}
                  {packs.map((p) => (
                    <article className="panel pack" key={p.id}>
                      <span className="tag">
                        {p.demo
                          ? "Демонстрационная подборка"
                          : "Подборка группы"}
                      </span>
                      <h2>{p.title}</h2>
                      {p.lectureIds.map((id: string) => {
                        const l = lectures.find((x) => x.id === id);
                        return l ? (
                          <button
                            className="pack-lecture"
                            key={id}
                            onClick={() => open(id)}
                          >
                            <BookOpen size={18} />
                            <span>{l.title}</span>
                            <ArrowUpRight size={18} />
                          </button>
                        ) : null;
                      })}
                      <h3>Формулы</h3>
                      <div className="formula pre">
                        {p.formula || "Формулы пока не добавлены"}
                      </div>
                      <h3>Вопросы к зачёту</h3>
                      <p className="pre">
                        {p.questions || "Вопросы пока не добавлены"}
                      </p>
                      {admin && (
                        <button
                          className="text-button"
                          onClick={() => setEdit({ ...p })}
                        >
                          Редактировать подборку
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
              {tab === "requests" && (
                <div className="requests-list">
                  {requests.map((r) => (
                    <article className="panel request-card" key={r.id}>
                      <div>
                        <span className="tag">
                          {r.subject} · {date(r.date)}
                        </span>
                        <h2>{r.title}</h2>
                        {r.demo && <small>Демонстрационный запрос</small>}
                      </div>
                      {r.closed ? (
                        <button
                          className="resolved"
                          onClick={() => open(r.lectureId)}
                        >
                          <Check size={17} /> Добавлено — открыть
                        </button>
                      ) : admin ? (
                        <button
                          className="secondary"
                          onClick={() =>
                            setEdit({
                              ...blank,
                              subject: r.subject,
                              date: r.date,
                              requestId: r.id,
                              requestData: r,
                            })
                          }
                        >
                          <Upload size={17} /> Добавить и закрыть
                        </button>
                      ) : (
                        <span className="waiting">Ждём материалы</span>
                      )}
                    </article>
                  ))}
                  {!requests.length && (
                    <div className="panel">Пока запросов нет.</div>
                  )}
                </div>
              )}
              {tab === "discussions" && (
                <Tabs value={activity} onValueChange={setActivity}>
                  <TabsList className="activity-tabs">
                    <TabsTrigger value="active">
                      Активные обсуждения
                    </TabsTrigger>
                    <TabsTrigger value="mine">Ответы мне</TabsTrigger>
                  </TabsList>
                  <TabsContent value="active">
                    <div className="discussion-list">
                      {!comments.length && (
                        <div className="panel empty">
                          <h2>Обсуждений пока нет</h2>
                          <p>Откройте лекцию, чтобы задать первый вопрос.</p>
                          <button onClick={() => nav("library")}>
                            К лекциям
                          </button>
                        </div>
                      )}
                      {lectures
                        .filter((l) => comments.some((c) => c.parent === l.id))
                        .sort(
                          (a, b) =>
                            Math.max(
                              ...comments
                                .filter((c) => c.parent === b.id)
                                .map((c) => Date.parse(c.created || "") || 0),
                            ) -
                            Math.max(
                              ...comments
                                .filter((c) => c.parent === a.id)
                                .map((c) => Date.parse(c.created || "") || 0),
                            ),
                        )
                        .map((l) => (
                          <button
                            className="panel discussion-link"
                            key={l.id}
                            onClick={() => open(l.id)}
                          >
                            <MessageCircle />
                            <span>
                              <strong>{l.title}</strong>
                              <p>
                                {
                                  comments
                                    .filter((c) => c.parent === l.id)
                                    .at(-1)?.text
                                }
                              </p>
                            </span>
                            <span className="count">
                              {comments.filter((c) => c.parent === l.id).length}
                            </span>
                            <ChevronRight />
                          </button>
                        ))}
                    </div>
                  </TabsContent>
                  <TabsContent value="mine">
                    {(() => {
                      const own = comments
                        .filter((c) => c.owner === user?.id)
                        .map((c) => c.id);
                      const answers = comments.filter(
                        (c) => own.includes(c.replyTo) && c.owner !== user?.id,
                      );
                      return answers.length ? (
                        answers.map((c) => (
                          <button
                            className="panel discussion-link"
                            key={c.id}
                            onClick={() => open(c.parent!)}
                          >
                            <MessageCircle />
                            <span>
                              <strong>{c.name} ответил(а)</strong>
                              <p>{c.text}</p>
                            </span>
                            <ChevronRight />
                          </button>
                        ))
                      ) : (
                        <div className="panel empty">
                          <MessageCircle />
                          <h3>Здесь будут ответы вам</h3>
                          <p>
                            Задайте вопрос под лекцией. Ответы других участников
                            появятся здесь.
                          </p>
                        </div>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              )}
            </>
          )}
          <footer>
            ильич. <span>Для своих, после пары.</span>
            <small>
              {ready
                ? "Сохранение на сервере включено"
                : "Просмотр примеров · войдите для сохранения"}
            </small>
          </footer>
        </main>
      </div>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v && !busy) setEdit(null);
        }}
      >
        <DialogContent className="editor">
          <DialogTitle>
            {edit?.kind === "lecture"
              ? edit?.id
                ? "Редактировать лекцию"
                : "Новая лекция"
              : edit?.kind === "request"
                ? "Попросить материал"
                : edit?.id
                  ? "Редактировать подборку"
                  : "Новая подборка"}
          </DialogTitle>
          <DialogDescription>
            {edit?.kind === "lecture"
              ? "Вставьте готовую выжимку. Расшифровка здесь не выполняется."
              : edit?.kind === "request"
                ? "Опишите, чего не хватает. Староста закроет запрос после публикации."
                : "Соберите лекции, формулы и вопросы в одном месте."}
          </DialogDescription>
          {edit && (
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (edit.kind === "collection" && !edit.lectureIds?.length) {
                  toast.error("Выберите хотя бы одну лекцию.");
                  return;
                }
                const id = await save(edit);
                if (id) {
                  if (edit.requestId) {
                    const ok = await save({
                      ...edit.requestData,
                      closed: true,
                      lectureId: id,
                    });
                    if (!ok) {
                      setEdit({ ...edit, id, requestId: edit.requestId });
                      return;
                    }
                  }
                  setEdit(null);
                }
              }}
            >
              <label>
                {edit.kind === "lecture" ? "Тема лекции" : "Название"}
                <input
                  required
                  maxLength={200}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </label>
              {edit.kind !== "collection" && (
                <div className="editor-row">
                  <label>
                    Предмет
                    <Pick
                      label="Предмет материала"
                      options={subjects}
                      value={edit.subject}
                      onChange={(s) => setEdit({ ...edit, subject: s })}
                    />
                  </label>
                  <label>
                    Дата
                    <input
                      required
                      type="date"
                      value={edit.date}
                      onInput={(e) => setEdit({ ...edit, date: e.currentTarget.value })}
                      onChange={(e) =>
                        setEdit({ ...edit, date: e.target.value })
                      }
                    />
                  </label>
                </div>
              )}
              {edit.kind === "lecture" && (
                <>
                  <label>
                    Готовая выжимка
                    <textarea
                      required
                      value={edit.summary}
                      maxLength={20000}
                      rows={7}
                      onChange={(e) =>
                        setEdit({ ...edit, summary: e.target.value })
                      }
                    />
                  </label>
                  <div className="upload-grid">
                    <label className="upload-box">
                      <Headphones />{" "}
                      {edit.audio ? "Заменить аудио" : "Добавить аудио"}
                      <small>MP3, M4A, WAV, OGG · до 50 МБ</small>
                      <input
                        type="file"
                        disabled={busy}
                        accept="audio/*"
                        onChange={async (e) => {
                          const url = await upload(e.target.files?.[0]);
                          if (url)
                            setEdit((prev) =>
                              prev ? { ...prev, audio: url } : prev,
                            );
                        }}
                      />
                    </label>
                    <label className="upload-box">
                      <ImageIcon /> Добавить фото
                      <small>
                        Не более 12 фото · JPG, PNG, WebP, GIF · до 8 МБ
                      </small>
                      <input
                        type="file"
                        disabled={busy || (edit.photos?.length || 0) >= 12}
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={async (e) => {
                          const url = await upload(e.target.files?.[0]);
                          if (url)
                            setEdit((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    photos: [...(prev.photos || []), url].slice(
                                      0,
                                      12,
                                    ),
                                  }
                                : prev,
                            );
                        }}
                      />
                    </label>
                  </div>
                  {edit.audio && (
                    <div>
                      <audio controls src={edit.audio} />
                      <button
                        type="button"
                        onClick={() => setEdit({ ...edit, audio: "" })}
                      >
                        Убрать аудио
                      </button>
                    </div>
                  )}
                  <div className="edit-photos">
                    {edit.photos?.map((p: string) => (
                      <div key={p}>
                        <img src={p} alt="Фото материала" />
                        <button
                          type="button"
                          onClick={() =>
                            setEdit({
                              ...edit,
                              photos: edit.photos.filter(
                                (x: string) => x !== p,
                              ),
                            })
                          }
                        >
                          Убрать
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {edit.kind === "collection" && (
                <fieldset>
                  <legend>Лекции в подборке</legend>
                  {lectures.map((l) => (
                    <label className="check-label" key={l.id}>
                      <Checkbox
                        checked={edit.lectureIds?.includes(l.id)}
                        onCheckedChange={(v) =>
                          setEdit({
                            ...edit,
                            lectureIds: v
                              ? [...(edit.lectureIds || []), l.id]
                              : edit.lectureIds.filter(
                                  (id: string) => id !== l.id,
                                ),
                          })
                        }
                      />
                      {l.title}
                    </label>
                  ))}
                </fieldset>
              )}
              {edit.kind !== "request" && (
                <>
                  <label>
                    Формулы
                    <textarea
                      rows={2}
                      value={edit.formula || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, formula: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Вопросы для повторения
                    <textarea
                      rows={3}
                      value={edit.questions || ""}
                      onChange={(e) =>
                        setEdit({ ...edit, questions: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              <button className="primary" disabled={busy || !ready}>
                {busy
                  ? "Сохраняем…"
                  : edit.requestId
                    ? "Опубликовать и закрыть запрос"
                    : edit.kind === "request"
                      ? "Отправить запрос"
                      : "Сохранить и опубликовать"}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
