"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";

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

  // Billing page: staff-style, no screenshot export. Finance role: no export on other admin routes either.
  const path = pathname ?? "";
  const showExport =
    (path.startsWith("/admin") || path.startsWith("/doctor")) &&
    role !== "finance" &&
    !path.startsWith("/admin/billing-finance");
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
      className="flex items-center bg-[#1e40af] hover:bg-blue-800 disabled:opacity-60 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm"
      title="Export current page to PDF (screenshot)"
    >
      <Download size={16} className="mr-2" />
      {loading ? "Exporting…" : "Export to PDF"}
    </button>
  );
}
