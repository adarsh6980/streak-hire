export function PostmarkLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="22" cy="22" r="20.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="22" r="16" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 3.5" />
      <path
        d="M13 22.5L19.5 28L31 15"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
