import { jsPDF } from 'jspdf';

export interface TiempoMMP {
  fecha: Date | { toDate?: () => Date };
  tiempo: number;
  tipo: 'mmp';
}

export interface TiempoSerie {
  repeticion: number;
  tiempo: number;
  fecha: Date | { toDate?: () => Date };
}

export interface SesionSeries {
  fecha: Date | { toDate?: () => Date };
  distancia: number;
  tiempos: TiempoSerie[];
  mejorTiempo: number;
}

const OCEAN_BLUE: [number, number, number] = [2, 132, 199];
const OCEAN_DARK: [number, number, number] = [12, 74, 110];
const ACCENT_BAR: [number, number, number] = [2, 132, 199];
const BG_PAGE: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];
const ROW_ALT: [number, number, number] = [237, 245, 252];
const GRAY: [number, number, number] = [100, 100, 100];
const GOLD: [number, number, number] = [234, 179, 8];

const MARGIN_X = 15;
const HEADER_H = 28;
const ACCENT_H = 2;
const FONT_BODY = 10;
const FONT_HDR = 10;
const ROW_MIN_H = 10;

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function toDate(fecha: unknown): Date {
  if (fecha instanceof Date) return fecha;
  if (fecha && typeof fecha === 'object' && 'toDate' in fecha) {
    const f = fecha as { toDate: () => Date };
    return f.toDate();
  }
  return new Date();
}

