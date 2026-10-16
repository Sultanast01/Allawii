import { DEFAULT_CATEGORIES } from '../types';
import type { CategoryConfig } from '../types';

export interface ParsedRow {
  date: string;
  description: string;
  /** Naira — convert with nairaToKobo before storing. */
  amount: number;
  type: 'income' | 'expense';
  category: CategoryConfig;
  duplicate: boolean;
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ExtractedReceipt {
  merchant: string;
  date: string;
  total: number;
  items: ReceiptItem[];
}

const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/fuel|petrol|bus|taxi|keke|okada|uber|bolt|transport|trip|fare/i, 'transport'],
  [/data|airtime|mtn|glo\b|airtel|9mobile|recharge|subscri|netflix|spotify|youtube|vtn/i, 'data_airtime'],
  [/rent|lease/i, 'rent'],
  [/school|fees|tuition|dues|department|lecture fee/i, 'school_fees'],
  [/book|print|photocopy|binding|lab coat|stationery|handout/i, 'academics'],
  [/food|meal|grocer|rice|beans|yam|garri|market|eat|restaur|catering|provision|snack|drink|water/i, 'food'],
  [/loan|debt|repay|owe|payback/i, 'debt'],
  [/family|parents|home support|mummy|daddy|pocket money/i, 'family'],
  [/game|gaming|casino|bets|entertain|party|club/i, 'entertainment'],
  [/shop|cloth|shoe|store|mall|outfit/i, 'shopping'],
  [/light|elec|neon|power|gen\d|generator|water roll/i, 'utilities'],
];

export function suggestCategory(text: string): CategoryConfig {
  const id = CATEGORY_KEYWORDS.find(([re]) => re.test(text))?.[1];
  return DEFAULT_CATEGORIES.find(c => c.id === id)
    || DEFAULT_CATEGORIES.find(c => c.id === 'other_expense')
    || DEFAULT_CATEGORIES[0];
}

