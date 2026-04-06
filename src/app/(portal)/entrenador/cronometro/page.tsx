'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, X, Plus, Play, RotateCcw, Square, Flag, Check, AlertCircle, ChevronDown, ChevronUp, Volume2, VolumeX, Settings } from 'lucide-react';

interface Cliente {
  id: string;
  nombre: string;
}

interface NadadorConfig {
  id: string;
  clienteId: string;
  nombre: string;
  calle: number;
  posicion: number;
}

interface SwimLap {
  tiempo: number;
  timestamp: number;
}

interface TimerState {
  nadadorId: string;
  nombre: string;
  calle: number;
  posicion: number;
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

const INTERVALOS = [3, 5, 8, 10, 15];
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

function calcularIntermedios(laps: SwimLap[], distancia: number, distanciaParcial: number, tiempoFinal?: number): IntermediateTime[] {
  const intermedios: IntermediateTime[] = [];
  
  const intermediosPosibles = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000];
  const intermediosAMostrar = intermediosPosibles.filter(d => d < distancia);
  
  if (laps.length === 0 && tiempoFinal) {
    for (const dist of intermediosAMostrar) {
      const proporcion = dist / distancia;
      const tiempoEstimado = tiempoFinal * proporcion;
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

export default function CronometroPage() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'configurar' | 'ejecutar' | 'resultados'>('configurar');
  
  const [calles, setCalles] = useState<number | ''>(1);
  const [intervalo, setIntervalo] = useState(5);
  const [customIntervalo, setCustomIntervalo] = useState('');
  const [showCustomIntervalo, setShowCustomIntervalo] = useState(false);
  const [nadadores, setNadadores] = useState<NadadorConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNadadorSelector, setShowNadadorSelector] = useState<{calle: number; posicion: number} | null>(null);
  
  // Configuración de distancia
  const [distancia, setDistancia] = useState<number>(100);
  const [parciales, setParciales] = useState<number>(4);
  
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [timersIniciados, setTimersIniciados] = useState(false);
  const [cronometroIniciado, setCronometroIniciado] = useState(false);
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const animationRef = useRef<number | null>(null);
  const timersRef = useRef<TimerState[]>([]);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchClientes = async () => {
      if (!user) return;
      try {
        const clientesRef = collection(db, 'users');
        const clientesQ = query(clientesRef, where('role', '==', 'cliente'));
        const clientesSnap = await getDocs(clientesQ);
        const clientesData: Cliente[] = clientesSnap.docs.map(doc => ({
          id: doc.id,
          nombre: doc.data().nombre || '',
        }));
        setClientes(clientesData.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      } catch (error) {
        console.error('Error fetching clientes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [user]);

  const getIntervalo = () => {
    if (showCustomIntervalo && customIntervalo) {
      return parseInt(customIntervalo) || 5;
    }
    return intervalo;
  };

  const addNadador = (cliente: Cliente, calle: number, posicion: number) => {
    const exists = nadadores.find(n => n.calle === calle && n.posicion === posicion);
    const clienteEnOtraPosicion = nadadores.find(n => n.clienteId === cliente.id);
    
    if (exists || clienteEnOtraPosicion) return;
    
    setNadadores([...nadadores, {
      id: `${calle}-${posicion}-${Date.now()}`,
      clienteId: cliente.id,
      nombre: cliente.nombre,
      calle,
      posicion,
    }]);
    setShowNadadorSelector(null);
    setSearchTerm('');
  };

  const removeNadador = (id: string) => {
    setNadadores(nadadores.filter(n => n.id !== id));
  };

  const getMaxPosicion = () => {
    if (nadadores.length === 0) return 1;
    return Math.max(...nadadores.map(n => n.posicion));
  };

  const iniciarSerie = () => {
    if (nadadores.length === 0) return;
    
    const tienePosicion1 = nadadores.some(n => n.posicion === 1);
    if (!tienePosicion1) {
      alert('Debe haber al menos un nadador en posición 1');
      return;
    }
    
    const sortedNadadores = [...nadadores].sort((a, b) => a.posicion - b.posicion);
    
    const initialTimers: TimerState[] = sortedNadadores.map(nadador => ({
      nadadorId: nadador.id,
      nombre: nadador.nombre,
      calle: nadador.calle,
      posicion: nadador.posicion,
      distancia,
      parciales,
      distanciaParcial: Math.round(distancia / parciales),
      estado: 'pending',
      tiempoInicio: null,
      tiempoFin: null,
      laps: [],
      tiempoActual: 0,
      countdown: null,
    }));
    
    setTimers(initialTimers);
    timersRef.current = initialTimers;
    setTimersIniciados(true);
    setCronometroIniciado(false);
    setActiveTab('ejecutar');
  };

  const startCronometro = () => {
    if (!timersIniciados || cronometroIniciado) return;
    
    setCronometroIniciado(true);
    startTimeRef.current = Date.now();
    
    const intervaloMs = getIntervalo() * 1000;
    const now = Date.now();
    
    setTimers(prev => {
      const updated = prev.map(timer => {
        const tiempoHastaSalida = (timer.posicion - 1) * intervaloMs;
        
        return {
          ...timer,
          estado: 'countdown' as const,
          countdown: tiempoHastaSalida,
          tiempoInicio: now + tiempoHastaSalida,
        };
      });
      timersRef.current = updated;
      return updated;
    });
    
    playBeep(440, 200);
    vibrate(100);
  };

  const updateTimers = useCallback(() => {
    const now = Date.now();
    const intervaloMs = getIntervalo() * 1000;
    
    setTimers(prevTimers => {
      const updated = prevTimers.map(timer => {
        if (timer.estado === 'countdown' && timer.countdown !== null && timer.tiempoInicio) {
          const tiempoRestante = timer.tiempoInicio - now;
          
          if (tiempoRestante <= 0) {
            if (sonidoActivo) {
              playBeep(880, 100);
              vibrate(50);
            }
            return {
              ...timer,
              estado: 'running' as const,
              tiempoInicio: now,
              countdown: null,
            };
          }
          
          const segundosRestantes = Math.ceil(tiempoRestante / 1000);
          
          if (segundosRestantes <= 3 && timer.countdown !== segundosRestantes) {
            if (sonidoActivo) {
              playBeep(660, 80);
              vibrate(30);
            }
          }
          
          return {
            ...timer,
            countdown: segundosRestantes,
          };
        }
        
        if (timer.estado === 'running' && timer.tiempoInicio) {
          return {
            ...timer,
            tiempoActual: now - timer.tiempoInicio,
          };
        }
        
        return timer;
      });
      
      timersRef.current = updated;
      return updated;
    });
    
    animationRef.current = requestAnimationFrame(updateTimers);
  }, [getIntervalo, sonidoActivo]);

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

  const marcarLap = (nadadorId: string) => {
    setTimers(prev => prev.map(timer => {
      if (timer.nadadorId === nadadorId && timer.estado === 'running' && timer.tiempoInicio) {
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

  const terminarNadador = (nadadorId: string) => {
    setTimers(prev => prev.map(timer => {
      if (timer.nadadorId === nadadorId && timer.estado === 'running') {
        return {
          ...timer,
          estado: 'finished',
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

  const marcarDNF = (nadadorId: string) => {
    setTimers(prev => prev.map(timer => {
      if (timer.nadadorId === nadadorId && timer.estado === 'running') {
        return {
          ...timer,
          estado: 'dnf',
          tiempoFin: Date.now(),
        };
      }
      return timer;
    }));
    if (sonidoActivo) {
      playBeep(200, 300);
      vibrate([100, 50, 100]);
    }
  };

  const todosFinalizados = timers.length > 0 && timers.every(t => t.estado === 'finished' || t.estado === 'dnf');

  const nuevaSerie = () => {
    setTimers([]);
    timersRef.current = [];
    setTimersIniciados(false);
    setActiveTab('configurar');
  };

  const reiniciarSerie = () => {
    setTimers([]);
    timersRef.current = [];
    setTimersIniciados(false);
    iniciarSerie();
  };

  const toggleExpanded = (nadadorId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(nadadorId)) {
        next.delete(nadadorId);
      } else {
        next.add(nadadorId);
      }
      return next;
    });
  };

  const clientesFiltrados = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const nadadoresOrdenadosPorPosicion = [...nadadores].sort((a, b) => a.posicion - b.posicion);
  const maxPosicion = getMaxPosicion();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-ocean-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ocean-800 flex items-center gap-2">
            🏊 Cronómetro
          </h1>
        </div>
        {timersIniciados && (
          <button
            onClick={() => setSonidoActivo(!sonidoActivo)}
            className={`p-2 rounded-lg ${sonidoActivo ? 'bg-ocean-100 text-ocean-600' : 'bg-gray-100 text-gray-400'}`}
          >
            {sonidoActivo ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Tabs */}
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

      {/* CONFIGURAR */}
      {activeTab === 'configurar' && (
        <div className="space-y-4">
          {/* Configuración básica */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-ocean-800 mb-4">Configuración</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Calles</label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={calles}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setCalles('');
                    } else {
                      const num = parseInt(val);
                      if (!isNaN(num)) {
                        setCalles(Math.min(8, Math.max(1, num)));
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ocean-700 mb-2">Intervalo (s)</label>
                {!showCustomIntervalo ? (
                  <select
                    value={intervalo}
                    onChange={(e) => setIntervalo(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  >
                    {INTERVALOS.map(i => (
                      <option key={i} value={i}>{i} segundos</option>
                    ))}
                    <option value="custom">Otro...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={customIntervalo}
                      onChange={(e) => setCustomIntervalo(e.target.value)}
                      className="flex-1 px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                      placeholder="Segundos"
                    />
                    <button
                      onClick={() => setShowCustomIntervalo(false)}
                      className="p-3 bg-ocean-100 text-ocean-600 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
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
                  min={1}
                  max={20}
                  value={parciales}
                  onChange={(e) => {
                    const num = parseInt(e.target.value);
                    if (!isNaN(num) && num > 0) {
                      setParciales(Math.min(20, num));
                    }
                  }}
                  className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                />
                <div className="text-xs text-ocean-500 mt-1">
                  {Math.round(distancia / parciales)}m cada parcial
                </div>
              </div>
            </div>
          </div>

          {/* Grid de asignación */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ocean-800">Nadadores por Calle y Posición</h2>
              <div className="text-sm text-ocean-500">
                Intervalo: {getIntervalo()}s entre posiciones
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header de posiciones */}
                <div className="flex border-b border-ocean-200 pb-2 mb-2">
                  <div className="w-20 font-medium text-ocean-600 text-sm">Calle</div>
                  {Array.from({ length: Math.max(6, maxPosicion) }, (_, i) => i + 1).map(pos => (
                    <div key={pos} className="flex-1 text-center font-medium text-ocean-600 text-sm">
                      Pos {pos}
                    </div>
                  ))}
                </div>

                {/* Filas de calles */}
                {calles === '' ? (
                  <div className="text-center py-4 text-ocean-400">
                    Ingresa el número de calles
                  </div>
                ) : (
                  Array.from({ length: calles }, (_, i) => i + 1).map(calleNum => (
                    <div key={calleNum} className="flex items-center py-2 border-b border-ocean-100">
                      <div className="w-20 font-medium text-ocean-800">Calle {calleNum}</div>
                      {Array.from({ length: Math.max(6, maxPosicion) }, (_, idx) => idx + 1).map(pos => {
                        const nadador = nadadores.find(n => n.calle === calleNum && n.posicion === pos);
                        return (
                          <div key={pos} className="flex-1 px-1">
                            {nadador ? (
                              <div className="bg-ocean-100 rounded-lg p-2 flex items-center justify-between">
                                <span className="text-sm font-medium text-ocean-800 truncate">{nadador.nombre}</span>
                                <button
                                  onClick={() => removeNadador(nadador.id)}
                                  className="text-ocean-400 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowNadadorSelector({ calle: calleNum, posicion: pos })}
                                className="w-full p-2 border-2 border-dashed border-ocean-200 rounded-lg text-ocean-400 hover:border-ocean-400 hover:text-ocean-600 text-sm"
                              >
                                + Añadir
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Botón añadir posición extra */}
            <button
              onClick={() => setNadadores([...nadadores])}
              className="mt-4 flex items-center gap-2 text-ocean-600 hover:text-ocean-800"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Añadir más posiciones si es necesario</span>
            </button>
          </div>

          {/* Botón iniciar */}
          {nadadores.length > 0 && (
            <button
              onClick={iniciarSerie}
              className="w-full py-4 bg-ocean-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-ocean-700"
            >
              <Play className="w-6 h-6" />
              Iniciar Serie
            </button>
          )}
        </div>
      )}

      {/* Selector de nadador modal */}
      {showNadadorSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ocean-800">
                Calle {showNadadorSelector.calle} - Posición {showNadadorSelector.posicion}
              </h2>
              <button onClick={() => setShowNadadorSelector(null)} className="text-ocean-400 hover:text-ocean-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ocean-400" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {clientesFiltrados.map(cliente => {
                const yaAsignado = nadadores.some(n => n.clienteId === cliente.id);
                return (
                  <button
                    key={cliente.id}
                    onClick={() => !yaAsignado && addNadador(cliente, showNadadorSelector.calle, showNadadorSelector.posicion)}
                    disabled={yaAsignado}
                    className={`w-full p-3 rounded-lg text-left flex items-center gap-3 ${
                      yaAsignado 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-ocean-50 text-ocean-800 hover:bg-ocean-100'
                    }`}
                  >
                    <div className="w-8 h-8 bg-ocean-200 rounded-full flex items-center justify-center">
                      <span className="text-ocean-600 font-medium">{cliente.nombre.charAt(0)}</span>
                    </div>
                    <span className="font-medium">{cliente.nombre}</span>
                    {yaAsignado && <span className="text-xs text-gray-400 ml-auto">Ya asignado</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EJECUTAR */}
      {activeTab === 'ejecutar' && timers.length > 0 && (
        <div className="space-y-2">
          {/* Botón START flotante */}
          {!cronometroIniciado && !todosFinalizados && (
            <button
              onClick={startCronometro}
              className="fixed bottom-6 right-6 w-16 h-16 bg-green-600 rounded-full shadow-lg flex flex-col items-center justify-center text-white text-xs font-bold hover:bg-green-700 active:scale-95 transition-transform z-50"
            >
              <Play className="w-6 h-6 mb-0.5" />
              START
            </button>
          )}

          {/* Info bar */}
          <div className="bg-ocean-600 text-white px-3 py-2 flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold">{distancia}m × {parciales}</span>
              <span className="opacity-75">|</span>
              <span>{timers.length}🚴</span>
              <span className="opacity-75">|</span>
              <span>{getIntervalo()}s int</span>
            </div>
            {!todosFinalizados && (
              <button onClick={reiniciarSerie} className="p-1 hover:bg-ocean-500 rounded">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Agrupar por posición */}
          {Array.from({ length: maxPosicion }, (_, i) => i + 1).map(pos => {
            const timersPosicion = timers.filter(t => t.posicion === pos).sort((a, b) => a.calle - b.calle);
            if (timersPosicion.length === 0) return null;
            
            const proximaPos = timers.find(t => t.posicion === pos + 1 && t.estado === 'countdown');
            
            return (
              <div key={pos} className="bg-white rounded-lg overflow-hidden">
                <div className="bg-ocean-50 px-2 py-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ocean-700">Pos {pos}</span>
                  {proximaPos && (
                    <span className="text-yellow-600 font-bold">{proximaPos.countdown}s</span>
                  )}
                </div>
                <div className={`flex flex-wrap gap-0.5 p-1 bg-ocean-100 rounded ${timersPosicion.length <= 2 ? 'justify-center' : ''}`}>
                  {timersPosicion.map((timer, idx) => (
                    <div key={timer.nadadorId} className="flex">
                      <div
                        className={`${timersPosicion.length === 1 ? 'min-w-[200px] w-[200px]' : timersPosicion.length === 2 ? 'min-w-[160px] w-[160px]' : 'min-w-[100px] flex-1'} rounded p-2 text-center ${timer.estado === 'pending' ? 'bg-gray-100' : timer.estado === 'countdown' ? 'bg-yellow-50' : timer.estado === 'running' ? 'bg-blue-50' : timer.estado === 'finished' ? 'bg-green-50' : 'bg-red-50'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`${timersPosicion.length <= 2 ? 'text-sm' : 'text-[10px]'} text-ocean-600 font-bold truncate ${timersPosicion.length <= 2 ? 'max-w-[100px]' : 'max-w-[60px]'}`}>{timer.nombre}</span>
                          <span className={`text-xs font-bold ${timer.estado === 'pending' ? 'text-gray-500' : timer.estado === 'countdown' ? 'text-yellow-700' : timer.estado === 'running' ? 'text-blue-700' : timer.estado === 'finished' ? 'text-green-700' : 'text-red-700'}`}>
                            {timer.estado === 'countdown' ? `${timer.countdown}s` : timer.estado === 'running' ? '🏃' : timer.estado === 'finished' ? '✓' : timer.estado === 'dnf' ? 'DNF' : '⏳'}
                          </span>
                        </div>
                        <div className={`${timersPosicion.length <= 2 ? 'text-sm' : 'text-[10px]'} text-ocean-400 mb-1`}>C{timer.calle}</div>
                        
                        <div className={`${timersPosicion.length <= 2 ? 'text-2xl' : 'text-base'} font-bold font-mono leading-tight`}>
                          {timer.estado === 'pending' ? <span className="text-gray-400 text-xs">--:--</span> : timer.estado === 'countdown' ? <span className="text-ocean-600">{timer.countdown}</span> : <span className={timer.estado === 'finished' ? 'text-green-600' : timer.estado === 'dnf' ? 'text-red-600' : 'text-ocean-800'}>{formatTime(timer.tiempoActual)}</span>}
                        </div>
                        
                        {timer.estado === 'running' && (
                          <div className="flex gap-1 mt-2">
                            <button onClick={() => marcarLap(timer.nadadorId)} className="flex-1 min-h-[56px] bg-ocean-600 text-white text-sm font-bold rounded active:scale-95 px-2 py-2">LAP</button>
                            <button onClick={() => terminarNadador(timer.nadadorId)} className="flex-1 min-h-[56px] bg-green-600 text-white text-sm font-bold rounded active:scale-95 px-2 py-2">STOP</button>
                            <button onClick={() => marcarDNF(timer.nadadorId)} className="flex-1 min-h-[56px] bg-red-500 text-white text-sm font-bold rounded active:scale-95 px-2 py-2">DNF</button>
                          </div>
                        )}
                        
                        {timer.estado === 'running' && (
                          <div className="text-xs text-ocean-400 mt-0.5">{timer.distancia}m</div>
                        )}
                        
                        {timer.laps.length > 0 && (
                          <button onClick={() => toggleExpanded(timer.nadadorId)} className="text-xs text-ocean-500 mt-1 hover:text-ocean-700">
                            {timer.laps.length}lap
                          </button>
                        )}
                      </div>
                      {idx < timersPosicion.length - 1 && (
                        <div className="w-1 bg-ocean-300 flex flex-col justify-center gap-0.5 mx-0.5">
                          <div className="h-2 w-full bg-ocean-400 rounded-sm"></div>
                          <div className="h-2 w-full bg-ocean-400 rounded-sm"></div>
                          <div className="h-2 w-full bg-ocean-400 rounded-sm"></div>
                          <div className="h-2 w-full bg-ocean-400 rounded-sm"></div>
                          <div className="h-2 w-full bg-ocean-400 rounded-sm"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {todosFinalizados && (
            <button
              onClick={() => setActiveTab('resultados')}
              className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:bg-green-700"
            >
              Ver Resultados
            </button>
          )}
        </div>
      )}

      {/* RESULTADOS */}
      {activeTab === 'resultados' && timers.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ocean-800 text-lg">Resultados Finales</h2>
              <div className="flex gap-2">
                <button
                  onClick={nuevaSerie}
                  className="flex items-center gap-2 px-4 py-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nueva Serie
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {timers
                .filter(t => t.estado === 'finished' || t.estado === 'dnf')
                .sort((a, b) => {
                  if (a.estado === 'dnf' && b.estado !== 'dnf') return 1;
                  if (b.estado === 'dnf' && a.estado !== 'dnf') return -1;
                  return a.tiempoActual - b.tiempoActual;
                })
                .map((timer, idx) => (
                  <div
                    key={timer.nadadorId}
                    className={`rounded-xl p-4 ${
                      timer.estado === 'finished' 
                        ? idx === 0 
                          ? 'bg-yellow-50 border-2 border-yellow-400' 
                          : 'bg-ocean-50'
                        : 'bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {timer.estado === 'finished' && idx < 3 && (
                          <span className="text-2xl">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-ocean-800">{timer.nombre}</p>
                          <p className="text-sm text-ocean-500">Calle {timer.calle} - Pos {timer.posicion}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {timer.estado === 'finished' ? (
                          <>
                            <p className="text-2xl font-bold font-mono text-ocean-800">
                              {formatTime(timer.tiempoActual)}
                            </p>
                            <button
                              onClick={() => toggleExpanded(timer.nadadorId)}
                              className="text-sm text-ocean-600 hover:text-ocean-800"
                            >
                              {expandedCards.has(timer.nadadorId) ? 'Ocultar' : 'Ver'} detalles
                            </button>
                          </>
                        ) : (
                          <p className="text-xl font-bold text-red-600">DNF</p>
                        )}
                      </div>
                    </div>
                    
                    {timer.estado === 'finished' && expandedCards.has(timer.nadadorId) && (
                      <div className="mt-3 pt-3 border-t border-ocean-200">
                        {timer.laps.length > 0 && (
                          <>
                            <p className="text-xs font-medium text-ocean-700 mb-2">Parciales</p>
                            <div className="grid grid-cols-2 gap-1 mb-3">
                              {timer.laps.map((lap, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                  <span className="text-ocean-500">{idx + 1} ({timer.distanciaParcial}m)</span>
                                  <span className="font-mono text-ocean-700">{formatTime(lap.tiempo)}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        {(() => {
                          const intermedios = calcularIntermedios(timer.laps, timer.distancia, timer.distanciaParcial, timer.tiempoActual);
                          if (intermedios.length > 0) {
                            return (
                              <>
                                <p className="text-xs font-medium text-ocean-700 mb-2">Tiempos Intermedios</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {intermedios.map((int, idx) => (
                                    <div key={idx} className={`flex justify-between text-xs px-2 py-1 rounded ${int.esReal ? 'bg-ocean-50' : 'bg-yellow-50'}`}>
                                      <span className={`${int.esReal ? 'text-ocean-600' : 'text-yellow-700'}`}>{int.distancia}m {int.esReal ? '' : '~'}</span>
                                      <span className={`font-mono ${int.esReal ? 'text-ocean-700' : 'text-yellow-700'}`}>{formatTime(int.tiempo)}</span>
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
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}