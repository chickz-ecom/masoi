import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-xl border border-gold/25 bg-night-950/60 px-4 text-[15px] text-parchment placeholder:text-ash/60',
        'transition-colors focus:border-gold/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-gold/30',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-sm font-medium text-parchment/85', className)} {...props} />;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-blood-bright">
      <span aria-hidden>⚠</span>
      <span>{children}</span>
    </p>
  );
}
