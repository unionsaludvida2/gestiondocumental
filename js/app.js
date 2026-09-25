/**
 * Controlador Principal - Sistema de Gestión Documental
 * Unión para la salud y la vida S.A.S.
 * 
 * Origen de Datos: REPOSITORIO_DOCUMENTAL.csv (OneDrive / SharePoint)
 * Módulos:
 * - Catálogo y Filtros Relacionales en Cascada
 * - Módulo de Analítica y Dashboard
 * - Búsqueda Avanzada e Inteligente con Autocompletado
 * - Sistema de Documentos Frecuentes y Favoritos (⭐)
 * - Modo Edición: Desbloqueo Automático para Acceso Total y Contraseña Personal para Directivos y Administrativos
 */

import { sharepointService, determinarEstrategiaDescarga, esDocumentoFMT } from './sharepoint-service.js?v=11.6.61';
import { filterEngine } from './filters.js?v=11.6.61';
import { modalManager } from './modal.js?v=11.6.61';
import { analyticsManager } from './analytics.js?v=11.6.61';
import { staffService } from './staff-service.js?v=11.6.61';

const STORAGE_KEY_EDIT_MODE = 'agy_sgc_edit_mode';
const STORAGE_KEY_FAVORITES = 'agy_sgc_favorites';
const STORAGE_KEY_USER_PROFILE = 'agy_user_profile';

class AppController {
  constructor() {
    this.documentos = [];
    this.el = {};
    this.vistaActual = 'catalog'; // 'catalog' o 'analytics'

    this.perfil = localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'operativo';
    this.actualizarClasesPerfilBody();
    filterEngine.setPerfil(this.perfil);

    // POLÍTICA INSTITUCIONAL RBAC:
    // El perfil de Acceso Total entra directamente al modo desbloqueado / edición sin requerir contraseña
    const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
    this.modoEdicion = esAccesoTotal;
    if (esAccesoTotal) {
      sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
    } else {
      try {
        sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
        localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
      } catch { }
    }

    // Cargar preferencia de vista del catálogo (por defecto 'tabla')
    this.vistaCatalogo = staffService.obtenerPreferenciaVistaCatalogo() || 'tabla';

    // Cargar favoritos desde localStorage
    try {
      const guardados = JSON.parse(localStorage.getItem(STORAGE_KEY_FAVORITES) || '[]');
      this.favoritos = new Set(guardados);
    } catch {
      this.favoritos = new Set();
    }

    // Debounce para prevenir múltiples clics rápidos en botones de acción y tarjetas
    this._debounceAccionesDoc = new Map();

    // Escuchar actualizaciones automáticas del catálogo en segundo plano (Stale-While-Revalidate)
    window.addEventListener('agy_docs_updated', (e) => {
      const freshDocs = e.detail;
      if (Array.isArray(freshDocs) && freshDocs.length > 0) {
        this.documentos = freshDocs;
        this.aplicarFiltros(true);
        if (this.vistaActual === 'analytics') {
          const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
          analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
        }
      }
    });
  }

  async init() {
    try {
      modalManager.init();
      this.capturarDOM();
      this.bindEvents();

      // Rastrear interacción del usuario para no interrumpir el desplazamiento fluido por el listado
      this.ultimoScrollUsuario = 0;
      const registrarScroll = () => {
        this.ultimoScrollUsuario = Date.now();
      };
      window.addEventListener('scroll', registrarScroll, { passive: true });
      document.addEventListener('scroll', registrarScroll, { capture: true, passive: true });
      document.addEventListener('wheel', registrarScroll, { passive: true });
      document.addEventListener('touchmove', registrarScroll, { passive: true });
    } catch (e) {
      console.warn('[App] Error vinculando DOM inicial:', e);
    }

    // 0. Renderizado inmediato a 0 ms con catálogo en memoria
    this.documentos = Array.isArray(sharepointService.documentosEnMemoria) && sharepointService.documentosEnMemoria.length > 0
      ? sharepointService.documentosEnMemoria
      : [];

    try {
      // Cargar preferencias guardadas en usuarios.conf / local
      const sesionInic = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
      this.vistaCatalogo = staffService.obtenerPreferenciaVistaCatalogo(sesionInic?.identificacion) || 'tabla';

      const ordenGuardado = staffService.obtenerPreferenciaOrdenamiento(sesionInic?.identificacion);
      filterEngine.setOrdenamiento(ordenGuardado);
      if (this.el.sortSelect) {
        this.el.sortSelect.value = ordenGuardado;
      }

      // Cargar filtros por defecto guardados (Tipo de Proceso, Área y Proceso)
      const filtrosDefecto = staffService.obtenerFiltrosPorDefecto(sesionInic?.identificacion);
      if (filtrosDefecto) {
        if (filtrosDefecto.tipoProceso) filterEngine.estado.tiposProceso.add(filtrosDefecto.tipoProceso);
        if (filtrosDefecto.area) filterEngine.estado.areas.add(filtrosDefecto.area);
        if (filtrosDefecto.proceso) filterEngine.estado.procesos.add(filtrosDefecto.proceso);
      }
    } catch (e) {
      console.warn('[App] Error cargando preferencias iniciales:', e);
    }

    try {
      this.actualizarBotonModoEdicion();
      this.actualizarVisibilidadModulos();
      this.actualizarContadorFavoritos();
      this.actualizarIndicadorPerfil();
      this.aplicarFiltros();
    } catch (e) {
      console.warn('[App] Error en renderizado inicial del catálogo:', e);
    }

    // 1. Comprobar sesión de inmediato (síncrono desde localStorage a 0 ms)
    try {
      const sesionInmediata = staffService.obtenerSesionActiva();
      if (!sesionInmediata) {
        document.body.classList.add('auth-required');
        modalManager.abrirModalAutenticacion(
          staffService,
          (usuario) => this.onLoginExitoso(usuario),
          () => this.onLogout(),
          true
        );
      } else {
        document.body.classList.remove('auth-required');
        const perfilEfectivo = staffService.determinarPerfil(sesionInmediata.cargo, sesionInmediata.identificacion) || sesionInmediata.perfil || this.perfil;
        this.perfil = perfilEfectivo;
        this.actualizarClasesPerfilBody();
        filterEngine.setPerfil(this.perfil);

        const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
        this.modoEdicion = esAccesoTotal;
        if (esAccesoTotal) {
          sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
        } else {
          try {
            sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
            localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
          } catch { }
        }

        this.actualizarIndicadorPerfil();
        this.actualizarIndicadorColaborador();
        this.actualizarBotonModoEdicion();
        this.actualizarVisibilidadModulos();
        this.aplicarFiltros();
      }
    } catch (e) {
      console.warn('[App] Error en verificación de sesión:', e);
    }

    // 2. Inicializar Analítica con callback para filtrar desde los gráficos
    try {
      analyticsManager.init('analytics-view-container', (filterType, filterVal) => {
        this.cambiarVista('catalog');
        filterEngine.restablecerFiltros();
        if (filterType === 'tipoProceso') filterEngine.toggleTipoProceso(filterVal);
        if (filterType === 'area') filterEngine.toggleArea(filterVal);
        if (filterType === 'proceso') filterEngine.toggleProceso(filterVal);
        if (filterType === 'tipo') filterEngine.toggleTipoDocumento(filterVal);
        this.aplicarFiltros();
      });
    } catch (e) {
      console.warn('[App] Error inicializando analítica:', e);
    }

    // 3. Sincronización en segundo plano (no bloqueante) con OneDrive y Google Drive
    Promise.all([
      staffService.inicializar(),
      this.cargarDatos()
    ]).then(() => {
      const sesionActiva = staffService.obtenerSesionActiva();
      if (sesionActiva) {
        const perfilEfectivo = staffService.determinarPerfil(sesionActiva.cargo, sesionActiva.identificacion) || sesionActiva.perfil || this.perfil;
        if (perfilEfectivo !== this.perfil) {
          this.perfil = perfilEfectivo;
          filterEngine.setPerfil(this.perfil);
          this.actualizarIndicadorPerfil();
        }
        const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
        if (!esAccesoTotal) {
          this.modoEdicion = false;
          try {
            sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
            localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
          } catch { }
        }
        this.actualizarIndicadorColaborador();
        this.actualizarBotonModoEdicion();
        this.actualizarVisibilidadModulos();
        this.aplicarFiltros(true);
      }
      this.iniciarSincronizacionInteligente();
    }).catch((e) => console.warn('[App] Error en sincronización de fondo:', e));
  }

  async cargarDatos(forzar = false) {
    try {
      const docs = await sharepointService.obtenerDocumentos(forzar);
      if (docs && docs.length > 0) {
        const firmaPrevia = this.calcularFirmaDocumental(this.documentos);
        const firmaNueva = this.calcularFirmaDocumental(docs);
        this.documentos = docs;
        if (firmaPrevia !== firmaNueva) {
          this.aplicarFiltros(true);
          if (this.vistaActual === 'analytics') {
            const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
            analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
          }
        }
      }
    } catch (e) {
      console.warn('[App] Error cargando datos:', e);
    }
  }

  capturarDOM() {
    this.el = {
      totalCount: document.getElementById('total-docs-count'),
      btnNuevoDoc: document.getElementById('btn-nuevo-doc'),
      btnRefresh: document.getElementById('btn-sync-data') || document.getElementById('btn-refresh-data'),
      refreshIcon: document.getElementById('header-sync-icon') || document.getElementById('refresh-icon'),
      btnToggleEdit: document.getElementById('btn-toggle-edit'),
      editLockIcon: document.getElementById('edit-lock-icon'),
      editModeText: document.getElementById('edit-mode-text'),

      // Colaborador (Matriz EMPLEADOS_ACTIVOS.csv)
      btnStaffPill: document.getElementById('btn-staff-pill'),
      headerStaffIcon: document.getElementById('header-staff-icon'),
      headerStaffSubtext: document.getElementById('header-staff-subtext'),
      headerStaffName: document.getElementById('header-staff-name'),

      // Perfil y Configuración
      btnProfilePill: document.getElementById('btn-profile-pill'),
      headerProfileIcon: document.getElementById('header-profile-icon'),
      headerProfileName: document.getElementById('header-profile-name'),
      btnOpenSettings: document.getElementById('btn-open-settings'),

      // Switcher de Vistas y Contenedores
      btnViewCatalog: document.getElementById('btn-view-catalog'),
      btnViewAnalytics: document.getElementById('btn-view-analytics'),
      viewCatalog: document.getElementById('documents-grid-container'),
      viewAnalytics: document.getElementById('analytics-view-container'),
      sidebar: document.getElementById('sidebar-filters'),
      sidebarQuickAccess: document.getElementById('sidebar-quick-access-container'),
      sidebarCatalogContent: document.getElementById('sidebar-catalog-filters-content'),
      sidebarCatalogFooter: document.getElementById('sidebar-catalog-footer'),
      sidebarDashboardContent: document.getElementById('sidebar-dashboard-nav-content'),
      btnSidebarDashResumen: document.getElementById('btn-sidebar-dash-resumen'),
      btnSidebarDashCalidad: document.getElementById('btn-sidebar-dash-calidad'),
      btnSidebarDashAuditoria: document.getElementById('btn-sidebar-dash-auditoria'),
      btnSidebarDashCambios: document.getElementById('btn-sidebar-dash-cambios'),
      btnSidebarDashMaster: document.getElementById('btn-sidebar-dash-master'),
      btnSidebarDashVencidos: document.getElementById('btn-sidebar-dash-vencidos'),
      btnSidebarDashCalidadExport: document.getElementById('btn-sidebar-dash-calidad-export'),
      btnSidebarDashAudit: document.getElementById('btn-sidebar-dash-audit'),
      btnSidebarDashHistory: document.getElementById('btn-sidebar-dash-history'),
      contentToolbarRow: document.getElementById('content-toolbar-row'),
      footerFilters: document.getElementById('footer-active-filters'),
      footerBottomRow: document.getElementById('footer-bottom-row'),

      // Filtros del Sidebar
      listaTiposProceso: document.getElementById('filter-list-tipos-proceso') || document.getElementById('filter-list-tipo-proceso'),
      listaAreas: document.getElementById('filter-list-areas') || document.getElementById('filter-list-area'),
      listaProcesos: document.getElementById('filter-list-procesos') || document.getElementById('filter-list-proceso'),
      listaTipos: document.getElementById('filter-list-tipos') || document.getElementById('filter-list-tipo-documento'),
      btnReset: document.getElementById('btn-reset-filters'),

      // Barra de Búsqueda y Header
      searchInput: document.getElementById('search-input') || document.getElementById('main-search-input'),
      searchClear: document.getElementById('search-clear-btn'),
      searchSuggestions: document.getElementById('search-suggestions-box'),
      formatBtns: document.querySelectorAll('.btn-format-tag'),
      btnFilterTop10: document.getElementById('btn-filter-top10'),
      btnFavoritesFilter: document.getElementById('btn-filter-favorites'),
      btnSidebarTop10: document.getElementById('btn-sidebar-top10'),
      btnSidebarFavs: document.getElementById('btn-sidebar-favorites'),
      favCountBadge: document.getElementById('fav-count-badge'),
      sortSelect: document.getElementById('sort-select'),

      // Grid y Footer
      grid: document.getElementById('documents-grid'),
      chipsContainer: document.getElementById('active-filters-chips')
    };
  }

