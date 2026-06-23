import type { Session } from "@supabase/supabase-js";
import { decryptCalendarToken, encryptCalendarToken } from "@/lib/server/calendar-crypto";
import {
  buildMicrosoftCalendarEvent,
  buildMicrosoftCalendarUpdate,
  type CalendarTask,
  type MicrosoftCalendarEvent,
  type MicrosoftCalendarUpdate,
} from "@/lib/server/microsoft-calendar";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type CalendarConnection = {
  profile_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  access_token_expires_at: string;
  scopes: string;
  connected_at: string;
  updated_at: string;
  last_sync_at: string | null;
  last_error: string | null;
};

type CalendarTaskRow = CalendarTask & {
  status: string;
  visible_to_students: boolean;
  archived_at: string | null;
};

type CalendarEventMapping = {
  profile_id: string;
  task_id: string;
  provider_event_id: string;
  web_link: string | null;
};

export type CalendarSyncSummary = {
  connected: number;
  created: number;
  updated: number;
  deleted: number;
  failed: number;
};

class GraphError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function encryptionKey() {
  const value = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("CALENDAR_TOKEN_ENCRYPTION_KEY no está configurada.");
  return value;
}

function activeCalendarTask(task: CalendarTaskRow) {
  return !task.archived_at
    && task.visible_to_students
    && task.status !== "Entregado"
    && task.status !== "Cancelado";
}

async function graphRequest<T>(
  accessToken: string,
  path: string,
  init: { method: "POST" | "PATCH" | "DELETE"; body?: MicrosoftCalendarEvent | MicrosoftCalendarUpdate },
) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="Central Standard Time (Mexico)"',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new GraphError(response.status, payload?.error?.message ?? `Microsoft Graph respondió ${response.status}.`);
  }

  if (response.status === 204) return null as T;
  return await response.json() as T;
}

