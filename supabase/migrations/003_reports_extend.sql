-- Extend reports table with full analysis data and AI content
alter table reports
  add column if not exists project_type       text,
  add column if not exists price_announced    numeric,
  add column if not exists developer_price    numeric,
  add column if not exists price_median       numeric,
  add column if not exists price_p25          numeric,
  add column if not exists price_p75          numeric,
  add column if not exists price_avg          numeric,
  add column if not exists listings_count     integer,
  add column if not exists est_monthly_revenue numeric,
  add column if not exists avg_reviews        numeric,
  add column if not exists variance_pct       numeric,
  add column if not exists report_content     jsonb;
