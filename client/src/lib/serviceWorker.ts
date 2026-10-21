/** Registro del Service Worker: únicamente en producción. */
export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // El registro fallido no debe interrumpir la aplicación
    });
  });
};

/** Elimina los datos de negocio cacheados (al cerrar sesión). */
export const clearDataCache = () => {
  navigator.serviceWorker?.controller?.postMessage('CLEAR_DATA_CACHE');
};
