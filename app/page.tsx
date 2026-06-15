import { AuthGate } from "@/components/auth-gate";
import { AppShellV4 } from "@/components/app-shell-v4";
import { seedConfigColumns, seedMembers, seedTasks } from "@/lib/seed";

export default function HomePage() {
  return (
    <AuthGate>
      <AppShellV4
        initialTasks={seedTasks}
        initialMembers={seedMembers}
        initialConfigColumns={seedConfigColumns}
      />
    </AuthGate>
  );
}
