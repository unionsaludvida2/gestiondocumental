/**
 * Módulo de Persistencia y Caché de Alto Rendimiento (IndexedDB + Stale-While-Revalidate)
 * Sistema de Gestión Documental - Unión para la salud y la vida S.A.S.
 * 
 * Permite carga instantánea a 0 ms (offline-first), almacenamiento masivo sin límite
 * de 5MB de localStorage, y sincronización resiliente de telemetría de auditoría.
 */

const DB_NAME = 'SGC_GestionDocumental_DB';
const DB_VERSION = 2;

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
          // 4. Cola de mutaciones documentales pendientes (Offline Outbox para creación/edición/eliminación)
          if (!db.objectStoreNames.contains('colaMutaciones')) {
            db.createObjectStore('colaMutaciones', { keyPath: 'id', autoIncrement: true });
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
   * Obtiene una colección estructurada con sus metadatos (timestamp, meta) desde IndexedDB
   */
  async obtenerColeccionConMeta(clave) {
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
            resolve(res ? { datos: res.datos, timestamp: res.timestamp, fecha: res.fecha, meta: res.meta } : null);
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
      if (raw) {
        const datos = JSON.parse(raw);
        const ts = parseInt(localStorage.getItem(`idb_fallback_${clave}_ts`) || '0', 10);
        return { datos, timestamp: ts };
      }
    } catch { }
    return null;
  }

  /**
   * Obtiene una colección estructurada desde IndexedDB
   */
  async obtenerColeccion(clave) {
    const res = await this.obtenerColeccionConMeta(clave);
    return res ? res.datos : null;
  }


  /**
   * Patrón Stale-While-Revalidate no volátil con TTL en IndexedDB:
   * 1. Si existe en IndexedDB y el TTL (por defecto 24 horas = 86,400,000 ms) está vigente, entrega inmediata a 0 ms.
   * 2. Si existe pero expiró, entrega inmediata a 0 ms y revalida de forma asíncrona en segundo plano sin congelar la interfaz.
   * 3. Si no existe o se fuerza refresco, consulta la red, persiste en IndexedDB y retorna los datos.
   */
  async obtenerOConsultarCachePersistente(clave, fetcher, ttlMs = 86400000, forzar = false) {
    const cached = await this.obtenerColeccionConMeta(clave);
    const ahora = Date.now();
    const esValida = cached && cached.datos && (ahora - (cached.timestamp || 0) < ttlMs);

    if (esValida && !forzar) {
      return cached.datos;
    }

    if (cached && cached.datos && !forzar) {
      // Revalidación asíncrona en segundo plano (Stale-While-Revalidate)
      if (typeof fetcher === 'function') {
        setTimeout(async () => {
          try {
            const nuevosDatos = await fetcher();
            if (nuevosDatos) {
              await this.guardarColeccion(clave, nuevosDatos);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent(`agy_cache_actualizada_${clave}`, { detail: nuevosDatos }));
              }
            }
          } catch (eReval) {
            console.warn(`[CacheService] Revalidación en segundo plano falló para ${clave}:`, eReval);
          }
        }, 50);
      }
      return cached.datos;
    }

    // Si no está en caché o se solicitó refresco forzado
    if (typeof fetcher === 'function') {
      const nuevosDatos = await fetcher();
      if (nuevosDatos) {
        await this.guardarColeccion(clave, nuevosDatos);
        return nuevosDatos;
      }
    }

    return cached ? cached.datos : null;
  }

  /**
   * Guarda el catálogo estructurado de repositorio documental en IndexedDB (no volátil)
   */
  async guardarRepositorio(datos, meta = {}) {
    return this.guardarColeccion('repositorio_documental', datos, {
      total: Array.isArray(datos) ? datos.length : (datos?.total || 0),
      ...meta
    });
  }

  /**
   * Obtiene el catálogo estructurado de repositorio documental desde IndexedDB
   */
  async obtenerRepositorio() {
    return this.obtenerColeccion('repositorio_documental');
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

  /**
   * =========================================================
   * GESTIÓN DE COLABORADORES ACTIVOS (IndexedDB Caché Rápida)
   * =========================================================
   */

  /**
   * Guarda la colección de colaboradores activos normalizada en IndexedDB
   */
  async guardarEmpleados(listaEmpleados) {
    if (!Array.isArray(listaEmpleados)) return false;
    return this.guardarColeccion('empleados', listaEmpleados, {
      total: listaEmpleados.length,
      actualizado: new Date().toISOString()
    });
  }

  /**
   * Obtiene la lista de colaboradores activos guardada en IndexedDB
   */
  async obtenerEmpleados() {
    const res = await this.obtenerColeccion('empleados');
    return Array.isArray(res) ? res : [];
  }

  /**
   * =========================================================
   * COLA DE MUTACIONES OFFLINE (Write-Through Outbox Pattern)
   * =========================================================
   */

  /**
   * Encola una mutación documental pendiente de enviar a Google Apps Script
   */
  async encolarMutacion(mutacion) {
    if (!mutacion || !mutacion.accion) return false;
    const idbListo = await this.init();
    if (!idbListo || !this.db) {
      // Fallback a localStorage
      try {
        const raw = localStorage.getItem('agy_pending_mutations') || '[]';
        const lista = JSON.parse(raw);
        lista.push({ ...mutacion, id: Date.now(), timestamp: Date.now() });
        localStorage.setItem('agy_pending_mutations', JSON.stringify(lista));
        return true;
      } catch { return false; }
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(['colaMutaciones'], 'readwrite');
        const store = tx.objectStore('colaMutaciones');
        store.add({
          mutacion,
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
   * Obtiene todas las mutaciones pendientes por sincronizar
   */
  async obtenerColaMutaciones() {
    const idbListo = await this.init();
    let listaIdb = [];
    if (idbListo && this.db) {
      listaIdb = await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['colaMutaciones'], 'readonly');
          const store = tx.objectStore('colaMutaciones');
          const req = store.getAll();
          req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    // Unir con posible fallback en localStorage
    let listaLocal = [];
    try {
      const raw = localStorage.getItem('agy_pending_mutations');
      if (raw) listaLocal = JSON.parse(raw);
    } catch {}

    return [...listaIdb, ...listaLocal];
  }

  /**
   * Limpia las mutaciones que ya fueron enviadas a Google Apps Script
   */
  async limpiarMutaciones(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    const idbListo = await this.init();
    if (idbListo && this.db) {
      try {
        const tx = this.db.transaction(['colaMutaciones'], 'readwrite');
        const store = tx.objectStore('colaMutaciones');
        for (const id of ids) {
          store.delete(id);
        }
      } catch {}
    }

    try {
      const raw = localStorage.getItem('agy_pending_mutations');
      if (raw) {
        const setIds = new Set(ids);
        const lista = JSON.parse(raw).filter(item => !setIds.has(item.id));
        localStorage.setItem('agy_pending_mutations', JSON.stringify(lista));
      }
    } catch {}

    return true;
  }
}

export const cacheService = new CacheService();
