const iconClass = "h-4 w-4 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";
const buttonClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border";

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Edit" title="Edit" className={`${buttonClass} border-white/10 bg-[#0d1820] text-cyan-300`}>
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Delete" title="Delete" className={`${buttonClass} border-rose-500/20 bg-rose-500/10 text-rose-300`}>
      <svg viewBox="0 0 24 24" className={iconClass} aria-hidden="true">
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}
