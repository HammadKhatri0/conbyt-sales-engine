// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted">
        <span>© {new Date().getFullYear()} Conbyt Sales Engine</span>
        <span>Built on Retell AI</span>
      </div>
    </footer>
  );
}