import BranchPicker from "@/components/support/BranchPicker";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import { ListSkeleton, SkeletonMessages } from "@/components/ui/Skeleton";
import { useAuth } from "@/auth/AuthContext";
import { useLang } from "@/i18n/LanguageContext";
import { formatDateTime } from "@/i18n/dates";
import { storageUri } from "@/infrastructure/AppConfig";
import { notify } from "@/ui/notify";
import { branchRepository } from "@/repositories/BranchRepository";
import { supportRepository } from "@/repositories/SupportRepository";
import { useSupportMessages } from "@/realtime/useSupportMessages";
import { fmt } from "@/i18n/translations";
import { useSupportUnread } from "@/support/SupportUnreadContext";
import {
  checkAttachments,
  formatSize,
  hasProblem,
  type AttachmentProblem,
  type CheckedFile,
} from "@/support/attachmentRules";
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

/**
 * Fold an arriving message into the thread, keyed on its id.
 *
 * A line already on screen is REPLACED rather than appended or ignored, which
 * is what both halves of this need: a reconnect replaying an event must not
 * double the line, and a SECOND announcement of the same message is how its
 * delivery status arrives — the worker announces it again once Telegram has
 * taken it, and the bubble would otherwise sit on "delivering…" until the
 * thread was reopened.
 */
export const mergeMessage = (prev: ISupportMessage[], incoming: ISupportMessage): ISupportMessage[] => {
  const at = prev.findIndex((m) => m.id === incoming.id);
  if (at === -1) return [...prev, incoming];
  const next = [...prev];
  next[at] = incoming;
  return next;
};

/**
 * How long a message may claim to be on its way before that stops being true.
 *
 * A queued message is one the server accepted and handed to the worker that
 * carries it to Telegram. That normally takes a second; the status exists for
 * the seconds in between.
 *
 * When the worker is not running — a deployment where nobody started it, or one
 * whose queue moved off `sync` — the row stays `queued` forever, and the screen
 * went on saying "reaching support…" for hours. The person had written about a
 * problem and had no way to know nobody would see it. Two minutes is far longer
 * than any real delivery and far shorter than a shift.
 */
export const DELIVERY_STUCK_AFTER_MS = 120_000;

/**
 * Whether this message should stop claiming it is on its way.
 *
 * Pure, and takes `now`, so the rule is testable without a clock and without a
 * screen. Only a staff message can be undelivered — support's own messages
 * arrive FROM Telegram and have nothing to deliver.
 */
export const isStuckInDelivery = (message: ISupportMessage, now: number): boolean => {
  if (message.sender !== "staff" || message.delivery !== "queued") return false;
  if (!message.created_at) return false;

  const sentAt = Date.parse(message.created_at);

  return Number.isFinite(sentAt) && now - sentAt >= DELIVERY_STUCK_AFTER_MS;
};

/** A line the user typed that has not been accepted by the server yet. */
interface PendingMessage {
  localId: string;
  body: string;
  files: File[];
  state: "sending" | "failed";
  error?: string;
}

