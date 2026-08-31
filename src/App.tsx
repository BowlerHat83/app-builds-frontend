import { useEffect, useRef, useState } from "react";
import TopNav, { TabDef } from "./components/layout/TopNav";
import BrandLockup from "./components/layout/BrandLockup";
import DownloadMenu from "./components/layout/DownloadMenu";
import UploadForm from "./components/UploadForm";
import OverviewTab from "./pages/OverviewTab";
import Topic1Accessibility from "./pages/Topic1Accessibility";
import Topic2Performance from "./pages/Topic2Performance";
import Topic3Organic from "./pages/Topic3Organic";
import Topic4AIVisibility from "./pages/Topic4AIVisibility";
import Topic5Paid from "./pages/Topic5Paid";
import Topic6Local from "./pages/Topic6Local";
import Topic7Content from "./pages/Topic7Content";
import { pollAuditStatus, AuditJobNotFoundError } from "./api/client";
import type { MasterAuditResponse, MasterAuditResults } from "./types/audit";

// How often to poll GET /audit-status/:job_id while any topic is still
// "pending". 4s is frequent enough that topics visibly fill in one at a
// time without feeling stuck, without hammering a Render free-tier
// instance that's also busy running the actual audit checks.
const POLL_INTERVAL_MS = 4000;

const TOPIC_RESULT_KEYS = [
  "topic1_technical",
  "topic2_performance",
  "topic3_organic_visibility",
  "topic4_ai_visibility",
  "topic5_paid_visibility",
  "topic6_local_visibility",
  "topic7_content_quality",
] as const;

function countCompletedTopics(audit: MasterAuditResponse): number {
  return TOPIC_RESULT_KEYS.filter((key) => audit.master_audit_results[key]?.status !== "pending").length;
}

// Rewrites one topic's envelope to "incomplete" (see EnvelopeStatus in
// types/audit.ts) - generic over the specific key so TypeScript can verify
// the spread stays a valid Envelope<TopicNData> for whichever topic this
// is, which a plain `results[key] = {...}` inside a loop over the whole
// key union can't do (the union of all 7 envelope shapes isn't the same
// type as "the correct one for this specific key").
function markTopicIncomplete<K extends keyof MasterAuditResults>(
  results: MasterAuditResults,
  key: K,
  warning: string
): MasterAuditResults {
  return {
    ...results,
    [key]: { ...results[key], status: "incomplete", warnings: [warning] },
  };
}

const TABS: TabDef[] = [
  { key: "overview", label: "Overview Summary" },
  { key: "topic1", label: "Topic 1: Accessibility" },
  { key: "topic2", label: "Topic 2: Performance" },
  { key: "topic3", label: "Topic 3: Organic Visibility" },
  { key: "topic4", label: "Topic 4: AI Visibility" },
  { key: "topic5", label: "Topic 5: Paid Visibility" },
  { key: "topic6", label: "Topic 6: Local Visibility" },
  { key: "topic7", label: "Topic 7: Content Quality" },
];

