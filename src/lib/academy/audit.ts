import { createServiceClient } from "./supabase";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Append-only audit trail. Failures are logged, never swallowed silently. */
export async function audit(entry: AuditEntry): Promise<void> {
  const { error } = await createServiceClient().from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
  });
  if (error) console.error("[audit] failed to write entry", entry.action, error.message);
}
