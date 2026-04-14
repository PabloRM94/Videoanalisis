'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { guardarTiempoMMP, guardarSesionSeries } from '@/lib/firebase/tiempos';
import { Play, RotateCcw, Save, Check, Volume2, VolumeX } from 'lucide-react';

interface SwimLap {
  tiempo: number;
  timestamp: number;
}

interface TimerState {
  distancia: number;
  parciales: number;
  distanciaParcial: number;
  estado: 'pending' | 'countdown' | 'running' | 'finished' | 'dnf';
  tiempoInicio: number | null;
  tiempoFin: number | null;
  laps: SwimLap[];
  tiempoActual: number;
  countdown: number | null;
}

const DISTANCIAS = [25, 50, 75, 100, 150, 200];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function playBeep(freq: number = 880, duration: number = 150) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration);
  } catch (e) {
    console.log('Audio not available');
  }
}

function vibrate(pattern: number | number[]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

interface IntermediateTime {
  distancia: number;
  tiempo: number;
  esReal: boolean;
}

function calcularIntermedios(laps: SwimLap[], distancia: number, distanciaParcial: number, tiempoTotal: number, parciales: number): IntermediateTime[] {
  if (parciales === 0) return [];
  
  const intermedios: IntermediateTime[] = [];
  const intermediosPosibles = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000];
  const intermediosAMostrar = intermediosPosibles.filter(d => d < distancia);
  
  if (laps.length === 0 && tiempoTotal > 0) {
    for (const dist of intermediosAMostrar) {
      const proporcion = dist / distancia;
      const tiempoEstimado = tiempoTotal * proporcion;
      intermedios.push({ distancia: dist, tiempo: Math.round(tiempoEstimado), esReal: false });
    }
    return intermedios;
  }
  
  if (laps.length === 0) return [];
  
  const parcialesAcumulados = laps.length;
  const distanciaTotalParcial = parcialesAcumulados * distanciaParcial;
  
  for (const dist of intermediosAMostrar) {
    const parcialesNecesarios = Math.ceil(dist / distanciaParcial);
    
    if (parcialesNecesarios <= laps.length) {
      const tiempoParcial = laps[parcialesNecesarios - 1].tiempo;
      intermedios.push({ distancia: dist, tiempo: tiempoParcial, esReal: true });
    } else {
      const ultimoLap = laps[laps.length - 1];
      const proporcion = dist / distanciaTotalParcial;
      const tiempoEstimado = ultimoLap.tiempo * proporcion;
      intermedios.push({ distancia: dist, tiempo: Math.round(tiempoEstimado), esReal: false });
    }
  }
  
  return intermedios;
}

