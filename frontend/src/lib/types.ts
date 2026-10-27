// Shapes returned by the backend. See shared/contracts for the JSON Schemas.

export type Project = { id: string; name: string; created_at: string };

export type Document = { id: string; filename: string; sha256: string; page_count: number };

export type Page = {
  id: string;
  document_id: string;
  page_index: number;
  width_px: number;
  height_px: number;
  metres_per_pixel: number | null;
  scale: Record<string, unknown> | null;
  image_url: string;
};

export type Storey = { name: string; level_m: number };

export type FrameStatus = "none" | "current" | "stale";
export type FrameInfo = { version: number | null; status: FrameStatus };

export type BBox = [number, number, number, number];
export type Geometry = { page_id: string; bbox: BBox };

export type ObservationRecord = {
  id: string;
  project_id: string;
  element: string;
  frame_version: number;
  storey: string | null;
  source: "agent" | "manual";
  geometry: Geometry | null;
  values: Record<string, unknown>;
  created_at: string;
};

export type ObservationIn = {
  storey: string | null;
  geometry: Geometry | null;
  values: Record<string, unknown>;
};

export type BoqItem = {
  id: string;
  element: string;
  section: string;
  item_code: string | null;
  description: string;
  quantity: number;
  unit: string;
  storey: string | null;
  observation_ids: string[];
  basis: string;
};

export type Issue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  observation_ids: string[];
};

export type ElementResult = {
  element: string;
  frame_version: number | null;
  observations: ObservationRecord[];
  items: BoqItem[];
  issues: Issue[];
};

export type JsonSchemaProperty = {
  type?: string;
  title?: string;
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  anyOf?: JsonSchemaProperty[];
};

export type ObservationSchema = {
  title?: string;
  description?: string;
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
};

export type ElementInfo = {
  key: string;
  display_name: string;
  section: string;
  schema: ObservationSchema;
  has_prompt: boolean;
};

export type ReviewStatus = "open" | "confirmed" | "stale";

export type ReviewRow = {
  element: string;
  display_name: string;
  status: ReviewStatus;
  observation_count: number;
  error_count: number;
  warning_count: number;
};

export type BoqLine = {
  section: string;
  item_code: string | null;
  description: string;
  unit: string;
  quantity: number;
  items: BoqItem[];
};

export type AgentStatus = "ready" | "login_required" | "offline";
