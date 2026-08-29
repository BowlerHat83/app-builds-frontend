// Types mirror the real /audit-master response shape from app-builds/backend
// (app/common/audit_helpers.py's envelope() + each topicN/aggregate.py).
// Anything the backend can genuinely omit/null out is optional/nullable here
// too - the UI is written to show "Not available" rather than assume a field
// is always present.

export type EnvelopeStatus = "success" | "partial" | "error" | "pending";

export interface Envelope<T> {
  status: EnvelopeStatus;
  topic: string;
  data: T;
  warnings: string[];
}

// ---------- Topic 1: Technical, Security & Standards ----------

export interface SitemapCheck {
  found: boolean;
  sitemap_url?: string | null;
  url_count?: number | null;
}

export interface SSLCertificate {
  domain?: string | null;
  issuer?: string | null;
  subject?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  days_remaining?: number | null;
  is_expired?: boolean | null;
  is_expiring_soon?: boolean | null;
  sans?: string[];
  serial_number?: string | null;
  signature_algorithm?: string | null;
  error?: string | null;
}

export interface HtmlSyntax {
  is_valid: boolean;
  total_errors: number;
}

export interface WcagIssue {
  code: string;
  description: string;
  impact: string;
  element?: string;
  occurrences?: number;
}

export interface WcagAccessibility {
  score: number;
  total_issues: number;
  total_occurrences?: number | null;
  engine?: string | null;
  engine_note?: string | null;
  by_impact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issues: WcagIssue[];
}

export interface CookieDetected {
  name: string;
  domain: string;
  path: string;
  secure: string;
}

export interface GdprCompliance {
  url: string;
  is_gdpr_compliant: boolean;
  score: number;
  policies: {
    privacy_policy: boolean;
    cookie_policy: boolean;
    terms_of_service: boolean;
    found_links: {
      privacy_policy?: string | null;
      cookie_policy?: string | null;
      terms_of_service?: string | null;
    };
  };
  banner: {
    banner_detected: boolean;
    cmp_provider: string;
    has_accept_button: boolean;
    has_reject_button: boolean;
  };
  pre_consent_cookie_count: number;
  post_consent_cookie_count: number;
  non_essential_preconsent_risk: boolean;
  cookies_detected: CookieDetected[];
}

export interface Topic1Data {
  topic: string;
  target_url: string;
  technical_standards: {
    sitemap: SitemapCheck;
    ssl_certificate: SSLCertificate;
    html_syntax: HtmlSyntax;
  };
  wcag_accessibility: WcagAccessibility;
  gdpr_compliance: GdprCompliance;
}

// ---------- Topic 2: Performance ----------

export interface CoreWebVitalsDiagnostics {
  requested_url?: string | null;
  final_url?: string | null;
  redirected?: boolean;
  runtime_error?: unknown;
  run_warnings?: string[];
}

export interface CoreWebVitals {
  performance_score: number | null;
  lcp_ms: number | null;
  cls: number | null;
  fcp_ms: number | null;
  speed_index_ms: number | null;
  total_blocking_time_ms: number | null;
  inp_ms: number | null;
  inp_note?: string;
  source?: string;
  diagnostics?: CoreWebVitalsDiagnostics;
}

export interface TechMetrics {
  status_code: number | null;
  page_size_kb: number | null;
  ttfb_ms: number | null;
  ttfb_note?: string;
  load_time_ms: number | null;
  fetch_method?: string;
}

export interface MetaCounts {
  missing: number | null;
  duplicate: number | null;
  multiple: number | null;
}

export interface LengthDistribution {
  under: number;
  optimal: number;
  over: number;
}

export interface MetadataAnalysis {
  screaming_frog_parsed: boolean;
  total_urls_analyzed: number;
  status_code_breakdown: Record<string, number>;
  indexation_errors_count: number | null;
  indexation_errors_by_status_code: Record<string, number> | null;
  meta_counts: {
    title: MetaCounts;
    description: MetaCounts;
    missing_h1: number | null;
  };
  title_distribution: LengthDistribution | null;
  description_distribution: LengthDistribution | null;
}

export interface CoreWebVitalsByStrategy {
  mobile: CoreWebVitals | null;
  desktop: CoreWebVitals | null;
}

export interface Topic2Data {
  topic: string;
  target_url: string;
  core_web_vitals: CoreWebVitalsByStrategy | null;
  core_web_vitals_note?: string | null;
  tech_metrics: TechMetrics | null;
  metadata_analysis: MetadataAnalysis | null;
}

// ---------- Topic 3: Off-Page & Organic Visibility ----------

export interface BacklinksSummary {
  total_backlinks: number;
  unique_referring_domains: number;
  dofollow_backlinks: number;
  nofollow_backlinks: number;
}

