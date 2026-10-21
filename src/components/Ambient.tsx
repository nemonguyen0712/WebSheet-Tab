/**
 * Soft background behind every page: green glows that tie into the dark header strip and footer,
 * a warm brass glow, faint tab strings, and two big blurred olive sprigs (from the logo).
 * Fixed, behind content, and ignores the pointer.
 */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="ambient-glow absolute inset-0" />
      <div className="ambient-strings absolute inset-0" />
      <Sprig className="absolute -left-24 top-24 w-[420px] -rotate-12 opacity-[0.09] blur-[2px] sm:w-[560px]" />
      <Sprig className="absolute -right-28 bottom-10 w-[460px] rotate-[160deg] opacity-[0.08] blur-[3px] sm:w-[620px]" />
    </div>
  );
}

function Sprig({ className }: { className: string }) {
  return (
    <svg viewBox="8 8 26 24" className={className}>
      <path d="M11 29.5C15.5 25.5 21.5 18.5 28.5 11" fill="none" stroke="#1f3d2b" strokeWidth="0.9" strokeLinecap="round" />
      <g fill="#2f5a40">
        <path d="M14.3 26.3c-2.6-.4-4.4-2.3-4.6-4.6 2.4.1 4.4 2 4.6 4.6z" />
        <path d="M15.6 24.8c.6 2.6 2.7 4.2 5 4.1-.3-2.4-2.4-4.1-5-4.1z" />
        <path d="M18.6 21.4c-2.5-.8-4-3-3.9-5.3 2.3.4 4.1 2.6 3.9 5.3z" />
        <path d="M20.2 19.6c.9 2.5 3.2 3.8 5.5 3.4-.6-2.3-2.9-3.8-5.5-3.4z" />
        <path d="M23.4 16.1c-2.3-1.2-3.4-3.6-2.9-5.8 2.2.8 3.6 3.2 2.9 5.8z" />
        <path d="M25.4 14.2c1.3 2.3 3.8 3.2 5.9 2.4-.9-2.1-3.5-3.2-5.9-2.4z" />
        <path d="M28.5 11c.6-.8 1.6-1.4 2.6-1.4-.2 1.1-1.1 2-2.6 1.4z" />
      </g>
      <ellipse cx="24.4" cy="17.3" rx="1.9" ry="2.5" transform="rotate(25 24.4 17.3)" fill="#9c6b2f" />
    </svg>
  );
}
