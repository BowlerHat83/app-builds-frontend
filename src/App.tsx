import { useState } from "react";
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
import type { MasterAuditResponse } from "./types/audit";

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

  const handleResult = (result: MasterAuditResponse) => {
    setAudit(result);
    setActiveTab("overview");
  };

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
            {audit && <span className="brand-sub">{audit.target_url}</span>}
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