async function refreshMicrosoftAccessToken(connection: CalendarConnection) {
  if (!connection.refresh_token_encrypted) {
    throw new Error("Microsoft no entregó un refresh token. Reconecta el calendario.");
  }

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_OAUTH_TENANT_ID || "common";
  if (!clientId || !clientSecret) {
    throw new Error("La renovación de Microsoft Calendar requiere configurar las credenciales OAuth en Vercel.");
  }

  const refreshToken = decryptCalendarToken(connection.refresh_token_encrypted, encryptionKey());
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: "openid email profile offline_access Calendars.ReadWrite",
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? "No se pudo renovar el acceso a Microsoft Calendar.");
  }

  const service = createSupabaseServiceClient();
  const expiresAt = new Date(Date.now() + Math.max(300, payload.expires_in ?? 3600) * 1000).toISOString();
  const refreshTokenEncrypted = payload.refresh_token
    ? encryptCalendarToken(payload.refresh_token, encryptionKey())
    : connection.refresh_token_encrypted;
  const accessTokenEncrypted = encryptCalendarToken(payload.access_token, encryptionKey());
  const { error } = await service
    .from("microsoft_calendar_connections")
    .update({
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("profile_id", connection.profile_id);
  if (error) throw new Error(error.message);

  return payload.access_token;
}

async function validAccessToken(connection: CalendarConnection) {
  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  if (expiresAt > Date.now() + 5 * 60 * 1000) {
    return decryptCalendarToken(connection.access_token_encrypted, encryptionKey());
  }
  return refreshMicrosoftAccessToken(connection);
}

async function createEvent(accessToken: string, task: CalendarTaskRow) {
  return graphRequest<{ id: string; webLink?: string }>(accessToken, "/me/events", {
    method: "POST",
    body: buildMicrosoftCalendarEvent(task),
  });
}

async function syncTaskForConnection(
  connection: CalendarConnection,
  task: CalendarTaskRow,
  mapping: CalendarEventMapping | null,
  currentAccessToken?: string,
) {
  const service = createSupabaseServiceClient();
  const accessToken = currentAccessToken ?? await validAccessToken(connection);

  if (!activeCalendarTask(task)) {
    if (!mapping) return "unchanged" as const;
    try {
      await graphRequest<null>(accessToken, `/me/events/${encodeURIComponent(mapping.provider_event_id)}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (!(error instanceof GraphError) || error.status !== 404) throw error;
    }
    const { error } = await service
      .from("task_calendar_events")
      .delete()
      .eq("profile_id", connection.profile_id)
      .eq("task_id", task.id);
    if (error) throw new Error(error.message);
    return "deleted" as const;
  }

  let event: { id: string; webLink?: string };
  let result: "created" | "updated";
  if (mapping) {
    try {
      event = await graphRequest<{ id: string; webLink?: string }>(
        accessToken,
        `/me/events/${encodeURIComponent(mapping.provider_event_id)}`,
        { method: "PATCH", body: buildMicrosoftCalendarUpdate(task) },
      );
      result = "updated";
    } catch (error) {
      if (!(error instanceof GraphError) || error.status !== 404) throw error;
      event = await createEvent(accessToken, task);
      result = "created";
    }
  } else {
    event = await createEvent(accessToken, task);
    result = "created";
  }

  const { error } = await service
    .from("task_calendar_events")
    .upsert({
      profile_id: connection.profile_id,
      task_id: task.id,
      provider_event_id: event.id,
      web_link: event.webLink ?? mapping?.web_link ?? null,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: "profile_id,task_id" });
  if (error) throw new Error(error.message);
  return result;
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  });
  await Promise.all(runners);
}

async function setConnectionResult(profileId: string, error: string | null) {
  const service = createSupabaseServiceClient();
  await service
    .from("microsoft_calendar_connections")
    .update({
      last_sync_at: error ? undefined : new Date().toISOString(),
      last_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);
}

export async function storeMicrosoftCalendarConnection(profileId: string, session: Session) {
  if (!session.provider_token) return false;
  const service = createSupabaseServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(300, session.expires_in ?? 3600) * 1000);
  const existing = await service
    .from("microsoft_calendar_connections")
    .select("refresh_token_encrypted")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const row = {
    profile_id: profileId,
    access_token_encrypted: encryptCalendarToken(session.provider_token, encryptionKey()),
    refresh_token_encrypted: session.provider_refresh_token
      ? encryptCalendarToken(session.provider_refresh_token, encryptionKey())
      : (existing.data?.refresh_token_encrypted as string | null | undefined) ?? null,
    access_token_expires_at: expiresAt.toISOString(),
    scopes: "openid email profile offline_access Calendars.ReadWrite",
    connected_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_error: null,
  };
  const { error } = await service
    .from("microsoft_calendar_connections")
    .upsert(row, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
  return true;
}

export async function syncProfileCalendar(profileId: string): Promise<CalendarSyncSummary> {
  const service = createSupabaseServiceClient();
  const [connectionResponse, tasksResponse, mappingsResponse] = await Promise.all([
    service.from("microsoft_calendar_connections").select("*").eq("profile_id", profileId).maybeSingle(),
    service
      .from("tasks")
      .select("id,title,due_date,due_time,notes,material_url,platform_url,status,visible_to_students,archived_at,courses(name)"),
    service.from("task_calendar_events").select("*").eq("profile_id", profileId),
  ]);
  if (connectionResponse.error) throw new Error(connectionResponse.error.message);
  if (!connectionResponse.data) throw new Error("Calendario de Microsoft no conectado.");
  if (tasksResponse.error) throw new Error(tasksResponse.error.message);
  if (mappingsResponse.error) throw new Error(mappingsResponse.error.message);

  const connection = connectionResponse.data as CalendarConnection;
  const mappings = new Map(
    ((mappingsResponse.data ?? []) as CalendarEventMapping[]).map((mapping) => [mapping.task_id, mapping]),
  );
  const summary: CalendarSyncSummary = {
    connected: 1,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
  };
  let firstError: string | null = null;

  try {
    const accessToken = await validAccessToken(connection);
    await runWithConcurrency((tasksResponse.data ?? []) as CalendarTaskRow[], 4, async (task) => {
      try {
        const result = await syncTaskForConnection(connection, task, mappings.get(task.id) ?? null, accessToken);
        if (result === "created") summary.created += 1;
        if (result === "updated") summary.updated += 1;
        if (result === "deleted") summary.deleted += 1;
      } catch (error) {
        summary.failed += 1;
        firstError ??= error instanceof Error ? error.message : "Error de sincronización.";
      }
    });
    const error = summary.failed
      ? `${summary.failed} eventos no pudieron sincronizarse. ${firstError ?? ""}`.trim()
      : null;
    await setConnectionResult(profileId, error);
    return summary;
  } catch (error) {
    await setConnectionResult(profileId, error instanceof Error ? error.message : "Error de sincronización.");
    throw error;
  }
}

export async function syncTaskAcrossCalendarConnections(taskId: string): Promise<CalendarSyncSummary> {
  const service = createSupabaseServiceClient();
  const [taskResponse, connectionsResponse, mappingsResponse] = await Promise.all([
    service
      .from("tasks")
      .select("id,title,due_date,due_time,notes,material_url,platform_url,status,visible_to_students,archived_at,courses(name)")
      .eq("id", taskId)
      .maybeSingle(),
    service.from("microsoft_calendar_connections").select("*"),
    service.from("task_calendar_events").select("*").eq("task_id", taskId),
  ]);
  if (taskResponse.error) throw new Error(taskResponse.error.message);
  if (!taskResponse.data) throw new Error("Tarea no encontrada para sincronizar.");
  if (connectionsResponse.error) throw new Error(connectionsResponse.error.message);
  if (mappingsResponse.error) throw new Error(mappingsResponse.error.message);

  const task = taskResponse.data as CalendarTaskRow;
  const connections = (connectionsResponse.data ?? []) as CalendarConnection[];
  const mappings = new Map(
    ((mappingsResponse.data ?? []) as CalendarEventMapping[]).map((mapping) => [mapping.profile_id, mapping]),
  );
  const summary: CalendarSyncSummary = {
    connected: connections.length,
    created: 0,
    updated: 0,
    deleted: 0,
    failed: 0,
  };

  await runWithConcurrency(connections, 4, async (connection) => {
    try {
      const result = await syncTaskForConnection(connection, task, mappings.get(connection.profile_id) ?? null);
      if (result === "created") summary.created += 1;
      if (result === "updated") summary.updated += 1;
      if (result === "deleted") summary.deleted += 1;
      await setConnectionResult(connection.profile_id, null);
    } catch (error) {
      summary.failed += 1;
      await setConnectionResult(
        connection.profile_id,
        error instanceof Error ? error.message : "Error de sincronización.",
      );
    }
  });

  return summary;
}

export async function getMicrosoftCalendarStatus(profileId: string) {
  const service = createSupabaseServiceClient();
  const refreshConfigured = Boolean(
    process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
  );
  const { data, error } = await service
    .from("microsoft_calendar_connections")
    .select("connected_at,last_sync_at,last_error,access_token_expires_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? {
    connected: true,
    connectedAt: data.connected_at as string,
    lastSyncAt: data.last_sync_at as string | null,
    lastError: data.last_error as string | null,
    reconnectRequired: Boolean(data.last_error && /reconecta|credenciales oauth|renovación/i.test(data.last_error)),
    refreshConfigured,
  } : {
    connected: false,
    connectedAt: null,
    lastSyncAt: null,
    lastError: null,
    reconnectRequired: false,
    refreshConfigured,
  };
}

export async function disconnectMicrosoftCalendar(profileId: string) {
  const service = createSupabaseServiceClient();
  const mappings = await service
    .from("task_calendar_events")
    .select("*")
    .eq("profile_id", profileId);
  const connection = await service
    .from("microsoft_calendar_connections")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (mappings.error) throw new Error(mappings.error.message);
  if (connection.error) throw new Error(connection.error.message);

  if (connection.data) {
    try {
      const accessToken = await validAccessToken(connection.data as CalendarConnection);
      await runWithConcurrency((mappings.data ?? []) as CalendarEventMapping[], 4, async (mapping) => {
        try {
          await graphRequest<null>(accessToken, `/me/events/${encodeURIComponent(mapping.provider_event_id)}`, {
            method: "DELETE",
          });
        } catch (error) {
          if (!(error instanceof GraphError) || error.status !== 404) throw error;
        }
      });
    } catch {
      // Disconnect must still remove stored credentials when Microsoft access is unavailable.
    }
  }

  const { error } = await service
    .from("microsoft_calendar_connections")
    .delete()
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
}
