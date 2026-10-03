"use client";

import React, { createContext, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarContextProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
};

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined,
);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
}

/** Aceternity-style collapsible sidebar shell.
 * @see https://21st.dev/@manuarora700/components/sidebar
 */
export function Sidebar({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
}

export function SidebarBody(props: React.ComponentProps<typeof motion.div>) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
}

export function DesktopSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-border bg-muted/20 px-3 py-3 md:flex",
        className,
      )}
      animate={{
        width: animate ? (open ? 260 : 68) : 260,
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      onMouseEnter={() => {
        if (animate) setOpen(true);
      }}
      onMouseLeave={() => {
        if (animate) setOpen(false);
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MobileSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "flex h-12 w-full items-center justify-between border-b border-border bg-background px-3 md:hidden",
          className,
        )}
        {...props}
      >
        <button
          type="button"
          aria-label="Open chats"
          onClick={() => setOpen(!open)}
          className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted"
        >
          <Menu className="size-4" />
        </button>
        <span className="font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight">
          Chats
        </span>
        <span className="size-9" aria-hidden />
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex h-full w-full flex-col bg-background p-4 md:hidden"
          >
            <div className="mb-4 flex w-full justify-end">
              <button
                type="button"
                aria-label="Close chats"
                onClick={() => setOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground/70 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
