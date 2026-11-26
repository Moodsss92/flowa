import { JournalApp } from "@/components/JournalApp";
import { ToastProvider } from "@/components/ui/Toast";

export default function Home() {
  return (
    <ToastProvider>
      <JournalApp />
    </ToastProvider>
  );
}
