import { Bell, UserCircle, Moon } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import ExportPDFButton from "@/components/layout/ExportPDFButton";
import LogoutButton from "@/components/layout/LogoutButton";
import HeaderTitle from "@/components/layout/HeaderTitle";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <HeaderTitle />
          
          <div className="flex items-center space-x-6">
            <span className="text-sm font-semibold text-gray-800 hidden sm:block">Real-Time Dash</span>
            
            <div className="flex items-center space-x-4 text-gray-700">
              <button className="hover:text-[#0066cc]"><Bell size={20} /></button>
              <button className="hover:text-[#0066cc]"><UserCircle size={20} /></button>
              <button className="hover:text-[#0066cc]"><Moon size={20} /></button>
            </div>
            
            <div className="flex items-center space-x-3">
              <ExportPDFButton />
              <LogoutButton />
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f4f7fa]">
          {children}
        </main>
      </div>
    </div>
  );
}
