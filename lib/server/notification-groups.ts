export type AdminNotificationRow = {
  id: string;
  profile_id: string | null;
  kind: string;
  priority: string;
  title: string;
  body: string;
  entity: string | null;
  entity_id: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  created_at: string;
};

export type AdminNotificationGroup = AdminNotificationRow & {
  recipient_count: number;
  read_count: number;
  dismissed_count: number;
};

function groupKey(row: AdminNotificationRow) {
  return [
    row.kind,
    row.priority,
    row.title,
    row.body,
    row.entity ?? "",
    row.entity_id ?? "",
    row.created_at,
  ].join("\u001f");
}

export function groupAdminNotifications(rows: AdminNotificationRow[]): AdminNotificationGroup[] {
  const groups = new Map<string, AdminNotificationGroup>();

  for (const row of rows) {
    const key = groupKey(row);
    const current = groups.get(key);
    if (current) {
      current.recipient_count += 1;
      if (row.read_at) current.read_count += 1;
      if (row.dismissed_at) current.dismissed_count += 1;
      continue;
    }

    groups.set(key, {
      ...row,
      recipient_count: 1,
      read_count: row.read_at ? 1 : 0,
      dismissed_count: row.dismissed_at ? 1 : 0,
    });
  }

  return [...groups.values()];
}