export interface CompetitorDR {
  domain: string;
  dr: number;
}

export interface DomainRatingBlock {
  status: string;
  metrics: {
    average_competitor_dr: number;
    max_competitor_dr: number;
    min_competitor_dr: number;
    total_competitors_analyzed: number;
  };
  top_competitors: CompetitorDR[];
}

export interface MarketShareRow {
  domain: string;
  market_share_percent: number;
  common_keywords: number;
  total_competitor_keywords: number;
}

export interface CompetitorShareBlock {
  status: string;
  metrics: {
    average_competitor_share: number;
    max_competitor_share: number;
    total_competitors_analyzed: number;
  };
  market_share_breakdown: MarketShareRow[];
}

export interface KeywordPositionBlock {
  status: string;
  metrics: {
    average_position: number;
    total_keywords_analyzed: number;
    top_3_count: number;
    top_10_count: number;
    top_50_count: number;
  };
}

export interface TopKeywordRow {
  keyword: string;
  impressions_volume: number;
  estimated_clicks: number;
  average_position: number | string;
  ctr_percent: number;
}

export interface ContentGapRow {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number;
  current_position: number | string;
  opportunity_priority: "High" | "Medium" | "Low" | string;
}

export interface BrandedTrafficBlock {
  status: string;
  total_organic_traffic: number;
  total_keywords_analyzed: number;
  traffic_breakdown: {
    branded: { estimated_monthly_traffic: number; traffic_percentage: number; keyword_count: number; keyword_percentage: number };
    unbranded: { estimated_monthly_traffic: number; traffic_percentage: number; keyword_count: number; keyword_percentage: number };
  };
}

export interface TrafficImpressionsBlock {
  status: string;
  timeframe: string;
  metrics: {
    estimated_organic_clicks: number;
    estimated_impressions_potential: number;
    total_search_volume_tracked: number;
    keywords_generating_traffic: number;
  };
}

export interface MonthlyTrafficPoint {
  month: string;
  estimated_organic_traffic: number;
}

export interface HistoricTrafficBlock {
  status: string;
  current_monthly_traffic: number;
  previous_month_traffic: number;
  traffic_change_mom: number;
  average_monthly_traffic: number;
  total_estimated_yearly_traffic: number;
  monthly_history_12m: MonthlyTrafficPoint[];
  methodology_note?: string;
}

export interface Topic3Data {
  topic: string;
  backlinks_summary: BacklinksSummary | null;
  domain_rating: DomainRatingBlock | null;
  competitor_share: CompetitorShareBlock | null;
  keyword_position: KeywordPositionBlock | null;
  top_keywords: { status: string; total_keywords_returned: number; top_keywords: TopKeywordRow[] } | null;
  content_gaps: { status: string; total_content_gaps_found: number; content_gaps: ContentGapRow[] } | null;
  branded_traffic: BrandedTrafficBlock | null;
  traffic_impressions: TrafficImpressionsBlock | null;
  historic_traffic_estimate: HistoricTrafficBlock | null;
}

// ---------- Topic 4: AI Visibility ----------

export interface EngineVisibilityRow {
  engine: string;
  keyword_count: number;
  source_count: number;
}

export interface AICompetitorRow {
  domain: string;
  citations: number;
}

export interface AIKeywordRow {
  keyword: string;
  occurrences: number;
}

export interface AIBrandSource {
  source_domain: string;
  category: string;
  total_citations: number;
  key_urls: string[];
}

export interface TopTargetUrlRow {
  url: string;
  citations: number;
  category: string;
  matched_entities: string[];
}

export interface TopTargetUrlsBlock {
  status: string;
  target_domain: string;
  total_citation_rows: number;
  total_distinct_urls: number;
  top_target_urls: TopTargetUrlRow[];
  methodology_note?: string;
}

export interface TopSearchTermRow {
  prompt: string;
  occurrences: number;
}

export interface Topic4Data {
  topic: string;
  engine_visibility: { status: string; engine_visibility_breakdown: EngineVisibilityRow[] } | null;
  top_competitors: { status: string; top_competitors: AICompetitorRow[] } | null;
  top_keywords: { status: string; top_keywords: AIKeywordRow[] } | null;
  top_search_terms: { status: string; top_search_terms: TopSearchTermRow[] } | null;
  top_urls: { status: string; top_brand_sources: AIBrandSource[] } | null;
  top_target_urls: TopTargetUrlsBlock | null;
  summary: {
    engine_visibility_ratio: string;
    cited_urls_count: number;
    cited_search_terms_count: number;
  } | null;
}

// ---------- Topic 5: Paid Visibility ----------

export interface PPCKeywordRow {
  keyword: string;
  search_volume: number;
  cpc: number;
}

