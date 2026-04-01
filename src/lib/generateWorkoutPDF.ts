import { jsPDF } from 'jspdf';

export interface TareaParaPDF {
  id: string;
  nombre: string;
  objetivo: string[] | string;
  metros: number;
  material: string;
  descripcion?: string;
}

export interface WorkoutParaPDF {
  titulo: string;
  comentarios?: string;
}

// ── Paleta ────────────────────────────────────────────────────────────────────
const OCEAN_BLUE: [number, number, number]  = [2,   132, 199];  // #0284c7
const OCEAN_DARK: [number, number, number]  = [12,  74,  110];  // #0c4a6e
const ACCENT_BAR: [number, number, number]  = [2,   132, 199];  // barra azul
const BG_PAGE:    [number, number, number]  = [248, 250, 252];  // slate-50 — fondo sutil
const WHITE:      [number, number, number]  = [255, 255, 255];
const ROW_ALT:    [number, number, number]  = [237, 245, 252];  // azul muy pálido
const GRAY:       [number, number, number]  = [100, 100, 100];
const GRAY_LIGHT: [number, number, number]  = [160, 160, 160];

// ── Tipografía / layout ───────────────────────────────────────────────────────
const MARGIN_X   = 15;
const HEADER_H   = 28;   // altura del header blanco con logo + texto contacto
const ACCENT_H   =  2;   // franja azul separadora
const FONT_BODY  =  8.5;
const FONT_HDR   =  8.5;
const ROW_MIN_H  =  8;

// Anchos de columna en mm — total = 180 (210 - 15*2)
const COL = {
  num:      8,
  tarea:   90,
  objetivo: 25,
  metros:   17,
  material: 40,
};
const TABLE_X   = MARGIN_X;
const CONTENT_W = COL.num + COL.tarea + COL.objetivo + COL.metros + COL.material; // 180

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror  = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getObjText(objetivo: string[] | string): string {
  return Array.isArray(objetivo) ? objetivo.join(', ') : (objetivo ?? '');
}

/**
 * Rellena el fondo de toda la página con el color BG_PAGE (slate-50).
 * Se llama tanto en la primera página como en cada nueva.
 */
function fillPageBackground(pdf: jsPDF, pageW: number, pageH: number) {
  pdf.setFillColor(...BG_PAGE);
  pdf.rect(0, 0, pageW, pageH, 'F');
}

/**
 * Genera el PDF del workout y devuelve un blob: URL utilizable en iframes.
 * El caller es responsable de llamar URL.revokeObjectURL() cuando ya no lo necesite.
 */
