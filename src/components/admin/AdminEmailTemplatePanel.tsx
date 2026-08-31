// src/components/admin/AdminEmailTemplatePanel.tsx
import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { fetchEmailTemplate, saveEmailTemplate } from '../../lib/supabaseQueries';
import {
  DEFAULT_TEMPLATES,
  generarCuerpoEmail,
  generarCuerpoRecordatorio,
  type EmailTemplate,
} from '../../utils/emailService';
import { logger } from '../../utils/sanitize';

type TipoPlantilla = 'reporte' | 'recordatorio';
type ModoEdicion = 'visual' | 'html';

const CONFIG: Record<TipoPlantilla, { titulo: string; descripcion: string; placeholders: { token: string; label: string }[] }> = {
  reporte: {
    titulo: '📄 Reporte de Evaluación',
    descripcion: 'Se envía cuando se comparte el reporte PDF final de la evaluación de desempeño.',
    placeholders: [
      { token: '{{nombre}}', label: 'Nombre del evaluado' },
      { token: '{{resumen_tabla}}', label: 'Tabla de puntajes (no editable)' },
      { token: '{{comentario_rrhh}}', label: 'Observaciones de RRHH' },
    ],
  },
  recordatorio: {
    titulo: '⏰ Recordatorio de Evaluación Pendiente',
    descripcion: 'Se envía a quienes todavía no completaron su evaluación desde la sección "Pendientes de Evaluación".',
    placeholders: [
      { token: '{{nombre}}', label: 'Nombre de la persona' },
    ],
  },
};

interface FormState {
  asunto: string;
  cuerpoHtml: string;
}

function toFormState(t: EmailTemplate): FormState {
  return { asunto: t.asunto, cuerpoHtml: t.cuerpoHtml };
}

