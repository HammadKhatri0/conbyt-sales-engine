// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leads", label: "Leads" },
  { href: "/queue", label: "Queue" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-linear-to-br from-accent to-accent-2 flex items-center justify-center">
            <span className="text-white text-sm font-bold">C</span>
          </div>
          <span className="font-semibold tracking-tight">Conbyt</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  isActive
                    ? "bg-card text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}