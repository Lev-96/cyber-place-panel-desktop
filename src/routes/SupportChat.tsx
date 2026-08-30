import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { formatDateTime } from "@/i18n/dates";
import { storageUri } from "@/infrastructure/AppConfig";
import { branchRepository } from "@/repositories/BranchRepository";
import { supportRepository } from "@/repositories/SupportRepository";
import { useSupportMessages } from "@/realtime/useSupportMessages";
import type { ISupportConversation, ISupportMessage } from "@/api/support";
import type { IBranchApi } from "@/types/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The venue's support desk.
 *
 * ## What this screen is talking to
 * Our backend, and only our backend. Support reads the other side in Telegram,
 * but nothing here knows that: the thread is rows in `support_messages`, the
 * reply arrives over the same Reverb channel every other live screen uses, and
 * the Telegram leg is a delivery status on a message rather than a place data
 * lives. That is what makes history survive an outage, and what lets this
 * screen tell the truth about a message that has not left the building yet.
 *
 * ## A message is never lost by the UI either
 * A send that fails leaves the line in the thread, marked, with a retry — the
 * text a person typed about a problem they are having is the last thing to
 * throw away on their behalf.
 *
 * ## Who sees what
 * The conversation list is whatever the backend returns, which is already
 * scoped: a manager's own branch, an owner's company, an admin everything.
 * Nothing is filtered here, because a filter in a component is a permission
 * that stops applying the moment someone calls the API directly.
 */

/** A line the user typed that has not been accepted by the server yet. */
interface PendingMessage {
  localId: string;
  body: string;
  files: File[];
  state: "sending" | "failed";
  error?: string;
}