const SupportChat = () => {
  const { t } = useLang();
  const { user } = useAuth();
  const { refresh: refreshUnread, setActiveConversation } = useSupportUnread();

  const [conversations, setConversations] = useState<ISupportConversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ISupportMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [branches, setBranches] = useState<IBranchApi[] | null>(null);
  const [starting, setStarting] = useState(false);
  /** True while the branch cards are up instead of a thread. */
  const [picking, setPicking] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  /** The clock the delivery lines are read against; ticked only while one waits. */
  const [now, setNow] = useState(() => Date.now());

  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  /**
   * The selection, judged before anything leaves the machine.
   *
   * Recomputed from the files themselves rather than stored: dropping one file
   * can make another legal again (the collective limits are cumulative), and a
   * remembered verdict would go stale the moment the list changes.
   */
  const checked: CheckedFile[] = useMemo(() => checkAttachments(files), [files]);
  const attachmentsInvalid = hasProblem(checked);
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

  /**
   * Tell the badge where the reader is.
   *
   * A reply to the thread on screen is marked read the moment it renders, so
   * counting it would light the sidebar for a message being read. Cleared on
   * unmount because leaving Support means nothing is on screen any more.
   */
  useEffect(() => {
    setActiveConversation(activeId);
    return () => setActiveConversation(null);
  }, [activeId, setActiveConversation]);

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
        void supportRepository.markRead(activeId).then(() => refreshUnread());
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
   * Re-read the clock while something is still waiting to be delivered.
   *
   * Only then: a thread with nothing queued starts no timer at all. Without it
   * a stuck line would go on saying "reaching support…" until something else
   * happened to re-render the screen.
   */
  const awaitingDelivery = messages.some((m) => m.sender === "staff" && m.delivery === "queued");

  useEffect(() => {
    if (!awaitingDelivery) return;

    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, [awaitingDelivery]);

  /**
   * Live lines, for every thread this account owns.
   *
   * Subscribed by USER rather than by the branch of the open thread: support
   * is personal, and the channel is the person. A message for the OPEN thread
   * is appended; one for another of their threads only refreshes the list, so
   * its unread badge moves without yanking the reader somewhere they did not
   * ask to be.
   */
  useSupportMessages(
    user?.id ?? null,
    useCallback((event) => {
      if (event.conversation_id === activeId) {
        setMessages((prev) => mergeMessage(prev, event.message));
        void supportRepository.markRead(event.conversation_id).then(() => refreshUnread());
      }
      void loadConversations();
    }, [activeId, loadConversations, refreshUnread]),
  );

  const startConversation = async (branchId: number) => {
    setStarting(true);
    try {
      const thread = await supportRepository.open(branchId);
      await loadConversations();
      setActiveId(thread.conversation.id);
      setMessages(thread.messages);
      setPicking(false);
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

  /**
   * Fetch and save one attachment.
   *
   * A failure says so where the operator is looking — the thread — rather than
   * silently doing nothing, which is what a dead link does.
   */
  const downloadAttachment = async (attachmentId: number, name: string) => {
    try {
      await supportRepository.downloadAttachment(attachmentId, name);
    } catch (e) {
      notify.message("error", e instanceof Error ? e.message : t("support.sendFailed"));
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body && files.length === 0) return;
    // Belt as well as braces: the button is disabled, and an Enter press or a
    // stale render cannot get past this either.
    if (attachmentsInvalid) return;
    setDraft("");
    setFiles([]);
    if (fileInput.current) fileInput.current.value = "";
    await send(body, files);
  };

  /** One problem, one sentence, with the actual limit in it. */
  const problemText = (problem: AttachmentProblem): string => {
    switch (problem.kind) {
      case "too_large": return fmt(t("support.file.tooLarge"), problem.limitMb);
      case "empty": return t("support.file.empty");
      case "too_many": return fmt(t("support.file.tooMany"), problem.limit);
      case "total_too_large": return fmt(t("support.file.totalTooLarge"), problem.limitMb);
    }
  };

  const loading = conversations === null;
  const onlyBranch = branches?.length === 1 ? branches[0] : null;
  const autoStarted = useRef(false);

  /**
   * One branch is not a choice.
   *
   * Somebody who runs a single venue should land in a composer, not in front of
   * a list with one item asking which of their one venue this is about. Guarded
   * by a ref rather than by state so a slow open cannot fire it twice, and only
   * when there is no thread already — an existing conversation is the answer.
   */
  useEffect(() => {
    if (autoStarted.current || starting) return;
    if (!onlyBranch || conversations === null || conversations.length > 0) return;
    autoStarted.current = true;
    void startConversation(onlyBranch.id);
    // `startConversation` is recreated every render; keying on it would defeat
    // the guard's purpose rather than help.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyBranch, conversations, starting]);

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row-between" style={{ flexWrap: "wrap", rowGap: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>{t("support.title")}</h2>
        {branches && branches.length > 0 && (
          <Button
            disabled={starting}
            onClick={() => {
              // One branch answers the question itself; several open the cards.
              if (onlyBranch) void startConversation(onlyBranch.id);
              else setPicking(true);
            }}
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

            {/* The branch question is asked in the pane on the right, on cards
                big enough to read — this is only the way back to it. */}
            {branches && branches.length > 1 && !picking && (
              <button
                type="button"
                className="support-branch-change"
                disabled={starting}
                onClick={() => setPicking(true)}
              >
                🏢 {t("support.chooseBranch")}
              </button>
            )}
          </aside>

          {/* ── The thread ────────────────────────────────────────────── */}
          <section className="card support-thread">
            {picking || !active ? (
              branches && branches.length > 1 ? (
                <div className="col" style={{ gap: 12 }}>
                  <BranchPicker
                    branches={branches}
                    selectedId={active?.branch_id ?? null}
                    busy={starting}
                    onPick={(id) => void startConversation(id)}
                  />
                  {/* A way out that is not "pick something". Opening the cards
                      from an open thread must not trap the reader in them. */}
                  {active && (
                    <Button variant="secondary" onClick={() => setPicking(false)}>
                      {t("action.cancel")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 13 }}>
                  {starting ? t("support.starting") : t("support.pickConversation")}
                </div>
              )
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
                  {branches && branches.length > 1 && (
                    <button
                      type="button"
                      className="support-branch-change is-inline"
                      onClick={() => setPicking(true)}
                    >
                      {t("support.branchChange")}
                    </button>
                  )}
                </header>

                <div className="support-messages">
                  {threadLoading && <SkeletonMessages bubbles={4} />}
                  {!threadLoading && messages.length === 0 && pending.length === 0 && (
                    <div className="muted" style={{ fontSize: 13 }}>{t("support.emptyThread")}</div>
                  )}

                  {messages.map((m) => (
                    <article key={m.id} className={`support-bubble${m.sender === "staff" ? " is-mine" : ""}`}>
                      <div className="support-bubble__meta">
                        {m.sender_name} · {m.created_at ? formatDateTime(m.created_at) : ""}
                      </div>
                      {m.body && <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>}
                      {/* A button, not a link: these files have no URL that
                          works without the session token, which is what stops
                          somebody else's screenshot being one guessed id away. */}
                      {m.attachments.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          className="support-attachment"
                          onClick={() => void downloadAttachment(a.id, a.original_name)}
                        >
                          📎 {a.original_name}
                        </button>
                      ))}
                      {/* Delivery is shown only when it is not the boring case:
                          a message that reached support needs no commentary. */}
                      {m.sender === "staff" && m.delivery === "queued" && !isStuckInDelivery(m, now) && (
                        <div className="support-bubble__state">{t("support.state.queued")}</div>
                      )}
                      {m.sender === "staff" && (m.delivery === "failed" || isStuckInDelivery(m, now)) && (
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
                  {checked.length > 0 && (
                    <div className="col" style={{ gap: 6 }}>
                      {checked.map(({ file, problem }) => (
                        <div
                          key={`${file.name}:${file.size}:${file.lastModified}`}
                          className={`support-chip${problem ? " is-bad" : ""}`}
                        >
                          <span className="support-chip__icon" aria-hidden>{problem ? "✕" : "📎"}</span>
                          <span className="support-chip__name" title={file.name}>{file.name}</span>
                          <span className="support-chip__size">{formatSize(file.size)}</span>
                          {problem && (
                            <span className="support-chip__why">{problemText(problem)}</span>
                          )}
                          <button
                            type="button"
                            aria-label={`${t("support.file.remove")}: ${file.name}`}
                            onClick={() => setFiles((prev) => prev.filter((x) => x !== file))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {attachmentsInvalid && (
                        <span className="cp-mli-failed" style={{ fontSize: 12 }}>
                          {t("support.file.fixBeforeSending")}
                        </span>
                      )}
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
                    <Button
                      onClick={() => void submit()}
                      // Nothing to send, or something that must not be sent.
                      disabled={(!draft.trim() && files.length === 0) || attachmentsInvalid}
                      title={attachmentsInvalid ? t("support.file.fixBeforeSending") : undefined}
                    >
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