export default function App() {
  const [audit, setAudit] = useState<MasterAuditResponse | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  // Surfaces the state of the poll loop itself when something's wrong:
  // terminal: true means the job is gone for good (backend restart lost
  // it - see AuditJobNotFoundError) and polling has stopped; terminal:
  // false means a single poll failed and it's retrying automatically.
  // Cleared on every successful poll and on starting a new audit.
  const [pollNotice, setPollNotice] = useState<{ message: string; terminal: boolean } | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResult = (result: MasterAuditResponse) => {
    setAudit(result);
    setActiveTab("overview");
    setPollNotice(null);
  };

  // Polls the job/polling flow's status endpoint every few seconds while
  // any topic is still "pending", updating the overview/topic tabs live as
  // each one finishes - this is what lets results appear topic by topic
  // instead of only once the whole audit is done. Self-schedules its own
  // next tick rather than using setInterval, so a slow poll can never stack
  // up overlapping requests. Stops on its own once the backend reports
  // complete: true, and is a no-op for a response with no job_id (e.g. if
  // audit is ever set some other way in future).
  useEffect(() => {
    const jobId = audit?.job_id;
    if (!jobId || audit?.complete) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const next = await pollAuditStatus(jobId);
        if (cancelled) return;
        setAudit(next);
        setPollNotice(null);
        if (!next.complete) {
          pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuditJobNotFoundError) {
          // Terminal - this job_id will never come back, so retrying is
          // pointless. Stop the loop; whatever topics already completed
          // stay exactly as shown. Any topic still "pending" at this exact
          // moment never will finish, so it's rewritten to "incomplete"
          // (see EnvelopeStatus in types/audit.ts) rather than left stuck
          // on a spinner forever - every place that already renders an
          // envelope (the overview cards, the composite, each topic's own
          // tab banner) picks this up for free, no other UI code needed.
          // complete: true also flips the composite section from "waiting
          // to finish" to actually showing a real score/grade computed
          // from whichever topics have real data - the same N/A-exclusion
          // logic already used for a topic with no CSV uploaded.
          setAudit((current) => {
            if (!current) return current;
            let updatedResults = current.master_audit_results;
            let anyIncomplete = false;
            for (const key of TOPIC_RESULT_KEYS) {
              if (updatedResults[key].status === "pending") {
                updatedResults = markTopicIncomplete(
                  updatedResults,
                  key,
                  "This section didn't finish - the backend most likely restarted mid-audit " +
                    "(Render's free tier can crash-restart under memory pressure). We're aware of " +
                    "this and are actively working to resolve it. Try running the audit again shortly."
                );
                anyIncomplete = true;
              }
            }
            return anyIncomplete ? { ...current, master_audit_results: updatedResults, complete: true } : current;
          });
          setPollNotice({
            message:
              "This audit didn't finish - the backend most likely restarted mid-run. Topics that " +
              "completed are shown below with real results; any topic marked with an asterisk on the " +
              "Overview tab didn't finish and is excluded from the composite score. We're aware of " +
              "this and working to make full runs more reliable.",
            terminal: true,
          });
          return;
        }
        // A single failed poll (network hiccup, backend briefly under
        // load) isn't fatal - keep whatever results are already on screen,
        // surface a small non-blocking notice so it's not a silent retry
        // loop, and try again on the next tick.
        setPollNotice({
          message: err instanceof Error ? err.message : "The last status check failed - retrying automatically…",
          terminal: false,
        });
        pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [audit?.job_id, audit?.complete]);

  const renderTab = () => {
    if (!audit) return null;
    const results = audit.master_audit_results;
    switch (activeTab) {
      case "overview":
        return <OverviewTab audit={audit} onJumpTo={setActiveTab} />;
      case "topic1":
        return <Topic1Accessibility envelope={results.topic1_technical} />;
      case "topic2":
        return <Topic2Performance envelope={results.topic2_performance} />;
      case "topic3":
        return <Topic3Organic envelope={results.topic3_organic_visibility} />;
      case "topic4":
        return <Topic4AIVisibility envelope={results.topic4_ai_visibility} targetUrl={audit.target_url} />;
      case "topic5":
        return <Topic5Paid envelope={results.topic5_paid_visibility} />;
      case "topic6":
        return <Topic6Local envelope={results.topic6_local_visibility} />;
      case "topic7":
        return <Topic7Content envelope={results.topic7_content_quality} />;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="top-gradient-bar" />
      <div className="app-shell">
        <div className="top-bar">
          <div className="brand">
            <BrandLockup />
            {audit && (
              <span className="brand-sub">
                {audit.target_url}
                {audit.job_id && !audit.complete
                  ? ` · ${countCompletedTopics(audit)}/${TOPIC_RESULT_KEYS.length} topics complete${
                      pollNotice?.terminal ? " (stalled)" : ""
                    }`
                  : ""}
              </span>
            )}
          </div>
          {audit && (
            <div style={{ display: "flex", gap: 10 }}>
              <DownloadMenu audit={audit} />
              <button className="btn btn-ghost" onClick={() => setAudit(null)}>
                ← New audit
              </button>
            </div>
          )}
        </div>

        {pollNotice && (
          <div className={`status-banner ${pollNotice.terminal ? "error" : "warn"}`} style={{ margin: "14px 0" }}>
            {pollNotice.message}
          </div>
        )}

        {!audit ? (
          <UploadForm onResult={handleResult} />
        ) : (
          <>
            <TopNav tabs={TABS} active={activeTab} onChange={setActiveTab} />
            <div className="page-header" style={{ margin: "4px 0 -4px" }} />
            {renderTab()}
          </>
        )}

        <footer className="app-footer">SEO Audit Dashboard · data from your app-builds backend</footer>
      </div>
    </>
  );
}