/** Split a delimited row, honouring "quoted, cells" and auto-detecting semicolon files. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === delimiter && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out.map(c => c.replace(/^"|"$/g, '').trim());
}

function delimiterOf(line: string): string {
  const commas = (line.match(/,/g) || []).length;
  const semicolons = (line.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

/** A cell that is only money: "1,250.50", "₦2,800", "-500", "(500)", "500 Cr". Returns naira, negative when the row says so. */
export function parseMoneyCell(raw: string): number | null {
  const cell = raw.replace(/["₦$]/g, '').trim();
  if (!cell) return null;
  const suffix = cell.match(/[+-]?(cr|dr)$/i);
  const body = (suffix ? cell.slice(0, cell.length - suffix[0].length) : cell).trim();
  const cleaned = body.replace(/[\s()]/g, '');
  // European style "1.250,50" uses a dot for thousands and a comma for cents.
  const european = /^\d{1,3}(?:[.]\d{3})+,\d{2}$/.test(cleaned);
  const digits = (european ? cleaned.replace(/[.]/g, '').replace(',', '.') : cleaned.replace(/,/g, '')).replace(/^[-+]/, '');
  if (!/^\d+(\.\d{1,2})?$/.test(digits)) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value === 0) return null;
  const negative = /^\(.*\)$/.test(body) || body.startsWith('-') || /dr$/i.test(suffix?.[1] || '');
  return negative ? -value : value;
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';

/** Day-first dates, because Nigerian statements write 05/10/2026 as the 5th of October. */
export function parseDateCell(raw: string): string | null {
  const cell = raw.replace(/["]/g, '').trim();
  if (!cell) return null;
  const iso = cell.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return toIso(+iso[1], +iso[2], +iso[3]);
  const dmy = cell.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/);
  if (dmy) {
    let [, d, m, yRaw] = dmy;
    let year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    let day = Number(d);
    let month = Number(m);
    // "10/2026" style is impossible; if the first slot cannot be a day it is month-first.
    if (day > 12 && month <= 12) { /* day first, already correct */ }
    else if (month > 12 && day <= 12) { [day, month] = [month, day]; }
    return toIso(year, month, day);
  }
  const textMonth = cell.match(new RegExp(`^(\\d{1,2})[-. ](${MONTHS})[a-z]*[-. ](\\d{2,4})`, 'i'));
  if (textMonth) {
    const monthIndex = MONTHS.split('|').findIndex(short => cell.toLowerCase().includes(short)) + 1;
    const y = textMonth[3].length === 2 ? 2000 + Number(textMonth[3]) : Number(textMonth[3]);
    return toIso(y, monthIndex, Number(textMonth[1]));
  }
  const fallback = new Date(cell);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString().slice(0, 10);
}

function toIso(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const HEADER_PATTERNS: [RegExp, 'date' | 'description' | 'debit' | 'credit' | 'amount' | 'category'][] = [
  [/^(txn\s*)?(transaction\s*)?date(s)?\b|^value\s*date|^posted\b|^time$/i, 'date'],
  [/^(narration|description|details|remarks|particulars|memo|item)\b/i, 'description'],
  [/^(debit|withdrawal|paid\s*out|withdrawn|dr)\b/i, 'debit'],
  [/^(credit|pay\s*in|paid\s*in|deposit|cr)\b/i, 'credit'],
  [/^(amount|amt|value)\b/i, 'amount'],
  [/^(category|type)\b/i, 'category'],
];

function headerRoles(cells: string[]): Partial<Record<'date' | 'description' | 'debit' | 'credit' | 'amount' | 'category', number>> {
  const roles: Partial<Record<'date' | 'description' | 'debit' | 'credit' | 'amount' | 'category', number>> = {};
  let matches = 0;
  cells.forEach((cell, index) => {
    const hit = HEADER_PATTERNS.find(([re]) => re.test(cell));
    if (!hit) return;
    if (roles[hit[1]] === undefined) { roles[hit[1]] = index; matches++; }
  });
  return matches >= 2 ? roles : {};
}

function firstDateCell(cells: string[]): { index: number; iso: string } {
  for (let i = 0; i < cells.length; i++) {
    const iso = parseDateCell(cells[i]);
    if (iso) return { index: i, iso };
  }
  return { index: -1, iso: new Date().toISOString().slice(0, 10) };
}

/**
 * Statement rows come from banks with different column orders, so headers are mapped by name
 * and a headerless file is read as the documented `date, description, amount`.
 */
export function parseStatement(text: string, existing: { date: string; description: string; amountInKobo: number }[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = delimiterOf(lines[0]);
  const roles = headerRoles(splitLine(lines[0], delimiter));
  const body = roles.date !== undefined || roles.amount !== undefined || roles.description !== undefined ? lines.slice(1) : lines;

  const rows: ParsedRow[] = [];
  for (const line of body) {
    const cells = splitLine(line, delimiter);
    if (cells.length < 2) continue;

    const date = roles.date !== undefined
      ? { index: roles.date, iso: parseDateCell(cells[roles.date] || '') || new Date().toISOString().slice(0, 10) }
      : firstDateCell(cells);

    let type: ParsedRow['type'] = 'expense';
    let naira: number | null = null;
    let amountIndex = -1;

    const debit = roles.debit !== undefined ? parseMoneyCell(cells[roles.debit] || '') : null;
    const credit = roles.credit !== undefined ? parseMoneyCell(cells[roles.credit] || '') : null;
    if (debit !== null) {
      naira = Math.abs(debit);
      amountIndex = roles.debit!;
    } else if (credit !== null) {
      naira = Math.abs(credit);
      type = 'income';
      amountIndex = roles.credit!;
    } else {
      const candidates: [number, string | undefined][] = roles.amount !== undefined
        ? [[roles.amount, cells[roles.amount]]]
        : cells.map((cell, index): [number, string | undefined] => [index, cell]).reverse();
      for (const [index, cell] of candidates) {
        if (index === date.index) continue;
        const signed = parseMoneyCell(cell || '');
        if (signed === null) continue;
        naira = Math.abs(signed);
        amountIndex = index;
        type = creditIncomeCell(cell || '') || /credit|cr\b|paid in|salary|allowance|received|refund|deposit|transfer in/i.test(line) ? 'income' : 'expense';
        break;
      }
    }
    if (naira === null || naira === 0) continue;

    const categoryCell = roles.category !== undefined ? cells[roles.category] || '' : '';
    const descriptionIndex = roles.description !== undefined
      ? roles.description
      : cells.findIndex((c, i) => i !== date.index && i !== amountIndex && /[A-Za-z]{2,}/.test(c) && parseMoneyCell(c) === null);
    const description = ((cells[descriptionIndex] || '').trim() || categoryCell || 'Imported entry')
      .replace(/^["']+|["']+$/g, '')
      .slice(0, 200);

    const amountInKobo = Math.round(naira * 100);
    rows.push({
      date: date.iso,
      description,
      amount: naira,
      type,
      category: suggestCategory(`${categoryCell} ${description}`),
      duplicate: existing.some(t => t.amountInKobo === amountInKobo && t.description.toLowerCase() === description.toLowerCase()),
    });
  }
  return rows;
}

function creditIncomeCell(cell: string): boolean {
  return /^\+/.test(cell.trim()) || /\+[dD][rR]$/.test(cell.trim());
}

/** Trailing amount on a receipt line: "RICE 5KG   2,800.00" → 2800.00. A lone small number is a table or serial, not a price. */
const RECEIPT_AMOUNT_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{3,}(?:\.\d{1,2})?|\d*\.\d{2})\s*$/;
/** Lines that are housekeeping, not purchases. */
const RECEIPT_SKIP_RE = /(sub\s*-?\s*total|\bvat\b|\btax\b|\bcash\b|\bchange\b|balance|discount|\btel\b|phone|\btotal\b|amount\s*due|thank|receipt no|invoice|till|terms|sponsored|e&oe|sales agent|attendant|bless you|welcome)/i;
/** Reference-ish labels: the number after them is never a price. */
const RECEIPT_REF_RE = /\b(no|num|number|ref|txn|tran[sc]tion|serial|bar\s?code|card|acct|account|pos|slip|e-invoice|member|loyalty|points|item\s?code|sku|product\s?code)\b[:.\s-]*$/i;

function looksLikeDate(text: string): boolean {
  return /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(text) || /\b\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\b/.test(text);
}

export function parseReceipt(text: string): ExtractedReceipt {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const merchant = (lines.find(l => (l.match(/[A-Za-z]/g) || []).length >= 3 && !RECEIPT_AMOUNT_RE.test(l) && !looksLikeDate(l)) || 'Unknown merchant')
    .replace(/^[-*=•.\s]+|[-*=•.\s]+$/g, '')
    .slice(0, 40);

  let total = 0;
  for (const line of lines) {
    if (/\btotal\b/i.test(line) && !/sub\s*-?\s*total/i.test(line)) {
      const m = line.match(RECEIPT_AMOUNT_RE);
      if (m) {
        const value = Number(m[1].replace(/,/g, ''));
        if (Number.isFinite(value) && value > 0) { total = value; break; }
      }
    }
  }

  const items: ReceiptItem[] = [];
  for (const line of lines) {
    const m = line.match(RECEIPT_AMOUNT_RE);
    if (!m || m.index === undefined) continue;
    if (RECEIPT_SKIP_RE.test(line) || looksLikeDate(line)) continue;
    if (RECEIPT_REF_RE.test(line.slice(0, m.index))) continue;
    const name = line.slice(0, m.index).replace(/[\s.\-•*=:]+$/g, '').trim();
    // A price needs something to attach to: barcodes, phone digits and dates have no real name.
    if ((name.match(/[A-Za-z]/g) || []).length < 3) continue;
    const price = Number(m[1].replace(/,/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;
    if (m[1].replace(/[.,]/g, '').length > 7) continue;
    // Nothing on a receipt can cost more than the bill itself (plus rounding tolerance).
    if (total > 0 && price > total * 1.2) continue;
    items.push({ name: name.slice(0, 60), price });
  }

  // Duplicate lines ("TOTAL 2,800" echoed under a subtotal) are the same purchase twice.
  const seen = new Set<string>();
  let unique = items.filter(item => {
    const key = `${item.name.toLowerCase()}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // A crumpled receipt often only gives up its total — still worth one editable line.
  if (unique.length === 0 && total > 0) unique = [{ name: `${merchant} purchase`, price: total }];

  return {
    merchant,
    date: receiptDate(text) || new Date().toISOString().slice(0, 10),
    total,
    items: unique,
  };
}

function receiptDate(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const dated = lines.find(l => /\bdate\b/i.test(l)) || '';
  return parseDateCell((dated.match(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/) || [''])[0])
    || parseDateCell((text.match(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}/) || [''])[0]);
}
