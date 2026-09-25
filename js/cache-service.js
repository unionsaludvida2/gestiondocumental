/**
 * Módulo de Persistencia y Caché de Alto Rendimiento (IndexedDB + Stale-While-Revalidate)
 * Sistema de Gestión Documental - Unión para la salud y la vida S.A.S.
 * 
 * Permite carga instantánea a 0 ms (offline-first), almacenamiento masivo sin límite
 * de 5MB de localStorage, y sincronización resiliente de telemetría de auditoría.
 */

const DB_NAME = 'SGC_GestionDocumental_DB';
const DB_VERSION = 1;

class CacheService {
  constructor() {
    this.db = null;
    this.estaDisponible = typeof window !== 'undefined' && 'indexedDB' in window;
    this._initPromise = null;
  }

  /**
   * Inicializa la base de datos IndexedDB
   */
  async init() {
    if (!this.estaDisponible) return false;
    if (this.db) return true;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          // 1. Almacén para el catálogo completo de documentos
          if (!db.objectStoreNames.contains('documentos')) {
            db.createObjectStore('documentos', { keyPath: 'codigo' });
          }
          // 2. Almacén para colecciones de datos pesados (empleados, auditoría, histórico, configuración)
          if (!db.objectStoreNames.contains('colecciones')) {
            db.createObjectStore('colecciones', { keyPath: 'clave' });
          }
          // 3. Cola de eventos de auditoría no bloqueantes (telemetría offline)
          if (!db.objectStoreNames.contains('colaAuditoria')) {
            db.createObjectStore('colaAuditoria', { keyPath: 'id', autoIncrement: true });
          }
        };

        req.onsuccess = (e) => {
          this.db = e.target.result;
          this.db.onversionchange = () => {
            this.db.close();
            this.db = null;
          };
          resolve(true);
        };

        req.onerror = (e) => {
          console.warn('[CacheService] IndexedDB no disponible o bloqueado por el navegador. Activando fallback a localStorage.', e.target?.error);
          this.estaDisponible = false;
          resolve(false);
        };
      } catch (err) {
        console.warn('[CacheService] Excepción inicializando IndexedDB:', err);
        this.estaDisponible = false;
        resolve(false);
      }
    });

    return this._initPromise;
  }

  /**
   * Guarda una colección estructurada en caché (empleados, histórico, auditoría, configuración)
   */
  async guardarColeccion(clave, datos, meta = {}) {
    if (!clave) return false;
    const item = {
      clave,
      datos,
      timestamp: Date.now(),
      fecha: new Date().toISOString(),
      meta
    };

    const idbListo = await this.init();
    if (idbListo && this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['colecciones'], 'readwrite');
          const store = tx.objectStore('colecciones');
          store.put(item);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (e) {
          resolve(false);
        }
      });
    }

    // Fallback secundario a localStorage si es pequeño
    try {
      if (typeof datos === 'object') {
        const str = JSON.stringify(datos);
        if (str.length < 3000000) { // Menor a 3MB
          localStorage.setItem(`idb_fallback_${clave}`, str);
        }
      }
    } catch { }
    return false;
  }

  /**
   * Obtiene una colección estructurada desde IndexedDB
   */
  async obtenerColeccion(clave) {
    if (!clave) return null;
    const idbListo = await this.init();

    if (idbListo && this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['colecciones'], 'readonly');
          const store = tx.objectStore('colecciones');
          const req = store.get(clave);
          req.onsuccess = () => {
            const res = req.result;
            resolve(res ? res.datos : null);
          };
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    }

    // Fallback localStorage
    try {
      const raw = localStorage.getItem(`idb_fallback_${clave}`);
      if (raw) return JSON.parse(raw);
    } catch { }
    return null;
  }

  /**
   * Guarda el lote completo de documentos del catálogo de forma indexada
   */
  async guardarDocumentos(listaDocumentos) {
    if (!Array.isArray(listaDocumentos) || listaDocumentos.length === 0) return false;
    const idbListo = await this.init();
    if (!idbListo || !this.db) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['documentos'], 'readwrite');
        const store = tx.objectStore('documentos');
        // Limpiar para refresco fiel
        store.clear();
        for (const doc of listaDocumentos) {
          if (doc && doc.codigo) {
            store.put(doc);
          }
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Obtiene todos los documentos almacenados en el catálogo local
   */
  async obtenerDocumentos() {
    const idbListo = await this.init();
    if (!idbListo || !this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['documentos'], 'readonly');
        const store = tx.objectStore('documentos');
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Encola un evento de auditoría para sincronización asíncrona segura (Telemetría sin bloqueo)
   */
  async encolarEventoAuditoria(evento) {
    if (!evento) return false;
    const idbListo = await this.init();
    if (!idbListo || !this.db) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['colaAuditoria'], 'readwrite');
        const store = tx.objectStore('colaAuditoria');
        store.add({
          evento,
          timestamp: Date.now()
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * Obtiene todos los eventos de auditoría pendientes por enviar
   */
  async obtenerColaAuditoria() {
    const idbListo = await this.init();
    if (!idbListo || !this.db) return [];

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['colaAuditoria'], 'readonly');
        const store = tx.objectStore('colaAuditoria');
        const req = store.getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  /**
   * Limpia los eventos que ya fueron confirmados y sincronizados
   */
  async limpiarColaAuditoria(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const idbListo = await this.init();
    if (!idbListo || !this.db) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['colaAuditoria'], 'readwrite');
        const store = tx.objectStore('colaAuditoria');
        for (const id of ids) {
          store.delete(id);
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }
}

export const cacheService = new CacheService();
