CREATE TABLE public.snapshot_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quality_status TEXT NOT NULL CHECK (quality_status IN ('healthy', 'partial', 'degraded')),
  normalized_snapshot JSONB NOT NULL,
  quality JSONB NOT NULL
);

CREATE INDEX snapshot_records_source_created_idx
  ON public.snapshot_records (source_url, created_at DESC, id DESC);

ALTER TABLE public.snapshot_records ENABLE ROW LEVEL SECURITY;
