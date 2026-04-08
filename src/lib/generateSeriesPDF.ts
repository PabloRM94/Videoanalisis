import { jsPDF } from 'jspdf';

export interface SerieData {
  distancia: number;
  tiempos: { repeticion: number; tiempo: number }[];
}

export interface SesionSeries {
  distancia: number;
  tiempos: { repeticion: number; tiempo: number }[];
  mejorTiempo: number;
  fecha: Date;
}

const OCEAN_BLUE: [number, number, number]  = [2,   132, 199];
const OCEAN_DARK: [number, number, number]  = [12,  74,  110];
const ACCENT_BAR: [number, number, number]  = [2,   132, 199];
const BG_PAGE:    [number, number, number]  = [241, 245, 249];
const WHITE:      [number, number, number]  = [255, 255, 255];
const ROW_ALT:    [number, number, number]  = [237, 245, 252];
const GRAY:       [number, number, number]  = [100, 100, 100];

const MARGIN_X   = 15;
const HEADER_H   = 28;
const ACCENT_H   =  2;
const FONT_BODY  = 10;
const FONT_HDR   = 10;
const ROW_MIN_H  = 10;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function fillPageBackground(pdf: jsPDF, pageW: number, pageH: number) {
  pdf.setFillColor(...BG_PAGE);
  pdf.rect(0, 0, pageW, pageH, 'F');
}

export async function generateSeriesPDF(
  sesiones: SesionSeries[],
  clienteNombre: string,
  fecha: Date = new Date()
): Promise<string> {
  const pdf  = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  fillPageBackground(pdf, pageW, pageH);

  pdf.setFillColor(...WHITE);
  pdf.rect(0, 0, pageW, HEADER_H, 'F');

  const heroB64 = await loadImageAsBase64('/Hero.JPEG');
  if (heroB64) {
    const imgEl = new Image();
    await new Promise<void>((res) => {
      imgEl.onload  = () => res();
      imgEl.onerror = () => res();
      imgEl.src = heroB64;
    });

    const naturalW = imgEl.naturalWidth  || 1190;
    const naturalH = imgEl.naturalHeight || 950;
    const aspect   = naturalW / naturalH;

    const imgW = 60;
    const imgH = imgW / aspect;
    const imgX = MARGIN_X;
    const imgY = (HEADER_H - imgH) / 2;
    pdf.addImage(heroB64, 'JPEG', imgX, imgY, imgW, imgH);
  }

  const contactLines = [
    'Entrenamiento diseñado por',
    'Pablo Rodríguez Madurga',
    '@videoanalisis_natacion',
    'Tlf: 638 285 938',
  ];
  const contactX = pageW - MARGIN_X;
  const contactStartY = (HEADER_H - contactLines.length * 4) / 2 + 2;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...OCEAN_DARK);
  pdf.text(contactLines[0], contactX, contactStartY, { align: 'right' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...OCEAN_DARK);
  pdf.text(contactLines[1], contactX, contactStartY + 4.5, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...OCEAN_BLUE);
  pdf.text(contactLines[2], contactX, contactStartY + 9, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...GRAY);
  pdf.text(contactLines[3], contactX, contactStartY + 13.5, { align: 'right' });

  pdf.setFillColor(...ACCENT_BAR);
  pdf.rect(0, HEADER_H, pageW, ACCENT_H, 'F');

  pdf.setFillColor(...BG_PAGE);
  pdf.rect(0, HEADER_H + ACCENT_H, pageW, pageH - HEADER_H - ACCENT_H, 'F');

  let y = HEADER_H + ACCENT_H + 9;

  pdf.setFontSize(18);
  pdf.setTextColor(...OCEAN_DARK);
  pdf.setFont('helvetica', 'bold');
  const titulo = `Resultados de Series - ${clienteNombre}`;
  pdf.text(titulo, MARGIN_X, y);

  y += 7;

  const fechaStr = fecha.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  pdf.text(fechaStr, MARGIN_X, y);

  const totalSesiones = sesiones.length;
  const mejorGeneral = Math.min(...sesiones.map(s => s.mejorTiempo));
  const distanciaTotal = sesiones.reduce((acc, s) => acc + s.distancia, 0);
  
  y += 5;
  pdf.text(`Sesiones: ${totalSesiones} · Mejor tiempo: ${formatTime(mejorGeneral)} · ${distanciaTotal}m totales`, MARGIN_X, y);

  y += 7;

  pdf.setDrawColor(...OCEAN_BLUE);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_X, y, pageW - MARGIN_X, y);

  y += 10;

  const colDistancia = 25;
  const colTiempos = 155;
  const CONTENT_W = colDistancia + colTiempos;

  pdf.setFillColor(...OCEAN_DARK);
  pdf.rect(MARGIN_X, y, CONTENT_W, 6.5, 'F');

  pdf.setFontSize(FONT_HDR);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...WHITE);

  const ty = y + 6.5 - 1.5;
  pdf.text('DISTANCIA', MARGIN_X + 2, ty);
  pdf.text('TIEMPOS', MARGIN_X + colDistancia + 2, ty);

  y += 6.5;

  pdf.setFont('helvetica', 'normal');

  sesiones.forEach((sesion, idx) => {
    const tiemposStr = sesion.tiempos.map(t => `${t.repeticion}: ${formatTime(t.tiempo)}`).join(' | ');
    const mejorStr = ` (${formatTime(sesion.mejorTiempo)})`;

    const rowH = ROW_MIN_H;

    if (y + rowH > pageH - 18) {
      pdf.addPage();
      fillPageBackground(pdf, pageW, pageH);
      y = 15;

      pdf.setFillColor(...OCEAN_DARK);
      pdf.rect(MARGIN_X, y, CONTENT_W, 6.5, 'F');
      
      pdf.setFontSize(FONT_HDR);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...WHITE);
      pdf.text('DISTANCIA', MARGIN_X + 2, y + 4.5);
      pdf.text('TIEMPOS', MARGIN_X + colDistancia + 2, y + 4.5);
      y += 6.5;
      pdf.setFont('helvetica', 'normal');
    }

    pdf.setFillColor(...(idx % 2 === 0 ? WHITE : ROW_ALT));
    pdf.rect(MARGIN_X, y, CONTENT_W, rowH, 'F');

    pdf.setDrawColor(200, 218, 230);
    pdf.setLineWidth(0.15);
    pdf.line(MARGIN_X, y + rowH, MARGIN_X + CONTENT_W, y + rowH);

    pdf.setFontSize(FONT_BODY);
    pdf.setTextColor(...OCEAN_BLUE);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${sesion.distancia}m`, MARGIN_X + 2, y + rowH / 2 + 1.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...OCEAN_DARK);
    pdf.text(tiemposStr + mejorStr, MARGIN_X + colDistancia + 2, y + rowH / 2 + 1.5);

    y += rowH;
  });

  const addFooter = (pageIndex: number) => {
    const footerY = pageH - 10;

    pdf.setFillColor(...OCEAN_DARK);
    pdf.rect(0, pageH - 7, pageW, 7, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...WHITE);
    pdf.text('VideoAnalisis — Natación', MARGIN_X, pageH - 2.5);
    pdf.text(
      new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
      pageW - MARGIN_X,
      pageH - 3,
      { align: 'right' },
    );
  };

  const totalPages = (pdf.internal as any).getNumberOfPages?.() ?? 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    addFooter(i);
  }

  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}

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