// Canonical event type constants for the activation funnel
export const EVENT_TYPES = {
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  MATCHES_LIST_OPEN: "matches_list_open",
  INVITE_CREATED: "invite_created",
  INVITE_ACCEPTED: "invite.accepted",
  INVITE_ACCEPT_FAILED: "invite.accept_failed",
  MESSAGE_SEND: "message_send",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// Flexible key/value payload carried with each event
export type BMEventData = {
  user_id?: string | null;
  user_email?: string | null;
  match_id?: string | null;
  invite_id?: string | null;
  date_plan_id?: string | null;
  message_id?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
  dedup_key?: string;
  source?: string;
};

// Shape of a persisted behavior event row
export type BMEvent = BMEventData & {
  id?: string;
  event_type: string;
  created_at?: string;
};

// Shape of a user memory item row
export type MemoryItem = {
  id?: string;
  user_id: string;
  memory_type: string;
  content: string;
  confidence: number;
  source_events?: string[];
  created_at?: string;
  updated_at?: string;
};