const SupportChat = () => {
  const { t, lang } = useLang();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ISupportConversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ISupportMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [branches, setBranches] = useState<IBranchApi[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations?.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const loadConversations = useCallback(async () => {
    try {
      const list = await supportRepository.list();
      setConversations(list);
      setListError(null);
      // Land on the most recently active thread rather than an empty right
      // pane: the person opening Support almost always wants the last one.
      setActiveId((current) => current ?? list[0]?.id ?? null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load");
      setConversations([]);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // The branches this caller may open a thread for — the same scoped list the
  // rest of the panel reads, so nothing here decides who owns what.
  useEffect(() => { void branchRepository.list().then(setBranches).catch(() => setBranches([])); }, []);

  // Thread history, whenever the selection changes.
  useEffect(() => {
    if (activeId == null) { setMessages([]); return; }
    let alive = true;
    setThreadLoading(true);
    void supportRepository.thread(activeId)
      .then((thread) => {
        if (!alive) return;
        setMessages(thread.messages);
        // Opening the thread IS reading it.
        void supportRepository.markRead(activeId);
        setConversations((prev) => prev?.map((c) => (c.id === activeId ? { ...c, unread: 0 } : c)) ?? prev);
      })
      .catch(() => { if (alive) setMessages([]); })
      .finally(() => { if (alive) setThreadLoading(false); });
    return () => { alive = false; };
  }, [activeId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending.length]);

  /**
   * Live lines, for the branch of the thread on screen.
   *
   * A message for the OPEN thread is appended; one for another thread of the
   * same branch only refreshes the list, so its unread badge moves without
   * yanking the reader somewhere they did not ask to be.
   */
  useSupportMessages(
    active?.branch_id ?? null,
    useCallback((event) => {
      if (event.conversation_id === activeId) {
        setMessages((prev) => (prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]));
        void supportRepository.markRead(event.conversation_id);
      }
      void loadConversations();
    }, [activeId, loadConversations]),
  );

  const startConversation = async (branchId: number) => {
    setStarting(true);
    try {
      const thread = await supportRepository.open(branchId);
      await loadConversations();
      setActiveId(thread.conversation.id);
      setMessages(thread.messages);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed");
    } finally {
      setStarting(false);
    }
  };

  /**
   * Send, and keep the line visible whatever happens.
   *
   * The optimistic row is not decoration: it is where a failure lives. On
   * success it is replaced by the server's own row (with its id, timestamp and
   * delivery status); on failure it stays, marked, with the text and the files
   * still attached so Retry is one press rather than a retype.
   */
  const send = async (body: string, attachments: File[], replacing?: string) => {
    if (activeId == null) return;
    const localId = replacing ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setPending((prev) => {
      const line: PendingMessage = { localId, body, files: attachments, state: "sending" };
      return replacing ? prev.map((p) => (p.localId === replacing ? line : p)) : [...prev, line];
    });

    try {
      const saved = await supportRepository.send(activeId, body, attachments);
      setPending((prev) => prev.filter((p) => p.localId !== localId));
      setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      void loadConversations();
    } catch (e) {
      setPending((prev) => prev.map((p) => (p.localId === localId
        ? { ...p, state: "failed", error: e instanceof Error ? e.message : t("support.sendFailed") }
        : p)));
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body && files.length === 0) return;
    setDraft("");
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    await send(body, files);
  };

  const loading = conversations === null;
  const onlyBranch = branches?.length === 1 ? branches[0] : null;

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: "wrap", rowGap: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("support.title")}</h2>
        {branches && branches.length > 0 && (
          <Button
            disabled={starting}
            onClick={() => {
              // One branch answers the question itself; several need the pick,
              // and the select below is where that happens.
              if (onlyBranch) void startConversation(onlyBranch.id);
            }}
            style={{ visibility: onlyBranch ? "visible" : "hidden" }}
          >
            {starting ? t("support.starting") : t("support.newRequest")}
          </Button>
        )}
      </div>

      <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("support.intro")}</p>

      {loading ? <ListSkeleton /> : (
        <div className="support-layout">
          {/* ── Conversations ─────────────────────────────────────────── */}
          <aside className="card support-list">
            <div className="label" style={{ fontSize: 12, marginBottom: 8 }}>{t("support.conversations")}</div>

            {listError && <div className="error" style={{ marginBottom: 8 }}>{listError}</div>}

            {conversations.length === 0 && (
              <div className="muted" style={{ fontSize: 13 }}>{t("support.noConversations")}</div>
            )}

            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`support-item${c.id === activeId ? " is-active" : ""}`}
              >
                <div className="row-between" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{c.reference}</span>
                  {c.unread > 0 && <span className="support-badge">{c.unread}</span>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {[c.company_name, c.branch_address].filter(Boolean).join(" · ") || `№${c.branch_id}`}
                </div>
                {c.last_message_at && (
                  <div className="muted" style={{ fontSize: 11 }}>{formatDateTime(c.last_message_at)}</div>
                )}
              </button>
            ))}

            {/* Opening a thread for a specific branch — shown only when there
                is a choice to make. */}
            {branches && branches.length > 1 && (
              <div className="col" style={{ gap: 6, marginTop: 12 }}>
                <span className="label" style={{ fontSize: 12 }}>{t("support.startForBranch")}</span>
                <select
                  className="input"
                  defaultValue=""
                  disabled={starting}
                  onChange={(e) => { if (e.target.value) void startConversation(Number(e.target.value)); }}
                >
                  <option value="" disabled>{t("support.pickBranch")}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.address}</option>
                  ))}
                </select>
              </div>
            )}
          </aside>

          {/* ── The thread ────────────────────────────────────────────── */}
          <section className="card support-thread">
            {!active ? (
              <div className="muted" style={{ fontSize: 13 }}>{t("support.pickConversation")}</div>
            ) : (
              <>
                <header className="row" style={{ gap: 10, alignItems: "center", borderBottom: "1px solid #1f2a44", paddingBottom: 10 }}>
                  {storageUri(active.logo_path) && (
                    <img
                      src={storageUri(active.logo_path)!}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {[active.company_name, active.branch_address].filter(Boolean).join(" — ") || active.reference}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {active.reference} · {user?.name} · {t(`support.role.${user?.role ?? "manager"}`)}
                    </div>
                  </div>
                </header>

                <div className="support-messages">
                  {threadLoading && <Spinner />}
                  {!threadLoading && messages.length === 0 && pending.length === 0 && (
                    <div className="muted" style={{ fontSize: 13 }}>{t("support.emptyThread")}</div>
                  )}

                  {messages.map((m) => (
                    <article key={m.id} className={`support-bubble${m.sender === "staff" ? " is-mine" : ""}`}>
                      <div className="support-bubble__meta">
                        {m.sender_name} · {m.created_at ? formatDateTime(m.created_at) : ""}
                      </div>
                      {m.body && <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>}
                      {m.attachments.map((a) => (
                        <a
                          key={a.id}
                          href={storageUri(a.path) ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="support-attachment"
                        >
                          📎 {a.original_name}
                        </a>
                      ))}
                      {/* Delivery is shown only when it is not the boring case:
                          a message that reached support needs no commentary. */}
                      {m.sender === "staff" && m.delivery === "queued" && (
                        <div className="support-bubble__state">{t("support.state.queued")}</div>
                      )}
                      {m.sender === "staff" && m.delivery === "failed" && (
                        <div className="support-bubble__state is-failed">
                          {t("support.state.undelivered")}{m.delivery_error ? ` · ${m.delivery_error}` : ""}
                        </div>
                      )}
                    </article>
                  ))}

                  {pending.map((p) => (
                    <article key={p.localId} className="support-bubble is-mine is-pending">
                      <div className="support-bubble__meta">{user?.name}</div>
                      {p.body && <div style={{ whiteSpace: "pre-wrap" }}>{p.body}</div>}
                      {p.files.map((f) => (
                        <div key={f.name} className="support-attachment">📎 {f.name}</div>
                      ))}
                      {p.state === "sending" ? (
                        <div className="support-bubble__state">{t("support.state.sending")}</div>
                      ) : (
                        <div className="support-bubble__state is-failed">
                          {p.error ?? t("support.sendFailed")}
                          <button
                            type="button"
                            className="support-retry"
                            onClick={() => void send(p.body, p.files, p.localId)}
                          >
                            {t("support.retry")}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  <div ref={bottom} />
                </div>

                {/* ── Composer ────────────────────────────────────────── */}
                <div className="col" style={{ gap: 8, borderTop: "1px solid #1f2a44", paddingTop: 10 }}>
                  {files.length > 0 && (
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {files.map((f) => (
                        <span key={f.name} className="support-chip">
                          📎 {f.name}
                          <button type="button" onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                    <Button
                      variant="secondary"
                      onClick={() => fileInput.current?.click()}
                      style={{ minWidth: 120 }}
                    >
                      {t("support.attach")}
                    </Button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                    />
                    <div style={{ flex: 1 }}>
                      <Input
                        placeholder={t("support.placeholder")}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter sends, Shift+Enter would be a newline — but a
                          // single-line input has none, so only the send half
                          // is wired.
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
                        }}
                      />
                    </div>
                    <Button onClick={() => void submit()} disabled={!draft.trim() && files.length === 0}>
                      {t("support.send")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default SupportChat;
