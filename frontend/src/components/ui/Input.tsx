import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = "", id, ...rest },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:ring-2 ${
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : "border-slate-300 focus:border-brand-600 focus:ring-brand-100"
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
});

export default Input;