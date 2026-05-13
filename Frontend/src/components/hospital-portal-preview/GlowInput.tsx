import type { InputHTMLAttributes, ReactNode } from "react";

type GlowInputProps = {
  id: string;
  label: string;
  placeholder: string;
  rightSlot?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "placeholder">;

export function GlowInput({
  id,
  label,
  placeholder,
  rightSlot,
  ...inputProps
}: GlowInputProps) {
  return (
    <div className="mb-2 md:mb-3">
      <label
        htmlFor={id}
        className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.22em] text-white/80"
      >
        {label}
      </label>
      <div className="portal-input-shell relative">
        <input
          id={id}
          placeholder={placeholder}
          className="glow-input"
          {...inputProps}
        />
        <div className="portal-gradient-rule" aria-hidden />
        {rightSlot ? (
          <div className="pointer-events-none absolute right-0 top-[42%] flex -translate-y-1/2 items-center [&_button]:pointer-events-auto">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}
