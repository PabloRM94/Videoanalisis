'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAllTiemposMMP, getSesionesSeriesCliente, TiempoMMP, SesionSeries } from '@/lib/firebase/tiempos';
import { generateTiemposPDF } from '@/lib/generateTiemposPDF';
import { Download, Clock, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export default function ClienteTiemposPage() {
  const { user } = useAuth();
  const [tiemposMMP, setTiemposMMP] = useState<Map<number, TiempoMMP[]>>(new Map());
  const [sesionesSeries, setSesionesSeries] = useState<SesionSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mmp' | 'series'>('mmp');
  const [expandedDistancia, setExpandedDistancia] = useState<number | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchTiempos = async () => {
      if (!user) return;

      try {
        const mmpData = await getAllTiemposMMP(user.uid);
        const seriesData = await getSesionesSeriesCliente(user.uid);
        
        setTiemposMMP(mmpData);
        setSesionesSeries(seriesData);
      } catch (error) {
        console.error('Error fetching tiempos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTiempos();
  }, [user]);

  const handleDownloadPDF = async () => {
    if (!user || generatingPDF) return;
    
    setGeneratingPDF(true);
    try {
      const pdfUrl = await generateTiemposPDF(
        tiemposMMP,
        sesionesSeries,
        user.nombre || 'Cliente'
      );
      
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `tiempos-${user.nombre || 'cliente'}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  const sortedDistancias = Array.from(tiemposMMP.keys()).sort((a, b) => a - b);
  const sortedSesiones = [...sesionesSeries].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const totalRegistrosMMP = Array.from(tiemposMMP.values()).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ocean-800 flex items-center gap-2">
            ⏱️ Mis Tiempos
          </h1>
          <p className="text-ocean-600">Historial de MMP y Series</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={generatingPDF}
          className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {generatingPDF ? 'Generando...' : 'Descargar PDF'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-ocean-100 rounded-lg">
              <Clock className="w-5 h-5 text-ocean-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{totalRegistrosMMP}</p>
              <p className="text-sm text-ocean-500">Registros MMP</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">
                {tiemposMMP.size > 0 
                  ? Array.from(tiemposMMP.keys()).map(d => `${d}m`).join(', ')
                  : '-'}
              </p>
              <p className="text-sm text-ocean-500">Distancias MMP</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ocean-800">{sesionesSeries.length}</p>
              <p className="text-sm text-ocean-500">Sesiones de Series</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('mmp')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
            activeTab === 'mmp'
              ? 'bg-ocean-600 text-white'
              : 'bg-white text-ocean-600 border border-ocean-200 hover:bg-ocean-50'
          }`}
        >
          MMP
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
            activeTab === 'series'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          Series
        </button>
      </div>

      {activeTab === 'mmp' && (
        <div className="space-y-4">
          {sortedDistancias.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 text-ocean-300" />
              <h3 className="text-lg font-medium text-ocean-700 mb-2">
                Sin tiempos MMP aún
              </h3>
              <p className="text-ocean-500">
                Completa tu primer entrenamiento cronometrado para ver tus MMP aquí
              </p>
            </div>
          ) : (
            sortedDistancias.map(distancia => {
              const tiempos = tiemposMMP.get(distancia) || [];
              if (tiempos.length === 0) return null;
              
              const mejorTiempo = Math.min(...tiempos.map(t => t.tiempo));
              const isExpanded = expandedDistancia === distancia;
              
              const tiemposOrdenados = [...tiempos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

              return (
                <div key={distancia} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedDistancia(isExpanded ? null : distancia)}
                    className="w-full p-4 flex items-center justify-between hover:bg-ocean-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-ocean-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg font-bold text-ocean-600">{distancia}m</span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-ocean-800">Mejor Marca Personal</p>
                        <p className="text-2xl font-bold text-ocean-600">{formatTime(mejorTiempo)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-ocean-500">{tiempos.length} registros</span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-ocean-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-ocean-400" />
                      )}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="border-t border-ocean-100">
                      <div className="bg-ocean-50 px-4 py-2 grid grid-cols-3 text-xs font-medium text-ocean-600">
                        <span>Fecha</span>
                        <span className="text-center">Tiempo</span>
                        <span className="text-right">Evolución</span>
                      </div>
                      <div className="divide-y divide-ocean-100">
                        {tiemposOrdenados.map((t, idx) => {
                          const tiempoAnterior = idx > 0 ? tiemposOrdenados[idx - 1].tiempo : null;
                          const diff = tiempoAnterior !== null ? t.tiempo - tiempoAnterior : null;
                          
                          return (
                            <div key={idx} className="px-4 py-3 grid grid-cols-3 items-center text-sm">
                              <span className="text-ocean-600">
                                {t.fecha instanceof Date ? t.fecha.toLocaleDateString('es-ES') : new Date(t.fecha).toLocaleDateString('es-ES')}
                              </span>
                              <span className="text-center font-mono font-semibold text-ocean-800">
                                {formatTime(t.tiempo)}
                              </span>
                              <span className="text-right">
                                {diff !== null && (
                                  <span className={diff < 0 ? 'text-green-600' : diff > 0 ? 'text-red-600' : 'text-gray-400'}>
                                    {diff < 0 ? `↓${(Math.abs(diff) / 1000).toFixed(1)}s` : diff > 0 ? `↑${(diff / 1000).toFixed(1)}s` : '='}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'series' && (
        <div className="space-y-4">
          {sortedSesiones.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-purple-300" />
              <h3 className="text-lg font-medium text-ocean-700 mb-2">
                Sin sesiones de series aún
              </h3>
              <p className="text-ocean-500">
                Completa series cronometradas para ver tu historial aquí
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-purple-50 px-4 py-3 grid grid-cols-4 text-sm font-medium text-purple-700">
                <span>Fecha</span>
                <span className="text-center">Distancia</span>
                <span className="text-center">Tiempos</span>
                <span className="text-right">Mejor</span>
              </div>
              <div className="divide-y divide-purple-100">
                {sortedSesiones.map((sesion, idx) => (
                  <div key={idx} className="px-4 py-3 grid grid-cols-4 items-center text-sm">
                    <span className="text-ocean-600">
                      {sesion.fecha instanceof Date 
                        ? sesion.fecha.toLocaleDateString('es-ES') 
                        : new Date(sesion.fecha).toLocaleDateString('es-ES')}
                    </span>
                    <span className="text-center font-semibold text-purple-700">
                      {sesion.distancia}m
                    </span>
                    <span className="text-center font-mono text-ocean-600">
                      {sesion.tiempos.map(t => formatTime(t.tiempo)).join(' · ')}
                    </span>
                    <span className="text-right font-bold text-green-600">
                      {formatTime(sesion.mejorTiempo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}