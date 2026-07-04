// app/page.tsx
import CallWidget from "@/components/Callwidget";

export default function Home() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent-2/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full flex items-center justify-center">
        <CallWidget />
      </div>
    </div>
  );
}