"use client";

import { Download } from "lucide-react";

export default function ExportPDFButton() {
  const handleExport = async () => {
    try {
      // Dynamically import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      // The element we want to capture
      const element = document.getElementById("dashboard-content");
      if (!element) {
        alert("Cannot find dashboard content to export.");
        return;
      }

      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`Hospital_Overview_${dateStr}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF", error);
    }
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center bg-[#1e40af] hover:bg-blue-800 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
      title="Export dashboard to PDF"
    >
      <Download size={16} className="mr-2" />
      Export to PDF
    </button>
  );
}
