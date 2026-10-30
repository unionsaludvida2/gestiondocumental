/**

 * Servicio de Personal y Autenticación de Colaboradores
 * Unión para la salud y la vida S.A.S.
 * 
 * Gestiona la matriz de 1,305 colaboradores activos, autenticación por Cédula + Correo,
 * registro seguro de contraseñas en usuarios.conf y persistencia de sesión.
 */

import { cacheService } from './cache-service.js?v=11.9.7';
const STORAGE_KEY_AUTH_SESSION = 'agy_sgc_authenticated_session';
const STORAGE_KEY_REMEMBERED_USER = 'agy_sgc_remembered_user';
const STORAGE_KEY_STAFF_CACHE = 'agy_sgc_staff_cache';
const STORAGE_KEY_CONF_CACHE = 'agy_sgc_conf_cache';
const STORAGE_KEY_AUDITORIA_CACHE = 'agy_sgc_auditoria_cache';
const STORAGE_KEY_MAESTRAS_CACHE = 'agy_sgc_maestras_cache';
const STORAGE_KEY_HISTORICO_CACHE = 'agy_sgc_historico_cache';
const STORAGE_KEY_AUTH_LOCKOUTS = 'agy_sgc_auth_lockouts';
export const STORAGE_KEY_ADMIN_CACHED_USER = 'agy_admin_cached_user';
export const STORAGE_KEY_USER_PROFILE = 'agy_user_profile';

export class StaffService {
  constructor() {
    this.empleados = [];

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

  // ============================================================================

  // REGLA DE NEGOCIO 9.4: TASA LÍMITE (RATE LIMITING) Y BLOQUEO ESCALONADO

  // 3 intentos fallidos -> Bloqueo temporal de 15 minutos.

  // 3 bloqueos temporales consecutivos -> Bloqueo permanente de cuenta.

  // Desbloqueo de cuenta -> Exclusivo de Superadministrador (Acceso Total).

  // ============================================================================

  obtenerLockouts() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_AUTH_LOCKOUTS);

      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  guardarLockouts(lockouts) {
    try {
      localStorage.setItem(STORAGE_KEY_AUTH_LOCKOUTS, JSON.stringify(lockouts));
    } catch {}
  }

  normalizarIdentificadorBloqueo(idRaw) {
    if (!idRaw) return '';

    const str = String(idRaw).trim().toLowerCase();

    if (str.includes('@')) return str;

    return this.limpiarNumeros(str);
  }

  obtenerClavesIdentificador(idRaw) {
    const claves = new Set();
    const idNorm = this.normalizarIdentificadorBloqueo(idRaw);

    if (idNorm) claves.add(idNorm);

    // Cruzar con matriz de colaboradores

    const listaEmpleados = Array.isArray(this.empleados) ? this.empleados : [];

    const emp = listaEmpleados.find((e) => 
      (e.email && e.email.trim().toLowerCase() === idNorm) ||
      (e.identificacion && this.limpiarNumeros(e.identificacion) === idNorm)
    );

    if (emp) {
      if (emp.email) claves.add(emp.email.trim().toLowerCase());

      if (emp.identificacion) claves.add(this.limpiarNumeros(emp.identificacion));
    }

    return Array.from(claves);
  }

  obtenerEstadoBloqueo(_idRaw) {
    // Seguridad delegada a SharePoint Online / Microsoft 365 (sin bloqueos locales)

    return {
      bloqueado: false,
      tipo: 'ninguno',
      cuentaBloqueada: false,
      minutosRestantes: 0,
      error: ''
    };
  }

  registrarFalloAutenticacion(idRaw) {
    const claves = this.obtenerClavesIdentificador(idRaw);

    if (claves.length === 0) {
      return { tipo: 'fallo', bloqueado: false, error: 'Contraseña o credencial incorrecta.' };
    }

    const lockouts = this.obtenerLockouts();
    const ahora = Date.now();
    let registroActual = null;

    for (const k of claves) {
      if (lockouts[k]) {
        registroActual = { ...lockouts[k] };

        break;
      }
    }

    if (!registroActual) {
      registroActual = {
        intentosFallidos: 0,
        bloqueadoHasta: 0,
        bloqueosConsecutivos: 0,
        cuentaBloqueada: false
      };
    }

    // Si ya expiró el bloqueo temporal anterior, resetear intentos fallidos

    if (registroActual.bloqueadoHasta && registroActual.bloqueadoHasta <= ahora) {
      registroActual.bloqueadoHasta = 0;
      registroActual.intentosFallidos = 0;
    }

    registroActual.intentosFallidos = (registroActual.intentosFallidos || 0) + 1;
    let resultado = null;

    if (registroActual.intentosFallidos >= 3) {
      registroActual.bloqueosConsecutivos = (registroActual.bloqueosConsecutivos || 0) + 1;
      registroActual.intentosFallidos = 0;

      if (registroActual.bloqueosConsecutivos >= 3) {
        registroActual.cuentaBloqueada = true;
        registroActual.bloqueadoHasta = 0;

        resultado = {
          tipo: 'cuenta',
          bloqueado: true,
          cuentaBloqueada: true,
          bloqueosConsecutivos: 3,
          error: '⛔ Has acumulado 3 bloqueos consecutivos de seguridad. Tu cuenta ha sido BLOQUEADA PERMANENTEMENTE. Comunícate con un Superadministrador para restablecer el acceso.'
        };
      } else {
        registroActual.bloqueadoHasta = ahora + (15 * 60 * 1000); // 15 minutos exactos

        resultado = {
          tipo: 'temporal',
          bloqueado: true,
          cuentaBloqueada: false,
          bloqueadoHasta: registroActual.bloqueadoHasta,
          minutosRestantes: 15,
          bloqueosConsecutivos: registroActual.bloqueosConsecutivos,
          error: `⏳ Has alcanzado 3 intentos fallidos consecutivos. La interfaz ha sido bloqueada temporalmente por 15 minutos (Bloqueo ${registroActual.bloqueosConsecutivos} de 3 antes de bloqueo permanente de cuenta).`
        };
      }
    } else {
      const restantes = 3 - registroActual.intentosFallidos;

      resultado = {
        tipo: 'intento_fallido',
        bloqueado: false,
        intentosFallidos: registroActual.intentosFallidos,
        restantes: restantes,
        error: `Contraseña o credencial incorrecta. Te restan ${restantes} intento(s) antes del bloqueo temporal de 15 minutos.`
      };
    }

    for (const k of claves) {
      lockouts[k] = { ...registroActual };
    }

    this.guardarLockouts(lockouts);

    return resultado;
  }

  registrarExitoAutenticacion(idRaw) {
    const claves = this.obtenerClavesIdentificador(idRaw);
    const lockouts = this.obtenerLockouts();
    let modificado = false;

    for (const k of claves) {
      if (lockouts[k]) {
        delete lockouts[k];

        modificado = true;
      }
    }

    if (modificado) {
      this.guardarLockouts(lockouts);
    }
  }

  desbloquearUsuario(idRaw) {
    const claves = this.obtenerClavesIdentificador(idRaw);
    const lockouts = this.obtenerLockouts();

    for (const k of claves) {
      delete lockouts[k];
    }

    this.guardarLockouts(lockouts);

    for (const k of claves) {
      if (this.configuracion?.usuariosRegistrados?.[k]) {
        delete this.configuracion.usuariosRegistrados[k].cuentaBloqueada;
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));
    } catch {}

    this.guardarConfiguracionEnNube();

