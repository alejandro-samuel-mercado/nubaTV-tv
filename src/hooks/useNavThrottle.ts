/**
 * useNavThrottle — Sistema de foco para Android TV
 *
 * Proporciona el handle del sidebar como estado reactivo para que
 * los componentes que lo usan (TVHeroBanner) se re-rendericen cuando esté listo.
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
        // Sincronizar si ya estaba disponible antes de montar
        setHandle(globalSidebarNodeHandle);
        _subscribers.add(setHandle);
        return () => { _subscribers.delete(setHandle); };
    }, []);
    return handle;
}

// Stubs por compatibilidad (ya no hacen nada pesado)
export function registerFocusable(_id: string, _ref: any) {}
export function unregisterFocusable(_id: string) {}
export function handleGlobalFocus(_id: string, onFocusExecute: () => void) { onFocusExecute(); }
export function cancelGlobalFocus(_id: string) {}
export function resetNavThrottle() {}
export { resetNavThrottle as resetNavLock };
