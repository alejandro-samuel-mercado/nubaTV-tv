/**
 * useNavThrottle — Sistema de foco y estabilización para Android TV
 *
 * Proporciona el handle del sidebar como estado reactivo para que
 * los componentes que lo usan se re-rendericen cuando esté listo.
 * Además ofrece utilidades para estabilizar la navegación rápida con D-pad.
 */

import React from 'react';

// Handle a nivel módulo (sincrónico)
export let globalSidebarNodeHandle: number | null = null;

// Suscriptores React — se llaman cuando el handle cambia
const _subscribers = new Set<(handle: number | null) => void>();

export function setGlobalSidebarNodeHandle(handle: number | null) {
  globalSidebarNodeHandle = handle;
  _subscribers.forEach((fn) => fn(handle));
}

/**
 * Hook: retorna el handle del sidebar como estado reactivo.
 * El componente que lo use se re-renderizará cuando el sidebar esté listo.
 */
export function useSidebarHandle(): number | null {
  const [handle, setHandle] = React.useState<number | null>(globalSidebarNodeHandle);
  React.useEffect(() => {
    setHandle(globalSidebarNodeHandle);
    _subscribers.add(setHandle);
    return () => { _subscribers.delete(setHandle); };
  }, []);
  return handle;
}

// Control de throttle global para callbacks de navegación rápida
let _globalFocusTimer: any = null;

export function registerFocusable(_id: string, _ref: any) {}
export function unregisterFocusable(_id: string) {}

export function handleGlobalFocus(_id: string, onFocusExecute: () => void, delayMs = 80) {
  if (_globalFocusTimer) {
    clearTimeout(_globalFocusTimer);
    _globalFocusTimer = null;
  }
  _globalFocusTimer = setTimeout(() => {
    _globalFocusTimer = null;
    onFocusExecute();
  }, delayMs);
}

export function cancelGlobalFocus(_id?: string) {
  if (_globalFocusTimer) {
    clearTimeout(_globalFocusTimer);
    _globalFocusTimer = null;
  }
}

export function resetNavThrottle() {
  cancelGlobalFocus();
}
export { resetNavThrottle as resetNavLock };
