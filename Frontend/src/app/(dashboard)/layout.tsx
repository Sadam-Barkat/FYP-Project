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
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-white dark:bg-gray-900 transition-colors">
      <TopNavBar
        rightSlot={
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <MobileNavDrawer />
            </div>
            <div className="hidden xl:block">
              <LiveClock />
            </div>
            <NavbarNotificationButton />
            <NavbarProfileButton />
            <ThemeToggle />
            <ExportPDFButton />
            <LogoutButton />
          </div>
        }
      />

      {/* Main content - only this area is captured for PDF export (no header/nav) */}
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f4f7fa] p-4 transition-colors dark:bg-gray-950 lg:p-6">
        <div id="pdf-export-content" className="min-h-full min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
