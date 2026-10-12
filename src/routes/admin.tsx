import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { banAuthor, banUser, unban } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Moderation — The Question" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AdminPage,
});

type ReportStatus = "open" | "dismissed" | "actioned";

type SignupDay = { day: string; count: number };

type Stats = {
  total_users: number;
  new_users_today: number;
  new_users_7d: number;
  signups_by_day: SignupDay[];
  total_posts: number;
  total_comments: number;
  posts_7d: number;
  comments_7d: number;
  banned_count: number;
  open_reports: number;
};

type ReportRow = {
  id: string;
  target_type: "post" | "comment";
  target_id: string;
  preview: { question: string | null; story: string | null } | null;
  report_count: number;
  reports: { category: string; note: string | null; status: string }[];
  created_at: string;
  author_banned: boolean;
};

type BanRow = { ban_id: string; username: string; reason: string | null; banned_at: string };

type MemberRow = {
  id: string;
  username: string;
  created_at: string;
  banned: boolean;
  ban_id: string | null;
  is_admin: boolean;
};

type BanTarget =
  | { kind: "report"; report: ReportRow; alsoDelete: boolean }
  | { kind: "member"; member: MemberRow };

const MEMBER_PAGE_SIZE = 50;

const CATEGORY_LABELS: Record<string, string> = {
  harassment: "Harassment",
  spam: "Spam",
  hate: "Hate",
  unsafe_content: "Unsafe content",
  someone_at_risk: "Someone may be at risk",
  other: "Other",
};

const STATUS_TABS: ReportStatus[] = ["open", "dismissed", "actioned"];

const exactDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));

function NotFoundContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminPage() {
  const [gate, setGate] = useState<"loading" | "signedout" | "denied" | "ok">("loading");
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [memberPage, setMemberPage] = useState(0);
  const [tab, setTab] = useState<ReportStatus>("open");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [banTarget, setBanTarget] = useState<BanTarget | null>(null);
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setGate("signedout");
        return;
      }
      const { data, error: adminError } = await supabase.rpc("is_admin");
      if (!active) return;
      setGate(!adminError && data === true ? "ok" : "denied");
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshStats = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_stats");
    if (err) {
      setError(err.message);
      return;
    }
    setStats((data ?? null) as Stats | null);
  }, []);

  const refreshBans = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_bans");
    if (err) {
      setError(err.message);
      return;
    }
    setBans((data ?? []) as BanRow[]);
  }, []);

  const refreshReports = useCallback(async (status: ReportStatus) => {
    const { data, error: err } = await supabase.rpc("admin_reports", { p_status: status });
    if (err) {
      setError(err.message);
      return;
    }
    setReports((data ?? []) as ReportRow[]);
  }, []);

  const refreshMembers = useCallback(async (search: string, page: number) => {
    const { data, error: err } = await supabase.rpc("admin_members", {
      p_search: search || null,
      p_limit: MEMBER_PAGE_SIZE,
      p_offset: page * MEMBER_PAGE_SIZE,
    });
    if (err) {
      setError(err.message);
      return;
    }
    const payload = (data ?? null) as { total: number; members: MemberRow[] } | null;
    setMembers(payload?.members ?? []);
    setMemberTotal(payload?.total ?? 0);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshStats(),
      refreshBans(),
      refreshReports(tab),
      refreshMembers(memberQuery, memberPage),
    ]);
  }, [refreshStats, refreshBans, refreshReports, tab, refreshMembers, memberQuery, memberPage]);

  useEffect(() => {
    if (gate !== "ok") return;
    void refreshStats();
    void refreshBans();
  }, [gate, refreshStats, refreshBans]);

  useEffect(() => {
    if (gate !== "ok") return;
    void refreshReports(tab);
  }, [gate, tab, refreshReports]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setMemberQuery(memberSearch.trim());
      setMemberPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [memberSearch]);

  useEffect(() => {
    if (gate !== "ok") return;
    void refreshMembers(memberQuery, memberPage);
  }, [gate, memberQuery, memberPage, refreshMembers]);

  const run = async (action: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const resolve = (report: ReportRow, status: "dismissed" | "actioned") =>
    run(async () => {
      const { error: err } = await supabase.rpc("admin_resolve_report", {
        p_report: report.id,
        p_status: status,
      });
      if (err) throw new Error(err.message);
      await refreshAll();
    });

  const removeContent = (report: ReportRow) => {
    if (!window.confirm("Delete this content? This cannot be undone.")) return;
    void run(async () => {
      const { error: err } = await supabase.rpc("admin_delete_content", {
        p_type: report.target_type,
        p_target: report.target_id,
      });
      if (err) throw new Error(err.message);
      await refreshAll();
    });
  };

  const openBan = (report: ReportRow, alsoDelete: boolean) => {
    setError("");
    setNotice("");
    setBanReason("");
    setBanTarget({ kind: "report", report, alsoDelete });
  };

  const openRestrict = (member: MemberRow) => {
    setError("");
    setNotice("");
    setBanReason("");
    setBanTarget({ kind: "member", member });
  };

  const submitBan = () =>
    run(async () => {
      if (!banTarget) return;
      if (banTarget.kind === "report") {
        if (banTarget.alsoDelete) {
          const { error: delErr } = await supabase.rpc("admin_delete_content", {
            p_type: banTarget.report.target_type,
            p_target: banTarget.report.target_id,
          });
          if (delErr) throw new Error(delErr.message);
        }
        const result = await banAuthor({
          data: {
            type: banTarget.report.target_type,
            targetId: banTarget.report.target_id,
            reason: banReason,
          },
        });
        if (result.warning) setNotice(result.warning);
      } else {
        const result = await banUser({
          data: { userId: banTarget.member.id, reason: banReason },
        });
        if (result.warning) setNotice(result.warning);
      }
      setBanTarget(null);
      setBanReason("");
      await refreshAll();
    });

  const undoBan = (banId: string) =>
    run(async () => {
      const result = await unban({ data: { banId } });
      if (result.warning) setNotice(result.warning);
      await refreshAll();
    });

  if (gate === "loading") {
    return (
      <div className="editorial-shell">
        <main className="mx-auto max-w-2xl px-6 pt-24 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (gate === "signedout") {
    return (
      <div className="editorial-shell">
        <header className="editorial-header">
          <Link to="/" className="wordmark text-foreground no-underline">
            The Question
          </Link>
        </header>
        <main className="mx-auto max-w-xl px-6 pt-24">
          <h1 className="editorial-title">Moderation</h1>
          <p className="editorial-subtitle mt-6">Sign in on the main page first.</p>
          <Link to="/" className="quiet-link mt-8 inline-block underline underline-offset-4">
            Go home
          </Link>
        </main>
      </div>
    );
  }

  if (gate === "denied") {
    return <NotFoundContent />;
  }

  const signupMax = Math.max(1, ...(stats?.signups_by_day ?? []).map((d) => d.count));

  const cards: { label: string; value: number }[] = stats
    ? [
        { label: "Members", value: stats.total_users },
        { label: "New today", value: stats.new_users_today },
        { label: "New (7d)", value: stats.new_users_7d },
        { label: "Posts", value: stats.total_posts },
        { label: "Comments", value: stats.total_comments },
        { label: "Posts (7d)", value: stats.posts_7d },
        { label: "Comments (7d)", value: stats.comments_7d },
        { label: "Banned", value: stats.banned_count },
        { label: "Open reports", value: stats.open_reports },
      ]
    : [];

  return (
    <div className="editorial-shell">
      <header className="editorial-header">
        <Link to="/" className="wordmark text-foreground no-underline">
          The Question
        </Link>
        <span className="eyebrow">Moderation</span>
      </header>

      <main className="mx-auto max-w-[900px] px-5 pt-12 pb-24 md:px-6 md:pt-16">
        <h1 className="font-serif text-3xl md:text-4xl">Moderation</h1>

        {error && (
          <p role="alert" className="mt-5 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && <p className="mt-5 text-sm text-muted-foreground">{notice}</p>}

        <section className="mt-10">
          <h2 className="eyebrow mb-4">Overview</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="story-card !p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-2 font-serif text-2xl">{card.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="eyebrow mb-4">Signups, last 14 days</h2>
          <ul className="space-y-2">
            {(stats?.signups_by_day ?? []).map((d) => (
              <li key={d.day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{d.day}</span>
                <span
                  className="h-3 rounded-[2px] bg-primary"
                  style={{ width: `${Math.round((d.count / signupMax) * 100)}%`, minWidth: d.count ? 4 : 0 }}
                />
                <span className="text-muted-foreground">{d.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="eyebrow mb-4">Members</h2>
          <input
            type="search"
            className="quiet-input max-w-xs"
            placeholder="Search usernames"
            value={memberSearch}
            onChange={(event) => setMemberSearch(event.target.value)}
          />
          <ul className="mt-5 divide-y divide-border rounded-[3px] border border-border">
            {members.map((member) => {
              const status = member.is_admin ? "Admin" : member.banned ? "Restricted" : "Active";
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{member.username}</p>
                    <time
                      className="text-[11px] text-muted-foreground"
                      dateTime={member.created_at}
                    >
                      Joined {exactDate(member.created_at)}
                    </time>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-[11px] uppercase tracking-wide ${
                        member.is_admin || member.banned
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {status}
                    </span>
                    {!member.is_admin &&
                      (member.banned ? (
                        <Button
                          variant="link"
                          className="quiet-link h-auto p-0"
                          disabled={busy}
                          onClick={() => {
                            if (member.ban_id) void undoBan(member.ban_id);
                          }}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="link"
                          className="quiet-link h-auto p-0"
                          disabled={busy}
                          onClick={() => openRestrict(member)}
                        >
                          Restrict
                        </Button>
                      ))}
                  </div>
                </li>
              );
            })}
            {members.length === 0 && (
              <li className="px-4 py-6 font-serif text-lg text-muted-foreground">
                No members found.
              </li>
            )}
          </ul>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <Button
              variant="link"
              className="quiet-link h-auto p-0"
              disabled={busy || memberPage === 0}
              onClick={() => setMemberPage((page) => Math.max(0, page - 1))}
            >
              Previous
            </Button>
            <span>
              {memberTotal} {memberTotal === 1 ? "member" : "members"}
            </span>
            <Button
              variant="link"
              className="quiet-link h-auto p-0"
              disabled={busy || memberPage * MEMBER_PAGE_SIZE + members.length >= memberTotal}
              onClick={() => setMemberPage((page) => page + 1)}
            >
              Next
            </Button>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="eyebrow mb-4">Reports</h2>
          <div className="flex gap-6 border-b border-border pb-3">
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                type="button"
                className={`h-auto p-0 text-xs capitalize ${tab === status ? "text-foreground" : "text-muted-foreground"}`}
                onClick={() => setTab(status)}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="story-card !p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="eyebrow">
                    {report.target_type === "post" ? "Post" : "Comment"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {report.report_count} {report.report_count === 1 ? "report" : "reports"}
                    {report.author_banned ? " · author restricted" : ""}
                  </span>
                </div>

                <p className="story-heading mt-3">
                  {report.preview?.question ?? "(content unavailable)"}
                </p>
                {report.preview?.story && (
                  <p className="mt-2 font-serif text-[15px] leading-7 text-muted-foreground whitespace-pre-wrap line-clamp-4">
                    {report.preview.story}
                  </p>
                )}

                <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                  {report.reports.map((r, index) => (
                    <li key={`${report.id}-${index}`}>
                      <span className="text-foreground">
                        {CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                      {r.note ? ` — ${r.note}` : ""}
                    </li>
                  ))}
                </ul>

                <time className="mt-4 block text-[11px] text-muted-foreground" dateTime={report.created_at}>
                  {exactDate(report.created_at)}
                </time>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                  <Button
                    variant="link"
                    className="quiet-link h-auto p-0"
                    disabled={busy}
                    onClick={() => resolve(report, "dismissed")}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="link"
                    className="quiet-link h-auto p-0"
                    disabled={busy}
                    onClick={() => removeContent(report)}
                  >
                    Delete content
                  </Button>
                  <Button
                    variant="link"
                    className="quiet-link h-auto p-0"
                    disabled={busy}
                    onClick={() => openBan(report, false)}
                  >
                    Ban author
                  </Button>
                  <Button
                    variant="link"
                    className="quiet-link h-auto p-0"
                    disabled={busy}
                    onClick={() => openBan(report, true)}
                  >
                    Delete + ban
                  </Button>
                </div>
              </article>
            ))}
            {reports.length === 0 && (
              <p className="font-serif text-lg text-muted-foreground py-10">
                No {tab} reports.
              </p>
            )}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="eyebrow mb-4">Restricted accounts</h2>
          <ul className="space-y-3">
            {bans.map((ban) => (
              <li
                key={ban.ban_id}
                className="story-card !p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm">{ban.username}</p>
                  <p className="text-sm text-muted-foreground">{ban.reason || "No reason given"}</p>
                  <time className="text-[11px] text-muted-foreground" dateTime={ban.banned_at}>
                    {exactDate(ban.banned_at)}
                  </time>
                </div>
                <Button
                  variant="link"
                  className="quiet-link h-auto p-0"
                  disabled={busy}
                  onClick={() => undoBan(ban.ban_id)}
                >
                  Unban
                </Button>
              </li>
            ))}
            {bans.length === 0 && (
              <li className="font-serif text-lg text-muted-foreground py-6">No restricted accounts.</li>
            )}
          </ul>
        </section>
      </main>

      {banTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setBanTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-[3px] border border-border bg-card p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-serif text-xl">
              {banTarget.kind === "report"
                ? "Restrict this author?"
                : `Restrict @${banTarget.member.username}?`}
            </h2>
            <p className="mt-3 text-xs text-muted-foreground">
              They can still read, but will not be able to post, comment or edit.
              {banTarget.kind === "report" && banTarget.alsoDelete
                ? " The reported content will also be deleted."
                : ""}
            </p>
            <label className="mt-4 block text-xs">
              Reason (optional)
              <textarea
                className="quiet-input mt-2 min-h-20 resize-y"
                maxLength={500}
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
              />
            </label>
            <div className="mt-6 flex justify-end gap-4">
              <Button
                variant="link"
                className="quiet-link h-auto p-0"
                onClick={() => setBanTarget(null)}
              >
                Cancel
              </Button>
              <Button className="rounded-[2px] text-xs" disabled={busy} onClick={submitBan}>
                {busy ? "Working…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
