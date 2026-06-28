export type UserRole = "basic" | "admin";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  provided_password: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export type LookupTable =
  | "locals"
  | "zones"
  | "responsables_aviso"
  | "providers"
  | "priorities"
  | "statuses";

export type LookupItem = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  sort_order?: number | null;
  local_id?: string | null;
  color?: string | null;
};

export type Incident = {
  id: string;
  fecha_incidencia: string;
  local_id: string;
  zona_id: string;
  descripcion: string;
  responsable_aviso_id: string;
  proveedor_id: string | null;
  prioridad_id: string | null;
  importe_factura: number | null;
  fecha_resolucion: string | null;
  estado_id: string | null;
  created_by: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
  locals?: LookupItem | null;
  zones?: LookupItem | null;
  incident_zones?: IncidentZone[];
  incident_attachments?: IncidentAttachment[];
  responsables_aviso?: LookupItem | null;
  providers?: LookupItem | null;
  priorities?: LookupItem | null;
  statuses?: LookupItem | null;
  profiles?: Pick<Profile, "id" | "email" | "full_name" | "role"> | null;
};

export type IncidentZone = {
  incident_id: string;
  zona_id: string;
  created_at: string;
  zones?: LookupItem | null;
};

export type IncidentAttachment = {
  id: string;
  incident_id: string | null;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: "pending" | "linked" | "dismissed";
  created_at: string;
  invoice_extractions?: InvoiceExtraction | InvoiceExtraction[] | null;
};

export type InvoiceExtraction = {
  id: string;
  attachment_id: string;
  status: "pending" | "completed" | "failed";
  raw_text: string | null;
  parsed_data: InvoiceParsedData;
  confidence: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceParsedData = {
  fecha_incidencia?: string | null;
  local_name?: string | null;
  zona_names?: string[];
  descripcion?: string | null;
  proveedor_name?: string | null;
  prioridad_name?: string | null;
  importe_factura?: number | string | null;
  fecha_resolucion?: string | null;
  estado_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  total_amount?: string | null;
  confidence?: number | null;
};

export type Notification = {
  id: string;
  user_id: string;
  incident_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export type IncidentHistory = {
  id: string;
  incident_id: string | null;
  changed_by: string | null;
  change_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

export type IncidentFilters = {
  local?: string;
  zona?: string;
  estado?: string;
  prioridad?: string;
  responsable?: string;
  proveedor?: string;
  from?: string;
  to?: string;
  q?: string;
};

type TableShape<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<Profile>;
      incidents: TableShape<Incident>;
      locals: TableShape<LookupItem>;
      zones: TableShape<LookupItem>;
      responsables_aviso: TableShape<LookupItem>;
      providers: TableShape<LookupItem>;
      priorities: TableShape<LookupItem>;
      statuses: TableShape<LookupItem>;
      notifications: TableShape<Notification>;
      incident_history: TableShape<IncidentHistory>;
      incident_zones: TableShape<IncidentZone>;
      incident_attachments: TableShape<IncidentAttachment>;
      invoice_extractions: TableShape<InvoiceExtraction>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
