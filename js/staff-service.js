/**
 * Servicio de Personal y Autenticación de Colaboradores
 * Unión para la salud y la vida S.A.S.
 * 
 * Gestiona la matriz de 1,305 colaboradores activos, autenticación por Cédula + Correo,
 * registro seguro de contraseñas en usuarios.conf y persistencia de sesión.
 */

import { EMPLEADOS_ACTIVOS_BASE } from './staff-data.js?v=11.6.46';
import { DOCUMENTOS_REALES } from './data.js?v=11.6.46';
import { cacheService } from './cache-service.js?v=11.6.60';

const STORAGE_KEY_AUTH_SESSION = 'agy_sgc_authenticated_session';
const STORAGE_KEY_REMEMBERED_USER = 'agy_sgc_remembered_user';
const STORAGE_KEY_STAFF_CACHE = 'agy_sgc_staff_cache';
const STORAGE_KEY_CONF_CACHE = 'agy_sgc_conf_cache';
const STORAGE_KEY_AUDITORIA_CACHE = 'agy_sgc_auditoria_cache';
const STORAGE_KEY_MAESTRAS_CACHE = 'agy_sgc_maestras_cache';
const STORAGE_KEY_HISTORICO_CACHE = 'agy_sgc_historico_cache';
export const STORAGE_KEY_USER_PROFILE = 'agy_user_profile';

export class StaffService {
  constructor() {
    this.empleados = Array.isArray(EMPLEADOS_ACTIVOS_BASE) ? [...EMPLEADOS_ACTIVOS_BASE] : [];
    this.configuracion = {
      version: '1.0',
      usuariosRegistrados: {},
      reglasCargos: {}
    };
    this.auditoriaData = {
      version: '1.0',
      registroAuditoria: []
    };
    this.maestrasData = {
      version: '1.0',
      tablasMaestras: {
        tiposDocumento: [],
        tiposProceso: [],
        areas: []
      }
    };
    this.historicoData = [];
    this.sesionActiva = null;
    this.usuarioRecordado = null;
    this.colaboradorActivo = null;
    this._ultimosEventosAuditoria = new Map();
    this.cargarDesdeStorage();
    this.hidratarDesdeIndexedDB();
    this.iniciarEscuchaRed();
  }