export default function AdminEmailTemplatePanel() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState<TipoPlantilla>('reporte');
  const [modo, setModo] = useState<ModoEdicion>('visual');
  const [forms, setForms] = useState<Record<TipoPlantilla, FormState>>({
    reporte: toFormState(DEFAULT_TEMPLATES.reporte),
    recordatorio: toFormState(DEFAULT_TEMPLATES.recordatorio),
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [syncTick, setSyncTick] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visualInsertRef = useRef<((texto: string) => void) | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [reporte, recordatorio] = await Promise.all([
          fetchEmailTemplate('reporte'),
          fetchEmailTemplate('recordatorio'),
        ]);
        setForms({
          reporte: toFormState(reporte || DEFAULT_TEMPLATES.reporte),
          recordatorio: toFormState(recordatorio || DEFAULT_TEMPLATES.recordatorio),
        });
        setSyncTick(t => t + 1);
      } catch (err) {
        logger.error('Error loading email templates:', err);
        setError('No se pudieron cargar las plantillas guardadas. Se muestran los valores predeterminados.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = forms[tab];
  const config = CONFIG[tab];

  const updateCurrent = (patch: Partial<FormState>) => {
    setForms(prev => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  };

  const handleCambiarTab = (nuevoTab: TipoPlantilla) => {
    setTab(nuevoTab);
    setError('');
    setSavedMsg('');
    setSyncTick(t => t + 1);
  };

  const handleRestaurarDefault = () => {
    updateCurrent(toFormState(DEFAULT_TEMPLATES[tab]));
    setSavedMsg('');
    setSyncTick(t => t + 1);
  };

  const handleCambiarModo = (nuevoModo: ModoEdicion) => {
    setModo(nuevoModo);
    if (nuevoModo === 'visual') setSyncTick(t => t + 1);
  };

  const insertarPlaceholder = (token: string) => {
    if (modo === 'visual') {
      visualInsertRef.current?.(token);
      return;
    }
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const nuevoValor = el.value.slice(0, start) + token + el.value.slice(end);
    updateCurrent({ cuerpoHtml: nuevoValor });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.selectionStart = el.selectionEnd = pos;
    });
  };

  const handleGuardar = async () => {
    if (!current.asunto.trim() || !current.cuerpoHtml.trim()) {
      setError('El asunto y el cuerpo no pueden estar vacíos.');
      return;
    }
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await saveEmailTemplate(tab, current, currentUser?.email || 'desconocido');
      setSavedMsg('✅ Plantilla guardada correctamente.');
    } catch (err: any) {
      setError(`Error al guardar la plantilla. ${err?.message || 'Verificá permisos.'}`);
    } finally {
      setSaving(false);
    }
  };

  const preview = tab === 'reporte'
    ? generarCuerpoEmail('Nombre de Ejemplo', undefined, {
        promedioAuto: 3.4,
        promedioJefe: 3.6,
        promedioFinal: 3.5,
        seniorityAlcanzado: 'Semi Senior',
      }, current)
    : generarCuerpoRecordatorio('Nombre de Ejemplo', current);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <p className="mt-4 text-stone-600">Cargando plantillas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-slate-900">Plantillas de Email</h2>
      </div>

      <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
        {(Object.keys(CONFIG) as TipoPlantilla[]).map(key => (
          <button
            key={key}
            onClick={() => handleCambiarTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {CONFIG[key].titulo}
          </button>
        ))}
      </div>

      <p className="text-sm text-stone-600">{config.descripcion}</p>

      {error && (
        <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {savedMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulario */}
        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">Asunto</label>
            <input
              type="text"
              value={current.asunto}
              onChange={e => updateCurrent({ asunto: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-stone-700">Cuerpo del mensaje</label>
              <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => handleCambiarModo('visual')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    modo === 'visual' ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Editor visual
                </button>
                <button
                  type="button"
                  onClick={() => handleCambiarModo('html')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    modo === 'html' ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  HTML avanzado
                </button>
              </div>
            </div>

            {modo === 'visual' ? (
              <VisualEditorConInsert
                html={current.cuerpoHtml}
                onChange={html => updateCurrent({ cuerpoHtml: html })}
                syncTick={syncTick}
                insertRef={visualInsertRef}
              />
            ) : (
              <textarea
                ref={textareaRef}
                value={current.cuerpoHtml}
                onChange={e => updateCurrent({ cuerpoHtml: e.target.value })}
                rows={16}
                className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono text-xs resize-y"
              />
            )}
            <p className="mt-1 text-xs text-stone-400">
              {modo === 'visual'
                ? 'Escribí como en un documento de texto. Seleccioná una palabra y usá los botones de arriba para resaltarla.'
                : 'Modo para quienes prefieren editar las etiquetas HTML directamente. No hace falta usarlo — con el editor visual alcanza.'}
            </p>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <strong>Placeholders disponibles</strong> — tocá uno para insertarlo donde tengas el cursor:
            <div className="flex flex-wrap gap-1.5 mt-2">
              {config.placeholders.map(p => (
                <button
                  key={p.token}
                  type="button"
                  title={p.label}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => insertarPlaceholder(p.token)}
                  className="px-2 py-1 bg-white border border-blue-200 rounded-md font-mono hover:bg-blue-100 transition-colors"
                >
                  {p.token}
                </button>
              ))}
            </div>
            <p className="mt-2">El encabezado y pie con la marca KELSOFT se agregan automáticamente; no hace falta incluirlos acá.</p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={handleRestaurarDefault}
              className="px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 text-sm font-semibold"
            >
              Restaurar predeterminado
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Vista previa */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-wide">Vista previa (con datos de ejemplo)</p>
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <iframe
              title="Vista previa de email"
              srcDoc={preview}
              sandbox=""
              className="w-full"
              style={{ height: '520px', border: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wrapper que expone la función de inserción de placeholders del editor visual al padre */
function VisualEditorConInsert({
  html,
  onChange,
  syncTick,
  insertRef,
}: {
  html: string;
  onChange: (html: string) => void;
  syncTick: number;
  insertRef: React.MutableRefObject<((texto: string) => void) | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTick]);

  const handleInput = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const exec = (comando: string) => {
    ref.current?.focus();
    document.execCommand(comando);
    handleInput();
  };

  useEffect(() => {
    insertRef.current = (texto: string) => {
      const el = ref.current;
      if (!el) return;

      // Si todavía no hay un cursor puesto dentro del editor (nunca se clickeó
      // adentro), hay que ubicarlo antes de enfocar — el foco por sí solo ya
      // crea un cursor en la posición 0, así que hay que chequear antes.
      const selection = window.getSelection();
      const hayCursorDentro = selection && selection.rangeCount > 0 && el.contains(selection.getRangeAt(0).startContainer);
      el.focus();
      if (!hayCursorDentro && selection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      document.execCommand('insertText', false, texto);
      handleInput();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex gap-1 mb-2 p-1 bg-stone-50 border border-stone-200 rounded-lg w-fit">
        <button
          type="button"
          title="Negrita"
          onMouseDown={e => e.preventDefault()}
          onClick={() => exec('bold')}
          className="w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm text-stone-700 hover:bg-stone-200"
        >
          N
        </button>
        <button
          type="button"
          title="Cursiva"
          onMouseDown={e => e.preventDefault()}
          onClick={() => exec('italic')}
          className="w-8 h-8 flex items-center justify-center rounded-md italic text-sm text-stone-700 hover:bg-stone-200"
        >
          K
        </button>
        <button
          type="button"
          title="Subrayado"
          onMouseDown={e => e.preventDefault()}
          onClick={() => exec('underline')}
          className="w-8 h-8 flex items-center justify-center rounded-md underline text-sm text-stone-700 hover:bg-stone-200"
        >
          S
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="w-full min-h-[280px] px-4 py-3 border border-stone-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm leading-relaxed [&_p]:mb-3"
      />
    </div>
  );
}
