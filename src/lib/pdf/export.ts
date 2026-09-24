// Client-side PDF export helper.
// Renders a DOM node to canvas via html2canvas-pro (a maintained fork of
// html2canvas that understands modern CSS color functions — oklch(),
// oklab(), lab(), lch(), color() — which this app's theme in
// src/styles.css relies on throughout; the original html2canvas 1.4.1
// throws "Attempting to parse an unsupported color function" on them) and
// writes a real, downloadable multi-page A4 PDF via jsPDF. Callers pass the
// element to snapshot and a filename.

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  if (typeof window === "undefined") return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png");

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  } else {
    // Slice the tall canvas across multiple A4 pages.
    const pxPerMm = canvas.width / imgWidth;
    const pageHeightPx = pageHeight * pxPerMm;
    let renderedPx = 0;
    let firstPage = true;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeightPx;
      const ctx = slice.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(
        canvas,
        0,
        renderedPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );
      const sliceData = slice.toDataURL("image/png");
      if (!firstPage) pdf.addPage();
      firstPage = false;
      pdf.addImage(
        sliceData,
        "PNG",
        0,
        0,
        imgWidth,
        (sliceHeightPx * imgWidth) / canvas.width,
      );
      renderedPx += sliceHeightPx;
    }
  }

  pdf.save(filename);
}

/**
 * Multi-page variant for pre-paginated reports: each element is one
 * A4-proportioned page (794×1123 CSS px) and is captured on its own, so
 * rows are never sliced across a page boundary and no single canvas grows
 * past mobile browsers' canvas-size limits on long reports.
 */
export async function exportPagesToPdf(pages: HTMLElement[], filename: string) {
  if (typeof window === "undefined" || pages.length === 0) return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    if (i > 0) pdf.addPage();
    // PNG pages are embedded near-uncompressed (~10 MB each at scale 2);
    // JPEG keeps a page to a few hundred kB with text still sharp.
    const data = canvas.toDataURL("image/jpeg", 0.9);
    pdf.addImage(data, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
  }

  pdf.save(filename);
}
