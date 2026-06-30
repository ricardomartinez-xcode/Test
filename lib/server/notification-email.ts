import { d1All } from "@/lib/server/d1-data";

export type AnnouncementNotification = {
  id: string;
  profile_id: string | null;
  kind: string;
  priority: string;
  title: string;
  body: string;
  action_url: string | null;
};

type RecipientProfile = {
  id: string;
  email: string;
  full_name: string | null;
  active: number;
};

type NotificationPreference = {
  profile_id: string;
  email_enabled: number;
  categories: unknown;
};

export type EmailDispatchResult = {
  configured: boolean;
  considered: number;
  delivered: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function getDeliveryConfig() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  if (!resendApiKey || !from) return null;
  return { resendApiKey, from, appUrl };
}

function categoryAllowsEmail(categories: unknown, kind: string) {
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return true;
  const value = (categories as Record<string, unknown>)[kind];
  return value !== false;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function actionUrl(notification: AnnouncementNotification, appUrl: string) {
  if (!notification.action_url) return appUrl;
  try {
    return new URL(notification.action_url, appUrl).toString();
  } catch {
    return appUrl;
  }
}

function notificationHtml(notification: AnnouncementNotification, recipient: RecipientProfile, appUrl: string) {
  const greeting = recipient.full_name ? `Hola, ${escapeHtml(recipient.full_name)}.` : "Hola.";
  const body = notification.body ? `<p style="margin:0 0 20px;line-height:1.6">${escapeHtml(notification.body)}</p>` : "";
  const link = actionUrl(notification, appUrl);

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f7f8fa;color:#172033;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:28px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px"><p style="margin:0 0 16px;color:#667085;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">PSCV Room · Aviso</p><h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">${escapeHtml(notification.title)}</h1><p style="margin:0 0 16px;line-height:1.6">${greeting}</p>${body}<p style="margin:24px 0 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#175cd3;border-radius:8px;color:#ffffff;font-weight:700;padding:11px 16px;text-decoration:none">Abrir PSCV Room</a></p></main></body></html>`;
}

function notificationText(notification: AnnouncementNotification, recipient: RecipientProfile, appUrl: string) {
  const greeting = recipient.full_name ? `Hola, ${recipient.full_name}.` : "Hola.";
  const body = notification.body ? `\n\n${notification.body}` : "";
  return `${greeting}\n\n${notification.title}${body}\n\nAbrir PSCV Room: ${actionUrl(notification, appUrl)}`;
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function deliverAnnouncementEmails(notifications: AnnouncementNotification[]): Promise<EmailDispatchResult> {
  const result: EmailDispatchResult = {
    configured: false,
    considered: notifications.length,
    delivered: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  const config = getDeliveryConfig();
  const profileIds = [...new Set(notifications.map((notification) => notification.profile_id).filter((id): id is string => Boolean(id)))];

  if (!config || !profileIds.length) {
    result.skipped = notifications.length;
    return result;
  }

  result.configured = true;
  const placeholders = profileIds.map(() => "?").join(",");
  let profilesResponse: RecipientProfile[] = [];
  let preferencesResponse: NotificationPreference[] = [];
  try {
    [profilesResponse, preferencesResponse] = await Promise.all([
      d1All<RecipientProfile>(
        `SELECT id, email, full_name, active FROM app_profiles WHERE active = 1 AND id IN (${placeholders})`,
        profileIds,
      ),
      d1All<NotificationPreference>(
        `SELECT profile_id, email_enabled, categories FROM notification_preferences WHERE email_enabled = 1 AND profile_id IN (${placeholders})`,
        profileIds,
      ),
    ]);
  } catch (error) {
    result.failed = notifications.length;
    result.errors.push(error instanceof Error ? error.message : "No se pudieron preparar los destinatarios.");
    return result;
  }

  const profiles = new Map(profilesResponse.map((profile) => [profile.id, profile]));
  const preferences = new Map(preferencesResponse.map((preference) => [preference.profile_id, preference]));
  const deliveries = notifications.flatMap((notification) => {
    if (!notification.profile_id) return [];
    const recipient = profiles.get(notification.profile_id);
    const preference = preferences.get(notification.profile_id);
    if (!recipient || !preference || !categoryAllowsEmail(preference.categories, notification.kind)) return [];
    return [{ notification, recipient }];
  });
  result.skipped = notifications.length - deliveries.length;

  await mapWithConcurrency(deliveries, 5, async ({ notification, recipient }) => {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: [recipient.email],
          subject: notification.title,
          html: notificationHtml(notification, recipient, config.appUrl),
          text: notificationText(notification, recipient, config.appUrl),
          tags: [
            { name: "source", value: "pscv-room" },
            { name: "kind", value: notification.kind.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64) || "system" },
          ],
        }),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240);
        throw new Error(`${response.status} ${detail}`.trim());
      }
      result.delivered += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${recipient.email}: ${error instanceof Error ? error.message : "Error al enviar"}`);
    }
  });

  return result;
}
