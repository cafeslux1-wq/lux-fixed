/**
 * ══════════════════════════════════════════════════════════
 *  LUX SUPREME — LAN Thermal Printing Service
 *
 *  Sends ESC/POS commands directly to network printers via TCP.
 *  Compatible with: Gainscha GA-E200I, Epson TM-T82, BIXOLON SRP-350
 *
 *  Routes:
 *    Receipt   → tenant.receipt_printer_ip:9100
 *    Kitchen   → tenant.kitchen_printer_ip:9100  (food items)
 *    Bar       → tenant.bar_printer_ip:9100       (drinks)
 *
 *  Fallback: If TCP fails, emits 'print:failed' socket event
 *            → Frontend catches it and does window.print() HTML receipt
 * ══════════════════════════════════════════════════════════
 */

import * as net from 'net';
import { query } from '../config/database';
import { logger } from '../utils/logger';

// ── ESC/POS command constants ──────────────────────────────────────────────
const ESC = 0x1b;
const GS  = 0x1d;
const FS  = 0x1c;

const CMD = {
  INIT:             Buffer.from([ESC, 0x40]),
  CUT:              Buffer.from([GS, 0x56, 0x41, 0x05]),    // partial cut + feed
  FEED:             Buffer.from([ESC, 0x64, 0x03]),           // feed 3 lines
  ALIGN_CENTER:     Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:       Buffer.from([ESC, 0x61, 0x00]),
  BOLD_ON:          Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:         Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_WIDTH:     Buffer.from([ESC, 0x21, 0x10]),
  DOUBLE_BOTH:      Buffer.from([ESC, 0x21, 0x30]),
  NORMAL_SIZE:      Buffer.from([ESC, 0x21, 0x00]),
  UNDERLINE_ON:     Buffer.from([ESC, 0x2d, 0x01]),
  UNDERLINE_OFF:    Buffer.from([ESC, 0x2d, 0x00]),
  INVERT_ON:        Buffer.from([GS, 0x42, 0x01]),
  INVERT_OFF:       Buffer.from([GS, 0x42, 0x00]),
  LINE_SPACING_SM:  Buffer.from([ESC, 0x33, 0x20]),
  LINE_SPACING_DEF: Buffer.from([ESC, 0x32]),
};

const PRINTER_PORT    = 9100;
const CONNECT_TIMEOUT = 5000;   // 5s — fail fast, never block POS
const WRITE_TIMEOUT   = 8000;

// ── Text encoding (basic Latin + French diacritics) ────────────────────────
function encodeText(text: string): Buffer {
  // ESC/POS code page 858 (Latin-9 / FR support)
  const buf = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    buf[i] = code > 127 ? (code & 0xff) : code;
  }
  return buf;
}

function textLine(text: string): Buffer {
  return Buffer.concat([encodeText(text), Buffer.from([0x0a])]);
}

function divider(char = '-', width = 48): Buffer {
  return textLine(char.repeat(width));
}

// ── Core TCP send ─────────────────────────────────────────────────────────
async function sendToTCP(ip: string, buffers: Buffer[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    const payload = Buffer.concat(buffers);
    let done      = false;

    const timeout = setTimeout(() => {
      if (!done) { done = true; socket.destroy(); reject(new Error(`Print timeout: ${label}`)); }
    }, WRITE_TIMEOUT);

    socket.setTimeout(CONNECT_TIMEOUT);

    socket.connect(PRINTER_PORT, ip, () => {
      socket.write(payload, (err) => {
        clearTimeout(timeout);
        done = true;
        socket.end();
        if (err) reject(err); else resolve();
      });
    });

    socket.on('timeout', () => {
      if (!done) { done = true; clearTimeout(timeout); socket.destroy(); reject(new Error(`Connect timeout: ${ip}`)); }
    });

    socket.on('error', (err) => {
      if (!done) { done = true; clearTimeout(timeout); reject(err); }
    });

    socket.on('close', () => {
      if (!done) { done = true; clearTimeout(timeout); resolve(); }
    });
  });
}

// ── Fetch printer IPs from DB ──────────────────────────────────────────────
interface PrinterConfig {
  receiptIp: string | null;
  kitchenIp: string | null;
  barIp:     string | null;
  venueName: string;
  address:   string;
  phone:     string;
  taxRate:   number;
}

