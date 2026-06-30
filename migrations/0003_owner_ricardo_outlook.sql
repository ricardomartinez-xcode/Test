-- Owner profile requested for the production Cloudflare Access cutover.
-- Passwords are not stored by PSCV Room; identity is handled by Cloudflare Access.

UPDATE app_profiles
SET email = 'ricardo_mtzh@outlook.com',
    full_name = 'Ricardo Martinez Hernandez',
    role = 'owner',
    active = 1,
    can_edit_tasks = 1,
    can_delete_tasks = 1,
    can_manage_materials = 1,
    can_manage_users = 1,
    can_manage_settings = 1,
    can_manage_group = 1,
    can_manage_notifications = 1,
    can_view_reports = 1,
    can_manage_r2 = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'owner-initial';

INSERT INTO app_profiles (
  id, email, full_name, role, active,
  can_edit_tasks, can_delete_tasks, can_manage_materials, can_manage_users,
  can_manage_settings, can_manage_group, can_manage_notifications,
  can_view_reports, can_manage_r2
)
SELECT
  'owner-initial', 'ricardo_mtzh@outlook.com', 'Ricardo Martinez Hernandez', 'owner', 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM app_profiles WHERE id = 'owner-initial');
