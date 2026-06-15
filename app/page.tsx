import { AuthGate } from "@/components/auth-gate";
import { AppShellV3 } from "@/components/app-shell-v3";
import { seedConfigColumns, seedMembers, seedTasks } from "@/lib/seed";

export default function HomePage() {
  return (
    <AuthGate>
      <AppShellV3
        initialTasks={seedTasks}
        initialMembers={seedMembers}
        initialConfigColumns={seedConfigColumns}
      />
    </AuthGate>
  );
}
