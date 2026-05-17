"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DashboardDetailModal,
  type DetailModalPayload,
} from "@/components/dashboard/DashboardDetailModal";
import { useHtmlDarkClass } from "@/components/theme/ThemeProvider";

type DetailModalLoadingOpts = {
  title?: string;
  subtitle?: string;
};

type Ctx = {
  openDetail: (payload: DetailModalPayload) => void;
  openDetailAsync: (
    loader: () => Promise<DetailModalPayload>,
    loading?: DetailModalLoadingOpts,
  ) => Promise<void>;
  closeDetail: () => void;
};

const DashboardDetailModalContext = createContext<Ctx | undefined>(undefined);

export function DashboardDetailModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<DetailModalPayload | null>(null);
  const htmlIsDark = useHtmlDarkClass();

  const openDetail = useCallback((p: DetailModalPayload) => {
    setPayload(p);
    setOpen(true);
  }, []);

  const openDetailAsync = useCallback(
    async (loader: () => Promise<DetailModalPayload>, loading?: DetailModalLoadingOpts) => {
      setOpen(true);
      setPayload({
        title: loading?.title ?? "Loading",
        subtitle: loading?.subtitle ?? "Fetching latest data…",
        loading: true,
        blocks: [],
      });
      try {
        const p = await loader();
        setPayload({ ...p, loading: false });
      } catch {
        setPayload({
          title: "Unable to load",
          subtitle: "Check your connection and try again.",
          loading: false,
          blocks: [],
        });
      }
    },
    [],
  );

  const closeDetail = useCallback(() => {
    setOpen(false);
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({ openDetail, openDetailAsync, closeDetail }),
    [openDetail, openDetailAsync, closeDetail],
  );

  return (
    <DashboardDetailModalContext.Provider value={value}>
      {children}
      <DashboardDetailModal open={open} payload={payload} htmlIsDark={htmlIsDark} onClose={closeDetail} />
    </DashboardDetailModalContext.Provider>
  );
}

export function useDashboardDetailModal(): Ctx {
  const ctx = useContext(DashboardDetailModalContext);
  if (!ctx) {
    throw new Error("useDashboardDetailModal must be used inside DashboardDetailModalProvider");
  }
  return ctx;
}
