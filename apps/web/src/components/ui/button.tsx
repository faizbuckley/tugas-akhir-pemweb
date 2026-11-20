"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { CopyIcon } from "@phosphor-icons/react/dist/csr/Copy";
import { SpinnerIcon } from "@phosphor-icons/react/dist/csr/Spinner";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[8px] border border-transparent bg-clip-padding text-sm font-normal whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity,scale] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "outline-colorful":
          "border-primary bg-background hover:bg-primary text-primary hover:text-primary-foreground aria-expanded:text-primary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        brand: "bg-[#328c4a] text-white hover:bg-[#2a7340]",
        "brand-ghost": "text-[#328c4a] hover:bg-[#328c4a]/10",
        "danger-ghost":
          "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30",
        "danger-subtle":
          "border-red-100 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60",
        link: "text-primary underline-offset-4 hover:underline",
        pill: "rounded-full! bg-primary text-primary-foreground hover:bg-primary/80",
        "pill-outline":
          "rounded-full! border border-primary text-primary bg-background shadow-xs hover:bg-primary hover:text-primary-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        "pill-muted":
          "rounded-full! border border-border bg-background text-muted-foreground hover:bg-muted",
      },
      size: {
        default:
          "h-11 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xl: "h-12 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "size-11 gap-0 has-data-[icon=inline-end]:pr-0 has-data-[icon=inline-start]:pl-0",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        "icon-xl": "size-12",
      },
      static: {
        true: "active:scale-100",
        false:
          "active:scale-[0.96] motion-reduce:active:scale-100",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      static: false,
    },
  },
);

interface ButtonProps
  extends
    ButtonPrimitive.Props,
    VariantProps<typeof buttonVariants> {}

function Button({
  className,
  variant = "default",
  size = "default",
  static: isStatic = false,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(
        buttonVariants({ variant, size, static: isStatic, className }),
      )}
      {...props}
    />
  );
}

type ButtonStatusPhase = "idle" | "pending" | "success";
type ButtonIconComponent = React.ComponentType<React.ComponentProps<"svg">>;

interface ButtonStatusContentConfig {
  idleLabel: React.ReactNode;
  pendingLabel?: React.ReactNode;
  successLabel: React.ReactNode;
  idleIcon: ButtonIconComponent;
  successIcon: ButtonIconComponent;
}

interface ButtonStatusContentProps extends ButtonStatusContentConfig {
  state: ButtonStatusPhase;
}

interface ButtonStatusButtonProps
  extends
    Omit<ButtonProps, "children">,
    ButtonStatusContentConfig {
  status: ButtonStatusPhase;
}

interface ButtonIconSwapProps
  extends Omit<React.ComponentProps<"span">, "aria-hidden" | "children"> {
  active: boolean;
  icon: ButtonIconComponent;
  activeIcon: ButtonIconComponent;
  iconClassName?: string;
}

interface CopyButtonProps extends ButtonProps {
  value: string;
  copiedLabel?: string;
  copiedVisibleMs?: number | null;
  iconClassName?: string;
  onCopied?: () => void;
  onCopyError?: (error: unknown) => void;
}

interface UseButtonStatusOptions {
  successVisibleMs?: number | null;
}

const buttonIconTransitionClassName =
  "size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] data-[active=false]:scale-[0.25] data-[active=false]:opacity-0 data-[active=false]:blur-[4px] data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:blur-0 motion-reduce:scale-100 motion-reduce:blur-0 motion-reduce:transition-none motion-reduce:data-[active=true]:animate-none";

const buttonStatusLabelClassName =
  "transition-[opacity,filter,transform] duration-250 ease-in-out data-[active=false]:-translate-y-1 data-[active=false]:opacity-0 data-[active=false]:blur-[2px] data-[active=true]:translate-y-0 data-[active=true]:opacity-100 data-[active=true]:blur-0 motion-reduce:translate-y-0 motion-reduce:blur-0 motion-reduce:transition-none";

const buttonStatusRowClassName =
  "col-start-1 row-start-1 inline-grid grid-cols-[1rem_auto] items-center gap-1 justify-self-center";

function ButtonIconSwap({
  active,
  icon: Icon,
  activeIcon: ActiveIcon,
  className,
  iconClassName,
  ...props
}: ButtonIconSwapProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn(
        "inline-grid [&>svg]:col-start-1 [&>svg]:row-start-1",
        className,
      )}
      data-state={active ? "active" : "idle"}
    >
      <Icon
        className={cn(buttonIconTransitionClassName, iconClassName)}
        data-active={!active}
      />
      <ActiveIcon
        className={cn(buttonIconTransitionClassName, iconClassName)}
        data-active={active}
      />
    </span>
  );
}

