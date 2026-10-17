import PDFDocument from 'pdfkit';
import { getNakshatraByKey } from './nakshatra';

export interface ReceiptData {
  offeringRef:  string;
  devoteeName:  string;
  nakshatraKey: string;
  purpose:      string;
  amountPaise:  number;
  createdAt:    string; // ISO
  paymentId:    string;
}

const RED   = '#7a1912';
const GOLD  = '#d4a574';
const DARK  = '#2d1810';
const MUTED = '#5e4334';

export function generateReceiptPDF(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [595, 420], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595, H = 420, M = 24;

    // Decorative double border
    doc.rect(M, M, W - 2 * M, H - 2 * M).lineWidth(2).stroke(RED);
    doc.rect(M + 5, M + 5, W - 2 * M - 10, H - 2 * M - 10).lineWidth(0.75).stroke(GOLD);

    let y = M + 20;

    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
      .text('On behalf of Ambotti Thampuran, Shankarodath Kovilakam', M, y, { width: W - 2 * M, align: 'center' });
    y += 16;

    doc.fillColor(RED).font('Helvetica-Bold').fontSize(20)
      .text('Sree Pulikkal Vishwanagayakshi Temple', M, y, { width: W - 2 * M, align: 'center' });
    y += 26;

    doc.fillColor(MUTED).font('Helvetica').fontSize(8)
      .text('Reg. No: 222/IV/2023', M, y, { width: W - 2 * M, align: 'center' });
    y += 12;
    doc.text('Thekkumpuram, Kavilpad, Olavakkode, Palakkad - 678012, Kerala', M, y, { width: W - 2 * M, align: 'center' });
    y += 11;
    doc.text('Phone: 0491 2552910, +91 9946373522  |  Email: pulikkalvishwanagayakshitemple@gmail.com', M, y, { width: W - 2 * M, align: 'center' });
    y += 18;

    doc.moveTo(M + 15, y).lineTo(W - M - 15, y).lineWidth(0.5).stroke(GOLD);
    y += 14;

    const col1X = M + 20, col2X = W / 2 + 10;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('Deity:', col1X, y);
    doc.font('Helvetica').fontSize(9).fillColor(DARK)
      .text('Vishwanagayakshiamma, Nagaraja & Sarpayakshiamma', col1X + 45, y, { width: col2X - col1X - 55 });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('Receipt No:', col2X, y);
    doc.font('Helvetica').fontSize(9).fillColor(DARK).text(data.offeringRef, col2X + 65, y);
    y += 20;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('Offering:', col1X, y);
    doc.font('Helvetica').fontSize(9).fillColor(DARK)
      .text(data.purpose, col1X + 45, y, { width: col2X - col1X - 55 });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('Date:', col2X, y);
    doc.font('Helvetica').fontSize(9).fillColor(DARK).text(
      new Date(data.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      col2X + 65, y
    );
    y += 26;

    const tableX = M + 15, tableW = W - 2 * M - 30, rowH = 22;
    const cols = [
      { label: 'Name',        w: 0.32 },
      { label: 'Nakshatra',   w: 0.22 },
      { label: 'Qty',         w: 0.10 },
      { label: 'Rate (₹)',   w: 0.16 },
      { label: 'Amount (₹)', w: 0.20 },
    ];

    doc.rect(tableX, y, tableW, rowH).fill(RED);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    let cx = tableX;
    cols.forEach(c => {
      const w = tableW * c.w;
      doc.text(c.label, cx + 6, y + 6, { width: w - 10 });
      cx += w;
    });
    y += rowH;

    const amount = (data.amountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const nakshatra = getNakshatraByKey(data.nakshatraKey)?.sanskrit ?? data.nakshatraKey;
    const rowVals = [data.devoteeName, nakshatra, '1', amount, amount];

    doc.rect(tableX, y, tableW, rowH).lineWidth(0.5).stroke(GOLD);
    doc.fillColor(DARK).font('Helvetica').fontSize(9);
    cx = tableX;
    cols.forEach((c, i) => {
      const w = tableW * c.w;
      doc.text(rowVals[i], cx + 6, y + 6, { width: w - 10 });
      cx += w;
    });
    y += rowH + 12;

    doc.font('Helvetica-Bold').fontSize(11).fillColor(RED)
      .text(`Total Amount: ₹${amount} (Rupees ${amount} only)`, tableX, y, { width: tableW, align: 'right' });

    doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED)
      .text('This is a digitally generated receipt and does not require a physical signature.', M, H - M - 36, { width: W - 2 * M, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`Payment ID: ${data.paymentId}`, M, H - M - 24, { width: W - 2 * M, align: 'center' });
    doc.text(`Generated on ${new Date().toLocaleString('en-IN')}`, M, H - M - 12, { width: W - 2 * M, align: 'center' });

    doc.end();
  });
}
