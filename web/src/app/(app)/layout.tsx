import { Shell } from "@/components/shell/Shell";
import { InstallPromptProvider } from "@/contexts/InstallPromptContext";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <InstallPromptProvider>
      <Shell>{children}</Shell>
    </InstallPromptProvider>
  );
}