function useButtonStatus({
  successVisibleMs = 1000,
}: UseButtonStatusOptions = {}) {
  const [status, setStatus] = React.useState<ButtonStatusPhase>("idle");
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearResetTimer = React.useCallback(() => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const reset = React.useCallback(() => {
    clearResetTimer();
    setStatus("idle");
  }, [clearResetTimer]);

  const pending = React.useCallback(() => {
    clearResetTimer();
    setStatus("pending");
  }, [clearResetTimer]);

  const success = React.useCallback(
    (onComplete?: () => void) => {
      clearResetTimer();
      setStatus("success");
      if (successVisibleMs === null) {
        onComplete?.();
        return;
      }
      resetTimerRef.current = setTimeout(() => {
        setStatus("idle");
        resetTimerRef.current = null;
        onComplete?.();
      }, successVisibleMs);
    },
    [clearResetTimer, successVisibleMs],
  );

  React.useEffect(() => clearResetTimer, [clearResetTimer]);

  return {
    status,
    isPending: status === "pending",
    isLocked: status !== "idle",
    pending,
    reset,
    success,
  };
}

function ButtonStatusContent({
  state,
  idleLabel,
  pendingLabel = "Memproses...",
  successLabel,
  idleIcon: IdleIcon,
  successIcon: SuccessIcon,
}: ButtonStatusContentProps) {
  const statusLabel =
    state === "pending"
      ? pendingLabel
      : state === "success"
        ? successLabel
        : idleLabel;

  return (
    <>
      <span className="sr-only">{statusLabel}</span>
      <span aria-hidden="true" className="inline-grid items-center">
        <span className={buttonStatusRowClassName}>
          <IdleIcon
            className={buttonIconTransitionClassName}
            data-active={state === "idle"}
          />
          <span
            className={buttonStatusLabelClassName}
            data-active={state === "idle"}
          >
            {idleLabel}
          </span>
        </span>
        <span className={buttonStatusRowClassName}>
          <SpinnerIcon
            className={cn(buttonIconTransitionClassName, "animate-spin")}
            data-active={state === "pending"}
          />
          <span
            className={buttonStatusLabelClassName}
            data-active={state === "pending"}
          >
            {pendingLabel}
          </span>
        </span>
        <span className={buttonStatusRowClassName}>
          <SuccessIcon
            className={cn(
              buttonIconTransitionClassName,
              "data-[active=true]:delay-100",
            )}
            data-active={state === "success"}
          />
          <span
            className={cn(
              buttonStatusLabelClassName,
              "data-[active=true]:delay-200",
            )}
            data-active={state === "success"}
          >
            {successLabel}
          </span>
        </span>
      </span>
    </>
  );
}

function ButtonStatusButton({
  className,
  status,
  idleLabel,
  pendingLabel,
  successLabel,
  idleIcon,
  successIcon,
  ...props
}: ButtonStatusButtonProps) {
  return (
    <Button
      {...props}
      className={cn(
        "overflow-hidden disabled:cursor-progress disabled:opacity-100",
        className,
      )}
      aria-busy={status === "pending"}
      aria-live="polite"
    >
      <ButtonStatusContent
        state={status}
        idleLabel={idleLabel}
        pendingLabel={pendingLabel}
        successLabel={successLabel}
        idleIcon={idleIcon}
        successIcon={successIcon}
      />
    </Button>
  );
}

function CopyButton({
  value,
  copiedLabel = "Copied",
  copiedVisibleMs = 1400,
  iconClassName,
  onCopied,
  onCopyError,
  children,
  className,
  variant = "ghost",
  size,
  "aria-label": ariaLabel,
  onClick,
  ...props
}: CopyButtonProps) {
  const copyStatus = useButtonStatus({ successVisibleMs: copiedVisibleMs });
  const isCopied = copyStatus.status === "success";
  const resolvedSize = size ?? (children == null ? "icon" : "default");
  const idleLabel = ariaLabel ?? (children == null ? "Copy" : undefined);

  const handleCopy: ButtonPrimitive.Props["onClick"] = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const writeText = navigator.clipboard?.writeText.bind(navigator.clipboard);
    if (!writeText) {
      onCopyError?.(new Error("Clipboard writing is unavailable."));
      return;
    }

    void writeText(value)
      .then(() => {
        copyStatus.success();
        onCopied?.();
      })
      .catch((error: unknown) => {
        copyStatus.reset();
        onCopyError?.(error);
      });
  };

  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={resolvedSize}
      aria-label={isCopied ? copiedLabel : idleLabel}
      aria-live="polite"
      className={cn("text-muted-foreground", className)}
      data-state={isCopied ? "copied" : "idle"}
      onClick={handleCopy}
    >
      {children}
      <ButtonIconSwap
        active={isCopied}
        activeIcon={CheckIcon}
        className={iconClassName}
        icon={CopyIcon}
      />
    </Button>
  );
}

export {
  Button,
  ButtonIconSwap,
  type ButtonIconSwapProps,
  type ButtonProps,
  ButtonStatusButton,
  type ButtonStatusPhase,
  CopyButton,
  type CopyButtonProps,
  buttonVariants,
  useButtonStatus,
};