async function getPrinterConfig(tenantId: string, branchId: string): Promise<PrinterConfig> {
  const result = await query<{
    receipt_printer_ip: string | null;
    kitchen_printer_ip: string | null;
    bar_printer_ip:     string | null;
    branch_name: string;
    address:     string | null;
    phone:       string | null;
    settings:    Record<string, unknown>;
    tenant_name: string;
  }>(`
    SELECT
      b.settings->>'receipt_printer_ip' AS receipt_printer_ip,
      b.settings->>'kitchen_printer_ip' AS kitchen_printer_ip,
      b.settings->>'bar_printer_ip'     AS bar_printer_ip,
      b.name    AS branch_name,
      b.address,
      b.phone,
      b.settings,
      t.name AS tenant_name
    FROM branches b
    JOIN tenants t ON t.id = b.tenant_id
    WHERE b.id = $1 AND b.tenant_id = $2
  `, [branchId, tenantId]);

  const row = result.rows[0];
  return {
    receiptIp: row?.receipt_printer_ip || null,
    kitchenIp: row?.kitchen_printer_ip || null,
    barIp:     row?.bar_printer_ip     || null,
    venueName: row?.tenant_name || 'Café LUX',
    address:   row?.address || '',
    phone:     row?.phone || '',
    taxRate:   (row?.settings?.tax_rate as number) || 0.10,
  };
}

// ════════════════════════════════════════════════════════════════════════
//  CUSTOMER RECEIPT
//  Triggered: POST /orders → payment confirmed
// ════════════════════════════════════════════════════════════════════════
export interface ReceiptData {
  tenantId:    string;
  branchId:    string;
  orderId:     string;
  orderNumber: number;
  tableNumber: string | null;
  source:      string;
  staffName:   string | null;
  items: Array<{
    name:      string;
    quantity:  number;
    unitPrice: number;
    modifiers?: Record<string, string>;
  }>;
  subtotal:        number;
  taxRate:         number;
  taxAmount:       number;
  discountAmount:  number;
  totalAmount:     number;
  paymentMethod:   string;
  paidAt:          string;
  ratingUrl:       string;   // QR code URL for rate-your-waiter
}

