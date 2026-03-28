export type Intensity = "low" | "medium" | "high";

export interface WhisperEvent {
  session_id: string;
  timestamp: string;
  event_type: "tool_use" | "broadcast" | "heartbeat";
  tool_name?: string;
  file_paths?: string[];
  search_patterns?: string[];
  summary?: string;
  raw_input?: unknown;
  keywords?: string[];
}

export interface WhisperSession {
  gist_id: string;
  gist_url: string;
  session_id: string;
  peer_session_id?: string;
  intensity: Intensity;
  last_comment_id?: number;
  local_events: WhisperEvent[];
}

export type Notifications = "all" | "important";

export interface WhisperConfig {
  gist_id: string;
  gist_url: string;
  session_id: string;
  intensity: Intensity;
  check_frequency_minutes: number;
  auto_expiration_days: number;
  notifications: Notifications;
}
