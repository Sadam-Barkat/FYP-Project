import type { ReactNode } from "react";

type NeonCardProps = {
  children: ReactNode;
  className?: string;
  /** Landing hero: thin frame, magenta → cyan (matches poster) */
  hero?: boolean;
};

export function NeonCard({
  children,
  className = "",
  hero = false,
}: NeonCardProps) {
  const frame = hero ? "neon-border-hero" : "neon-border";
  return (
    <div className={`${frame} relative ${className}`.trim()}>{children}</div>
  );
}
