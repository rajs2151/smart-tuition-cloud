// Client-side PDF export helper.
// Renders a DOM node to canvas via html2canvas and writes a real, downloadable
// multi-page A4 PDF via jsPDF. Callers pass the element to snapshot and a
// filename.

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  if (typeof window === "undefined") return;
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
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