  cargarDesdeStorage() {
    try {
      const sesionGuardada = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);
      if (sesionGuardada) {
        this.sesionActiva = JSON.parse(sesionGuardada);
        this.colaboradorActivo = this.sesionActiva;
      }
      const recordado = localStorage.getItem(STORAGE_KEY_REMEMBERED_USER);
      if (recordado) {
        this.usuarioRecordado = JSON.parse(recordado);
        if (!this.colaboradorActivo) {
          this.colaboradorActivo = this.usuarioRecordado;
        }
      }
      const cacheEmpleados = localStorage.getItem(STORAGE_KEY_STAFF_CACHE);
      if (cacheEmpleados) {
        const parsed = JSON.parse(cacheEmpleados);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.empleados = parsed;
        }
      }
      const cacheConf = localStorage.getItem(STORAGE_KEY_CONF_CACHE);
      if (cacheConf) {
        this.configuracion = JSON.parse(cacheConf);
        delete this.configuracion.historicoDocumental;
      }
      const cacheAud = localStorage.getItem(STORAGE_KEY_AUDITORIA_CACHE);
      if (cacheAud) {
        this.auditoriaData = JSON.parse(cacheAud);
        if (Array.isArray(this.auditoriaData.registroAuditoria)) {
          this.auditoriaData.registroAuditoria = this.deduplicarRegistroAuditoria(this.auditoriaData.registroAuditoria);
        }
      } else if (Array.isArray(this.configuracion.registroAuditoria) && this.configuracion.registroAuditoria.length > 0) {
        this.auditoriaData.registroAuditoria = this.deduplicarRegistroAuditoria(this.configuracion.registroAuditoria);
      }
      const cacheMae = localStorage.getItem(STORAGE_KEY_MAESTRAS_CACHE);
      if (cacheMae) {
        this.maestrasData = JSON.parse(cacheMae);
      } else if (this.configuracion.tablasMaestras) {
        this.maestrasData.tablasMaestras = this.configuracion.tablasMaestras;
      }
      const cacheHist = localStorage.getItem(STORAGE_KEY_HISTORICO_CACHE);
      if (cacheHist) {
        this.historicoData = JSON.parse(cacheHist);
      }
    } catch (e) {
      console.warn('[StaffService] Error leyendo caché local:', e);
    }
  }

  /**
   * Hidrata el estado en memoria de forma asíncrona desde IndexedDB (sin bloquear la carga inicial)
   */
  async hidratarDesdeIndexedDB() {
    try {
      const [conf, aud, mae, hist, emp] = await Promise.all([
        cacheService.obtenerColeccion('configuracion'),
        cacheService.obtenerColeccion('auditoria'),
        cacheService.obtenerColeccion('maestras'),
        cacheService.obtenerColeccion('historico'),
        cacheService.obtenerColeccion('empleados')
      ]);

      if (conf && conf.usuariosRegistrados) {
        this.configuracion = {
          ...this.configuracion,
          ...conf,
          usuariosRegistrados: {
            ...(this.configuracion.usuariosRegistrados || {}),
            ...(conf.usuariosRegistrados || {})
          }
        };
      }
      if (aud && Array.isArray(aud.registroAuditoria) && aud.registroAuditoria.length > 0) {
        this.auditoriaData = {
          ...this.auditoriaData,
          ...aud,
          registroAuditoria: this.deduplicarRegistroAuditoria([
            ...(this.auditoriaData.registroAuditoria || []),
            ...aud.registroAuditoria
          ])
        };
      }
      if (mae && mae.tablasMaestras) {
        this.maestrasData = mae;
      }
      if (Array.isArray(hist) && hist.length > 0) {
        this.historicoData = hist;
      }
      if (Array.isArray(emp) && emp.length > 0) {
        this.empleados = emp;
      }
      console.log('[StaffService] ⚡ Caché persistente IndexedDB sincronizada con éxito.');
    } catch (err) {
      console.warn('[StaffService] Aviso hidratando IndexedDB:', err);
    }
  }

  /**
   * Inicia escucha de eventos de conectividad para telemetría offline-first
   */
  iniciarEscuchaRed() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[StaffService] 🌐 Conexión reestablecida. Vaciando cola de telemetría pendiente...');
        this.vaciarColaAuditoriaPendiente();
      });
      // Intentar vaciar al inicio si hay eventos previos pendientes
      setTimeout(() => this.vaciarColaAuditoriaPendiente(), 4000);
    }
  }

  /**
   * Vacía los eventos de auditoría acumulados en IndexedDB cuando se reanuda la conexión
   */
  async vaciarColaAuditoriaPendiente() {
    try {
      const cola = await cacheService.obtenerColaAuditoria();
      if (!Array.isArray(cola) || cola.length === 0) return;

      const eventos = cola.map(c => c.evento).filter(Boolean);
      const ids = cola.map(c => c.id);

      if (eventos.length > 0) {
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
        const payload = JSON.stringify({
          accion: 'guardar_auditoria',
          fileId: '1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR',
          eventosNuevos: eventos
        });

        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
          keepalive: true
        }).catch(() => { });

        await cacheService.limpiarColaAuditoria(ids);
        console.log(`[StaffService] ✅ ${eventos.length} eventos de auditoría pendientes sincronizados.`);
      }
    } catch (e) {
      console.warn('[StaffService] Error vaciando cola de auditoría:', e);
    }
  }

  /**
   * Consolida y elimina eventos repetidos o con muy poco tiempo de diferencia (por ejemplo,
   * doble clic en botones de acción, reintentos rápidos de inicio de sesión o descargas consecutivas).
   */
  deduplicarRegistroAuditoria(lista) {
    if (!Array.isArray(lista)) return [];

    // Ordenar de más reciente a más antiguo
    const ordenados = lista
      .filter((ev) => ev && typeof ev === 'object')
      .sort((a, b) => {
        const tA = this.parsearFechaMilisegundos(a.fechaHora || a.timestamp);
        const tB = this.parsearFechaMilisegundos(b.fechaHora || b.timestamp);
        if (tB !== tA) return tB - tA;
        return (b.id || '').localeCompare(a.id || '');
      });

    const resultado = [];
    for (let i = 0; i < ordenados.length; i++) {
      const actual = ordenados[i];
      if (resultado.length === 0) {
        resultado.push(actual);
        continue;
      }

      const anterior = resultado[resultado.length - 1];
      const msActual = this.parsearFechaMilisegundos(actual.fechaHora || actual.timestamp);
      const msAnt = this.parsearFechaMilisegundos(anterior.fechaHora || anterior.timestamp);

      const mismoId = actual.id && anterior.id && actual.id === anterior.id;
      const mismoUsuario =
        String(actual.identificacion || actual.usuario || '').trim().toLowerCase() ===
        String(anterior.identificacion || anterior.usuario || '').trim().toLowerCase();
      const mismoTipo =
        String(actual.tipo || actual.tipoEvento || '').trim().toUpperCase() ===
        String(anterior.tipo || anterior.tipoEvento || '').trim().toUpperCase();
      const mismoDoc =
        String(actual.documentoCodigo || '').trim().toUpperCase() ===
        String(anterior.documentoCodigo || '').trim().toUpperCase();
      const mismoDetalle =
        String(actual.detalle || '').trim().toLowerCase() ===
        String(anterior.detalle || '').trim().toLowerCase();

      const esDuplicadoTemporal =
        mismoUsuario &&
        mismoTipo &&
        (mismoDoc || mismoDetalle || mismoTipo === 'LOGIN') &&
        Math.abs(msAnt - msActual) < 10000;

      if (!mismoId && !esDuplicadoTemporal) {
        resultado.push(actual);
      }
    }

    return resultado;
  }

  limpiarHistoricoSintetico(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.filter((h) => {
      try {
        if (!h || typeof h !== 'object') return false;
        const det = String(h.detalle || '');
        const cod = String(h.codigo || '').toUpperCase();
        const tipo = String(h.tipoEvento || '').toUpperCase();
        const rAnt = String(h.rutaAnterior || '');
        const rNue = String(h.rutaNueva || '');

        if (!cod) return false;

        // Descartar registros sintéticos de prueba con 'PC de GIC' o 'Intranet'
        if (det.includes('PC de GIC') || rAnt.includes('PC de GIC') || rNue.includes('PC de GIC')) return false;
        if (det.includes('Intranet') || rAnt.includes('Intranet') || rNue.includes('Intranet')) return false;
        if (det.includes('Actualización de proceso/área:') || det.includes('Reubicación de ruta')) return false;

        const vA = String(h.versionAnterior !== undefined && h.versionAnterior !== null ? h.versionAnterior : '').trim();
        const vN = String(h.versionNueva !== undefined && h.versionNueva !== null ? h.versionNueva : '').trim();

        if (tipo === 'ELIMINACION') return true;

        if (tipo === 'CREACION') return true;

        if (tipo === 'CAMBIO_VERSION') {
          if (this.sonVersionesIguales(vA, vN)) return false;
          // Descartar si contiene nombres de texto largo (ej: nombres de áreas o cargos)
          if (vA.length > 8 || vN.length > 8 || /[a-záéíóúñ]/i.test(vA.replace(/^v/i, '')) || /[a-záéíóúñ]/i.test(vN.replace(/^v/i, ''))) {
            return false;
          }
          return true;
        }

        if (tipo === 'CAMBIO_METADATOS' || tipo === 'METADATOS' || tipo === 'CAMBIO_RUTA' || tipo === 'CAMBIO_TIPO') {
          return true;
        }

        if (tipo === 'EDICION_SHAREPOINT' || tipo === 'EDICION') {
          return true;
        }

        return true;
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Carga sincrónica de empleados y configuraciones en tiempo real
   */
  async inicializar() {
    await Promise.allSettled([
      this.sincronizarConfiguracion(),
      this.sincronizarEmpleados()
    ]);

    // Si hay una sesión activa, refrescar sus datos y perfil
    if (this.sesionActiva) {
      const docClean = this.limpiarNumeros(this.sesionActiva.identificacion);
      const match = this.empleados.find(
        (e) => this.limpiarNumeros(e.identificacion) === docClean
      );
      if (match) {
        const perfil = this.determinarPerfil(match.cargo, match.identificacion);
        this.sesionActiva = {
          ...match,
          perfil: perfil,
          ultimoIngreso: this.sesionActiva.ultimoIngreso || new Date().toISOString()
        };
        this.colaboradorActivo = this.sesionActiva;
        try {
          localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
        } catch { }
      }
    }

    return this.empleados;
  }

  /**
   * Descarga en tiempo real la configuración, auditoría, tablas maestras y control de cambios documental
   */
  async sincronizarConfiguracion(forzar = false) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    const query = forzar ? `?_t=${Date.now()}&forzar=true` : '';

    // 1. Sincronizar usuarios.conf vía /api/configuracion
    const pConfig = (async () => {
      try {
        const res = await fetch(`/api/configuracion${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json === 'object') {
            this.aplicarConfiguracion(json);
            console.log('[StaffService] ✅ Configuración base sincronizada desde /api/configuracion.');
            return;
          }
        }
      } catch (e) { }

      // Fallback a Google Script
      try {
        const resG = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (resG.ok) {
          const jsonG = await resG.json();
          if (jsonG && typeof jsonG === 'object') {
            this.aplicarConfiguracion(jsonG);
            console.log('[StaffService] ✅ Configuración sincronizada directamente desde Google Drive.');
            return;
          }
        }
      } catch (e) { }

      // Fallback a archivo estático local usuarios.conf
      try {
        const resLocal = await fetch(`usuarios.conf${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (resLocal.ok) {
          const jsonLocal = await resLocal.json();
          if (jsonLocal && typeof jsonLocal === 'object') {
            this.aplicarConfiguracion(jsonLocal);
            console.log('[StaffService] ✅ Configuración sincronizada desde usuarios.conf local.');
          }
        }
      } catch (e) { }
    })();

    // 2. Sincronizar auditoria.dat vía /api/auditoria o Google Drive
    const pAudit = this.sincronizarAuditoria(forzar);

    // 3. Sincronizar maestro.dat vía /api/maestras o Google Drive
    const pMaestras = (async () => {
      try {
        const res = await fetch(`/api/maestras${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json === 'object') {
            this.aplicarMaestras(json);
            console.log('[StaffService] ✅ Tablas maestras sincronizadas desde /api/maestras.');
            return;
          }
        }
      } catch (e) { }

      // Fallback a Google Script (?action=maestras)
      try {
        const resG = await fetch(`${GOOGLE_SCRIPT_URL}?action=maestras&_t=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (resG.ok) {
          const jsonG = await resG.json();
          if (jsonG && typeof jsonG === 'object') {
            this.aplicarMaestras(jsonG);
            console.log('[StaffService] ✅ Tablas maestras sincronizadas desde Google Drive.');
            return;
          }
        }
      } catch (e) { }

      // Fallback a maestro.dat local
      try {
        const resLocal = await fetch(`maestro.dat${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (resLocal.ok) {
          const jsonLocal = await resLocal.json();
          if (jsonLocal && typeof jsonLocal === 'object') {
            this.aplicarMaestras(jsonLocal);
            console.log('[StaffService] ✅ Tablas maestras sincronizadas desde maestro.dat local.');
          }
        }
      } catch (e) { }
    })();

    // 4. Sincronizar Historico_Documentos_USV.csv vía /api/historico o Google Drive
    const pHistorico = (async () => {
      try {
        const res = await fetch(`/api/historico${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
        });
        if (res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.historicoDocumental)) {
            this.aplicarHistorico(json.historicoDocumental);
            console.log('[StaffService] ✅ Control de cambios sincronizado desde /api/historico.');
            return;
          }
        }
      } catch (e) { }

      // Fallback a Google Script (?action=historico)
      try {
        const resG = await fetch(`${GOOGLE_SCRIPT_URL}?action=historico`, {
          cache: 'no-store',
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
        });
        if (resG.ok) {
          const jsonG = await resG.json();
          if (jsonG && Array.isArray(jsonG.historicoDocumental)) {
            this.aplicarHistorico(jsonG.historicoDocumental);
            console.log('[StaffService] ✅ Control de cambios sincronizado desde Google Drive (Historico CSV).');
            return;
          }
        }
      } catch (e) { }

      // Fallback a Historico_Documentos_USV.csv local
      try {
        const resLocal = await fetch(`Historico_Documentos_USV.csv${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
        });
        if (resLocal.ok) {
          const csvText = await resLocal.text();
          if (csvText && csvText.includes(';') && !csvText.includes('<!DOCTYPE html')) {
            const listaHist = this.parsearCsvHistorico(csvText);
            if (listaHist.length > 0) {
              this.aplicarHistorico(listaHist);
              console.log(`[StaffService] ✅ Control de cambios sincronizado desde Historico_Documentos_USV.csv local (${listaHist.length} registros).`);
            }
          }
        }
      } catch (e) { }
    })();

    await Promise.allSettled([pConfig, pAudit, pMaestras, pHistorico]);
  }

  aplicarConfiguracion(json) {
    if (!json || typeof json !== 'object') return;

    this.configuracion = {
      ...this.configuracion,
      ...json,
      usuariosRegistrados: {
        ...(this.configuracion.usuariosRegistrados || {}),
        ...(json.usuariosRegistrados || {})
      },
      favoritosPorUsuario: {
        ...(this.configuracion.favoritosPorUsuario || {}),
        ...(json.favoritosPorUsuario || {})
      },
      mapeoPerfilesPersonalizados: {
        ...(this.configuracion.mapeoPerfilesPersonalizados || {}),
        ...(json.mapeoPerfilesPersonalizados || {})
      },
      preferenciasPorUsuario: {
        ...(this.configuracion.preferenciasPorUsuario || {}),
        ...(json.preferenciasPorUsuario || {})
      },
      ordenamientoGlobal: json.ordenamientoGlobal || this.configuracion.ordenamientoGlobal || 'codigo-asc'
    };

    delete this.configuracion.historicoDocumental;

    // Si viene auditoria, tablasMaestras o historico en la respuesta antigua de Google Script, derivarlas
    if (Array.isArray(json.registroAuditoria) && json.registroAuditoria.length > 0) {
      this.aplicarAuditoria(json);
    }
    if (json.tablasMaestras && typeof json.tablasMaestras === 'object') {
      this.aplicarMaestras(json);
    }
    if (Array.isArray(json.historicoDocumental) && json.historicoDocumental.length > 0) {
      this.aplicarHistorico(json.historicoDocumental);
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
      cacheService.guardarColeccion('configuracion', this.configuracion);
    } catch { }
  }

  aplicarHistorico(lista) {
    if (!Array.isArray(lista)) return;
    const listaExistente = Array.isArray(this.historicoData) ? this.historicoData : [];
    const mapaHist = new Map();
    [...lista, ...listaExistente].forEach((h) => {
      if (h && (h.id || h.timestamp || h.codigo)) {
        const k = h.id || `${(h.codigo || '').toUpperCase()}_${h.tipoEvento || ''}_${h.fechaHora || h.timestamp}`;
        if (!mapaHist.has(k)) {
          mapaHist.set(k, h);
        }
      }
    });
    this.historicoData = Array.from(mapaHist.values())
      .sort((a, b) => {
        const tA = this.parsearFechaMilisegundos(a.fechaHora || a.fechaModificacionActual || a.timestamp);
        const tB = this.parsearFechaMilisegundos(b.fechaHora || b.fechaModificacionActual || b.timestamp);
        return tB - tA;
      })
      .slice(0, 2000);

    try {
      localStorage.setItem(STORAGE_KEY_HISTORICO_CACHE, JSON.stringify(this.historicoData));
      cacheService.guardarColeccion('historico', this.historicoData);
    } catch { }
  }

  aplicarAuditoria(json) {
    if (!json || typeof json !== 'object') return false;
    const auditoriaExistente = Array.isArray(this.auditoriaData.registroAuditoria) ? this.auditoriaData.registroAuditoria : [];
    const auditoriaNueva = Array.isArray(json.registroAuditoria) ? json.registroAuditoria : [];

    const idsExistentes = new Set(
      auditoriaExistente.map((e) => e?.id || `${e?.tipo}_${e?.identificacion || e?.usuario}_${e?.documentoCodigo || ''}_${e?.fechaHora || e?.timestamp}`)
    );

    let nuevosContador = 0;
    const mapaAuditoria = new Map();
    [...auditoriaNueva, ...auditoriaExistente].forEach((ev) => {
      if (!ev || typeof ev !== 'object') return;
      const k = ev.id || `${ev.tipo}_${ev.identificacion || ev.usuario}_${ev.documentoCodigo || ''}_${ev.fechaHora || ev.timestamp}`;
      if (!mapaAuditoria.has(k)) {
        mapaAuditoria.set(k, ev);
        if (!idsExistentes.has(k)) {
          nuevosContador++;
        }
      }
    });

    const listaAuditoriaUnida = this.deduplicarRegistroAuditoria(Array.from(mapaAuditoria.values()));
    const huboCambios = nuevosContador > 0 || listaAuditoriaUnida.length !== auditoriaExistente.length;

    this.auditoriaData = {
      version: '1.0',
      ultimaActualizacion: json.ultimaActualizacion || new Date().toISOString(),
      registroAuditoria: listaAuditoriaUnida
    };

    this.configuracion.registroAuditoria = listaAuditoriaUnida;

    try {
      localStorage.setItem(STORAGE_KEY_AUDITORIA_CACHE, JSON.stringify(this.auditoriaData));
      cacheService.guardarColeccion('auditoria', this.auditoriaData);
    } catch { }

    if (huboCambios) {
      try {
        window.dispatchEvent(new CustomEvent('agy_audit_event_logged', {
          detail: { origen: 'google_cache_sync', nuevos: nuevosContador, total: listaAuditoriaUnida.length }
        }));
      } catch { }
    }

    return huboCambios;
  }

  /**
   * Sincroniza el registro de auditoría con /api/auditoria o directamente con el archivo de Google Drive
   */
  async sincronizarAuditoria(forzar = false) {
    const timestamp = Date.now();
    const query = forzar ? `?_t=${timestamp}&forzar=true` : `?_t=${timestamp}`;
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    const GOOGLE_DRIVE_AUDITORIA_URL = 'https://drive.google.com/uc?export=download&id=1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR';

    // 1. Probar endpoint /api/auditoria
    try {
      const res = await fetch(`/api/auditoria${query}`, {
        cache: forzar ? 'no-store' : 'default',
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
      });
      if (res.ok) {
        const json = await res.json();
        if (json && typeof json === 'object' && Array.isArray(json.registroAuditoria)) {
          const huboCambios = this.aplicarAuditoria(json);
          console.log(`[StaffService] ✅ Auditoría sincronizada desde /api/auditoria (${json.registroAuditoria.length} eventos, cambios: ${huboCambios}).`);
          return { ok: true, huboCambios, origen: '/api/auditoria', total: this.auditoriaData.registroAuditoria.length };
        }
      }
    } catch (e) { }

    // 2. Fallback a Google Apps Script (?action=auditoria)
    try {
      const resG = await fetch(`${GOOGLE_SCRIPT_URL}?action=auditoria&_t=${timestamp}`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
      });
      if (resG.ok) {
        const jsonG = await resG.json();
        if (jsonG && typeof jsonG === 'object' && Array.isArray(jsonG.registroAuditoria)) {
          const huboCambios = this.aplicarAuditoria(jsonG);
          console.log(`[StaffService] ✅ Auditoría sincronizada desde Google Apps Script (${jsonG.registroAuditoria.length} eventos, cambios: ${huboCambios}).`);
          return { ok: true, huboCambios, origen: 'google_script', total: this.auditoriaData.registroAuditoria.length };
        }
      }
    } catch (e) { }

    // 3. Fallback a Google Drive directo
    try {
      const resD = await fetch(`${GOOGLE_DRIVE_AUDITORIA_URL}&_t=${timestamp}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
      });
      if (resD.ok) {
        const jsonD = await resD.json();
        if (jsonD && typeof jsonD === 'object' && Array.isArray(jsonD.registroAuditoria)) {
          const huboCambios = this.aplicarAuditoria(jsonD);
          console.log(`[StaffService] ✅ Auditoría sincronizada directamente desde Google Drive (${jsonD.registroAuditoria.length} eventos, cambios: ${huboCambios}).`);
          return { ok: true, huboCambios, origen: 'google_drive', total: this.auditoriaData.registroAuditoria.length };
        }
      }
    } catch (e) { }

    // 4. Fallback a auditoria.dat local
    try {
      const resLocal = await fetch(`auditoria.dat${query}`, {
        cache: forzar ? 'no-store' : 'default',
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (resLocal.ok) {
        const jsonLocal = await resLocal.json();
        if (jsonLocal && typeof jsonLocal === 'object' && Array.isArray(jsonLocal.registroAuditoria)) {
          const huboCambios = this.aplicarAuditoria(jsonLocal);
          console.log(`[StaffService] ✅ Auditoría sincronizada desde auditoria.dat local (${jsonLocal.registroAuditoria.length} eventos).`);
          return { ok: true, huboCambios, origen: 'auditoria.dat', total: this.auditoriaData.registroAuditoria.length };
        }
      }
    } catch (e) { }

    return { ok: false, huboCambios: false, total: (this.auditoriaData?.registroAuditoria || []).length };
  }

  aplicarMaestras(json) {
    if (!json || typeof json !== 'object') return;
    const nuevasTablas = json.tablasMaestras || json;
    this.maestrasData = {
      version: '1.0',
      ultimaActualizacion: json.ultimaActualizacion || new Date().toISOString(),
      tablasMaestras: {
        tiposDocumento: Array.isArray(nuevasTablas.tiposDocumento) ? nuevasTablas.tiposDocumento : (this.maestrasData.tablasMaestras.tiposDocumento || []),
        tiposProceso: Array.isArray(nuevasTablas.tiposProceso) ? nuevasTablas.tiposProceso : (this.maestrasData.tablasMaestras.tiposProceso || []),
        areas: Array.isArray(nuevasTablas.areas) ? nuevasTablas.areas : (this.maestrasData.tablasMaestras.areas || [])
      }
    };
    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
      cacheService.guardarColeccion('maestras', this.maestrasData);
    } catch { }
  }

  /**
   * Descarga y parsea en vivo EMPLEADOS_ACTIVOS.csv
   */
  async sincronizarEmpleados(forzar = false) {
    const timestamp = Date.now();
    const query = forzar ? `?_t=${timestamp}&forzar=true` : '';

    // 1. Probar endpoint /api/empleados
    try {
      const res = await fetch(`/api/empleados${query}`, {
        cache: forzar ? 'no-store' : 'default',
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (res.ok) {
        const csvTexto = await res.text();
        if (csvTexto && csvTexto.includes(',') && !csvTexto.includes('<!DOCTYPE html')) {
          const lista = this.parsearCsvEmpleados(csvTexto);
          if (lista.length > 0) {
            this.empleados = lista;
            try {
              localStorage.setItem(STORAGE_KEY_STAFF_CACHE, JSON.stringify(lista));
              cacheService.guardarColeccion('empleados', lista);
            } catch { }
            console.log(`[StaffService] ✅ ${lista.length} colaboradores activos sincronizados desde /api/empleados.`);
            return lista;
          }
        }
      }
    } catch (e) { }

    // 2. Fallback: Archivo estático EMPLEADOS_ACTIVOS.csv
    try {
      const resLocal = await fetch(`EMPLEADOS_ACTIVOS.csv${query}`, {
        cache: forzar ? 'no-store' : 'default',
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (resLocal.ok) {
        const csvTextoLocal = await resLocal.text();
        if (csvTextoLocal && csvTextoLocal.includes(',') && !csvTextoLocal.includes('<!DOCTYPE html')) {
          const lista = this.parsearCsvEmpleados(csvTextoLocal);
          if (lista.length > 0) {
            this.empleados = lista;
            try {
              localStorage.setItem(STORAGE_KEY_STAFF_CACHE, JSON.stringify(lista));
              cacheService.guardarColeccion('empleados', lista);
            } catch { }
            return lista;
          }
        }
      }
    } catch (e) { }

    return this.empleados;
  }

  parsearCsvEmpleados(texto) {
    if (!texto) return [];
    const limpio = texto.replace(/^\uFEFF/, '');
    const lineas = limpio.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length < 2) return [];

    const delimitador = lineas[0].includes(';') ? ';' : ',';
    const rawHeaders = this.dividirLineaCsv(lineas[0], delimitador);
    const headers = rawHeaders.map((h) => this.normalizar(h));

    const getIdx = (nombres, fallback) => {
      for (const n of nombres) {
        const target = this.normalizar(n);
        const idx = headers.findIndex((h) => h === target || h.includes(target) || target.includes(h));
        if (idx !== -1) return idx;
      }
      return fallback;
    };

    const idxNombre = getIdx(['empleado', 'nombre', 'colaborador'], 0);
    const idxDoc = getIdx(['identificaci', 'cedula', 'documento', 'id'], 1);
    const idxSede = getIdx(['sede', 'ciudad', 'ubicacion'], 2);
    const idxCargo = getIdx(['cargo', 'puesto', 'rol'], 3);
    const idxEmail = getIdx(['email', 'correo', 'mail'], 4);
    const idxEstado = getIdx(['estado'], 5);

    const resultado = [];

    for (let i = 1; i < lineas.length; i++) {
      const cols = this.dividirLineaCsv(lineas[i], delimitador);
      if (cols.length < 2) continue;

      const nombre = idxNombre !== -1 && cols[idxNombre] ? cols[idxNombre].trim() : '';
      const identificacion = idxDoc !== -1 && cols[idxDoc] ? cols[idxDoc].trim() : '';
      const sede = idxSede !== -1 && cols[idxSede] ? cols[idxSede].trim() : 'Principal';
      const cargo = idxCargo !== -1 && cols[idxCargo] ? cols[idxCargo].trim() : 'Colaborador';
      const email = idxEmail !== -1 && cols[idxEmail] ? cols[idxEmail].trim().toLowerCase() : '';
      const estado = idxEstado !== -1 && cols[idxEstado] ? cols[idxEstado].trim() : 'Activo';

      if (!nombre || !identificacion) continue;

      const perfilAsignado = this.determinarPerfil(cargo, identificacion);

      resultado.push({
        id: `emp-${identificacion}`,
        nombre: nombre,
        identificacion: identificacion,
        sede: sede,
        cargo: cargo,
        email: email,
        estado: estado,
        perfil: perfilAsignado
      });
    }

    return resultado;
  }

  parsearCsvHistorico(content) {
    if (!content || !content.trim()) return [];
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l && l.trim());
    if (lines.length <= 1) return [];

    const delimitador = lines[0].includes(';') ? ';' : ',';
    const rawHeaders = this.dividirLineaCsv(lines[0], delimitador);
    const headers = rawHeaders.map((h) => h.trim());
    const lista = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = this.dividirLineaCsv(lines[i], delimitador);
      if (!cols || cols.length === 0 || !cols[2]) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = cols[c] !== undefined ? cols[c] : '';
      }
      lista.push(obj);
    }
    return lista;
  }

  dividirLineaCsv(linea, delimitador) {
    const resultado = [];
    let actual = '';
    let entreComillas = false;

    for (let j = 0; j < linea.length; j++) {
      const char = linea[j];
      if (char === '"') {
        entreComillas = !entreComillas;
      } else if (char === delimitador && !entreComillas) {
        resultado.push(actual.replace(/^"|"$/g, '').trim());
        actual = '';
      } else {
        actual += char;
      }
    }
    resultado.push(actual.replace(/^"|"$/g, '').trim());
    return resultado;
  }

  normalizar(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  limpiarNumeros(texto) {
    return (texto || '').toString().replace(/[^0-9]/g, '');
  }

  /**
   * Calcula el hash criptográfico SHA-256 para almacenamiento seguro de contraseñas
   */
  async calcularHash(texto) {
    if (!texto) return '';
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(texto.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback simple si SubtleCrypto no está disponible
      let hash = 0;
      for (let i = 0; i < texto.length; i++) {
        const chr = texto.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0;
      }
      return `hash_${Math.abs(hash)}`;
    }
  }

  /**
   * Determina automáticamente el perfil (directivo, administrativo, operativo, total) según el cargo o asignaciones especiales
   */
  determinarPerfil(cargo, identificacion) {
    const docClean = this.limpiarNumeros(identificacion);
    if (docClean) {
      if (docClean === '8160602') {
        return 'total';
      }
      if (this.configuracion?.mapeoPerfilesPersonalizados?.[docClean]) {
        return this.configuracion.mapeoPerfilesPersonalizados[docClean];
      }
      if (this.configuracion?.usuariosRegistrados?.[docClean]?.perfil) {
        return this.configuracion.usuariosRegistrados[docClean].perfil;
      }
    }

    const cNorm = (cargo || '').toLowerCase();

    // Perfil Directivo 👑
    if (
      cNorm.includes('director') ||
      cNorm.includes('gerente') ||
      cNorm.includes('cumplimiento organizacional') ||
      cNorm.includes('lider financiero') ||
      cNorm.includes('lider de tecnologia') ||
      cNorm.includes('lider gestion asistencial')
    ) {
      return 'directivo';
    }

    // Perfil Administrativo 💼
    if (
      cNorm.includes('analista') ||
      cNorm.includes('auxiliar contable') ||
      cNorm.includes('auxiliar finanzas') ||
      cNorm.includes('auxiliar gestion humana') ||
      cNorm.includes('auxiliar tic') ||
      cNorm.includes('comunicadora') ||
      cNorm.includes('gesis') ||
      cNorm.includes('lider gestion humana')
    ) {
      return 'administrativo';
    }

    // Perfil Operativo / Asistencial 👷 (Médicos, Especialistas, Auxiliares de Salud)
    return 'operativo';
  }

  /**
   * Asigna y almacena permanentemente un perfil personalizado en la nube (Google Drive) para un usuario
   */
  async asignarPerfilPersonalizado(doc, nuevoPerfil) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean || !nuevoPerfil) return;

    this.configuracion.mapeoPerfilesPersonalizados = this.configuracion.mapeoPerfilesPersonalizados || {};
    this.configuracion.mapeoPerfilesPersonalizados[docClean] = nuevoPerfil;

    if (this.configuracion.usuariosRegistrados?.[docClean]) {
      this.configuracion.usuariosRegistrados[docClean].perfil = nuevoPerfil;
    }

    if (this.sesionActiva && this.limpiarNumeros(this.sesionActiva.identificacion) === docClean) {
      this.sesionActiva.perfil = nuevoPerfil;
      try {
        localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
      } catch { }
    }

    if (this.usuarioRecordado && this.limpiarNumeros(this.usuarioRecordado.identificacion) === docClean) {
      this.usuarioRecordado.perfil = nuevoPerfil;
      try {
        localStorage.setItem(STORAGE_KEY_REMEMBERED_USER, JSON.stringify(this.usuarioRecordado));
      } catch { }
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    await this.guardarConfiguracionEnNube();
  }

  /**
   * Guarda y sincroniza en la nube los favoritos de un usuario
   */
  async guardarFavoritosUsuario(doc, listaFavoritos) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean) return;

    const arrFavs = Array.isArray(listaFavoritos) ? listaFavoritos : Array.from(listaFavoritos || []);
    this.configuracion.favoritosPorUsuario = this.configuracion.favoritosPorUsuario || {};
    this.configuracion.favoritosPorUsuario[docClean] = arrFavs;

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    this.guardarConfiguracionEnNube();
  }

  obtenerFavoritosUsuario(doc) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean) return null;
    return this.configuracion.favoritosPorUsuario?.[docClean] || null;
  }

  /**
   * Obtiene la contraseña institucional actual (por defecto USV2026*)
   */
  obtenerClaveInstitucional() {
    return (this.configuracion.claveInstitucional || 'USV2026*').trim();
  }

  /**
   * Valida si una contraseña coincide con la contraseña institucional activa
   */
  validarClaveInstitucional(password) {
    const claveCorrecta = this.obtenerClaveInstitucional();
    return (password || '').trim() === claveCorrecta;
  }

  /**
   * Valida la contraseña para habilitar el Modo Edición de documentos.
   * La contraseña para edición de documentos es igual a la contraseña de ingreso al programa
   * definida por cada usuario colaborador (con fallback a la contraseña institucional).
   */
  async validarClaveEdicion(password, identificacion = null) {
    const pwd = (password || '').trim();
    if (!pwd) {
      return { ok: false, error: 'Por favor ingresa tu contraseña.' };
    }

    const sesion = this.obtenerSesionActiva() || this.obtenerUsuarioRecordado();
    const docTarget = identificacion || sesion?.identificacion;

    if (docTarget) {
      const docClean = this.limpiarNumeros(docTarget);
      const reg = this.configuracion?.usuariosRegistrados?.[docClean] || sesion;
      if (reg && reg.passwordHash) {
        const hashIngresado = await this.calcularHash(pwd);
        if (hashIngresado === reg.passwordHash) {
          if (!this.sesionActiva && reg) {
            this.iniciarSesion(reg);
          }
          return { ok: true, usuario: reg };
        }
      }
    }

    // Si no hay sesión activa o el doc no coincidió, buscar si la contraseña coincide con algún usuario registrado
    const hashIngresado = await this.calcularHash(pwd);
    const usuarios = Object.values(this.configuracion?.usuariosRegistrados || {});
    const usuarioMatch = usuarios.find((u) => u && u.passwordHash === hashIngresado);
    if (usuarioMatch) {
      if (!this.sesionActiva) {
        this.iniciarSesion(usuarioMatch);
      }
      return { ok: true, usuario: usuarioMatch };
    }

    // Si coincide con la clave institucional maestra (administración / contingencia)
    if (this.validarClaveInstitucional(pwd)) {
      return { ok: true, usuario: sesion || { nombre: 'Administrador SGC' } };
    }

    return {
      ok: false,
      error: 'Contraseña incorrecta. Ingresa tu contraseña de ingreso al programa.'
    };
  }

  /**
   * Cambia la contraseña personal del colaborador activo en sesión.
   * Valida la contraseña actual, calcula el nuevo hash SHA-256, actualiza en memoria,
   * en caché local y sincroniza en Google Drive y servidor.
   */
  async cambiarPasswordPersonal(claveActual, claveNueva, usuarioDoc = null) {
    const sesion = this.obtenerSesionActiva() || this.obtenerUsuarioRecordado();
    const docObjetivo = usuarioDoc || sesion?.identificacion;
    const docClean = this.limpiarNumeros(docObjetivo);

    if (!docClean) {
      return { exito: false, error: 'No se detectó un usuario activo para cambiar la contraseña.' };
    }

    let reg = this.configuracion?.usuariosRegistrados?.[docClean] || (sesion && this.limpiarNumeros(sesion.identificacion) === docClean ? sesion : null);

    if (!reg) {
      const emp = this.empleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean);
      if (emp) {
        reg = {
          identificacion: emp.identificacion,
          email: emp.email,
          nombre: emp.nombre,
          cargo: emp.cargo,
          sede: emp.sede,
          perfil: this.determinarPerfil(emp.cargo, emp.identificacion) || 'operativo'
        };
      } else {
        return { exito: false, error: 'Usuario no encontrado en la matriz de empleados activos.' };
      }
    }

    // 1. Validar contraseña actual si el usuario ya tiene contraseña registrada
    if (reg.passwordHash) {
      const hashActual = await this.calcularHash(claveActual);
      if (hashActual !== reg.passwordHash) {
        return { exito: false, error: 'La contraseña actual ingresada es incorrecta.' };
      }
    }

    // 2. Validar nueva contraseña
    const nuevaLimpia = (claveNueva || '').trim();
    if (!nuevaLimpia || nuevaLimpia.length < 4) {
      return { exito: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }

    const nuevoHash = await this.calcularHash(nuevaLimpia);
    if (reg.passwordHash && nuevoHash === reg.passwordHash) {
      return { exito: false, error: 'La nueva contraseña no puede ser idéntica a la contraseña actual.' };
    }

    // 3. Actualizar registro
    const usuarioActualizado = {
      ...reg,
      passwordHash: nuevoHash,
      fechaActualizacionPassword: new Date().toISOString()
    };

    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};
    this.configuracion.usuariosRegistrados[docClean] = usuarioActualizado;

    // Actualizar sesión activa y recordada si corresponde
    if (sesion && this.limpiarNumeros(sesion.identificacion) === docClean) {
      this.sesionActiva = {
        ...this.sesionActiva,
        ...usuarioActualizado
      };
      if (this.usuarioRecordado && this.limpiarNumeros(this.usuarioRecordado.identificacion) === docClean) {
        this.usuarioRecordado = {
          ...this.usuarioRecordado,
          ...usuarioActualizado
        };
      }
      try {
        localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
        localStorage.setItem(STORAGE_KEY_REMEMBERED_USER, JSON.stringify(this.usuarioRecordado));
      } catch { }
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    // Registrar en auditoría
    this.registrarAuditoria('SEGURIDAD', {
      detalle: `Cambio de contraseña personal del colaborador: ${usuarioActualizado.nombre || docClean}`,
      usuario: usuarioActualizado.nombre || sesion?.nombre || 'Colaborador',
      identificacion: usuarioActualizado.identificacion || docClean,
      cargo: usuarioActualizado.cargo || 'Colaborador',
      perfil: usuarioActualizado.perfil || 'operativo'
    });

    // Sincronizar en Google Drive y servidor
    await this.guardarConfiguracionEnNube();

    return {
      exito: true,
      mensaje: '¡Contraseña personal actualizada exitosamente! Esta nueva contraseña será solicitada para iniciar sesión y para desbloquear la edición de documentos.'
    };
  }

  /**
   * Cambia la contraseña institucional tras validar la actual y registra en auditoría
   */
  cambiarClaveInstitucional(claveActual, claveNueva, sesion = null) {
    const claveCorrecta = this.obtenerClaveInstitucional();
    if ((claveActual || '').trim() !== claveCorrecta) {
      return { exito: false, error: 'La contraseña actual ingresada es incorrecta.' };
    }

    const nuevaLimpia = (claveNueva || '').trim();
    if (!nuevaLimpia || nuevaLimpia.length < 6) {
      return { exito: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    if (nuevaLimpia === claveCorrecta) {
      return { exito: false, error: 'La nueva contraseña no puede ser idéntica a la contraseña actual.' };
    }

    this.configuracion.claveInstitucional = nuevaLimpia;
    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    const sesionActiva = sesion || this.obtenerSesionActiva() || this.obtenerUsuarioRecordado();

    // Registrar en auditoría institucional
    this.registrarAuditoria('SEGURIDAD', {
      detalle: 'Cambio de contraseña institucional del sistema (Modo Edición y Configuración)',
      usuario: sesionActiva?.nombre || 'Administrador SGC',
      identificacion: sesionActiva?.identificacion || 'N/A',
      cargo: sesionActiva?.cargo || 'Control Calidad',
      perfil: 'total'
    });

    // Sincronizar en Google Drive
    this.guardarConfiguracionEnNube();

    return { exito: true, mensaje: 'Contraseña institucional actualizada con éxito y sincronizada en Google Drive.' };
  }

  /**
   * Guarda la configuración global (usuarios, perfiles, favoritos, preferencias) en la nube y servidor
   */
  async guardarConfiguracionEnNube() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    const payloadObj = { ...this.configuracion, fileId: '1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl' };
    const jsonStr = JSON.stringify(payloadObj);

    // 0. Persistir en IndexedDB de inmediato (cero pérdida de datos local)
    try {
      cacheService.guardarColeccion('configuracion', this.configuracion);
    } catch { }

    // 1. Enviar directamente a Google Apps Script (Web App Google Drive)
    try {
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonStr,
        keepalive: true
      }).catch((e) => {
        console.warn('[StaffService] Fallo envío directo a Google Apps Script:', e);
      });
    } catch (e) { }

    // 2. Enviar a endpoint local / servidor si está disponible
    try {
      const res = await fetch('/api/configuracion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonStr
      });
      if (res && res.ok) {
        const jsonMerged = await res.json();
        if (jsonMerged && typeof jsonMerged === 'object') {
          this.aplicarConfiguracion(jsonMerged);
        }
      }
    } catch (e) { }
  }

  /**
   * Guarda y sincroniza el registro de auditoría en auditoria.dat de forma eficiente y sin colisiones
   */
  async guardarAuditoriaEnNube(forzarInmediato = false) {
    if (this._debounceAuditTimer) {
      clearTimeout(this._debounceAuditTimer);
      this._debounceAuditTimer = null;
    }

    const payloadObj = {
      accion: 'guardar_auditoria',
      fileId: '1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR',
      ...this.auditoriaData
    };
    const payload = JSON.stringify(payloadObj);

    // Persistir en IndexedDB y localStorage
    try {
      localStorage.setItem(STORAGE_KEY_AUDITORIA_CACHE, payload);
      cacheService.guardarColeccion('auditoria', this.auditoriaData);
    } catch { }

    const ejecutarSincronizacion = async () => {
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
      let sincronizadoPorApi = false;

      // 1. Enviar prioritariamente a /api/auditoria (servidor local si está en ejecución)
      try {
        const res = await fetch('/api/auditoria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
        });
        if (res && res.ok) {
          sincronizadoPorApi = true;
          const jsonAud = await res.json();
          if (jsonAud && typeof jsonAud === 'object' && Array.isArray(jsonAud.registroAuditoria)) {
            this.aplicarAuditoria(jsonAud);
          }
        }
      } catch (e) { }

      // 2. Fallback: Enviar a Google Apps Script si el backend local no está disponible
      if (!sincronizadoPorApi) {
        try {
          fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: payload,
            keepalive: true
          }).catch(() => { });
        } catch (e) { }
      }
    };

    if (forzarInmediato) {
      return ejecutarSincronizacion();
    } else {
      // Debounce de 2 segundos para agrupar múltiples eventos rápidos y evitar saturar Google Drive
      this._debounceAuditTimer = setTimeout(ejecutarSincronizacion, 2000);
    }
  }

  /**
   * Guarda y sincroniza las tablas maestras en maestro.dat (/api/maestras y Google Drive)
   */
  async guardarTablasMaestrasEnNube() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    const payloadObj = { ...this.maestrasData, fileId: '1NycmHFf8iAko2XsHIi9dmfe-lK6utpek' };
    const payload = JSON.stringify(payloadObj);

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, payload);
      cacheService.guardarColeccion('maestras', this.maestrasData);
    } catch { }

    // 1. Enviar directamente a Google Apps Script
    try {
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        keepalive: true
      }).catch((e) => { });
    } catch (e) { }

    // 2. Enviar a endpoint local / servidor
    try {
      const res = await fetch('/api/maestras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res && res.ok) {
        const jsonMae = await res.json();
        if (jsonMae && typeof jsonMae === 'object') {
          this.aplicarMaestras(jsonMae);
        }
      }
    } catch (e) { }
  }

  /**
   * Guarda y sincroniza el control de cambios en Historico_Documentos_USV.csv (/api/historico y Google Drive)
   */
  async guardarHistoricoEnNube() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    const payloadObj = {
      accion: 'guardar_historico',
      fileId: '1dsnwbq3qDwDnbz7QtcZf374M5ltucB8m',
      historicoDocumental: this.historicoData
    };
    const payload = JSON.stringify(payloadObj);

    try {
      localStorage.setItem(STORAGE_KEY_HISTORICO_CACHE, JSON.stringify(this.historicoData));
      cacheService.guardarColeccion('historico', this.historicoData);
    } catch { }

    // 1. Enviar directamente a Google Apps Script (actualiza Historico_Documentos_USV.csv en Drive)
    try {
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        keepalive: true
      }).catch((e) => { });
    } catch (e) { }

    // 2. Enviar a endpoint local / servidor
    try {
      const res = await fetch('/api/historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      if (res && res.ok) {
        const jsonHist = await res.json();
        if (jsonHist && Array.isArray(jsonHist.historicoDocumental)) {
          this.aplicarHistorico(jsonHist.historicoDocumental);
        }
      }
    } catch (e) { }
  }

  /**
   * Valida la existencia del colaborador por Cédula y Correo en la matriz activa
   */
  validarIdentificacionYEmail(doc, email) {
    const docClean = this.limpiarNumeros(doc);
    const emailClean = (email || '').trim().toLowerCase();

    if (!docClean) {
      return { valido: false, error: 'Por favor ingresa tu número de documento.' };
    }
    if (!emailClean || !emailClean.includes('@')) {
      return { valido: false, error: 'Por favor ingresa un correo electrónico institucional válido.' };
    }

    const lista = (Array.isArray(this.empleados) && this.empleados.length > 0)
      ? this.empleados
      : (Array.isArray(EMPLEADOS_ACTIVOS_BASE) ? EMPLEADOS_ACTIVOS_BASE : []);

    const empleado = lista.find(
      (e) => this.limpiarNumeros(e.identificacion) === docClean
    ) || this.configuracion?.usuariosRegistrados?.[docClean];

    if (!empleado) {
      return {
        valido: false,
        error: `El documento ${doc} no se encuentra registrado en la matriz de empleados activos.`
      };
    }

    const empEmailClean = (empleado.email || '').trim().toLowerCase();
    if (empEmailClean !== emailClean) {
      return {
        valido: false,
        error: 'El correo electrónico no coincide con el registrado para este número de documento.',
        empleado
      };
    }

    return { valido: true, empleado };
  }

  /**
   * Valida la identidad solicitando solo los últimos 4 dígitos de la cédula y el correo institucional
   */
  validar4DigitosYEmail(ultimos4, email, empleadoObjetivo = null) {
    const d4 = this.limpiarNumeros(ultimos4);
    const emailClean = (email || '').trim().toLowerCase();

    if (!d4 || d4.length < 4) {
      return { valido: false, error: 'Por favor ingresa los 4 últimos dígitos de tu cédula.' };
    }
    if (!emailClean || !emailClean.includes('@')) {
      return { valido: false, error: 'Por favor ingresa un correo institucional válido.' };
    }

    let emp = empleadoObjetivo;
    if (!emp) {
      emp = this.empleados.find((e) => (e.email || '').trim().toLowerCase() === emailClean);
    }

    if (!emp) {
      return {
        valido: false,
        error: 'No se encontró ningún colaborador con este correo en la matriz de empleados activos.'
      };
    }

    const empEmailClean = (emp.email || '').trim().toLowerCase();
    if (empEmailClean !== emailClean) {
      return {
        valido: false,
        error: 'El correo electrónico no coincide con el usuario seleccionado.'
      };
    }

    const docFull = this.limpiarNumeros(emp.identificacion);
    if (!docFull.endsWith(d4)) {
      return {
        valido: false,
        error: 'Los 4 dígitos ingresados no coinciden con la cédula del colaborador.'
      };
    }

    return { valido: true, empleado: emp };
  }

  /**
   * Valida la identidad solicitando únicamente los últimos 4 dígitos de la cédula del colaborador
   */
  validarSolo4Digitos(ultimos4, empleadoObjetivo) {
    const d4 = this.limpiarNumeros(ultimos4);

    if (!d4 || d4.length < 4) {
      return { valido: false, error: 'Por favor ingresa los 4 últimos dígitos de tu cédula.' };
    }

    if (!empleadoObjetivo || !empleadoObjetivo.identificacion) {
      return { valido: false, error: 'No se ha detectado el usuario a restablecer.' };
    }

    const docFull = this.limpiarNumeros(empleadoObjetivo.identificacion);
    if (!docFull.endsWith(d4)) {
      return {
        valido: false,
        error: 'Los 4 dígitos ingresados no coinciden con la cédula registrada.'
      };
    }

    return { valido: true, empleado: empleadoObjetivo };
  }

  /**
   * Obtiene la preferencia de ordenamiento guardada para un colaborador o global
   */
  obtenerPreferenciaOrdenamiento(identificacion = null) {
    const docClean = identificacion ? this.limpiarNumeros(identificacion) : null;
    if (docClean && this.configuracion?.preferenciasPorUsuario?.[docClean]?.ordenamiento) {
      return this.configuracion.preferenciasPorUsuario[docClean].ordenamiento;
    }
    if (this.configuracion?.ordenamientoGlobal) {
      return this.configuracion.ordenamientoGlobal;
    }
    return localStorage.getItem('agy_sgc_sort_preference') || 'codigo-asc';
  }

  /**
   * Guarda la preferencia de ordenamiento de un usuario y sincroniza con Google Drive (usuarios.conf)
   */
  async guardarPreferenciaOrdenamiento(identificacion, ordenamiento) {
    const docClean = identificacion ? this.limpiarNumeros(identificacion) : null;
    if (!this.configuracion.preferenciasPorUsuario) {
      this.configuracion.preferenciasPorUsuario = {};
    }
    if (docClean) {
      if (!this.configuracion.preferenciasPorUsuario[docClean]) {
        this.configuracion.preferenciasPorUsuario[docClean] = {};
      }
      this.configuracion.preferenciasPorUsuario[docClean].ordenamiento = ordenamiento;
    }
    this.configuracion.ordenamientoGlobal = ordenamiento;
    localStorage.setItem('agy_sgc_sort_preference', ordenamiento);
    localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    await this.guardarConfiguracionEnNube();
  }

  /**
   * Guarda la preferencia de ordenamiento global (para usuarios no autenticados o valor por defecto)
   */
  async guardarPreferenciaOrdenamientoGlobal(ordenamiento) {
    this.configuracion.ordenamientoGlobal = ordenamiento;
    localStorage.setItem('agy_sgc_sort_preference', ordenamiento);
    localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    await this.guardarConfiguracionEnNube();
  }

  /**
   * Verifica si el usuario ya tiene contraseña registrada en usuarios.conf o caché
   */
  estaUsuarioRegistrado(doc) {
    const docClean = this.limpiarNumeros(doc);
    const reg = this.configuracion?.usuariosRegistrados?.[docClean];
    return !!(reg && reg.passwordHash);
  }

  /**
   * Registra la contraseña de un colaborador por primera vez
   */
  async registrarPassword(doc, email, passwordPlano) {
    const validacion = this.validarIdentificacionYEmail(doc, email);
    if (!validacion.valido) {
      return { ok: false, error: validacion.error };
    }

    if (!passwordPlano || passwordPlano.length < 4) {
      return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
    }

    const emp = validacion.empleado;
    const docClean = this.limpiarNumeros(emp.identificacion);
    const hash = await this.calcularHash(passwordPlano);

    // Determinar perfil inicial o personalizado
    const perfilAsignado = this.determinarPerfil(emp.cargo, emp.identificacion) || emp.perfil || 'operativo';

    const usuarioObj = {
      identificacion: emp.identificacion,
      email: emp.email,
      nombre: emp.nombre,
      cargo: emp.cargo,
      sede: emp.sede,
      perfil: perfilAsignado,
      passwordHash: hash,
      fechaRegistro: new Date().toISOString(),
      ultimoIngreso: new Date().toISOString()
    };

    // Actualizar configuración en memoria y caché local
    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};
    this.configuracion.usuariosRegistrados[docClean] = usuarioObj;

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    // Sincronizar de inmediato con Google Drive y servidor
    await this.guardarConfiguracionEnNube();

    // Iniciar sesión persistente
    this.iniciarSesion(usuarioObj);
    return { ok: true, usuario: usuarioObj };
  }

  /**
   * Inicia sesión con Correo Corporativo y Contraseña (Login estándar de privacidad)
   */
  async iniciarSesionConEmailYPassword(email, passwordPlano) {
    const emailClean = (email || '').trim().toLowerCase();
    if (!emailClean || !emailClean.includes('@')) {
      return { ok: false, error: 'Por favor ingresa un correo electrónico corporativo válido.' };
    }
    if (!passwordPlano) {
      return { ok: false, error: 'Por favor ingresa tu contraseña.' };
    }

    const listaEmpleados = (Array.isArray(this.empleados) && this.empleados.length > 0)
      ? this.empleados
      : (Array.isArray(EMPLEADOS_ACTIVOS_BASE) ? EMPLEADOS_ACTIVOS_BASE : []);

    // 1. Buscar en lista de colaboradores activos
    let emp = listaEmpleados.find((e) => (e.email || '').trim().toLowerCase() === emailClean);

    // 2. Buscar en usuarios registrados
    let reg = null;
    if (this.configuracion?.usuariosRegistrados) {
      for (const k of Object.keys(this.configuracion.usuariosRegistrados)) {
        const u = this.configuracion.usuariosRegistrados[k];
        if (u && (u.email || '').trim().toLowerCase() === emailClean) {
          reg = u;
          break;
        }
      }
    }

    if (!emp && reg) {
      emp = reg;
    }

    if (emp && !reg) {
      const docClean = this.limpiarNumeros(emp.identificacion);
      reg = this.configuracion?.usuariosRegistrados?.[docClean];
    }

    if (!emp && !reg) {
      return {
        ok: false,
        error: 'No se encontró un colaborador registrado con este correo corporativo. Si eres un nuevo colaborador, haz clic en "Realizar Nuevo Registro".'
      };
    }

    if (emp.estado && emp.estado.toLowerCase().includes('inactiv')) {
      return {
        ok: false,
        error: 'El usuario no figura como empleado activo en la matriz institucional. Acceso restringido.'
      };
    }

    if (!reg || !reg.passwordHash) {
      return {
        ok: false,
        error: 'Este usuario aún no tiene contraseña registrada. Haz clic en "Realizar Nuevo Registro" para crearla.',
        noRegistrado: true,
        empleado: emp
      };
    }

    const hashIngresado = await this.calcularHash(passwordPlano);
    if (hashIngresado !== reg.passwordHash) {
      return { ok: false, error: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.' };
    }

    const perfil = this.determinarPerfil(emp.cargo, emp.identificacion) || reg.perfil || 'operativo';
    const docClean = this.limpiarNumeros(emp.identificacion);

    const usuarioObj = {
      ...reg,
      ...emp,
      perfil: perfil,
      ultimoIngreso: new Date().toISOString()
    };

    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};
    this.configuracion.usuariosRegistrados[docClean] = usuarioObj;

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    this.guardarConfiguracionEnNube();
    this.iniciarSesion(usuarioObj);
    return { ok: true, usuario: usuarioObj };
  }

  /**
   * Valida la contraseña para iniciar sesión en un usuario registrado (por cédula o correo)
   */
  async iniciarSesionConPassword(docOrEmail, passwordPlano) {
    if (typeof docOrEmail === 'string' && docOrEmail.includes('@')) {
      return this.iniciarSesionConEmailYPassword(docOrEmail, passwordPlano);
    }

    const docClean = this.limpiarNumeros(docOrEmail);

    // Lista de colaboradores disponibles (en memoria o base)
    const listaEmpleados = (Array.isArray(this.empleados) && this.empleados.length > 0)
      ? this.empleados
      : (Array.isArray(EMPLEADOS_ACTIVOS_BASE) ? EMPLEADOS_ACTIVOS_BASE : []);

    let emp = listaEmpleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean);
    let reg = this.configuracion?.usuariosRegistrados?.[docClean];

    // Si no está en memoria de usuarios.conf, buscar en usuario recordado local
    if (!reg && this.usuarioRecordado && this.limpiarNumeros(this.usuarioRecordado.identificacion) === docClean) {
      reg = this.usuarioRecordado;
    }

    if (!emp && reg) {
      emp = reg;
    }

    // REGLA: Validar existencia activa en EMPLEADOS_ACTIVOS.csv
    if (!emp || (emp.estado && emp.estado.toLowerCase().includes('inactiv'))) {
      return {
        ok: false,
        error: 'El usuario no figura como empleado activo en la matriz institucional. Acceso restringido.'
      };
    }

    if (!reg || !reg.passwordHash) {
      return {
        ok: false,
        error: 'Este usuario aún no tiene una contraseña registrada. Debes validar tu documento y correo por primera vez.'
      };
    }

    const hashIngresado = await this.calcularHash(passwordPlano);
    if (hashIngresado !== reg.passwordHash) {
      return { ok: false, error: 'Contraseña incorrecta. Por favor verifica e intenta nuevamente.' };
    }

    // Actualizar datos del empleado y perfil
    const perfil = this.determinarPerfil(emp.cargo, emp.identificacion) || reg.perfil || 'operativo';

    const usuarioObj = {
      ...reg,
      ...emp,
      perfil: perfil,
      ultimoIngreso: new Date().toISOString()
    };

    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};
    this.configuracion.usuariosRegistrados[docClean] = usuarioObj;

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    // Sincronizar en la nube
    this.guardarConfiguracionEnNube();

    // Iniciar sesión
    this.iniciarSesion(usuarioObj);
    return { ok: true, usuario: usuarioObj };
  }

  /**
   * Establece la sesión activa y la guarda en almacenamiento persistente
   */
  iniciarSesion(usuarioObj) {
    this.sesionActiva = usuarioObj;
    this.usuarioRecordado = {
      identificacion: usuarioObj.identificacion,
      email: usuarioObj.email,
      nombre: usuarioObj.nombre,
      cargo: usuarioObj.cargo,
      sede: usuarioObj.sede,
      perfil: usuarioObj.perfil,
      passwordHash: usuarioObj.passwordHash
    };
    this.colaboradorActivo = usuarioObj;

    try {
      localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
      localStorage.setItem(STORAGE_KEY_REMEMBERED_USER, JSON.stringify(this.usuarioRecordado));
    } catch { }
  }

  /**
   * Cierra la sesión activa pero mantiene al usuario recordado para ingreso rápido
   */
  cerrarSesion() {
    this.sesionActiva = null;
    this.colaboradorActivo = null;
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
    } catch { }
  }

  /**
   * Olvida completamente al usuario recordado en este equipo
   */
  olvidarUsuarioRecordado() {
    this.cerrarSesion();
    this.usuarioRecordado = null;
    try {
      localStorage.removeItem(STORAGE_KEY_REMEMBERED_USER);
    } catch { }
  }

  obtenerSesionActiva() {
    return this.sesionActiva;
  }

  obtenerUsuarioRecordado() {
    return this.usuarioRecordado;
  }

  obtenerColaboradorActivo() {
    return this.sesionActiva || this.colaboradorActivo;
  }

  buscarPorDocumento(doc) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean) return null;
    return this.empleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean) || null;
  }

  buscarColaboradores(termino, limite = 15) {
    if (!termino || termino.trim().length === 0) return [];

    const t = termino.trim();
    const tNum = this.limpiarNumeros(t);
    const q = t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return this.empleados
      .filter((e) => {
        if (tNum.length >= 3) {
          const docNum = this.limpiarNumeros(e.identificacion);
          if (docNum.includes(tNum)) return true;
        }

        const texto = `${e.nombre} ${e.identificacion} ${e.cargo} ${e.sede} ${e.email}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return texto.includes(q);
      })
      .slice(0, limite);
  }

  /**
   * Registra un evento en el historial de auditoría y lo sincroniza en auditoria.dat
   */
  async registrarAuditoria(tipo, detalle = {}) {
    const sesion = this.obtenerSesionActiva() || this.obtenerUsuarioRecordado();
    const now = new Date();
    const ahoraMs = now.getTime();
    const fechaHora = this.formatearFechaHora(now);

    const docId = detalle.identificacion || sesion?.identificacion || 'N/A';
    const tipoNorm = String(tipo || '').trim().toUpperCase();

    // Regla Institucional: No almacenar consultas ni búsquedas en la auditoría
    if (['CONSULTA', 'BUSQUEDA', 'BUSCAR'].includes(tipoNorm)) {
      return null;
    }

    // Regla de Seguridad Institucional: El personal operativo no tiene permisos de edición
    const perfilUsuario = String(detalle.perfil || sesion?.perfil || localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'operativo').toLowerCase();
    if (tipoNorm === 'EDICION' && perfilUsuario === 'operativo') {
      return null; // Bloquear falsos positivos de edición en perfil operativo
    }

    const docCod = String(detalle.documentoCodigo || '').trim().toUpperCase();
    const detTexto = String(detalle.detalle || '').trim().toLowerCase();

    // 1. Guard Anti-Flooding / Throttle en memoria por firma de evento
    if (!this._ultimosEventosAuditoria) {
      this._ultimosEventosAuditoria = new Map();
    }
    const eventKey = `${docId}_${tipoNorm}_${docCod}_${detTexto}`;
    const ultimoTimestamp = this._ultimosEventosAuditoria.get(eventKey);

    // Ventana de protección: 10s para LOGIN, 5s para otras acciones
    const ventanaDebounce = tipoNorm === 'LOGIN' ? 10000 : 5000;
    if (ultimoTimestamp && ahoraMs - ultimoTimestamp < ventanaDebounce) {
      // Ignorar llamado redundante / doble clic
      return null;
    }
    this._ultimosEventosAuditoria.set(eventKey, ahoraMs);

    if (!this.auditoriaData || !Array.isArray(this.auditoriaData.registroAuditoria)) {
      this.auditoriaData = { version: '1.0', registroAuditoria: [] };
    }

    // 2. Guard contra duplicados en el historial reciente
    for (let i = 0; i < Math.min(this.auditoriaData.registroAuditoria.length, 6); i++) {
      const evReciente = this.auditoriaData.registroAuditoria[i];
      if (evReciente) {
        const msReciente = this.parsearFechaMilisegundos(evReciente.fechaHora || evReciente.timestamp);
        const mismoUsr = String(evReciente.identificacion || '').trim() === String(docId).trim();
        const mismoTipo = String(evReciente.tipo || '').trim().toUpperCase() === tipoNorm;
        const mismoDoc = String(evReciente.documentoCodigo || '').trim().toUpperCase() === docCod;
        const mismoDet = String(evReciente.detalle || '').trim().toLowerCase() === detTexto;
        if (
          mismoUsr &&
          mismoTipo &&
          (mismoDoc || mismoDet || tipoNorm === 'LOGIN') &&
          Math.abs(ahoraMs - msReciente) < ventanaDebounce
        ) {
          return evReciente;
        }
      }
    }

    const nuevoEvento = {
      id: `aud_${ahoraMs}_${Math.random().toString(36).substr(2, 5)}`,
      tipo: tipoNorm, // 'LOGIN', 'DESCARGA', 'EDICION', 'CARPETA', 'ELIMINACION', etc.
      usuario: detalle.usuario || sesion?.nombre || 'Usuario Anónimo',
      identificacion: docId,
      cargo: detalle.cargo || sesion?.cargo || 'N/A',
      perfil: detalle.perfil || sesion?.perfil || localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'operativo',
      documentoCodigo: detalle.documentoCodigo || '',
      documentoTitulo: detalle.documentoTitulo || '',
      documentoExtension: detalle.documentoExtension || '',
      detalle: detalle.detalle || '',
      fechaHora: fechaHora,
      timestamp: now.toISOString(),
      dispositivo: detalle.dispositivo || (navigator.userAgent.includes('Windows') ? 'Windows' : 'Web')
    };

    // Insertar al inicio y mantener lista limpia deduplicada (sin límite artificial)
    this.auditoriaData.registroAuditoria.unshift(nuevoEvento);
    this.auditoriaData.registroAuditoria = this.deduplicarRegistroAuditoria(this.auditoriaData.registroAuditoria);
    this.auditoriaData.ultimaActualizacion = now.toISOString();

    // Mantener sincronizado en configuracion local para retrocompatibilidad
    this.configuracion.registroAuditoria = this.auditoriaData.registroAuditoria;

    try {
      localStorage.setItem(STORAGE_KEY_AUDITORIA_CACHE, JSON.stringify(this.auditoriaData));
      cacheService.encolarEventoAuditoria(nuevoEvento);
    } catch { }

    // Notificar a la interfaz de auditoría en vivo sin requerir F5
    try {
      window.dispatchEvent(new CustomEvent('agy_audit_event_logged', { detail: nuevoEvento }));
    } catch { }

    // Sincronizar en auditoria.dat
    this.guardarAuditoriaEnNube();

    return nuevoEvento;
  }

  /**
   * Formatea cualquier versión a la estructura alfanumérica estándar de 3 caracteres (ej: "1" -> "v01", "v1" -> "v01", "02" -> "v02", "10" -> "v10")
   */
  formatearVersion(ver) {
    if (ver === null || ver === undefined) return 'v01';
    let s = String(ver).trim();
    if (!s || s === 'N/A' || s === 'null' || s === 'undefined') return 'v01';

    if (s.toLowerCase().includes('retirado') || s.toLowerCase().includes('obsoleto')) {
      return s;
    }

    s = s.replace(/^v/i, '').trim();

    // Extraer número principal (ej: "1", "01", "1.0", "001")
    const matchNum = s.match(/^(\d+)/);
    if (matchNum) {
      const num = parseInt(matchNum[1], 10);
      if (!isNaN(num)) {
        // Descartar años (1900-2100) erróneamente pasados como versión
        if (num >= 1900 && num <= 2100) {
          return 'v01';
        }
        return `v${String(num).padStart(2, '0')}`;
      }
    }

    return 'v01';
  }

  /**
   * Normaliza versiones garantizando la estructura estándar de 3 caracteres "v01", "v02", etc.
   */
  normalizarVersion(ver) {
    return this.formatearVersion(ver);
  }

  /**
   * Compara si dos representaciones de versión son semánticamente iguales ("v01" == "1" == "01")
   */
  sonVersionesIguales(v1, v2) {
    if (!v1 && !v2) return true;
    const norm1 = this.formatearVersion(v1);
    const norm2 = this.formatearVersion(v2);
    return norm1 === norm2;
  }

  /**
   * Registra un evento de Control de Cambios e Histórico Documental (Creación, Versión, Ruta, Tipo, Eliminación)
   */
  async registrarCambioDocumental(tipoEvento, detalle = {}) {
    // Si es un cambio de versión pero ambas versiones son equivalentes (ej: 01 -> 1), no registrar evento falso
    if (tipoEvento === 'CAMBIO_VERSION' && this.sonVersionesIguales(detalle.versionAnterior, detalle.versionNueva)) {
      return null;
    }

    const sesion = this.obtenerSesionActiva() || this.obtenerUsuarioRecordado();
    const now = new Date();
    const fechaHora = this.formatearFechaHora(now);

    const vAntNorm = detalle.versionAnterior && detalle.versionAnterior !== 'N/A' ? this.normalizarVersion(detalle.versionAnterior) : 'N/A';
    const vNuevaNorm = detalle.versionNueva && detalle.versionNueva !== 'N/A' ? this.normalizarVersion(detalle.versionNueva) : 'N/A';

    const nuevoCambio = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tipoEvento: tipoEvento, // 'CREACION', 'ELIMINACION', 'CAMBIO_VERSION', 'CAMBIO_RUTA', 'CAMBIO_TIPO', 'EDICION_SHAREPOINT'
      codigo: (detalle.codigo || '').trim(),
      titulo: (detalle.titulo || '').trim(),
      versionAnterior: vAntNorm,
      versionNueva: vNuevaNorm,
      rutaAnterior: detalle.rutaAnterior || 'N/A',
      rutaNueva: detalle.rutaNueva || 'N/A',
      tipoAnterior: detalle.tipoAnterior || 'N/A',
      tipoNuevo: detalle.tipoNuevo || 'N/A',
      usuario: detalle.usuario || sesion?.nombre || 'Administrador SGC',
      identificacion: detalle.identificacion || sesion?.identificacion || 'N/A',
      cargo: detalle.cargo || sesion?.cargo || 'Control Calidad',
      perfil: detalle.perfil || sesion?.perfil || localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'total',
      detalle: detalle.detalle || '',
      fechaModificacionPrevia: detalle.fechaModificacionPrevia || '',
      fechaModificacionActual: detalle.fechaModificacionActual || '',
      sharepointUrl: detalle.sharepointUrl || '',
      fechaHora: detalle.fechaHora || fechaHora,
      timestamp: now.toISOString()
    };

    if (!Array.isArray(this.historicoData)) {
      this.historicoData = [];
    }

    // Evitar duplicados idénticos en el histórico (deduplicación por ventana temporal de 3 min o misma fecha de modificación)
    const codNuevo = (nuevoCambio.codigo || '').toUpperCase();
    const tiempoNuevo = now.getTime();

    const existeIndice = this.historicoData.findIndex((item) => {
      if (!item) return false;
      const codItem = (item.codigo || '').toUpperCase();
      if (codItem !== codNuevo) return false;

      const tipoItem = (item.tipoEvento || '').toUpperCase();
      if (tipoItem !== (nuevoCambio.tipoEvento || '').toUpperCase()) return false;

      // Mismo ID exacto
      const rawIdItem = (item.id || '').replace(/^hist_mig_/, '');
      const rawIdNuevo = (nuevoCambio.id || '').replace(/^hist_mig_/, '');
      if (rawIdItem && rawIdNuevo && rawIdItem === rawIdNuevo) return true;

      // Misma fechaHora exacta por el mismo usuario
      const mismoUsuario = (item.usuario || '').trim().toLowerCase() === (nuevoCambio.usuario || '').trim().toLowerCase() ||
                           (item.identificacion && item.identificacion !== 'N/A' && item.identificacion === nuevoCambio.identificacion);
      if (mismoUsuario && nuevoCambio.fechaHora && item.fechaHora && nuevoCambio.fechaHora.trim() === item.fechaHora.trim()) {
        return true;
      }

      // Ventana de 2 minutos para evitar doble clic accidental en la misma acción
      const tItem = this.parsearFechaMilisegundos(item.timestamp || item.fechaHora);
      if (mismoUsuario && tItem > 0 && Math.abs(tiempoNuevo - tItem) < 120000) {
        return true;
      }

      return false;
    });

    if (existeIndice >= 0) {
      // Actualizar registro existente conservando campos más completos
      const exist = this.historicoData[existeIndice];
      this.historicoData[existeIndice] = {
        ...exist,
        ...nuevoCambio,
        versionNueva: nuevoCambio.versionNueva && nuevoCambio.versionNueva !== 'N/A' ? nuevoCambio.versionNueva : (exist.versionNueva || '01'),
        versionAnterior: nuevoCambio.versionAnterior && nuevoCambio.versionAnterior !== 'N/A' ? nuevoCambio.versionAnterior : (exist.versionAnterior || '01'),
        rutaNueva: nuevoCambio.rutaNueva && nuevoCambio.rutaNueva !== 'N/A' ? nuevoCambio.rutaNueva : (exist.rutaNueva || 'N/A'),
        tipoNuevo: nuevoCambio.tipoNuevo && nuevoCambio.tipoNuevo !== 'N/A' ? nuevoCambio.tipoNuevo : (exist.tipoNuevo || 'Documento'),
        sharepointUrl: nuevoCambio.sharepointUrl || exist.sharepointUrl || '',
        detalle: nuevoCambio.detalle && nuevoCambio.detalle.trim() ? nuevoCambio.detalle.trim() : (exist.detalle || '')
      };
    } else {
      // Insertar al inicio (más reciente primero)
      this.historicoData.unshift(nuevoCambio);
    }

    if (this.historicoData.length > 2000) {
      this.historicoData = this.historicoData.slice(0, 2000);
    }

    try {
      localStorage.setItem(STORAGE_KEY_HISTORICO_CACHE, JSON.stringify(this.historicoData));
    } catch { }

    // Notificar a la interfaz
    try {
      window.dispatchEvent(new CustomEvent('agy_doc_history_logged', { detail: nuevoCambio }));
    } catch { }

    // Sincronizar en Google Drive y servidor
    this.guardarHistoricoEnNube();

    return nuevoCambio;
  }

  /**
   * Parsea cadenas de fecha en formatos ISO, timestamps en ms o DD/MM/YYYY HH:mm:ss a milisegundos
   */
  parsearFechaMilisegundos(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    let s = String(str).trim();
    if (!s || s === 'N/A' || s === 'Sincronizado' || s === 'null' || s === 'undefined') return 0;

    // Normalizar espacios no rompibles (NBSP y NNBSP \u202F \u00A0) y múltiples espacios
    s = s.replace(/[\u202F\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();

    if (s.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(s)) {
      const t = new Date(s).getTime();
      if (!isNaN(t) && t > 0) return t;
    }

    // Si es un timestamp en ms
    if (/^\d{12,14}$/.test(s)) {
      const n = parseInt(s, 10);
      if (!isNaN(n) && n > 0) return n;
    }

    // Formato DD/MM/YYYY o DD-MM-YYYY con hora opcional y soporte completo para a. m. / p. m. / am / pm
    const matchLatam = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?)?/i);
    if (matchLatam) {
      const dia = parseInt(matchLatam[1], 10);
      const mes = parseInt(matchLatam[2], 10) - 1;
      const anio = parseInt(matchLatam[3], 10);
      let hora = matchLatam[4] ? parseInt(matchLatam[4], 10) : 0;
      const min = matchLatam[5] ? parseInt(matchLatam[5], 10) : 0;
      const seg = matchLatam[6] ? parseInt(matchLatam[6], 10) : 0;
      const ampm = (matchLatam[7] || '').toLowerCase().replace(/[\.\s]/g, '');

      if (ampm === 'pm' && hora < 12) hora += 12;
      if (ampm === 'am' && hora === 12) hora = 0;

      const fechaObj = new Date(anio, mes, dia, hora, min, seg);
      if (!isNaN(fechaObj.getTime())) return fechaObj.getTime();
    }

    const parseDirecto = Date.parse(s);
    return isNaN(parseDirecto) ? 0 : parseDirecto;
  }

  /**
   * Formatea cualquier fecha a formato estándar institucional unificado DD/MM/YYYY HH:mm:ss (24h)
   */
  formatearFechaHora(val) {
    if (!val || val === 'N/A' || val === 'Sincronizado' || val === 'null' || val === 'undefined') {
      return val === 'Sincronizado' ? 'Sincronizado' : 'N/A';
    }
    const ms = this.parsearFechaMilisegundos(val);
    if (!ms || ms <= 0) return String(val).trim();

    const d = new Date(ms);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const seg = String(d.getSeconds()).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${hora}:${min}:${seg}`;
  }

  /**
   * Formatea cualquier fecha a formato de fecha simple DD/MM/YYYY
   */
  formatearFechaSolo(val) {
    if (!val || val === 'N/A' || val === 'Sincronizado' || val === 'null' || val === 'undefined') {
      return 'N/A';
    }
    const ms = this.parsearFechaMilisegundos(val);
    if (!ms || ms <= 0) return String(val).trim();

    const d = new Date(ms);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }

  /**
   * Obtiene la lista completa de cambios documentales o filtrada por código de documento ordenada de forma descendente y unificada con auditoría
   */
  obtenerHistoricoDocumental(codigoOpcional = null) {
    const listaOriginal = this.limpiarHistoricoSintetico(this.historicoData || []);
    const snapshotBase = this.obtenerSnapshotDocumentos() || {};

    // Unificar eventos de auditoría institucional sobre documentos (Ediciones, Creaciones, Eliminaciones, Metadatos)
    const eventosAuditoriaDocs = [];
    const listaAudit = this.auditoriaData?.registroAuditoria || [];
    if (Array.isArray(listaAudit)) {
      listaAudit.forEach((a) => {
        if (!a) return;
        const tipoNorm = String(a.tipo || '').trim().toUpperCase();
        if (!['EDICION', 'CREACION', 'ELIMINACION', 'METADATOS', 'CAMBIO_METADATOS', 'CAMBIO_VERSION'].includes(tipoNorm)) {
          return;
        }
        let tipoEv = 'EDICION_SHAREPOINT';
        if (tipoNorm === 'CREACION') tipoEv = 'CREACION';
        else if (tipoNorm === 'ELIMINACION') tipoEv = 'ELIMINACION';
        else if (tipoNorm === 'METADATOS' || tipoNorm === 'CAMBIO_METADATOS') tipoEv = 'CAMBIO_METADATOS';
        else if (tipoNorm === 'CAMBIO_VERSION') tipoEv = 'CAMBIO_VERSION';

        const codAud = (a.documentoCodigo || a.codigo || '').trim().toUpperCase();
        if (!codAud) return;

        eventosAuditoriaDocs.push({
          id: a.id || `aud_bridge_${Date.now()}`,
          tipoEvento: tipoEv,
          codigo: codAud,
          titulo: a.documentoTitulo || a.titulo || '',
          versionAnterior: a.versionAnterior || '01',
          versionNueva: a.versionNueva || '01',
          rutaAnterior: a.rutaAnterior || 'N/A',
          rutaNueva: a.rutaNueva || 'N/A',
          tipoAnterior: a.tipoAnterior || 'N/A',
          tipoNuevo: a.tipoNuevo || 'N/A',
          usuario: a.usuario || 'Colaborador',
          identificacion: a.identificacion || 'N/A',
          cargo: a.cargo || '',
          perfil: a.perfil || 'operativo',
          detalle: a.detalle || '',
          fechaHora: a.fechaHora || this.formatearFechaHora(a.timestamp),
          timestamp: a.timestamp || '',
          sharepointUrl: a.sharepointUrl || '',
          origenAuditoria: true
        });
      });
    }

    const listaCombinada = [...listaOriginal, ...eventosAuditoriaDocs];

    // Deduplicar manteniendo el registro auténtico más reciente por evento/documento/minuto
    const vistos = new Set();
    const listaDeduplicada = [];

    // Ordenar de más reciente a más antiguo por fecha real de la acción
    const ordenada = [...listaCombinada].sort((a, b) => {
      const tA = this.parsearFechaMilisegundos(a.fechaHora || a.timestamp || a.fechaModificacionActual);
      const tB = this.parsearFechaMilisegundos(b.fechaHora || b.timestamp || b.fechaModificacionActual);
      if (tB !== tA) return tB - tA;
      return (b.id || '').localeCompare(a.id || '');
    });

    ordenada.forEach((item) => {
      if (!item || !item.codigo) return;
      const cod = item.codigo.trim().toUpperCase();
      const tipoEv = (item.tipoEvento || 'EDICION_SHAREPOINT').toUpperCase();
      const fHora = (item.fechaHora || item.timestamp || item.fechaModificacionActual || '').trim();

      // Descartar falsos cambios de versión donde vAnterior == vNueva
      if (tipoEv === 'CAMBIO_VERSION' && this.sonVersionesIguales(item.versionAnterior, item.versionNueva)) {
        return;
      }

      // Clave de deduplicación: documento, tipo de evento y minuto de ejecución
      const fMinuto = fHora.slice(0, 16);
      const k = `${cod}_${tipoEv}_${fMinuto}`;
      if (vistos.has(k)) return;
      vistos.add(k);

      // Si es eliminación, verificar regla de integridad
      if (tipoEv === 'ELIMINACION') {
        const existeActivo = DOCUMENTOS_REALES.some((d) => d.codigo && d.codigo.trim().toUpperCase() === cod);
        if (existeActivo) return;

        const kDoc = `ELIM_${cod}`;
        if (vistos.has(kDoc)) return;
        vistos.add(kDoc);
      }

      const snapDoc = snapshotBase[cod];
      const rutaCompleta = (snapDoc && snapDoc.proceso)
        ? `${snapDoc.tipoProceso || 'Misional'} / ${snapDoc.area || ''} / ${snapDoc.proceso || ''}`.replace(/\s*\/\s*\/\s*/g, ' / ').replace(/^\s*\/\s*|\s*\/\s*$/g, '')
        : (item.rutaNueva && item.rutaNueva !== 'N/A' ? item.rutaNueva : 'N/A');

      listaDeduplicada.push({
        ...item,
        codigo: cod,
        titulo: item.titulo || snapDoc?.titulo || 'Documento Institucional',
        versionAnterior: this.normalizarVersion(item.versionAnterior || snapDoc?.version || '1'),
        versionNueva: this.normalizarVersion(item.versionNueva || snapDoc?.version || '1'),
        rutaNueva: rutaCompleta,
        tipoNuevo: snapDoc?.tipoDocumento || item.tipoNuevo || 'Documento',
        fechaModificacionActual: item.fechaModificacionActual || item.fechaHora || snapDoc?.modificacion || '',
        fechaHora: item.fechaHora || item.timestamp || item.fechaModificacionActual || snapDoc?.modificacion || '',
        detalle: item.detalle || (tipoEv === 'EDICION_SHAREPOINT' ? `Edición de archivo en SharePoint: ${item.fechaHora || snapDoc?.modificacion || ''}` : ''),
        sharepointUrl: snapDoc?.sharepointUrl || item.sharepointUrl || ''
      });
    });

    // Ordenar de más reciente a más antiguo
    listaDeduplicada.sort((a, b) => {
      const tA = this.parsearFechaMilisegundos(a.fechaHora || a.timestamp);
      const tB = this.parsearFechaMilisegundos(b.fechaHora || b.timestamp);
      if (tB !== tA) return tB - tA;
      return (b.id || '').localeCompare(a.id || '');
    });

    if (codigoOpcional) {
      const codBuscado = codigoOpcional.trim().toUpperCase();
      return listaDeduplicada.filter((h) => (h.codigo || '').trim().toUpperCase() === codBuscado);
    }

    return listaDeduplicada;
  }

  /**
   * Guarda una snapshot de los documentos para comparar cambios futuros (Diff Engine)
   */
  guardarSnapshotDocumentos(documentos) {
    if (!Array.isArray(documentos)) return;
    try {
      const mapaSnapshot = {};
      documentos.forEach((d) => {
        if (d && d.codigo) {
          mapaSnapshot[d.codigo.trim().toUpperCase()] = {
            codigo: d.codigo,
            titulo: d.titulo,
            version: this.normalizarVersion(d.version),
            tipoDocumento: d.tipoDocumento,
            tipoProceso: d.tipoProceso,
            area: d.area,
            proceso: d.proceso,
            carpeta: d.carpeta,
            estadoDocumento: d.estadoDocumento,
            disponible: d.disponible,
            modificacion: d.modificacion,
            sharepointUrl: d.sharepointUrl
          };
        }
      });
      localStorage.setItem('agy_sgc_documents_snapshot', JSON.stringify(mapaSnapshot));
    } catch { }
  }

  /**
   * Obtiene la última snapshot de documentos guardada
   */
  obtenerSnapshotDocumentos() {
    try {
      const saved = localStorage.getItem('agy_sgc_documents_snapshot');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  /**
   * Analiza la lista actual de documentos contra la última snapshot conocida
   * Detecta y registra automáticamente en auditoría y control de cambios:
   * - CREACION (nuevo documento)
   * - CAMBIO_VERSION (actualización de versión)
   * - CAMBIO_RUTA (traslado de proceso/área)
   * - CAMBIO_TIPO (modificación de tipo de documento)
   * - EDICION_SHAREPOINT (actualización de archivo o fecha en SharePoint)
   */
  detectarYRegistrarCambiosDocumentales(documentosActuales, sesionUsuario = null) {
    if (!Array.isArray(documentosActuales) || documentosActuales.length === 0) return 0;

    const snapshotAnterior = this.obtenerSnapshotDocumentos();
    // Si es la primera vez que se ejecuta el sistema y no hay snapshot previa, guardar snapshot base
    if (!snapshotAnterior || Object.keys(snapshotAnterior).length === 0) {
      this.guardarSnapshotDocumentos(documentosActuales);
      return 0;
    }

    const mapaActual = {};
    let cambiosDetectados = 0;

    documentosActuales.forEach((doc) => {
      if (!doc || !doc.codigo) return;
      const codUpper = doc.codigo.trim().toUpperCase();
      mapaActual[codUpper] = doc;

      const anterior = snapshotAnterior[codUpper];

      // 1. NUEVO DOCUMENTO (CREACION)
      if (!anterior) {
        this.registrarAuditoria('CREACION', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension || 'DOC',
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Nuevo documento incorporado al catálogo (${doc.codigo} - ${doc.titulo})`
        });
        this.registrarCambioDocumental('CREACION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          versionAnterior: 'N/A',
          versionNueva: this.normalizarVersion(doc.version || '1'),
          rutaAnterior: 'N/A',
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: 'N/A',
          tipoNuevo: doc.tipoDocumento || 'Documento Anexo',
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Nuevo documento incorporado al catálogo (${doc.codigo})`,
          sharepointUrl: doc.sharepointUrl || ''
        });
        cambiosDetectados++;
        return;
      }

      // 2. CAMBIO DE VERSIÓN (Cambio en el campo versión de la hoja de cálculo Google Drive)
      const vAnt = this.normalizarVersion(anterior.version);
      const vAct = this.normalizarVersion(doc.version);
      if (vAnt && vAct && !this.sonVersionesIguales(vAnt, vAct)) {
        this.registrarAuditoria('EDICION', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension || 'DOC',
          detalle: `Actualización de versión en catálogo (${doc.codigo}): ${vAnt} ➔ ${vAct}`
        });
        this.registrarCambioDocumental('CAMBIO_VERSION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          versionAnterior: vAnt,
          versionNueva: vAct,
          rutaAnterior: `${anterior.tipoProceso || 'N/A'} / ${anterior.area || 'N/A'} / ${anterior.proceso || 'N/A'}`,
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: anterior.tipoDocumento || 'N/A',
          tipoNuevo: doc.tipoDocumento || 'N/A',
          usuario: sesionUsuario?.nombre || 'Gestor Documental',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Actualización de versión en hoja de cálculo: ${vAnt} ➔ ${vAct}`,
          sharepointUrl: doc.sharepointUrl || ''
        });
        cambiosDetectados++;
      }

      // 3. CAMBIO DE METADATOS EN HOJA DE CÁLCULO (Google Drive: título, área, proceso, tipoDocumento)
      const tAnt = (anterior.titulo || '').trim();
      const tAct = (doc.titulo || '').trim();
      const tipoAnt = (anterior.tipoDocumento || '').trim();
      const tipoAct = (doc.tipoDocumento || '').trim();
      const areaAnt = (anterior.area || '').trim();
      const areaAct = (doc.area || '').trim();
      const procAnt = (anterior.proceso || '').trim();
      const procAct = (doc.proceso || '').trim();

      const cambioTitulo = tAnt && tAct && tAnt !== tAct;
      const cambioTipoDoc = tipoAnt && tipoAct && tipoAnt !== tipoAct;
      const cambioUbicacion = (areaAnt && areaAct && areaAnt !== areaAct) || (procAnt && procAct && procAnt !== procAct);

      if (cambioTitulo || cambioTipoDoc || cambioUbicacion) {
        const cambiosList = [];
        if (cambioTitulo) cambiosList.push(`Título: "${tAnt}" ➔ "${tAct}"`);
        if (cambioTipoDoc) cambiosList.push(`Tipo: ${tipoAnt} ➔ ${tipoAct}`);
        if (cambioUbicacion) cambiosList.push(`Ubicación: ${areaAnt}/${procAnt} ➔ ${areaAct}/${procAct}`);

        this.registrarAuditoria('METADATOS', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension || 'DOC',
          detalle: `Modificación de metadatos en catálogo (${doc.codigo}): ${cambiosList.join(' • ')}`
        });
        this.registrarCambioDocumental('CAMBIO_METADATOS', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          versionAnterior: vAct || vAnt || '01',
          versionNueva: vAct || vAnt || '01',
          rutaAnterior: `${anterior.tipoProceso || 'N/A'} / ${anterior.area || 'N/A'} / ${anterior.proceso || 'N/A'}`,
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: anterior.tipoDocumento || 'N/A',
          tipoNuevo: doc.tipoDocumento || 'N/A',
          usuario: sesionUsuario?.nombre || 'Gestor Documental',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Modificación de metadatos en hoja de cálculo: ${cambiosList.join(' • ')}`,
          sharepointUrl: doc.sharepointUrl || ''
        });
        cambiosDetectados++;
      }

      // 4. MODIFICACIÓN DE CONTENIDO / FECHA EN SHAREPOINT
      const mAnt = (anterior.modificacion || '').trim();
      const mAct = (doc.modificacion || '').trim();
      if (mAnt && mAct && mAnt !== 'N/A' && mAct !== 'N/A' && mAnt !== mAct) {
        this.registrarCambioDocumental('EDICION_SHAREPOINT', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          versionAnterior: doc.version || '01',
          versionNueva: doc.version || '01',
          rutaAnterior: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: doc.tipoDocumento || 'N/A',
          tipoNuevo: doc.tipoDocumento || 'N/A',
          fechaModificacionPrevia: mAnt,
          fechaModificacionActual: mAct,
          usuario: sesionUsuario?.nombre || 'Gestor Documental',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Edición de archivo físico en SharePoint. Previa: ${mAnt} ➔ Actual: ${mAct}`,
          fechaHora: mAct,
          sharepointUrl: doc.sharepointUrl || ''
        });
        cambiosDetectados++;
      }
    });

    // 5. DOCUMENTOS ELIMINADOS O RETIRADOS (existían en snapshot pero no en lista actual)
    Object.keys(snapshotAnterior).forEach((codUpper) => {
      if (!mapaActual[codUpper]) {
        const docEliminado = snapshotAnterior[codUpper];

        // Evitar duplicar eliminación si el último evento histórico para este código ya fue ELIMINACION
        const hist = Array.isArray(this.historicoData) ? this.historicoData : [];
        const ultimoEvento = hist.find((ev) => (ev.codigo || '').trim().toUpperCase() === codUpper);
        if (ultimoEvento && ultimoEvento.tipoEvento === 'ELIMINACION') {
          return;
        }

        this.registrarAuditoria('ELIMINACION', {
          documentoCodigo: docEliminado.codigo,
          documentoTitulo: docEliminado.titulo,
          documentoExtension: docEliminado.extension || 'DOC',
          detalle: `Documento retirado o marcado como obsoleto (${docEliminado.codigo})`
        });
        this.registrarCambioDocumental('ELIMINACION', {
          codigo: docEliminado.codigo,
          titulo: docEliminado.titulo,
          versionAnterior: docEliminado.version || '01',
          versionNueva: 'Retirado / Obsoleto',
          rutaAnterior: `${docEliminado.tipoProceso || 'N/A'} / ${docEliminado.area || 'N/A'} / ${docEliminado.proceso || 'N/A'}`,
          rutaNueva: 'Archivo Inactivo / Fuera de Catálogo',
          tipoAnterior: docEliminado.tipoDocumento || 'N/A',
          tipoNuevo: 'N/A',
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'total',
          detalle: `Documento retirado o marcado como obsoleto (${docEliminado.codigo})`,
          sharepointUrl: docEliminado.sharepointUrl || ''
        });
        cambiosDetectados++;
      }
    });

    // Actualizar la snapshot para futuras comparaciones
    this.guardarSnapshotDocumentos(documentosActuales);

    return cambiosDetectados;
  }

  /**
   * Genera el archivo CSV para exportar el Control de Cambios Documentales
   */
  exportarHistoricoDocumentalCSV(filtroTipo = 'TODOS', busqueda = '') {
    let eventos = this.obtenerHistoricoDocumental();

    if (filtroTipo && filtroTipo !== 'TODOS') {
      const fUpper = filtroTipo.toUpperCase();
      if (fUpper === 'METADATOS') {
        eventos = eventos.filter((ev) => ['CAMBIO_METADATOS', 'CAMBIO_RUTA', 'CAMBIO_TIPO', 'METADATOS'].includes((ev.tipoEvento || '').toUpperCase()));
      } else if (fUpper === 'EDICION_SHAREPOINT') {
        eventos = eventos.filter((ev) => ['EDICION_SHAREPOINT', 'EDICION'].includes((ev.tipoEvento || '').toUpperCase()));
      } else {
        eventos = eventos.filter((ev) => (ev.tipoEvento || '').toUpperCase() === fUpper);
      }
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      eventos = eventos.filter((ev) =>
        `${ev.codigo || ''} ${ev.titulo || ''} ${ev.usuario || ''} ${ev.identificacion || ''} ${ev.detalle || ''} ${ev.motivo || ''} ${ev.tipoNuevo || ''}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (eventos.length === 0) {
      return null;
    }

    const headers = [
      'Fecha y Hora',
      'Tipo de Evento',
      'Código',
      'Título del Documento',
      'Versión Anterior',
      'Versión Nueva',
      'Ruta Anterior',
      'Ruta Nueva',
      'Tipo Anterior',
      'Tipo Nuevo',
      'Colaborador',
      'Cédula / Identificación',
      'Cargo',
      'Perfil',
      'Detalle del Cambio',
      'Enlace SharePoint'
    ];

    const escapeCsv = (val) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const filas = eventos.map((ev) => {
      return [
        escapeCsv(this.formatearFechaHora(ev.fechaHora || ev.fechaModificacionActual || '')),
        escapeCsv(ev.tipoEvento || 'EDICION_SHAREPOINT'),
        escapeCsv(ev.codigo || ''),
        escapeCsv(ev.titulo || ''),
        escapeCsv(ev.versionAnterior || '01'),
        escapeCsv(ev.versionNueva || '01'),
        escapeCsv(ev.rutaAnterior || 'N/A'),
        escapeCsv(ev.rutaNueva || ''),
        escapeCsv(ev.tipoAnterior || 'N/A'),
        escapeCsv(ev.tipoNuevo || ''),
        escapeCsv(ev.usuario || ''),
        escapeCsv(ev.identificacion || ''),
        escapeCsv(ev.cargo || ''),
        escapeCsv(ev.perfil || ''),
        escapeCsv(ev.detalle || ''),
        escapeCsv(ev.sharepointUrl || '')
      ];
    });

    const BOM = '\uFEFF';
    return BOM + [headers.map(escapeCsv).join(';'), ...filas.map((f) => f.join(';'))].join('\r\n');
  }

  obtenerRegistroAuditoria() {
    const listaAud = (this.auditoriaData && Array.isArray(this.auditoriaData.registroAuditoria))
      ? this.auditoriaData.registroAuditoria
      : (Array.isArray(this.configuracion.registroAuditoria) ? this.configuracion.registroAuditoria : []);

    const auditoriaInteractiva = [...listaAud].filter((ev) => ev && !['CONSULTA', 'BUSQUEDA', 'BUSCAR'].includes(String(ev.tipo || '').toUpperCase()));

    const historico = this.obtenerHistoricoDocumental();
    const mapaEventos = new Map();

    // 1. Registrar eventos interactivos de usuarios (inicios de sesión, descargas, carpetas, creaciones, ediciones, etc.)
    auditoriaInteractiva.forEach((ev) => {
      if (!ev) return;
      const k = ev.id || `${ev.tipo}_${ev.identificacion || ev.usuario}_${ev.documentoCodigo || ''}_${ev.fechaHora || ev.timestamp}`;
      mapaEventos.set(k, ev);
    });

    // 2. Unificar eventos de gestión documental oficial desde el Control de Cambios
    historico.forEach((h) => {
      if (!h || !h.codigo) return;
      const tipoEv = (h.tipoEvento || '').toUpperCase();
      const cod = h.codigo.trim().toUpperCase();
      const fHora = h.fechaHora || h.fechaModificacionActual || '';

      if (tipoEv === 'ELIMINACION') {
        // Regla de Integridad: Si el documento existe activo en DOCUMENTOS_REALES, descartar falsa eliminación
        const existeActivo = DOCUMENTOS_REALES.some((d) => d.codigo && d.codigo.trim().toUpperCase() === cod);
        if (existeActivo) return;
        const k = `audit_elim_${cod}_${fHora}`;
        let evExistente = null;
        for (const [key, ev] of mapaEventos.entries()) {
          if ((ev.tipo || '').toUpperCase() === 'ELIMINACION' && (ev.documentoCodigo || '').trim().toUpperCase() === cod) {
            evExistente = { key, ev };
            break;
          }
        }
        const itemUnificado = {
          id: evExistente?.ev?.id || k,
          tipo: 'ELIMINACION',
          fechaHora: fHora || evExistente?.ev?.fechaHora || '',
          usuario: h.usuario || evExistente?.ev?.usuario || 'John Fredy Ramirez Rios',
          identificacion: h.identificacion || evExistente?.ev?.identificacion || '98677443',
          cargo: h.cargo || evExistente?.ev?.cargo || 'Medico General',
          perfil: h.perfil || evExistente?.ev?.perfil || 'total',
          documentoCodigo: h.codigo,
          documentoTitulo: h.titulo,
          detalle: h.motivo ? (h.detalle || `Documento retirado del catálogo oficial. Motivo: ${h.motivo}`) : (h.detalle || `Documento retirado del catálogo oficial (${h.codigo})`),
          timestamp: h.timestamp || evExistente?.ev?.timestamp || ''
        };
        if (evExistente) {
          mapaEventos.set(evExistente.key, itemUnificado);
        } else {
          mapaEventos.set(k, itemUnificado);
        }
      } else if (tipoEv === 'CREACION') {
        const k = `audit_crea_${cod}_${fHora}`;
        let evExistente = null;
        for (const [key, ev] of mapaEventos.entries()) {
          if ((ev.tipo || '').toUpperCase() === 'CREACION' && (ev.documentoCodigo || '').trim().toUpperCase() === cod) {
            evExistente = { key, ev };
            break;
          }
        }
        const itemUnificado = {
          id: evExistente?.ev?.id || k,
          tipo: 'CREACION',
          fechaHora: fHora || evExistente?.ev?.fechaHora || '',
          usuario: h.usuario || evExistente?.ev?.usuario || 'Colaborador',
          identificacion: h.identificacion || evExistente?.ev?.identificacion || 'N/A',
          cargo: h.cargo || evExistente?.ev?.cargo || 'Control Calidad',
          perfil: h.perfil || evExistente?.ev?.perfil || 'total',
          documentoCodigo: h.codigo,
          documentoTitulo: h.titulo,
          detalle: h.detalle || `Nuevo documento incorporado al catálogo (${h.codigo})`,
          timestamp: h.timestamp || evExistente?.ev?.timestamp || ''
        };
        if (evExistente) {
          mapaEventos.set(evExistente.key, itemUnificado);
        } else {
          mapaEventos.set(k, itemUnificado);
        }
      } else if (['EDICION_SHAREPOINT', 'CAMBIO_VERSION', 'CAMBIO_METADATOS'].includes(tipoEv)) {
        const rawId = (h.id || '').replace(/^hist_mig_/, '').trim();
        const k = `audit_edit_${rawId || `${cod}_${fHora}`}`;
        let evExistente = null;
        for (const [key, ev] of mapaEventos.entries()) {
          if ((ev.tipo || '').toUpperCase() === 'EDICION' && (
            (rawId && (ev.id || '').includes(rawId)) ||
            ((ev.documentoCodigo || '').trim().toUpperCase() === cod && (ev.fechaHora === fHora || ev.timestamp === h.timestamp))
          )) {
            evExistente = { key, ev };
            break;
          }
        }
        const itemUnificado = {
          id: evExistente?.ev?.id || k,
          tipo: 'EDICION',
          fechaHora: fHora || evExistente?.ev?.fechaHora || '',
          usuario: h.usuario || evExistente?.ev?.usuario || 'Colaborador',
          identificacion: h.identificacion || evExistente?.ev?.identificacion || 'N/A',
          cargo: h.cargo || evExistente?.ev?.cargo || 'Control Calidad',
          perfil: h.perfil || evExistente?.ev?.perfil || 'total',
          documentoCodigo: h.codigo,
          documentoTitulo: h.titulo,
          detalle: h.detalle || (fHora ? `Fecha de modificación en SharePoint: ${fHora}` : `Edición de documento (${h.codigo})`),
          timestamp: h.timestamp || evExistente?.ev?.timestamp || ''
        };
        if (evExistente) {
          mapaEventos.set(evExistente.key, itemUnificado);
        } else {
          mapaEventos.set(k, itemUnificado);
        }
      }
    });

    const listaUnificada = this.deduplicarRegistroAuditoria(Array.from(mapaEventos.values()));
    return listaUnificada;
  }

  /**
   * Obtiene el mapa con el conteo total de descargas registradas por código de documento
   */
  obtenerConteoDescargasDocumentos() {
    const eventos = this.obtenerRegistroAuditoria();
    const conteo = {};

    eventos.forEach((ev) => {
      if (ev && (ev.tipo === 'DESCARGA' || ev.tipo === 'EDICION')) {
        const cod = (ev.documentoCodigo || '').trim().toUpperCase();
        if (cod) {
          conteo[cod] = (conteo[cod] || 0) + 1;
        }
      }
    });

    // Cargar también conteos de descargas locales registradas
    try {
      const localDownloads = JSON.parse(localStorage.getItem('agy_sgc_doc_downloads') || '{}');
      Object.keys(localDownloads).forEach((cod) => {
        const codUpper = cod.trim().toUpperCase();
        conteo[codUpper] = (conteo[codUpper] || 0) + (localDownloads[cod] || 0);
      });
    } catch { }

    return conteo;
  }

  /**
   * Obtiene el conteo total de consultas e interacciones por código de documento
   */
  obtenerConteoConsultasDocumentos() {
    const eventos = this.obtenerRegistroAuditoria();
    const conteo = {};

    eventos.forEach((ev) => {
      const cod = (ev.documentoCodigo || '').trim().toUpperCase();
      if (cod) {
        // Ponderación: Descargas y ediciones = 3 pts, Consultas/aperturas = 1 pt
        const peso = ev.tipo === 'DESCARGA' || ev.tipo === 'EDICION' ? 3 : 1;
        conteo[cod] = (conteo[cod] || 0) + peso;
      }
    });

    // Cargar también conteos de consultas locales registradas
    try {
      const localViews = JSON.parse(localStorage.getItem('agy_sgc_doc_views') || '{}');
      Object.keys(localViews).forEach((cod) => {
        const codUpper = cod.trim().toUpperCase();
        conteo[codUpper] = (conteo[codUpper] || 0) + (localViews[cod] || 0);
      });
    } catch { }

    return conteo;
  }

  /**
   * Registra una descarga de documento y persiste en auditoría institucional con el formato de salida
   */
  registrarDescargaDocumento(doc, formatoSalida = null) {
    if (!doc || !doc.codigo) return;
    const codUpper = doc.codigo.trim().toUpperCase();
    try {
      const localDownloads = JSON.parse(localStorage.getItem('agy_sgc_doc_downloads') || '{}');
      localDownloads[codUpper] = (localDownloads[codUpper] || 0) + 1;
      localStorage.setItem('agy_sgc_doc_downloads', JSON.stringify(localDownloads));
    } catch { }

    const esFMT = codUpper.startsWith('FMT-') || codUpper.startsWith('FMT_') || codUpper.startsWith('FMT ') || codUpper === 'FMT';
    const esExcel = (doc.extension || '').toUpperCase().includes('XLS') || (doc.downloadUrl || '').toLowerCase().endsWith('.xlsx');
    const esWord = (doc.extension || '').toUpperCase().includes('DOC') || (doc.downloadUrl || '').toLowerCase().endsWith('.docx');

    const formatoEfectivo = formatoSalida || (esExcel ? 'EXCEL' : (esFMT ? 'FORMATO_EDITABLE' : (esWord ? 'PDF' : (doc.extension || 'PDF'))));

    const detalleDescarga = formatoEfectivo === 'PDF'
      ? `Descarga de documento oficial en PDF (${doc.codigo})`
      : (formatoEfectivo === 'EXCEL'
        ? `Descarga de hoja de cálculo en Excel (${doc.codigo})`
        : `Descarga de formato institucional editable (${doc.codigo})`);

    this.registrarAuditoria('DESCARGA', {
      documentoCodigo: doc.codigo,
      documentoTitulo: doc.titulo,
      documentoExtension: formatoEfectivo === 'PDF' ? 'PDF' : doc.extension,
      formatoDescarga: formatoEfectivo,
      detalle: detalleDescarga
    });
  }

  /**
   * Registra una visualización / consulta de ficha técnica de documento
   */
  registrarConsultaDocumento(doc) {
    if (!doc || !doc.codigo) return;
    const codUpper = doc.codigo.trim().toUpperCase();
    try {
      const localViews = JSON.parse(localStorage.getItem('agy_sgc_doc_views') || '{}');
      localViews[codUpper] = (localViews[codUpper] || 0) + 1;
      localStorage.setItem('agy_sgc_doc_views', JSON.stringify(localViews));
    } catch { }
  }

  /**
   * Retorna la lista ordenada del Top 10 de documentos con más descargas
   * Incluye ranking y número de descargas para visualización clara
   */
  obtenerTop10DocumentosOrdenados(documentos) {
    if (!documentos || documentos.length === 0) return [];
    const conteos = this.obtenerConteoDescargasDocumentos();

    // 1. Filtrar solo documentos que estén disponibles y que tengan descargas > 0
    const disponiblesConDescargas = documentos.filter((d) => {
      if (d.disponible === false || d.disponible === 'NO' || d.disponible === 'false') {
        return false;
      }
      const cant = conteos[(d.codigo || '').trim().toUpperCase()] || 0;
      return cant > 0;
    });

    if (disponiblesConDescargas.length === 0) return [];

    // 2. Ordenar de mayor a menor número de descargas
    disponiblesConDescargas.sort((a, b) => {
      const cA = conteos[(a.codigo || '').trim().toUpperCase()] || 0;
      const cB = conteos[(b.codigo || '').trim().toUpperCase()] || 0;
      if (cB !== cA) return cB - cA;
      return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
    });

    const top10 = disponiblesConDescargas.slice(0, 10);
    return top10.map((d, index) => ({
      ...d,
      topRanking: index + 1,
      numDescargas: conteos[(d.codigo || '').trim().toUpperCase()] || 0
    }));
  }

  /**
   * Retorna un Set con los IDs de los 10 documentos más descargados
   */
  obtenerTop10Ids(documentos) {
    const top10 = this.obtenerTop10DocumentosOrdenados(documentos);
    return new Set(top10.map((d) => d.id));
  }

  async limpiarRegistroAuditoria() {
    this.auditoriaData.registroAuditoria = [];
    this.configuracion.registroAuditoria = [];
    try {
      localStorage.setItem(STORAGE_KEY_AUDITORIA_CACHE, JSON.stringify(this.auditoriaData));
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }
    await this.guardarAuditoriaEnNube(true);
    return true;
  }

  /**
   * Elimina los registros de auditoría de un colaborador específico por identificación o nombre
   */
  async purgarAuditoriaColaborador(identificacionOTexto = '') {
    if (!this.auditoriaData || !Array.isArray(this.auditoriaData.registroAuditoria) || !identificacionOTexto) return;

    const idLimpiar = this.limpiarNumeros(identificacionOTexto || '');
    const textoLimpiar = (identificacionOTexto || '').toLowerCase().trim();
    const anteriorLen = this.auditoriaData.registroAuditoria.length;

    this.auditoriaData.registroAuditoria = this.auditoriaData.registroAuditoria.filter((ev) => {
      if (!ev) return false;
      const evId = this.limpiarNumeros(ev.identificacion || '');
      const evUser = (ev.usuario || '').toLowerCase();

      const esColaborador = (idLimpiar && evId === idLimpiar) ||
        (textoLimpiar && evUser.includes(textoLimpiar));

      return !esColaborador;
    });

    this.configuracion.registroAuditoria = this.auditoriaData.registroAuditoria;

    try {
      localStorage.setItem(STORAGE_KEY_AUDITORIA_CACHE, JSON.stringify(this.auditoriaData));
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    if (anteriorLen !== this.auditoriaData.registroAuditoria.length) {
      await this.guardarAuditoriaEnNube(true);
    }
    return true;
  }

  /**
   * Registra o actualiza manualmente un usuario con perfil asignado (Acceso Total por defecto)
   */
  async registrarUsuarioManual(datos) {
    const docClean = this.limpiarNumeros(datos.identificacion);
    if (!docClean) {
      return { ok: false, error: 'Número de documento inválido.' };
    }
    if (!datos.nombre || !datos.email) {
      return { ok: false, error: 'Nombre y correo electrónico son requeridos.' };
    }

    const passwordPlano = (datos.password || '').trim() || 'USV2026*';
    const hash = await this.calcularHash(passwordPlano);
    const perfilAsignado = datos.perfil || 'total';

    const usuarioObj = {
      identificacion: datos.identificacion.trim(),
      nombre: datos.nombre.trim(),
      email: datos.email.trim().toLowerCase(),
      cargo: (datos.cargo || 'Acceso Administrativo').trim(),
      sede: (datos.sede || 'Principal').trim(),
      perfil: perfilAsignado,
      passwordHash: hash,
      fechaRegistro: new Date().toISOString(),
      ultimoIngreso: new Date().toISOString()
    };

    // 1. Guardar en usuariosRegistrados
    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};
    this.configuracion.usuariosRegistrados[docClean] = usuarioObj;

    // 2. Mapear perfil personalizado para que prevalezca
    this.configuracion.mapeoPerfilesPersonalizados = this.configuracion.mapeoPerfilesPersonalizados || {};
    this.configuracion.mapeoPerfilesPersonalizados[docClean] = perfilAsignado;

    // 3. Añadir a empleados en memoria si no existe
    const existeEnMatriz = this.empleados.some((e) => this.limpiarNumeros(e.identificacion) === docClean);
    if (!existeEnMatriz) {
      this.empleados.unshift({
        identificacion: usuarioObj.identificacion,
        nombre: usuarioObj.nombre,
        email: usuarioObj.email,
        cargo: usuarioObj.cargo,
        sede: usuarioObj.sede
      });
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    // Sincronizar en la nube con Google Drive
    await this.guardarConfiguracionEnNube();

    return { ok: true, usuario: usuarioObj };
  }

  /**
   * Elimina un usuario registrado de la configuración
   */
  async eliminarUsuarioRegistrado(doc) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean) return false;

    if (this.configuracion.usuariosRegistrados) {
      delete this.configuracion.usuariosRegistrados[docClean];
    }
    if (this.configuracion.mapeoPerfilesPersonalizados) {
      delete this.configuracion.mapeoPerfilesPersonalizados[docClean];
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    await this.guardarConfiguracionEnNube();
    return true;
  }

  obtenerTodosUsuariosRegistrados() {
    const dict = this.configuracion?.usuariosRegistrados || {};
    return Object.values(dict);
  }

  /**
   * Retorna la lista de empleados activos y registrados en Google Drive con perfil editable
   */
  obtenerColaboradoresConPerfilesEspeciales() {
    const mapeo = this.configuracion?.mapeoPerfilesPersonalizados || {};
    const registrados = this.configuracion?.usuariosRegistrados || {};
    const todosDocs = new Set([...Object.keys(mapeo), ...Object.keys(registrados)]);
    const resultado = [];

    todosDocs.forEach((docClean) => {
      if (!docClean) return;
      const emp = this.empleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean);
      const reg = registrados[docClean];
      const perfilActual = mapeo[docClean] || reg?.perfil || this.determinarPerfil(emp?.cargo || '', docClean) || 'operativo';

      resultado.push({
        identificacion: emp?.identificacion || reg?.identificacion || docClean,
        nombre: emp?.nombre || reg?.nombre || 'Colaborador',
        email: emp?.email || reg?.email || 'N/A',
        cargo: emp?.cargo || reg?.cargo || 'N/A',
        sede: emp?.sede || reg?.sede || 'Principal',
        perfilBase: this.determinarPerfil(emp?.cargo || '', ''),
        perfilEspecial: perfilActual
      });
    });

    resultado.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
    return resultado;
  }

  /**
   * Remueve la asignación de perfil especial en Google Drive
   */
  async removerPerfilPersonalizado(doc) {
    const docClean = this.limpiarNumeros(doc);
    if (!docClean) return false;

    if (this.configuracion.mapeoPerfilesPersonalizados) {
      delete this.configuracion.mapeoPerfilesPersonalizados[docClean];
    }
    if (this.configuracion.usuariosRegistrados?.[docClean]) {
      const emp = this.empleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean);
      this.configuracion.usuariosRegistrados[docClean].perfil = this.determinarPerfil(emp?.cargo || '', docClean);
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    await this.guardarConfiguracionEnNube();
    return true;
  }

  /**
   * Obtiene la preferencia de vista del catálogo (tarjetas o tabla).
   * Por defecto para todos los usuarios: 'tabla'.
   */
  obtenerPreferenciaVistaCatalogo(doc = null) {
    const docClean = this.limpiarNumeros(doc);
    if (docClean && this.configuracion?.preferenciasPorUsuario?.[docClean]?.vistaCatalogo) {
      return this.configuracion.preferenciasPorUsuario[docClean].vistaCatalogo;
    }
    if (this.configuracion?.preferenciaVistaGlobal) {
      return this.configuracion.preferenciaVistaGlobal;
    }
    const local = localStorage.getItem('usv_vista_catalogo');
    if (local === 'tabla' || local === 'tarjetas') return local;
    return 'tabla';
  }

  /**
   * Guarda la preferencia de vista del catálogo en local y en Google Drive (usuarios.conf)
   */
  async guardarPreferenciaVistaCatalogo(doc, vista) {
    try {
      localStorage.setItem('usv_vista_catalogo', vista);
    } catch { }

    this.configuracion.preferenciaVistaGlobal = vista;
    const docClean = this.limpiarNumeros(doc);
    if (docClean) {
      this.configuracion.preferenciasPorUsuario = this.configuracion.preferenciasPorUsuario || {};
      this.configuracion.preferenciasPorUsuario[docClean] = this.configuracion.preferenciasPorUsuario[docClean] || {};
      this.configuracion.preferenciasPorUsuario[docClean].vistaCatalogo = vista;
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    await this.guardarConfiguracionEnNube();
  }

  /**
   * Obtiene los filtros por defecto configurados para el inicio
   */
  obtenerFiltrosPorDefecto(doc = null) {
    const docClean = this.limpiarNumeros(doc);
    if (docClean && this.configuracion?.preferenciasPorUsuario?.[docClean]?.filtrosPorDefecto) {
      return this.configuracion.preferenciasPorUsuario[docClean].filtrosPorDefecto;
    }
    if (this.configuracion?.filtrosPorDefectoGlobal) {
      return this.configuracion.filtrosPorDefectoGlobal;
    }
    try {
      const local = JSON.parse(localStorage.getItem('usv_filtros_defecto') || 'null');
      if (local && typeof local === 'object') return local;
    } catch { }
    return { tipoProceso: '', area: '', proceso: '' };
  }

  /**
   * Guarda los filtros por defecto en local y en Google Drive (usuarios.conf)
   */
  async guardarFiltrosPorDefecto(doc, filtros) {
    try {
      localStorage.setItem('usv_filtros_defecto', JSON.stringify(filtros || {}));
    } catch { }

    this.configuracion.filtrosPorDefectoGlobal = filtros || {};
    const docClean = this.limpiarNumeros(doc);
    if (docClean) {
      this.configuracion.preferenciasPorUsuario = this.configuracion.preferenciasPorUsuario || {};
      this.configuracion.preferenciasPorUsuario[docClean] = this.configuracion.preferenciasPorUsuario[docClean] || {};
      this.configuracion.preferenciasPorUsuario[docClean].filtrosPorDefecto = filtros || {};
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch { }

    await this.guardarConfiguracionEnNube();
  }

  /**
   * Guarda preferencias genéricas del usuario (vistaCatalogo, filtros, etc.)
   */
  async guardarPreferenciaUsuario(clave, valor, doc = null) {
    if (clave === 'vistaCatalogo') {
      return this.guardarPreferenciaVistaCatalogo(doc, valor);
    }
    if (clave === 'filtrosPorDefecto') {
      return this.guardarFiltrosPorDefecto(doc, valor);
    }
  }

  /**
   * Obtiene las rutas de conexión para EMPLEADOS_ACTIVOS.csv, REPOSITORIO_DOCUMENTAL.csv y usuarios.conf
   */
  obtenerRutasConfiguradas() {
    const defaultRoutes = {
      empleadosCsv: 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQDMt48585E1SJdtmCVBFpflAYIlEtWpENmxdj6ow3J3AR0?e=yLjbNy&download=1',
      repositorioCsv: 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQCctVunBodCQq97XWMPrue7AaIRpd-pVgSUuZrMBWBcA2A?e=revQbX&download=1',
      usuariosConf: 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec'
    };

    try {
      const saved = localStorage.getItem('agy_sgc_custom_routes');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Si tenía las rutas antiguas proxy /api/, usar las rutas oficiales de OneDrive
        if (parsed.empleadosCsv === '/api/empleados' || parsed.repositorioCsv === '/api/repositorio') {
          return defaultRoutes;
        }
        return { ...defaultRoutes, ...parsed };
      }
    } catch { }
    return defaultRoutes;
  }

  /**
   * Guarda las nuevas rutas configuradas para sincronización
   */
  guardarRutasConfiguradas(nuevasRutas) {
    const defaultRoutes = {
      empleadosCsv: 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQDMt48585E1SJdtmCVBFpflAYIlEtWpENmxdj6ow3J3AR0?e=yLjbNy&download=1',
      repositorioCsv: 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQCctVunBodCQq97XWMPrue7AaIRpd-pVgSUuZrMBWBcA2A?e=revQbX&download=1',
      usuariosConf: 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec'
    };

    const rutas = {
      empleadosCsv: (nuevasRutas?.empleadosCsv || defaultRoutes.empleadosCsv).trim(),
      repositorioCsv: (nuevasRutas?.repositorioCsv || defaultRoutes.repositorioCsv).trim(),
      usuariosConf: (nuevasRutas?.usuariosConf || defaultRoutes.usuariosConf).trim()
    };

    try {
      localStorage.setItem('agy_sgc_custom_routes', JSON.stringify(rutas));
    } catch { }

    return rutas;
  }

  /**
   * =========================================================
   * TABLAS MAESTRAS (Prefijos, Tipos de Documento y Áreas)
   * =========================================================
   */

  obtenerTiposDocumento() {
    const defaultTipos = [
      { id: 'tipo-fmt', nombre: 'Formato', prefijo: 'FMT', descripcion: 'Formatos, planillas y registros de calidad' },
      { id: 'tipo-mn', nombre: 'Manual', prefijo: 'MN', descripcion: 'Manuales organizacionales y operativos' },
      { id: 'tipo-pr', nombre: 'Procedimiento', prefijo: 'PR', descripcion: 'Procedimientos y flujos de procesos' },
      { id: 'tipo-gu', nombre: 'Guía', prefijo: 'GU', descripcion: 'Guías de práctica y lineamientos técnicos' },
      { id: 'tipo-ins', nombre: 'Instructivo', prefijo: 'INS', descripcion: 'Instructivos paso a paso' },
      { id: 'tipo-da', nombre: 'Documento Anexo', prefijo: 'DA', descripcion: 'Documentos anexos y de apoyo' },
      { id: 'tipo-pol', nombre: 'Política', prefijo: 'POL', descripcion: 'Políticas institucionales' },
      { id: 'tipo-cr', nombre: 'Caracterización', prefijo: 'CR', descripcion: 'Caracterizaciones de procesos' },
      { id: 'tipo-rg', nombre: 'Reglamento', prefijo: 'RG', descripcion: 'Reglamentos y directrices' },
      { id: 'tipo-pt', nombre: 'Protocolo', prefijo: 'PT', descripcion: 'Protocolos asistenciales' }
    ];

    if (!this.maestrasData?.tablasMaestras?.tiposDocumento || !Array.isArray(this.maestrasData.tablasMaestras.tiposDocumento) || this.maestrasData.tablasMaestras.tiposDocumento.length === 0) {
      if (this.configuracion.tablasMaestras?.tiposDocumento && Array.isArray(this.configuracion.tablasMaestras.tiposDocumento)) {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.tiposDocumento = this.configuracion.tablasMaestras.tiposDocumento;
      } else {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.tiposDocumento = defaultTipos;
      }
    }
    return this.maestrasData.tablasMaestras.tiposDocumento;
  }

  async guardarTipoDocumento({ id = null, nombre, prefijo, descripcion = '' }) {
    if (!nombre || !prefijo) throw new Error('El nombre y el prefijo son obligatorios.');
    const tipos = [...this.obtenerTiposDocumento()];
    const normPrefijo = prefijo.trim().toUpperCase();
    const normNombre = nombre.trim();

    if (id) {
      const idx = tipos.findIndex((t) => t.id === id);
      if (idx !== -1) {
        tipos[idx] = { ...tipos[idx], nombre: normNombre, prefijo: normPrefijo, descripcion };
      } else {
        tipos.push({ id: `tipo-${Date.now()}`, nombre: normNombre, prefijo: normPrefijo, descripcion });
      }
    } else {
      tipos.push({ id: `tipo-${Date.now()}`, nombre: normNombre, prefijo: normPrefijo, descripcion });
    }

    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.tiposDocumento = tipos;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return tipos;
  }

  async eliminarTipoDocumento(id) {
    let tipos = this.obtenerTiposDocumento().filter((t) => t.id !== id);
    if (tipos.length === 0) {
      tipos = this.obtenerTiposDocumento();
    }
    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.tiposDocumento = tipos;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return tipos;
  }

  obtenerTiposProceso() {
    const defaultTiposProceso = [
      { id: 'tp-apoyo', nombre: 'Apoyo' },
      { id: 'tp-calidad', nombre: 'Calidad' },
      { id: 'tp-estrategico', nombre: 'Estrategico' },
      { id: 'tp-misional', nombre: 'Misional' }
    ];

    if (!this.maestrasData?.tablasMaestras?.tiposProceso || !Array.isArray(this.maestrasData.tablasMaestras.tiposProceso) || this.maestrasData.tablasMaestras.tiposProceso.length === 0) {
      if (this.configuracion.tablasMaestras?.tiposProceso && Array.isArray(this.configuracion.tablasMaestras.tiposProceso)) {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.tiposProceso = this.configuracion.tablasMaestras.tiposProceso;
      } else {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.tiposProceso = defaultTiposProceso;
      }
    }
    return this.maestrasData.tablasMaestras.tiposProceso;
  }

  async guardarTipoProceso({ id = null, nombre }) {
    if (!nombre) throw new Error('El nombre del tipo de proceso es obligatorio.');
    const tipos = [...this.obtenerTiposProceso()];
    const normNombre = nombre.trim();

    if (id) {
      const idx = tipos.findIndex((t) => t.id === id);
      if (idx !== -1) {
        tipos[idx] = { ...tipos[idx], nombre: normNombre };
      } else {
        tipos.push({ id: `tp-${Date.now()}`, nombre: normNombre });
      }
    } else {
      tipos.push({ id: `tp-${Date.now()}`, nombre: normNombre });
    }

    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.tiposProceso = tipos;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return tipos;
  }

  async eliminarTipoProceso(id) {
    let tipos = this.obtenerTiposProceso().filter((t) => t.id !== id);
    if (tipos.length === 0) {
      tipos = this.obtenerTiposProceso();
    }
    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.tiposProceso = tipos;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return tipos;
  }

  obtenerAreasInstitucionales() {
    const defaultAreas = [
      {
        id: 'area-ghu',
        nombre: 'Gestión Humana',
        sigla: 'GHU',
        procesos: [
          'Bienestar',
          'Comunicaciones',
          'Desempeño',
          'Formación',
          'Gestión Documental',
          'Inducción',
          'Nómina',
          'Políticas Institucionales',
          'Seguridad y Salud en el Trabajo',
          'Selección'
        ]
      },
      {
        id: 'area-gad',
        nombre: 'Gestión Administrativa',
        sigla: 'GAD',
        procesos: [
          'Planeación Estratégica y Dirección'
        ]
      },
      {
        id: 'area-gfi',
        nombre: 'Gestión Financiera',
        sigla: 'GFI',
        procesos: [
          'Gestión Financiera y Contable'
        ]
      },
      {
        id: 'area-gic',
        nombre: 'Gestión Integral de Calidad',
        sigla: 'GIC',
        procesos: [
          'Gestión Integral de Calidad'
        ]
      },
      {
        id: 'area-gmd',
        nombre: 'Gestión Médica y Asistencial',
        sigla: 'GMD',
        procesos: [
          'Gestión de Especialistas',
          'Gestión de Medicina General'
        ]
      },
      {
        id: 'area-gti',
        nombre: 'Gestión TICs',
        sigla: 'GTI',
        procesos: [
          'Tecnologías de la Información'
        ]
      }
    ];

    if (!this.maestrasData?.tablasMaestras?.areas || !Array.isArray(this.maestrasData.tablasMaestras.areas) || this.maestrasData.tablasMaestras.areas.length === 0) {
      if (this.configuracion.tablasMaestras?.areas && Array.isArray(this.configuracion.tablasMaestras.areas)) {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.areas = this.configuracion.tablasMaestras.areas;
      } else {
        this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
        this.maestrasData.tablasMaestras.areas = defaultAreas;
      }
    }
    return this.maestrasData.tablasMaestras.areas;
  }

  obtenerProcesosPorArea(nombreArea) {
    const areas = this.obtenerAreasInstitucionales();
    if (!nombreArea) {
      const todos = new Set();
      areas.forEach((a) => {
        if (Array.isArray(a.procesos)) {
          a.procesos.forEach((p) => todos.add(p));
        }
      });
      return Array.from(todos).sort((a, b) => a.localeCompare(b, 'es'));
    }

    const norm = nombreArea.trim().toLowerCase();
    const area = areas.find((a) => (a.nombre || '').toLowerCase() === norm || (a.sigla || '').toLowerCase() === norm);
    return Array.isArray(area?.procesos) ? [...area.procesos].sort((a, b) => a.localeCompare(b, 'es')) : [];
  }

  async guardarAreaInstitucional({ id = null, nombre, sigla, procesos = [] }) {
    if (!nombre || !sigla) throw new Error('El nombre del área y la sigla son obligatorios.');
    const areas = [...this.obtenerAreasInstitucionales()];
    const normSigla = sigla.trim().toUpperCase();
    const normNombre = nombre.trim();

    if (id) {
      const idx = areas.findIndex((a) => a.id === id);
      if (idx !== -1) {
        areas[idx] = {
          ...areas[idx],
          nombre: normNombre,
          sigla: normSigla,
          procesos: Array.isArray(procesos) ? procesos : (areas[idx].procesos || [])
        };
      } else {
        areas.push({ id: `area-${Date.now()}`, nombre: normNombre, sigla: normSigla, procesos: procesos || [] });
      }
    } else {
      areas.push({ id: `area-${Date.now()}`, nombre: normNombre, sigla: normSigla, procesos: procesos || [] });
    }

    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.areas = areas;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return areas;
  }

  async guardarProcesoEnArea(areaIdONombre, nombreProceso) {
    if (!areaIdONombre || !nombreProceso) return;
    const procNorm = nombreProceso.trim();
    const areas = [...this.obtenerAreasInstitucionales()];
    const area = areas.find((a) => a.id === areaIdONombre || a.nombre.toLowerCase() === areaIdONombre.toLowerCase());
    if (!area) return;

    if (!Array.isArray(area.procesos)) area.procesos = [];
    if (!area.procesos.includes(procNorm)) {
      area.procesos.push(procNorm);
      area.procesos.sort((a, b) => a.localeCompare(b, 'es'));
      this.maestrasData.tablasMaestras.areas = areas;
      try {
        localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
      } catch { }
      await this.guardarTablasMaestrasEnNube();
    }
    return area.procesos;
  }

  async eliminarProcesoDeArea(areaIdONombre, nombreProceso) {
    if (!areaIdONombre || !nombreProceso) return;
    const procNorm = nombreProceso.trim();
    const areas = [...this.obtenerAreasInstitucionales()];
    const area = areas.find((a) => a.id === areaIdONombre || a.nombre.toLowerCase() === areaIdONombre.toLowerCase());
    if (!area || !Array.isArray(area.procesos)) return;

    area.procesos = area.procesos.filter((p) => p !== procNorm);
    this.maestrasData.tablasMaestras.areas = areas;
    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }
    await this.guardarTablasMaestrasEnNube();
    return area.procesos;
  }

  async eliminarAreaInstitucional(id) {
    let areas = this.obtenerAreasInstitucionales().filter((a) => a.id !== id);
    if (areas.length === 0) {
      areas = this.obtenerAreasInstitucionales();
    }
    this.maestrasData.tablasMaestras = this.maestrasData.tablasMaestras || {};
    this.maestrasData.tablasMaestras.areas = areas;

    try {
      localStorage.setItem(STORAGE_KEY_MAESTRAS_CACHE, JSON.stringify(this.maestrasData));
    } catch { }

    await this.guardarTablasMaestrasEnNube();
    return areas;
  }
}

export const staffService = new StaffService();
