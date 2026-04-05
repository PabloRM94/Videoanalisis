'use client';

import { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';

// Tipos
export interface TareaFormData {
  nombre: string;
  objetivo: string[];
  material: string;
  metros: string;
  descripcion: string;
}

export interface Tarea {
  id: string;
  nombre: string;
  objetivo: string[];
  material: string;
  metros: number;
  descripcion?: string;
}

export interface TareaFormProps {
  tarea?: Tarea | null;
  onSave: (data: TareaFormData) => Promise<void>;
  onCancel?: () => void;
  readOnly?: boolean;
  loading?: boolean;
}

// Opciones
const objetivosOpciones = [
  'CLNT',
  'TEC',
  'AEL',
  'AEM',
  'AEI',
  'VEL',
  'REST',
  'ANA',
  'PAL',
  'PLAC',
  'CAL',
  'CLAC',
  'INI',
  'CROSS',
  'FUER',
];

const MATERIAL_ALIASES: Record<string, string> = {
  'pull': 'Pullboy', 'Pull': 'Pullboy', 'pullboy': 'Pullboy', 'pull boy': 'Pullboy', 'Pull boy': 'Pullboy',
};
const normalizeMaterial = (m: string): string => MATERIAL_ALIASES[m.trim()] ?? m;

const materialOpciones = [
  'Tabla',
  'Aletas',
  'Pullboy',
  'Churumbela',
  'Bola',
  'Cuerda',
  'Pletinas',
  'Nadador',
  'Otro',
  'Sin material',
];

export default function TareaForm({ tarea, onSave, onCancel, readOnly = false, loading = false }: TareaFormProps) {
  const [formData, setFormData] = useState<TareaFormData>({
    nombre: '',
    objetivo: [],
    material: '',
    metros: '',
    descripcion: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Inicializar con datos existentes
  useEffect(() => {
    if (tarea) {
      setFormData({
        nombre: tarea.nombre,
        objetivo: Array.isArray(tarea.objetivo) ? tarea.objetivo : [tarea.objetivo].filter(Boolean),
        material: tarea.material,
        metros: tarea.metros?.toString() || '',
        descripcion: tarea.descripcion || '',
      });
    }
  }, [tarea]);

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleObjetivoToggle = (obj: string) => {
    const nuevos = formData.objetivo.includes(obj)
      ? formData.objetivo.filter(o => o !== obj)
      : [...formData.objetivo, obj];
    setFormData({ ...formData, objetivo: nuevos });
  };

  const isDisabled = readOnly || isSaving || loading;

  return (
    <div className="space-y-4">
      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-ocean-700 mb-2">
          Nombre * (Ctrl+Enter para salto de línea)
        </label>
        <textarea
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault();
              const textarea = e.target as HTMLTextAreaElement;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const value = textarea.value;
              const newValue = value.substring(0, start) + '\n' + value.substring(end);
              setFormData({ ...formData, nombre: newValue });
              setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
              }, 0);
            }
          }}
          placeholder="Ej: 4x50 crol&#10;50 suave&#10;4x25 pies"
          rows={3}
          disabled={isDisabled}
          className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none font-mono text-sm disabled:bg-ocean-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Objetivos */}
      <div>
        <label className="block text-sm font-medium text-ocean-700 mb-2">
          Objetivos
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {objetivosOpciones.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${
                formData.objetivo.includes(opt)
                  ? 'border-ocean-500 bg-ocean-50'
                  : 'border-ocean-200 hover:border-ocean-300'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={formData.objetivo.includes(opt)}
                onChange={() => handleObjetivoToggle(opt)}
                disabled={isDisabled}
                className="w-4 h-4 text-ocean-600 rounded focus:ring-ocean-500"
              />
              <span className="text-sm text-ocean-700">{opt}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Metros y Material */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">
            Metros
          </label>
          <input
            type="number"
            value={formData.metros}
            onChange={(e) => setFormData({ ...formData, metros: e.target.value })}
            placeholder="0"
            disabled={isDisabled}
            className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 disabled:bg-ocean-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ocean-700 mb-2">
            Material
          </label>
          <select
            value={formData.material}
            onChange={(e) => setFormData({ ...formData, material: e.target.value })}
            disabled={isDisabled}
            className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 disabled:bg-ocean-50 disabled:cursor-not-allowed"
          >
            <option value="">Seleccionar</option>
            {materialOpciones.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-ocean-700 mb-2">
          Descripción
        </label>
        <textarea
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          rows={3}
          placeholder="Notas adicionales..."
          disabled={isDisabled}
          className="w-full px-4 py-3 border border-ocean-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500 resize-none disabled:bg-ocean-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isDisabled}
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-ocean-200 text-ocean-600 rounded-lg hover:bg-ocean-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled || !formData.nombre.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving || loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {tarea ? 'Guardar Cambios' : 'Crear Tarea'}
        </button>
      </div>
    </div>
  );
}