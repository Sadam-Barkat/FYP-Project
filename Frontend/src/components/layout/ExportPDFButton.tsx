"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Download, FileText } from "lucide-react";

/** Element to capture: content only (no sidebar, no navbar). */
const PDF_EXPORT_ELEMENT_ID = "pdf-export-content";

export default function ExportPDFButton() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("admin");
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let r = sessionStorage.getItem("userRole");
    if (!r) {
      r = localStorage.getItem("userRole");
      if (r) sessionStorage.setItem("userRole", r);
    }
    if (r) setRole(r);
  }, []);

  const path = pathname ?? "";
  const showExport =
    (path.startsWith("/admin") || path.startsWith("/doctor")) && role !== "finance";
  if (!showExport) return null;

  const handleExport = async () => {
    try {
      setLoading(true);
      const element =
        document.getElementById(PDF_EXPORT_ELEMENT_ID) ||
        document.getElementById("dashboard-content") ||
        document.querySelector("main");
      if (!element) {
        alert("Could not find page content to export.");
        return;
      }

      document.body.classList.add("pdf-export-mode");
      await new Promise((r) => requestAnimationFrame(r));

      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: undefined,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const contentWidth = pdfWidth - 2 * margin;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdfHeight - 2 * margin;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, "PNG", margin, margin, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let page = 0;
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = canvas.width;
        sourceCanvas.height = Math.min(pageHeight * (canvas.width / imgWidth), canvas.height);
        const sourceCtx = sourceCanvas.getContext("2d");
        if (!sourceCtx) throw new Error("Could not get canvas context");
        let sourceY = 0;
        while (heightLeft > 0) {
          const sliceHeight = Math.min(pageHeight * (canvas.width / imgWidth), canvas.height - sourceY);
          sourceCanvas.height = sliceHeight;
          sourceCtx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
          const sliceData = sourceCanvas.toDataURL("image/png");
          const sliceDisplayHeight = (sliceHeight * imgWidth) / canvas.width;
          if (page > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", margin, margin, imgWidth, sliceDisplayHeight);
          heightLeft -= pageHeight * (canvas.width / imgWidth);
          sourceY += sliceHeight;
          page++;
        }
      }

      const dateStr = new Date().toISOString().split("T")[0];
      const path = pathname || "";
      const slug = path === "/admin" || path === "/admin/" ? "overview" : path.replace(/^\/(admin|doctor|nurse)\/?/, "").replace(/\//g, "_") || "page";
      pdf.save(`${slug}_${dateStr}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF", error);
      alert(error instanceof Error ? error.message : "Failed to export PDF.");
    } finally {
      document.body.classList.remove("pdf-export-mode");
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="group relative flex items-center justify-center overflow-hidden rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all duration-300 hover:bg-blue-700 hover:shadow-[0_4px_12px_rgba(37,99,235,0.35)] disabled:opacity-70 disabled:hover:shadow-[0_2px_8px_rgba(37,99,235,0.25)] dark:bg-btn-primary dark:text-text-bright dark:shadow-btn dark:hover:scale-[1.02] dark:hover:shadow-glow-blue disabled:hover:scale-100"
      title="Export current page to PDF (screenshot)"
    >
      <div className="absolute inset-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {loading ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>Exporting...</span>
        </>
      ) : (
        <>
          <FileText size={15} className="mr-1.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span>Export PDF</span>
        </>
      )}
    </button>
  );
}
