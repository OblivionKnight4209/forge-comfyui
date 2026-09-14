import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  className,
  children,
  side = "right",
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "right" | "left" | "bottom";
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface text-fg shadow-[var(--shadow-border)]",
          side === "right" &&
            "inset-y-0 right-0 h-full w-full max-w-md rounded-l-2xl",
          side === "left" &&
            "inset-y-0 left-0 h-full w-full max-w-md rounded-r-2xl",
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <DialogPrimitive.Title className="font-display text-xl italic text-fg">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