export async function printCustomerReceipt(data: ReceiptData): Promise<void> {
  const config = await getPrinterConfig(data.tenantId, data.branchId);
  if (!config.receiptIp) {
    logger.debug(`[Print] No receipt printer configured for branch ${data.branchId}`);
    return;
  }

  const WIDE = 48;
  const fmt  = (label: string, value: string, width = WIDE): Buffer => {
    const spaces = width - label.length - value.length;
    return textLine(label + ' '.repeat(Math.max(1, spaces)) + value);
  };

  const buffers: Buffer[] = [
    CMD.INIT,
    CMD.LINE_SPACING_SM,
    // ── Header ─────────────────────────────────────────────────────────
    CMD.ALIGN_CENTER,
    CMD.DOUBLE_BOTH,
    textLine(config.venueName),
    CMD.NORMAL_SIZE,
    CMD.BOLD_OFF,
    textLine(config.address),
    textLine(config.phone),
    Buffer.from([0x0a]),
    CMD.BOLD_ON,
    textLine('*** TICKET CLIENT ***'),
    CMD.BOLD_OFF,
    divider(),
    // ── Order meta ─────────────────────────────────────────────────────
    CMD.ALIGN_LEFT,
    fmt('Ticket N°:', `#${String(data.orderNumber).padStart(4, '0')}`),
    fmt('Date:',   new Date(data.paidAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit' })),
    data.tableNumber ? fmt('Table:', data.tableNumber) : Buffer.alloc(0),
    data.staffName   ? fmt('Serveur:', data.staffName)  : Buffer.alloc(0),
    divider(),
    // ── Items ───────────────────────────────────────────────────────────
    CMD.BOLD_ON,
    fmt('ARTICLE', 'TOTAL'),
    CMD.BOLD_OFF,
    divider(),
    ...data.items.flatMap(item => {
      const lineTotal  = (item.unitPrice * item.quantity).toFixed(2) + ' DH';
      const name       = item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name;
      const truncName  = name.length > WIDE - 12 ? name.slice(0, WIDE - 15) + '…' : name;
      const modLines   = Object.values(item.modifiers || {}).map(m => textLine(`    → ${m}`));
      return [fmt(truncName, lineTotal), ...modLines];
    }),
    divider(),
    // ── Totals ──────────────────────────────────────────────────────────
    fmt('Sous-total HT:', data.subtotal.toFixed(2) + ' DH'),
    fmt(`TVA (${(data.taxRate * 100).toFixed(0)}%):`, data.taxAmount.toFixed(2) + ' DH'),
    data.discountAmount > 0 ? fmt('Remise:', `-${data.discountAmount.toFixed(2)} DH`) : Buffer.alloc(0),
    CMD.BOLD_ON, CMD.DOUBLE_WIDTH,
    fmt('TOTAL TTC:', data.totalAmount.toFixed(2) + ' DH'),
    CMD.NORMAL_SIZE, CMD.BOLD_OFF,
    fmt('Règlement:', data.paymentMethod.toUpperCase()),
    divider(),
    // ── QR Rating ──────────────────────────────────────────────────────
    CMD.ALIGN_CENTER,
    textLine('Votre avis nous tient a coeur!'),
    textLine('Notez votre serveur sur:'),
    textLine(data.ratingUrl.slice(0, 40)),
    Buffer.from([0x0a]),
    // QR code via GS ( k command (model 2)
    buildQRCode(data.ratingUrl),
    Buffer.from([0x0a]),
    textLine('Merci et a bientot!'),
    textLine('    ★ Cafe LUX ★'),
    CMD.FEED,
    CMD.CUT,
  ];

  await sendToTCP(config.receiptIp, buffers, `Receipt #${data.orderNumber}`);
  logger.info(`[Print] ✅ Receipt #${data.orderNumber} → ${config.receiptIp}`);
}

// ════════════════════════════════════════════════════════════════════════
//  KITCHEN TICKET (food items, bold)
// ════════════════════════════════════════════════════════════════════════
export interface KitchenTicketData {
  tenantId:    string;
  branchId:    string;
  orderId:     string;
  tableNumber: string | null;
  source:      string;
  notes:       string | null;
  items: Array<{
    name:       string;
    quantity:   number;
    modifiers?: Record<string, string>;
    notes?:     string;
    category?:  string;  // 'drink' | 'food' — used for routing
  }>;
  createdAt: string;
  priority:  'normal' | 'urgent' | 'critical';
}

export async function printKitchenTickets(data: KitchenTicketData): Promise<void> {
  const config = await getPrinterConfig(data.tenantId, data.branchId);

  const foodItems  = data.items.filter(i => i.category !== 'drink');
  const drinkItems = data.items.filter(i => i.category === 'drink');

  await Promise.allSettled([
    config.kitchenIp && foodItems.length  ? buildAndSendTicket(config.kitchenIp, data, foodItems,  'CUISINE')  : Promise.resolve(),
    config.barIp     && drinkItems.length ? buildAndSendTicket(config.barIp,     data, drinkItems, 'BAR')      : Promise.resolve(),
    // If no routing configured, send all to kitchen
    !config.kitchenIp && !config.barIp    ? Promise.resolve()                                                  : Promise.resolve(),
  ]);
}

async function buildAndSendTicket(
  ip:       string,
  order:    KitchenTicketData,
  items:    KitchenTicketData['items'],
  station:  string,
): Promise<void> {
  const time = new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const priorityBanner = order.priority === 'critical'
    ? Buffer.concat([CMD.INVERT_ON, CMD.DOUBLE_BOTH, textLine('!! URGENT !!'), CMD.INVERT_OFF, CMD.NORMAL_SIZE])
    : Buffer.alloc(0);

  const buffers: Buffer[] = [
    CMD.INIT,
    CMD.ALIGN_CENTER,
    CMD.INVERT_ON,
    CMD.DOUBLE_BOTH,
    textLine(` ${station} `),
    CMD.INVERT_OFF,
    CMD.NORMAL_SIZE,
    priorityBanner,
    Buffer.from([0x0a]),
    CMD.ALIGN_LEFT,
    CMD.BOLD_ON, textLine(`Heure:  ${time}`),
    textLine(`Table:  ${order.tableNumber || order.source.toUpperCase()}`),
    CMD.BOLD_OFF,
    divider('='),
    // Items — large text
    CMD.DOUBLE_BOTH,
    CMD.BOLD_ON,
    ...items.flatMap(item => [
      textLine(`${item.quantity}x ${item.name}`),
      ...Object.values(item.modifiers || {}).map(m => {
        const smallBuf = [CMD.NORMAL_SIZE, CMD.BOLD_OFF, textLine(`   -> ${m}`), CMD.DOUBLE_BOTH, CMD.BOLD_ON];
        return Buffer.concat(smallBuf);
      }),
      item.notes ? Buffer.concat([CMD.NORMAL_SIZE, CMD.BOLD_OFF, textLine(`   [${item.notes}]`), CMD.DOUBLE_BOTH, CMD.BOLD_ON]) : Buffer.alloc(0),
    ]),
    CMD.NORMAL_SIZE,
    CMD.BOLD_OFF,
    divider('='),
    order.notes ? Buffer.concat([textLine(`NOTE: ${order.notes}`)]) : Buffer.alloc(0),
    CMD.FEED,
    CMD.CUT,
  ];

  await sendToTCP(ip, buffers, `${station} ticket`);
  logger.info(`[Print] ✅ ${station} ticket → ${ip} (${items.length} items)`);
}

// ── QR Code builder (ESC/POS model 2) ─────────────────────────────────────
function buildQRCode(data: string): Buffer {
  const store = Buffer.from(data, 'latin1');
  const pL    = (store.length + 3) & 0xff;
  const pH    = ((store.length + 3) >> 8) & 0xff;

  return Buffer.concat([
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),  // model 2
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]),          // size 6
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30]),          // error correction M
    Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),              // store data
    store,
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),          // print
  ]);
}