    return { ok: true, mensaje: 'Usuario desbloqueado con éxito.' };
  }

  estaUsuarioBloqueado(_idRaw) {
    return false;
  }

  cargarDesdeStorage() {
    try {
      // 1. Restaurar sesión administrativa permanente en caché local (si existe)

      const adminEnCache = localStorage.getItem(STORAGE_KEY_ADMIN_CACHED_USER);

      if (adminEnCache) {
        try {
          const parsedAdmin = JSON.parse(adminEnCache);

          if (this.esSesionValida(parsedAdmin) && this.esUsuarioAdministrativo(parsedAdmin)) {
            this.sesionActiva = parsedAdmin;
            this.colaboradorActivo = parsedAdmin;
          }
        } catch { }
      }

      // 2. Si no había administrador permanente, restaurar sesión estándar

      if (!this.sesionActiva) {
        const sesionGuardada = localStorage.getItem(STORAGE_KEY_AUTH_SESSION);

        if (sesionGuardada) {
          try {
            const parsed = JSON.parse(sesionGuardada);

            if (this.esSesionValida(parsed)) {
              this.sesionActiva = parsed;
              this.colaboradorActivo = this.sesionActiva;
            }
          } catch { }
        }
      }

      const recordado = localStorage.getItem(STORAGE_KEY_REMEMBERED_USER);

      if (recordado) {
        try {
          this.usuarioRecordado = JSON.parse(recordado);
        } catch { }
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

        if ((!Array.isArray(this.empleados) || this.empleados.length === 0) && this.configuracion.usuariosRegistrados) {
      this.empleados = Object.entries(this.configuracion.usuariosRegistrados)
        .filter(([, u]) => u && (u.nombre || u.email || u.identificacion))
        .map(([docKey, u]) => ({
          id: u.id || docKey,
          identificacion: u.identificacion || docKey,
          nombre: u.nombre || '',
          email: u.email || '',
          cargo: u.cargo || '',
          sede: u.sede || 'General',
          estado: u.estado || 'Activo',
          perfil: u.perfil || 'operativo'
        }));
    }

    this.sanitizarConfiguracionPerfiles();
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
      const [conf, aud, mae, hist, emp, sesionCache] = await Promise.all([
        cacheService.obtenerColeccion('configuracion'),
        cacheService.obtenerColeccion('auditoria'),
        cacheService.obtenerColeccion('maestras'),
        cacheService.obtenerColeccion('historico'),
        cacheService.obtenerColeccion('empleados'),
        cacheService.obtenerColeccion('sesion_activa')
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

        if ((!Array.isArray(this.empleados) || this.empleados.length === 0) && this.configuracion.usuariosRegistrados) {
      this.empleados = Object.entries(this.configuracion.usuariosRegistrados)
        .filter(([, u]) => u && (u.nombre || u.email || u.identificacion))
        .map(([docKey, u]) => ({
          id: u.id || docKey,
          identificacion: u.identificacion || docKey,
          nombre: u.nombre || '',
          email: u.email || '',
          cargo: u.cargo || '',
          sede: u.sede || 'General',
          estado: u.estado || 'Activo',
          perfil: u.perfil || 'operativo'
        }));
    }

    this.sanitizarConfiguracionPerfiles();
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

      if (!this.sesionActiva && sesionCache && this.esSesionValida(sesionCache)) {
        this.sesionActiva = sesionCache;
        this.colaboradorActivo = sesionCache;

        try {
          localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(sesionCache));
        } catch { }
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

  sanitizarEventoAuditoria(ev) {
    if (!ev || typeof ev !== 'object') return ev;

    // 1. Limpieza de código (eliminar sufijos :: y normalizar a mayúsculas)

    let codRaw = String(ev.documentoCodigo || ev.codigo || '').trim();

    if (codRaw.includes('::')) {
      codRaw = codRaw.split('::')[0].trim().toUpperCase();
      ev.documentoCodigo = codRaw;

      if (ev.codigo) ev.codigo = codRaw;
    } else {
      codRaw = codRaw.toUpperCase();
      ev.documentoCodigo = codRaw;

      if (ev.codigo) ev.codigo = codRaw;
    }

    // 2. Limpieza de detalle (eliminar cadenas ::)

    if (ev.detalle && typeof ev.detalle === 'string' && ev.detalle.includes('::')) {
      ev.detalle = ev.detalle.replace(/::[a-zA-Z0-9_\.]+/g, '');
    }

    // 3. Limpieza de títulos (eliminar extensiones .docx, .xlsx, .pdf, etc.)

    if (ev.documentoTitulo && typeof ev.documentoTitulo === 'string') {
      ev.documentoTitulo = ev.documentoTitulo.replace(/\.(docx|xlsx|pdf|doc|xls)$/i, '').trim();
    }

    if (ev.titulo && typeof ev.titulo === 'string') {
      ev.titulo = ev.titulo.replace(/\.(docx|xlsx|pdf|doc|xls)$/i, '').trim();
    }

    // 4. Verificación estricta de registros derivados vs documentos base:
    // Derivados tienen 4 segmentos: ej. FMT-GIC-015-8

    const mDeriv = codRaw.match(/^([A-Z]{2,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/);

    // Base tienen 3 segmentos: ej. INS-GTH-013, DA-GMD-017, FMT-GTH-045, FMT-GIC-015

    const mBase = codRaw.match(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}$/);

    if (mDeriv) {
      ev.esRegistro = true;
      ev.documentoPadreCodigo = mDeriv[1];

      return ev;
    }

    // Curación inteligente histórica para FMT-GIC-016

    const tit = (ev.documentoTitulo || ev.titulo || '').toLowerCase();
    const det = (ev.detalle || '').toLowerCase();

    if (codRaw === 'FMT-GIC-016' || det.includes('fmt-gic-016')) {
      if (tit.includes('2026-1') || det.includes('2026-1')) {
        ev.esRegistro = true;
        ev.documentoPadreCodigo = 'FMT-GIC-015';
        ev.documentoCodigo = 'FMT-GIC-015-1';

        return ev;
      } else if (tit.includes('2026-2') || det.includes('2026-2')) {
        ev.esRegistro = true;
        ev.documentoPadreCodigo = 'FMT-GIC-015';
        ev.documentoCodigo = 'FMT-GIC-015-2';

        return ev;
      } else if (tit.includes('asma') || det.includes('asma')) {
        ev.esRegistro = true;
        ev.documentoPadreCodigo = 'FMT-GIC-015';
        ev.documentoCodigo = 'FMT-GIC-015-3';

        return ev;
      } else if (tit.includes('anticoagula') || det.includes('anticoagula')) {
        ev.esRegistro = true;
        ev.documentoPadreCodigo = 'FMT-GIC-015';
        ev.documentoCodigo = 'FMT-GIC-015-4';

        return ev;
      }
    }

    if (mBase) {
      // Un documento base NUNCA es registro derivado ni tiene formato base

      ev.esRegistro = false;
      ev.documentoPadreCodigo = '';

      if (typeof ev.detalle === 'string' && ev.detalle.toLowerCase().includes('registro derivado')) {
        ev.detalle = ev.detalle.replace(/registro derivado/gi, 'documento');
      }
    } else {
      // Si no tiene código padre válido de al menos 3 partes, no es derivado

      const padre = String(ev.documentoPadreCodigo || '').trim();

      if (!padre || padre.split('-').length < 3) {
        ev.esRegistro = false;
        ev.documentoPadreCodigo = '';
      }
    }

    return ev;
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
      .map((ev) => this.sanitizarEventoAuditoria(ev))
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

   * Carga sincrónica de empleados, configuraciones y auditoría en tiempo real
   */

  async inicializar() {
    await Promise.allSettled([
      this.sincronizarConfiguracion(),
      this.sincronizarEmpleados()
    ]);

    // Si hay una sesión activa, verificar su validez de autenticación antes de refrescarla

    if (this.sesionActiva) {
      if (!this.esSesionValida(this.sesionActiva)) {
        this.cerrarSesion();
      } else {
        const docClean = this.limpiarNumeros(this.sesionActiva.identificacion);
        const match = this.empleados.find(
          (e) => this.limpiarNumeros(e.identificacion) === docClean
        );

        if (match) {
          const perfil = this.determinarPerfil(match.cargo, match.identificacion);

          this.sesionActiva = {
            ...match,
            perfil: perfil,
            ultimoIngreso: this.sesionActiva.ultimoIngreso || new Date().toISOString(),
            timestampInicio: this.sesionActiva.timestampInicio || Date.now(),
            fechaSesion: this.sesionActiva.fechaSesion || new Date().toISOString().split('T')[0],
            ultimoAcceso: Date.now()
          };

          this.colaboradorActivo = this.sesionActiva;

          try {
            localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
          } catch { }

          if (cacheService && cacheService.guardarColeccion) {
            cacheService.guardarColeccion('sesion_activa', this.sesionActiva).catch(() => {});
          }
        }
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
    const esLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // 1. Sincronizar usuarios.conf vía /api/configuracion (solo en local) o directamente Google Drive Cloud

    const pConfig = (async () => {
      if (esLocal) {
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
      }

      // Conexión Cloud a Google Script (Omitida en Modo Local)

      if (true) {
        try {
          const resG = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
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
      }

    })();

    // 2. Módulo de Auditoría Institucional retirado (no se requiere sincronizar auditoría (retirado))

    const pAudit = Promise.resolve();

    // 3. Sincronizar maestro.dat vía /api/maestras (solo en local) o directamente Google Drive Cloud

    const pMaestras = (async () => {
      if (esLocal) {
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
      }

      // Conexión Cloud a Google Script (?action=maestras) (Omitida en Modo Local)

      if (true) {
        try {
          const resG = await fetch(`${GOOGLE_SCRIPT_URL}?action=maestras&_t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined
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
      }

    })();

    // 4. Sincronizar Historico_Documentos (Google Sheets) vía /api/historico (solo en local) o Google Drive Cloud

    const pHistorico = (async () => {
      if (esLocal) {
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
      }

      // Conexión Cloud a Google Script (?action=historico) (Omitida en Modo Local)

      if (true) {
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
      }

      // Fallback a Google Sheets Historico_Documentos CSV oficial
      try {
        const GOOGLE_SHEETS_HISTORICO_CSV = 'https://docs.google.com/spreadsheets/d/1kJjohcWIVYrAhIMrZwWfzex5zQXT769ZmAEmDlAUykk/export?format=csv';
        const resSheet = await fetch(GOOGLE_SHEETS_HISTORICO_CSV, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
        });
        if (resSheet.ok) {
          const csvText = await resSheet.text();
          if (csvText && (csvText.includes(',') || csvText.includes(';')) && !csvText.includes('<!DOCTYPE html')) {
            const listaHist = this.parsearCsvHistorico(csvText);
            if (listaHist.length > 0) {
              this.aplicarHistorico(listaHist);
              console.log(`[StaffService] ✅ Control de cambios sincronizado desde Google Sheets Historico_Documentos (${listaHist.length} registros).`);
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
      mapeoPerfilesPersonalizados: json.mapeoPerfilesPersonalizados !== undefined
        ? json.mapeoPerfilesPersonalizados
        : (this.configuracion.mapeoPerfilesPersonalizados || {}),
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

    if ((!Array.isArray(this.empleados) || this.empleados.length === 0) && this.configuracion.usuariosRegistrados) {
      this.empleados = Object.entries(this.configuracion.usuariosRegistrados)
        .filter(([, u]) => u && (u.nombre || u.email || u.identificacion))
        .map(([docKey, u]) => ({
          id: u.id || docKey,
          identificacion: u.identificacion || docKey,
          nombre: u.nombre || '',
          email: u.email || '',
          cargo: u.cargo || '',
          sede: u.sede || 'General',
          estado: u.estado || 'Activo',
          perfil: u.perfil || 'operativo'
        }));
    }

    this.sanitizarConfiguracionPerfiles();

    try {
      localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));

      cacheService.guardarColeccion('configuracion', this.configuracion);
    } catch { }
  }

  sanitizarEventoHistorico(h) {
    if (!h || typeof h !== 'object') return null;

    let cod = (h.codigo || '').trim().toUpperCase();
    let evt = (h.tipoEvento || '').trim().toUpperCase();
    const eventosConocidos = new Set([
      'CREACION', 'ELIMINACION', 'CAMBIO_VERSION', 'CAMBIO_METADATOS', 'METADATOS',
      'CAMBIO_RUTA', 'CAMBIO_TIPO', 'EDICION_SHAREPOINT', 'EDICION'
    ]);

    // Descartar registros corruptos o pseudocódigos con hist_

    if (cod.includes('HIST_') || eventosConocidos.has(cod) || cod.endsWith('ION_SHAREPOINT')) {
      return null;
    }

    // Auto-corrección si tipoEvento y codigo quedaron invertidos/desplazados

    const prefijosDoc = ['FMT-', 'INS-', 'PR-', 'PT-', 'DA-', 'MN-', 'PVE-'];

    if (!eventosConocidos.has(evt) && prefijosDoc.some((p) => evt.startsWith(p))) {
      h.codigo = evt;
      h.tipoEvento = 'EDICION_SHAREPOINT';

      if (h.titulo === 'v01' || !h.titulo) {
        h.titulo = (cod && !eventosConocidos.has(cod)) ? cod : 'Documento institucional';
      }

      cod = h.codigo;
      evt = h.tipoEvento;
    }

    // Limpieza de claves compuestas con ::
    if (h.codigo && h.codigo.includes('::')) {
      h.codigo = h.codigo.split('::')[0].trim().toUpperCase();
    }

    // Limpiar ID si tiene duplicaciones

    if (h.id) {
      const m = String(h.id).match(/(hist_\d+_[a-z0-9]+)$/i);

      if (m) {
        h.id = m[1];
      }
    }

    // Limpiar restos de hist_ en timestamp o fechaHora

    if (h.timestamp && /hist_/i.test(h.timestamp)) {
      h.timestamp = h.timestamp.replace(/h?i?s?t?_?\d*.*$/i, '').replace(/[;:]+$/, '');
    }

    if (h.fechaHora && /hist_/i.test(h.fechaHora)) {
      h.fechaHora = h.fechaHora.replace(/h?i?s?t?_?\d*.*$/i, '').replace(/[;:]+$/, '');
    }

    if (!h.codigo) return null;

    return h;
  }

  aplicarHistorico(lista) {
    if (!Array.isArray(lista)) return;

    const listaExistente = Array.isArray(this.historicoData) ? this.historicoData : [];
    const mapaHist = new Map();

    [...lista, ...listaExistente].forEach((h) => {
      const sani = this.sanitizarEventoHistorico(h);

      if (sani && (sani.id || sani.timestamp || sani.codigo)) {
        const k = sani.id || `${(sani.codigo || '').toUpperCase()}_${sani.tipoEvento || ''}_${sani.fechaHora || sani.timestamp}`;

        if (!mapaHist.has(k)) {
          mapaHist.set(k, sani);
        }
      }
    });

    this.historicoData = Array.from(mapaHist.values())
      .sort((a, b) => {
        const tA = this.parsearFechaMilisegundos(a.fechaHora || a.fechaModificacionActual || a.timestamp);
        const tB = this.parsearFechaMilisegundos(b.fechaHora || b.fechaModificacionActual || b.timestamp);

        return tB - tA;
      })
      .slice(0, 2500);

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

   * Módulo de Auditoría Institucional retirado: no realiza peticiones de red ni seguimiento de accesos.
   */

  async sincronizarAuditoria(_forzar = false) {
    return { ok: true, huboCambios: false, total: 0 };
  }

  iniciarSincronizacionPeriodicaAuditoria(_intervaloMs = 60000) {
    return;
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

   * Sincroniza en vivo la matriz de colaboradores activos desde la nube (OneDrive / Web)
   * y la persiste estructuradamente en IndexedDB para acceso instantáneo a 0 ms.
   * Si no hay conexión, opera estrictamente con la última copia almacenada en la caché local.
   */

  async sincronizarEmpleados(forzar = false) {
    const timestamp = Date.now();
    const query = forzar ? `?_t=${timestamp}&forzar=true` : '';
    const rutas = this.obtenerRutasConfiguradas();
    const esLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    let textoCsv = null;

    // 0. Política de Caché No Volátil (IndexedDB): Carga instantánea a 0 ms

    // Permanece hasta que el usuario borre los datos del navegador y se revalida diariamente (24h TTL)

    if (!forzar) {
      try {
        const cachedMeta = await cacheService.obtenerColeccionConMeta('empleados');

        if (cachedMeta && Array.isArray(cachedMeta.datos) && cachedMeta.datos.length > 0) {
          this.empleados = cachedMeta.datos;
          const ahora = Date.now();
          const edadMs = ahora - (cachedMeta.timestamp || 0);
          const TTL_DIARIO_MS = 24 * 60 * 60 * 1000; // 24 horas

          // Si la caché tiene menos de 24 horas, retornar inmediatamente sin petición de red

          if (edadMs < TTL_DIARIO_MS) {
            console.log(`[StaffService] ⚡ Colaboradores activos cargados desde caché persistente (${this.empleados.length} colaboradores, edad: ${Math.round(edadMs / 60000)} min).`);

            return this.empleados;
          }

          // Si tiene más de 24 horas, usar la copia existente de inmediato y refrescar en segundo plano

          console.log(`[StaffService] 🔄 Caché diaria vencida (>24h). Revalidando colaboradores en segundo plano...`);

          setTimeout(() => this.sincronizarEmpleados(true).catch(() => {}), 100);

          return this.empleados;
        }
      } catch (eMeta) {
        console.warn('[StaffService] Error leyendo caché IndexedDB:', eMeta);
      }
    }

    // 1. Probar ruta oficial de OneDrive / Cloud si está configurada (Omitida en Modo Local)

    if (rutas?.empleadosCsv && rutas.empleadosCsv.startsWith('http')) {
      try {
        const resCloud = await fetch(`${rutas.empleadosCsv}${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
        });

        if (resCloud.ok) {
          const txt = await resCloud.text();

          if (txt && (txt.includes(',') || txt.includes(';')) && !txt.includes('<!DOCTYPE html')) {
            textoCsv = txt;
          }
        }
      } catch (eCloud) {
        // Red corporativa o sesión requerida
      }
    }

    // 2. Si estamos en local, probar endpoint proxy local /api/empleados

    if (!textoCsv && esLocal) {
      try {
        const res = await fetch(`/api/empleados${query}`, {
          cache: forzar ? 'no-store' : 'default',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });

        if (res.ok) {
          const txt = await res.text();

          if (txt && (txt.includes(',') || txt.includes(';')) && !txt.includes('<!DOCTYPE html')) {
            textoCsv = txt;
          }
        }
      } catch (e) { }
    }

    // 4. Si se obtuvo el texto fresco desde la nube o archivo, parsear y persistir en IndexedDB

    if (textoCsv) {
      const lista = this.parsearCsvEmpleados(textoCsv);

      if (Array.isArray(lista) && lista.length > 0) {
        this.empleados = lista;

        try {
          localStorage.setItem(STORAGE_KEY_STAFF_CACHE, JSON.stringify(lista));

          localStorage.setItem('agy_last_staff_sync', Date.now().toString());

          await cacheService.guardarColeccion('empleados', lista);

          if (cacheService.guardarEmpleados) {
            await cacheService.guardarEmpleados(lista);
          }
        } catch { }

        console.log(`[StaffService] ⚡ ${lista.length} colaboradores activos sincronizados y cacheados en IndexedDB.`);

        return lista;
      }
    }

    // 5. Contingencia Offline: Si no hubo conexión o falló la descarga web, recurrir a la copia en IndexedDB

    try {
      const cachedEmp = await cacheService.obtenerColeccion('empleados');

      if (Array.isArray(cachedEmp) && cachedEmp.length > 0) {
        this.empleados = cachedEmp;

        console.log(`[StaffService] 📂 Operando con caché local IndexedDB (${cachedEmp.length} colaboradores vigentes).`);

        return cachedEmp;
      }
    } catch (eCache) { }

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
    const eventosConocidos = new Set([
      'CREACION', 'ELIMINACION', 'CAMBIO_VERSION', 'CAMBIO_METADATOS', 'METADATOS',
      'CAMBIO_RUTA', 'CAMBIO_TIPO', 'EDICION_SHAREPOINT', 'EDICION'
    ]);

    for (let i = 1; i < lines.length; i++) {
      let cols = this.dividirLineaCsv(lines[i], delimitador);

      if (!cols || cols.length === 0) continue;

      // Autocorrección de filas donde se omitió la columna 'id' desplazando las demás

      const primerValor = (cols[0] || '').trim().toUpperCase();

      if (eventosConocidos.has(primerValor) || primerValor.endsWith('ION_SHAREPOINT')) {
        const evtCorregido = primerValor.endsWith('ION_SHAREPOINT') ? 'EDICION_SHAREPOINT' : primerValor;
        cols[0] = evtCorregido;

        cols.unshift(`hist_auto_${i}_${Date.now()}`);
      }

      if (cols.length < 3 || !cols[2]) continue;

      const obj = {};

      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = cols[c] !== undefined ? cols[c] : '';
      }

      // Limpieza de claves compuestas con ::
      if (obj.codigo && obj.codigo.includes('::')) {
        obj.codigo = obj.codigo.split('::')[0].trim().toUpperCase();
      }

      const sani = this.sanitizarEventoHistorico(obj);

      if (sani) {
        lista.push(sani);
      }
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

   * Sanea configuraciones persistidas para asegurar que ningún líder ni personal administrativo
   * figure erróneamente con perfil directivo. Los directivos corresponden únicamente a directores y gerentes.
   */

  sanitizarConfiguracionPerfiles() {
    if (!this.configuracion) return;

    let huboCambios = false;

    // Regla Institucional: Ya no existen usuarios específicos de tipo operativo.

    // Solo permanecen asignaciones de rol 'administrativo'. Cualquier usuario con rol 'operativo' u otro se elimina.

    if (this.configuracion.mapeoPerfilesPersonalizados) {
      for (const [doc, perf] of Object.entries(this.configuracion.mapeoPerfilesPersonalizados)) {
        if (perf === 'total' || perf === 'administrador' || perf === 'administrativo') {
          this.configuracion.mapeoPerfilesPersonalizados[doc] = 'administrativo';
        } else {
          delete this.configuracion.mapeoPerfilesPersonalizados[doc];

          huboCambios = true;
        }
      }
    }

    if (this.configuracion.usuariosRegistrados) {
      for (const [doc, u] of Object.entries(this.configuracion.usuariosRegistrados)) {
        if (u) {
          if (u.perfil === 'total' || u.perfil === 'administrador' || u.perfil === 'administrativo') {
            u.perfil = 'administrativo';
          } else {
            delete this.configuracion.usuariosRegistrados[doc];

            huboCambios = true;
          }
        }
      }
    }

    // Purgar favoritosPorUsuario (los favoritos operan exclusivamente en la caché local del navegador)

    if (this.configuracion.favoritosPorUsuario) {
      huboCambios = true;
    }

    // Purgar configuraciones de filtros por defecto (ya no se utilizan)

    if (this.configuracion.filtrosPorDefectoGlobal) {
      delete this.configuracion.filtrosPorDefectoGlobal;

      huboCambios = true;
    }

    if (this.configuracion.preferenciasPorUsuario) {
      for (const [doc, pref] of Object.entries(this.configuracion.preferenciasPorUsuario)) {
        if (pref && (pref.filtrosPorDefecto || pref.filtrosPorDefectoGlobal)) {
          delete pref.filtrosPorDefecto;

          delete pref.filtrosPorDefectoGlobal;

          huboCambios = true;
        }
      }
    }

    if (huboCambios) {
      try {
        localStorage.setItem(STORAGE_KEY_CONF_CACHE, JSON.stringify(this.configuracion));

        cacheService.guardarColeccion('configuracion', this.configuracion);
      } catch { }
    }
  }

  /**

   * Determina el perfil (únicamente 'operativo' o 'administrativo')
   * - 'administrativo': Anterior Acceso Total (cédula maestra 8160602 o asignados explícitamente)
   * - 'operativo': Por defecto para TODOS los demás colaboradores
   */

  determinarPerfil(cargo, identificacion) {
    const docClean = this.limpiarNumeros(identificacion);

    if (docClean) {
      // 1. Cédula 8160602 es el Administrador de Acceso Total

      if (docClean === '8160602') {
        return 'administrativo';
      }

      // 2. Asignación manual explícita

      const perfPers = this.configuracion?.mapeoPerfilesPersonalizados?.[docClean];

      if (perfPers) {
        if (perfPers === 'administrativo' || perfPers === 'total' || perfPers === 'administrador') {
          return 'administrativo';
        }

        return 'operativo';
      }

      const perfReg = this.configuracion?.usuariosRegistrados?.[docClean]?.perfil;

      if (perfReg) {
        if (perfReg === 'administrativo' || perfReg === 'total' || perfReg === 'administrador') {
          return 'administrativo';
        }

        return 'operativo';
      }
    }

    // Regla Institucional: TODOS los demás usuarios (incluyendo administrativos previos y directivos) quedan por defecto como 'operativo'

    return 'operativo';
  }

  /**

   * Genera el objeto de usuario genérico operativo predeterminado.
   * No solicita credenciales, permite navegar y descargar documentos sin acceso a configuración.
   */

  obtenerUsuarioGenericoOperativo() {
    return {
      id: 'emp-generico',
      identificacion: 'OPERATIVO',
      nombre: 'Usuario Operativo',
      cargo: 'Personal Operativo',
      sede: 'Sede Principal',
      perfil: 'operativo',
      esGenerico: true
    };
  }

  /**

   * Comprueba de forma estricta si un colaborador cuenta con perfil Administrativo autorizado.
   * (Cédula 8160602, asignación explícita en mapeoPerfilesPersonalizados o usuariosRegistrados).
   */

  esUsuarioAdministrativo(docOrUser) {
    if (!docOrUser) return false;

    const docClean = typeof docOrUser === 'object'
      ? this.limpiarNumeros(docOrUser.identificacion)
      : this.limpiarNumeros(docOrUser);

    if (!docClean || docClean === 'OPERATIVO') return false;

    // 1. Cédula 8160602 siempre es administrativa (Administrador SGC)

    if (docClean === '8160602') return true;

    // 2. Revisar perfil explícito en mapeoPerfilesPersonalizados

    const perfPers = this.configuracion?.mapeoPerfilesPersonalizados?.[docClean];

    if (perfPers === 'administrativo' || perfPers === 'total' || perfPers === 'administrador') {
      return true;
    }

    // 3. Revisar perfil en usuariosRegistrados

    const perfReg = this.configuracion?.usuariosRegistrados?.[docClean]?.perfil;

    if (perfReg === 'administrativo' || perfReg === 'total' || perfReg === 'administrador') {
      return true;
    }

    // 4. Revisar lista de colaboradores cargados en memoria

    const emp = this.buscarPorDocumento(docClean);

    if (emp) {
      const p = this.determinarPerfil(emp.cargo, docClean);

      if (p === 'administrativo' || p === 'total' || p === 'administrador') {
        return true;
      }
    }

    return false;
  }

  /**

   * Retorna el listado de colaboradores que cuentan con perfil Administrativo activo
   */

  obtenerUsuariosAdministrativos() {
    const list = [];
    const docsVistos = new Set();

    // 1. Cédula maestra 8160602

    const u8160602 = this.configuracion?.usuariosRegistrados?.['8160602'] || this.buscarPorDocumento('8160602') || {
      identificacion: '8160602',
      nombre: 'John Fredy Ramirez Rios',
      cargo: 'Medico General',
      perfil: 'administrativo'
    };

    list.push(u8160602);

    docsVistos.add('8160602');

    // 2. Usuarios registrados

    if (this.configuracion?.usuariosRegistrados) {
      for (const [doc, u] of Object.entries(this.configuracion.usuariosRegistrados)) {
        if (!docsVistos.has(doc) && this.esUsuarioAdministrativo(doc)) {
          list.push(u);

          docsVistos.add(doc);
        }
      }
    }

    // 3. Mapeo de perfiles personalizados

    if (this.configuracion?.mapeoPerfilesPersonalizados) {
      for (const [doc, p] of Object.entries(this.configuracion.mapeoPerfilesPersonalizados)) {
        if (!docsVistos.has(doc) && (p === 'administrativo' || p === 'total' || p === 'administrador')) {
          const u = this.buscarPorDocumento(doc) || { identificacion: doc, nombre: `Administrativo ${doc}`, cargo: 'Personal Administrativo', perfil: 'administrativo' };

          list.push(u);

          docsVistos.add(doc);
        }
      }
    }

    return list;
  }

  /**

   * Asigna y almacena permanentemente un perfil personalizado en la nube (Google Drive) para un usuario
   */

  async asignarPerfilPersonalizado(doc, nuevoPerfil = 'administrativo') {
    const docClean = this.limpiarNumeros(doc);

    if (!docClean) return;

    // Solo se permite asignar rol 'administrativo' (acceso administrativo / edición)

    const perfilFijo = 'administrativo';
    this.configuracion.mapeoPerfilesPersonalizados = this.configuracion.mapeoPerfilesPersonalizados || {};
    this.configuracion.mapeoPerfilesPersonalizados[docClean] = perfilFijo;
    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};

    if (this.configuracion.usuariosRegistrados[docClean]) {
      this.configuracion.usuariosRegistrados[docClean].perfil = perfilFijo;
    } else {
      const emp = this.buscarPorDocumento(docClean);

      this.configuracion.usuariosRegistrados[docClean] = {
        identificacion: emp?.identificacion || docClean,
        nombre: emp?.nombre || `Administrativo ${docClean}`,
        email: emp?.email || '',
        cargo: emp?.cargo || 'Personal Administrativo',
        sede: emp?.sede || 'Principal',
        perfil: perfilFijo,
        passwordHash: ''
      };
    }

    if (this.sesionActiva && this.limpiarNumeros(this.sesionActiva.identificacion) === docClean) {
      this.sesionActiva.perfil = perfilFijo;

      try {
        localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
      } catch { }

      if (cacheService && cacheService.guardarColeccion) {
        cacheService.guardarColeccion('sesion_activa', this.sesionActiva).catch(() => {});
      }
    }

    if (this.usuarioRecordado && this.limpiarNumeros(this.usuarioRecordado.identificacion) === docClean) {
      this.usuarioRecordado.perfil = perfilFijo;

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

   * Los favoritos funcionan exclusivamente en la caché temporal del navegador del usuario
   * y no se almacenan en usuarios.conf ni en ningún archivo web.
   */

  async guardarFavoritosUsuario(identificacion, listaFavoritos) {
    if (!identificacion) return;
    const docClean = this.limpiarNumeros(identificacion);
    // Favoritos se guardan en usuarios.conf exclusivamente para usuarios administrativos
    if (this.esUsuarioAdministrativo(docClean) || this.esAdministrador()) {
      if (!this.configuracion.favoritosAdmin) {
        this.configuracion.favoritosAdmin = {};
      }
      this.configuracion.favoritosAdmin[docClean] = Array.isArray(listaFavoritos) ? listaFavoritos : [];
      await this.guardarConfiguracionEnNube();
    }
  }

  obtenerFavoritosUsuario(identificacion) {
    if (!identificacion) return null;
    const docClean = this.limpiarNumeros(identificacion);
    if (this.esUsuarioAdministrativo(docClean) || this.esAdministrador()) {
      return (this.configuracion && this.configuracion.favoritosAdmin && this.configuracion.favoritosAdmin[docClean]) || null;
    }
    return null;
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

   * Normaliza un correo o usuario institucional garantizando el dominio @unionsaludvida.com
   */

  normalizarCorreoInstitucional(emailInput) {
    const raw = (emailInput || '').toString().trim().toLowerCase();

    if (!raw) return '';

    const usuario = raw.split('@')[0].trim();

    if (!usuario) return '';

    return `${usuario}@unionsaludvida.com`;
  }

  /**

   * Busca un colaborador por su correo institucional en la matriz de empleados o usuarios registrados
   */

  buscarPorCorreo(emailInput) {
    const emailNorm = this.normalizarCorreoInstitucional(emailInput);

    if (!emailNorm) return null;

    const lista = Array.isArray(this.empleados) ? this.empleados : [];

    let emp = lista.find((e) => this.normalizarCorreoInstitucional(e.email) === emailNorm) || null;


    let regMatch = null;

    if (this.configuracion?.usuariosRegistrados) {
      for (const [docKey, u] of Object.entries(this.configuracion.usuariosRegistrados)) {
        if (u && this.normalizarCorreoInstitucional(u.email) === emailNorm) {
          regMatch = { ...u, identificacion: u.identificacion || docKey };

          break;
        }
      }
    }

    if (emp && regMatch) {
      return { ...emp, ...regMatch };
    }

    if (emp) {
      const docClean = this.limpiarNumeros(emp.identificacion);
      const regByDoc = docClean ? this.configuracion?.usuariosRegistrados?.[docClean] : null;

      return regByDoc ? { ...emp, ...regByDoc } : emp;
    }

    return regMatch;
  }

  /**

   * Valida la contraseña para habilitar el Modo Administrativo (mediante Correo Institucional + Contraseña).
   */

  async validarClaveEdicion(password, emailOrIdentificacion = null) {
    const pwd = (password || '').trim();

    if (!pwd) {
      return { ok: false, error: 'Por favor ingresa tu contraseña de acceso.' };
    }

    const rawId = (emailOrIdentificacion || '').toString().trim();
    const soloNumeros = this.limpiarNumeros(rawId);
    const esDocumentoNumerico = Boolean(rawId && soloNumeros === rawId && soloNumeros.length >= 5);
    let docTarget = null;
    let emailTarget = '';
    let usuarioEncontrado = null;

    if (esDocumentoNumerico) {
      docTarget = soloNumeros;
      usuarioEncontrado = this.buscarPorDocumento(docTarget) || this.configuracion?.usuariosRegistrados?.[docTarget] || null;
      emailTarget = usuarioEncontrado?.email ? this.normalizarCorreoInstitucional(usuarioEncontrado.email) : '';
    } else if (rawId) {
      emailTarget = this.normalizarCorreoInstitucional(rawId);
      usuarioEncontrado = this.buscarPorCorreo(emailTarget);

      if (usuarioEncontrado && usuarioEncontrado.identificacion) {
        docTarget = this.limpiarNumeros(usuarioEncontrado.identificacion);
      }
    }

    // 1. Validar contra la contraseña institucional maestra (Superadministrador SGC)

    if (this.validarClaveInstitucional(pwd)) {
      let usuarioResult = usuarioEncontrado;

      if (!usuarioResult && docTarget) {
        usuarioResult = this.buscarPorDocumento(docTarget) || this.configuracion?.usuariosRegistrados?.[docTarget];
      }

      if (usuarioResult) {
        usuarioResult = { ...usuarioResult, perfil: 'administrativo' };
      } else {
        usuarioResult = {
          id: 'admin-sgc-maestro',
          identificacion: docTarget || '8160602',
          email: emailTarget || 'john.ramirez@unionsaludvida.com',
          nombre: 'Administrador SGC',
          cargo: 'Administrador del Sistema',
          sede: 'Oficina Central',
          perfil: 'administrativo'
        };
      }

      return { ok: true, usuario: usuarioResult };
    }

    // 2. Si no es la clave maestra, se requiere correo institucional válido

    if (!rawId) {
      return {
        ok: false,
        error: 'Por favor ingresa tu correo institucional para validar tus permisos administrativos.'
      };
    }

    if (!esDocumentoNumerico && !docTarget) {
      return {
        ok: false,
        error: `No se encontró ningún colaborador registrado con el correo ${emailTarget}.`
      };
    }

    // 3. REGLA ESTRICTA: SOLO USUARIOS AGREGADOS CON PERFIL ADMINISTRATIVO

    if (!this.esUsuarioAdministrativo(docTarget)) {
      return {
        ok: false,
        error: `Acceso denegado: El usuario (${emailTarget || docTarget}) no cuenta con perfil Administrativo asignado. Solo colaboradores con perfil Administrativo pueden activar este modo.`
      };
    }

    // 4. Validar contraseña personal del usuario administrativo

    const reg = this.configuracion?.usuariosRegistrados?.[docTarget];

    if (!reg || !reg.passwordHash) {
      return {
        ok: false,
        error: `El usuario administrativo (${emailTarget || docTarget}) aún no tiene una contraseña registrada. Haz clic en "¿Primer ingreso? Registrarse".`,
        necesitaRegistro: true
      };
    }

    const hashIngresado = await this.calcularHash(pwd);

    if (hashIngresado === reg.passwordHash) {
      const empData = this.buscarPorDocumento(docTarget) || {};
      const usuarioCompleto = {
        ...empData,
        ...reg,
        identificacion: docTarget,
        email: emailTarget || reg.email || empData.email || '',
        perfil: 'administrativo'
      };

      return { ok: true, usuario: usuarioCompleto };
    }

    return {
      ok: false,
      error: 'Contraseña incorrecta. Intenta nuevamente o usa "¿Olvidaste tu contraseña?".'
    };
  }

  /**

   * Registra la contraseña de un usuario administrativo previa verificación de perfil
   * REGLA ESTRICTA: SOLO USUARIOS AGREGADOS CON PERFIL ADMINISTRATIVO pueden registrar contraseña.
   */

  async registrarPasswordAdmin(identificacion, password, email = '') {
    const docClean = this.limpiarNumeros(identificacion);

    if (!docClean) {
      return { ok: false, error: 'Por favor ingresa un documento de identidad válido.' };
    }

    const emailClean = this.normalizarCorreoInstitucional(email);

    if (!emailClean) {
      return { ok: false, error: 'Por favor ingresa tu correo institucional.' };
    }

    // 1. REGLA ESTRICTA: SOLO USUARIOS CON PERFIL ADMINISTRATIVO

    if (!this.esUsuarioAdministrativo(docClean)) {
      return {
        ok: false,
        error: `Registro no autorizado: El documento ${docClean} no cuenta con perfil Administrativo asignado en el sistema. Solo usuarios autorizados como Administrativos pueden registrar contraseñas.`
      };
    }

    // 2. REGLA ESTRICTA: PREVENIR RE-REGISTRO SI YA TIENE CONTRASEÑA ASIGNADA

    const regExistente = this.configuracion?.usuariosRegistrados?.[docClean];

    if (regExistente && regExistente.passwordHash) {
      return {
        ok: false,
        error: `El usuario administrativo asociado al documento ${docClean} ya tiene una contraseña registrada. Si no recuerdas tu clave, utiliza la opción "¿Olvidaste tu contraseña?" para restablecerla.`
      };
    }

    // 3. REGLA ESTRICTA: EL CORREO INSTITUCIONAL DEBE COINCIDIR EXACTAMENTE CON EL DOCUMENTO

    const emp = this.buscarPorDocumento(docClean) || {};
    const emailRegistrado = this.normalizarCorreoInstitucional(
      emp.email || regExistente?.email || (docClean === '8160602' ? 'john.ramirez@unionsaludvida.com' : '')
    );

    if (emailRegistrado && emailRegistrado !== emailClean) {
      return {
        ok: false,
        error: `Los datos no coinciden: El correo institucional ingresado (${emailClean}) no corresponde a la cédula ${docClean} en los registros institucionales.`
      };
    }

    const pwd = (password || '').trim();

    if (!pwd || pwd.length < 6) {
      return { ok: false, error: 'La contraseña debe tener como mínimo 6 caracteres.' };
    }

    const hash = await this.calcularHash(pwd);
    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};

    const usuarioActualizado = {
      ...(regExistente || {}),
      ...emp,
      id: emp.id || regExistente?.id || `emp-${docClean}`,
      identificacion: docClean,
      email: emailRegistrado || emailClean,
      nombre: emp.nombre || regExistente?.nombre || (docClean === '8160602' ? 'John Fredy Ramirez Rios' : 'Colaborador Administrativo'),
      cargo: emp.cargo || regExistente?.cargo || (docClean === '8160602' ? 'Medico General' : 'Personal Administrativo'),
      sede: emp.sede || regExistente?.sede || 'Principal',
      perfil: 'administrativo',
      passwordHash: hash,
      fechaModificacionClave: new Date().toISOString(),
      ultimoIngreso: new Date().toISOString()
    };

    this.configuracion.usuariosRegistrados[docClean] = usuarioActualizado;
    this.configuracion.mapeoPerfilesPersonalizados = this.configuracion.mapeoPerfilesPersonalizados || {};
    this.configuracion.mapeoPerfilesPersonalizados[docClean] = 'administrativo';

    await this.guardarConfiguracionEnNube();

    return {
      ok: true,
      mensaje: 'Contraseña administrativa registrada exitosamente.',
      usuario: usuarioActualizado
    };
  }

  /**

   * Cambia la contraseña de un usuario administrativo validando su contraseña actual o clave maestra
   */

  async cambiarPasswordAdmin(identificacion, passwordActual, passwordNueva) {
    const docClean = this.limpiarNumeros(identificacion);

    if (!docClean) {
      return { ok: false, error: 'Por favor ingresa un número de documento válido.' };
    }

    if (!this.esUsuarioAdministrativo(docClean)) {
      return {
        ok: false,
        error: `Operación denegada: El documento ${docClean} no cuenta con perfil Administrativo autorizado.`
      };
    }

    const pwdNueva = (passwordNueva || '').trim();

    if (!pwdNueva || pwdNueva.length < 6) {
      return { ok: false, error: 'La nueva contraseña debe tener como mínimo 6 caracteres.' };
    }

    // Verificar si el usuario ya tiene contraseña registrada

    const reg = this.configuracion?.usuariosRegistrados?.[docClean];

    if (reg && reg.passwordHash) {
      const resVal = await this.validarClaveEdicion(passwordActual, docClean);

      if (!resVal.ok) {
        return { ok: false, error: 'La contraseña actual ingresada es incorrecta.' };
      }
    } else {
      const esMaestra = this.validarClaveInstitucional(passwordActual);

      if (passwordActual && !esMaestra) {
        return { ok: false, error: 'Clave de verificación incorrecta. Si es tu primer cambio usa la clave maestra institucional.' };
      }
    }

    return await this.registrarPasswordAdmin(docClean, pwdNueva, reg?.email || '');
  }

  /**

   * Restablece la contraseña de un usuario administrativo validando su Correo Institucional + Cédula
   * (sin solicitar clave institucional maestra).
   * REGLA ESTRICTA: SOLO USUARIOS AGREGADOS CON PERFIL ADMINISTRATIVO pueden restablecer su contraseña.
   */

  async recuperarPasswordAdmin(identificacion, emailInput, nuevaPassword) {
    const emailClean = this.normalizarCorreoInstitucional(emailInput);

    if (!emailClean) {
      return { ok: false, error: 'Por favor ingresa tu correo institucional.' };
    }

    const docClean = this.limpiarNumeros(identificacion);

    if (!docClean) {
      return { ok: false, error: 'Por favor ingresa un documento de identidad (cédula) válido.' };
    }

    if (!this.esUsuarioAdministrativo(docClean)) {
      return {
        ok: false,
        error: `Operación denegada: El documento ${docClean} no cuenta con perfil Administrativo asignado.`
      };
    }

    const emp = this.buscarPorDocumento(docClean) || {};
    const reg = this.configuracion?.usuariosRegistrados?.[docClean] || {};
    const emailRegistrado = this.normalizarCorreoInstitucional(
      emp.email || reg.email || (docClean === '8160602' ? 'john.ramirez@unionsaludvida.com' : '')
    );

    if (!emailRegistrado || emailRegistrado !== emailClean) {
      return {
        ok: false,
        error: `El correo electrónico (${emailClean}) no coincide con el registrado para la cédula administrativa ${docClean}.`
      };
    }

    const pwd = (nuevaPassword || '').trim();

    if (!pwd || pwd.length < 6) {
      return { ok: false, error: 'La nueva contraseña debe tener como mínimo 6 caracteres.' };
    }

    const hash = await this.calcularHash(pwd);
    this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};

    const usuarioActualizado = {
      ...reg,
      ...emp,
      id: emp.id || reg.id || `emp-${docClean}`,
      identificacion: docClean,
      email: emailClean,
      perfil: 'administrativo',
      passwordHash: hash,
      fechaModificacionClave: new Date().toISOString(),
      ultimoIngreso: new Date().toISOString()
    };

    this.configuracion.usuariosRegistrados[docClean] = usuarioActualizado;

    await this.guardarConfiguracionEnNube();

    return {
      ok: true,
      mensaje: 'Contraseña restablecida exitosamente.',
      usuario: usuarioActualizado
    };
  }

  /**

   * Gestión de contraseñas deshabilitada: la autenticación está delegada a SharePoint Online.
   */

  async cambiarPasswordPersonal(_claveActual, _claveNueva, _usuarioDoc = null) {
    return {
      exito: true,
      mensaje: 'Autenticación federada activa. Las contraseñas son administradas directamente por Microsoft 365 / SharePoint.'
    };
  }

  /**

   * Cambia la contraseña institucional tras validar la actual y registra en auditoría
   */

  cambiarClaveInstitucional(claveActual, claveNueva, sesion = null) {
    const usuarioId = sesion?.identificacion || 'admin_institucional';
    const lockCheck = this.obtenerEstadoBloqueo(usuarioId);

    if (lockCheck.bloqueado) {
      return { exito: false, error: lockCheck.error, bloqueado: true, tipoBloqueo: lockCheck.tipo };
    }

    const claveCorrecta = this.obtenerClaveInstitucional();

    if ((claveActual || '').trim() !== claveCorrecta) {
      const fallo = this.registrarFalloAutenticacion(usuarioId);

      return { exito: false, error: fallo.error, bloqueado: fallo.bloqueado, tipoBloqueo: fallo.tipo };
    }

    this.registrarExitoAutenticacion(usuarioId);

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
      perfil: 'administrativo'
    });

    // Sincronizar en Google Drive

    this.guardarConfiguracionEnNube();

    return { exito: true, mensaje: 'Contraseña institucional actualizada con éxito y sincronizada en Google Drive.' };
  }

  /**

   * Guarda la configuración global (usuarios, perfiles, preferencias) en la nube y servidor
   */

  async guardarConfiguracionEnNube() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';

    if (this.configuracion && this.configuracion.favoritosPorUsuario) {
      }

    const payloadObj = { ...this.configuracion, fileId: '1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl' };
    const jsonStr = JSON.stringify(payloadObj);

    // 0. Persistir en IndexedDB de inmediato (cero pérdida de datos local)

    try {
      cacheService.guardarColeccion('configuracion', this.configuracion);
    } catch { }

    // 1. Enviar directamente a Google Apps Script (Omitido en Modo Local)

    if (true) {
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
    }

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

   * Módulo de Auditoría Institucional retirado: no realiza escrituras ni peticiones de auditoría.
   */

  async guardarAuditoriaEnNube(_forzarInmediato = false, _eventoNuevo = null) {
    return;
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

    // 1. Enviar directamente a Google Apps Script (Omitido en Modo Local)

    if (true) {
      try {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
          keepalive: true
        }).catch((e) => { });
      } catch (e) { }
    }

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

   * Guarda y sincroniza el control de cambios en Historico_Documentos (Google Sheets) (/api/historico y Google Drive)
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

    // 1. Enviar directamente a Google Apps Script (Omitido en Modo Local)

    if (true) {
      try {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: payload,
          keepalive: true
        }).catch((e) => { });
      } catch (e) { }
    }

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

    const lista = Array.isArray(this.empleados) ? this.empleados : [];

    let empleado = lista.find(
      (e) => this.limpiarNumeros(e.identificacion) === docClean
    );


    if (!empleado) {
      empleado = this.configuracion?.usuariosRegistrados?.[docClean];
    }

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
    const emailClean = (email || '').trim().toLowerCase();

    // Regla 9.4: Solo el bloqueo permanente de cuenta impide la recuperación

    if (emailClean) {
      const lockCheck = this.obtenerEstadoBloqueo(emailClean);

      if (lockCheck.cuentaBloqueada) {
        return { valido: false, error: lockCheck.error, bloqueado: true, tipoBloqueo: 'cuenta' };
      }
    }

    const d4 = this.limpiarNumeros(ultimos4);

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

    // Verificar si la cédula del colaborador tiene bloqueo permanente

    const lockCheckDoc = this.obtenerEstadoBloqueo(emp.identificacion);

    if (lockCheckDoc.cuentaBloqueada) {
      return { valido: false, error: lockCheckDoc.error, bloqueado: true, tipoBloqueo: 'cuenta' };
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
      const fallo = this.registrarFalloAutenticacion(emp.identificacion || emailClean);

      return {
        valido: false,
        error: fallo.error,
        bloqueado: fallo.bloqueado,
        tipoBloqueo: fallo.tipo
      };
    }

    this.registrarExitoAutenticacion(emp.identificacion || emailClean);

    return { valido: true, empleado: emp };
  }

  /**

   * Valida la identidad solicitando únicamente los últimos 4 dígitos de la cédula del colaborador
   */

  validarSolo4Digitos(ultimos4, empleadoObjetivo) {
    if (!empleadoObjetivo || !empleadoObjetivo.identificacion) {
      return { valido: false, error: 'No se ha detectado el usuario a restablecer.' };
    }

    // Regla 9.4: Solo el bloqueo permanente de cuenta impide la recuperación de identidad

    const lockCheck = this.obtenerEstadoBloqueo(empleadoObjetivo.identificacion);

    if (lockCheck.cuentaBloqueada) {
      return { valido: false, error: lockCheck.error, bloqueado: true, tipoBloqueo: 'cuenta' };
    }

    const d4 = this.limpiarNumeros(ultimos4);

    if (!d4 || d4.length < 4) {
      return { valido: false, error: 'Por favor ingresa los 4 últimos dígitos de tu cédula.' };
    }

    const docFull = this.limpiarNumeros(empleadoObjetivo.identificacion);

    if (!docFull.endsWith(d4)) {
      const fallo = this.registrarFalloAutenticacion(empleadoObjetivo.identificacion);

      return {
        valido: false,
        error: fallo.error,
        bloqueado: fallo.bloqueado,
        tipoBloqueo: fallo.tipo
      };
    }

    this.registrarExitoAutenticacion(empleadoObjetivo.identificacion);

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

   * Detecta automáticamente el usuario de SharePoint cuando la aplicación está incrustada
   * en un iframe o recibe parámetros en la URL / contexto del sitio.
   */

  detectarContextoSharepoint() {
    try {
      // 1. Análisis de Parámetros URL (Query Params del iframe)

      if (typeof window !== 'undefined' && window.location && window.location.search) {
        const p = new URLSearchParams(window.location.search);
        const email = p.get('email') || p.get('userEmail') || p.get('user') || p.get('upn') || p.get('loginName') || p.get('account') || p.get('user_email');
        const nombre = p.get('nombre') || p.get('name') || p.get('displayName') || p.get('userName') || p.get('user_name');
        const doc = p.get('doc') || p.get('identificacion') || p.get('cedula');
        const perfil = p.get('perfil') || p.get('role');

        if (email || doc) {
          return {
            email: email ? email.trim().toLowerCase() : '',
            identificacion: doc ? doc.trim() : '',
            nombre: nombre ? decodeURIComponent(nombre.trim()) : '',
            perfil: perfil ? perfil.trim().toLowerCase() : null,
            fuente: 'URL_PARAMS'
          };
        }
      }

      // 2. Análisis de Contexto SharePoint Same-Origin (si se aloja en el propio tenant o SiteAssets)

      if (typeof window !== 'undefined') {
        let spCtx = window._spPageContextInfo || null;

        if (!spCtx && window.parent && window.parent !== window) {
          try {
            spCtx = window.parent._spPageContextInfo || null;
          } catch {
            // Ignorar excepción de Same-Origin si el parent está en otro dominio
          }
        }

        if (spCtx && (spCtx.userEmail || spCtx.userLoginName || spCtx.userDisplayName)) {
          return {
            email: (spCtx.userEmail || spCtx.userLoginName || '').trim().toLowerCase(),
            nombre: (spCtx.userDisplayName || '').trim(),
            perfil: null,
            fuente: 'SP_PAGE_CONTEXT'
          };
        }
      }
    } catch (e) {
      console.warn('[StaffService] Detección de contexto SharePoint omitida:', e);
    }

    return null;
  }

  /**

   * Inicia sesión directa mediante identidad institucional de SharePoint (sin contraseñas)
   */

  async iniciarSesionDirecta(emailOrDoc, nombreOpcional = '', perfilForzado = null) {
    const raw = (emailOrDoc || '').toString().trim();

    if (!raw) {
      return { ok: false, error: 'Identificador institucional no proporcionado.' };
    }

    const listaEmpleados = Array.isArray(this.empleados) ? this.empleados : [];

    const esEmail = raw.includes('@');
    const emailClean = esEmail ? raw.toLowerCase() : '';
    const docClean = this.limpiarNumeros(raw);

    // 1. Buscar colaborador en la matriz institucional activa

    let emp = listaEmpleados.find((e) => {
      if (emailClean && (e.email || '').trim().toLowerCase() === emailClean) return true;

      if (docClean && this.limpiarNumeros(e.identificacion) === docClean) return true;

      return false;
    });

    // 2. Si no se encontró en la lista base, buscar en usuarios registrados previos

    if (!emp && this.configuracion?.usuariosRegistrados) {
      for (const k of Object.keys(this.configuracion.usuariosRegistrados)) {
        const u = this.configuracion.usuariosRegistrados[k];

        if (!u) continue;

        if (emailClean && (u.email || '').trim().toLowerCase() === emailClean) {
          emp = u;

          break;
        }

        if (docClean && this.limpiarNumeros(u.identificacion) === docClean) {
          emp = u;

          break;
        }
      }
    }

    // 3. Caso: Colaborador encontrado en la base institucional

    if (emp) {
      const perfilAsignado = perfilForzado

        || this.determinarPerfil(emp.cargo, emp.identificacion)

        || emp.perfil

        || 'operativo';

      const usuarioObj = {
        ...emp,
        nombre: emp.nombre || nombreOpcional || 'Colaborador Institucional',
        perfil: perfilAsignado,
        fuenteAutenticacion: 'SharePoint SSO',
        ultimoIngreso: new Date().toISOString()
      };

      if (emp.identificacion) {
        const cleanId = this.limpiarNumeros(emp.identificacion);
        this.configuracion.usuariosRegistrados = this.configuracion.usuariosRegistrados || {};

        this.configuracion.usuariosRegistrados[cleanId] = {
          ...(this.configuracion.usuariosRegistrados[cleanId] || {}),
          ...usuarioObj
        };
      }

      this.iniciarSesion(usuarioObj);

      return { ok: true, usuario: usuarioObj };
    }

    // 4. Caso: Usuario autenticado en SharePoint pero no listado en la base de datos local

    // Se le garantiza acceso seguro bajo perfil operativo (solo lectura y descarga)

    const nombreGenerado = nombreOpcional || (esEmail ? raw.split('@')[0].replace(/[._]/g, ' ').toUpperCase() : 'Colaborador SharePoint');
    const nuevoUsuario = {
      id: 'sp-' + Date.now(),
      identificacion: docClean || ('SP-' + (esEmail ? raw.split('@')[0] : Date.now())),
      nombre: nombreGenerado,
      email: esEmail ? emailClean : '',
      cargo: 'Colaborador SharePoint',
      sede: 'General',
      estado: 'Activo',
      perfil: perfilForzado || 'operativo',
      fuenteAutenticacion: 'SharePoint SSO',
      fechaRegistro: new Date().toISOString(),
      ultimoIngreso: new Date().toISOString()
    };

    this.iniciarSesion(nuevoUsuario);

    return { ok: true, usuario: nuevoUsuario, esNuevo: true };
  }

  /**

   * Verifica si el usuario figura en la matriz de colaboradores o configuración
   */

  estaUsuarioRegistrado(doc) {
    const docClean = this.limpiarNumeros(doc);

    if (!docClean) return false;

    const lista = Array.isArray(this.empleados) ? this.empleados : [];

    return lista.some((e) => this.limpiarNumeros(e.identificacion) === docClean) ||
      !!(this.configuracion?.usuariosRegistrados?.[docClean]);
  }

  /**

   * Registro directo sin contraseñas (delegado a SharePoint)
   */

  async registrarPassword(doc, email, _passwordPlano = null) {
    return this.iniciarSesionDirecta(email || doc);
  }

  /**

   * Inicia sesión directa mediante correo (sin contraseña)
   */

  async iniciarSesionConEmailYPassword(email, _passwordPlano = null) {
    return this.iniciarSesionDirecta(email);
  }

  /**

   * Inicia sesión directa mediante documento o correo (sin contraseña)
   */

  async iniciarSesionConPassword(docOrEmail, _passwordPlano = null) {
    return this.iniciarSesionDirecta(docOrEmail);
  }

  /**

   * Valida si una sesión almacenada sigue activa según las reglas de negocio institucionales:
   * REGLA DE NEGOCIO: La sesión debe permanecer activa de manera continua y persistente en la caché local
   * (localStorage / IndexedDB) una vez que el usuario ingresa con sus credenciales.
   * NO expira por cambio de día calendario (nueva jornada) ni por tiempo transcurrido o inactividad.
   * Solo queda invalidada si:
   * 1. El objeto de sesión no contiene una identificación válida.
   * 2. La cuenta del colaborador está actualmente bloqueada por seguridad.
   */

  esSesionValida(sesion) {
    if (!sesion || !sesion.identificacion) return false;

    // REGLA: El usuario genérico operativo siempre cuenta con sesión válida

    if (sesion.esGenerico || sesion.identificacion === 'OPERATIVO') {
      return true;
    }

    // Verificar si la cuenta del usuario está bloqueada por seguridad

    if (this.estaUsuarioBloqueado(sesion.identificacion)) {
      return false;
    }

    return true;
  }

  /**

   * Establece la sesión activa y la guarda en almacenamiento persistente (localStorage e IndexedDB)
   */

  iniciarSesion(usuarioObj) {
    if (!usuarioObj) return;

    const ahora = Date.now();
    const hoyStr = new Date().toISOString().split('T')[0];
    const sesionConMeta = {
      ...usuarioObj,
      timestampInicio: usuarioObj.timestampInicio || ahora,
      ultimoAcceso: ahora,
      fechaSesion: usuarioObj.fechaSesion || hoyStr
    };

    this.sesionActiva = sesionConMeta;
    this.colaboradorActivo = sesionConMeta;

    // Solo recordar como usuario persistente si es un colaborador institucional específico y no el genérico operativo

    if (!usuarioObj.esGenerico && usuarioObj.identificacion !== 'OPERATIVO') {
      this.usuarioRecordado = {
        identificacion: usuarioObj.identificacion,
        email: usuarioObj.email,
        nombre: usuarioObj.nombre,
        cargo: usuarioObj.cargo,
        sede: usuarioObj.sede,
        perfil: usuarioObj.perfil
      };

      try {
        localStorage.setItem(STORAGE_KEY_REMEMBERED_USER, JSON.stringify(this.usuarioRecordado));
      } catch { }
    }

    // Almacenar permanentemente la sesión administrativa en caché local para acceso sin clave

    if (this.esUsuarioAdministrativo(usuarioObj)) {
      try {
        localStorage.setItem(STORAGE_KEY_ADMIN_CACHED_USER, JSON.stringify(this.sesionActiva));
      } catch { }
    }

    try {
      localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
    } catch { }

    if (cacheService && cacheService.guardarColeccion) {
      cacheService.guardarColeccion('sesion_activa', this.sesionActiva).catch(() => {});
    }
  }

  /**

   * Obtiene el usuario administrador guardado permanentemente en la caché local del navegador
   */

  obtenerUsuarioAdministradorEnCache() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ADMIN_CACHED_USER);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (this.esSesionValida(parsed) && this.esUsuarioAdministrativo(parsed)) {
          return parsed;
        }
      }
    } catch { }

    const ses = this.sesionActiva || this.usuarioRecordado;

    if (ses && this.esSesionValida(ses) && this.esUsuarioAdministrativo(ses)) {
      return ses;
    }

    return null;
  }

  /**

   * Alias institucional para iniciar o establecer la sesión activa
   */

  establecerSesionActiva(usuarioObj) {
    return this.iniciarSesion(usuarioObj);
  }

  /**

   * Cierra voluntariamente la sesión activa y elimina la identificación administrativa guardada
   */

  cerrarSesion() {
    this.sesionActiva = null;
    this.colaboradorActivo = null;
    this.usuarioRecordado = null;

    try {
      localStorage.removeItem(STORAGE_KEY_AUTH_SESSION);

      localStorage.removeItem(STORAGE_KEY_ADMIN_CACHED_USER);

      localStorage.removeItem(STORAGE_KEY_REMEMBERED_USER);
    } catch { }

    if (cacheService && cacheService.guardarColeccion) {
      cacheService.guardarColeccion('sesion_activa', null).catch(() => {});
    }
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
    if (this.sesionActiva && !this.esSesionValida(this.sesionActiva)) {
      this.cerrarSesion();

      return null;
    }

    if (this.sesionActiva) {
      // Actualizar timestamp de último acceso de forma no invasiva (throttled cada 5 min)

      const ahora = Date.now();

      if (!this.sesionActiva.ultimoAcceso || ahora - this.sesionActiva.ultimoAcceso > 5 * 60 * 1000) {
        this.sesionActiva.ultimoAcceso = ahora;

        try {
          localStorage.setItem(STORAGE_KEY_AUTH_SESSION, JSON.stringify(this.sesionActiva));
        } catch { }

        if (cacheService && cacheService.guardarColeccion) {
          cacheService.guardarColeccion('sesion_activa', this.sesionActiva).catch(() => {});
        }
      }
    }

    return this.sesionActiva;
  }

  obtenerUsuarioRecordado() {
    return this.usuarioRecordado;
  }

  obtenerColaboradorActivo() {
    return this.obtenerSesionActiva();
  }

  buscarPorDocumento(doc) {
    const docClean = this.limpiarNumeros(doc);

    if (!docClean) return null;

    const lista = Array.isArray(this.empleados) ? this.empleados : [];

    let emp = lista.find((e) => this.limpiarNumeros(e.identificacion) === docClean) || null;


    if (!emp && this.configuracion?.usuariosRegistrados?.[docClean]) {
      emp = this.configuracion.usuariosRegistrados[docClean];
    }

    return emp;
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

   * Módulo de Auditoría Institucional retirado: no realiza seguimiento de inicios de sesión,
   * cambios de contraseña, descargas de usuarios, ni aperturas de carpetas.
   */

  async registrarAuditoria(_tipo, _detalle = {}) {
    return null;
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
    const codNorm = String(detalle.codigo || '').split('::')[0].trim().toUpperCase();
    const titNorm = String(detalle.titulo || '').replace(/\.(docx|xlsx|pdf|doc|xls)$/i, '').trim();
    const mDeriv = codNorm.match(/^([A-Z]{2,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/);
    const mBase = codNorm.match(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}$/);
    let esReg = false;
    let codPadre = '';

    if (mDeriv) {
      esReg = true;
      codPadre = mDeriv[1];
    } else if (mBase) {
      esReg = false;
      codPadre = '';
    } else if (detalle.documentoPadreCodigo && detalle.documentoPadreCodigo.split('-').length >= 3) {
      esReg = true;
      codPadre = detalle.documentoPadreCodigo;
    }

    const nuevoCambio = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      tipoEvento: tipoEvento, // 'CREACION', 'ELIMINACION', 'CAMBIO_VERSION', 'CAMBIO_RUTA', 'CAMBIO_TIPO', 'EDICION_SHAREPOINT'

      codigo: codNorm,
      titulo: titNorm,
      esRegistro: esReg,
      documentoPadreCodigo: codPadre,
      versionAnterior: vAntNorm,
      versionNueva: vNuevaNorm,
      rutaAnterior: detalle.rutaAnterior || 'N/A',
      rutaNueva: detalle.rutaNueva || 'N/A',
      tipoAnterior: detalle.tipoAnterior || 'N/A',
      tipoNuevo: detalle.tipoNuevo || 'N/A',
      usuario: detalle.usuario || sesion?.nombre || 'Administrador SGC',
      identificacion: detalle.identificacion || sesion?.identificacion || 'N/A',
      cargo: detalle.cargo || sesion?.cargo || 'Control Calidad',
      perfil: detalle.perfil || sesion?.perfil || localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'administrativo',
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

   * Parsea cadenas de fecha en formatos ISO, timestamps en ms o DD/MM/YYYY HH:mm:ss a milisegundos universales UTC
   * Garantiza la correcta interpretación de fechas UTC provenientes de SharePoint/OneDrive/ISO y horario local de Bogotá.
   */

  parsearFechaMilisegundos(str) {
    if (!str) return 0;

    if (typeof str === 'number') return str;

    if (str instanceof Date) return isNaN(str.getTime()) ? 0 : str.getTime();

    let s = String(str).trim();

    if (!s || s === 'N/A' || s === 'Sincronizado' || s === 'null' || s === 'undefined') return 0;

    // Normalizar espacios no rompibles (NBSP y NNBSP \u202F \u00A0) y múltiples espacios

    s = s.replace(/[\u202F\u00A0]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Si es un timestamp numérico en ms

    if (/^\d{12,14}$/.test(s)) {
      const n = parseInt(s, 10);

      if (!isNaN(n) && n > 0) return n;
    }

    // 2. Formato solo fecha YYYY-MM-DD (ej: 2026-10-19)

    const matchIsoDateOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (matchIsoDateOnly) {
      const y = parseInt(matchIsoDateOnly[1], 10);
      const m = parseInt(matchIsoDateOnly[2], 10) - 1;
      const d = parseInt(matchIsoDateOnly[3], 10);

      // Fijar al mediodía UTC para evitar desfases o cambios de día al convertir a zona horaria local

      return Date.UTC(y, m, d, 12, 0, 0);
    }

    // 3. Formato ISO fecha y hora (ej: 2026-10-19T13:17:42.711Z, 2026-10-19 13:17:40, 2026-09-28T13:13:00)

    // Regla Institucional: Los metadatos de OneDrive/SharePoint e ISO del sistema se originan en UTC.

    // Si no tienen 'Z' ni offset +/-HH:mm, se normalizan a UTC añadiendo 'Z'.

    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(s)) {
      let isoStr = s.replace(' ', 'T');
      const tieneOffset = isoStr.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(isoStr);

      if (!tieneOffset) {
        isoStr += 'Z';
      }

      const t = Date.parse(isoStr);

      if (!isNaN(t) && t > 0) return t;
    }

    // 4. Formato DD/MM/YYYY o DD-MM-YYYY con hora opcional y soporte completo para a. m. / p. m. / am / pm

    // Regla Institucional: Las fechas en formato latino DD/MM/YYYY representan horario local de Bogotá (UTC-5).

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

      // Bogotá está fija en UTC-5 todo el año (sin horario de verano).

      // UTC = local + 5 horas

      return Date.UTC(anio, mes, dia, hora + 5, min, seg);
    }

    const parseDirecto = Date.parse(s);

    return isNaN(parseDirecto) ? 0 : parseDirecto;
  }

  /**

   * Extrae los componentes de fecha y hora estandarizados en la zona horaria de Bogotá (UTC-5)
   */

  obtenerComponentesFechaBogota(val) {
    const ms = this.parsearFechaMilisegundos(val);

    if (!ms || ms <= 0) return null;

    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = dtf.formatToParts(new Date(ms));
      const m = {};

      for (const p of parts) {
        m[p.type] = p.value;
      }

      const h24 = parseInt(m.hour, 10) % 24;
      const ampm = h24 >= 12 ? 'p.m.' : 'a.m.';
      let h12 = h24 % 12;

      if (h12 === 0) h12 = 12;

      return {
        dia: m.day,
        mes: m.month,
        anio: m.year,
        hora24: String(h24).padStart(2, '0'),
        hora12: String(h12).padStart(2, '0'),
        minuto: m.minute,
        segundo: m.second,
        ampm: ampm
      };
    } catch {
      // Fallback matemático exacto (Bogotá = UTC-5 sin DST)

      const bogotaMs = ms - (5 * 3600 * 1000);
      const d = new Date(bogotaMs);
      const h24 = d.getUTCHours();
      const ampm = h24 >= 12 ? 'p.m.' : 'a.m.';
      let h12 = h24 % 12;

      if (h12 === 0) h12 = 12;

      return {
        dia: String(d.getUTCDate()).padStart(2, '0'),
        mes: String(d.getUTCMonth() + 1).padStart(2, '0'),
        anio: String(d.getUTCFullYear()),
        hora24: String(h24).padStart(2, '0'),
        hora12: String(h12).padStart(2, '0'),
        minuto: String(d.getUTCMinutes()).padStart(2, '0'),
        segundo: String(d.getUTCSeconds()).padStart(2, '0'),
        ampm: ampm
      };
    }
  }

  /**

   * Formatea cualquier fecha a formato estándar institucional colombiano:
   * DD/MM/YYYY hh:mm a.m./p.m. (horario estandarizado local de Bogotá)
   */

  formatearFechaHora(val) {
    if (!val || val === 'N/A' || val === 'Sincronizado' || val === 'null' || val === 'undefined') {
      return val === 'Sincronizado' ? 'Sincronizado' : 'N/A';
    }

    const c = this.obtenerComponentesFechaBogota(val);

    if (!c) return String(val).trim();

    return `${c.dia}/${c.mes}/${c.anio} ${c.hora12}:${c.minuto} ${c.ampm}`;
  }

  /**

   * Formatea la hora en formato estándar colombiano: hh:mm a.m./p.m. (horario estandarizado local de Bogotá)
   */

  formatearHoraSolo(val) {
    if (!val || val === 'N/A' || val === 'null' || val === 'undefined') return 'N/A';

    const c = this.obtenerComponentesFechaBogota(val);

    if (!c) return String(val).trim();

    return `${c.hora12}:${c.minuto} ${c.ampm}`;
  }

  /**

   * Formatea cualquier fecha a formato de fecha simple DD/MM/YYYY (horario estandarizado local de Bogotá)
   */

  formatearFechaSolo(val) {
    if (!val || val === 'N/A' || val === 'Sincronizado' || val === 'null' || val === 'undefined') {
      return 'N/A';
    }

    const c = this.obtenerComponentesFechaBogota(val);

    if (!c) return String(val).trim();

    return `${c.dia}/${c.mes}/${c.anio}`;
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
        const codAud = (a.documentoCodigo || a.codigo || '').split('::')[0].trim().toUpperCase();

        if (!codAud) return;

        const titAud = (a.documentoTitulo || a.titulo || '').replace(/\.(docx|xlsx|pdf|doc|xls)$/i, '').trim();

        eventosAuditoriaDocs.push({
          id: a.id || `aud_bridge_${Date.now()}`,
          tipoEvento: tipoEv,
          codigo: codAud,
          titulo: titAud,
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
        const docsActivos = (typeof window !== 'undefined' && window.__agyApp && Array.isArray(window.__agyApp.documentos)) ? window.__agyApp.documentos : (this.documentosEnMemoria || []);
        const existeActivo = docsActivos.some((d) => d.codigo && d.codigo.trim().toUpperCase() === cod);

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

  /**

   * Guarda una snapshot de los documentos para comparar cambios futuros (Diff Engine)
   * Incluye tanto documentos base como todos sus registros derivados
   */

  guardarSnapshotDocumentos(documentos) {
    if (!Array.isArray(documentos)) return;

    try {
      const mapaSnapshot = {};
      const procesarItem = (d, esReg = false, codPadre = '') => {
        if (!d || !d.codigo) return;

        const codUpper = d.codigo.trim().toUpperCase();

        mapaSnapshot[codUpper] = {
          codigo: d.codigo,
          titulo: d.titulo,
          version: this.normalizarVersion(d.version),
          tipoDocumento: esReg ? 'Registro Derivado' : (d.tipoDocumento || 'Formato'),
          tipoProceso: d.tipoProceso,
          area: d.area,
          proceso: d.proceso,
          carpeta: d.carpeta,
          estadoDocumento: d.estadoDocumento,
          disponible: d.disponible,
          modificacion: d.modificacion,
          sharepointUrl: d.sharepointUrl,
          esRegistro: esReg,
          documentoPadreCodigo: codPadre
        };
      };

      documentos.forEach((d) => {
        if (d && d.codigo) {
          procesarItem(d, Boolean(d.esRegistro), d.documentoPadreCodigo || '');

          if (Array.isArray(d.registrosDerivados)) {
            d.registrosDerivados.forEach((reg) => {
              if (reg && reg.codigo) {
                procesarItem({
                  ...reg,
                  tipoProceso: reg.tipoProceso || d.tipoProceso,
                  area: reg.area || d.area,
                  proceso: reg.proceso || d.proceso
                }, true, d.codigo);
              }
            });
          }
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

   * Analiza la lista actual de documentos (y sus registros derivados) contra la última snapshot conocida
   * Detecta y registra automáticamente en auditoría y control de cambios:
   * - CREACION (nuevo documento o nuevo registro derivado)
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
    const listaCompleta = [];

    documentosActuales.forEach((doc) => {
      if (!doc || !doc.codigo) return;

      listaCompleta.push({
        ...doc,
        esRegistro: Boolean(doc.esRegistro),
        documentoPadreCodigo: doc.documentoPadreCodigo || ''
      });

      if (Array.isArray(doc.registrosDerivados)) {
        doc.registrosDerivados.forEach((reg) => {
          if (reg && reg.codigo) {
            listaCompleta.push({
              ...reg,
              esRegistro: true,
              documentoPadreCodigo: doc.codigo,
              tipoProceso: reg.tipoProceso || doc.tipoProceso,
              area: reg.area || doc.area,
              proceso: reg.proceso || doc.proceso,
              tipoDocumento: 'Registro Derivado'
            });
          }
        });
      }
    });

    listaCompleta.forEach((doc) => {
      if (!doc || !doc.codigo) return;

      const codUpper = doc.codigo.trim().toUpperCase();
      mapaActual[codUpper] = doc;
      const anterior = snapshotAnterior[codUpper];
      const mDeriv = codUpper.match(/^([A-Z]{2,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/);
      const mBase = codUpper.match(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}$/);
      let esReg = false;
      let codPadre = '';

      if (mDeriv) {
        esReg = true;
        codPadre = mDeriv[1];
      } else if (mBase) {
        esReg = false;
        codPadre = '';
      } else if (doc.documentoPadreCodigo && doc.documentoPadreCodigo.split('-').length >= 3) {
        esReg = true;
        codPadre = doc.documentoPadreCodigo;
      }

      // 1. NUEVO DOCUMENTO O REGISTRO DERIVADO (CREACION)

      if (!anterior) {
        this.registrarAuditoria('CREACION', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension || 'DOC',
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Nuevo registro derivado incorporado al catálogo (${doc.codigo} - ${doc.titulo})`
            : `Nuevo documento incorporado al catálogo (${doc.codigo} - ${doc.titulo})`
        });

        this.registrarCambioDocumental('CREACION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          versionAnterior: 'N/A',
          versionNueva: this.normalizarVersion(doc.version || '1'),
          rutaAnterior: 'N/A',
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: 'N/A',
          tipoNuevo: doc.tipoDocumento || (esReg ? 'Registro Derivado' : 'Documento Anexo'),
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Registro derivado incorporado al catálogo (${doc.codigo} - ${doc.titulo})`
            : `Nuevo documento incorporado al catálogo (${doc.codigo})`,
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
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          detalle: esReg
            ? `Actualización de versión de registro derivado (${doc.codigo}): ${vAnt} ➔ ${vAct}`
            : `Actualización de versión en catálogo (${doc.codigo}): ${vAnt} ➔ ${vAct}`
        });

        this.registrarCambioDocumental('CAMBIO_VERSION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          versionAnterior: vAnt,
          versionNueva: vAct,
          rutaAnterior: `${anterior.tipoProceso || 'N/A'} / ${anterior.area || 'N/A'} / ${anterior.proceso || 'N/A'}`,
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: anterior.tipoDocumento || 'N/A',
          tipoNuevo: doc.tipoDocumento || 'N/A',
          usuario: sesionUsuario?.nombre || 'Gestor Documental',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Calidad',
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Actualización de versión de registro derivado: ${vAnt} ➔ ${vAct}`
            : `Actualización de versión en hoja de cálculo: ${vAnt} ➔ ${vAct}`,
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
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          detalle: esReg
            ? `Modificación de metadatos de registro derivado (${doc.codigo}): ${cambiosList.join(' • ')}`
            : `Modificación de metadatos en catálogo (${doc.codigo}): ${cambiosList.join(' • ')}`
        });

        this.registrarCambioDocumental('CAMBIO_METADATOS', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          versionAnterior: vAct || vAnt || '01',
          versionNueva: vAct || vAnt || '01',
          rutaAnterior: `${anterior.tipoProceso || 'N/A'} / ${anterior.area || 'N/A'} / ${anterior.proceso || 'N/A'}`,
          rutaNueva: `${doc.tipoProceso || 'N/A'} / ${doc.area || 'N/A'} / ${doc.proceso || 'N/A'}`,
          tipoAnterior: anterior.tipoDocumento || 'N/A',
          tipoNuevo: doc.tipoDocumento || 'N/A',
          usuario: sesionUsuario?.nombre || 'Gestor Documental',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Calidad',
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Modificación de metadatos de registro derivado: ${cambiosList.join(' • ')}`
            : `Modificación de metadatos en hoja de cálculo: ${cambiosList.join(' • ')}`,
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
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
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
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Edición de archivo físico de registro derivado en SharePoint. Previa: ${mAnt} ➔ Actual: ${mAct}`
            : `Edición de archivo físico en SharePoint. Previa: ${mAnt} ➔ Actual: ${mAct}`,
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

        const codElimUpper = (docEliminado.codigo || '').trim().toUpperCase();
        const mDeriv = codElimUpper.match(/^([A-Z]{2,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/);
        const mBase = codElimUpper.match(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}$/);
        let esReg = false;
        let codPadre = '';

        if (mDeriv) {
          esReg = true;
          codPadre = mDeriv[1];
        } else if (mBase) {
          esReg = false;
          codPadre = '';
        } else if (docEliminado.documentoPadreCodigo && docEliminado.documentoPadreCodigo.split('-').length >= 3) {
          esReg = true;
          codPadre = docEliminado.documentoPadreCodigo;
        }

        this.registrarAuditoria('ELIMINACION', {
          documentoCodigo: docEliminado.codigo,
          documentoTitulo: docEliminado.titulo,
          documentoExtension: docEliminado.extension || 'DOC',
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          detalle: esReg
            ? `Registro derivado retirado o marcado como obsoleto (${docEliminado.codigo})`
            : `Documento retirado o marcado como obsoleto (${docEliminado.codigo})`
        });

        this.registrarCambioDocumental('ELIMINACION', {
          codigo: docEliminado.codigo,
          titulo: docEliminado.titulo,
          esRegistro: esReg,
          documentoPadreCodigo: codPadre,
          versionAnterior: docEliminado.version || '01',
          versionNueva: 'Retirado / Obsoleto',
          rutaAnterior: `${docEliminado.tipoProceso || 'N/A'} / ${docEliminado.area || 'N/A'} / ${docEliminado.proceso || 'N/A'}`,
          rutaNueva: 'Archivo Inactivo / Fuera de Catálogo',
          tipoAnterior: docEliminado.tipoDocumento || 'N/A',
          tipoNuevo: 'N/A',
          usuario: sesionUsuario?.nombre || 'Administrador SGC',
          identificacion: sesionUsuario?.identificacion || 'N/A',
          cargo: sesionUsuario?.cargo || 'Control Calidad',
          perfil: sesionUsuario?.perfil || 'administrativo',
          detalle: esReg
            ? `Registro derivado retirado o marcado como obsoleto (${docEliminado.codigo})`
            : `Documento retirado o marcado como obsoleto (${docEliminado.codigo})`,
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
      } else if (fUpper === 'REGISTROS') {
        eventos = eventos.filter((ev) => {
          const cod = (ev.codigo || '').split('::')[0].trim().toUpperCase();
          const es4Partes = /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/i.test(cod);

          return Boolean(ev.esRegistro || ev.documentoPadreCodigo || es4Partes);
        });
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
        // Regla de Integridad: Si el documento existe activo en el catálogo activo, descartar falsa eliminación

        const docsActivos = (typeof window !== 'undefined' && window.__agyApp && Array.isArray(window.__agyApp.documentos)) ? window.__agyApp.documentos : (this.documentosEnMemoria || []);
        const existeActivo = docsActivos.some((d) => d.codigo && d.codigo.trim().toUpperCase() === cod);

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
          perfil: h.perfil || evExistente?.ev?.perfil || 'administrativo',
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
          perfil: h.perfil || evExistente?.ev?.perfil || 'administrativo',
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
          perfil: h.perfil || evExistente?.ev?.perfil || 'administrativo',
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

  obtenerConteoDescargasDocumentos(documentos = null) {
    const conteo = {};

    // 1. Conteo oficial persistido en la hoja de cálculo / catálogo de documentos
    let docs = null;
    if (Array.isArray(documentos) && documentos.length > 0) {
      docs = documentos;
    } else if (typeof window !== 'undefined' && window.__agyApp && Array.isArray(window.__agyApp.documentos) && window.__agyApp.documentos.length > 0) {
      docs = window.__agyApp.documentos;
    } else if (Array.isArray(this.documentosEnMemoria) && this.documentosEnMemoria.length > 0) {
      docs = this.documentosEnMemoria;
    }

    if (Array.isArray(docs)) {
      docs.forEach((d) => {
        const cod = (d.codigo || '').trim().toUpperCase();
        if (cod) {
          const val = parseInt(d.descargas !== undefined ? d.descargas : (d.numeroDescargas || 0), 10);
          if (!isNaN(val) && val > 0) conteo[cod] = val;
        }
        if (Array.isArray(d.registrosDerivados)) {
          d.registrosDerivados.forEach((r) => {
            const rCod = (r.codigo || '').trim().toUpperCase();
            if (rCod) {
              const rVal = parseInt(r.descargas !== undefined ? r.descargas : (r.numeroDescargas || 0), 10);
              if (!isNaN(rVal) && rVal > 0) conteo[rCod] = rVal;
            }
          });
          // Asignado condicionalmente arriba
        }
      });
    }

    // 2. Conteo de descargas locales acumuladas en el navegador
    try {
      const localDownloads = JSON.parse(localStorage.getItem('agy_sgc_doc_downloads') || '{}');
      Object.keys(localDownloads).forEach((cod) => {
        const codUpper = cod.trim().toUpperCase();
        conteo[codUpper] = Math.max(conteo[codUpper] || 0, parseInt(localDownloads[cod], 10) || 0);
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

   * Registra el conteo de descarga de un documento en la caché local (para ranking Top 10)
   * sin realizar seguimiento de auditoría por usuario.
   */

  registrarDescargaDocumento(doc, _formatoSalida = null) {
    if (!doc || !doc.codigo) return;

    const codUpper = doc.codigo.trim().toUpperCase();

    try {
      const localDownloads = JSON.parse(localStorage.getItem('agy_sgc_doc_downloads') || '{}');
      const baseDescargas = parseInt(doc.descargas, 10) || 0;
      localDownloads[codUpper] = Math.max(parseInt(localDownloads[codUpper], 10) || 0, baseDescargas);

      localStorage.setItem('agy_sgc_doc_downloads', JSON.stringify(localDownloads));
    } catch { }
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

  obtenerTop50DocumentosOrdenados(documentos) {
    if (!documentos || documentos.length === 0) return [];

    const conteos = this.obtenerConteoDescargasDocumentos(documentos);

    // 1. Filtrar solo documentos que estén disponibles
    const disponibles = documentos.filter((d) => {
      return !(d.disponible === false || d.disponible === 'NO' || d.disponible === 'false');
    });

    if (disponibles.length === 0) return [];

    // 2. Ordenar de mayor a menor número de descargas (SSOT Biblioteca_Documental)
    disponibles.sort((a, b) => {
      const cA = conteos[(a.codigo || '').trim().toUpperCase()] || 0;
      const cB = conteos[(b.codigo || '').trim().toUpperCase()] || 0;
      if (cB !== cA) return cB - cA;
      return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
    });

    // 3. Tomar documentos con descargas > 0 (hasta 50) o los primeros disponibles en caso de catálogo inicial
    const conDescargas = disponibles;
    const seleccionados = conDescargas.length > 0 ? conDescargas.slice(0, 50) : disponibles.slice(0, 50);

    return seleccionados.map((d, index) => ({
      ...d,
      topRanking: index + 1,
      numDescargas: conteos[(d.codigo || '').trim().toUpperCase()] || 0
    }));
  }

  obtenerTop10DocumentosOrdenados(documentos) {
    // Alias para compatibilidad hacia Top 50
    return this.obtenerTop50DocumentosOrdenados(documentos);
  }

  obtenerTop50Ids(documentos) {
    const top50 = this.obtenerTop50DocumentosOrdenados(documentos);
    return new Set(top50.map((d) => d.id));
  }

  obtenerTop10Ids(documentos) {
    return this.obtenerTop50Ids(documentos);
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

    const perfilAsignado = datos.perfil || 'administrativo';
    const usuarioObj = {
      identificacion: datos.identificacion.trim(),
      nombre: datos.nombre.trim(),
      email: datos.email.trim().toLowerCase(),
      cargo: (datos.cargo || 'Acceso Administrativo').trim(),
      sede: (datos.sede || 'Principal').trim(),
      perfil: perfilAsignado,
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

   * Retorna la lista de empleados con perfil Administrativo activo
   */

  obtenerColaboradoresConPerfilesEspeciales() {
    const mapeo = this.configuracion?.mapeoPerfilesPersonalizados || {};
    const registrados = this.configuracion?.usuariosRegistrados || {};
    const todosDocs = new Set([...Object.keys(mapeo), ...Object.keys(registrados), '8160602']);
    const resultado = [];

    todosDocs.forEach((docClean) => {
      if (!docClean) return;

      const emp = this.empleados.find((e) => this.limpiarNumeros(e.identificacion) === docClean);
      const reg = registrados[docClean];
      const perfilActual = mapeo[docClean] || reg?.perfil || (docClean === '8160602' ? 'administrativo' : '');

      // Solo incluir usuarios con rol administrativo activo

      if (perfilActual === 'administrativo' || perfilActual === 'total' || perfilActual === 'administrador' || docClean === '8160602') {
        resultado.push({
          identificacion: emp?.identificacion || reg?.identificacion || docClean,
          nombre: emp?.nombre || reg?.nombre || (docClean === '8160602' ? 'John Fredy Ramirez Rios' : 'Colaborador'),
          email: emp?.email || reg?.email || 'N/A',
          cargo: emp?.cargo || reg?.cargo || 'Personal Administrativo',
          sede: emp?.sede || reg?.sede || 'Principal',
          perfilBase: 'operativo',
          perfilEspecial: 'administrativo',
          esRaiz: docClean === '8160602'
        });
      }
    });

    resultado.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

    return resultado;
  }

  /**

   * Remueve la asignación de rol administrativo en Google Drive
   */

  async removerPerfilPersonalizado(doc) {
    const docClean = this.limpiarNumeros(doc);

    if (!docClean) return false;

    // Proteger al superadministrador de acceso total raíz

    if (docClean === '8160602') {
      console.warn('[StaffService] No se puede remover el rol al administrador principal 8160602.');

      return false;
    }

    if (this.configuracion.mapeoPerfilesPersonalizados) {
      delete this.configuracion.mapeoPerfilesPersonalizados[docClean];
    }

    if (this.configuracion.usuariosRegistrados?.[docClean]) {
      delete this.configuracion.usuariosRegistrados[docClean];
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

   * Métodos obsoletos conservados para compatibilidad
   */

  obtenerFiltrosPorDefecto(doc = null) {
    return { tipoProceso: '', area: '', proceso: '' };
  }

  async guardarFiltrosPorDefecto(doc, filtros) {
    return true;
  }

  /**

   * Guarda preferencias genéricas del usuario (vistaCatalogo, filtros, etc.)
   */

  async guardarPreferenciaUsuario(clave, valor, doc = null) {
    if (clave === 'vistaCatalogo') {
      return this.guardarPreferenciaVistaCatalogo(doc, valor);
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

  normalizarTipoProceso(tp) {
    if (!tp) return '';

    const s = String(tp).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (s.startsWith('estrategic')) return 'Estrategico';

    if (s.startsWith('calidad')) return 'Calidad';

    if (s.startsWith('mision')) return 'Misional';

    if (s.startsWith('apoyo')) return 'Apoyo';

    return String(tp).trim();
  }

  obtenerMatrizInstitucional() {
    return {
      'Estrategico': {
        'GAD': ['Planeación Estratégica y Dirección', 'Gestión Administrativa y Financiera'],
        'GFI': ['Gestión Financiera y Contable'],
        'GIC': ['Gestión Integral de Calidad'],
        'GTH': ['Políticas Institucionales'],
        'GHU': ['Políticas Institucionales'],
        'GTI': ['Tecnologías de la Información']
      },
      'Apoyo': {
        'GTH': [
          'Bienestar',
          'Comunicaciones',
          'Contratación',
          'Desempeño',
          'Formación',
          'Gestión Documental',
          'Gestión Humana',
          'Gestión Talento Humano',
          'Inducción',
          'Nómina',
          'Seguridad y Salud en el Trabajo',
          'Selección'
        ],
        'GHU': [
          'Bienestar',
          'Comunicaciones',
          'Contratación',
          'Desempeño',
          'Formación',
          'Gestión Documental',
          'Gestión Humana',
          'Gestión Talento Humano',
          'Inducción',
          'Nómina',
          'Seguridad y Salud en el Trabajo',
          'Selección'
        ],
        'GAD': ['Gestión Administrativa y Financiera', 'Gestión Humana', 'Planeación Estratégica y Dirección'],
        'GFI': ['Gestión Financiera y Contable'],
        'GTI': ['Tecnologías de la Información']
      },
      'Calidad': {
        'GIC': ['Gestión Integral de Calidad', 'Planeación Estratégica y Dirección', 'Intranet']
      },
      'Misional': {
        'GMD': [
          'Gestión de Especialistas',
          'Gestión de Medicina General',
          'Gestión Médica',
          'Gestión asistencial',
          'Gestión Integral de Calidad'
        ]
      }
    };
  }

  obtenerAreasPorTipoProceso(tipoProceso) {
    const tpNorm = this.normalizarTipoProceso(tipoProceso);
    const areas = this.obtenerAreasInstitucionales();

    if (!tpNorm) return areas;

    const matriz = this.obtenerMatrizInstitucional();
    const siglasPermitidas = matriz[tpNorm] ? Object.keys(matriz[tpNorm]) : [];

    return areas.filter((a) => {
      const sigla = (a.sigla || '').toUpperCase();
      const nom = (a.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (siglasPermitidas.includes(sigla)) return true;

      if (tpNorm === 'Misional') {
        return sigla === 'GMD' || nom.includes('medic') || nom.includes('asistenc');
      }

      if (tpNorm === 'Calidad') {
        return sigla === 'GIC' || nom.includes('calidad');
      }

      if (tpNorm === 'Estrategico') {
        return ['GAD', 'GFI', 'GIC', 'GTH', 'GHU', 'GTI'].includes(sigla) ||
               nom.includes('administrativ') || nom.includes('financier') || nom.includes('calidad') || nom.includes('talento') || nom.includes('tecnolog');
      }

      if (tpNorm === 'Apoyo') {
        return ['GTH', 'GHU', 'GAD', 'GFI', 'GTI'].includes(sigla) ||
               nom.includes('talento') || nom.includes('administrativ') || nom.includes('financier') || nom.includes('tecnolog');
      }

      return false;
    });
  }

  obtenerProcesosPorAreaYTipo(nombreArea, tipoProceso) {
    const tpNorm = this.normalizarTipoProceso(tipoProceso);
    const matriz = this.obtenerMatrizInstitucional();
    const areas = this.obtenerAreasInstitucionales();
    let areaMatch = null;

    if (nombreArea) {
      const normA = String(nombreArea).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      areaMatch = areas.find((a) => {
        const aNom = (a.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const aSig = (a.sigla || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return aNom === normA || aSig === normA || aNom.includes(normA) || normA.includes(aNom);
      });
    }

    const sigla = areaMatch ? (areaMatch.sigla || '').toUpperCase() : '';

    if (tpNorm && matriz[tpNorm]) {
      const procesosMatriz = (sigla && matriz[tpNorm][sigla]) 
        ? [...matriz[tpNorm][sigla]] 
        : [];

      if (procesosMatriz.length === 0 && areaMatch) {
        const nomAreaLower = (areaMatch.nombre || '').toLowerCase();

        if (tpNorm === 'Misional' && (nomAreaLower.includes('medic') || nomAreaLower.includes('asistenc'))) {
          procesosMatriz.push(...(matriz['Misional']['GMD'] || []));
        } else if (tpNorm === 'Calidad' && nomAreaLower.includes('calidad')) {
          procesosMatriz.push(...(matriz['Calidad']['GIC'] || []));
        } else if (tpNorm === 'Estrategico') {
          if (nomAreaLower.includes('talento') || nomAreaLower.includes('humana')) procesosMatriz.push(...(matriz['Estrategico']['GTH'] || []));
          else if (nomAreaLower.includes('admin')) procesosMatriz.push(...(matriz['Estrategico']['GAD'] || []));
          else if (nomAreaLower.includes('financ')) procesosMatriz.push(...(matriz['Estrategico']['GFI'] || []));
          else if (nomAreaLower.includes('calidad')) procesosMatriz.push(...(matriz['Estrategico']['GIC'] || []));
          else if (nomAreaLower.includes('tecnolog') || nomAreaLower.includes('tic')) procesosMatriz.push(...(matriz['Estrategico']['GTI'] || []));
        } else if (tpNorm === 'Apoyo') {
          if (nomAreaLower.includes('talento') || nomAreaLower.includes('humana')) procesosMatriz.push(...(matriz['Apoyo']['GTH'] || []));
          else if (nomAreaLower.includes('admin')) procesosMatriz.push(...(matriz['Apoyo']['GAD'] || []));
          else if (nomAreaLower.includes('financ')) procesosMatriz.push(...(matriz['Apoyo']['GFI'] || []));
          else if (nomAreaLower.includes('tecnolog') || nomAreaLower.includes('tic')) procesosMatriz.push(...(matriz['Apoyo']['GTI'] || []));
        }
      }

      if (areaMatch && Array.isArray(areaMatch.procesos)) {
        areaMatch.procesos.forEach((p) => {
          const pNorm = String(p).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          if (tpNorm === 'Estrategico' && (sigla === 'GTH' || sigla === 'GHU' || (areaMatch.nombre || '').toLowerCase().includes('talento'))) {
            if (pNorm.includes('politica')) {
              if (!procesosMatriz.some((item) => item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === pNorm)) {
                procesosMatriz.push(p);
              }
            }
          } else if (tpNorm === 'Apoyo' && (sigla === 'GTH' || sigla === 'GHU' || (areaMatch.nombre || '').toLowerCase().includes('talento'))) {
            if (!pNorm.includes('politica')) {
              if (!procesosMatriz.some((item) => item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === pNorm)) {
                procesosMatriz.push(p);
              }
            }
          } else {
            if (!procesosMatriz.some((item) => item.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === pNorm)) {
              procesosMatriz.push(p);
            }
          }
        });
      }

      const unicos = Array.from(new Set(procesosMatriz)).sort((a, b) => a.localeCompare(b, 'es'));

      if (unicos.length > 0) return unicos;
    }

    return this.obtenerProcesosPorArea(nombreArea);
  }

  obtenerTipoProcesoPorArea(nombreArea, proceso = '') {
    if (proceso) {
      const pNorm = String(proceso).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (pNorm.includes('politica')) return 'Estrategico';

      if (pNorm.includes('bienestar') || pNorm.includes('nomina') || pNorm.includes('induccion') || pNorm.includes('seleccion') || pNorm.includes('sst') || pNorm.includes('desempeno') || pNorm.includes('formacion') || pNorm.includes('comunicacion') || pNorm.includes('contratacion')) {
        return 'Apoyo';
      }

      if (pNorm.includes('medica') || pNorm.includes('especialista') || pNorm.includes('asistencial')) return 'Misional';
    }

    const a = String(nombreArea || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (a.includes('medic') || a.includes('gmd') || a.includes('asistenc')) return 'Misional';

    if (a.includes('calidad') || a.includes('gic')) return 'Calidad';

    if (a.includes('admin') || a.includes('gad')) return 'Estrategico';

    if (a.includes('talento') || a.includes('humana') || a.includes('gth') || a.includes('ghu') || a.includes('sst')) return 'Apoyo';

    if (a.includes('financier') || a.includes('gfi')) return 'Apoyo';

    if (a.includes('tecnolog') || a.includes('gti') || a.includes('tic')) return 'Apoyo';

    return 'Apoyo';
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
