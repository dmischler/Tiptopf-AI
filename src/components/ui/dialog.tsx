"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-[70] bg-black/65 transition-opacity duration-200 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogPrimitive.Popup.Props & {
    showCloseButton?: boolean
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => {
  // Sheet on the phone / short landscape; centered modal only with `nav-top`
  // (min-width 768px AND min-height 600px) — same rule as top vs bottom nav.
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[80] grid w-full max-h-[min(92svh,1000px)] max-w-none translate-x-0 translate-y-0 gap-4 overflow-hidden rounded-t-2xl border border-white/10 bg-card pb-[env(safe-area-inset-bottom)] text-sm text-card-foreground shadow-2xl shadow-black/35 outline-none duration-200",
          "data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-4",
          "nav-top:inset-auto nav-top:top-1/2 nav-top:left-1/2 nav-top:right-auto nav-top:bottom-auto nav-top:max-h-[calc(100vh-2rem)] nav-top:w-full nav-top:max-w-[calc(100%-2rem)] nav-top:-translate-x-1/2 nav-top:-translate-y-1/2 nav-top:rounded-2xl nav-top:p-4 nav-top:pb-4",
          "nav-top:data-open:zoom-in-95 nav-top:data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3 h-11 w-11 p-0 flex items-center justify-center"
                size="icon"
              />
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/80 text-white shadow ring-1 ring-white/10 transition-all hover:bg-black/95 hover:ring-white/25">
              <XIcon className="h-4 w-4" />
            </span>
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
})
DialogContent.displayName = "DialogContent"

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
}
