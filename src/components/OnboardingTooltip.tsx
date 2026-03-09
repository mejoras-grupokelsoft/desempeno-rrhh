// src/components/OnboardingTooltip.tsx
import { useState, useEffect, useCallback, useRef } from 'react';

export interface TooltipStep {
  id: string;          // debe coincidir con data-onboarding="<id>" en el DOM
  title: string;
  description: string;
  icon?: string;
}

interface OnboardingTooltipProps {
  steps: TooltipStep[];
  storageKey: string;
  /** Se llama ANTES de mostrar cada step. Permite al padre preparar el DOM
   *  (ej: cambiar de tab) para que el target exista cuando se busque. */
  onStepChange?: (step: TooltipStep) => void;
}

interface Position {
  top: number;
  left: number;
  placement: 'above' | 'below';
  arrowLeft: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 370;
const TOOLTIP_GAP = 14;
const SPOTLIGHT_PADDING = 8;
const MAX_TARGET_HEIGHT = 300;
const MAX_RETRIES = 6;
const RETRY_DELAY = 200;

function getTargetEl(stepId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-onboarding="${stepId}"]`);
}

function clampRect(rect: DOMRect): DOMRect {
  if (rect.height <= MAX_TARGET_HEIGHT) return rect;
  return new DOMRect(rect.left, rect.top, rect.width, MAX_TARGET_HEIGHT);
}

function computePosition(targetRect: DOMRect): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tooltipEstimatedHeight = 220;
  const ref = clampRect(targetRect);

  let left = ref.left + ref.width / 2 - TOOLTIP_WIDTH / 2;
  left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12));

  const arrowLeft = Math.max(
    24,
    Math.min(ref.left + ref.width / 2 - left, TOOLTIP_WIDTH - 24)
  );

  const spaceAbove = ref.top;
  if (spaceAbove >= tooltipEstimatedHeight + TOOLTIP_GAP) {
    return {
      top: ref.top - tooltipEstimatedHeight - TOOLTIP_GAP,
      left,
      placement: 'above',
      arrowLeft,
    };
  }

  const belowTop = ref.bottom + TOOLTIP_GAP;
  const maxTop = vh - tooltipEstimatedHeight - 20;
  return { top: Math.min(belowTop, maxTop), left, placement: 'below', arrowLeft };
}

function getSpotlightRect(targetRect: DOMRect): SpotlightRect {
  return {
    top: targetRect.top - SPOTLIGHT_PADDING,
    left: targetRect.left - SPOTLIGHT_PADDING,
    width: targetRect.width + SPOTLIGHT_PADDING * 2,
    height: targetRect.height + SPOTLIGHT_PADDING * 2,
  };
}

export default function OnboardingTooltip({ steps, storageKey, onStepChange }: OnboardingTooltipProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [ready, setReady] = useState(false);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);
  // Refs estables para evitar que los effects se re-disparen cuando el padre re-renderiza
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed && steps.length > 0) {
      setVisible(true);
    }
  }, [storageKey, steps.length]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setPosition(null);
    setSpotlight(null);
    setReady(false);
    localStorage.setItem(storageKey, 'true');
  }, [storageKey]);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    isScrollingRef.current = false;
  }, []);

  // Effect principal: cuando cambia currentStep, ocultar → notificar padre → posicionar
  useEffect(() => {
    if (!visible) return;
    const allSteps = stepsRef.current;
    const step = allSteps[currentStep];
    if (!step) return;

    // Ocultar durante transicion
    setReady(false);
    clearTimers();

    // Notificar al padre para que prepare el DOM
    if (onStepChangeRef.current) onStepChangeRef.current(step);

    const applyPosition = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      setPosition(computePosition(rect));
      setSpotlight(getSpotlightRect(rect));
      setReady(true);
    };

    const tryPosition = (attempt: number) => {
      const el = getTargetEl(step.id);
      if (el && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;

        // Solo necesitamos que la PARTE SUPERIOR del elemento sea visible,
        // porque el tooltip se posiciona cerca del top (clampRect a 300px).
        // Para elementos altos (radar, metricas) el bottom puede estar muy
        // abajo pero el top ya es visible → no hace falta scrollear.
        const topVisible = rect.top >= -50 && rect.top <= vh - 100;

        if (!topVisible) {
          isScrollingRef.current = true;
          // Scroll manual al top del elemento con margen, en vez de
          // scrollIntoView({ block: 'center' }) que centra elementos enormes
          // causando saltos erraticos.
          const targetScrollY = window.scrollY + rect.top - 80;
          window.scrollTo({ top: Math.max(0, targetScrollY), behavior: 'smooth' });

          let lastTop = rect.top;
          let stableCount = 0;
          const trackScroll = () => {
            const cur = el.getBoundingClientRect();
            if (Math.abs(cur.top - lastTop) < 1) {
              stableCount++;
            } else {
              stableCount = 0;
            }
            lastTop = cur.top;

            if (stableCount >= 3) {
              isScrollingRef.current = false;
              scrollRafRef.current = null;
              applyPosition(el);
            } else {
              scrollRafRef.current = requestAnimationFrame(trackScroll);
            }
          };
          scrollRafRef.current = requestAnimationFrame(trackScroll);
        } else {
          applyPosition(el);
        }
        return;
      }

      // Target no encontrado
      if (attempt < MAX_RETRIES) {
        retryTimerRef.current = setTimeout(() => tryPosition(attempt + 1), RETRY_DELAY);
      } else {
        // Saltar al siguiente step con target visible
        let next = currentStep + 1;
        while (next < allSteps.length) {
          const nextEl = getTargetEl(allSteps[next].id);
          if (nextEl && nextEl.offsetParent !== null) break;
          next++;
        }
        if (next < allSteps.length) {
          // Notificar para el nuevo step y dejar que el effect se re-dispare
          if (onStepChangeRef.current) onStepChangeRef.current(allSteps[next]);
          retryTimerRef.current = setTimeout(() => setCurrentStep(next), 80);
        } else {
          handleDismiss();
        }
      }
    };

    // Dar tiempo al padre para re-renderizar tras onStepChange
    const startTimer = setTimeout(() => tryPosition(0), 80);

    return () => {
      clearTimeout(startTimer);
      clearTimers();
    };
    // Solo depende de currentStep y visible — los refs evitan re-disparos por el padre
  }, [currentStep, visible, handleDismiss, clearTimers]);

  // Reposicionar en scroll/resize (solo cuando esta listo y estable)
  useEffect(() => {
    if (!visible || !ready) return;

    const handler = () => {
      if (isScrollingRef.current) return;
      const step = stepsRef.current[currentStep];
      if (!step) return;
      const el = getTargetEl(step.id);
      if (el && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        setPosition(computePosition(rect));
        setSpotlight(getSpotlightRect(rect));
      }
    };

    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [visible, ready, currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  }, [currentStep, steps.length, handleDismiss]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // Mientras reposiciona: overlay oscuro sin spotlight ni tooltip (evita saltos)
  if (!ready || !position) {
    return (
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      />
    );
  }

  const clipPath = spotlight
    ? `polygon(
        0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
        ${spotlight.left}px ${spotlight.top}px,
        ${spotlight.left}px ${spotlight.top + spotlight.height}px,
        ${spotlight.left + spotlight.width}px ${spotlight.top + spotlight.height}px,
        ${spotlight.left + spotlight.width}px ${spotlight.top}px,
        ${spotlight.left}px ${spotlight.top}px
      )`
    : undefined;

  return (
    <>
      {/* Overlay oscuro con spotlight */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: 'rgba(0,0,0,0.45)',
          clipPath,
        }}
        onClick={handleDismiss}
      />

      {/* Borde luminoso */}
      {spotlight && (
        <div
          className="fixed z-40 rounded-xl border-2 border-indigo-400 pointer-events-none"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 2px rgba(99,102,241,0.3)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-50"
        style={{
          top: position.top,
          left: position.left,
          width: TOOLTIP_WIDTH,
        }}
      >
        <div className="relative rounded-2xl bg-white p-5 shadow-2xl border border-stone-200">
          {/* Flecha */}
          <div
            className="absolute w-3 h-3 bg-white border-stone-200 rotate-45"
            style={{
              left: position.arrowLeft - 6,
              ...(position.placement === 'above'
                ? { bottom: -7, borderRight: '1px solid #e7e5e4', borderBottom: '1px solid #e7e5e4' }
                : { top: -7, borderLeft: '1px solid #e7e5e4', borderTop: '1px solid #e7e5e4' }),
            }}
          />

          {/* Boton cerrar */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Icono */}
          <div className="mb-2 text-2xl">{step.icon || ''}</div>

          {/* Indicador de pasos */}
          <div className="mb-2 flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`inline-block h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-5 bg-indigo-500' : 'w-1.5 bg-gray-300'
                }`}
              />
            ))}
            <span className="ml-auto text-xs text-gray-400">
              {currentStep + 1}/{steps.length}
            </span>
          </div>

          {/* Contenido */}
          <h3 className="mb-1 text-base font-semibold text-gray-800">{step.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-gray-500">{step.description}</p>

          {/* Botones */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={isFirst}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                isFirst
                  ? 'cursor-default text-transparent'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Anterior
            </button>

            <button
              onClick={handleNext}
              className="rounded-xl bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white shadow-md transition-colors hover:bg-indigo-700"
            >
              {isLast ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