export async function generateWorkoutPDF(
  workout: WorkoutParaPDF,
  tareas: TareaParaPDF[],
  objetivo: string,
  material: string,
  metros: number,
): Promise<string> {
  const pdf  = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  // ── FONDO DE PÁGINA ──────────────────────────────────────────────────────────
  fillPageBackground(pdf, pageW, pageH);

  // ── HEADER — fondo BLANCO para que el logo negro resalte ────────────────────
  pdf.setFillColor(...WHITE);
  pdf.rect(0, 0, pageW, HEADER_H, 'F');

  // Logo (izquierda) ─────────────────────────────────────────────────────────
  const heroB64 = await loadImageAsBase64('/Hero.JPEG');
  if (heroB64) {
    // Leer dimensiones reales de la imagen para respetar el aspect ratio
    const imgEl = new Image();
    await new Promise<void>((res) => {
      imgEl.onload  = () => res();
      imgEl.onerror = () => res();
      imgEl.src = heroB64;
    });

    const naturalW = imgEl.naturalWidth  || 1190;
    const naturalH = imgEl.naturalHeight || 950;
    const aspect   = naturalW / naturalH;

    // La imagen ocupa ~40 % del ancho del header, centrada verticalmente
    const maxImgH = HEADER_H - 6;   // padding 3mm arriba/abajo
    const maxImgW = pageW * 0.42;
    let imgH = maxImgH;
    let imgW = imgH * aspect;
    if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / aspect; }

    const imgX = MARGIN_X;
    const imgY = (HEADER_H - imgH) / 2;
    pdf.addImage(heroB64, 'JPEG', imgX, imgY, imgW, imgH);
  } else {
    // Fallback texto si no carga la imagen
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...OCEAN_DARK);
    pdf.text('VideoAnalisis', MARGIN_X, HEADER_H / 2 + 2);
  }

  // Texto de contacto (derecha, alineado al margen derecho) ──────────────────
  const contactLines = [
    'Entrenamiento diseñado por Pablo Rodríguez Madurga',
    '@videoanalisis_natacion',
    'Tlf: 638 285 938',
  ];
  const contactX = pageW - MARGIN_X;
  const contactStartY = (HEADER_H - contactLines.length * 4) / 2 + 3.5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.8);
  pdf.setTextColor(...OCEAN_DARK);
  pdf.text(contactLines[0], contactX, contactStartY, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...OCEAN_BLUE);
  pdf.text(contactLines[1], contactX, contactStartY + 4, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.setTextColor(...GRAY);
  pdf.text(contactLines[2], contactX, contactStartY + 8, { align: 'right' });

  // Franja azul separadora ───────────────────────────────────────────────────
  pdf.setFillColor(...ACCENT_BAR);
  pdf.rect(0, HEADER_H, pageW, ACCENT_H, 'F');

  // ── TÍTULO DEL WORKOUT ───────────────────────────────────────────────────────
  let y = HEADER_H + ACCENT_H + 9;

  pdf.setFontSize(16);
  pdf.setTextColor(...OCEAN_DARK);
  pdf.setFont('helvetica', 'bold');
  pdf.text(workout.titulo, MARGIN_X, y);

  y += 6;

  // Línea de resumen
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  const summary = `Objetivo: ${objetivo}   ·   ${metros}m totales   ·   ${material}`;
  pdf.text(summary, MARGIN_X, y);

  y += 4;

  // Línea separadora delgada azul
  pdf.setDrawColor(...OCEAN_BLUE);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_X, y, pageW - MARGIN_X, y);

  y += 7;

  // ── TABLA DE EJERCICIOS ──────────────────────────────────────────────────────

  // Dibuja la cabecera de la tabla y devuelve la Y tras ella
  const drawTableHeader = (yH: number): number => {
    const h = 6.5;
    pdf.setFillColor(...OCEAN_DARK);
    pdf.rect(TABLE_X, yH, CONTENT_W, h, 'F');

    pdf.setFontSize(FONT_HDR);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...WHITE);

    const ty = yH + h - 1.5;
    let cx = TABLE_X;

    pdf.text('#',        cx + COL.num / 2,            ty, { align: 'center' });
    cx += COL.num;
    pdf.text('TAREA',    cx + 2,                      ty);
    cx += COL.tarea;
    pdf.text('OBJETIVO', cx + 2,                      ty);
    cx += COL.objetivo;
    pdf.text('METROS',   cx + COL.metros / 2,         ty, { align: 'center' });
    cx += COL.metros;
    pdf.text('MATERIAL', cx + 2,                      ty);

    return yH + h;
  };

  y = drawTableHeader(y);

  // Filas de ejercicios ───────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'normal');

  tareas.forEach((tarea, idx) => {
    const objText = getObjText(tarea.objetivo);
    const matText = tarea.material || '-';

    pdf.setFontSize(FONT_BODY);
    const nombreLines = pdf.splitTextToSize(tarea.nombre, COL.tarea - 4);
    const objLines    = pdf.splitTextToSize(objText, COL.objetivo - 3);
    const matLines    = pdf.splitTextToSize(matText, COL.material - 3);

    const maxLines = Math.max(nombreLines.length, objLines.length, matLines.length);
    const rowH     = Math.max(ROW_MIN_H, maxLines * 4.2 + 3);

    // Salto de página
    if (y + rowH > pageH - 18) {
      pdf.addPage();
      fillPageBackground(pdf, pageW, pageH);
      y = 15;
      y = drawTableHeader(y);
    }

    // Fondo de fila alternado — blanco o azul muy pálido
    pdf.setFillColor(...(idx % 2 === 0 ? WHITE : ROW_ALT));
    pdf.rect(TABLE_X, y, CONTENT_W, rowH, 'F');

    // Borde inferior
    pdf.setDrawColor(210, 225, 235);
    pdf.setLineWidth(0.15);
    pdf.line(TABLE_X, y + rowH, TABLE_X + CONTENT_W, y + rowH);

    // Centrado vertical del texto
    const lineH     = 4.2;
    const textY     = y + (rowH - nombreLines.length * lineH) / 2 + lineH;

    // # ── número azul bold
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(FONT_BODY);
    pdf.setTextColor(...OCEAN_BLUE);
    pdf.text(String(idx + 1), TABLE_X + COL.num / 2, y + rowH / 2 + 1.5, { align: 'center' });

    // Tarea ── nombre multilinea
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...OCEAN_DARK);
    let cx = TABLE_X + COL.num + 2;
    pdf.text(nombreLines, cx, textY);

    // Objetivo
    pdf.setTextColor(...GRAY);
    cx = TABLE_X + COL.num + COL.tarea + 2;
    const objTextY = y + (rowH - objLines.length * lineH) / 2 + lineH;
    pdf.text(objLines, cx, objTextY);

    // Metros ── azul bold centrado
    cx = TABLE_X + COL.num + COL.tarea + COL.objetivo;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...OCEAN_BLUE);
    pdf.text(`${tarea.metros}m`, cx + COL.metros / 2, y + rowH / 2 + 1.5, { align: 'center' });

    // Material
    cx = TABLE_X + COL.num + COL.tarea + COL.objetivo + COL.metros + 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY);
    const matTextY = y + (rowH - matLines.length * lineH) / 2 + lineH;
    pdf.text(matLines, cx, matTextY);

    // Separadores verticales
    pdf.setDrawColor(200, 218, 230);
    pdf.setLineWidth(0.2);
    let lx = TABLE_X + COL.num;
    [COL.tarea, COL.objetivo, COL.metros].forEach((w) => {
      pdf.line(lx, y, lx, y + rowH);
      lx += w;
    });

    y += rowH;
  });

  // Borde izquierdo y derecho de toda la tabla (estético)
  // (Omitido intencionalmente — las filas ya dan estructura suficiente)

  // ── COMENTARIOS / NOTAS ──────────────────────────────────────────────────────
  if (workout.comentarios?.trim()) {
    y += 7;
    if (y > pageH - 35) {
      pdf.addPage();
      fillPageBackground(pdf, pageW, pageH);
      y = 20;
    }

    // Caja con fondo azul pálido
    const wrapped   = pdf.splitTextToSize(workout.comentarios, CONTENT_W - 8);
    const boxH      = wrapped.length * 5 + 10;

    pdf.setFillColor(229, 242, 251);
    pdf.setDrawColor(...OCEAN_BLUE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 2, 2, 'FD');

    // Barra izquierda de acento
    pdf.setFillColor(...OCEAN_BLUE);
    pdf.rect(MARGIN_X, y, 2, boxH, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...OCEAN_DARK);
    pdf.text('Notas del entrenador', MARGIN_X + 5, y + 6);

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(50, 70, 90);
    pdf.text(wrapped, MARGIN_X + 5, y + 12);

    y += boxH + 4;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const applyFooter = (pageIndex: number) => {
    const footerY = pageH - 10;

    // Franja azul en el pie
    pdf.setFillColor(...OCEAN_DARK);
    pdf.rect(0, pageH - 7, pageW, 7, 'F');

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...WHITE);
    pdf.text('VideoAnalisis — Natación', MARGIN_X, pageH - 3);
    pdf.text(
      new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      pageW - MARGIN_X,
      pageH - 3,
      { align: 'right' },
    );
  };

  // Aplicar footer en todas las páginas
  const totalPages = (pdf.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    applyFooter(i);
  }

  // ── BLOB URL ─────────────────────────────────────────────────────────────────
  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}