export interface PPCKeywordsBlock {
  status: string;
  total_keywords: number;
  estimated_monthly_spend: number;
  spend_by_match_type: { exact: number; phrase: number; broad: number };
  average_cpc: number | null;
  total_monthly_clicks: number;
  top_keywords: PPCKeywordRow[];
  methodology_note?: string;
}

export interface PPCCompetitorRow {
  domain: string;
  common_keywords: number;
  monthly_paid_keywords: number;
  monthly_paid_clicks: number;
  monthly_ad_budget: number;
}

export interface Topic5Data {
  topic: string;
  keywords: PPCKeywordsBlock | null;
  competitor_share: { status: string; total_competitors_analyzed: number; competitor_share_breakdown: PPCCompetitorRow[] } | null;
}

// ---------- Topic 6: Local Visibility ----------

export interface CitationsBlock {
  total_citations: number;
  active_citations: number;
  high_authority_citations: number;
  nap_consistency_score: number | null;
  nap_consistency_note?: string | null;
}

export interface MapPackKeywordRow {
  keyword: string;
  map_pack_position: number | null;
  found: boolean;
  note?: string;
  error?: string;
}

export interface MapPackBlock {
  business_name: string;
  location: string;
  data_source: string;
  average_map_pack_position: number | null;
  total_keywords_tracked: number;
  keywords_in_map_pack: number;
  keyword_breakdown: MapPackKeywordRow[];
}

export interface TopReview {
  author: string;
  rating: number;
  date: string;
  snippet: string;
}

export interface ReviewsBlock {
  business_name: string;
  location: string;
  data_source: string;
  data_id?: string;
  place_id?: string;
  note?: string;
  error?: string;
  gbp_metrics: { total_reviews: number; average_rating: number; rating_stars: string } | null;
  top_reviews: TopReview[];
}

export interface ProfileScreenshotBlock {
  business_name: string;
  location: string;
  screenshot_filename?: string | null;
  relative_path?: string | null;
  full_filepath?: string | null;
  source?: string;
  status: string;
  error?: string;
}

export interface Topic6Data {
  topic: string;
  business_name: string;
  location: string;
  citations: CitationsBlock | null;
  map_pack: MapPackBlock | null;
  reviews: ReviewsBlock | null;
  profile_screenshot: ProfileScreenshotBlock | null;
}

// ---------- Topic 7: On-Page Content Quality ----------

export interface ThinContentPage {
  url: string;
  character_count: number;
  word_count: number;
  is_thin: boolean;
}

export interface ThinContentAnalysis {
  total_pages_analyzed: number;
  thin_content_page_count: number;
  thin_content_percentage: number;
  page_details: ThinContentPage[];
}

export interface UniqueForm {
  form_id: string;
  action: string;
  first_seen_url: string;
  occurrence_count: number;
  total_inputs: number;
  sample_inputs: string[];
}

export interface FormDetectionBlock {
  total_forms_found: number;
  unique_forms_count: number;
  unique_forms: UniqueForm[];
  pages_checked_count: number;
  pages_checked: string[];
  candidate_pages_selected: number;
  total_pages_discovered_in_csv: number;
  form_likely_pages_matched: number;
  total_ctas_found?: number | null;
  avg_ctas_per_page?: number | null;
  note?: string;
}

export interface FormVisualBreakdown {
  form_id: string;
  status: "captured" | "hidden_on_load" | "screenshot_failed" | string;
  note?: string;
  screenshot_filename?: string | null;
  relative_path?: string | null;
  found_on_url: string;
  mandatory_inputs: number;
  voluntary_inputs: number;
  total_inputs: number;
}

export interface Topic7Data {
  topic: string;
  target_url: string;
  thin_content_analysis: ThinContentAnalysis | null;
  form_detection: FormDetectionBlock | null;
  form_visual_breakdowns: FormVisualBreakdown[];
}

// ---------- Master response ----------

export interface MasterAuditResults {
  topic1_technical: Envelope<Topic1Data>;
  topic2_performance: Envelope<Topic2Data>;
  topic3_organic_visibility: Envelope<Topic3Data>;
  topic4_ai_visibility: Envelope<Topic4Data>;
  topic5_paid_visibility: Envelope<Topic5Data>;
  topic6_local_visibility: Envelope<Topic6Data>;
  topic7_content_quality: Envelope<Topic7Data>;
}

export interface MasterAuditResponse {
  status: string;
  target_url: string;
  provided_inputs: Record<string, string>;
  master_audit_results: MasterAuditResults;
  // Present when this response came from the job/polling flow
  // (/audit-start, /audit-status/:job_id) rather than the older single-
  // request /audit-master. job_id is what to poll; complete is true once
  // every topic has finished (no "pending" envelopes left).
  job_id?: string;
  complete?: boolean;
}
