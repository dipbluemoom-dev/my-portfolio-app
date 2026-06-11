import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// ============================================================
// Button — 차콜 잉크 솔리드 / 헤어라인 아웃라인
// ============================================================
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/85',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border bg-card text-foreground hover:bg-secondary',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-2.5 has-[>svg]:px-2',
        lg: 'h-10 rounded-md px-5 has-[>svg]:px-4',
        icon: 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

// ============================================================
// Card — 화이트 서피스 + 헤어라인 (그림자 최소화)
// ============================================================
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground flex flex-col rounded-lg border border-border',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5 pt-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <h4 data-slot="card-title" className={cn('leading-none', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <p data-slot="card-description" className={cn('text-muted-foreground', className)} {...props} />;
}

export function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 [&:last-child]:pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center px-5 pb-5 [.border-t]:pt-5', className)} {...props} />;
}

// ============================================================
// Input — 화이트 + 헤어라인, 포커스 시 웜 링
// ✅ 입력 중에는 화면 값을 외부 상태가 덮어쓰지 않도록 draft 유지
//    - "25.0" 입력 시 소수점 뒤 0이 사라지던 문제 해결
//    - 한글 IME 조합이 끊기던 문제 해결
// ✅ type="number"는 자동으로 고정폭 숫자 + 우측 정렬
// ============================================================
export function Input({ className, type, value, onChange, onFocus, onBlur, ...props }: React.ComponentProps<'input'>) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const isControlled = value !== undefined;
  const isEditing = isControlled && draft !== null;

  return (
    <input
      type={type}
      data-slot="input"
      value={isControlled ? (isEditing ? draft : (value as any) ?? '') : undefined}
      onFocus={(e) => {
        if (isControlled) setDraft(e.currentTarget.value);
        onFocus?.(e);
      }}
      onChange={(e) => {
        if (isControlled) setDraft(e.currentTarget.value);
        onChange?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        onBlur?.(e);
      }}
      className={cn(
        'placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border border-border bg-input-background px-3 py-1 text-sm shadow-[inset_0_1px_2px_rgba(85,68,40,0.04)] transition-[border-color,box-shadow] outline-none',
        type === 'number' && 'tnum text-right',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'read-only:bg-secondary/40 read-only:shadow-none',
        'hover:border-ring/70',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:bg-card',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        className
      )}
      {...props}
    />
  );
}

// ============================================================
// Tabs — 언더라인 내비게이션 스타일
// ============================================================
export function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root data-slot="tabs" className={cn('flex flex-col gap-2', className)} {...props} />
  );
}

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'inline-flex h-auto w-fit items-center justify-start gap-6 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-2.5 pt-1 text-sm font-medium text-muted-foreground transition-colors -mb-px',
        'hover:text-foreground',
        'data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground',
        'focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}