  actualizarIndicadorColaborador() {
    const sesion = staffService.obtenerSesionActiva();
    const recordado = staffService.obtenerUsuarioRecordado();
    if (!this.el.headerStaffName) return;

    const perfilNombres = {
      total: 'Acceso Total',
      administrador: 'Acceso Total',
      operativo: 'Operativo',
      administrativo: 'Administrativo',
      directivo: 'Directivo'
    };
    const perfilIconos = {
      total: '🛡️',
      administrador: '🛡️',
      operativo: '👷',
      administrativo: '💼',
      directivo: '👑'
    };

    const p = this.perfil || 'operativo';
    const nomPerfil = perfilNombres[p] || p;
    const iconPerfil = perfilIconos[p] || '👤';

    if (sesion) {
      const partes = sesion.nombre.trim().split(/\s+/);
      const nombreCorto = partes.length >= 2 ? `${partes[0]} ${partes[1]}` : sesion.nombre;

      this.el.headerStaffName.textContent = nombreCorto;
      if (this.el.headerStaffSubtext) {
        this.el.headerStaffSubtext.textContent = nomPerfil.toUpperCase();
      }
      if (this.el.btnStaffPill) {
        this.el.btnStaffPill.classList.add('active');
        this.el.btnStaffPill.title = `● Sesión Activa: ${sesion.nombre}\nCargo: ${sesion.cargo || 'No asignado'}\nC.C. ${sesion.identificacion}\nSede: ${sesion.sede || 'Institucional'}\nPerfil Activo: ${nomPerfil}\n\nHaz clic para ver opciones o cambiar de usuario.`;
      }
      if (this.el.headerStaffIcon) this.el.headerStaffIcon.textContent = iconPerfil;
    } else if (recordado) {
      const partes = recordado.nombre.trim().split(/\s+/);
      const primerNombre = partes[0] || recordado.nombre;

      this.el.headerStaffName.textContent = `${primerNombre} (Ingresar)`;
      if (this.el.headerStaffSubtext) {
        this.el.headerStaffSubtext.textContent = nomPerfil.toUpperCase();
      }
      if (this.el.btnStaffPill) {
        this.el.btnStaffPill.classList.remove('active');
        this.el.btnStaffPill.title = `Colaborador recordado: ${recordado.nombre}\nCargo: ${recordado.cargo || 'No asignado'}\nPerfil: ${nomPerfil}\n\nHaz clic para ingresar tu contraseña personal.`;
      }
      if (this.el.headerStaffIcon) this.el.headerStaffIcon.textContent = '🔒';
    } else {
      this.el.headerStaffName.textContent = 'Identificarse';
      if (this.el.headerStaffSubtext) {
        this.el.headerStaffSubtext.textContent = nomPerfil.toUpperCase();
      }
      if (this.el.btnStaffPill) {
        this.el.btnStaffPill.classList.remove('active');
        this.el.btnStaffPill.title = `Perfil: ${nomPerfil}\nIdentifícate con tu cédula y contraseña para activar tus permisos.`;
      }
      if (this.el.headerStaffIcon) this.el.headerStaffIcon.textContent = iconPerfil;
    }
  }

  onLoginExitoso(usuario) {
    document.body.classList.remove('auth-required');
    this.actualizarIndicadorColaborador();

    if (usuario) {
      // 1. Determinar perfil persistido (personalizado en Google Drive o matriz)
      const perfilEfectivo = staffService.determinarPerfil(usuario.cargo, usuario.identificacion) || usuario.perfil || 'operativo';
      this.cambiarPerfil(perfilEfectivo);

      // POLÍTICA INSTITUCIONAL RBAC:
      // Acceso Total accede directamente en modo edición sin requerir contraseña adicional.
      const esAccesoTotal = perfilEfectivo === 'total' || perfilEfectivo === 'administrador';
      if (esAccesoTotal) {
        this.modoEdicion = true;
        sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
      } else {
        this.modoEdicion = false;
        try {
          sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
          localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
        } catch { }
      }
      this.actualizarBotonModoEdicion();

      // 2. Cargar favoritos persistidos en la nube
      const favsCloud = staffService.obtenerFavoritosUsuario(usuario.identificacion);
      if (favsCloud && Array.isArray(favsCloud)) {
        this.favoritos = new Set(favsCloud);
        localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favsCloud));
        this.actualizarContadorFavoritos();
      }

      // 3. Cargar preferencia de ordenamiento guardada en la nube
      const ordenUsuario = staffService.obtenerPreferenciaOrdenamiento(usuario.identificacion);
      filterEngine.setOrdenamiento(ordenUsuario);
      if (this.el.sortSelect) {
        this.el.sortSelect.value = ordenUsuario;
      }
      this.aplicarFiltros();

      this.mostrarToast(`✅ ¡Bienvenido(a), ${usuario.nombre}! Sesión iniciada (${usuario.cargo}).`, 'success');

