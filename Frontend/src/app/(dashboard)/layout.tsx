import Sidebar from "@/components/layout/Sidebar";
import ExportPDFButton from "@/components/layout/ExportPDFButton";
import LogoutButton from "@/components/layout/LogoutButton";
import HeaderTitle from "@/components/layout/HeaderTitle";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LiveClock from "@/components/layout/LiveClock";
import NavbarProfileButton from "@/components/layout/NavbarProfileButton";
import NavbarNotificationButton from "@/components/layout/NavbarNotificationButton";
import MobileNavDrawer from "@/components/layout/MobileNavDrawer";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-white dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      <Sidebar />
      
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="z-10 flex shrink-0 flex-col gap-2 border-b border-gray-200 bg-white px-3 py-2 shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2 sm:px-4 md:min-h-16 md:px-6 md:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <MobileNavDrawer />
            <HeaderTitle />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2 sm:justify-end md:gap-x-4">
            <LiveClock />

            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-gray-700 dark:text-gray-300 sm:gap-x-3">
              <NavbarNotificationButton />
              <NavbarProfileButton />
              <ThemeToggle />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
              <ExportPDFButton />
              <LogoutButton />
            </div>
          </div>
        </header>
        
        {/* Main content - only this area is captured for PDF export (no sidebar, no header) */}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f4f7fa] p-3 transition-colors dark:bg-gray-950 sm:p-4 md:p-6">
          <div id="pdf-export-content" className="min-h-full min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
