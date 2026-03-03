import "./Learn.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Save, Pencil, X, Search } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import StudyingImg from "../assets/Studying.png";

import {
  getSubjects,
  getTopicsBySubject,
  getSpecPointsByTopic,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} from "../api";

const TIERS = ["BOTH", "F", "H"];
const STATUSES = ["DRAFT", "PUBLISHED"];

function MenuBar({ editor }) {
  if (!editor) return null;
  const btn = (label, action, active) => (
    <button
      key={label}
      onMouseDown={(e) => {
        e.preventDefault();
        action();
      }}
      className={`rte-btn${active ? " rte-btn-active" : ""}`}
      type="button"
    >
      {label}
    </button>
  );
  return (
    <div className="rte-toolbar">
      {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"))}
      {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"))}
      {btn("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"))}
      <span className="rte-divider" />
      {btn(
        "H1",
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        editor.isActive("heading", { level: 1 })
      )}
      {btn(
        "H2",
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        editor.isActive("heading", { level: 2 })
      )}
      {btn(
        "H3",
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        editor.isActive("heading", { level: 3 })
      )}
      <span className="rte-divider" />
      {btn("• List", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"))}
      {btn("1. List", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"))}
      <span className="rte-divider" />
      {btn("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"))}
      {btn("↩", () => editor.chain().focus().undo().run(), false)}
      {btn("↪", () => editor.chain().focus().redo().run(), false)}
    </div>
  );
}

export default function NotesPage() {
  const [errMsg, setErrMsg] = useState("");

  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");

  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState("");

  const [specPoints, setSpecPoints] = useState([]);
  const [specPointId, setSpecPointId] = useState(""); // "" means All

  const [tier, setTier] = useState("BOTH");
  const [status, setStatus] = useState("PUBLISHED");

  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // For proper cancel: snapshot of last loaded saved state
  const lastLoadedRef = useRef({ title: "", content: "" });

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeId) || null,
    [notes, activeId]
  );

  const filteredNotes = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return notes;
    return notes.filter((n) => {
      const t = (n.title || "").toLowerCase();
      const c = (n.content || "").replace(/<[^>]+>/g, "").toLowerCase();
      return t.includes(s) || c.includes(s);
    });
  }, [notes, q]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editable: false,
    editorProps: { attributes: { class: "rte-content" } },
  });

  // toggle editor editability
  useEffect(() => {
    if (editor) editor.setEditable(editMode);
  }, [editMode, editor]);

  // Load active note into editor (and reset edit mode)
  useEffect(() => {
    if (!editor) return;

    if (!activeNote) {
      editor.commands.setContent("");
      setTitle("");
      lastLoadedRef.current = { title: "", content: "" };
      setEditMode(false);
      return;
    }

    const nextTitle = activeNote.title || "";
    const nextContent = activeNote.content || "";

    setTitle(nextTitle);
    editor.commands.setContent(nextContent);

    lastLoadedRef.current = { title: nextTitle, content: nextContent };
    setEditMode(false);
  }, [activeNote?.id, editor]); // eslint-disable-line

  // Initial: subjects
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const subs = await getSubjects();
        if (!alive) return;
        setSubjects(subs);
        if (subs.length) setSubjectId(String(subs[0].id));
      } catch (e) {
        setErrMsg(e?.message || "Failed to load subjects");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // When subject changes: load topics + clear downstream selections
  useEffect(() => {
    let alive = true;

    setTopics([]);
    setTopicId("");
    setSpecPoints([]);
    setSpecPointId("");
    setNotes([]);
    setActiveId(null);
    setTitle("");
    lastLoadedRef.current = { title: "", content: "" };
    editor?.commands.setContent("");
    setEditMode(false);

    if (!subjectId) return;

    (async () => {
      try {
        setErrMsg("");
        const t = await getTopicsBySubject(subjectId);
        if (!alive) return;
        setTopics(t);
        if (t.length) setTopicId(String(t[0].id));
      } catch (e) {
        setErrMsg(e?.message || "Failed to load topics");
      }
    })();

    return () => {
      alive = false;
    };
  }, [subjectId]); // eslint-disable-line

  // When topic changes: load spec points (and reset specPointId to "All")
  useEffect(() => {
    let alive = true;
    setSpecPoints([]);
    setSpecPointId("");

    if (!topicId) return;

    (async () => {
      try {
        setErrMsg("");
        const sp = await getSpecPointsByTopic(topicId);
        if (!alive) return;
        setSpecPoints(sp || []);
      } catch (e) {
        setErrMsg(e?.message || "Failed to load spec points");
      }
    })();

    return () => {
      alive = false;
    };
  }, [topicId]);

  // Load notes whenever filters change
  useEffect(() => {
  let alive = true;
  if (!topicId) return;

  (async () => {
    try {
      setErrMsg("");

      console.log("Fetching notes with:", {
        topic_id: topicId,
        spec_point_id: specPointId || undefined,
        status,
        tier,
      });

      const data = await getNotes({
        topic_id: topicId,
        spec_point_id: specPointId || undefined,
        status: status || undefined,
        tier: tier || undefined,
      });

      console.log("Notes returned:", data);

      if (!alive) return;
      setNotes(data);

      if (data.length) setActiveId(data[0].id);
      else {
        setActiveId(null);
        setTitle("");
        editor?.commands.setContent("");
      }

    } catch (e) {
      setErrMsg(e?.message || "Failed to load notes");
    }
  })();

  return () => { alive = false; };
}, [topicId, specPointId, status, tier]);

  async function onCreate() {
    try {
      setErrMsg("");
      if (!topicId) {
        setErrMsg("Pick a topic first.");
        return;
      }

      const newNote = await createNote({
        topic_id: Number(topicId),
        spec_point_id: specPointId ? Number(specPointId) : null,
        title: "New note",
        content: "",
        tier,
        status,
      });

      setNotes((prev) => [newNote, ...prev]);
      setActiveId(newNote.id);

      // Load into editor immediately + enter edit mode
      setTitle(newNote.title || "New note");
      editor?.commands.setContent(newNote.content || "");
      lastLoadedRef.current = { title: newNote.title || "New note", content: newNote.content || "" };
      setEditMode(true);
    } catch (e) {
      setErrMsg(e?.message || "Failed to create note");
    }
  }

  function onCancelEdit() {
    // restore last loaded saved state
    const { title: t, content } = lastLoadedRef.current;
    setTitle(t || "");
    editor?.commands.setContent(content || "");
    setEditMode(false);
  }

  async function onSave() {
    try {
      setSaving(true);
      setErrMsg("");
      if (!activeNote) return;

      const cleanTitle = (title || "").trim();
      if (!cleanTitle) {
        setErrMsg("Title can’t be empty.");
        return;
      }

      const updated = await updateNote(activeNote.id, {
        title: cleanTitle,
        content: editor ? editor.getHTML() : "",
        tier,
        status,
      });

      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setActiveId(updated.id);

      // update cancel snapshot to the saved version
      lastLoadedRef.current = { title: updated.title || "", content: updated.content || "" };
      setEditMode(false);
    } catch (e) {
      setErrMsg(e?.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    try {
      setErrMsg("");
      if (!activeNote) return;
      if (!confirm("Delete this note?")) return;

      const deletingId = activeNote.id;
      await deleteNote(deletingId);

      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== deletingId);

        // choose next active note (first in list)
        if (next.length) {
          setActiveId(next[0].id);
        } else {
          setActiveId(null);
          setTitle("");
          editor?.commands.setContent("");
          lastLoadedRef.current = { title: "", content: "" };
        }
        return next;
      });
    } catch (e) {
      setErrMsg(e?.message || "Failed to delete note");
    }
  }

  const tierColour = {
    BOTH: "#c8dab0",
    F: "#f9c8b0",
    H: "#d4c8e8",
  };

  return (
    <div className="np-shell">
      {/* ── Top bar ── */}
      <div className="np-topbar">
        <div className="np-topbar-left">
          <div className="np-search-wrap">
            <Search size={14} className="np-search-icon" />
            <input
              className="np-search"
              placeholder="Search notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="np-topbar-right">
          {[
            {
              label: "Subject",
              value: subjectId,
              set: setSubjectId,
              opts: subjects.map((s) => ({ v: String(s.id), l: s.name })),
            },
            {
              label: "Topic",
              value: topicId,
              set: setTopicId,
              opts: topics.map((t) => ({ v: String(t.id), l: t.name })),
            },

            // ✅ Spec Point dropdown (All + list)
            {
              label: "Spec",
              value: specPointId,
              set: setSpecPointId,
              opts: [{ v: "", l: "All" }].concat(
                (specPoints || []).map((sp) => ({
                  v: String(sp.id),
                  l: sp.code ? `${sp.code} — ${sp.name}` : sp.name,
                }))
              ),
            },

            { label: "Tier", value: tier, set: setTier, opts: TIERS.map((t) => ({ v: t, l: t })) },
            { label: "Status", value: status, set: setStatus, opts: STATUSES.map((s) => ({ v: s, l: s })) },
          ].map(({ label, value, set, opts }) => (
            <div className="np-filter" key={label}>
              <label>{label}</label>
              <select value={value} onChange={(e) => set(e.target.value)}>
                {opts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button className="np-new-btn" onClick={onCreate} type="button">
            <Plus size={14} /> New note
          </button>
        </div>
      </div>

      {errMsg && <div className="np-error">{errMsg}</div>}

      {/* ── Body ── */}
      <div className="np-body">
        {/* ── Note list ── */}
        <div className="np-sidebar">
          {filteredNotes.length === 0 ? (
            <div className="np-empty">
              <img src={StudyingImg} alt="" className="np-empty-img" />
              <p className="np-empty-title">No notes yet</p>
              <p className="np-empty-sub">
                Click <strong>New note</strong> to get started
              </p>
            </div>
          ) : (
            filteredNotes.map((n) => (
              <button
                key={n.id}
                className={`np-card${n.id === activeId ? " np-card-active" : ""}`}
                onClick={() => setActiveId(n.id)}
                type="button"
              >
                <div className="np-card-stripe" style={{ background: tierColour[n.tier] }} />
                <div className="np-card-inner">
                  <div className="np-card-title">{n.title || "Untitled"}</div>
                  <div className="np-card-meta">
                    <span className="np-tag" style={{ background: tierColour[n.tier] }}>
                      {n.tier}
                    </span>
                    <span className="np-card-date">
                      {n.updated_at ? new Date(n.updated_at).toLocaleDateString("en-GB") : ""}
                    </span>
                  </div>
                  <div className="np-card-snippet">
                    {(n.content || "").replace(/<[^>]+>/g, "").slice(0, 85)}…
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* ── Viewer / Editor ── */}
        {activeNote ? (
          <div className="np-viewer">
            {/* Viewer header */}
            <div className="np-viewer-header">
              <div className="np-viewer-title-row">
                {editMode ? (
                  <input
                    className="np-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note title…"
                  />
                ) : (
                  <h2 className="np-viewer-title">{activeNote.title}</h2>
                )}

                <div className="np-viewer-meta">
                  <span className="np-tag" style={{ background: tierColour[activeNote.tier] }}>
                    {activeNote.tier}
                  </span>
                  <span className="np-viewer-date">
                    Updated{" "}
                    {activeNote.updated_at ? new Date(activeNote.updated_at).toLocaleDateString("en-GB") : ""}
                  </span>
                </div>
              </div>

              <div className="np-viewer-btns">
                {editMode ? (
                  <>
                    <button className="np-btn-ghost" onClick={onCancelEdit} type="button">
                      <X size={13} /> Cancel
                    </button>
                    <button className="np-btn-danger" onClick={onDelete} type="button">
                      <Trash2 size={13} /> Delete
                    </button>
                    <button className="np-btn-dark" onClick={onSave} disabled={saving} type="button">
                      <Save size={13} /> {saving ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <>
                    <button className="np-btn-dark" onClick={() => setEditMode(true)} type="button">
                      <Pencil size={13} /> Edit
                    </button>
                    <button className="np-btn-danger" onClick={onDelete} type="button">
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="np-viewer-divider" />

            {editMode && <MenuBar editor={editor} />}

            <div className={`np-prose-wrap${editMode ? " np-prose-editing" : ""}`}>
              <EditorContent editor={editor} className="np-prose" />
            </div>
          </div>
        ) : (
          <div className="np-no-note">
            <img src={StudyingImg} alt="" className="np-no-note-img" />
            <p className="np-no-note-title">Select a note to start reading</p>
            <p className="np-no-note-sub">or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}