export default function ClienteCronometroPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'configurar' | 'ejecutar' | 'resultados'>('configurar');
  const [cronometroModo, setCronometroModo] = useState<'mmp' | 'series'>('mmp');
  
  const [distancia, setDistancia] = useState<number>(100);
  const [parciales, setParciales] = useState<number | ''>(0);
  const [serieRepeticiones, setSerieRepeticiones] = useState<number | ''>(4);
  const [serieDistanciaBase, setSerieDistanciaBase] = useState<number | ''>(50);
  const [serieTiempo, setSerieTiempo] = useState<string>('01:30');
  
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [cronometroIniciado, setCronometroIniciado] = useState(false);
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [resultadosGuardados, setResultadosGuardados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  
  const [tiemposRegistrados, setTiemposRegistrados] = useState<number[]>([]);
  const [repeticionActual, setRepeticionActual] = useState(1);
  const [serieEnCurso, setSerieEnCurso] = useState(false);

  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const getParciales = () => {
    if (parciales === '') return 0;
    return parciales;
  };

  const getSerieRepeticiones = (): number => serieRepeticiones === '' ? 4 : serieRepeticiones;
  const getSerieDistancia = (): number => serieDistanciaBase === '' ? 50 : serieDistanciaBase;

  const iniciarSerie = () => {
    const parcialesValue = getParciales();
    
    const initialTimers: TimerState[] = [{
      distancia,
      parciales: parcialesValue,
      distanciaParcial: parcialesValue === 1 ? Math.round(distancia / 2) : (parcialesValue > 0 ? Math.round(distancia / parcialesValue) : distancia),
      estado: 'pending',
      tiempoInicio: null,
      tiempoFin: null,
      laps: [],
      tiempoActual: 0,
      countdown: null,
    }];
    
    setTimers(initialTimers);
    setTimersIniciados(true);
    setCronometroIniciado(false);
    setActiveTab('ejecutar');
  };

  const iniciarSeries = () => {
    setTiemposRegistrados([]);
    setRepeticionActual(1);
    setSerieEnCurso(true);
    setTimersIniciados(true);
    setCronometroIniciado(false);
    
    const initialTimers: TimerState[] = [{
      distancia: getSerieDistancia(),
      parciales: 0,
      distanciaParcial: getSerieDistancia(),
      estado: 'pending',
      tiempoInicio: null,
      tiempoFin: null,
      laps: [],
      tiempoActual: 0,
      countdown: null,
    }];
    
    setTimers(initialTimers);
    setActiveTab('ejecutar');
  };

  const [timersIniciados, setTimersIniciados] = useState(false);

  const startCronometro = () => {
    if (!timersIniciados || cronometroIniciado) return;
    
    setCronometroIniciado(true);
    startTimeRef.current = Date.now();
    
    const now = Date.now();
    
    setTimers(prev => [{
      ...prev[0],
      estado: 'running' as const,
      tiempoInicio: now,
    }]);
    
    playBeep(440, 200);
    vibrate(100);
  };

  const updateTimers = useCallback(() => {
    const now = Date.now();
    
    setTimers(prevTimers => {
      const updated = prevTimers.map(timer => {
        if (timer.estado === 'running' && timer.tiempoInicio) {
          return {
            ...timer,
            tiempoActual: now - timer.tiempoInicio,
          };
        }
        return timer;
      });
      
      return updated;
    });
    
    animationRef.current = requestAnimationFrame(updateTimers);
  }, []);

  useEffect(() => {
    if (timersIniciados && cronometroIniciado) {
      animationRef.current = requestAnimationFrame(updateTimers);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [timersIniciados, cronometroIniciado, updateTimers]);

  const marcarLap = () => {
    setTimers(prev => prev.map(timer => {
      if (timer.estado === 'running' && timer.tiempoInicio) {
        return {
          ...timer,
          laps: [...timer.laps, { tiempo: Date.now() - timer.tiempoInicio, timestamp: Date.now() }],
        };
      }
      return timer;
    }));
    if (sonidoActivo) {
      playBeep(600, 80);
      vibrate(30);
    }
  };

  const terminarNadador = () => {
    setTimers(prev => prev.map(timer => {
      if (timer.estado === 'running') {
        return {
          ...timer,
          estado: 'finished' as const,
          tiempoFin: Date.now(),
          tiempoActual: timer.tiempoInicio ? Date.now() - timer.tiempoInicio : timer.tiempoActual,
        };
      }
      return timer;
    }));
    if (sonidoActivo) {
      playBeep(440, 150);
      vibrate(100);
    }
  };

  const registrarTiempoSeries = () => {
    const timer = timers[0];
    if (!timer || timer.estado !== 'running' || !timer.tiempoInicio) return;
    
    const tiempoRegistrado = Date.now() - timer.tiempoInicio;
    
    setTiemposRegistrados(prev => [...prev, tiempoRegistrado]);
    
    setTimers(prev => [{
      ...prev[0],
      estado: 'finished' as const,
      tiempoFin: Date.now(),
      tiempoActual: tiempoRegistrado,
    }]);
    
    if (sonidoActivo) {
      playBeep(600, 80);
      vibrate(30);
    }
  };

  const siguienteRepeticion = () => {
    if (repeticionActual >= getSerieRepeticiones()) {
      setSerieEnCurso(false);
      setCronometroIniciado(false);
      setActiveTab('resultados');
      return;
    }
    
    setRepeticionActual(prev => prev + 1);
    setCronometroIniciado(false);
    
    setTimers(prev => [{
      ...prev[0],
      estado: 'pending' as const,
      tiempoInicio: null,
      tiempoFin: null,
      tiempoActual: 0,
      countdown: null,
    }]);
  };

  const getEvolucion = (tiempos: number[], repActual: number): string => {
    if (repActual <= 1) return '';
    const tiempoActual = tiempos[repActual - 1];
    const tiempoAnterior = tiempos[repActual - 2];
    
    if (tiempoActual < tiempoAnterior) return '↓';
    if (tiempoActual > tiempoAnterior) return '↑';
    return '=';
  };

  const getEvolucionColor = (tiempos: number[], repActual: number): string => {
    if (repActual <= 1) return '';
    const tiempoActual = tiempos[repActual - 1];
    const tiempoAnterior = tiempos[repActual - 2];
    
    if (tiempoActual < tiempoAnterior) return 'text-green-600';
    if (tiempoActual > tiempoAnterior) return 'text-red-600';
    return 'text-gray-600';
  };

  const guardarResultadosMMP = async () => {
    if (guardando || cronometroModo !== 'mmp' || !user) return;
    
    setGuardando(true);
    try {
      const timer = timers[0];
      if (timer && timer.estado === 'finished' && timer.tiempoActual > 0) {
        await guardarTiempoMMP(user.uid, distancia, timer.tiempoActual);
      }
      setResultadosGuardados(true);
    } catch (error) {
      console.error('Error guardando resultados MMP:', error);
      alert('Error al guardar resultados');
    } finally {
      setGuardando(false);
    }
  };

  const guardarResultadosSeries = async () => {
    if (guardando || cronometroModo !== 'series' || !user) return;
    
    setGuardando(true);
    try {
      if (tiemposRegistrados.length > 0) {
        const tiemposValidos = tiemposRegistrados
          .map((t, idx) => ({ repeticion: idx + 1, tiempo: t, fecha: new Date() }));
        
        await guardarSesionSeries(user.uid, getSerieDistancia(), tiemposValidos);
      }
      setResultadosGuardados(true);
    } catch (error) {
      console.error('Error guardando resultados series:', error);
      alert('Error al guardar resultados');
    } finally {
      setGuardando(false);
    }
  };

  const nuevaSerie = () => {
    setTimers([]);
    setTimersIniciados(false);
    setActiveTab('configurar');
    setResultadosGuardados(false);
  };

  const reiniciarSeries = () => {
    setTiemposRegistrados([]);
    setRepeticionActual(1);
    setCronometroIniciado(false);
    setTimers([]);
    setTimersIniciados(false);
    setActiveTab('configurar');
  };

  const toggleExpanded = () => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has('timer')) {
        next.delete('timer');
      } else {
        next.add('timer');
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ocean-800 flex items-center gap-2">
            🏊 Mi Cronómetro
          </h1>
        </div>
        <button
          onClick={() => setSonidoActivo(!sonidoActivo)}
          className={`p-2 rounded-lg ${sonidoActivo ? 'bg-ocean-100 text-ocean-600' : 'bg-gray-100 text-gray-400'}`}
        >
          {sonidoActivo ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            setCronometroModo('mmp');
            setTimers([]);
            setTimersIniciados(false);
            setActiveTab('configurar');
            setTiemposRegistrados([]);
            setRepeticionActual(1);
            setSerieEnCurso(false);
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
            cronometroModo === 'mmp'
              ? 'bg-ocean-600 text-white'
              : 'bg-white text-ocean-600 border border-ocean-200 hover:bg-ocean-50'
          }`}
        >
          MMP
        </button>
        <button
          onClick={() => {
            setCronometroModo('series');
            setTimers([]);
            setTimersIniciados(false);
            setActiveTab('configurar');
          }}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold text-center ${
            cronometroModo === 'series'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
          }`}
        >
          Series
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('configurar')}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
            activeTab === 'configurar' 
              ? 'bg-ocean-600 text-white' 
              : 'bg-white text-ocean-600 hover:bg-ocean-50'
          }`}
        >
          ⚙️ Configurar
        </button>
        <button
          onClick={() => setActiveTab('ejecutar')}
          disabled={!timersIniciados}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
            activeTab === 'ejecutar' 
              ? 'bg-ocean-600 text-white' 
              : timersIniciados
              ? 'bg-white text-ocean-600 hover:bg-ocean-50'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          ⏱️ Ejecutar
        </button>
        <button
          onClick={() => setActiveTab('resultados')}
          disabled={!timersIniciados}
          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
            activeTab === 'resultados' 
              ? 'bg-ocean-600 text-white' 
              : timersIniciados
              ? 'bg-white text-ocean-600 hover:bg-ocean-50'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          📊 Resultados
        </button>
      </div>

      {activeTab === 'configurar' && (
        <div className="space-y-4">
          {cronometroModo === 'mmp' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-ocean-800 mb-4">Configuración MMP</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Distancia (m)</label>
                  <select
                    value={distancia}
                    onChange={(e) => setDistancia(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  >
                    {DISTANCIAS.map(d => (
                      <option key={d} value={d}>{d} metros</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Parciales</label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={parciales}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setParciales('');
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num) && num >= 0) {
                          setParciales(Math.min(20, num));
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    placeholder="0"
                  />
                  <div className="text-xs text-ocean-500 mt-1">
                    {getParciales() === 0 
                      ? 'Sin parciales' 
                      : getParciales() === 1 
                        ? `Intermedio a ${Math.round(distancia / 2)}m` 
                        : `${Math.round(distancia / getParciales())}m cada parcial`}
                  </div>
                </div>
              </div>
              
              <button
                onClick={iniciarSerie}
                className="w-full mt-4 py-4 bg-ocean-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-ocean-700"
              >
                <Play className="w-6 h-6" />
                Iniciar MMP
              </button>
            </div>
          )}

          {cronometroModo === 'series' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-ocean-800 mb-4">Configuración de Series</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Repeticiones</label>
                  <input
                    type="number"
                    value={serieRepeticiones}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setSerieRepeticiones('');
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setSerieRepeticiones(num);
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Distancia (m)</label>
                  <input
                    type="number"
                    value={serieDistanciaBase}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setSerieDistanciaBase('');
                      } else {
                        const num = parseInt(val);
                        if (!isNaN(num)) {
                          setSerieDistanciaBase(num);
                        }
                      }
                    }}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ocean-700 mb-2">Tiempo límite</label>
                  <input
                    type="text"
                    value={serieTiempo}
                    onChange={(e) => setSerieTiempo(e.target.value)}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                    placeholder="01:30"
                  />
                  <div className="text-xs text-ocean-500 mt-1">mm:ss</div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-center font-semibold text-green-800">
                  {getSerieRepeticiones()} × {getSerieDistancia()}m @ {serieTiempo}
                </p>
              </div>
              
              <button
                onClick={iniciarSeries}
                className="w-full mt-4 py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-purple-700"
              >
                <Play className="w-6 h-6" />
                Iniciar Series
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ejecutar' && cronometroModo === 'mmp' && timers.length > 0 && (
        <div className="space-y-4">
          {!cronometroIniciado && timers[0].estado !== 'finished' && (
            <button
              onClick={startCronometro}
              className="fixed bottom-6 right-6 w-20 h-20 bg-green-600 rounded-full shadow-lg flex flex-col items-center justify-center text-white text-xs font-bold hover:bg-green-700 active:scale-95 transition-transform z-50"
            >
              <Play className="w-8 h-8 mb-0.5" />
              START
            </button>
          )}

          <div className="bg-ocean-600 text-white px-3 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold">{distancia}m {getParciales() === 0 ? '(sin parciales)' : `× ${getParciales()}`}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 text-center">
            <div className="text-6xl font-bold font-mono text-ocean-800 mb-4">
              {timers[0].estado === 'pending' 
                ? '--:--:--' 
                : formatTime(timers[0].tiempoActual)}
            </div>
            
            {timers[0].estado === 'running' && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {getParciales() > 0 && (
                  <button 
                    onClick={marcarLap} 
                    className="flex-1 min-h-[56px] bg-ocean-600 text-white text-lg font-bold rounded active:scale-95 px-4 py-3"
                  >
                    LAP
                  </button>
                )}
                <button 
                  onClick={terminarNadador} 
                  className="flex-1 min-h-[56px] bg-green-600 text-white text-lg font-bold rounded active:scale-95 px-4 py-3"
                >
                  STOP
                </button>
              </div>
            )}
            
            {timers[0].estado === 'running' && (
              <div className="text-sm text-ocean-500 mt-2">{timers[0].distancia}m</div>
            )}
            
            {timers[0].laps.length > 0 && (
              <button onClick={toggleExpanded} className="text-sm text-ocean-500 mt-2 hover:text-ocean-700">
                {timers[0].laps.length} parciales {expandedCards.has('timer') ? 'ocultar' : 'ver'}
              </button>
            )}
          </div>

          {expandedCards.has('timer') && timers[0].laps.length > 0 && (
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-medium text-ocean-700 mb-2">Parciales</h3>
              <div className="space-y-1">
                {timers[0].laps.map((lap, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-ocean-500">{idx + 1} ({timers[0].distanciaParcial}m)</span>
                    <span className="font-mono text-ocean-700">{formatTime(lap.tiempo)}</span>
                  </div>
                ))}
              </div>
              {(() => {
                const intermedios = calcularIntermedios(timers[0].laps, timers[0].distancia, timers[0].distanciaParcial, timers[0].tiempoActual, timers[0].parciales);
                if (intermedios.length > 0) {
                  return (
                    <>
                      <h3 className="font-medium text-ocean-700 mt-4 mb-2">Tiempos Intermedios</h3>
                      <div className="space-y-1">
                        {intermedios.map((int, idx) => (
                          <div key={idx} className={`flex justify-between text-sm px-2 py-1 rounded ${int.esReal ? 'bg-ocean-50' : 'bg-yellow-50'}`}>
                            <span className={int.esReal ? 'text-ocean-600' : 'text-yellow-700'}>
                              {int.distancia}m {int.esReal ? '' : '~'}
                            </span>
                            <span className={`font-mono ${int.esReal ? 'text-ocean-700' : 'text-yellow-700'}`}>
                              {formatTime(int.tiempo)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {timers[0].estado === 'finished' && (
            <button
              onClick={() => setActiveTab('resultados')}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-green-700"
            >
              Ver Resultados
            </button>
          )}
        </div>
      )}

      {activeTab === 'ejecutar' && cronometroModo === 'series' && serieEnCurso && (
        <div className="space-y-4">
          <div className="bg-purple-600 text-white px-3 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold">Serie {repeticionActual}/{getSerieRepeticiones()}</span>
              <span className="opacity-75">|</span>
              <span>{getSerieDistancia()}m</span>
              <span className="opacity-75">|</span>
              <span>Límite: {serieTiempo}</span>
            </div>
          </div>

          {!cronometroIniciado && timers.length > 0 && (
            <button
              onClick={() => {
                setCronometroIniciado(true);
                const now = Date.now();
                setTimers(prev => [{
                  ...prev[0],
                  estado: 'running' as const,
                  tiempoInicio: now,
                }]);
                playBeep(440, 200);
                vibrate(100);
              }}
              className="fixed bottom-6 right-6 w-20 h-20 bg-green-600 rounded-full shadow-lg flex flex-col items-center justify-center text-white text-xs font-bold hover:bg-green-700 active:scale-95 transition-transform z-50"
            >
              <Play className="w-8 h-8 mb-0.5" />
              START
            </button>
          )}

          <div className="bg-white rounded-xl p-6 text-center">
            <div className="text-sm text-ocean-500 mb-1">
              Repetición {repeticionActual} de {getSerieRepeticiones()}
            </div>
            <div className={`text-6xl font-bold font-mono ${
              timers[0].estado === 'running' 
                ? 'text-blue-600'
                : timers[0].estado === 'finished'
                ? 'text-green-600'
                : 'text-gray-400'
            }`}>
              {timers[0].estado === 'pending' 
                ? '--:--:--' 
                : formatTime(timers[0].tiempoActual)}
            </div>
            
            {(timers[0].estado === 'running') && (
              <button
                onClick={registrarTiempoSeries}
                className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg font-bold active:scale-95"
              >
                REGISTRAR
              </button>
            )}
            
            {timers[0].estado === 'finished' && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setTimers(prev => [{
                      ...prev[0],
                      estado: 'running' as const,
                      tiempoInicio: Date.now(),
                    }]);
                  }}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold"
                >
                  Repetir
                </button>
                {tiemposRegistrados.length > 1 && (
                  <div className={`px-3 py-2 rounded-lg text-xl font-bold ${getEvolucionColor(tiemposRegistrados, repeticionActual)}`}>
                    {getEvolucion(tiemposRegistrados, repeticionActual)}
                  </div>
                )}
              </div>
            )}
          </div>

          {tiemposRegistrados.length > 0 && (
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-medium text-ocean-700 mb-2">Tiempos Registrados</h3>
              <div className="grid grid-cols-4 gap-2">
                {tiemposRegistrados.map((t, idx) => (
                  <div key={idx} className="text-center p-2 bg-ocean-50 rounded-lg">
                    <div className="text-xs text-ocean-500">Rep {idx + 1}</div>
                    <div className="font-mono text-ocean-700">{formatTime(t)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cronometroIniciado && timers[0].estado === 'finished' && (
            <button
              onClick={siguienteRepeticion}
              className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-purple-700"
            >
              {repeticionActual >= getSerieRepeticiones() ? 'Ver Resultados' : 'Siguiente Repetición'}
            </button>
          )}
        </div>
      )}

      {activeTab === 'resultados' && cronometroModo === 'mmp' && timers.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ocean-800 text-lg">Resultado Final</h2>
              <div className="flex gap-2">
                {!resultadosGuardados && (
                  <button
                    onClick={guardarResultadosMMP}
                    disabled={guardando}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
                {resultadosGuardados && (
                  <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                    <Check className="w-4 h-4" />
                    Guardado
                  </span>
                )}
                <button
                  onClick={nuevaSerie}
                  className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nueva Serie
                </button>
              </div>
            </div>

            <div className="rounded-xl p-6 bg-ocean-50 text-center">
              <div className="text-sm text-ocean-500 mb-2">{distancia}m</div>
              <div className="text-4xl font-bold font-mono text-ocean-800">
                {formatTime(timers[0].tiempoActual)}
              </div>
              <button
                onClick={toggleExpanded}
                className="text-sm text-ocean-600 hover:text-ocean-800 mt-2"
              >
                {expandedCards.has('timer') ? 'Ocultar' : 'Ver'} detalles
              </button>
              
              {expandedCards.has('timer') && timers[0].laps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ocean-200">
                  <p className="text-xs font-medium text-ocean-700 mb-2">Parciales</p>
                  <div className="grid grid-cols-2 gap-1 mb-3">
                    {timers[0].laps.map((lap, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-ocean-500">{idx + 1} ({timers[0].distanciaParcial}m)</span>
                        <span className="font-mono text-ocean-700">{formatTime(lap.tiempo)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resultados' && cronometroModo === 'series' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ocean-800 text-lg">Resultados - Series</h2>
              <div className="flex gap-2">
                {!resultadosGuardados && (
                  <button
                    onClick={guardarResultadosSeries}
                    disabled={guardando}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {guardando ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
                {resultadosGuardados && (
                  <span className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                    <Check className="w-4 h-4" />
                    Guardado
                  </span>
                )}
                <button
                  onClick={reiniciarSeries}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nueva Serie
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-purple-100">
                    <th className="px-4 py-2 text-left font-semibold text-purple-700">Distancia</th>
                    {Array.from({ length: getSerieRepeticiones() }, (_, i) => i + 1).map((rep: number) => (
                      <th key={rep} className="px-4 py-2 text-center font-semibold text-purple-700">
                        Rep {rep}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-center font-semibold text-purple-700">Evolución</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-purple-100">
                    <td className="px-4 py-3 font-medium text-purple-800">
                      {getSerieDistancia()}m
                    </td>
                    {tiemposRegistrados.map((tiempo, idx) => {
                      const evolucion = getEvolucion(tiemposRegistrados, idx + 1);
                      const evolucionColor = getEvolucionColor(tiemposRegistrados, idx + 1);
                      return (
                        <td key={idx} className="px-4 py-3 text-center font-mono text-purple-700">
                          <span className="flex items-center justify-center gap-1">
                            {formatTime(tiempo)}
                            {idx > 0 && evolucion && (
                              <span className={evolucionColor}>{evolucion}</span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {tiemposRegistrados.length >= 2 && (
                        <span className={getEvolucionColor(tiemposRegistrados, getSerieRepeticiones())}>
                          {getEvolucion(tiemposRegistrados, getSerieRepeticiones())}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}