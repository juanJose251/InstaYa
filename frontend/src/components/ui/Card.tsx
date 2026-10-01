import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  );
}