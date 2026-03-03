import { Bell, UserCircle } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import ExportPDFButton from "@/components/layout/ExportPDFButton";
import LogoutButton from "@/components/layout/LogoutButton";
import HeaderTitle from "@/components/layout/HeaderTitle";
import ThemeToggle from "@/components/layout/ThemeToggle";
import LiveClock from "@/components/layout/LiveClock";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm transition-colors">
          <HeaderTitle />
          
          <div className="flex items-center space-x-6">
            <LiveClock />
            
            <div className="flex items-center space-x-4 text-gray-700 dark:text-gray-300">
              <button className="hover:text-[#0066cc] dark:hover:text-[#60a5fa]"><Bell size={20} /></button>
              <button className="hover:text-[#0066cc] dark:hover:text-[#60a5fa]"><UserCircle size={20} /></button>
              <ThemeToggle />
            </div>
            
            <div className="flex items-center space-x-3">
              <ExportPDFButton />
              <LogoutButton />
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f4f7fa] dark:bg-gray-950 transition-colors">
          {children}
        </main>
      </div>
    </div>
  );
}
