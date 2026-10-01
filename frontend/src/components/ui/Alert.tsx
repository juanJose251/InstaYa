import { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-green-50 text-green-800 ring-green-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  error: "bg-red-50 text-red-800 ring-red-200",
};

export default function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`rounded-xl px-4 py-3 text-sm font-medium ring-1 ${tones[tone]}`}>{children}</div>
  );
}