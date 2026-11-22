import PDFDocument from "pdfkit";
import path from "node:path";
export interface ReportSection {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
  summary?: string;
}
export async function createPDF(
  institution: string,
  title: string,
  sections: ReportSection[],
) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
      autoFirstPage: true,
      info: { Title: title, Author: institution },
      font:
        process.env.PDF_FONT_PATH ||
        path.join(
          process.cwd(),
          "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
        ),
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc
      .fontSize(10)
      .fillColor("#7860b9")
      .text(institution.toUpperCase(), 40, 40, { characterSpacing: 1.5 });
    doc.moveDown(0.8);
    doc.fontSize(23).fillColor("#2b2637").text(title);
    doc.moveDown(1);
    for (const [index, section] of sections.entries()) {
      if (index > 0) doc.addPage();
      doc.fontSize(14).fillColor("#393246").text(section.title);
      doc.moveDown(0.5);
      if (section.subtitle) {
        doc
          .fontSize(9)
          .fillColor("#777080")
          .text(section.subtitle, { lineGap: 4 });
        doc.moveDown(0.8);
      }
      const width = 515 / section.headers.length;
      function header() {
        const y = doc.y;
        doc.rect(40, y, 515, 24).fill("#f0edf7");
        section.headers.forEach((h, i) =>
          doc
            .fontSize(8)
            .fillColor("#655979")
            .text(h, 46 + i * width, y + 8, { width: width - 12 }),
        );
        doc.y = y + 30;
      }
      header();
      for (const row of section.rows) {
        doc.fontSize(8);
        const height = Math.max(
          24,
          ...row.map(
            (cell) =>
              doc.heightOfString(String(cell), { width: width - 12 }) + 16,
          ),
        );
        if (doc.y + height > 765) {
          doc.addPage();
          header();
        }
        // Split very long cell content into separate continuation rows rather than clipping.
        const y = doc.y;
        if (height > 650) {
          for (let i = 0; i < row.length; i++) {
            doc
              .fontSize(8)
              .fillColor("#777080")
              .text(`${section.headers[i]}: `, 40, doc.y, {
                continued: true,
                width: 515,
              });
            doc.fillColor("#352f40").text(row[i], { width: 515, lineGap: 3 });
          }
          doc.moveDown();
        } else {
          row.forEach((cell, i) =>
            doc
              .fontSize(8)
              .fillColor("#352f40")
              .text(String(cell), 46 + i * width, y + 7, { width: width - 12 }),
          );
          doc
            .moveTo(40, y + height)
            .lineTo(555, y + height)
            .strokeColor("#ebe7ef")
            .stroke();
          doc.y = y + height + 2;
        }
      }
      if (!section.rows.length)
        doc
          .fontSize(10)
          .fillColor("#777080")
          .text("No records in the selected period.");
      if (section.summary) {
        doc.moveDown();
        doc
          .fontSize(10)
          .fillColor("#655079")
          .text(section.summary, 40, doc.y, { width: 515 });
      }
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .fillColor("#96909e")
        .text(`${institution} | STAR SYSTEM`, 40, 791, { lineBreak: false });
      doc.text(`${i + 1} / ${range.count}`, 500, 791, {
        lineBreak: false,
        align: "right",
        width: 55,
      });
    }
    doc.end();
  });
}
