import ExportPDFButton from "@/components/layout/ExportPDFButton";
import LogoutButton from "@/components/layout/LogoutButton";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LiveClock from "@/components/layout/LiveClock";
import NavbarProfileButton from "@/components/layout/NavbarProfileButton";
import NavbarNotificationButton from "@/components/layout/NavbarNotificationButton";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";
import TopNavBar from "@/components/layout/TopNavBar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gray-50 text-gray-900 transition-colors dark:bg-base-bg dark:text-text-primary">
      <TopNavBar
        rightSlot={
          <>
            <MobileNavDrawer />
            <div className="hidden shrink-0 lg:flex lg:items-center">
              <LiveClock />
            </div>
            <NavbarNotificationButton />
            <NavbarProfileButton />
            <ThemeToggle />
            <ExportPDFButton />
            <LogoutButton />
          </>
        }
      />

      {/* Main content - only this area is captured for PDF export (no header/nav) */}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-3 pb-[max(12px,env(safe-area-inset-bottom))] transition-colors dark:bg-base-surface sm:p-4 lg:p-6">
        <div id="pdf-export-content" className="min-h-full min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
