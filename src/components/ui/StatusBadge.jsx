"use client";

export default function StatusBadge({ status, color }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap capitalize"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
    >
      {status}
    </span>
  );
}
