import { ReactNode } from "react";

export default function EmptyState({ title, message, icon }: { title: string; message?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-4xl opacity-40">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {message && <p className="text-sm text-slate-500 max-w-xs">{message}</p>}
    </div>
  );
}