      // Registrar evento de auditoría
      staffService.registrarAuditoria('LOGIN', {
        usuario: usuario.nombre,
        identificacion: usuario.identificacion,
        cargo: usuario.cargo,
        perfil: perfilEfectivo,
        detalle: 'Inicio de sesión en el repositorio documental'
      });
    } else {
      this.modoEdicion = false;
      this.actualizarBotonModoEdicion();
    }
  }

  onLogout() {
    document.body.classList.add('auth-required');
    this.modoEdicion = false;
    try {
      sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
      localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
    } catch { }
    this.actualizarBotonModoEdicion();

    this.actualizarIndicadorColaborador();
    this.cambiarPerfil('operativo');
    this.mostrarToast('🚪 Sesión cerrada correctamente.', 'info');
    // Exigir login nuevamente
    modalManager.abrirModalAutenticacion(
      staffService,
      (usuario) => this.onLoginExitoso(usuario),
      () => this.onLogout(),
      true // Login obligatorio
    );
  }

  actualizarClasesPerfilBody() {
    const p = this.perfil || 'operativo';
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('perfil-operativo', 'perfil-administrativo', 'perfil-directivo', 'perfil-total', 'perfil-administrador');
      document.body.classList.add(`perfil-${p}`);
      document.body.setAttribute('data-perfil', p);
    }
  }

  actualizarIndicadorPerfil() {
    this.actualizarClasesPerfilBody();
    this.actualizarIndicadorColaborador();
  }

  actualizarVisibilidadModulos() {
    const esOperativo = this.perfil === 'operativo';
    const esAdministrativo = this.perfil === 'administrativo';
    const esDirectivo = this.perfil === 'directivo';
    const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');

    // 1. Visibilidad de la pestaña Dashboard en el selector principal del Sidebar
    // REGLA INSTITUCIONAL ESTRICTA: El perfil operativo NO tiene acceso al Dashboard bajo ninguna circunstancia
    if (this.el.btnViewAnalytics) {
      this.el.btnViewAnalytics.style.display = esOperativo ? 'none' : 'inline-flex';
    }

    // 2. Si el perfil es operativo y el usuario se encuentra en la vista Dashboard, forzar regreso inmediato a Catálogo
    if (esOperativo && this.vistaActual === 'analytics') {
      this.cambiarVista('catalog');
      return;
    }

    // 3. Menús del Dashboard en Sidebar:
    // - Resumen Documental: visible para total, directivo y administrativo
    // - Calidad: visible para total y directivo; OCULTO para administrativo y operativo
    // - Auditoría: visible para total y directivo; OCULTO para administrativo y operativo
    // - Control de Cambios: visible para total y directivo; OCULTO para administrativo y operativo
    const tieneAccesoModulosCompletos = esAccesoTotal || esDirectivo;
    if (this.el.btnSidebarDashResumen) {
      this.el.btnSidebarDashResumen.style.display = !esOperativo ? 'flex' : 'none';
    }
    if (this.el.btnSidebarDashCalidad) {
      this.el.btnSidebarDashCalidad.style.display = tieneAccesoModulosCompletos ? 'flex' : 'none';
    }
    if (this.el.btnSidebarDashAuditoria) {
      this.el.btnSidebarDashAuditoria.style.display = tieneAccesoModulosCompletos ? 'flex' : 'none';
    }
    if (this.el.btnSidebarDashCambios) {
      this.el.btnSidebarDashCambios.style.display = tieneAccesoModulosCompletos ? 'flex' : 'none';
    }

    // 4. Exportaciones del Dashboard:
    // Ocultar todos los botones de exportación y el grupo #sidebar-dash-export-group cuando el perfil sea administrativo u operativo
    const exportGroup = document.getElementById('sidebar-dash-export-group');
    if (exportGroup) {
      exportGroup.style.display = (esAdministrativo || esOperativo) ? 'none' : 'block';
    }
    if (esAdministrativo || esOperativo) {
      if (this.el.btnSidebarDashMaster) this.el.btnSidebarDashMaster.style.display = 'none';
      if (this.el.btnSidebarDashVencidos) this.el.btnSidebarDashVencidos.style.display = 'none';
      if (this.el.btnSidebarDashCalidadExport) this.el.btnSidebarDashCalidadExport.style.display = 'none';
      if (this.el.btnSidebarDashAudit) this.el.btnSidebarDashAudit.style.display = 'none';
      if (this.el.btnSidebarDashHistory) this.el.btnSidebarDashHistory.style.display = 'none';
    }
  }

  cambiarPerfil(nuevoPerfilId) {
    if (nuevoPerfilId === this.perfil) {
      // Re-verificar modo edición para asegurar congruencia RBAC
      const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
      this.modoEdicion = esAccesoTotal;
      if (!esAccesoTotal) {
        try {
          sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
          localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
        } catch { }
      }
      this.actualizarClasesPerfilBody();
      this.actualizarBotonModoEdicion();
      this.actualizarVisibilidadModulos();
      return;
    }
    this.perfil = nuevoPerfilId;
    this.actualizarClasesPerfilBody();
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, nuevoPerfilId);

    // Si hay un colaborador en sesión, guardar y sincronizar su perfil personalizado en Google Drive
    const colab = staffService.obtenerSesionActiva();
    if (colab && colab.identificacion) {
      staffService.asignarPerfilPersonalizado(colab.identificacion, nuevoPerfilId);
    }

    // POLÍTICA INSTITUCIONAL RBAC:
    // El perfil de Acceso Total activa directamente el modo edición sin requerir contraseña
    const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
    this.modoEdicion = esAccesoTotal;
    if (esAccesoTotal) {
      sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
    } else {
      try {
        sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
        localStorage.removeItem(STORAGE_KEY_EDIT_MODE);
      } catch { }
    }

    filterEngine.setPerfil(nuevoPerfilId);
    filterEngine.limpiarFiltros();
    this.actualizarIndicadorPerfil();
    this.actualizarIndicadorColaborador();
    this.actualizarBotonModoEdicion();
    this.actualizarVisibilidadModulos();
    this.aplicarFiltros();
    if (this.vistaActual === 'analytics') {
      if (nuevoPerfilId === 'operativo') {
        this.cambiarVista('catalog');
      } else {
        const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
        analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
        if (nuevoPerfilId === 'administrativo') {
          analyticsManager.cambiarPestana('resumen');
        }
      }
    }
    const nombres = {
      total: 'Acceso Total',
      administrador: 'Acceso Total',
      operativo: 'Operativo',
      administrativo: 'Administrativo',
      directivo: 'Directivo'
    };
    this.mostrarToast(`✅ Perfil cambiado a "${nombres[nuevoPerfilId] || nuevoPerfilId}".`, 'success');
  }

  abrirModalConfiguracion() {
    modalManager.abrirConfiguracion({
      perfilActual: this.perfil,
      modoEdicion: this.modoEdicion,
      documentos: this.documentos,
      vistaCatalogoActual: this.vistaCatalogo,
      onCambiarPerfil: (nuevoPerfil) => this.cambiarPerfil(nuevoPerfil),
      onToggleModoEdicion: (nuevoEstado) => this.toggleModoEdicion(nuevoEstado),
      onCambiarVista: (nuevaVista) => {
        this.vistaCatalogo = nuevaVista;
        this.aplicarFiltros();
      },
      onActualizarFiltrosPorDefecto: (filtros) => {
        filterEngine.estado.tiposProceso.clear();
        if (filtros.tipoProceso) filterEngine.estado.tiposProceso.add(filtros.tipoProceso);

        filterEngine.estado.areas.clear();
        if (filtros.area) filterEngine.estado.areas.add(filtros.area);

        filterEngine.estado.procesos.clear();
        if (filtros.proceso) filterEngine.estado.procesos.add(filtros.proceso);

        this.aplicarFiltros();
      },
      onSincronizar: () => this.refrescarDatosManualmente()
    });
  }

  toggleModoEdicion(forzarEstado = null) {
    if (this.perfil === 'operativo') {
      this.modoEdicion = false;
      this.actualizarBotonModoEdicion();
      this.actualizarVisibilidadModulos();
      this.mostrarToast('🔒 El personal operativo solo tiene permisos de descarga de archivos en el catálogo.', 'info');
      return;
    }

    if (forzarEstado !== null && typeof forzarEstado === 'boolean') {
      this.modoEdicion = forzarEstado;
      if (this.modoEdicion) {
        sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
        this.actualizarBotonModoEdicion();
        this.actualizarVisibilidadModulos();
        this.aplicarFiltros();
        this.mostrarToast('🔓 ¡Modo edición activado!', 'success');
      } else {
        sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
        this.actualizarBotonModoEdicion();
        this.actualizarVisibilidadModulos();
        this.aplicarFiltros();
        this.mostrarToast('🔒 Modo edición bloqueado. Modo descarga activo.', 'info');
      }
      return;
    }

    if (this.modoEdicion) {
      this.modoEdicion = false;
      sessionStorage.removeItem(STORAGE_KEY_EDIT_MODE);
      this.actualizarBotonModoEdicion();
      this.actualizarVisibilidadModulos();
      this.aplicarFiltros();
      this.mostrarToast('🔒 Modo edición bloqueado. Modo descarga activo.', 'info');
    } else {
      const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
      if (esAccesoTotal) {
        // Acceso Total activa directamente sin pedir contraseña adicional
        this.modoEdicion = true;
        sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
        this.actualizarBotonModoEdicion();
        this.actualizarVisibilidadModulos();
        this.aplicarFiltros();
        this.mostrarToast('🔓 ¡Modo edición activado! Permisos completos habilitados.', 'success');
      } else {
        // Perfil Administrativo o Directivo: requiere contraseña de ingreso
        modalManager.abrirModalPasswordEdicion(() => {
          this.modoEdicion = true;
          sessionStorage.setItem(STORAGE_KEY_EDIT_MODE, 'true');
          this.actualizarBotonModoEdicion();
          this.actualizarVisibilidadModulos();
          this.aplicarFiltros();
          this.mostrarToast('🔓 ¡Modo edición activado!', 'success');
        });
      }
    }
  }

  cambiarVista(vista) {
    if (vista === 'analytics' && this.perfil === 'operativo') {
      this.mostrarToast('🔒 El módulo Dashboard no está disponible para el perfil Operativo.', 'info');
      vista = 'catalog';
    }

    this.vistaActual = vista;
    const titleEl = document.querySelector('.filters-active-title');
    if (vista === 'catalog') {
      this.el.btnViewCatalog?.classList.add('active');
      this.el.btnViewAnalytics?.classList.remove('active');
      if (this.el.viewCatalog) this.el.viewCatalog.style.display = 'block';
      if (this.el.viewAnalytics) this.el.viewAnalytics.style.display = 'none';
      if (this.el.sidebar) this.el.sidebar.style.display = 'flex';
      if (this.el.sidebarQuickAccess) this.el.sidebarQuickAccess.style.display = 'block';
      if (this.el.sidebarCatalogContent) this.el.sidebarCatalogContent.style.display = 'flex';
      if (this.el.sidebarCatalogFooter) this.el.sidebarCatalogFooter.style.display = 'block';
      if (this.el.sidebarDashboardContent) this.el.sidebarDashboardContent.style.display = 'none';
      if (this.el.contentToolbarRow) this.el.contentToolbarRow.style.display = 'flex';
      if (this.el.footerFilters) this.el.footerFilters.style.display = 'flex';
      if (this.el.footerBottomRow) this.el.footerBottomRow.style.display = 'flex';
      if (this.el.chipsContainer) this.el.chipsContainer.style.display = 'flex';
      if (titleEl) titleEl.style.display = 'inline-block';
      this.actualizarBotonModoEdicion();
    } else {
      this.el.btnViewAnalytics?.classList.add('active');
      this.el.btnViewCatalog?.classList.remove('active');
      if (this.el.viewCatalog) this.el.viewCatalog.style.display = 'none';
      if (this.el.viewAnalytics) this.el.viewAnalytics.style.display = 'block';
      if (this.el.sidebar) this.el.sidebar.style.display = 'flex';
      if (this.el.sidebarQuickAccess) this.el.sidebarQuickAccess.style.display = 'none';
      if (this.el.sidebarCatalogContent) this.el.sidebarCatalogContent.style.display = 'none';
      if (this.el.sidebarCatalogFooter) this.el.sidebarCatalogFooter.style.display = 'none';
      if (this.el.sidebarDashboardContent) this.el.sidebarDashboardContent.style.display = 'flex';
      if (this.el.contentToolbarRow) this.el.contentToolbarRow.style.display = 'none';
      if (this.el.footerFilters) this.el.footerFilters.style.display = 'none';
      if (this.el.footerBottomRow) this.el.footerBottomRow.style.display = 'none';
      if (this.el.chipsContainer) this.el.chipsContainer.style.display = 'none';
      if (titleEl) titleEl.style.display = 'none';
      this.actualizarBotonModoEdicion();
      this.actualizarVisibilidadModulos();

      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
      analyticsManager.cambiarPestana('resumen');
    }
  }

  toggleFavorito(docId) {
    if (this.favoritos.has(docId)) {
      this.favoritos.delete(docId);
    } else {
      this.favoritos.add(docId);
    }
    const arrFavs = Array.from(this.favoritos);
    localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(arrFavs));

    // Sincronizar en la nube con Google Drive
    const colab = staffService.obtenerSesionActiva();
    if (colab && colab.identificacion) {
      staffService.guardarFavoritosUsuario(colab.identificacion, arrFavs);
    }

    this.actualizarContadorFavoritos();
    this.aplicarFiltros(true);
  }

  actualizarContadorFavoritos() {
    if (this.el.favCountBadge) {
      this.el.favCountBadge.textContent = this.favoritos.size;
    }
  }

  actualizarBotonModoEdicion() {
    // REGLA: El botón "➕ Nuevo Documento" aparece SOLO cuando el Modo Edición está activo y el perfil es Acceso Total o Directivo
    const esAccesoTotal = Boolean(this.perfil === 'total' || this.perfil === 'administrador');
    const esDirectivo = Boolean(this.perfil === 'directivo');
    const esVistaCatalogo = this.vistaActual !== 'analytics';
    const puedeCrearDocs = (esAccesoTotal || esDirectivo) && Boolean(this.modoEdicion) && esVistaCatalogo;
    if (this.el.btnNuevoDoc) {
      this.el.btnNuevoDoc.style.display = puedeCrearDocs ? 'inline-flex' : 'none';
    }

    if (!this.el.btnToggleEdit) return;

    // REGLA INSTITUCIONAL ESTRICTA: Personal operativo NUNCA visualiza ni tiene acceso al botón de desbloqueo/edición
    const esOperativo = this.perfil === 'operativo';
    if (esOperativo) {
      this.modoEdicion = false;
      this.el.btnToggleEdit.style.setProperty('display', 'none', 'important');
      this.el.btnToggleEdit.classList.remove('active');
      this.el.btnToggleEdit.classList.add('hidden-by-profile');
      if (this.el.editLockIcon) this.el.editLockIcon.textContent = '🔒';
      if (this.el.editModeText) this.el.editModeText.textContent = 'Modo Edición';
      return;
    }

    this.el.btnToggleEdit.classList.remove('hidden-by-profile');
    this.el.btnToggleEdit.style.removeProperty('display');
    this.el.btnToggleEdit.style.display = 'inline-flex';

    if (this.modoEdicion) {
      this.el.btnToggleEdit.classList.add('active');
      if (this.el.editLockIcon) this.el.editLockIcon.textContent = '🔓';
      if (this.el.editModeText) this.el.editModeText.textContent = 'Edición Activa';
      this.el.btnToggleEdit.title = '🔓 Modo Edición Activo. Clic para bloquear y volver a modo descarga.';
    } else {
      this.el.btnToggleEdit.classList.remove('active');
      if (this.el.editLockIcon) this.el.editLockIcon.textContent = '🔒';
      if (this.el.editModeText) this.el.editModeText.textContent = 'Modo Edición';
      this.el.btnToggleEdit.title = '🔒 Modo Descarga. Clic para ingresar tu contraseña de acceso y activar el modo edición.';
    }
  }

  async refrescarDatosManualmente() {
    const icon = this.el.refreshIcon || document.getElementById('header-sync-icon');
    if (icon) {
      icon.classList.add('spinning');
    }
    this.mostrarToast('Consultando cambios en tiempo real en OneDrive / SharePoint...', 'info');

    try {
      const [docsActualizados] = await Promise.all([
        sharepointService.obtenerDocumentos(true),
        staffService.sincronizarConfiguracion(),
        staffService.sincronizarEmpleados()
      ]);

      if (docsActualizados && docsActualizados.length > 0) {
        this.documentos = docsActualizados;

        // Detectar y registrar cambios en el histórico documental
        const sesion = staffService.obtenerSesionActiva();
        const numCambios = staffService.detectarYRegistrarCambiosDocumentales(this.documentos, sesion);

        this.aplicarFiltros(true);
        if (this.vistaActual === 'analytics') {
          const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
          analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
        }
        if (numCambios > 0) {
          this.mostrarToast(`✅ Sincronizado. Se registraron ${numCambios} novedades en el Histórico Documental.`, 'success');
        } else {
          this.mostrarToast(`✅ Datos sincronizados con éxito (${this.documentos.length} documentos cargados).`, 'success');
        }
      } else {
        this.mostrarToast('Catálogo verificado. No se detectaron cambios.', 'info');
      }
    } catch (e) {
      this.mostrarToast(`Error al sincronizar: ${e.message}`, 'error');
    } finally {
      if (icon) {
        setTimeout(() => icon.classList.remove('spinning'), 600);
      }
    }
  }

  /**
   * Captura con precisión milimétrica las posiciones de scroll de todos los contenedores scrolleables
   */
  capturarPosicionScroll() {
    const tableCont = this.el.grid?.querySelector('.documents-table-container');
    const gridCont = this.el.viewCatalog || document.getElementById('documents-grid-container');
    const sidebarCont = this.el.sidebarCatalogContent || document.getElementById('sidebar-catalog-filters-content');
    const sidebarGen = this.el.sidebar || document.getElementById('sidebar-filters');

    return {
      tableScrollTop: tableCont ? tableCont.scrollTop : 0,
      tableScrollLeft: tableCont ? tableCont.scrollLeft : 0,
      gridContainerScrollTop: gridCont ? gridCont.scrollTop : 0,
      gridContainerScrollLeft: gridCont ? gridCont.scrollLeft : 0,
      gridScrollTop: this.el.grid ? this.el.grid.scrollTop : 0,
      sidebarCatalogScrollTop: sidebarCont ? sidebarCont.scrollTop : 0,
      sidebarScrollTop: sidebarGen ? sidebarGen.scrollTop : 0,
      windowScrollY: window.scrollY || window.pageYOffset || 0,
      windowScrollX: window.scrollX || window.pageXOffset || 0
    };
  }

  /**
   * Restaura con exactitud las posiciones de scroll capturadas, evitando cualquier salto visual
   */
  restaurarPosicionScroll(pos) {
    if (!pos) return;

    const aplicarScrolls = () => {
      const tableCont = this.el.grid?.querySelector('.documents-table-container');
      if (tableCont) {
        if (pos.tableScrollTop > 0) tableCont.scrollTop = pos.tableScrollTop;
        if (pos.tableScrollLeft > 0) tableCont.scrollLeft = pos.tableScrollLeft;
      }

      const gridCont = this.el.viewCatalog || document.getElementById('documents-grid-container');
      if (gridCont) {
        if (pos.gridContainerScrollTop > 0) gridCont.scrollTop = pos.gridContainerScrollTop;
        if (pos.gridContainerScrollLeft > 0) gridCont.scrollLeft = pos.gridContainerScrollLeft;
      }

      if (this.el.grid && pos.gridScrollTop > 0) {
        this.el.grid.scrollTop = pos.gridScrollTop;
      }

      const sidebarCont = this.el.sidebarCatalogContent || document.getElementById('sidebar-catalog-filters-content');
      if (sidebarCont && pos.sidebarCatalogScrollTop > 0) {
        sidebarCont.scrollTop = pos.sidebarCatalogScrollTop;
      }

      const sidebarGen = this.el.sidebar || document.getElementById('sidebar-filters');
      if (sidebarGen && pos.sidebarScrollTop > 0) {
        sidebarGen.scrollTop = pos.sidebarScrollTop;
      }

      if (pos.windowScrollY > 0 || pos.windowScrollX > 0) {
        window.scrollTo({ top: pos.windowScrollY, left: pos.windowScrollX, behavior: 'instant' });
      }
    };

    // Aplicación inmediata tras renderizado
    aplicarScrolls();

    // Verificación en el siguiente tick de renderizado para garantizar sincronía total con el layout del navegador
    requestAnimationFrame(() => {
      aplicarScrolls();
    });
  }

  /**
   * Calcula una firma canónica determinista de la colección de documentos para evitar re-renderizados innecesarios
   */
  calcularFirmaDocumental(documentos) {
    if (!Array.isArray(documentos) || documentos.length === 0) return '';
    return documentos
      .slice()
      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
      .map((d) => `${d.codigo || ''}|${d.version || ''}|${d.modificacion || ''}|${d.disponible ? 1 : 0}|${d.descargable !== false ? 1 : 0}|${d.titulo || ''}|${d.proceso || ''}|${d.area || ''}|${d.tipoDocumento || ''}|${d.tipoProceso || ''}|${d.downloadUrl || ''}|${d.sharepointUrl || ''}`)
      .join(';;');
  }

  iniciarSincronizacionInteligente() {
    this.ultimaSincronizacionFondo = Date.now();

    // Polling inteligente optimizado cada 5 minutos (300,000 ms), únicamente si la pestaña está visible
    if (this.intervaloSincronizacion) clearInterval(this.intervaloSincronizacion);
    this.intervaloSincronizacion = setInterval(() => {
      if (document.hidden) return; // Si la pestaña está inactiva o minimizada, no realizar peticiones
      this.sincronizarInteligenteSilenciosa();
    }, 300000);

    // Al alternar o reenfocar la ventana, sincronizar silenciosamente solo si han transcurrido más de 3 minutos
    const verificarAlEnfocar = () => {
      if (document.hidden) return;
      const ahora = Date.now();
      if (ahora - (this.ultimaSincronizacionFondo || 0) > 180000) {
        this.sincronizarInteligenteSilenciosa();
      }
    };

    window.addEventListener('focus', verificarAlEnfocar);
    document.addEventListener('visibilitychange', verificarAlEnfocar);
  }

  async sincronizarInteligenteSilenciosa() {
    this.ultimaSincronizacionFondo = Date.now();
    try {
      // 1. Sincronizar configuraciones y empleados de forma asíncrona
      await Promise.all([
        staffService.sincronizarConfiguracion(),
        staffService.sincronizarEmpleados()
      ]);

      // 2. Consultar catálogo de documentos
      const nuevos = await sharepointService.obtenerDocumentos(false);
      if (!nuevos || nuevos.length === 0) return;

      // 3. Comparación canónica profunda de firmas (evita re-renderizados si no hay cambios externos)
      const firmaActual = this.calcularFirmaDocumental(this.documentos);
      const firmaNueva = this.calcularFirmaDocumental(nuevos);

      if (firmaActual === firmaNueva) {
        // Ningún documento cambió externamente: mantener UI 100% intacta sin tocar DOM ni scroll
        return;
      }

      // Si el usuario está scrolleando o interactuando activamente, posponer la actualización brevemente para no interrumpirlo
      if (Date.now() - (this.ultimoScrollUsuario || 0) < 2000) {
        if (this._timeoutSyncPospuesta) clearTimeout(this._timeoutSyncPospuesta);
        this._timeoutSyncPospuesta = setTimeout(() => {
          this.sincronizarInteligenteSilenciosa();
        }, 2000);
        return;
      }

      console.log('[Sincronización Inteligente] Cambios detectados en SharePoint/Google Sheets. Actualizando vista sin alterar la navegación...');
      this.documentos = nuevos;

      // Detectar y registrar cambios en el histórico
      const sesion = staffService.obtenerSesionActiva();
      staffService.detectarYRegistrarCambiosDocumentales(this.documentos, sesion);

      // 4. Actualización fluida preservando milimétricamente la posición de scroll
      if (this.vistaActual === 'catalog') {
        this.aplicarFiltros(true);
      } else if (this.vistaActual === 'analytics') {
        const scrollInfo = this.capturarPosicionScroll();
        const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
        analyticsManager.actualizarDatosSilencioso(docsPerfil, this.perfil, this.documentos);
        this.restaurarPosicionScroll(scrollInfo);
      }
    } catch (e) {
      console.warn('[Sincronización Inteligente] Verificación de fondo:', e);
    }
  }

  actualizarSidebar() {
    const top10Docs = staffService.obtenerTop10DocumentosOrdenados(this.documentos);
    const top10Set = new Set(top10Docs.map((d) => d.id));
    const { tiposProceso, areas, procesos, tiposDocumento, conteos } =
      filterEngine.obtenerOpcionesRelacionadas(this.documentos, null, this.favoritos, top10Set);

    // 1. TIPOS DE PROCESO
    if (this.el.listaTiposProceso) {
      if (!tiposProceso || tiposProceso.length === 0) {
        this.el.listaTiposProceso.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8; padding:4px 8px;">No hay tipos de proceso disponibles</span>';
      } else {
        this.el.listaTiposProceso.innerHTML = tiposProceso
          .map((tp) => {
            const checked = Array.from(filterEngine.estado.tiposProceso).some((t) => filterEngine.normalizarTipoProceso(t) === filterEngine.normalizarTipoProceso(tp)) ? 'checked' : '';
            const cnt = conteos?.tiposProceso?.[tp] ?? 0;
            return `
              <label class="filter-checkbox-label" title="${tp} (${cnt} documentos)">
                <div class="filter-checkbox-label-content">
                  <input type="checkbox" class="custom-checkbox chk-tipo-proceso" value="${tp}" ${checked} />
                  <span>${tp}</span>
                </div>
                <span class="filter-count-badge">${cnt}</span>
              </label>`;
          })
          .join('');
      }
    }

    // 2. ÁREAS
    if (this.el.listaAreas) {
      if (!areas || areas.length === 0) {
        this.el.listaAreas.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8; padding:4px 8px;">No hay áreas disponibles</span>';
      } else {
        this.el.listaAreas.innerHTML = areas
          .map((a) => {
            const checked = filterEngine.estado.areas.has(a) ? 'checked' : '';
            const cnt = conteos?.areas?.[a] ?? 0;
            return `
              <label class="filter-checkbox-label" title="${a} (${cnt} documentos)">
                <div class="filter-checkbox-label-content">
                  <input type="checkbox" class="custom-checkbox chk-area" value="${a}" ${checked} />
                  <span>${a}</span>
                </div>
                <span class="filter-count-badge">${cnt}</span>
              </label>`;
          })
          .join('');
      }
    }

    // 3. PROCESOS (Previamente Carpeta)
    if (this.el.listaProcesos) {
      if (!procesos || procesos.length === 0) {
        this.el.listaProcesos.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8; padding:4px 8px;">No hay procesos disponibles</span>';
      } else {
        this.el.listaProcesos.innerHTML = procesos
          .map((p) => {
            const checked = filterEngine.estado.procesos.has(p) ? 'checked' : '';
            const cnt = conteos?.procesos?.[p] ?? 0;
            return `
              <label class="filter-checkbox-label" title="${p} (${cnt} documentos)">
                <div class="filter-checkbox-label-content">
                  <input type="checkbox" class="custom-checkbox chk-proceso" value="${p}" ${checked} />
                  <span>${p}</span>
                </div>
                <span class="filter-count-badge">${cnt}</span>
              </label>`;
          })
          .join('');
      }
    }

    // 4. TIPOS DE DOCUMENTO
    if (this.el.listaTipos) {
      if (!tiposDocumento || tiposDocumento.length === 0) {
        this.el.listaTipos.innerHTML = '<span style="font-size:0.75rem; color:#94a3b8; padding:4px 8px;">No hay tipos disponibles</span>';
      } else {
        this.el.listaTipos.innerHTML = tiposDocumento
          .map((t) => {
            const checked = filterEngine.estado.tiposDocumento.has(t) ? 'checked' : '';
            const cnt = conteos?.tiposDocumento?.[t] ?? 0;
            return `
              <label class="filter-checkbox-label" title="${t} (${cnt} documentos)">
                <div class="filter-checkbox-label-content">
                  <input type="checkbox" class="custom-checkbox chk-tipo" value="${t}" ${checked} />
                  <span>${t}</span>
                </div>
                <span class="filter-count-badge">${cnt}</span>
              </label>`;
          })
          .join('');
      }
    }
  }

  /**
   * Renderiza sugerencias inteligentes al escribir en la barra de búsqueda (solo código y nombre del documento)
   */
  mostrarSugerenciasBusqueda(termino) {
    if (!this.el.searchSuggestions) return;
    const q = (termino || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (q.length < 2) {
      this.el.searchSuggestions.style.display = 'none';
      return;
    }

    // Respetar los filtros activos actuales (perfil, tipo de proceso, área, proceso, tipo de documento, formato, favoritos)
    const docsBase = filterEngine.obtenerDocumentosFiltradosSinBusqueda
      ? filterEngine.obtenerDocumentosFiltradosSinBusqueda(this.documentos, null, this.favoritos)
      : this.documentos;

    const coincidencias = docsBase
      .filter((d) => {
        const texto = `${d.codigo || ''} ${d.titulo || ''}`
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return texto.includes(q);
      })
      .slice(0, 6);

    if (coincidencias.length === 0) {
      this.el.searchSuggestions.style.display = 'none';
      return;
    }

    this.el.searchSuggestions.innerHTML = coincidencias
      .map(
        (doc) => `
        <div class="suggestion-item" data-id="${doc.id}">
          <div class="suggestion-left">
            <span class="suggestion-code">${doc.codigo}</span>
            <span class="suggestion-title">${doc.titulo}</span>
          </div>
          <span class="suggestion-meta">${doc.area}</span>
        </div>`
      )
      .join('');

    this.el.searchSuggestions.style.display = 'block';

    this.el.searchSuggestions.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        const doc = this.documentos.find((d) => d.id === item.dataset.id);
        if (doc) {
          this.el.searchInput.value = doc.codigo;
          filterEngine.setBusqueda(doc.codigo);
          this.el.searchSuggestions.style.display = 'none';
          this.aplicarFiltros();
        }
      });
    });
  }

  bindEvents() {
    // Switcher de Vistas (Integrado en Sidebar)
    this.el.btnViewCatalog?.addEventListener('click', () => this.cambiarVista('catalog'));
    this.el.btnViewAnalytics?.addEventListener('click', () => this.cambiarVista('analytics'));

    // Acciones del Dashboard en Sidebar
    this.el.btnSidebarDashResumen?.addEventListener('click', () => {
      analyticsManager.cambiarPestana('resumen');
    });

    this.el.btnSidebarDashCalidad?.addEventListener('click', () => {
      analyticsManager.cambiarPestana('calidad');
    });

    this.el.btnSidebarDashAuditoria?.addEventListener('click', () => {
      analyticsManager.cambiarPestana('auditoria');
    });

    this.el.btnSidebarDashCambios?.addEventListener('click', () => {
      analyticsManager.cambiarPestana('cambios');
    });

    this.el.btnSidebarDashMaster?.addEventListener('click', () => {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.descargarListadoMaestro(docsPerfil);
    });

    this.el.btnSidebarDashVencidos?.addEventListener('click', () => {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.descargarDocumentosVencidos(docsPerfil);
    });

    this.el.btnSidebarDashCalidadExport?.addEventListener('click', () => {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.exportarMatrizCalidadCSV(docsPerfil);
    });

    this.el.btnSidebarDashAudit?.addEventListener('click', () => {
      analyticsManager.exportarAuditoriaCSV();
    });

    this.el.btnSidebarDashHistory?.addEventListener('click', () => {
      const csvContent = staffService.exportarHistoricoDocumentalCSV('TODOS');
      if (!csvContent) {
        this.mostrarToast('No hay registros de control de cambios documentales para exportar.', 'info');
        return;
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fecha = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `CONTROL_CAMBIOS_DOCUMENTALES_USV_${fecha}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    // Botón de Actualizar Datos
    this.el.btnRefresh?.addEventListener('click', () => this.refrescarDatosManualmente());

    // Secciones Colapsables (Accordion Global)
    document.addEventListener('click', (e) => {
      const header = e.target.closest('.filter-section-header');
      if (header) {
        e.preventDefault();
        e.stopPropagation();
        const section = header.closest('.filter-group-section');
        if (section) {
          const isNowCollapsed = section.classList.toggle('collapsed');
          header.setAttribute('aria-expanded', String(!isNowCollapsed));
        }
      }
    });

    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-input-wrapper')) {
        if (this.el.searchSuggestions) this.el.searchSuggestions.style.display = 'none';
      }
    });

    // Abrir Modal de Autenticación / Sesión de Colaborador
    this.el.btnStaffPill?.addEventListener('click', () => {
      modalManager.abrirModalAutenticacion(
        staffService,
        (usuario) => this.onLoginExitoso(usuario),
        () => this.onLogout()
      );
    });

    // Abrir Modal de Configuración y Perfiles
    this.el.btnProfilePill?.addEventListener('click', () => this.abrirModalConfiguracion());
    this.el.btnOpenSettings?.addEventListener('click', () => this.abrirModalConfiguracion());

    // Alternar Modo Edición
    this.el.btnToggleEdit?.addEventListener('click', () => this.toggleModoEdicion());

    // Botón Actualizar / Sincronizar Datos en Vivo (🔄)
    this.el.btnRefresh?.addEventListener('click', async () => {
      this.mostrarToast('🔄 Sincronizando catálogo institucional y personal...', 'info');
      if (this.el.refreshIcon) {
        this.el.refreshIcon.classList.add('spinning');
      }
      try {
        await Promise.all([
          staffService.sincronizarConfiguracion(),
          staffService.sincronizarEmpleados(),
          this.cargarDatos(true)
        ]);
        this.mostrarToast('✅ Catálogo y personal sincronizados exitosamente.', 'success');
      } catch (err) {
        this.mostrarToast('⚠️ Sincronización parcial completada.', 'warning');
      } finally {
        if (this.el.refreshIcon) {
          this.el.refreshIcon.classList.remove('spinning');
        }
      }
    });

    // Crear Nuevo Documento Institucional (Acceso Total / Admin)
    this.el.btnNuevoDoc?.addEventListener('click', () => {
      modalManager.abrirModalNuevoDocumento({
        onGuardar: (nuevoDoc) => {
          this.agregarNuevoDocumentoEnApp(nuevoDoc);
          this.mostrarToast(`✅ Documento ${nuevoDoc.codigo} creado y registrado en el catálogo maestro`, 'success');
        }
      });
    });

    // Búsqueda inteligente con autocompletado y tecla Enter
    let debounceSearchAudit = null;
    this.el.searchInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      filterEngine.setBusqueda(val);
      this.el.searchClear?.classList.toggle('visible', val.length > 0);
      this.mostrarSugerenciasBusqueda(val);
      this.aplicarFiltros();
    });

    this.el.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (this.el.searchSuggestions) {
          this.el.searchSuggestions.style.display = 'none';
        }
        const val = this.el.searchInput.value;
        filterEngine.setBusqueda(val);
        this.aplicarFiltros();
      } else if (e.key === 'Escape') {
        if (this.el.searchSuggestions) {
          this.el.searchSuggestions.style.display = 'none';
        }
      }
    });

    this.el.searchClear?.addEventListener('click', () => {
      this.el.searchInput.value = '';
      filterEngine.setBusqueda('');
      this.el.searchClear.classList.remove('visible');
      if (this.el.searchSuggestions) this.el.searchSuggestions.style.display = 'none';
    });

    // Filtros rápidos de Formato (Todos, Excel, PDF, Word)
    this.el.formatBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.el.formatBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filterEngine.setFormato(btn.getAttribute('data-format'));
        this.aplicarFiltros();
      });
    });

    // Filtro rápido de Top 10 en Sidebar 🔥
    const toggleFiltroTop10 = () => {
      const activo = !filterEngine.estado.soloTop10;
      if (activo) {
        filterEngine.setSoloFavoritos(false);
        this.el.btnSidebarFavs?.classList.remove('active');
      }
      filterEngine.setSoloTop10(activo);
      this.el.btnSidebarTop10?.classList.toggle('active', activo);
      this.aplicarFiltros();
    };

    this.el.btnSidebarTop10?.addEventListener('click', toggleFiltroTop10);

    // Filtro rápido de Favoritos en Sidebar ⭐
    const toggleFiltroFavoritos = () => {
      const activo = !filterEngine.estado.soloFavoritos;
      if (activo) {
        filterEngine.setSoloTop10(false);
        this.el.btnSidebarTop10?.classList.remove('active');
      }
      filterEngine.setSoloFavoritos(activo);
      this.el.btnSidebarFavs?.classList.toggle('active', activo);
      this.aplicarFiltros();
    };

    this.el.btnSidebarFavs?.addEventListener('click', toggleFiltroFavoritos);

    // Checkboxes del Sidebar
    this.el.listaTiposProceso?.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-tipo-proceso')) {
        filterEngine.toggleTipoProceso(e.target.value);
        this.aplicarFiltros();
      }
    });
    this.el.listaAreas?.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-area')) {
        filterEngine.toggleArea(e.target.value);
        this.aplicarFiltros();
      }
    });
    this.el.listaProcesos?.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-proceso')) {
        filterEngine.toggleProceso(e.target.value);
        this.aplicarFiltros();
      }
    });
    this.el.listaTipos?.addEventListener('change', (e) => {
      if (e.target.classList.contains('chk-tipo')) {
        filterEngine.toggleTipoDocumento(e.target.value);
        this.aplicarFiltros();
      }
    });

    // Botón Restablecer Filtros
    this.el.btnReset?.addEventListener('click', () => this.resetearFiltros());

    // Selector de Ordenamiento
    this.el.sortSelect?.addEventListener('change', (e) => {
      const nuevoOrden = e.target.value;
      filterEngine.setOrdenamiento(nuevoOrden);
      this.aplicarFiltros();

      // Guardar y sincronizar preferencia en usuarios.conf (Google Drive)
      const colab = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
      if (colab && colab.identificacion) {
        staffService.guardarPreferenciaOrdenamiento(colab.identificacion, nuevoOrden);
      } else {
        staffService.guardarPreferenciaOrdenamientoGlobal(nuevoOrden);
      }
    });
  }

  mostrarToast(mensaje, tipo = 'info') {
    const toast = document.createElement('div');
    toast.className = `app-toast toast-${tipo}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 50);
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  resetearFiltros() {
    filterEngine.restablecerFiltros();
    if (this.el.searchInput) this.el.searchInput.value = '';
    this.el.searchClear?.classList.remove('visible');
    if (this.el.searchSuggestions) this.el.searchSuggestions.style.display = 'none';
    this.el.formatBtns?.forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-format') === 'TODOS');
    });
    this.el.btnSidebarTop10?.classList.remove('active');
    this.el.btnSidebarFavs?.classList.remove('active');
    if (this.el.sortSelect) this.el.sortSelect.value = 'codigo-asc';
    this.aplicarFiltros();
  }

  aplicarFiltros(preservarScroll = false) {
    const scrollInfo = preservarScroll ? this.capturarPosicionScroll() : null;

    this.actualizarSidebar();
    if (this.el.btnSidebarTop10) {
      this.el.btnSidebarTop10.classList.toggle('active', Boolean(filterEngine.estado.soloTop10));
    }
    if (this.el.btnSidebarFavs) {
      this.el.btnSidebarFavs.classList.toggle('active', Boolean(filterEngine.estado.soloFavoritos));
    }
    const top10Docs = staffService.obtenerTop10DocumentosOrdenados(this.documentos);
    const top10Set = new Set(top10Docs.map((d) => d.id));
    const top10RankingMap = new Map(top10Docs.map((d) => [d.id, d.topRanking]));
    const filtrados = filterEngine.filtrar(this.documentos, null, this.favoritos, top10Set, top10RankingMap);
    this.renderizarDocumentos(filtrados);
    if (this.el.totalCount) this.el.totalCount.textContent = filtrados.length;
    this.renderizarChips();

    if (preservarScroll && scrollInfo) {
      this.restaurarPosicionScroll(scrollInfo);
    }
  }

  renderizarDocumentos(docs) {
    if (!this.el.grid) return;
    if (docs.length === 0) {
      const tieneSecundarios = filterEngine.tieneFiltrosSecundariosActivos();
      const esTop10 = Boolean(filterEngine.estado.soloTop10);
      const esFavs = Boolean(filterEngine.estado.soloFavoritos);

      let icono = '🔍';
      let titulo = 'No se encontraron documentos';
      let subtitulo = 'Intenta cambiar los filtros seleccionados o el término de búsqueda.';
      let botonesHtml = `
        <button class="btn btn-primary" style="margin-top:8px;" id="btn-empty-reset">Restablecer filtros</button>
      `;

      if (esTop10 && tieneSecundarios) {
        icono = '🏆';
        titulo = 'No hay coincidencias en el Top 10';
        subtitulo = 'Ninguno de los 10 documentos más consultados coincide con los filtros activos seleccionados (búsqueda o categorías).';
        botonesHtml = `
          <div style="display:flex; justify-content:center; margin-top:12px;">
            <button class="btn btn-primary" id="btn-empty-omitir" style="background:#f59e0b; border-color:#d97706; color:#ffffff; font-weight:700; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(245,158,11,0.3); padding:8px 18px;">
              <span>🏆</span> Ver los 10 documentos del Top 10 completo <span style="font-weight:500; font-size:0.85em; opacity:0.95;">(se eliminarán los otros filtros activos)</span>
            </button>
          </div>
        `;
      } else if (esFavs && tieneSecundarios) {
        icono = '⭐';
        titulo = 'No hay coincidencias en tus Favoritos';
        subtitulo = 'Ninguno de tus documentos favoritos coincide con los filtros activos seleccionados (búsqueda o categorías).';
        botonesHtml = `
          <div style="display:flex; justify-content:center; margin-top:12px;">
            <button class="btn btn-primary" id="btn-empty-omitir" style="background:#eab308; border-color:#ca8a04; color:#ffffff; font-weight:700; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 4px rgba(234,179,8,0.3); padding:8px 18px;">
              <span>⭐</span> Ver todos mis Favoritos <span style="font-weight:500; font-size:0.85em; opacity:0.95;">(se eliminarán los otros filtros activos)</span>
            </button>
          </div>
        `;
      } else if (esFavs && this.favoritos.size === 0) {
        icono = '⭐';
        titulo = 'No tienes documentos favoritos aún';
        subtitulo = 'Haz clic en la estrella (★) de cualquier tarjeta del catálogo para guardarla aquí como favorito.';
        botonesHtml = `
          <button class="btn btn-primary" style="margin-top:8px;" id="btn-empty-reset">Ver catálogo general</button>
        `;
      }

      this.el.grid.innerHTML = `
        <div class="empty-results-box" style="padding:36px 20px; text-align:center;">
          <div class="empty-results-icon" style="font-size:2.5rem; margin-bottom:8px;">${icono}</div>
          <div class="empty-results-title" style="font-size:1.15rem; font-weight:800; color:var(--brand-navy); margin-bottom:6px;">${titulo}</div>
          <div class="empty-results-subtitle" style="font-size:0.88rem; color:#64748b; max-width:520px; margin:0 auto 12px auto; line-height:1.4;">${subtitulo}</div>
          ${botonesHtml}
        </div>`;

      document.getElementById('btn-empty-reset')?.addEventListener('click', () => this.resetearFiltros());
      document.getElementById('btn-empty-omitir')?.addEventListener('click', () => {
        filterEngine.limpiarFiltrosSecundarios();
        if (this.el.searchInput) this.el.searchInput.value = '';
        this.el.formatBtns?.forEach((b) => b.classList.toggle('active', b.getAttribute('data-format') === 'TODOS'));
        this.aplicarFiltros();
      });
      return;
    }

    const conteoDescargas = staffService.obtenerConteoDescargasDocumentos();
    const top10Docs = staffService.obtenerTop10DocumentosOrdenados(this.documentos);
    const top10RankingMap = new Map(top10Docs.map((d) => [d.id, d.topRanking]));

    if (this.vistaCatalogo === 'tabla') {
      this.el.grid.classList.add('view-mode-table');
      this.renderizarTabla(docs, top10RankingMap, conteoDescargas);
    } else {
      this.el.grid.classList.remove('view-mode-table');
      this.renderizarTarjetas(docs, top10RankingMap, conteoDescargas);
    }

    this.vincularEventosCatalogo();
  }

  /**
   * Renderiza el catálogo en Vista de Cuadrícula (Tarjetas Visuales)
   */
  renderizarTarjetas(docs, top10RankingMap, conteoDescargas) {
    this.el.grid.innerHTML = docs
      .map((doc) => {
        const extUpper = (doc.extension || '').toUpperCase();
        const extClass =
          (extUpper.includes('XLS') || extUpper.includes('CSV'))
            ? 'badge-xls'
            : (extUpper.includes('PDF') ? 'badge-pdf' : 'badge-doc');
        const statClass = doc.disponible ? 'badge-disponible' : 'badge-nodisponible';
        const border = doc.disponible ? 'disponible' : 'no-disponible';
        const isFav = this.favoritos.has(doc.id);
        const ranking = top10RankingMap.get(doc.id);
        const numDescargas = conteoDescargas[(doc.codigo || '').trim().toUpperCase()] || 0;

        const esVistaTop10 = Boolean(filterEngine.estado.soloTop10);
        let badgeTopOConteo = '';
        if (esVistaTop10 && ranking) {
          badgeTopOConteo = `
            <span class="top-ranking-badge" style="display:inline-flex; align-items:center; gap:5px; background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color:#92400e; border:1px solid #f59e0b; padding:2px 10px; border-radius:12px; font-size:0.74rem; font-weight:800; white-space:nowrap; box-shadow: 0 1px 3px rgba(245,158,11,0.25);" title="Ranking Top #${ranking} con ${numDescargas} descargas registradas">
              <span>🏆 Top #${ranking}</span>
              <span style="color:#78350f; font-weight:700;">• ${numDescargas} ${numDescargas === 1 ? 'descarga' : 'descargas'}</span>
            </span>
          `;
        }

        const estrategia = determinarEstrategiaDescarga(doc);
        let botonPrimario = '';
        if (!doc.disponible) {
          botonPrimario = `<button class="card-action-btn btn-card-disabled card-action-primary" disabled title="Archivo no disponible en el repositorio">NO DISPONIBLE</button>`;
        } else if (this.modoEdicion) {
          botonPrimario = `
            <button type="button" class="card-action-btn btn-card-edit card-action-primary" data-action="edit" data-id="${doc.id}" title="Editar archivo original en SharePoint Online">
              <span>✏️</span> <span>EDITAR</span>
            </button>
          `;
        } else if (doc.descargable === false) {
          botonPrimario = `<button class="card-action-btn btn-card-blocked card-action-primary" data-action="blocked" data-id="${doc.id}" title="Descarga restringida.">🔒 BLOQUEADO</button>`;
        } else {
          botonPrimario = `<button class="card-action-btn btn-card-download card-action-primary" data-action="download" data-id="${doc.id}" title="Descargar documento">DESCARGAR 📥</button>`;
        }

        const tieneArchivoSP = Boolean(doc.disponible);

        return `
        <article class="doc-card ${border}" data-id="${doc.id}">
          <div>
            <!-- Fila 1: Marcador de Top 10 y descargas -->
            ${badgeTopOConteo
            ? `<div class="card-top-row" style="display:flex; justify-content:flex-end; margin-bottom:6px;">
                    ${badgeTopOConteo}
                   </div>`
            : ''
          }

            <!-- Fila 2: Tipo de documento, código y disponibilidad -->
            <div class="card-header-row">
              <div class="card-header-left">
                <button type="button" class="btn-fav-star ${isFav ? 'active' : ''}" data-action="fav" data-id="${doc.id}" title="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito ⭐'}">
                  ★
                </button>
                <span class="badge ${extClass}">${doc.extension}</span>
                <span class="doc-code-text">${doc.codigo}</span>
              </div>
              <span class="badge-status ${statClass}">
                <span class="status-dot"></span> ${doc.estado}
              </span>
            </div>

            <!-- Fila 3: Nombre del documento -->
            <h3 class="card-doc-title" title="${doc.titulo}">${doc.titulo}</h3>

            <!-- Resto de filas -->
            <div class="card-metadata-list" style="margin-top:6px;">
              <div class="meta-row"><span class="meta-label-text">Tipo de proceso:</span><span class="meta-value-text" title="${doc.tipoProceso}">${doc.tipoProceso}</span></div>
              <div class="meta-row"><span class="meta-label-text">Área:</span><span class="meta-value-text" title="${doc.area}">${doc.area}</span></div>
              <div class="meta-row"><span class="meta-label-text">Proceso:</span><span class="meta-value-text" title="${doc.proceso}">${doc.proceso}</span></div>
              <div class="meta-row"><span class="meta-label-text">Tipo de documento:</span><span class="meta-value-text" title="${doc.tipoDocumento}">${doc.tipoDocumento}</span></div>
              <div class="meta-row"><span class="meta-label-text">Modificación:</span><span class="meta-value-text">${staffService.formatearFechaHora(doc.modificacion)}</span></div>
            </div>
          </div>

          <!-- Acciones de Tarjeta -->
          <div class="card-actions-wrapper" style="position:relative;">
            ${botonPrimario}
            ${this.modoEdicion
            ? `
                <button type="button" class="btn-card-more" data-action="toggle-menu" data-id="${doc.id}" title="Opciones de edición">
                  ⋮
                </button>

                <!-- Menú Flotante Contextual de Edición -->
                <div class="doc-context-menu" id="context-menu-${doc.id}" style="display:none;" data-card-id="${doc.id}">
                  <button type="button" class="doc-context-item" data-action="menu-drawer" data-id="${doc.id}">
                    <span>📋</span> Ficha técnica e historial
                  </button>
                  ${doc.disponible
              ? `
                      <button type="button" class="doc-context-item" data-action="download" data-id="${doc.id}" title="Descargar documento">
                        <span>📥</span> Descargar documento
                      </button>
                      <button type="button" class="doc-context-item" data-action="menu-folder" data-id="${doc.id}">
                        <span>📁</span> Abrir carpeta en SharePoint
                      </button>
                      <button type="button" class="doc-context-item" data-action="menu-edit" data-id="${doc.id}">
                        <span>✏️</span> Editar en SharePoint Online
                      </button>
                      `
              : ''
            }
                  ${this.perfil === 'total' || this.perfil === 'administrador' || this.perfil === 'directivo'
              ? `
                      <div class="doc-context-divider"></div>
                      <button type="button" class="doc-context-item" data-action="menu-meta" data-id="${doc.id}">
                        <span>⚙️</span> Modificar metadatos
                      </button>
                      <button type="button" class="doc-context-item item-danger" data-action="menu-delete" data-id="${doc.id}">
                        <span>🗑️</span> Retirar del catálogo
                      </button>
                      `
              : ''
            }
                </div>
                `
            : ''
          }
          </div>
        </article>`;
      })
      .join('');
  }

  /**
   * Renderiza el catálogo en Vista de Tabla (Listado Corporativo Detallado)
   */
  renderizarTabla(docs, top10RankingMap, conteoDescargas) {
    const esVistaTop10 = Boolean(filterEngine.estado.soloTop10);

    // Si estamos en la vista de Top 10, aseguramos el ordenamiento estricto de Top #1 a Top #10
    const listaDocs = [...docs];
    if (esVistaTop10) {
      listaDocs.sort((a, b) => {
        const rA = top10RankingMap.get(a.id) || 999;
        const rB = top10RankingMap.get(b.id) || 999;
        if (rA !== rB) return rA - rB;
        const cA = conteoDescargas[(a.codigo || '').trim().toUpperCase()] || 0;
        const cB = conteoDescargas[(b.codigo || '').trim().toUpperCase()] || 0;
        if (cB !== cA) return cB - cA;
        return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
      });
    }

    const filasHtml = listaDocs
      .map((doc) => {
        const extUpper = (doc.extension || '').toUpperCase();
        const extClass =
          (extUpper.includes('XLS') || extUpper.includes('CSV'))
            ? 'badge-xls'
            : (extUpper.includes('PDF') ? 'badge-pdf' : 'badge-doc');
        const isFav = this.favoritos.has(doc.id);
        const rowClass = !doc.disponible ? 'row-no-disponible' : '';
        const ranking = top10RankingMap.get(doc.id);
        const numDescargas = conteoDescargas[(doc.codigo || '').trim().toUpperCase()] || 0;
        const estrategia = determinarEstrategiaDescarga(doc);

        let badgePuestoHtml = '';
        if (esVistaTop10 && ranking) {
          if (ranking === 1) {
            badgePuestoHtml = `<span class="badge-top-rank rank-1" style="display:inline-flex; align-items:center; justify-content:center; gap:2px; background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); color:#92400e; border:1.5px solid #f59e0b; padding:2px 7px; border-radius:10px; font-size:0.75rem; font-weight:800; white-space:nowrap; box-shadow:0 1px 2px rgba(245,158,11,0.25);" title="Puesto #1 del Top 10">🥇 #1</span>`;
          } else if (ranking === 2) {
            badgePuestoHtml = `<span class="badge-top-rank rank-2" style="display:inline-flex; align-items:center; justify-content:center; gap:2px; background:linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color:#334155; border:1.5px solid #94a3b8; padding:2px 7px; border-radius:10px; font-size:0.75rem; font-weight:800; white-space:nowrap;" title="Puesto #2 del Top 10">🥈 #2</span>`;
          } else if (ranking === 3) {
            badgePuestoHtml = `<span class="badge-top-rank rank-3" style="display:inline-flex; align-items:center; justify-content:center; gap:2px; background:linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%); color:#9a3412; border:1.5px solid #f97316; padding:2px 7px; border-radius:10px; font-size:0.75rem; font-weight:800; white-space:nowrap;" title="Puesto #3 del Top 10">🥉 #3</span>`;
          } else {
            badgePuestoHtml = `<span class="badge-top-rank rank-other" style="display:inline-flex; align-items:center; justify-content:center; gap:2px; background:#fef9c3; color:#854d0e; border:1px solid #eab308; padding:2px 7px; border-radius:10px; font-size:0.73rem; font-weight:700; white-space:nowrap;" title="Puesto #${ranking} del Top 10">🏆 #${ranking}</span>`;
          }
        }

        return `
        <tr class="docs-table-row ${rowClass}" data-id="${doc.id}">
          <td class="col-fav" style="width: 26px; text-align: center; padding: 6px 2px;">
            <button type="button" class="btn-fav-star ${isFav ? 'active' : ''}" data-action="fav" data-id="${doc.id}" title="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito ⭐'}" style="font-size: 0.95rem; width: 22px; height: 22px; line-height: 22px; display: inline-flex; align-items: center; justify-content: center;">
              ★
            </button>
          </td>
          ${esVistaTop10
            ? `<td class="col-top-rank" style="width: 58px; text-align: center; padding: 6px 3px;">${badgePuestoHtml}</td>`
            : ''
          }
          <td class="col-tipo" style="width: 44px; text-align: center; padding: 6px 3px;">
            <span class="badge ${extClass}" style="font-size: 0.70rem; padding: 1px 5px; font-weight: 700;">${doc.extension}</span>
          </td>
          <td class="col-codigo" style="width: 82px; font-family: var(--font-heading); font-weight: 700; color: #334155; font-size: 0.78rem; white-space: nowrap; padding: 6px 6px;">
            ${doc.codigo}
          </td>
          <td class="docs-table-title-cell" title="${doc.titulo}" style="padding: 6px 8px;">
            ${doc.titulo}
          </td>
          <td class="col-proceso" style="font-size: 0.78rem; padding: 6px 8px;">${doc.proceso || 'N/A'}</td>
          <td class="col-area" style="font-size: 0.78rem; padding: 6px 8px;">${doc.area || 'N/A'}</td>
          <td class="col-version" style="width: 52px; font-weight: 700; color: var(--primary); text-align: center; white-space: nowrap; padding: 6px 3px; font-size: 0.78rem;">${staffService.formatearVersion(doc.version)}</td>
          ${esVistaTop10
            ? `
              <td class="col-descargas" style="width: 90px; text-align: center; white-space: nowrap; padding: 6px 4px;">
                <span style="display:inline-flex; align-items:center; gap:3px; background:#f8fafc; border:1px solid #cbd5e1; color:#0f172a; padding:2px 7px; border-radius:10px; font-size:0.73rem; font-weight:700;" title="${numDescargas} descargas registradas">
                  🔥 ${numDescargas} ${numDescargas === 1 ? 'descarga' : 'descargas'}
                </span>
              </td>
              `
            : ''
          }
          <td class="col-fecha" style="width: 118px; white-space: nowrap; font-size: 0.73rem; color: #64748b; padding: 6px 6px;">
            ${staffService.formatearFechaHora(doc.modificacion)}
          </td>
          <td class="docs-table-actions-cell" style="width: ${this.modoEdicion ? '120px' : '115px'}; text-align: center; padding: 6px 4px; position: relative;">
            ${this.modoEdicion
            ? `
                <div class="table-actions-inline">
                  ${doc.disponible
              ? `
                      <button type="button" class="btn-table-direct-edit" data-action="menu-edit" data-id="${doc.id}" title="Editar archivo original en SharePoint">
                        ✏️
                      </button>
                      <button type="button" class="btn-table-direct-folder" data-action="menu-folder" data-id="${doc.id}" title="Abrir carpeta de ubicación en SharePoint">
                        📁
                      </button>
                      `
              : `
                      <button type="button" class="btn-table-direct-edit disabled" disabled style="opacity: 0.4; cursor: not-allowed;" title="Archivo no disponible">
                        ✏️
                      </button>
                      <button type="button" class="btn-table-direct-folder disabled" disabled style="opacity: 0.4; cursor: not-allowed;" title="Carpeta no disponible">
                        📁
                      </button>
                      `
            }
                  <button type="button" class="btn-card-more" data-action="toggle-menu" data-id="${doc.id}" style="width: 28px; height: 28px; font-size: 1.05rem; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; margin: 0;" title="Opciones de gestión">
                    ⋮
                  </button>
                </div>

                <!-- Menú contextual de edición en tabla -->
                <div class="doc-context-menu" id="context-menu-${doc.id}" style="display: none;" data-card-id="${doc.id}">
                  <button type="button" class="doc-context-item" data-action="menu-drawer" data-id="${doc.id}">
                    <span>📋</span> Ficha técnica e historial
                  </button>
                  ${doc.disponible
              ? `
                      <button type="button" class="doc-context-item" data-action="download" data-id="${doc.id}" title="Descargar documento">
                        <span>📥</span> Descargar documento
                      </button>
                      <button type="button" class="doc-context-item" data-action="menu-folder" data-id="${doc.id}">
                        <span>📁</span> Abrir carpeta en SharePoint
                      </button>
                      <button type="button" class="doc-context-item" data-action="menu-edit" data-id="${doc.id}">
                        <span>✏️</span> Editar en SharePoint Online
                      </button>
                      `
              : ''
            }
                  ${this.perfil === 'total' || this.perfil === 'administrador' || this.perfil === 'directivo'
              ? `
                      <div class="doc-context-divider"></div>
                      <button type="button" class="doc-context-item" data-action="menu-meta" data-id="${doc.id}">
                        <span>⚙️</span> Modificar metadatos
                      </button>
                      <button type="button" class="doc-context-item item-danger" data-action="menu-delete" data-id="${doc.id}">
                        <span>🗑️</span> Retirar del catálogo
                      </button>
                      `
              : ''
            }
                </div>
                `
            : !doc.disponible
              ? `<button class="btn btn-disabled" disabled style="padding: 4px 8px; font-size: 0.70rem;" title="Documento no disponible en SharePoint">No Disponible</button>`
              : doc.descargable === false
                ? `<button class="btn btn-secondary" data-action="blocked" data-id="${doc.id}" style="padding: 4px 8px; font-size: 0.70rem; color:#92400e; background:#fef3c7;" title="Descarga restringida">🔒 Bloqueado</button>`
                : `
                <button type="button" class="btn btn-primary" data-action="download" data-id="${doc.id}" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 700;" title="Descargar documento">
                  📥 Descargar
                </button>
                `
          }
          </td>
        </tr>`;
      })
      .join('');

    this.el.grid.innerHTML = `
      <div class="documents-table-container">
        <table class="docs-table">
          <thead>
            <tr>
              <th style="width: 26px; min-width: 26px; max-width: 26px; text-align: center; padding: 8px 2px;">★</th>
              ${esVistaTop10
        ? `<th style="width: 58px; min-width: 58px; text-align: center; padding: 8px 3px;">TOP</th>`
        : ''
      }
              <th style="width: 44px; min-width: 44px; max-width: 44px; text-align: center; padding: 8px 3px;">Tipo</th>
              <th style="width: 82px; min-width: 82px; max-width: 95px; padding: 8px 6px;">Código</th>
              <th style="min-width: 170px; max-width: 260px; padding: 8px 8px;">Nombre del Documento</th>
              <th style="width: 130px; min-width: 120px; padding: 8px 8px;">Proceso</th>
              <th style="width: 135px; min-width: 125px; padding: 8px 8px;">Área Institucional</th>
              <th style="width: 52px; min-width: 52px; text-align: center; padding: 8px 3px;">Versión</th>
              ${esVistaTop10
        ? `<th style="width: 90px; min-width: 85px; text-align: center; padding: 8px 4px;">DESCARGAS</th>`
        : ''
      }
              <th style="width: 118px; min-width: 118px; padding: 8px 6px;">Modificación</th>
              <th style="width: ${this.modoEdicion ? '120px' : '115px'}; min-width: ${this.modoEdicion ? '115px' : '115px'}; text-align: center; padding: 8px 6px;">
                ACCIONES
              </th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Vincula la delegación de eventos para el catálogo (Tarjetas, Filas de Tabla y Menús Contextuales)
   */
  cerrarTodosLosMenusContextuales() {
    document.querySelectorAll('.doc-context-menu').forEach((m) => {
      m.style.display = 'none';
      m.classList.remove('menu-pos-bottom', 'menu-pos-top');
    });
    document.querySelectorAll('.btn-card-more').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.doc-card.card-menu-open').forEach((c) => c.classList.remove('card-menu-open'));
    this._menuContextualActivo = null;
  }

  /**
   * Vincula la delegación de eventos para el catálogo (Tarjetas, Filas de Tabla y Menús Contextuales)
   */
  vincularEventosCatalogo() {
    // Cerrar menús contextuales al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.card-actions-wrapper') && !e.target.closest('.docs-table-actions-cell')) {
        this.cerrarTodosLosMenusContextuales();
      }
    });

    const elementos = this.el.grid.querySelectorAll('.doc-card, .docs-table-row');

    elementos.forEach((el) => {
      el.addEventListener('click', (e) => {
        const id = el.getAttribute('data-id');
        const doc = this.documentos.find((d) => d.id === id);
        if (!doc) return;

        const btnFav = e.target.closest('[data-action="fav"]');
        const btnToggleMenu = e.target.closest('[data-action="toggle-menu"]');
        const btnMenuFolder = e.target.closest('[data-action="menu-folder"]');
        const btnMenuEdit =
          e.target.closest('[data-action="menu-edit"]') ||
          e.target.closest('[data-action="edit"]') ||
          e.target.closest('.btn-card-edit') ||
          e.target.closest('.btn-action-edit-sp');
        const btnMenuMeta = e.target.closest('[data-action="menu-meta"]');
        const btnMenuDelete = e.target.closest('[data-action="menu-delete"]');
        const btnMenuDrawer = e.target.closest('[data-action="menu-drawer"]');
        const btnBlocked = e.target.closest('[data-action="blocked"]');
        const btnDownload = e.target.closest('[data-action="download"]');

        // Manejo de Menú Contextual (3 Puntos ⋮)
        if (btnToggleMenu) {
          e.stopPropagation();
          const menu = el.querySelector(`#context-menu-${doc.id}`);
          const estaAbierto = menu && menu.style.display === 'flex';

          this.cerrarTodosLosMenusContextuales();

          if (!estaAbierto && menu) {
            const btnRect = btnToggleMenu.getBoundingClientRect();
            const gridContainer = this.el.grid?.closest('.documents-grid-container') || this.el.grid;
            const containerRect = gridContainer ? gridContainer.getBoundingClientRect() : { top: 70, bottom: window.innerHeight };
            const espacioArriba = btnRect.top - containerRect.top;
            const espacioAbajo = containerRect.bottom - btnRect.bottom;

            // Si hay menos de 235px hacia arriba, desplegar hacia abajo para evitar recortes
            if (espacioArriba < 235 || (espacioAbajo >= 220 && espacioAbajo > espacioArriba)) {
              menu.classList.add('menu-pos-bottom');
              menu.classList.remove('menu-pos-top');
            } else {
              menu.classList.add('menu-pos-top');
              menu.classList.remove('menu-pos-bottom');
            }

            menu.style.display = 'flex';
            btnToggleMenu.classList.add('active');
            if (el.classList.contains('doc-card')) {
              el.classList.add('card-menu-open');
            }
          }
          return;
        }

        // Acciones desde Menú Contextual o Botones
        if (btnFav) {
          e.stopPropagation();
          this.toggleFavorito(doc.id);
          return;
        }

        if (btnMenuFolder) {
          e.stopPropagation();
          document.querySelectorAll('.doc-context-menu').forEach((m) => (m.style.display = 'none'));
          sharepointService.abrirCarpetaUbicacion(doc);
          staffService.registrarAuditoria('CARPETA', {
            documentoCodigo: doc.codigo,
            documentoTitulo: doc.titulo,
            documentoExtension: doc.extension
          });
          return;
        }

        if (btnMenuEdit) {
          e.stopPropagation();
          if (this.perfil === 'operativo' || !this.modoEdicion) {
            this.mostrarToast('🔒 El personal operativo solo tiene permisos de consulta y descarga de archivos.', 'info');
            return;
          }
          const kEdit = `edit_${doc.id || doc.codigo}`;
          const tEdit = this._debounceAccionesDoc.get(kEdit) || 0;
          if (Date.now() - tEdit < 2000) return;
          this._debounceAccionesDoc.set(kEdit, Date.now());

          document.querySelectorAll('.doc-context-menu').forEach((m) => (m.style.display = 'none'));
          sharepointService.abrirEnEdicion(doc);
          staffService.registrarAuditoria('EDICION', {
            documentoCodigo: doc.codigo,
            documentoTitulo: doc.titulo,
            documentoExtension: doc.extension,
            detalle: `Edición de documento en SharePoint (${doc.codigo})`
          });
          staffService.registrarCambioDocumental('EDICION_SHAREPOINT', {
            codigo: doc.codigo,
            titulo: doc.titulo,
            versionAnterior: doc.version || '1',
            versionNueva: doc.version || '1',
            rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
            rutaNueva: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
            tipoAnterior: doc.tipoDocumento || '',
            tipoNuevo: doc.tipoDocumento || '',
            fechaModificacionActual: doc.modificacion || '',
            detalle: doc.modificacion ? `Fecha de modificación en SharePoint: ${doc.modificacion}` : `Apertura y edición en SharePoint (${doc.codigo})`,
            sharepointUrl: doc.sharepointUrl || ''
          });
          this.mostrarToast(`✏️ Abriendo edición de ${doc.codigo} en SharePoint...`, 'info');
          return;
        }

        if (btnMenuMeta) {
          e.stopPropagation();
          document.querySelectorAll('.doc-context-menu').forEach((m) => (m.style.display = 'none'));
          modalManager.abrirModalEditarDocumento(doc, {
            onGuardar: (docAct) => {
              this.actualizarDocumentoEnApp(docAct);
              this.mostrarToast(`✅ Metadatos de ${docAct.codigo} actualizados correctamente`, 'success');
            }
          });
          return;
        }

        if (btnMenuDelete) {
          e.stopPropagation();
          document.querySelectorAll('.doc-context-menu').forEach((m) => (m.style.display = 'none'));
          modalManager.abrirModalEliminarDocumento(doc, {
            onConfirmar: (cod) => {
              this.eliminarDocumentoDeApp(cod);
              this.mostrarToast(`🗑️ Documento ${cod} retirado del catálogo`, 'info');
            }
          });
          return;
        }

        if (btnBlocked) {
          e.stopPropagation();
          this.mostrarToast('🔒 Este archivo tiene restringida la descarga directa. Activa el Modo Edición con tu contraseña de ingreso para abrirlo o modificarlo en SharePoint.', 'info');
          return;
        }

        if (btnDownload) {
          e.stopPropagation();
          this.cerrarTodosLosMenusContextuales();
          const kDown = `down_${doc.id || doc.codigo}`;
          const tDown = this._debounceAccionesDoc.get(kDown) || 0;
          if (Date.now() - tDown < 2000) return;
          this._debounceAccionesDoc.set(kDown, Date.now());

          const estrategia = determinarEstrategiaDescarga(doc);
          staffService.registrarDescargaDocumento(doc, estrategia.formato);

          if (estrategia.esPdf) {
            const textoOriginal = btnDownload.innerHTML;
            btnDownload.disabled = true;
            btnDownload.classList.add('btn-downloading');
            btnDownload.innerHTML = '<span>⏳</span> <span>Descargando...</span>';

            sharepointService.descargarDocumento(doc, this.modoEdicion)
              .finally(() => {
                btnDownload.disabled = false;
                btnDownload.classList.remove('btn-downloading');
                btnDownload.innerHTML = textoOriginal;
              });
          } else {
            sharepointService.descargarDocumento(doc, this.modoEdicion);
          }
          return;
        }

        // Clic en la tarjeta, fila o opción "Ficha técnica e historial": Abrir Panel Lateral de Inspección (Drawer)
        document.querySelectorAll('.doc-context-menu').forEach((m) => (m.style.display = 'none'));
        document.querySelectorAll('.docs-table tbody tr.table-row-selected').forEach((r) => r.classList.remove('table-row-selected'));

        if (el.classList.contains('docs-table-row')) {
          el.classList.add('table-row-selected');
        }

        const kView = `view_${doc.id || doc.codigo}`;
        const tView = this._debounceAccionesDoc.get(kView) || 0;
        if (Date.now() - tView > 2500) {
          this._debounceAccionesDoc.set(kView, Date.now());
          staffService.registrarConsultaDocumento(doc);
        }
        modalManager.abrirDrawerDocumento(
          doc,
          this.modoEdicion,
          (d) => {
            if (this.perfil === 'operativo' || !this.modoEdicion) {
              this.mostrarToast('🔒 El personal operativo solo tiene permisos de consulta y descarga de archivos.', 'info');
              return;
            }
            sharepointService.abrirEnEdicion(d);
            staffService.registrarAuditoria('EDICION', {
              documentoCodigo: d.codigo,
              documentoTitulo: d.titulo,
              documentoExtension: d.extension,
              detalle: `Edición de documento en SharePoint (${d.codigo})`
            });
            staffService.registrarCambioDocumental('EDICION_SHAREPOINT', {
              codigo: d.codigo,
              titulo: d.titulo,
              versionAnterior: d.version || '1',
              versionNueva: d.version || '1',
              rutaAnterior: `${d.tipoProceso || ''} / ${d.area || ''} / ${d.proceso || ''}`,
              rutaNueva: `${d.tipoProceso || ''} / ${d.area || ''} / ${d.proceso || ''}`,
              tipoAnterior: d.tipoDocumento || '',
              tipoNuevo: d.tipoDocumento || '',
              fechaModificacionActual: d.modificacion || '',
              detalle: d.modificacion ? `Fecha de modificación en SharePoint: ${doc.modificacion || d.modificacion}` : `Apertura y edición en SharePoint (${d.codigo})`,
              sharepointUrl: d.sharepointUrl || ''
            });
            this.mostrarToast(`✏️ Abriendo edición de ${d.codigo} en SharePoint...`, 'info');
          },
          async (d) => {
            const estrategia = determinarEstrategiaDescarga(d);
            staffService.registrarDescargaDocumento(d, estrategia.formato);
            return await sharepointService.descargarDocumento(d, this.modoEdicion);
          },
          (docActualizado) => {
            this.actualizarDocumentoEnApp(docActualizado);
            this.mostrarToast(`✅ Metadatos de ${docActualizado.codigo} actualizados correctamente`, 'success');
          },
          (codEliminado) => {
            this.eliminarDocumentoDeApp(codEliminado);
            this.mostrarToast(`🗑️ Documento ${codEliminado} retirado del catálogo`, 'info');
          }
        );
      });
    });
  }

  agregarNuevoDocumentoEnApp(nuevoDoc) {
    if (!nuevoDoc) return;
    this.documentos.unshift(nuevoDoc);
    this.aplicarFiltros(true);
    if (this.vistaActual === 'analytics') {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
    }
  }

  actualizarDocumentoEnApp(docActualizado) {
    if (!docActualizado) return;
    const codUpper = (docActualizado.codigo || '').toUpperCase();
    const codAntUpper = (docActualizado.codigoAnterior || '').toUpperCase();
    let idx = -1;
    if (codAntUpper) {
      idx = this.documentos.findIndex((d) => (d.codigo || '').toUpperCase() === codAntUpper);
    }
    if (idx < 0) {
      idx = this.documentos.findIndex((d) => (d.codigo || '').toUpperCase() === codUpper);
    }
    if (idx >= 0) {
      this.documentos[idx] = { ...this.documentos[idx], ...docActualizado };
    }
    this.aplicarFiltros(true);
    if (this.vistaActual === 'analytics') {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
    }
  }

  eliminarDocumentoDeApp(codigoRetirado) {
    if (!codigoRetirado) return;
    const codUpper = String(codigoRetirado).toUpperCase();
    this.documentos = this.documentos.filter((d) => (d.codigo || '').toUpperCase() !== codUpper);
    this.aplicarFiltros(true);
    if (this.vistaActual === 'analytics') {
      const docsPerfil = filterEngine.obtenerDocumentosPorPerfil(this.documentos);
      analyticsManager.render(docsPerfil, this.perfil, docsPerfil);
    }
  }

  renderizarChips() {
    if (!this.el.chipsContainer) return;
    const etiquetas = filterEngine.obtenerEtiquetasActivas();
    if (etiquetas.length === 0) {
      this.el.chipsContainer.innerHTML = '<span class="no-filters-msg">Ninguno (Mostrando todos los documentos)</span>';
      return;
    }
    this.el.chipsContainer.innerHTML = etiquetas
      .map(
        (e) =>
          `<span class="filter-chip">${e.label}
        <button class="filter-chip-remove" data-cat="${e.categoria}" data-val="${e.valor}">&times;</button>
      </span>`
      )
      .join('');

    this.el.chipsContainer.querySelectorAll('.filter-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const { cat, val } = btn.dataset;
        filterEngine.removerFiltroIndividual(cat, val);
        if (cat === 'formato') {
          this.el.formatBtns?.forEach((b) => {
            if (b.id !== 'btn-filter-favorites' && b.id !== 'btn-filter-top10') {
              b.classList.toggle('active', b.getAttribute('data-format') === 'TODOS');
            }
          });
        } else if (cat === 'favoritos') {
          this.el.btnFavoritesFilter?.classList.remove('active');
          this.el.btnSidebarFavs?.classList.remove('active');
        } else if (cat === 'top10') {
          this.el.btnFilterTop10?.classList.remove('active');
          this.el.btnSidebarTop10?.classList.remove('active');
        } else if (cat === 'busqueda') {
          this.el.searchInput.value = '';
          this.el.searchClear?.classList.remove('visible');
        }
        this.aplicarFiltros();
      });
    });
  }
}

const iniciarAplicacion = () => {
  try {
    const app = new AppController();
    window.__agyApp = app;
    app.init();
  } catch (err) {
    console.error('[App] Error crítico iniciando aplicación:', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarAplicacion);
} else {
  iniciarAplicacion();
}