function fillPageBackground(pdf: jsPDF, pageW: number, pageH: number) {
  pdf.setFillColor(...BG_PAGE);
  pdf.rect(0, 0, pageW, pageH, 'F');
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateTiemposPDF(
  tiemposMMP: Map<number, TiempoMMP[]>,
  sesionesSeries: SesionSeries[],
  clienteNombre: string,
  fecha: Date = new Date()
): Promise<string> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  fillPageBackground(pdf, pageW, pageH);

  pdf.setFillColor(...WHITE);
  pdf.rect(0, 0, pageW, HEADER_H, 'F');

  const heroB64 = await loadImageAsBase64('/Hero.JPEG');
  if (heroB64) {
    const imgEl = new Image();
    await new Promise<void>((res) => {
      imgEl.onload = () => res();
      imgEl.onerror = () => res();
      imgEl.src = heroB64;
    });

    const naturalW = imgEl.naturalWidth || 1190;
    const naturalH = imgEl.naturalHeight || 950;
    const aspect = naturalW / naturalH;

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
  const titulo = `Historial de Tiempos - ${clienteNombre}`;
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

  const totalMMP = Array.from(tiemposMMP.values()).reduce((acc, arr) => acc + arr.length, 0);
  const totalSeries = sesionesSeries.length;

  y += 5;
  pdf.setTextColor(...GRAY);
  pdf.text(`MMP: ${totalMMP} registros · Series: ${totalSeries} sesiones`, MARGIN_X, y);

  y += 10;

  const hasMMP = tiemposMMP.size > 0;
  const hasSeries = sesionesSeries.length > 0;

  if (hasMMP) {
    pdf.setDrawColor(...OCEAN_BLUE);
    pdf.setLineWidth(0.35);
    pdf.line(MARGIN_X, y, pageW - MARGIN_X, y);

    y += 8;

    pdf.setFontSize(14);
    pdf.setTextColor(...OCEAN_DARK);
    pdf.setFont('helvetica', 'bold');
    pdf.text('MMP (Mejores Marcas Personales)', MARGIN_X, y);

    y += 6;

    const sortedDistancias = Array.from(tiemposMMP.keys()).sort((a, b) => a - b);

    for (const distancia of sortedDistancias) {
      const tiempos = tiemposMMP.get(distancia) || [];
      if (tiempos.length === 0) continue;

      const mejorTiempo = Math.min(...tiempos.map(t => t.tiempo));

      if (y + 15 > pageH - 20) {
        pdf.addPage();
        fillPageBackground(pdf, pageW, pageH);
        y = 15;
      }

      pdf.setFillColor(...OCEAN_DARK);
      pdf.rect(MARGIN_X, y, 180, 6, 'F');

      pdf.setFontSize(FONT_HDR);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...WHITE);
      pdf.text(`${distancia}m`, MARGIN_X + 2, y + 4.5);
      pdf.text(`Mejor: ${formatTime(mejorTiempo)}`, MARGIN_X + 40, y + 4.5);

      y += 7;

      pdf.setFillColor(...ROW_ALT);
      pdf.rect(MARGIN_X, y, 180, 5, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...GRAY);
      pdf.text('Fecha', MARGIN_X + 2, y + 3);
      pdf.text('Tiempo', MARGIN_X + 60, y + 3);
      pdf.text('Evolución', MARGIN_X + 100, y + 3);

      y += 5;

      const tiemposOrdenados = [...tiempos].sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime()).slice(0, 10);

      tiemposOrdenados.forEach((t, idx) => {
        if (y + 5 > pageH - 20) {
          pdf.addPage();
          fillPageBackground(pdf, pageW, pageH);
          y = 15;
        }

        pdf.setFillColor(...(idx % 2 === 0 ? WHITE : ROW_ALT));
        pdf.rect(MARGIN_X, y, 180, 5, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...OCEAN_DARK);
        pdf.text(toDate(t.fecha).toLocaleDateString('es-ES'), MARGIN_X + 2, y + 3);

        pdf.setTextColor(...OCEAN_BLUE);
        pdf.setFont('helvetica', 'bold');
        pdf.text(formatTime(t.tiempo), MARGIN_X + 60, y + 3);

        if (idx > 0 && tiemposOrdenados[idx - 1]) {
          const diff = t.tiempo - tiemposOrdenados[idx - 1].tiempo;
          const diffSeconds = Math.abs(diff) / 1000;
          if (diff < 0) {
            pdf.setTextColor(34, 197, 94);
            pdf.text(`↓${diffSeconds.toFixed(1)}s`, MARGIN_X + 100, y + 3);
          } else if (diff > 0) {
            pdf.setTextColor(239, 68, 68);
            pdf.text(`↑${diffSeconds.toFixed(1)}s`, MARGIN_X + 100, y + 3);
          } else {
            pdf.setTextColor(...GRAY);
            pdf.text('=', MARGIN_X + 100, y + 3);
          }
        }

        pdf.setTextColor(...GRAY);
        pdf.setFont('helvetica', 'normal');

        y += 5;
      });

      y += 3;
    }
  }

  if (sesionesSeries.length > 0) {
    if (y + 10 > pageH - 30) {
      pdf.addPage();
      fillPageBackground(pdf, pageW, pageH);
      y = 15;
    }

    pdf.setDrawColor(...OCEAN_BLUE);
    pdf.setLineWidth(0.35);
    pdf.line(MARGIN_X, y, pageW - MARGIN_X, y);

    y += 8;

    pdf.setFontSize(14);
    pdf.setTextColor(...OCEAN_DARK);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Series', MARGIN_X, y);

    y += 6;

    pdf.setFillColor(...OCEAN_DARK);
    pdf.rect(MARGIN_X, y, 180, 6, 'F');

    pdf.setFontSize(FONT_HDR);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...WHITE);
    pdf.text('Fecha', MARGIN_X + 2, y + 4.5);
    pdf.text('Distancia', MARGIN_X + 35, y + 4.5);
    pdf.text('Tiempos', MARGIN_X + 70, y + 4.5);
    pdf.text('Mejor', MARGIN_X + 155, y + 4.5);

    y += 7;

    const sesionesOrdenadas = [...sesionesSeries].sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime()).slice(0, 15);

    sesionesOrdenadas.forEach((sesion, idx) => {
      if (y + 5 > pageH - 20) {
        pdf.addPage();
        fillPageBackground(pdf, pageW, pageH);
        y = 15;

        pdf.setFillColor(...OCEAN_DARK);
        pdf.rect(MARGIN_X, y, 180, 6, 'F');

        pdf.setFontSize(FONT_HDR);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...WHITE);
        pdf.text('Fecha', MARGIN_X + 2, y + 4.5);
        pdf.text('Distancia', MARGIN_X + 35, y + 4.5);
        pdf.text('Tiempos', MARGIN_X + 70, y + 4.5);
        pdf.text('Mejor', MARGIN_X + 155, y + 4.5);

        y += 7;
      }

      pdf.setFillColor(...(idx % 2 === 0 ? WHITE : ROW_ALT));
      pdf.rect(MARGIN_X, y, 180, 5, 'F');

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...OCEAN_DARK);
      pdf.text(toDate(sesion.fecha).toLocaleDateString('es-ES'), MARGIN_X + 2, y + 3);

      pdf.setTextColor(...OCEAN_BLUE);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${sesion.distancia}m`, MARGIN_X + 35, y + 3);

      const tiemposStr = sesion.tiempos.map(t => formatTime(t.tiempo)).join(' · ');
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...OCEAN_DARK);
      
      const truncatedStr = tiemposStr.length > 40 ? tiemposStr.substring(0, 40) + '...' : tiemposStr;
      pdf.text(truncatedStr, MARGIN_X + 70, y + 3, { maxWidth: 80 });

      pdf.setTextColor(...GOLD);
      pdf.setFont('helvetica', 'bold');
      pdf.text(formatTime(sesion.mejorTiempo), MARGIN_X + 155, y + 3);

      y += 5;
    });
  }

  const addFooter = () => {
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
    addFooter();
  }

  const blob = pdf.output('blob');
  return URL.createObjectURL(blob);
}