// ════════════════════════════════════════════════════════════════════════
//  HTML RECEIPT (Offline fallback — window.print() on frontend)
// ════════════════════════════════════════════════════════════════════════
export function buildHTMLReceipt(data: ReceiptData): string {
  const itemsHtml = data.items.map(item => `
    <tr>
      <td>${item.quantity}×&nbsp;${item.name}${
        Object.values(item.modifiers || {}).length
          ? `<small style="color:#666;display:block;margin-left:8px">${Object.values(item.modifiers!).join(', ')}</small>`
          : ''
      }</td>
      <td style="text-align:right">${(item.unitPrice * item.quantity).toFixed(2)} DH</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; color: #000; }
  h1 { text-align: center; font-size: 16px; margin: 4px 0; }
  .center { text-align: center; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  .total-row td { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; }
  .qr { text-align: center; margin: 8px 0; }
</style>
</head>
<body>
<h1>${data.staffName ? `★ Café LUX` : 'Café LUX'}</h1>
<p class="center">Ticket Client — #${String(data.orderId.slice(-4)).toUpperCase()}</p>
<p class="center">${new Date(data.paidAt).toLocaleString('fr-FR')}</p>
${data.tableNumber ? `<p class="center">Table: ${data.tableNumber}</p>` : ''}
<div class="divider"></div>
<table>${itemsHtml}</table>
<div class="divider"></div>
<table>
  <tr><td>Sous-total HT</td><td style="text-align:right">${data.subtotal.toFixed(2)} DH</td></tr>
  <tr><td>TVA (${(data.taxRate * 100).toFixed(0)}%)</td><td style="text-align:right">${data.taxAmount.toFixed(2)} DH</td></tr>
  ${data.discountAmount > 0 ? `<tr><td>Remise</td><td style="text-align:right">-${data.discountAmount.toFixed(2)} DH</td></tr>` : ''}
  <tr class="total-row"><td>TOTAL TTC</td><td style="text-align:right">${data.totalAmount.toFixed(2)} DH</td></tr>
</table>
<div class="divider"></div>
<p class="center">Merci et à bientôt!</p>
<p class="center">★ Café LUX ★</p>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
</body>
</html>`;
}
