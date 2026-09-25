/**
 * Módulo de Gestión de Modales y Ficha de Detalle de Documentos
 * Unión para la salud y la vida S.A.S.
 */

import { sharepointService, determinarEstrategiaDescarga, esDocumentoFMT } from './sharepoint-service.js?v=11.6.57';
import { staffService } from './staff-service.js?v=11.6.57';

const STORAGE_KEY_USER_PROFILE = 'agy_user_profile';

export class ModalManager {
  constructor() {
    this.modalContainer = null;
    this.drawerContainer = null;
    this.documentoDrawerActivo = null;
  }

  init() {
    this.crearContenedoresModal();
    this.vincularEventosGlobales();
  }

  crearContenedoresModal() {
    let container = document.getElementById('modals-root');
    if (!container && document.body) {
      container = document.createElement('div');
      container.id = 'modals-root';
      document.body.appendChild(container);
    }
    this.modalContainer = container;

    let drawer = document.getElementById('drawer-root');
    if (!drawer && document.body) {
      drawer = document.createElement('div');
      drawer.id = 'drawer-root';
      document.body.appendChild(drawer);
    }
    this.drawerContainer = drawer;
  }

  vincularEventosGlobales() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Si hay un modal abierto
        const backdrop = this.modalContainer?.querySelector('.modal-backdrop');
        if (backdrop) {
          if (backdrop.dataset.preventClose === 'true') {
            const card = backdrop.querySelector('.modal-card');
            if (card) {
              card.classList.remove('animate-shake');
              void card.offsetWidth;
              card.classList.add('animate-shake');
            }
            return; // Bloqueado: modal obligatorio
          }
          this.cerrarModal();
          return;
        }

        // Si el drawer lateral está abierto
        if (this.drawerContainer?.querySelector('.doc-drawer.active')) {
          this.cerrarDrawer();
        }
      }
    });

    if (this.modalContainer) {
      this.modalContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal-backdrop')) {
          if (e.target.dataset && e.target.dataset.preventClose === 'true') {
            const card = e.target.querySelector('.modal-card');
            if (card) {
              card.classList.remove('animate-shake');
              void card.offsetWidth;
              card.classList.add('animate-shake');
            }
            return; // Bloqueado: modal obligatorio
          }
          this.cerrarModal();
        }
      });
    }
  }

  cerrarModal() {
    if (this.modalContainer) {
      this.modalContainer.innerHTML = '';
      document.body.classList.remove('modal-open');
    }
    // Prevenir que el gestor de contraseñas de producción contamine el buscador principal con la cédula
    try {
      const searchInput = document.getElementById('search-input');
      const sesion = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
      if (searchInput && sesion && sesion.identificacion) {
        const val = (searchInput.value || '').trim();
        const cedula = String(sesion.identificacion).trim();
        if (val && (val === cedula || val.replace(/\D/g, '') === cedula.replace(/\D/g, ''))) {
          searchInput.value = '';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } catch { }
  }

  cerrarDrawer() {
    if (!this.drawerContainer) return;
    const drawer = this.drawerContainer.querySelector('.doc-drawer');
    const backdrop = this.drawerContainer.querySelector('.doc-drawer-backdrop');
    if (drawer) drawer.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    this.documentoDrawerActivo = null;

    // Deseleccionar fila de tabla si existe
    document.querySelectorAll('.docs-table tbody tr.table-row-selected').forEach((r) => {
      r.classList.remove('table-row-selected');
    });

    setTimeout(() => {
      if (this.drawerContainer && !this.documentoDrawerActivo) {
        this.drawerContainer.innerHTML = '';
      }
    }, 300);
  }

  /**
   * Modal para solicitar contraseña de activación del Modo Edición
   */
  abrirModalPasswordEdicion(onPasswordCorrecto) {
    document.body.classList.add('modal-open');

    const sesion = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
    const infoUsuarioHtml = sesion
      ? `
        <div style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; margin-top: 8px; text-align: left; display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 1.4rem;">👤</div>
          <div style="overflow: hidden; flex: 1;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-navy, #1f4260); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${sesion.nombre || 'Colaborador'}
            </div>
            <div style="font-size: 0.74rem; color: #64748b;">
              ${sesion.cargo || 'Usuario del Sistema'} &bull; Doc: ${sesion.identificacion || 'N/A'}
            </div>
          </div>
        </div>
      `
      : '';

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 440px;">
          <div class="modal-header">
            <div class="modal-header-badge">
              <span class="badge badge-doc">Seguridad</span>
              <span class="doc-code">Activar Modo Edición</span>
            </div>
            <button class="btn-close" id="btn-modal-close" aria-label="Cerrar modal">&times;</button>
          </div>

          <div class="modal-body" style="gap: 12px;">
            <div style="text-align: center; margin-bottom: 4px;">
              <div style="font-size: 2.4rem; margin-bottom: 6px;">🔒</div>
              <h3 style="font-family: inherit; color: var(--brand-navy); font-size: 1.15rem; font-weight:700;">Acceso para Modo Edición</h3>
              <p style="font-size: 0.82rem; color: #64748b; margin-top: 4px;">
                Ingresa tu contraseña de colaborador para habilitar la edición de documentos y metadatos.
              </p>
              ${infoUsuarioHtml}
            </div>

            <form id="form-pwd-edicion" autocomplete="off" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Trampa invisible de autofill -->
              <input type="text" name="fake_user_edit" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; left: -9999px;" tabindex="-1" autocomplete="username" />
              ${
                !sesion
                  ? `
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="input-doc-edit" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Documento de Identidad:</label>
                    <input 
                      type="text" 
                      id="input-doc-edit" 
                      name="user_doc_unlock_field"
                      class="form-input" 
                      placeholder="Ingresa tu cédula o documento..." 
                      autocomplete="off"
                      data-lpignore="true"
                      style="font-size: 0.92rem; padding: 9px 12px; width: 100%;"
                    />
                  </div>
                  `
                  : ''
              }
              <div class="form-group" style="margin-bottom: 0;">
                <label for="input-pwd-edit" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Contraseña de Usuario:</label>
                <input 
                  type="password" 
                  id="input-pwd-edit" 
                  name="user_pwd_unlock_field"
                  class="form-input" 
                  placeholder="Escribe tu contraseña de ingreso..." 
                  autocomplete="new-password"
                  data-lpignore="true"
                  data-form-type="other"
                  value=""
                  autofocus 
                  required 
                  style="font-size: 1rem; padding: 10px 12px; letter-spacing: 2px; width: 100%;"
                />
              </div>
              <div id="pwd-error-msg" style="color: #dc2626; font-size: 0.80rem; font-weight: 600; display: none;">
                ❌ Contraseña incorrecta. Intenta nuevamente.
              </div>
            </form>
          </div>

          <div class="modal-footer" style="justify-content: space-between;">
            <button class="btn btn-secondary" id="btn-modal-cancel">Cancelar</button>
            <button class="btn btn-primary" id="btn-submit-pwd" style="padding: 8px 18px;">
              Desbloquear Edición 🔓
            </button>
          </div>
        </div>
      </div>
    `;

    // Limpieza explícita diferida
    setTimeout(() => {
      const p = document.getElementById('input-pwd-edit');
      if (p) p.value = '';
    }, 50);

    const inputDoc = document.getElementById('input-doc-edit');
    const inputPwd = document.getElementById('input-pwd-edit');
    const errorMsg = document.getElementById('pwd-error-msg');
    const form = document.getElementById('form-pwd-edicion');

    const validar = async (e) => {
      if (e) e.preventDefault();
      const docVal = inputDoc ? inputDoc.value.trim() : null;
      const val = inputPwd.value;
      const res = await staffService.validarClaveEdicion(val, docVal);
      if (res.ok) {
        this.cerrarModal();
        if (onPasswordCorrecto) onPasswordCorrecto();
      } else {
        if (errorMsg) {
          errorMsg.textContent = res.error ? `❌ ${res.error}` : '❌ Contraseña incorrecta. Intenta nuevamente.';
          errorMsg.style.display = 'block';
        }
        inputPwd.focus();
        inputPwd.select();
      }
    };

    form.addEventListener('submit', validar);
    document.getElementById('btn-submit-pwd')?.addEventListener('click', validar);
    document.getElementById('btn-modal-close')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('btn-modal-cancel')?.addEventListener('click', () => this.cerrarModal());
    setTimeout(() => {
      if (inputDoc) {
        inputDoc.focus();
      } else {
        inputPwd?.focus();
      }
    }, 50);
  }

  /**
   * Panel Lateral Deslizable (Drawer) con Ficha Técnica Completa, Historial y Acciones
   */
  abrirDrawerDocumento(doc, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc = null, onEliminarDoc = null) {
    if (!this.drawerContainer) {
      this.crearContenedoresModal();
    }

    this.documentoDrawerActivo = doc.id;

    const sesionActiva = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
    const perfilActivo = sesionActiva?.perfil || localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'operativo';
    const esAdmin = perfilActivo === 'total' || perfilActivo === 'administrador';
    const puedeGestionarCatalogo = perfilActivo === 'total' || perfilActivo === 'administrador' || perfilActivo === 'directivo';

    const extUpper = (doc.extension || '').toUpperCase();
    const badgeExtClass =
      (extUpper.includes('XLS') || extUpper.includes('CSV'))
        ? 'badge-xls'
        : (extUpper.includes('PDF') ? 'badge-pdf' : 'badge-doc');
    const badgeEstadoClass = doc.disponible ? 'badge-disponible' : 'badge-nodisponible';

    const estrategiaDescarga = determinarEstrategiaDescarga(doc);
    const conteos = staffService.obtenerConteoDescargasDocumentos();
    const numDescargas = conteos[(doc.codigo || '').trim().toUpperCase()] || 0;

    const historialBruto = staffService.obtenerHistoricoDocumental(doc.codigo);
    const rawVer = staffService.normalizarVersion(doc.version || '1');
    const tipoCambio = doc.tipoCambio && doc.tipoCambio.trim() ? doc.tipoCambio.trim() : '';

    const seenKeys = new Set();
    const historialReal = (historialBruto || [])
      .filter((h) => {
        if (!h) return false;
        if (h.tipoEvento === 'CAMBIO_VERSION' && staffService.sonVersionesIguales(h.versionAnterior, h.versionNueva)) {
          return false;
        }
        const fEf = (() => {
          if (h.tipoEvento === 'EDICION_SHAREPOINT' && h.fechaModificacionActual && h.fechaModificacionActual !== 'N/A' && h.fechaModificacionActual !== 'Sincronizado') {
            return h.fechaModificacionActual.trim();
          }
          return (h.fechaHora || h.fechaModificacionActual || doc.modificacion || 'Sincronizado').trim();
        })();
        const vNorm = staffService.normalizarVersion(h.versionNueva || doc.version || '1');
        const key = `${(h.tipoEvento || '').toUpperCase()}_${fEf}_${vNorm}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((a, b) => {
        const getT = (item) => {
          const fEf = (item.tipoEvento === 'EDICION_SHAREPOINT' && item.fechaModificacionActual && item.fechaModificacionActual !== 'N/A')
            ? item.fechaModificacionActual
            : (item.fechaHora || item.fechaModificacionActual || '');
          const t = staffService.parsearFechaMilisegundos(fEf);
          if (t > 0) return t;
          if (item.timestamp) {
            const t2 = staffService.parsearFechaMilisegundos(item.timestamp);
            if (t2 > 0) return t2;
          }
          return 0;
        };
        return getT(b) - getT(a);
      });

    this.drawerContainer.innerHTML = `
      <div class="doc-drawer-backdrop active" id="drawer-backdrop"></div>
      <aside class="doc-drawer active" id="doc-drawer-panel" role="complementary" aria-label="Panel de inspección de documento">
        
        <!-- Cabecera del Panel Lateral -->
        <div class="doc-drawer-header">
          <div class="doc-drawer-header-left">
            <span class="badge ${badgeExtClass}" style="font-size: 0.72rem; padding: 3px 8px;">${doc.extension}</span>
            <span style="font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; letter-spacing: 0.5px;">${doc.codigo}</span>
            <span class="badge-status ${badgeEstadoClass}" style="margin-left: 4px;">
              <span class="status-dot"></span> ${doc.estado}
            </span>
          </div>
          <button type="button" class="doc-drawer-close-btn" id="btn-drawer-close" aria-label="Cerrar panel de inspección" title="Cerrar panel (Esc)">
            ✕
          </button>
        </div>

        <!-- Pestañas del Drawer -->
        <div class="doc-drawer-tabs">
          <button type="button" class="doc-drawer-tab-btn active" data-tab="ficha">
            <span>📋</span> Ficha Técnica
          </button>
          <button type="button" class="doc-drawer-tab-btn" data-tab="historial">
            <span>🕒</span> Historial & Versiones (${historialReal.length || 1})
          </button>
        </div>

        <!-- Contenido Desplazable -->
        <div class="doc-drawer-body">
          
          <!-- PESTAÑA: FICHA TÉCNICA -->
          <div class="drawer-tab-content" id="drawer-tab-ficha" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
              <h2 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: #0f172a; line-height: 1.3; margin: 0 0 6px 0;">
                ${doc.titulo}
              </h2>
              <p style="color: #64748b; font-size: 0.82rem; margin: 0; line-height: 1.4;">
                ${doc.descripcion || 'Documento institucional oficial del Sistema de Gestión de Calidad.'}
              </p>
            </div>

            <!-- Grid de Metadatos -->
            <div class="doc-metadata-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Tipo de Proceso</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.tipoProceso || 'N/A'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Área Institucional</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.area || 'N/A'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Proceso</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.proceso || 'N/A'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Tipo de Documento</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.tipoDocumento || 'N/A'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Versión Oficial</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:700; color:var(--primary);">${staffService.formatearVersion(doc.version)}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Total Descargas</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:700; color:#0f766e;">${numDescargas} ${numDescargas === 1 ? 'descarga' : 'descargas'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Vigencia</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.vigencia || doc.fechaAprobacion || 'N/A'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Tiempo de Retención</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.tiempoRetencion || doc.tiempo || '5 Años'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Lugar de Custodia</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${doc.lugar || doc.lugarArchivo || 'Oficina Central y sede'}</span>
              </div>
              <div class="meta-item" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 10px;">
                <span class="meta-label" style="display:block; font-size:0.70rem; color:#64748b; font-weight:700; text-transform:uppercase;">Última Modificación</span>
                <span class="meta-val" style="font-size:0.82rem; font-weight:600; color:#1e293b;">${staffService.formatearFechaHora(doc.modificacion)}</span>
              </div>
            </div>

            <!-- Accesos a SharePoint y Ubicación (Exclusivo Modo Edición) -->
            ${
              modoEdicion
                ? `
                <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                  <div style="font-size: 0.76rem; font-weight: 700; color: #475569; display: flex; align-items: center; justify-content: space-between;">
                    <span>📁 Ubicación en Repositorio</span>
                    <button type="button" class="btn-drawer-folder" id="btn-drawer-open-folder" style="border:none; background:transparent; color:var(--primary); font-size:0.75rem; font-weight:700; cursor:pointer; text-decoration:underline;">
                      Abrir carpeta ↗
                    </button>
                  </div>
                  <div style="font-size: 0.78rem; color: #1e293b; font-family: monospace; word-break: break-all;">
                    ${sharepointService.obtenerRutaLegible(doc)}
                  </div>
                </div>
                `
                : ''
            }

            ${
              doc.descargable === false
                ? `
                <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #92400e; line-height: 1.4;">
                  🔒 <strong>Descarga restringida:</strong> Para modificar el archivo original en SharePoint, activa el <strong>Modo Edición</strong> con tu contraseña institucional.
                </div>
                `
                : ''
            }

            ${
              estrategiaDescarga.esPdf
                ? `
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #c0392b; border-radius: 6px; padding: 9px 12px; font-size: 0.76rem; color: #334155; line-height: 1.4;">
                  📄 <strong>Copia Oficial Controlada:</strong> La descarga entrega el documento en <strong>formato PDF</strong> (ISO 9001). La edición del archivo original Word en SharePoint está reservada al <strong>Modo Edición</strong> mediante el botón <em>✏️ SharePoint</em>.
                </div>
                `
                : ''
            }
          </div>

          <!-- PESTAÑA: HISTORIAL & VERSIONES -->
          <div class="drawer-tab-content" id="drawer-tab-historial" style="display: none; flex-direction: column; gap: 12px;">
            <div class="version-history-header" style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:0.84rem; font-weight:700; color:#1e293b;">Línea de Tiempo del Documento</span>
              <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:0.72rem; font-weight:700;">Versión ${staffService.formatearVersion(rawVer)}</span>
            </div>

            <div class="version-timeline">
              ${
                historialReal && historialReal.length > 0
                  ? historialReal
                      .map((h, idx) => {
                        const esActual = idx === 0;
                        const badgeColor =
                          h.tipoEvento === 'CREACION'
                            ? '#059669'
                            : h.tipoEvento === 'ELIMINACION'
                            ? '#dc2626'
                            : h.tipoEvento === 'CAMBIO_VERSION'
                            ? '#2563eb'
                            : h.tipoEvento === 'CAMBIO_RUTA'
                            ? '#d97706'
                            : '#7c3aed';

                        const fechaEfectiva = (() => {
                          if (h.tipoEvento === 'EDICION_SHAREPOINT' && h.fechaModificacionActual && h.fechaModificacionActual !== 'N/A' && h.fechaModificacionActual !== 'Sincronizado') {
                            return staffService.formatearFechaHora(h.fechaModificacionActual);
                          }
                          return staffService.formatearFechaHora(h.fechaHora || h.fechaModificacionActual || doc.modificacion || 'Sincronizado');
                        })();

                        const descripcionHito = (() => {
                          if (h.tipoEvento === 'EDICION_SHAREPOINT') {
                            if (h.fechaModificacionPrevia && h.fechaModificacionActual && h.fechaModificacionPrevia !== 'N/A' && h.fechaModificacionPrevia !== h.fechaModificacionActual) {
                              return `Edición en SharePoint: Previa [${staffService.formatearFechaHora(h.fechaModificacionPrevia)}] ➔ Actual [${staffService.formatearFechaHora(h.fechaModificacionActual)}]`;
                            }
                            if (h.detalle && h.detalle.trim() && h.detalle.trim().toLowerCase() !== 'creacion del documento') {
                              return h.detalle.trim();
                            }
                            if (h.fechaModificacionActual && h.fechaModificacionActual !== 'N/A') {
                              return `Fecha de modificación en SharePoint: ${staffService.formatearFechaHora(h.fechaModificacionActual)}`;
                            }
                            return 'Edición y sincronización de documento en repositorio SharePoint.';
                          }
                          if (h.tipoEvento === 'CREACION') {
                            return h.detalle && h.detalle.trim() ? h.detalle.trim() : (tipoCambio || 'Creación inicial del documento en repositorio institucional.');
                          }
                          return h.detalle && h.detalle.trim() ? h.detalle.trim() : (tipoCambio || 'Registro de trazabilidad y control de cambios.');
                        })();

                        const vItem = staffService.formatearVersion(h.versionNueva || doc.version || '01');

                        return `
                          <div class="timeline-item ${esActual ? 'current' : ''}">
                            <div class="timeline-dot ${esActual ? '' : 'past'}" style="${esActual ? `background: ${badgeColor}; border-color: ${badgeColor};` : ''}"></div>
                            <div class="timeline-content">
                              <div class="timeline-header">
                                <span class="timeline-version" style="display: flex; align-items: center; gap: 6px;">
                                  <span style="background: ${badgeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700;">
                                    ${h.tipoEvento}
                                  </span>
                                  ${vItem} ${esActual ? '(Vigente)' : ''}
                                </span>
                                <span class="timeline-date">${fechaEfectiva}</span>
                              </div>
                              <p class="timeline-desc" style="margin-top: 4px; color: #334155; font-size: 0.78rem;">
                                ${descripcionHito}
                              </p>
                              <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">
                                <strong>${h.usuario || 'Colaborador SGC'}</strong> (${h.cargo || 'Calidad'})
                              </div>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
                  : `
                    <div class="timeline-item current">
                      <div class="timeline-dot"></div>
                      <div class="timeline-content">
                        <div class="timeline-header">
                          <span class="timeline-version">${staffService.formatearVersion(rawVer)} (Vigente)</span>
                          <span class="timeline-date">${staffService.formatearFechaHora(doc.modificacion)}</span>
                        </div>
                        <p class="timeline-desc" style="font-size:0.78rem; color:#334155;">
                          ${tipoCambio || 'Documento oficial registrado y validado en el repositorio maestro institucional.'}
                        </p>
                      </div>
                    </div>
                  `
              }
            </div>
          </div>

        </div>

        <!-- Pie de Acciones del Drawer -->
        <div class="doc-drawer-footer" style="display: grid; grid-template-columns: ${modoEdicion ? (puedeGestionarCatalogo ? '1fr 1fr 1fr' : '1fr 1fr') : '1fr'}; gap: 8px; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #ffffff; align-items: center;">
          ${
            modoEdicion
              ? `
              <button type="button" class="btn" id="btn-drawer-edit-sp" style="height: 40px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; background: #1f4260; color: #ffffff; border: 1px solid #16334c; cursor: pointer; transition: all 0.2s ease; ${!doc.disponible ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${!doc.disponible ? 'disabled' : ''} title="Editar documento en SharePoint">
                <span style="font-size: 0.95rem;">✏️</span>
                <span>SharePoint</span>
              </button>
              ${
                puedeGestionarCatalogo
                  ? `
                  <button type="button" class="btn" id="btn-drawer-edit-meta" style="height: 40px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; background: #e0f2fe; color: #0369a1; border: 1.5px solid #bae6fd; cursor: pointer; transition: all 0.2s ease;" title="Editar Ficha Técnica / Metadatos">
                    <span style="font-size: 0.95rem;">⚙️</span>
                    <span>Metadatos</span>
                  </button>
                  `
                  : ''
              }
              <button type="button" class="btn" id="btn-drawer-download" style="height: 40px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; cursor: pointer; transition: all 0.2s ease; ${!doc.disponible ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${!doc.disponible ? 'disabled' : ''} title="Descargar documento">
                <span style="font-size: 0.95rem;">📥</span>
                <span>Descargar</span>
              </button>
              `
              : !doc.disponible
              ? `<button class="btn btn-disabled" disabled style="grid-column: 1 / -1; width:100%; font-size:0.85rem; font-weight:700; height:40px; border-radius: 8px;">DOCUMENTO NO DISPONIBLE</button>`
              : doc.descargable === false
              ? `<button type="button" class="btn btn-secondary" id="btn-drawer-blocked" style="grid-column: 1 / -1; width:100%; font-size:0.85rem; font-weight:700; color:#92400e; background:#fef3c7; border-color:#f59e0b; height:40px; border-radius: 8px;">🔒 DESCARGA RESTRINGIDA</button>`
              : `
              <button type="button" class="btn btn-primary" id="btn-drawer-download" style="grid-column: 1 / -1; width:100%; background-color: var(--primary); font-size:0.88rem; font-weight:700; display:inline-flex; align-items:center; justify-content:center; gap:6px; height:40px; border-radius: 8px;" title="Descargar documento">
                <span>DESCARGAR 📥</span>
              </button>
              `
          }
        </div>

      </aside>
    `;

    // Vincular Eventos de Pestañas
    this.drawerContainer.querySelectorAll('.doc-drawer-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.drawerContainer.querySelectorAll('.doc-drawer-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.drawerContainer.querySelectorAll('.drawer-tab-content').forEach((c) => {
          c.style.display = 'none';
        });
        const content = this.drawerContainer.querySelector(`#drawer-tab-${tab}`);
        if (content) content.style.display = 'flex';
      });
    });

    // Vincular Cierre
    this.drawerContainer.querySelector('#btn-drawer-close')?.addEventListener('click', () => this.cerrarDrawer());
    this.drawerContainer.querySelector('#drawer-backdrop')?.addEventListener('click', () => this.cerrarDrawer());

    // Vincular Acciones
    this.drawerContainer.querySelector('#btn-drawer-open-folder')?.addEventListener('click', () => {
      sharepointService.abrirCarpetaUbicacion(doc);
      staffService.registrarAuditoria('CARPETA', {
        documentoCodigo: doc.codigo,
        documentoTitulo: doc.titulo,
        documentoExtension: doc.extension
      });
    });

    const btnDrawerDown = this.drawerContainer.querySelector('#btn-drawer-download');
    btnDrawerDown?.addEventListener('click', async () => {
      const estrategiaDescarga = determinarEstrategiaDescarga(doc);
      if (estrategiaDescarga.esPdf) {
        const textoOriginal = btnDrawerDown.innerHTML;
        btnDrawerDown.disabled = true;
        btnDrawerDown.classList.add('btn-downloading');
        btnDrawerDown.innerHTML = '<span>⏳</span> <span>Descargando...</span>';

        try {
          if (typeof onDescargar === 'function') {
            await onDescargar(doc);
          } else {
            await sharepointService.descargarDocumento(doc, modoEdicion);
          }
        } finally {
          btnDrawerDown.disabled = false;
          btnDrawerDown.classList.remove('btn-downloading');
          btnDrawerDown.innerHTML = textoOriginal;
        }
      } else {
        if (typeof onDescargar === 'function') {
          onDescargar(doc);
        } else {
          sharepointService.descargarDocumento(doc, modoEdicion);
        }
      }
    });

    this.drawerContainer.querySelector('#btn-drawer-edit-sp')?.addEventListener('click', () => {
      if (typeof onEditarSharePoint === 'function') {
        onEditarSharePoint(doc);
      } else {
        sharepointService.abrirEnEdicion(doc);
      }
    });

    this.drawerContainer.querySelector('#btn-drawer-edit-meta')?.addEventListener('click', () => {
      this.abrirModalEditarDocumento(doc, {
        onGuardar: (docAct) => {
          if (typeof onActualizarDoc === 'function') onActualizarDoc(docAct);
          this.abrirDrawerDocumento(docAct, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc, onEliminarDoc);
        }
      });
    });
  }

  /**
   * Alias de compatibilidad: redirige la apertura de detalle hacia el nuevo Drawer lateral
   */
  abrirDetalleDocumento(doc, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc = null, onEliminarDoc = null) {
    this.abrirDrawerDocumento(doc, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc, onEliminarDoc);
  }

  /**
   * Modal de Configuración General del Sistema
   */
  abrirConfiguracion({
    perfilActual = 'operativo',
    modoEdicion = false,
    documentos = [],
    onCambiarPerfil = null,
    onSincronizar = null,
    onCambiarVista = null,
    onActualizarFiltrosPorDefecto = null,
    vistaCatalogoActual = 'tabla',
    activeTab = 'preferencias',
    successMsgPerfil = null
  }) {
    if (!this.modalContainer) return;
    document.body.classList.add('modal-open');

    const sesionActiva = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
    const vistaActivaReal = staffService.obtenerPreferenciaVistaCatalogo(sesionActiva?.identificacion) || vistaCatalogoActual || 'tabla';
    vistaCatalogoActual = vistaActivaReal;
    let perfilSeleccionado = perfilActual;
    const perfilBaseUsuario = Boolean(
      sesionActiva && (
        sesionActiva.identificacion === '8160602' ||
        sesionActiva.perfil === 'total' ||
        sesionActiva.perfil === 'administrador'
      )
    );
    const esAdmin = perfilSeleccionado === 'total' || perfilSeleccionado === 'administrador' || perfilBaseUsuario;
    const esOperativo = perfilSeleccionado === 'operativo' && !perfilBaseUsuario;
    if (!esAdmin && (activeTab === 'perfiles' || activeTab === 'maestras')) {
      activeTab = 'preferencias';
    }
    if (esOperativo && (activeTab === 'sincronizar' || activeTab === 'edicion' || activeTab === 'perfiles' || activeTab === 'maestras')) {
      activeTab = 'preferencias';
    }

    // Listas maestras para filtros por defecto
    const tiposProcesoUnicos = [...new Set(documentos.map((d) => d.tipoProceso).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const areasUnicas = [...new Set(documentos.map((d) => d.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const procesosUnicos = [...new Set(documentos.map((d) => d.proceso).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    const filtrosDefecto = staffService.obtenerFiltrosPorDefecto(sesionActiva?.identificacion) || {};

    // Conteo de documentos por perfil según las nuevas reglas
    const conteoAdminTotal = documentos.length;
    const conteoDirectivo = documentos.length; // Directivo ve todos los documentos
    const conteoAdmin = documentos.filter((d) => d.permisoAdministrativo === true || d.permisoOperativo === true || d.permisoAdministrativo !== false || d.permisoOperativo !== false).length;
    const conteoOperativo = documentos.filter((d) => d.permisoOperativo === true || (d.permisoOperativo !== false && d.permisoOperativo !== 'false')).length;

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card modal-card-settings animate-scale-up" style="width: 820px; max-width: 95vw; height: 540px; min-height: 540px; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
          
          <!-- Cabecera del Modal -->
          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 16px 22px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">⚙️</span>
              <div>
                <h2 style="font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; margin: 0; color: #ffffff;">
                  Configuración del Sistema
                </h2>
                <span style="font-size: 0.76rem; color: #cbd5e1;">
                  Preferencias de diseño, perfiles de acceso (RBAC), usuarios y seguridad
                </span>
              </div>
            </div>
            <button type="button" class="modal-close-btn" id="btn-settings-close" style="color: #ffffff; background: rgba(255,255,255,0.15); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; font-size: 1.2rem; cursor: pointer;">
              ✕
            </button>
          </div>

          <!-- Barra de Pestañas -->
          <div class="settings-tabs-nav">
            <button type="button" class="settings-tab-btn ${activeTab === 'preferencias' ? 'active' : ''}" data-tab="preferencias">
              <span>🎨</span> Preferencias
            </button>
            ${
              esAdmin
                ? `
                  <button type="button" class="settings-tab-btn ${activeTab === 'perfiles' ? 'active' : ''}" data-tab="perfiles">
                    <span>👤</span> Perfiles
                  </button>
                  <button type="button" class="settings-tab-btn ${activeTab === 'maestras' ? 'active' : ''}" data-tab="maestras">
                    <span>🏷️</span> Tablas Maestras
                  </button>
                `
                : ''
            }
            ${
              !esOperativo
                ? `
                <button type="button" class="settings-tab-btn ${activeTab === 'sincronizar' ? 'active' : ''}" data-tab="sincronizar">
                  <span>🔄</span> Sincronizar
                </button>
                `
                : ''
            }
          </div>

          <!-- Contenedor Desplazable de Contenido -->
          <div class="modal-body" style="padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column;">
            
            <!-- PESTAÑA: PERFILES (ASIGNACIÓN Y GESTIÓN DE PERFILES DE EMPLEADOS) - EXCLUSIVO ACCESO TOTAL -->
            ${
              esAdmin
                ? `
                <div class="settings-tab-content" id="tab-content-perfiles" style="display: ${activeTab === 'perfiles' ? 'flex' : 'none'}; flex-direction: column; gap: 8px; padding: 14px 18px;">
                  <!-- Buscador y Selector de Empleados Activos -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <div style="font-size: 0.88rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 6px;">
                        <span>🔍</span> Buscar y asignar perfiles especiales de empleados
                      </div>
                      <span id="badge-special-staff-count" style="font-size: 0.74rem; color: #166534; font-weight: 700; background: #dcfce7; border: 1px solid #86efac; padding: 2px 8px; border-radius: 9999px;">
                        ${(staffService.empleados?.length || 1305).toLocaleString()} empleados
                      </span>
                    </div>

                    <!-- Buscador en vivo con lista desplegable -->
                    <div style="position: relative;">
                      <input 
                        type="text" 
                        id="input-search-staff-special" 
                        placeholder="Escribe el nombre, cédula o cargo del colaborador para buscar..." 
                        autocomplete="off"
                        style="width: 100%; height: 34px; padding: 0 12px; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 0.82rem; background: #ffffff; box-sizing: border-box;"
                      />
                      <div id="staff-search-dropdown" style="display: none; position: absolute; top: 38px; left: 0; right: 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 8px 16px rgba(0,0,0,0.12); max-height: 170px; overflow-y: auto; z-index: 50;"></div>
                    </div>

                    <!-- Ficha del Colaborador Seleccionado & Asignación -->
                    <div id="selected-staff-card" style="display: none; background: #ffffff; border: 1.5px solid #cddde9; border-radius: 8px; padding: 12px 14px; margin-top: 10px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <div>
                          <div style="font-size: 0.88rem; font-weight: 700; color: #1e293b;" id="sel-staff-nombre">-</div>
                          <div style="font-size: 0.76rem; color: #475569; margin-top: 2px;">
                            <strong>Cédula:</strong> <span id="sel-staff-doc">-</span> | <strong>Cargo:</strong> <span id="sel-staff-cargo">-</span> (<span id="sel-staff-perfil-base" style="color: #64748b;">-</span>)
                          </div>
                          <div style="font-size: 0.74rem; color: #64748b; margin-top: 1px;">
                            <strong>Correo:</strong> <span id="sel-staff-email">-</span> | <strong>Sede:</strong> <span id="sel-staff-sede">-</span>
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div>
                            <label style="font-size: 0.74rem; font-weight: 700; color: var(--brand-navy); display: block; margin-bottom: 2px;">
                              Perfil Especial a Asignar:
                            </label>
                            <select id="select-special-profile" style="height: 34px; padding: 0 8px; border: 1.5px solid var(--primary, #376c95); border-radius: 6px; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); background: #edf5fa;">
                              <option value="total" selected>🛡️ Acceso Total (Por Defecto)</option>
                              <option value="directivo">👑 Directivo</option>
                              <option value="administrativo">💼 Administrativo</option>
                              <option value="operativo">👷 Operativo</option>
                            </select>
                          </div>

                          <button 
                            type="button" 
                            id="btn-save-special-profile" 
                            class="btn btn-primary" 
                            style="height: 34px; margin-top: 16px; padding: 0 16px; font-size: 0.82rem; font-weight: 700; background-color: var(--primary); white-space: nowrap;"
                          >
                            Guardar Perfil
                          </button>
                        </div>
                      </div>
                      <div id="special-profile-msg" style="font-size: 0.76rem; font-weight: 600; margin-top: 6px; display: none;"></div>
                    </div>
                  </div>

                  <!-- Tabla de Colaboradores con Perfiles Especiales Asignados -->
                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0;">
                    <!-- Filtros de Grupo: Especiales vs Operativos -->
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <div style="display: flex; gap: 5px; flex-wrap: wrap;" id="staff-group-filter-btns">
                        <button type="button" class="btn-audit-filter active" data-group="total">
                          🛡️ Acceso Total (<span id="count-group-total">0</span>)
                        </button>
                        <button type="button" class="btn-audit-filter" data-group="directivo">
                          👑 Directivo (<span id="count-group-directivo">0</span>)
                        </button>
                        <button type="button" class="btn-audit-filter" data-group="administrativo">
                          💼 Administrativo (<span id="count-group-administrativo">0</span>)
                        </button>
                        <button type="button" class="btn-audit-filter" data-group="operativo">
                          👷 Operativo (<span id="count-group-operativo">0</span>)
                        </button>
                        <button type="button" class="btn-audit-filter" data-group="todos">
                          👥 Todos (<span id="count-group-todos">0</span>)
                        </button>
                      </div>

                      <input type="text" id="search-special-profiles" placeholder="🔍 Filtrar asignaciones..." style="height: 28px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.76rem; width: 180px;" />
                    </div>

                    <div style="flex: 1; max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 1;">
                          <tr>
                            <th style="padding: 6px 8px; color: #475569;">Colaborador</th>
                            <th style="padding: 6px 8px; color: #475569;">Cédula</th>
                            <th style="padding: 6px 8px; color: #475569;">Cargo en Matriz</th>
                            <th style="padding: 6px 8px; color: #475569;" id="th-col-profile-title">Perfil Especial Asignado</th>
                            <th style="padding: 6px 8px; color: #475569; text-align: right;">Acciones</th>
                          </tr>
                        </thead>
                        <tbody id="tbody-special-profiles"></tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <!-- PESTAÑA: TABLAS MAESTRAS (PREFIJOS, TIPOS DE DOCUMENTO Y ÁREAS) -->
                <div class="settings-tab-content" id="tab-content-maestras" style="display: ${activeTab === 'maestras' ? 'flex' : 'none'}; flex-direction: column; gap: 10px; padding: 14px 18px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin: 0; display: flex; align-items: center; gap: 6px;">
                        <span>🏷️</span> Tablas Maestras Institucionales
                      </h3>
                      <p style="font-size: 0.76rem; color: #64748b; margin: 2px 0 0 0;">
                        Administración centralizada de tipos de documentos, prefijos, áreas y nomenclatura institucional.
                      </p>
                    </div>
                    <!-- Switcher de Sub-Tablas -->
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="maestras-subtab-btns">
                      <button type="button" class="btn-audit-filter active" data-subtab="tipos" id="btn-subtab-tipos" style="font-size: 0.76rem; padding: 4px 10px;">
                        📄 Tipos de Documento (<span id="count-maestra-tipos">0</span>)
                      </button>
                      <button type="button" class="btn-audit-filter" data-subtab="areas" id="btn-subtab-areas" style="font-size: 0.76rem; padding: 4px 10px;">
                        🏢 Áreas y Procesos (<span id="count-maestra-areas">0</span>)
                      </button>
                      <button type="button" class="btn-audit-filter" data-subtab="tipos-proceso" id="btn-subtab-tipos-proceso" style="font-size: 0.76rem; padding: 4px 10px;">
                        🧭 Tipos de Proceso (<span id="count-maestra-tipos-proceso">0</span>)
                      </button>
                    </div>
                  </div>

                  <!-- SECCIÓN 1: TIPOS DE DOCUMENTO Y PREFIJOS -->
                  <div id="section-maestra-tipos" style="display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <input type="text" id="search-maestra-tipos" placeholder="🔍 Filtrar tipos de documento..." style="height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; width: 220px;" />
                      <button type="button" id="btn-nuevo-tipo-doc" class="btn btn-primary" style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: linear-gradient(135deg, #265072 0%, #376c95 100%); display: flex; align-items: center; gap: 5px;">
                        <span>➕</span> Nuevo Tipo de Documento
                      </button>
                    </div>

                    <!-- Formulario Crear/Editar Tipo de Documento -->
                    <div id="form-box-tipo-doc" style="display: none; background: #edf5fa; border: 1.5px solid #cddde9; border-radius: 8px; padding: 12px 14px;">
                      <div style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 8px;" id="title-form-tipo-doc">
                        ➕ Agregar Nuevo Tipo de Documento
                      </div>
                      <input type="hidden" id="input-tipo-id" value="" />
                      <div style="display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 10px;">
                        <div>
                          <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                            Nombre del Tipo <span style="color:#dc2626;">*</span>
                          </label>
                          <input type="text" id="input-tipo-nombre" placeholder="Ej: Formato, Guía..." style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem; font-weight: 600;" />
                        </div>
                        <div>
                          <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                            Prefijo <span style="color:#dc2626;">*</span>
                          </label>
                          <input type="text" id="input-tipo-prefijo" placeholder="Ej: FMT, GU..." maxlength="5" style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem; font-weight: 800; text-transform: uppercase;" />
                        </div>
                        <div>
                          <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                            Descripción / Propósito
                          </label>
                          <input type="text" id="input-tipo-desc" placeholder="Ej: Registros de calidad..." style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem;" />
                        </div>
                      </div>
                      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                        <button type="button" id="btn-cancel-tipo-doc" class="btn btn-secondary" style="height: 28px; padding: 0 12px; font-size: 0.76rem;">Cancelar</button>
                        <button type="button" id="btn-save-tipo-doc" class="btn btn-primary" style="height: 28px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: var(--btn-action-bg, #2e6894);">💾 Guardar Tipo</button>
                      </div>
                    </div>

                    <!-- Tabla de Tipos de Documento -->
                    <div style="flex: 1; max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 1;">
                          <tr>
                            <th style="padding: 6px 10px; color: #475569;">Tipo de Documento</th>
                            <th style="padding: 6px 10px; color: #475569;">Prefijo</th>
                            <th style="padding: 6px 10px; color: #475569;">Descripción</th>
                            <th style="padding: 6px 10px; color: #475569; text-align: right;">Acciones</th>
                          </tr>
                        </thead>
                        <tbody id="tbody-maestra-tipos"></tbody>
                      </table>
                    </div>
                  </div>

                  <!-- SECCIÓN 2: ÁREAS INSTITUCIONALES Y PROCESOS ASOCIADOS -->
                  <div id="section-maestra-areas" style="display: none; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <input type="text" id="search-maestra-areas" placeholder="🔍 Filtrar áreas o procesos..." style="height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; width: 220px;" />
                      <button type="button" id="btn-nueva-area" class="btn btn-primary" style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: linear-gradient(135deg, #265072 0%, #376c95 100%); display: flex; align-items: center; gap: 5px;">
                        <span>➕</span> Nueva Área y Procesos
                      </button>
                    </div>

                    <!-- Formulario Crear/Editar Área y Procesos -->
                    <div id="form-box-area" style="display: none; background: #edf5fa; border: 1.5px solid #cddde9; border-radius: 8px; padding: 12px 14px;">
                      <div style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 8px;" id="title-form-area">
                        ➕ Agregar Nueva Área y Procesos
                      </div>
                      <input type="hidden" id="input-area-id" value="" />
                      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div>
                          <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                            Nombre del Área <span style="color:#dc2626;">*</span>
                          </label>
                          <input type="text" id="input-area-nombre" placeholder="Ej: Gestión Humana..." style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem; font-weight: 600;" />
                        </div>
                        <div>
                          <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                            Sigla / Abreviatura <span style="color:#dc2626;">*</span>
                          </label>
                          <input type="text" id="input-area-sigla" placeholder="Ej: GHU, GAD..." maxlength="5" style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem; font-weight: 800; text-transform: uppercase;" />
                        </div>
                      </div>
                      <div>
                        <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                          Procesos Asociados (separados por coma o salto de línea)
                        </label>
                        <textarea id="input-area-procesos" placeholder="Ej: Bienestar, Comunicaciones, Desempeño, Formación..." rows="2" style="width: 100%; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; resize: vertical; font-family: inherit;"></textarea>
                      </div>
                      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                        <button type="button" id="btn-cancel-area" class="btn btn-secondary" style="height: 28px; padding: 0 12px; font-size: 0.76rem;">Cancelar</button>
                        <button type="button" id="btn-save-area" class="btn btn-primary" style="height: 28px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: var(--btn-action-bg, #2e6894);">💾 Guardar Área</button>
                      </div>
                    </div>

                    <!-- Tabla de Áreas y Procesos -->
                    <div style="flex: 1; max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 1;">
                          <tr>
                            <th style="padding: 6px 10px; color: #475569; width: 25%;">Área Institucional</th>
                            <th style="padding: 6px 10px; color: #475569; width: 12%;">Sigla</th>
                            <th style="padding: 6px 10px; color: #475569; width: 48%;">Procesos Asociados</th>
                            <th style="padding: 6px 10px; color: #475569; text-align: right; width: 15%;">Acciones</th>
                          </tr>
                        </thead>
                        <tbody id="tbody-maestra-areas"></tbody>
                      </table>
                    </div>
                  </div>

                  <!-- SECCIÓN 3: TIPOS DE PROCESO (MACROPROCESOS) -->
                  <div id="section-maestra-tipos-proceso" style="display: none; flex-direction: column; gap: 10px; flex: 1; min-height: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <input type="text" id="search-maestra-tipos-proceso" placeholder="🔍 Filtrar tipos de proceso..." style="height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.78rem; width: 220px;" />
                      <button type="button" id="btn-nuevo-tipo-proceso" class="btn btn-primary" style="height: 30px; padding: 0 14px; font-size: 0.78rem; font-weight: 700; background: linear-gradient(135deg, #265072 0%, #376c95 100%); display: flex; align-items: center; gap: 5px;">
                        <span>➕</span> Nuevo Tipo de Proceso
                      </button>
                    </div>

                    <!-- Formulario Crear/Editar Tipo de Proceso -->
                    <div id="form-box-tipo-proceso" style="display: none; background: #edf5fa; border: 1.5px solid #cddde9; border-radius: 8px; padding: 12px 14px;">
                      <div style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 8px;" id="title-form-tipo-proceso">
                        ➕ Agregar Nuevo Tipo de Proceso
                      </div>
                      <input type="hidden" id="input-tipo-proceso-id" value="" />
                      <div>
                        <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                          Nombre del Tipo de Proceso <span style="color:#dc2626;">*</span>
                        </label>
                        <input type="text" id="input-tipo-proceso-nombre" placeholder="Ej: Apoyo, Calidad, Estratégico, Misional..." style="width: 100%; height: 32px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem; font-weight: 600;" />
                      </div>
                      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                        <button type="button" id="btn-cancel-tipo-proceso" class="btn btn-secondary" style="height: 28px; padding: 0 12px; font-size: 0.76rem;">Cancelar</button>
                        <button type="button" id="btn-save-tipo-proceso" class="btn btn-primary" style="height: 28px; padding: 0 14px; font-size: 0.76rem; font-weight: 700; background: var(--btn-action-bg, #2e6894);">💾 Guardar Tipo</button>
                      </div>
                    </div>

                    <!-- Tabla de Tipos de Proceso -->
                    <div style="flex: 1; max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
                      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 1;">
                          <tr>
                            <th style="padding: 6px 10px; color: #475569;">Tipo de Proceso</th>
                            <th style="padding: 6px 10px; color: #475569; text-align: right;">Acciones</th>
                          </tr>
                        </thead>
                        <tbody id="tbody-maestra-tipos-proceso"></tbody>
                      </table>
                    </div>
                  </div>
                </div>
                `
                : ''
            }

            <!-- PESTAÑA: PREFERENCIAS (DISEÑO Y FILTROS POR DEFECTO DEL CATÁLOGO) -->
            <div class="settings-tab-content" id="tab-content-preferencias" style="display: ${activeTab === 'preferencias' ? 'flex' : 'none'}; flex-direction: column; gap: 14px; padding: 18px 22px;">
              <!-- Sección 1: Modo de Visualización -->
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin: 0 0 4px 0;">
                  Diseño y Visualización del Catálogo Documental
                </h3>
                <p style="font-size: 0.80rem; color: #64748b; margin: 0; line-height: 1.4;">
                  Elige cómo deseas explorar el repositorio institucional de documentos. Esta preferencia se recordará en tu cuenta y navegador.
                </p>
              </div>

              <div class="view-mode-selector-grid">
                <div class="view-mode-card ${vistaCatalogoActual === 'tarjetas' ? 'active' : ''}" id="card-view-mode-tarjetas" data-view="tarjetas">
                  <div class="view-mode-card-header">
                    <span class="view-mode-card-title"><span>🔲</span> Vista de Cuadrícula (Tarjetas)</span>
                    <span class="view-mode-status" style="color:var(--primary); font-size:0.80rem; font-weight:800;">${vistaCatalogoActual === 'tarjetas' ? '✓ Activo' : ''}</span>
                  </div>
                  <div class="view-mode-card-desc">
                    Presentación visual con tarjetas informativas, insignias de formato, estado y accesos directos. Ideal para exploración rápida.
                  </div>
                </div>

                <div class="view-mode-card ${vistaCatalogoActual === 'tabla' ? 'active' : ''}" id="card-view-mode-tabla" data-view="tabla">
                  <div class="view-mode-card-header">
                    <span class="view-mode-card-title"><span>☰</span> Vista de Tabla (Listado Detallado)</span>
                    <span class="view-mode-status" style="color:var(--primary); font-size:0.80rem; font-weight:800;">${vistaCatalogoActual === 'tabla' ? '✓ Activo' : ''}</span>
                  </div>
                  <div class="view-mode-card-desc">
                    Formato corporativo de alta densidad en tabla con columnas completas (Código, Tipo, Título, Proceso, Área, Versión, Fecha). Ideal para auditorías y búsqueda masiva.
                  </div>
                </div>
              </div>

              <!-- Sección 2: Filtros por Defecto al Iniciar el Sistema -->
              <div style="border-top: 1px solid #e2e8f0; margin-top: 2px; padding-top: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin: 0; display: flex; align-items: center; gap: 6px;">
                    <span>📌</span> Filtros por Defecto al Iniciar el Sistema
                  </h3>
                  <button type="button" id="btn-clear-default-filters" class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 600;">
                    🧹 Limpiar Filtros
                  </button>
                </div>
                <p style="font-size: 0.80rem; color: #64748b; margin: 0 0 10px 0; line-height: 1.4;">
                  Configura el Tipo de Proceso, Área o Proceso que deseas tener activos automáticamente al abrir la aplicación. Los cambios tienen efecto inmediato en el catálogo.
                </p>
              </div>

              <!-- Formulario de 3 Selectores -->
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                  <label for="select-default-tipo-proceso" style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">
                    1. Tipo de Proceso:
                  </label>
                  <select id="select-default-tipo-proceso" class="form-input" style="width: 100%; height: 32px; font-size: 0.78rem; padding: 0 6px; background: #ffffff;">
                    <option value="">(Todos los tipos de proceso)</option>
                    ${tiposProcesoUnicos.map((tp) => `<option value="${tp}" ${filtrosDefecto.tipoProceso === tp ? 'selected' : ''}>${tp}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label for="select-default-area" style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">
                    2. Área Institucional:
                  </label>
                  <select id="select-default-area" class="form-input" style="width: 100%; height: 32px; font-size: 0.78rem; padding: 0 6px; background: #ffffff;">
                    <option value="">(Todas las áreas)</option>
                    ${areasUnicas.map((ar) => `<option value="${ar}" ${filtrosDefecto.area === ar ? 'selected' : ''}>${ar}</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label for="select-default-proceso" style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">
                    3. Proceso:
                  </label>
                  <select id="select-default-proceso" class="form-input" style="width: 100%; height: 32px; font-size: 0.78rem; padding: 0 6px; background: #ffffff;">
                    <option value="">(Todos los procesos)</option>
                    ${procesosUnicos.map((pr) => `<option value="${pr}" ${filtrosDefecto.proceso === pr ? 'selected' : ''}>${pr}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- Cuadro Informativo / Aclaración -->
              <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px 12px; font-size: 0.77rem; color: #1e40af; line-height: 1.45; display: flex; gap: 8px; align-items: flex-start;">
                <span style="font-size: 1.1rem; flex-shrink: 0; line-height: 1;">ℹ️</span>
                <div>
                  <strong>Aclaración importante:</strong> Al tener filtros activos por defecto, las búsquedas del catálogo se enfocarán inicialmente en estas áreas y procesos seleccionados. Si en algún momento no encuentras un documento de otra área, simplemente presiona el botón <strong>"Restablecer filtros"</strong> en la barra lateral de la pantalla principal o ajusta esta configuración.
                </div>
              </div>

              <div id="view-mode-feedback-msg" style="display:none; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:6px; font-size:0.78rem; font-weight:600;">
                ✅ Preferencias y filtros actualizados correctamente
              </div>
            </div>

            <!-- PESTAÑA: ACTUALIZAR DATOS & RUTAS DE CONEXIÓN -->
            <div class="settings-tab-content" id="tab-content-sincronizar" style="display: none;">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 2px;">
                  Sincronización en Vivo y Fuentes de Datos
                </h3>
                <p style="font-size: 0.78rem; color: #64748b; line-height: 1.4; margin: 0;">
                  Actualización sincrónica de repositorios y configuración de rutas de conexión de datos del sistema.
                </p>
              </div>

              <!-- Bloque 1: Sincronización Manual Inmediata -->
              <div style="background: #edf5fa; border: 1.5px solid #cddde9; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                  <div>
                    <div style="font-size: 0.88rem; font-weight: 700; color: var(--brand-navy, #1f4260); display: flex; align-items: center; gap: 6px;">
                      <span>📡</span> Conexión al Repositorio Central y Matriz de Personal
                    </div>
                    <div style="font-size: 0.76rem; color: var(--primary, #376c95); margin-top: 1px;">
                      Descarga y actualiza inmediatamente los documentos, empleados y configuración desde las rutas activas.
                    </div>
                  </div>
                  <button 
                    type="button" 
                    id="btn-modal-sync-trigger" 
                    class="btn btn-primary" 
                    style="padding: 8px 16px; font-size: 0.84rem; font-weight: 700; background-color: var(--primary); display: flex; align-items: center; gap: 6px; white-space: nowrap;"
                  >
                    <span id="modal-sync-spinner" style="font-size: 1.0rem; display: inline-block;">🔄</span>
                    <span id="modal-sync-btn-text">Actualizar Datos Ahora</span>
                  </button>
                </div>
                <div id="modal-sync-status-msg" style="font-size: 0.76rem; color: #64748b; border-top: 1px solid #dbeafe; padding-top: 8px;">
                  ℹ️ Haz clic en el botón superior para forzar la sincronización en vivo.
                </div>
              </div>

              <!-- Bloque 2: Configuración de Rutas de Archivos (Exclusivo para Acceso Total / Administrador) -->
              ${
                esAdmin
                  ? `
                  <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="font-size: 0.86rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 6px;">
                          <span>🗂️</span> Rutas de Archivos de Configuración y Datos
                        </div>
                        <div style="font-size: 0.74rem; color: #64748b; margin-top: 1px;">
                          Permite configurar las rutas de EMPLEADOS_ACTIVOS.csv, REPOSITORIO_DOCUMENTAL.csv y usuarios.conf.
                        </div>
                      </div>
                      <button 
                        type="button" 
                        id="btn-unlock-routes" 
                        class="btn btn-secondary" 
                        style="padding: 6px 12px; font-size: 0.76rem; font-weight: 600; display: flex; align-items: center; gap: 4px;"
                      >
                        <span>🔒</span> Desbloquear Rutas
                      </button>
                    </div>

                    <!-- Formulario de Autenticación para Desbloqueo (Oculto por defecto) -->
                    <div id="routes-auth-box" style="display: none; background: #edf5fa; border: 1px solid #cddde9; border-radius: 6px; padding: 10px 12px;">
                      <div style="font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 6px;">
                        🔒 Ingresa tu contraseña de ingreso para habilitar la edición de rutas:
                      </div>
                      <div style="display: flex; gap: 8px;">
                        <input 
                          type="password" 
                          id="input-routes-pwd" 
                          name="routes_unlock_pwd_field"
                          placeholder="Tu contraseña personal..." 
                          autocomplete="new-password"
                          data-lpignore="true"
                          data-form-type="other"
                          value=""
                          style="flex: 1; height: 32px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.80rem;"
                        />
                        <button type="button" id="btn-confirm-routes-pwd" class="btn btn-primary" style="padding: 0 14px; height: 32px; font-size: 0.80rem; background-color: var(--primary);">
                          Validar
                        </button>
                        <button type="button" id="btn-cancel-routes-pwd" class="btn btn-secondary" style="padding: 0 10px; height: 32px; font-size: 0.80rem;">
                          Cancelar
                        </button>
                      </div>
                      <div id="routes-pwd-error" style="display: none; color: #dc2626; font-size: 0.74rem; font-weight: 600; margin-top: 4px;">
                        Contraseña incorrecta. Inténtalo nuevamente.
                      </div>
                    </div>

                    <!-- Inputs de las 2 Rutas de SharePoint / OneDrive -->
                    <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
                      <div>
                        <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                          1. EMPLEADOS_ACTIVOS.csv (Matriz de Colaboradores Activos):
                        </label>
                        <input 
                          type="text" 
                          id="input-route-empleados" 
                          disabled 
                          style="width: 100%; height: 30px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.76rem; background: #f8fafc; font-family: monospace; color: #334155;"
                        />
                      </div>

                      <div>
                        <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 2px;">
                          2. REPOSITORIO_DOCUMENTAL.csv (Repositorio de Documentos):
                        </label>
                        <input 
                          type="text" 
                          id="input-route-repositorio" 
                          disabled 
                          style="width: 100%; height: 30px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.76rem; background: #f8fafc; font-family: monospace; color: #334155;"
                        />
                      </div>
                    </div>

                    <!-- Botones de Guardar / Restablecer Rutas (Visibles cuando está desbloqueado) -->
                    <div id="routes-action-bar" style="display: none; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #f1f5f9;">
                      <button type="button" id="btn-reset-routes" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.76rem;">
                        ↩️ Restaurar por Defecto
                      </button>
                      <button type="button" id="btn-save-routes" class="btn btn-primary" style="padding: 6px 16px; font-size: 0.78rem; font-weight: 700; background-color: var(--primary);">
                        💾 Guardar Rutas y Aplicar
                      </button>
                    </div>
                    <div id="routes-save-msg" style="display: none; font-size: 0.76rem; font-weight: 600;"></div>
                  </div>
                  `
                  : ''
              }
            </div>

          </div>

          <!-- Pie del Modal -->
          <div class="modal-footer" style="padding: 12px 24px; background: #f8fafc; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-settings-close-bottom" style="padding: 8px 24px;">
              Listo
            </button>
          </div>

        </div>
      </div>
    `;

    // Manejo de cambio de pestañas
    const tabs = this.modalContainer.querySelectorAll('.settings-tab-btn');
    const contents = {
      perfiles: document.getElementById('tab-content-perfiles'),
      maestras: document.getElementById('tab-content-maestras'),
      preferencias: document.getElementById('tab-content-preferencias'),
      sincronizar: document.getElementById('tab-content-sincronizar')
    };

    // Aplicar visibilidad de pestaña activa inicial
    Object.keys(contents).forEach((k) => {
      if (contents[k]) {
        contents[k].style.display = k === activeTab ? 'flex' : 'none';
      }
    });

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-tab');
        Object.keys(contents).forEach((k) => {
          if (contents[k]) contents[k].style.display = k === target ? 'flex' : 'none';
        });

        // Cargar datos al abrir pestaña perfiles
        if (target === 'perfiles' && typeof renderListaColaboradoresEspeciales === 'function') {
          renderListaColaboradoresEspeciales();
        }
        // Cargar datos al abrir pestaña tablas maestras
        if (target === 'maestras') {
          if (typeof renderTablaMaestraTipos === 'function') renderTablaMaestraTipos();
          if (typeof renderTablaMaestraAreas === 'function') renderTablaMaestraAreas();
        }
      });
    });

    // ─── SELECTOR DE VISTA DUAL (TARJETAS VS TABLA) ───
    const cardTarjetas = document.getElementById('card-view-mode-tarjetas');
    const cardTabla = document.getElementById('card-view-mode-tabla');
    const feedbackVista = document.getElementById('view-mode-feedback-msg');

    const cambiarModoVisual = (nuevoModo) => {
      if (nuevoModo === 'tarjetas') {
        cardTarjetas?.classList.add('active');
        cardTabla?.classList.remove('active');
        if (cardTarjetas?.querySelector('.view-mode-status')) {
          cardTarjetas.querySelector('.view-mode-status').textContent = '✓ Activo';
        }
        if (cardTabla?.querySelector('.view-mode-status')) {
          cardTabla.querySelector('.view-mode-status').textContent = '';
        }
      } else {
        cardTabla?.classList.add('active');
        cardTarjetas?.classList.remove('active');
        if (cardTabla?.querySelector('.view-mode-status')) {
          cardTabla.querySelector('.view-mode-status').textContent = '✓ Activo';
        }
        if (cardTarjetas?.querySelector('.view-mode-status')) {
          cardTarjetas.querySelector('.view-mode-status').textContent = '';
        }
      }

      localStorage.setItem('usv_vista_catalogo', nuevoModo);
      staffService.guardarPreferenciaUsuario('vistaCatalogo', nuevoModo);

      if (feedbackVista) {
        feedbackVista.style.display = 'block';
        setTimeout(() => {
          if (feedbackVista) feedbackVista.style.display = 'none';
        }, 2200);
      }

      if (typeof onCambiarVista === 'function') {
        onCambiarVista(nuevoModo);
      }
    };

    cardTarjetas?.addEventListener('click', () => cambiarModoVisual('tarjetas'));
    cardTabla?.addEventListener('click', () => cambiarModoVisual('tabla'));

    // ─── PERFILES ESPECIALES A EMPLEADOS ACTIVOS (Lógica) ───
    let empleadoSeleccionadoParaPerfil = null;
    let grupoColaboradoresActual = 'total'; // 'total' | 'directivo' | 'administrativo' | 'operativo' | 'todos'

    const renderListaColaboradoresEspeciales = (filtro = '') => {
      const tbody = document.getElementById('tbody-special-profiles');
      if (!tbody) return;

      const q = (filtro || '').toLowerCase().trim();
      const todos = staffService.obtenerColaboradoresConPerfilesEspeciales();

      const totalList = todos.filter((u) => {
        const p = u.perfilEspecial || u.perfilBase || 'operativo';
        return p === 'total' || p === 'administrador';
      });
      const directivoList = todos.filter((u) => (u.perfilEspecial || u.perfilBase || 'operativo') === 'directivo');
      const adminList = todos.filter((u) => (u.perfilEspecial || u.perfilBase || 'operativo') === 'administrativo');
      const operativoList = todos.filter((u) => (u.perfilEspecial || u.perfilBase || 'operativo') === 'operativo');

      const countTotEl = document.getElementById('count-group-total');
      const countDirEl = document.getElementById('count-group-directivo');
      const countAdmEl = document.getElementById('count-group-administrativo');
      const countOpeEl = document.getElementById('count-group-operativo');
      const countTodEl = document.getElementById('count-group-todos');
      if (countTotEl) countTotEl.textContent = totalList.length;
      if (countDirEl) countDirEl.textContent = directivoList.length;
      if (countAdmEl) countAdmEl.textContent = adminList.length;
      if (countOpeEl) countOpeEl.textContent = operativoList.length;
      if (countTodEl) countTodEl.textContent = todos.length;

      const thTitle = document.getElementById('th-col-profile-title');
      if (thTitle) {
        if (grupoColaboradoresActual === 'total') {
          thTitle.textContent = 'Perfil Actual (Acceso Total)';
        } else if (grupoColaboradoresActual === 'directivo') {
          thTitle.textContent = 'Perfil Actual (Directivo)';
        } else if (grupoColaboradoresActual === 'administrativo') {
          thTitle.textContent = 'Perfil Actual (Administrativo)';
        } else if (grupoColaboradoresActual === 'operativo') {
          thTitle.textContent = 'Perfil Actual (Operativo)';
        } else {
          thTitle.textContent = 'Perfil Asignado';
        }
      }

      let lista = todos;
      if (grupoColaboradoresActual === 'total') {
        lista = totalList;
      } else if (grupoColaboradoresActual === 'directivo') {
        lista = directivoList;
      } else if (grupoColaboradoresActual === 'administrativo') {
        lista = adminList;
      } else if (grupoColaboradoresActual === 'operativo') {
        lista = operativoList;
      }

      if (q) {
        lista = lista.filter((u) => {
          const t = `${u.nombre || ''} ${u.identificacion || ''} ${u.cargo || ''} ${u.email || ''}`.toLowerCase();
          return t.includes(q);
        });
      }

      // Ordenar colaboradores estrictamente por orden alfabético A-Z
      lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));

      if (lista.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 18px; color: #94a3b8;">
              ${q ? 'No hay colaboradores que coincidan con la búsqueda.' : 'No hay colaboradores en esta categoría.'}
            </td>
          </tr>
        `;
        return;
      }

      const badgesPerfil = {
        total: '<span style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:2px 8px; border-radius:12px; font-weight:700;">🛡️ Acceso Total</span>',
        directivo: '<span style="background:#fdf4ff; color:#86198f; border:1px solid #f5d0fe; padding:2px 8px; border-radius:12px; font-weight:700;">👑 Directivo</span>',
        administrativo: '<span style="background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:2px 8px; border-radius:12px; font-weight:700;">💼 Administrativo</span>',
        operativo: '<span style="background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; padding:2px 8px; border-radius:12px; font-weight:700;">👷 Operativo</span>'
      };

      tbody.innerHTML = lista
        .map((u) => {
          const tieneEspecial = Boolean(u.perfilEspecial);
          const perfilMostrar = u.perfilEspecial || u.perfilBase || 'operativo';
          const badgeHtml = badgesPerfil[perfilMostrar] || `<span style="text-transform:capitalize;">${perfilMostrar}</span>`;

          return `
            <tr style="border-bottom: 1px solid #f1f5f9;" data-row-doc="${u.identificacion}">
              <td style="padding: 6px 8px; font-weight: 600; color: #1e293b;">
                ${u.nombre}
                ${u.email ? `<div style="font-size: 0.70rem; color: #64748b; font-weight: 400;">${u.email}</div>` : ''}
              </td>
              <td style="padding: 6px 8px; color: #475569; font-family: monospace;">${u.identificacion}</td>
              <td style="padding: 6px 8px; color: #475569;">${u.cargo}</td>
              <td style="padding: 6px 8px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <select class="select-inline-special-profile" data-doc="${u.identificacion}" data-original="${perfilMostrar}" style="height: 26px; font-size: 0.76rem; border: 1.5px solid #cbd5e1; border-radius: 4px; padding: 0 4px; background: #ffffff; color: var(--brand-navy); font-weight: 600;">
                    <option value="total" ${perfilMostrar === 'total' ? 'selected' : ''}>🛡️ Acceso Total</option>
                    <option value="directivo" ${perfilMostrar === 'directivo' ? 'selected' : ''}>👑 Directivo</option>
                    <option value="administrativo" ${perfilMostrar === 'administrativo' ? 'selected' : ''}>💼 Administrativo</option>
                    <option value="operativo" ${perfilMostrar === 'operativo' ? 'selected' : ''}>👷 Operativo</option>
                  </select>
                </div>
              </td>
              <td style="padding: 6px 8px; text-align: right; white-space: nowrap;">
                <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                  <button type="button" class="btn-save-inline-profile" data-doc="${u.identificacion}" style="display: none; background: #16a34a; color: #ffffff; border: none; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; font-weight: 700; cursor: pointer; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(22,163,74,0.3);" title="Confirmar y guardar cambio de perfil">
                    <span>💾</span> Guardar
                  </button>
                  ${
                    tieneEspecial
                      ? `<button type="button" class="btn-remove-special-profile" data-doc="${u.identificacion}" title="Quitar perfil especial y restaurar perfil base" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.95rem; padding: 2px 4px;">🗑️</button>`
                      : `<span class="tag-base-profile" style="color:#94a3b8; font-size:0.72rem;">Base</span>`
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      // Detección de cambio en select inline para habilitar botón Guardar
      tbody.querySelectorAll('.select-inline-special-profile').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const docNum = sel.getAttribute('data-doc');
          const original = sel.getAttribute('data-original');
          const nuevoPerf = e.target.value;
          const row = tbody.querySelector(`tr[data-row-doc="${docNum}"]`);
          const btnSave = row ? row.querySelector('.btn-save-inline-profile') : null;

          if (nuevoPerf !== original) {
            sel.style.borderColor = '#16a34a';
            sel.style.backgroundColor = '#f0fdf4';
            if (btnSave) {
              btnSave.style.display = 'inline-flex';
            }
          } else {
            sel.style.borderColor = '#cbd5e1';
            sel.style.backgroundColor = '#ffffff';
            if (btnSave) {
              btnSave.style.display = 'none';
            }
          }
        });
      });

      // Eventos del botón Guardar en la columna de Acciones
      tbody.querySelectorAll('.btn-save-inline-profile').forEach((btnSave) => {
        btnSave.addEventListener('click', async () => {
          const docNum = btnSave.getAttribute('data-doc');
          const row = tbody.querySelector(`tr[data-row-doc="${docNum}"]`);
          const sel = row ? row.querySelector('.select-inline-special-profile') : null;
          if (!sel) return;

          const nuevoPerf = sel.value;
          btnSave.disabled = true;
          btnSave.innerHTML = `<span>⏳</span> Guardando...`;

          await staffService.asignarPerfilPersonalizado(docNum, nuevoPerf);
          renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
        });
      });

      // Eventos de eliminar asignación
      tbody.querySelectorAll('.btn-remove-special-profile').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const docNum = btn.getAttribute('data-doc');
          if (confirm(`¿Deseas restaurar el perfil base de este colaborador?`)) {
            await staffService.removerPerfilPersonalizado(docNum);
            renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
          }
        });
      });
    };

    // Botones de filtro de grupo (Especiales vs Operativos vs Todos)
    const staffGroupFilterBtns = this.modalContainer.querySelectorAll('#staff-group-filter-btns .btn-audit-filter');
    staffGroupFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        staffGroupFilterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        grupoColaboradoresActual = btn.getAttribute('data-group') || 'total';
        renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
      });
    });

    // Buscador interactivo de empleados activos
    const inputSearchStaff = document.getElementById('input-search-staff-special');
    const dropdownStaff = document.getElementById('staff-search-dropdown');
    const cardSelectedStaff = document.getElementById('selected-staff-card');

    if (inputSearchStaff && dropdownStaff) {
      inputSearchStaff.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          dropdownStaff.style.display = 'none';
          return;
        }

        const resultados = staffService.buscarColaboradores(query, 8);
        if (resultados.length === 0) {
          dropdownStaff.innerHTML = '<div style="padding: 10px 14px; font-size: 0.78rem; color: #94a3b8; text-align: center;">No se encontraron empleados activos con ese criterio.</div>';
          dropdownStaff.style.display = 'block';
          return;
        }

        dropdownStaff.innerHTML = resultados
          .map((emp) => `
            <div class="staff-dropdown-item" data-doc="${emp.identificacion}" style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s ease;">
              <div>
                <div style="font-size: 0.80rem; font-weight: 700; color: #1e293b;">${emp.nombre}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${emp.cargo} • Sede ${emp.sede || 'Principal'}</div>
              </div>
              <span style="font-size: 0.74rem; font-weight: 600; color: var(--primary, #376c95); background: #edf5fa; padding: 2px 6px; border-radius: 4px;">CC ${emp.identificacion}</span>
            </div>
          `)
          .join('');

        dropdownStaff.style.display = 'block';

        dropdownStaff.querySelectorAll('.staff-dropdown-item').forEach((item) => {
          item.addEventListener('mouseenter', () => { item.style.background = '#f0f7ff'; });
          item.addEventListener('mouseleave', () => { item.style.background = '#ffffff'; });
          item.addEventListener('click', () => {
            const docNum = item.getAttribute('data-doc');
            const emp = staffService.buscarPorDocumento(docNum);
            if (emp) {
              empleadoSeleccionadoParaPerfil = emp;
              inputSearchStaff.value = `${emp.nombre} (CC ${emp.identificacion})`;
              dropdownStaff.style.display = 'none';

              // Mostrar ficha
              if (cardSelectedStaff) {
                document.getElementById('sel-staff-nombre').textContent = emp.nombre;
                document.getElementById('sel-staff-doc').textContent = emp.identificacion;
                document.getElementById('sel-staff-cargo').textContent = emp.cargo;
                document.getElementById('sel-staff-perfil-base').textContent = `Perfil base por cargo: ${staffService.determinarPerfil(emp.cargo, '')}`;
                document.getElementById('sel-staff-email').textContent = emp.email || 'N/A';
                document.getElementById('sel-staff-sede').textContent = emp.sede || 'Principal';
                cardSelectedStaff.style.display = 'block';
              }
            }
          });
        });
      });

      // Cerrar dropdown al hacer clic fuera
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#input-search-staff-special') && !e.target.closest('#staff-search-dropdown')) {
          dropdownStaff.style.display = 'none';
        }
      });

      // Guardar asignación
      document.getElementById('btn-save-special-profile')?.addEventListener('click', async () => {
        if (!empleadoSeleccionadoParaPerfil) {
          alert('Por favor busca y selecciona un colaborador primero.');
          return;
        }

        const perfilEspecial = document.getElementById('select-special-profile')?.value || 'total';
        const msg = document.getElementById('special-profile-msg');
        const btnSave = document.getElementById('btn-save-special-profile');

        const nombreColab = empleadoSeleccionadoParaPerfil.nombre;
        const idColab = empleadoSeleccionadoParaPerfil.identificacion;

        await staffService.asignarPerfilPersonalizado(idColab, perfilEspecial);

        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Guardar Perfil';
        }

        // Restablecer el buscador y la vista al estado inicial
        if (inputSearchStaff) inputSearchStaff.value = '';
        if (dropdownStaff) dropdownStaff.style.display = 'none';
        if (cardSelectedStaff) cardSelectedStaff.style.display = 'none';
        empleadoSeleccionadoParaPerfil = null;

        // Notificación de éxito
        if (window.antigravityApp?.mostrarToast) {
          window.antigravityApp.mostrarToast(`✅ Perfil "${perfilEspecial.toUpperCase()}" asignado con éxito a ${nombreColab}.`, 'success');
        }

        renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
      });

      document.getElementById('search-special-profiles')?.addEventListener('input', (e) => {
        renderListaColaboradoresEspeciales(e.target.value);
      });
    }

    if (esAdmin) {
      renderListaColaboradoresEspeciales();
    }

    // ─── TABLAS MAESTRAS (Lógica) ───
    const sectionTipos = document.getElementById('section-maestra-tipos');
    const sectionAreas = document.getElementById('section-maestra-areas');
    const sectionTiposProceso = document.getElementById('section-maestra-tipos-proceso');
    const btnSubtabTipos = document.getElementById('btn-subtab-tipos');
    const btnSubtabAreas = document.getElementById('btn-subtab-areas');
    const btnSubtabTiposProceso = document.getElementById('btn-subtab-tipos-proceso');

    btnSubtabTipos?.addEventListener('click', () => {
      btnSubtabTipos.classList.add('active');
      btnSubtabAreas?.classList.remove('active');
      btnSubtabTiposProceso?.classList.remove('active');
      if (sectionTipos) sectionTipos.style.display = 'flex';
      if (sectionAreas) sectionAreas.style.display = 'none';
      if (sectionTiposProceso) sectionTiposProceso.style.display = 'none';
      renderTablaMaestraTipos(document.getElementById('search-maestra-tipos')?.value || '');
    });

    btnSubtabAreas?.addEventListener('click', () => {
      btnSubtabAreas.classList.add('active');
      btnSubtabTipos?.classList.remove('active');
      btnSubtabTiposProceso?.classList.remove('active');
      if (sectionAreas) sectionAreas.style.display = 'flex';
      if (sectionTipos) sectionTipos.style.display = 'none';
      if (sectionTiposProceso) sectionTiposProceso.style.display = 'none';
      renderTablaMaestraAreas(document.getElementById('search-maestra-areas')?.value || '');
    });

    btnSubtabTiposProceso?.addEventListener('click', () => {
      btnSubtabTiposProceso.classList.add('active');
      btnSubtabTipos?.classList.remove('active');
      btnSubtabAreas?.classList.remove('active');
      if (sectionTiposProceso) sectionTiposProceso.style.display = 'flex';
      if (sectionTipos) sectionTipos.style.display = 'none';
      if (sectionAreas) sectionAreas.style.display = 'none';
      renderTablaMaestraTiposProceso(document.getElementById('search-maestra-tipos-proceso')?.value || '');
    });

    const renderTablaMaestraTipos = (filtro = '') => {
      const tbody = document.getElementById('tbody-maestra-tipos');
      const countEl = document.getElementById('count-maestra-tipos');
      if (!tbody) return;

      const q = (filtro || '').toLowerCase().trim();
      let tipos = [...staffService.obtenerTiposDocumento()]
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
      if (countEl) countEl.textContent = tipos.length;

      if (q) {
        tipos = tipos.filter((t) => (t.nombre || '').toLowerCase().includes(q) || (t.prefijo || '').toLowerCase().includes(q) || (t.descripcion || '').toLowerCase().includes(q));
      }

      if (tipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 14px; text-align: center; color: #94a3b8;">No hay tipos de documento que coincidan.</td></tr>';
        return;
      }

      tbody.innerHTML = tipos
        .map(
          (t) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 10px; font-weight: 700; color: #1e293b;">${t.nombre}</td>
            <td style="padding: 8px 10px;">
              <span style="background: #edf5fa; color: var(--brand-navy, #1f4260); border: 1px solid #cddde9; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-family: monospace;">${t.prefijo}</span>
            </td>
            <td style="padding: 8px 10px; color: #64748b; font-size: 0.74rem;">${t.descripcion || '-'}</td>
            <td style="padding: 8px 10px; text-align: right; white-space: nowrap;">
              <button type="button" class="btn-edit-tipo-doc" data-id="${t.id}" data-nombre="${t.nombre}" data-prefijo="${t.prefijo}" data-desc="${t.descripcion || ''}" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; margin-right: 4px; font-weight: 600;">
                ✏️ Editar
              </button>
              <button type="button" class="btn-delete-tipo-doc" data-id="${t.id}" data-nombre="${t.nombre}" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                🗑️
              </button>
            </td>
          </tr>
        `
        )
        .join('');

      tbody.querySelectorAll('.btn-edit-tipo-doc').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');
          const pref = btn.getAttribute('data-prefijo');
          const desc = btn.getAttribute('data-desc');

          const formBox = document.getElementById('form-box-tipo-doc');
          const titleBox = document.getElementById('title-form-tipo-doc');
          const inputId = document.getElementById('input-tipo-id');
          const inputNom = document.getElementById('input-tipo-nombre');
          const inputPref = document.getElementById('input-tipo-prefijo');
          const inputDesc = document.getElementById('input-tipo-desc');

          if (formBox) {
            formBox.style.display = 'block';
            if (titleBox) titleBox.textContent = `✏️ Modificar Tipo: ${nom}`;
            if (inputId) inputId.value = id;
            if (inputNom) inputNom.value = nom;
            if (inputPref) inputPref.value = pref;
            if (inputDesc) inputDesc.value = desc;
            inputNom?.focus();
          }
        };
      });

      tbody.querySelectorAll('.btn-delete-tipo-doc').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');
          if (confirm(`¿Estás seguro de eliminar el tipo de documento "${nom}" de la tabla maestra?`)) {
            await staffService.eliminarTipoDocumento(id);
            renderTablaMaestraTipos(document.getElementById('search-maestra-tipos')?.value || '');
          }
        };
      });
    };

    const renderTablaMaestraAreas = (filtro = '') => {
      const tbody = document.getElementById('tbody-maestra-areas');
      const countEl = document.getElementById('count-maestra-areas');
      if (!tbody) return;

      const q = (filtro || '').toLowerCase().trim();
      let areas = [...staffService.obtenerAreasInstitucionales()]
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
      if (countEl) countEl.textContent = areas.length;

      if (q) {
        areas = areas.filter((a) => {
          const matchNom = (a.nombre || '').toLowerCase().includes(q);
          const matchSig = (a.sigla || '').toLowerCase().includes(q);
          const matchProcs = Array.isArray(a.procesos) && a.procesos.some((p) => p.toLowerCase().includes(q));
          return matchNom || matchSig || matchProcs;
        });
      }

      if (areas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding: 14px; text-align: center; color: #94a3b8;">No hay áreas ni procesos que coincidan.</td></tr>';
        return;
      }

      tbody.innerHTML = areas
        .map(
          (a) => {
            const procsList = Array.isArray(a.procesos) ? a.procesos : [];
            const procsHtml = procsList.length > 0
              ? procsList.map((p) => `<span style="background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 500; display: inline-block; margin: 2px 3px 2px 0;">${p}</span>`).join('')
              : '<span style="color: #94a3b8; font-style: italic; font-size: 0.72rem;">Sin procesos asignados</span>';

            return `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 10px; font-weight: 700; color: #1e293b; vertical-align: top;">${a.nombre}</td>
              <td style="padding: 8px 10px; vertical-align: top;">
                <span style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 2px 7px; border-radius: 6px; font-weight: 800; font-family: monospace;">${a.sigla}</span>
              </td>
              <td style="padding: 8px 10px; vertical-align: top; line-height: 1.4;">${procsHtml}</td>
              <td style="padding: 8px 10px; text-align: right; white-space: nowrap; vertical-align: top;">
                <button type="button" class="btn-edit-area" data-id="${a.id}" data-nombre="${a.nombre}" data-sigla="${a.sigla}" data-procesos="${(procsList).join(', ')}" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; margin-right: 4px; font-weight: 600;">
                  ✏️ Editar
                </button>
                <button type="button" class="btn-delete-area" data-id="${a.id}" data-nombre="${a.nombre}" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                  🗑️
                </button>
              </td>
            </tr>
            `;
          }
        )
        .join('');

      tbody.querySelectorAll('.btn-edit-area').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');
          const sig = btn.getAttribute('data-sigla');
          const procs = btn.getAttribute('data-procesos') || '';

          const formBox = document.getElementById('form-box-area');
          const titleBox = document.getElementById('title-form-area');
          const inputId = document.getElementById('input-area-id');
          const inputNom = document.getElementById('input-area-nombre');
          const inputSig = document.getElementById('input-area-sigla');
          const inputProcs = document.getElementById('input-area-procesos');

          if (formBox) {
            formBox.style.display = 'block';
            if (titleBox) titleBox.textContent = `✏️ Modificar Área: ${nom}`;
            if (inputId) inputId.value = id;
            if (inputNom) inputNom.value = nom;
            if (inputSig) inputSig.value = sig;
            if (inputProcs) inputProcs.value = procs;
            inputNom?.focus();
          }
        };
      });

      tbody.querySelectorAll('.btn-delete-area').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');
          if (confirm(`¿Estás seguro de eliminar el área "${nom}" y sus procesos asociados de la tabla maestra?`)) {
            await staffService.eliminarAreaInstitucional(id);
            renderTablaMaestraAreas(document.getElementById('search-maestra-areas')?.value || '');
          }
        };
      });
    };

    const renderTablaMaestraTiposProceso = (filtro = '') => {
      const tbody = document.getElementById('tbody-maestra-tipos-proceso');
      const countEl = document.getElementById('count-maestra-tipos-proceso');
      if (!tbody) return;

      const q = (filtro || '').toLowerCase().trim();
      let tipos = [...staffService.obtenerTiposProceso()]
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
      if (countEl) countEl.textContent = tipos.length;

      if (q) {
        tipos = tipos.filter((t) => (t.nombre || '').toLowerCase().includes(q));
      }

      if (tipos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="padding: 14px; text-align: center; color: #94a3b8;">No hay tipos de proceso que coincidan.</td></tr>';
        return;
      }

      tbody.innerHTML = tipos
        .map(
          (tp) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 10px; font-weight: 700; color: #1e293b;">
              <span style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 3px 9px; border-radius: 6px; font-weight: 700; color: var(--brand-navy, #1f4260);">
                🧭 ${tp.nombre}
              </span>
            </td>
            <td style="padding: 8px 10px; text-align: right; white-space: nowrap;">
              <button type="button" class="btn-edit-tipo-proc" data-id="${tp.id}" data-nombre="${tp.nombre}" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; margin-right: 4px; font-weight: 600;">
                ✏️ Editar
              </button>
              <button type="button" class="btn-delete-tipo-proc" data-id="${tp.id}" data-nombre="${tp.nombre}" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 4px; padding: 3px 8px; font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                🗑️
              </button>
            </td>
          </tr>
        `
        )
        .join('');

      tbody.querySelectorAll('.btn-edit-tipo-proc').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');

          const formBox = document.getElementById('form-box-tipo-proceso');
          const titleBox = document.getElementById('title-form-tipo-proceso');
          const inputId = document.getElementById('input-tipo-proceso-id');
          const inputNom = document.getElementById('input-tipo-proceso-nombre');

          if (formBox) {
            formBox.style.display = 'block';
            if (titleBox) titleBox.textContent = `✏️ Modificar Tipo de Proceso: ${nom}`;
            if (inputId) inputId.value = id;
            if (inputNom) inputNom.value = nom;
            inputNom?.focus();
          }
        };
      });

      tbody.querySelectorAll('.btn-delete-tipo-proc').forEach((btn) => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const nom = btn.getAttribute('data-nombre');
          if (confirm(`¿Estás seguro de eliminar el tipo de proceso "${nom}" de la tabla maestra?`)) {
            await staffService.eliminarTipoProceso(id);
            renderTablaMaestraTiposProceso(document.getElementById('search-maestra-tipos-proceso')?.value || '');
          }
        };
      });
    };

    // Botones de Crear Tipo y Crear Área y Crear Tipo de Proceso
    document.getElementById('btn-nuevo-tipo-doc')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-tipo-doc');
      const titleBox = document.getElementById('title-form-tipo-doc');
      const inputId = document.getElementById('input-tipo-id');
      const inputNom = document.getElementById('input-tipo-nombre');
      const inputPref = document.getElementById('input-tipo-prefijo');
      const inputDesc = document.getElementById('input-tipo-desc');

      if (formBox) {
        formBox.style.display = 'block';
        if (titleBox) titleBox.textContent = '➕ Agregar Nuevo Tipo de Documento';
        if (inputId) inputId.value = '';
        if (inputNom) inputNom.value = '';
        if (inputPref) inputPref.value = '';
        if (inputDesc) inputDesc.value = '';
        inputNom?.focus();
      }
    });

    document.getElementById('btn-cancel-tipo-doc')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-tipo-doc');
      if (formBox) formBox.style.display = 'none';
    });

    document.getElementById('btn-save-tipo-doc')?.addEventListener('click', async () => {
      const inputId = document.getElementById('input-tipo-id');
      const inputNom = document.getElementById('input-tipo-nombre');
      const inputPref = document.getElementById('input-tipo-prefijo');
      const inputDesc = document.getElementById('input-tipo-desc');
      const btnSave = document.getElementById('btn-save-tipo-doc');

      const nom = (inputNom?.value || '').trim();
      const pref = (inputPref?.value || '').trim().toUpperCase();
      const desc = (inputDesc?.value || '').trim();

      if (!nom || !pref) {
        alert('Por favor completa el nombre y el prefijo del tipo de documento.');
        return;
      }

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';
      }

      await staffService.guardarTipoDocumento({
        id: inputId?.value || null,
        nombre: nom,
        prefijo: pref,
        descripcion: desc
      });

      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = '💾 Guardar Tipo';
      }

      const formBox = document.getElementById('form-box-tipo-doc');
      if (formBox) formBox.style.display = 'none';
      renderTablaMaestraTipos(document.getElementById('search-maestra-tipos')?.value || '');
    });

    document.getElementById('search-maestra-tipos')?.addEventListener('input', (e) => {
      renderTablaMaestraTipos(e.target.value);
    });

    document.getElementById('btn-nueva-area')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-area');
      const titleBox = document.getElementById('title-form-area');
      const inputId = document.getElementById('input-area-id');
      const inputNom = document.getElementById('input-area-nombre');
      const inputSig = document.getElementById('input-area-sigla');
      const inputProcs = document.getElementById('input-area-procesos');

      if (formBox) {
        formBox.style.display = 'block';
        if (titleBox) titleBox.textContent = '➕ Agregar Nueva Área y Procesos';
        if (inputId) inputId.value = '';
        if (inputNom) inputNom.value = '';
        if (inputSig) inputSig.value = '';
        if (inputProcs) inputProcs.value = '';
        inputNom?.focus();
      }
    });

    document.getElementById('btn-cancel-area')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-area');
      if (formBox) formBox.style.display = 'none';
    });

    document.getElementById('btn-save-area')?.addEventListener('click', async () => {
      const inputId = document.getElementById('input-area-id');
      const inputNom = document.getElementById('input-area-nombre');
      const inputSig = document.getElementById('input-area-sigla');
      const inputProcs = document.getElementById('input-area-procesos');
      const btnSave = document.getElementById('btn-save-area');

      const nom = (inputNom?.value || '').trim();
      const sig = (inputSig?.value || '').trim().toUpperCase();
      const rawProcs = (inputProcs?.value || '').split(/[,\n]+/).map((p) => p.trim()).filter((p) => p.length > 0);

      if (!nom || !sig) {
        alert('Por favor completa el nombre del área y la sigla.');
        return;
      }

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';
      }

      await staffService.guardarAreaInstitucional({
        id: inputId?.value || null,
        nombre: nom,
        sigla: sig,
        procesos: rawProcs
      });

      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = '💾 Guardar Área';
      }

      const formBox = document.getElementById('form-box-area');
      if (formBox) formBox.style.display = 'none';
      renderTablaMaestraAreas(document.getElementById('search-maestra-areas')?.value || '');
    });

    document.getElementById('search-maestra-areas')?.addEventListener('input', (e) => {
      renderTablaMaestraAreas(e.target.value);
    });

    // Eventos Tipo de Proceso
    document.getElementById('btn-nuevo-tipo-proceso')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-tipo-proceso');
      const titleBox = document.getElementById('title-form-tipo-proceso');
      const inputId = document.getElementById('input-tipo-proceso-id');
      const inputNom = document.getElementById('input-tipo-proceso-nombre');

      if (formBox) {
        formBox.style.display = 'block';
        if (titleBox) titleBox.textContent = '➕ Agregar Nuevo Tipo de Proceso';
        if (inputId) inputId.value = '';
        if (inputNom) inputNom.value = '';
        inputNom?.focus();
      }
    });

    document.getElementById('btn-cancel-tipo-proceso')?.addEventListener('click', () => {
      const formBox = document.getElementById('form-box-tipo-proceso');
      if (formBox) formBox.style.display = 'none';
    });

    document.getElementById('btn-save-tipo-proceso')?.addEventListener('click', async () => {
      const inputId = document.getElementById('input-tipo-proceso-id');
      const inputNom = document.getElementById('input-tipo-proceso-nombre');
      const btnSave = document.getElementById('btn-save-tipo-proceso');

      const nom = (inputNom?.value || '').trim();
      if (!nom) {
        alert('Por favor escribe el nombre del tipo de proceso.');
        return;
      }

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';
      }

      await staffService.guardarTipoProceso({
        id: inputId?.value || null,
        nombre: nom
      });

      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = '💾 Guardar Tipo';
      }

      const formBox = document.getElementById('form-box-tipo-proceso');
      if (formBox) formBox.style.display = 'none';
      renderTablaMaestraTiposProceso(document.getElementById('search-maestra-tipos-proceso')?.value || '');
    });

    document.getElementById('search-maestra-tipos-proceso')?.addEventListener('input', (e) => {
      renderTablaMaestraTiposProceso(e.target.value);
    });

    if (esAdmin) {
      renderTablaMaestraTipos();
      renderTablaMaestraAreas();
      renderTablaMaestraTiposProceso();
    }

    // ─── GESTIÓN DE PREFERENCIAS DE VISTA (Tarjetas vs Tabla) ───
    const cardsViewMode = this.modalContainer.querySelectorAll('.view-mode-card');
    cardsViewMode.forEach((card) => {
      card.addEventListener('click', () => {
        const nuevaVista = card.getAttribute('data-view');
        if (!nuevaVista) return;

        cardsViewMode.forEach((c) => {
          c.classList.remove('active');
          const st = c.querySelector('.view-mode-status');
          if (st) st.textContent = '';
        });

        card.classList.add('active');
        const stAct = card.querySelector('.view-mode-status');
        if (stAct) stAct.textContent = '✓ Activo';

        // Guardar preferencia
        try {
          localStorage.setItem('usv_vista_catalogo', nuevaVista);
        } catch {}

        const colab = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
        if (colab && colab.identificacion) {
          staffService.guardarPreferenciaVistaCatalogo(colab.identificacion, nuevaVista);
        }

        // Notificar a la app principal
        if (typeof onCambiarVista === 'function') {
          onCambiarVista(nuevaVista);
        }

        const msgFeedback = this.modalContainer.querySelector('#view-mode-feedback-msg');
        if (msgFeedback) {
          msgFeedback.style.display = 'block';
          msgFeedback.textContent = `✅ Diseño del catálogo cambiado a: ${nuevaVista === 'tabla' ? 'Vista de Tabla' : 'Vista de Cuadrícula'}.`;
          setTimeout(() => { msgFeedback.style.display = 'none'; }, 3000);
        }
      });
    });

    // ─── GESTIÓN DE FILTROS POR DEFECTO AL INICIAR ───
    const selectDefTipo = this.modalContainer.querySelector('#select-default-tipo-proceso');
    const selectDefArea = this.modalContainer.querySelector('#select-default-area');
    const selectDefProc = this.modalContainer.querySelector('#select-default-proceso');
    const btnClearDef = this.modalContainer.querySelector('#btn-clear-default-filters');

    const guardarYAplicarFiltrosDefecto = async () => {
      const nuevosFiltros = {
        tipoProceso: selectDefTipo?.value || '',
        area: selectDefArea?.value || '',
        proceso: selectDefProc?.value || ''
      };

      const colab = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
      await staffService.guardarFiltrosPorDefecto(colab?.identificacion, nuevosFiltros);

      if (typeof onActualizarFiltrosPorDefecto === 'function') {
        onActualizarFiltrosPorDefecto(nuevosFiltros);
      }

      const msgFeedback = this.modalContainer.querySelector('#view-mode-feedback-msg');
      if (msgFeedback) {
        msgFeedback.style.display = 'block';
        msgFeedback.textContent = '✅ Filtros por defecto guardados y aplicados al catálogo en vivo.';
        setTimeout(() => { msgFeedback.style.display = 'none'; }, 3000);
      }
    };

    selectDefTipo?.addEventListener('change', guardarYAplicarFiltrosDefecto);
    selectDefArea?.addEventListener('change', guardarYAplicarFiltrosDefecto);
    selectDefProc?.addEventListener('change', guardarYAplicarFiltrosDefecto);

    btnClearDef?.addEventListener('click', async () => {
      if (selectDefTipo) selectDefTipo.value = '';
      if (selectDefArea) selectDefArea.value = '';
      if (selectDefProc) selectDefProc.value = '';
      await guardarYAplicarFiltrosDefecto();
    });

    // ─── GESTIÓN DE CAMBIO DE CONTRASEÑA PERSONAL (si aplica) ───
    this.modalContainer.querySelectorAll('.btn-toggle-pwd-visibility').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = this.modalContainer.querySelector(`#${targetId}`);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
          btn.textContent = input.type === 'password' ? '👁️' : '🙈';
        }
      });
    });

    // Disparar sincronización desde el modal
    document.getElementById('btn-modal-sync-trigger')?.addEventListener('click', async () => {
      const spinner = document.getElementById('modal-sync-spinner');
      const btnText = document.getElementById('modal-sync-btn-text');
      const statusMsg = document.getElementById('modal-sync-status-msg');

      if (spinner) spinner.classList.add('spinning');
      if (btnText) btnText.textContent = 'Sincronizando...';
      if (statusMsg) statusMsg.textContent = '⏳ Descargando catálogo en tiempo real desde OneDrive...';

      if (typeof onSincronizar === 'function') {
        try {
          await onSincronizar();
          if (statusMsg) {
            const hora = new Date().toLocaleTimeString('es-CO');
            statusMsg.innerHTML = `✅ <strong>Sincronización completada exitosamente</strong> a las ${hora}.`;
          }
        } catch (err) {
          if (statusMsg) statusMsg.textContent = `❌ Error al sincronizar: ${err.message}`;
        } finally {
          if (spinner) spinner.classList.remove('spinning');
          if (btnText) btnText.textContent = 'Actualizar Datos Ahora';
        }
      }
    });

    // ─── RUTAS DE CONEXIÓN DE DATOS CENTRALES (Lógica) ───
    const inputRouteEmp = this.modalContainer.querySelector('#input-route-empleados');
    const inputRouteRepo = this.modalContainer.querySelector('#input-route-repositorio');
    const btnUnlockRoutes = this.modalContainer.querySelector('#btn-unlock-routes');
    const routesAuthBox = this.modalContainer.querySelector('#routes-auth-box');
    const routesActionBar = this.modalContainer.querySelector('#routes-action-bar');
    const routesSaveMsg = this.modalContainer.querySelector('#routes-save-msg');

    const cargarRutasEnInputs = () => {
      const rutas = staffService.obtenerRutasConfiguradas();
      if (inputRouteEmp) inputRouteEmp.value = rutas.empleadosCsv;
      if (inputRouteRepo) inputRouteRepo.value = rutas.repositorioCsv;
    };

    cargarRutasEnInputs();

    if (btnUnlockRoutes && routesAuthBox) {
      btnUnlockRoutes.addEventListener('click', () => {
        routesAuthBox.style.display = 'block';
        this.modalContainer.querySelector('#input-routes-pwd')?.focus();
      });

      this.modalContainer.querySelector('#btn-cancel-routes-pwd')?.addEventListener('click', () => {
        routesAuthBox.style.display = 'none';
        const err = this.modalContainer.querySelector('#routes-pwd-error');
        if (err) err.style.display = 'none';
      });

      const validarDesbloqueoRutas = async () => {
        const pwd = this.modalContainer.querySelector('#input-routes-pwd')?.value;
        const err = this.modalContainer.querySelector('#routes-pwd-error');
        const res = await staffService.validarClaveEdicion(pwd);
        if (res.ok) {
          if (err) err.style.display = 'none';
          routesAuthBox.style.display = 'none';
          btnUnlockRoutes.style.display = 'none';

          if (inputRouteEmp) { inputRouteEmp.disabled = false; inputRouteEmp.style.background = '#ffffff'; }
          if (inputRouteRepo) { inputRouteRepo.disabled = false; inputRouteRepo.style.background = '#ffffff'; }
          if (routesActionBar) routesActionBar.style.display = 'flex';
        } else {
          if (err) {
            err.textContent = res.error || 'Contraseña incorrecta. Inténtalo nuevamente.';
            err.style.display = 'block';
          }
        }
      };

      this.modalContainer.querySelector('#btn-confirm-routes-pwd')?.addEventListener('click', validarDesbloqueoRutas);
      this.modalContainer.querySelector('#input-routes-pwd')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') validarDesbloqueoRutas();
      });

      this.modalContainer.querySelector('#btn-save-routes')?.addEventListener('click', async () => {
        const nuevasRutas = {
          empleadosCsv: inputRouteEmp?.value,
          repositorioCsv: inputRouteRepo?.value
        };
        staffService.guardarRutasConfiguradas(nuevasRutas);

        if (routesSaveMsg) {
          routesSaveMsg.style.display = 'block';
          routesSaveMsg.style.color = '#166534';
          routesSaveMsg.textContent = '✅ Rutas actualizadas correctamente. Sincronizando con nuevas rutas...';
          setTimeout(() => { routesSaveMsg.style.display = 'none'; }, 4000);
        }

        try {
          await staffService.inicializar();
          await sharepointService.obtenerDocumentos(true);
        } catch {}
      });

      this.modalContainer.querySelector('#btn-reset-routes')?.addEventListener('click', () => {
        if (confirm('¿Restablecer las rutas de SharePoint a sus valores originales por defecto?')) {
          localStorage.removeItem('agy_sgc_custom_routes');
          cargarRutasEnInputs();
          if (routesSaveMsg) {
            routesSaveMsg.style.display = 'block';
            routesSaveMsg.style.color = '#1e40af';
            routesSaveMsg.textContent = 'ℹ️ Rutas restablecidas a los valores por defecto.';
            setTimeout(() => { routesSaveMsg.style.display = 'none'; }, 3000);
          }
        }
      });
    }



    // Sincronizar y cerrar modal al presionar "Listo" o "✕"
    const cerrarYSincronizar = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
        if (typeof onCambiarPerfil === 'function' && perfilSeleccionado && perfilSeleccionado !== perfilActual) {
          onCambiarPerfil(perfilSeleccionado);
        }
        const iconEl = document.getElementById('header-profile-icon');
        const nameEl = document.getElementById('header-profile-name');
        const pillBtn = document.getElementById('btn-profile-pill');
        const iconos = {
          total: '🛡️',
          administrador: '🛡️',
          operativo: '👷',
          administrativo: '💼',
          directivo: '👑'
        };
        const nombres = {
          total: 'Acceso Total',
          administrador: 'Acceso Total',
          operativo: 'Operativo',
          administrativo: 'Administrativo',
          directivo: 'Directivo'
        };
        if (iconEl) iconEl.textContent = iconos[perfilSeleccionado] || '👤';
        if (nameEl) nameEl.textContent = nombres[perfilSeleccionado] || perfilSeleccionado;
        if (pillBtn) pillBtn.title = `Perfil de acceso activo: ${nombres[perfilSeleccionado] || perfilSeleccionado}. Haz clic para cambiar perfil o ver configuración.`;
      } catch (err) {
        console.error('Error al sincronizar perfil al cerrar:', err);
      } finally {
        this.cerrarModal();
      }
    };

    this.modalContainer.querySelector('#btn-settings-close')?.addEventListener('click', cerrarYSincronizar);
    this.modalContainer.querySelector('#btn-settings-close-bottom')?.addEventListener('click', cerrarYSincronizar);
  }

  /**
   * Modal de Autenticación de Colaborador (Primer ingreso, login por contraseña y gestión de sesión)
   */
  abrirModalAutenticacion(staffService, onLoginExitoso, onLogout, esObligatorio = false) {
    document.body.classList.add('modal-open');

    const sesionActiva = staffService.obtenerSesionActiva();
    const usuarioRecordado = staffService.obtenerUsuarioRecordado();

    const iconosPerfil = {
      directivo: '👑',
      administrativo: '💼',
      operativo: '👷',
      total: '🛡️'
    };

    // ─────────────────────────────────────────────────────────────
    // VISTA 1: Sesión ya activa actualmente
    // ─────────────────────────────────────────────────────────────
    if (sesionActiva) {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 500px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-disponible">● Sesión Activa</span>
                <span class="doc-code">Colaborador Institucional</span>
              </div>
              <button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>
            </div>

            <div class="modal-body" style="gap: 12px; max-height: 78vh; overflow-y: auto;">
              <div style="text-align: center; padding: 4px 0 2px;">
                <div style="font-size: 2.5rem; margin-bottom: 4px;">
                  ${iconosPerfil[sesionActiva.perfil] || '👤'}
                </div>
                <h3 style="color: var(--brand-navy); font-size: 1.18rem; font-weight: 700; margin-bottom: 4px;">
                  ${sesionActiva.nombre}
                </h3>
                <div style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 0.76rem; padding: 3px 10px; border-radius: 999px; text-transform: uppercase;">
                  ${iconosPerfil[sesionActiva.perfil] || '👤'} Perfil ${sesionActiva.perfil}
                </div>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Identificación:</span>
                  <strong style="color: #1e293b;">C.C. ${sesionActiva.identificacion}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Cargo:</span>
                  <strong style="color: #1e293b;">${sesionActiva.cargo}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: #64748b;">Correo:</span>
                  <span style="color: #0369a1; font-weight: 600;">${sesionActiva.email || 'N/A'}</span>
                </div>
              </div>

              <!-- Sección de Seguridad y Cambio de Contraseña Integrada (Anti-Autofill protegido) -->
              <div style="background: #ffffff; border: 1.5px solid #dbeafe; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 8px; border-bottom: 1.5px solid #f1f5f9; padding-bottom: 8px;">
                  <span style="font-size: 1.15rem;">🔑</span>
                  <div>
                    <div style="font-size: 0.84rem; font-weight: 700; color: var(--brand-navy, #1f4260);">Seguridad y Cambio de Contraseña</div>
                    <div style="font-size: 0.72rem; color: #64748b;">Actualiza tu contraseña personal de acceso y edición.</div>
                  </div>
                </div>

                <form id="form-user-change-pwd" autocomplete="off" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0;">
                  <!-- Trampas de autofill para evitar que el navegador inyecte credenciales en el buscador principal -->
                  <input type="text" name="fake_username_trap" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; left: -9999px;" tabindex="-1" autocomplete="username" />
                  <input type="password" name="fake_password_trap" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; left: -9999px;" tabindex="-1" autocomplete="current-password" />

                  <div>
                    <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 3px;">
                      1. Contraseña Actual:
                    </label>
                    <div style="position: relative;">
                      <input 
                        type="password" 
                        id="input-user-current-pwd" 
                        name="user_current_pwd_input_field"
                        class="form-input" 
                        placeholder="Ingresa tu contraseña actual..." 
                        autocomplete="new-password"
                        data-lpignore="true"
                        data-form-type="other"
                        value=""
                        style="width: 100%; height: 32px; padding: 0 34px 0 8px; font-size: 0.82rem; box-sizing: border-box;"
                      />
                      <button type="button" class="btn-toggle-pwd-visibility" data-target="input-user-current-pwd" style="position: absolute; right: 6px; top: 5px; background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Mostrar / Ocultar">👁️</button>
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                      <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 3px;">
                        2. Nueva Contraseña:
                      </label>
                      <div style="position: relative;">
                        <input 
                          type="password" 
                          id="input-user-new-pwd" 
                          name="user_new_pwd_input_field"
                          class="form-input" 
                          placeholder="Mínimo 4 caracteres..." 
                          autocomplete="new-password"
                          data-lpignore="true"
                          data-form-type="other"
                          value=""
                          style="width: 100%; height: 32px; padding: 0 34px 0 8px; font-size: 0.82rem; box-sizing: border-box;"
                        />
                        <button type="button" class="btn-toggle-pwd-visibility" data-target="input-user-new-pwd" style="position: absolute; right: 6px; top: 5px; background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Mostrar / Ocultar">👁️</button>
                      </div>
                    </div>

                    <div>
                      <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 3px;">
                        3. Confirmar Clave:
                      </label>
                      <div style="position: relative;">
                        <input 
                          type="password" 
                          id="input-user-confirm-pwd" 
                          name="user_confirm_pwd_input_field"
                          class="form-input" 
                          placeholder="Repite la contraseña..." 
                          autocomplete="new-password"
                          data-lpignore="true"
                          data-form-type="other"
                          value=""
                          style="width: 100%; height: 32px; padding: 0 34px 0 8px; font-size: 0.82rem; box-sizing: border-box;"
                        />
                        <button type="button" class="btn-toggle-pwd-visibility" data-target="input-user-confirm-pwd" style="position: absolute; right: 6px; top: 5px; background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Mostrar / Ocultar">👁️</button>
                      </div>
                    </div>
                  </div>

                  <div id="user-pwd-feedback" style="display: none; padding: 8px 10px; border-radius: 6px; font-size: 0.76rem; font-weight: 600;"></div>

                  <button 
                    type="button" 
                    id="btn-user-save-pwd" 
                    class="btn btn-primary" 
                    style="padding: 6px 14px; font-size: 0.78rem; font-weight: 700; background-color: var(--primary); display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 6px; margin-top: 2px;"
                  >
                    <span>💾</span> Actualizar Mi Contraseña Personal
                  </button>
                </form>
              </div>
            </div>

            <div class="modal-footer" style="justify-content: space-between;">
              <button type="button" class="btn btn-secondary" id="btn-auth-logout" style="color: #dc2626; border-color: #fecaca; background: #fef2f2;">
                🚪 Cerrar Sesión
              </button>
              <button type="button" class="btn btn-primary" id="btn-auth-done">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      `;

      // Limpieza explícita diferida contra autofill agresivo del navegador
      setTimeout(() => {
        const i1 = this.modalContainer.querySelector('#input-user-current-pwd');
        const i2 = this.modalContainer.querySelector('#input-user-new-pwd');
        const i3 = this.modalContainer.querySelector('#input-user-confirm-pwd');
        if (i1) i1.value = '';
        if (i2) i2.value = '';
        if (i3) i3.value = '';
      }, 50);

      // Eventos de mostrar/ocultar contraseña en el modal de perfil
      this.modalContainer.querySelectorAll('.btn-toggle-pwd-visibility').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = btn.getAttribute('data-target');
          const input = this.modalContainer.querySelector(`#${targetId}`);
          if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            btn.textContent = input.type === 'password' ? '👁️' : '🙈';
          }
        });
      });

      // Evento de guardar contraseña personal desde el modal de perfil
      const btnSaveUserPwd = this.modalContainer.querySelector('#btn-user-save-pwd');
      if (btnSaveUserPwd) {
        btnSaveUserPwd.addEventListener('click', async () => {
          const inputCurr = this.modalContainer.querySelector('#input-user-current-pwd');
          const inputNew = this.modalContainer.querySelector('#input-user-new-pwd');
          const inputConf = this.modalContainer.querySelector('#input-user-confirm-pwd');
          const feedback = this.modalContainer.querySelector('#user-pwd-feedback');

          const currVal = (inputCurr?.value || '').trim();
          const newVal = (inputNew?.value || '').trim();
          const confVal = (inputConf?.value || '').trim();

          if (!currVal) {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = '#fef2f2';
              feedback.style.border = '1px solid #fecaca';
              feedback.style.color = '#dc2626';
              feedback.textContent = '❌ Por favor ingresa tu contraseña actual.';
            }
            inputCurr?.focus();
            return;
          }

          if (!newVal || newVal.length < 4) {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = '#fef2f2';
              feedback.style.border = '1px solid #fecaca';
              feedback.style.color = '#dc2626';
              feedback.textContent = '❌ La nueva contraseña debe tener al menos 4 caracteres.';
            }
            inputNew?.focus();
            return;
          }

          if (newVal !== confVal) {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = '#fef2f2';
              feedback.style.border = '1px solid #fecaca';
              feedback.style.color = '#dc2626';
              feedback.textContent = '❌ La confirmación no coincide con la nueva contraseña.';
            }
            inputConf?.focus();
            return;
          }

          btnSaveUserPwd.disabled = true;
          btnSaveUserPwd.textContent = 'Guardando... ⏳';

          const res = await staffService.cambiarPasswordPersonal(currVal, newVal);
          btnSaveUserPwd.disabled = false;
          btnSaveUserPwd.innerHTML = '<span>💾</span> Actualizar Mi Contraseña Personal';

          if (!res.exito) {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = '#fef2f2';
              feedback.style.border = '1px solid #fecaca';
              feedback.style.color = '#dc2626';
              feedback.textContent = `❌ ${res.error}`;
            }
          } else {
            if (feedback) {
              feedback.style.display = 'block';
              feedback.style.background = '#f0fdf4';
              feedback.style.border = '1px solid #bbf7d0';
              feedback.style.color = '#15803d';
              feedback.textContent = `✅ ${res.mensaje}`;
            }
            if (inputCurr) inputCurr.value = '';
            if (inputNew) inputNew.value = '';
            if (inputConf) inputConf.value = '';
          }
        });
      }

      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-done')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-logout')?.addEventListener('click', () => {
        staffService.cerrarSesion();
        this.cerrarModal();
        if (onLogout) onLogout();
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // FUNCIONES AUXILIARES PARA FORMULARIOS DE LOGIN / REGISTRO
    // ─────────────────────────────────────────────────────────────
    const renderIngresoRapido = (recordado) => {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 440px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-doc">Seguridad</span>
                <span class="doc-code">Ingreso de Colaborador</span>
              </div>
              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}
            </div>

            <div class="modal-body" style="gap: 14px;">
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border: 1px solid #cddde9; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 700; flex-shrink: 0;">
                  ${recordado.nombre ? recordado.nombre.charAt(0).toUpperCase() : '👤'}
                </div>
                <div>
                  <div style="font-size: 0.98rem; font-weight: 700; color: #0f172a;">${recordado.nombre}</div>
                  <div style="font-size: 0.78rem; color: #0369a1; font-weight: 600; margin-top: 1px;">
                    ${recordado.cargo}
                  </div>
                </div>
              </div>

              <form id="form-quick-login" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="form-group">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label for="input-quick-password" style="font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0;">
                      Ingresa tu Contraseña Personal:
                    </label>
                    <button type="button" id="btn-forgot-pwd" style="background: none; border: none; color: #0284c7; font-size: 0.76rem; font-weight: 600; cursor: pointer; text-decoration: underline;">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <input 
                    type="password" 
                    id="input-quick-password" 
                    class="form-input" 
                    placeholder="Escribe tu contraseña..." 
                    autocomplete="current-password"
                    autofocus
                    required 
                    style="font-size: 1rem; padding: 10px 12px; letter-spacing: 2px;"
                  />
                </div>

                <div id="auth-error-banner" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 8px 12px; border-radius: 6px; font-size: 0.80rem; font-weight: 600;">
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.92rem; justify-content: center; margin-top: 4px;">
                  Iniciar Sesión 🔓
                </button>
              </form>

              <div style="text-align: center; margin-top: 2px;">
                <button type="button" id="btn-switch-account" style="background: none; border: none; color: #64748b; font-size: 0.80rem; font-weight: 600; cursor: pointer; text-decoration: underline;">
                  ¿No eres ${recordado.nombre.split(' ')[0]}? Ingresar con otra cuenta
                </button>
              </div>
            </div>

            ${!esObligatorio ? `
              <div class="modal-footer" style="justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const inputPwd = document.getElementById('input-quick-password');
      const errBanner = document.getElementById('auth-error-banner');
      const form = document.getElementById('form-quick-login');
      const btnSubmit = form.querySelector('button[type="submit"]');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBanner.style.display = 'none';
        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.innerHTML = 'Iniciando Sesión... ⏳';
          btnSubmit.style.opacity = '0.75';
        }
        const res = await staffService.iniciarSesionConPassword(recordado.identificacion, inputPwd.value);
        if (res.ok) {
          this.cerrarModal();
          if (onLoginExitoso) onLoginExitoso(res.usuario);
        } else {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Iniciar Sesión 🔓';
            btnSubmit.style.opacity = '1';
          }
          errBanner.textContent = res.error;
          errBanner.style.display = 'block';
          inputPwd.focus();
          inputPwd.select();
        }
      });

      document.getElementById('btn-forgot-pwd')?.addEventListener('click', () => {
        renderRestablecerPassword(recordado);
      });

      document.getElementById('btn-switch-account')?.addEventListener('click', () => {
        renderLoginNormal('');
      });
      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => inputPwd?.focus(), 100);
    };

    // ─────────────────────────────────────────────────────────────
    // VISTA 3: Inicio de Sesión Normal (Correo Corporativo + Contraseña)
    // Reduce la exposición de datos personales al no solicitar cédula al inicio
    // ─────────────────────────────────────────────────────────────
    const renderLoginNormal = (emailPrevio = '') => {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 460px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-doc">Seguridad</span>
                <span class="doc-code">Ingreso de Colaborador</span>
              </div>
              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}
            </div>

            <div class="modal-body" style="gap: 14px;">
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">
                  Iniciar Sesión Institucional
                </h3>
                <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
                  Ingresa tu correo corporativo y contraseña del programa para acceder al sistema.
                </p>
              </div>

              <form id="form-normal-login" style="display: flex; flex-direction: column; gap: 11px;">
                <div class="form-group">
                  <label for="input-login-email" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                    Correo Corporativo:
                  </label>
                  <input 
                    type="email" 
                    id="input-login-email" 
                    class="form-input" 
                    placeholder="nombre.apellido@unionsaludvida.com" 
                    value="${emailPrevio}"
                    autocomplete="username"
                    autofocus
                    required 
                    style="font-size: 0.95rem; padding: 10px 12px;"
                  />
                </div>

                <div class="form-group">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label for="input-login-password" style="font-size: 0.82rem; font-weight: 600; color: #334155; margin-bottom: 0;">
                      Contraseña:
                    </label>
                    <button type="button" id="btn-forgot-pwd" style="background: none; border: none; color: #0284c7; font-size: 0.76rem; font-weight: 600; cursor: pointer; text-decoration: underline;">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div style="position: relative;">
                    <input 
                      type="password" 
                      id="input-login-password" 
                      class="form-input" 
                      placeholder="Ingresa tu contraseña..." 
                      autocomplete="current-password"
                      required 
                      style="font-size: 1rem; padding: 10px 36px 10px 12px; letter-spacing: 2px; width: 100%; box-sizing: border-box;"
                    />
                    <button type="button" class="btn-toggle-pwd-visibility" data-target="input-login-password" style="position: absolute; right: 8px; top: 9px; background: none; border: none; cursor: pointer; font-size: 0.95rem;" title="Mostrar / Ocultar">👁️</button>
                  </div>
                </div>

                <div id="auth-error-banner" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: 600;">
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.92rem; justify-content: center; margin-top: 4px;">
                  Iniciar Sesión 🔓
                </button>
              </form>

              <!-- Sección para Nuevo Registro (Privacidad protegida: cédula solo se pide aquí) -->
              <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 12px 14px; text-align: center; margin-top: 4px;">
                <div style="font-size: 0.82rem; font-weight: 700; color: #1e293b; margin-bottom: 3px;">
                  ¿Es tu primera vez aquí o no tienes contraseña?
                </div>
                <p style="font-size: 0.76rem; color: #64748b; margin: 0 0 8px 0;">
                  Registra tu cuenta institucional para crear tu clave personal.
                </p>
                <button type="button" id="btn-go-to-register" class="btn btn-secondary" style="font-size: 0.82rem; padding: 7px 14px; width: 100%; justify-content: center; font-weight: 700; color: #0284c7; border-color: #bae6fd; background: #f0f9ff;">
                  📝 Realizar Nuevo Registro
                </button>
              </div>
            </div>

            ${!esObligatorio ? `
              <div class="modal-footer" style="justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const inputEmail = document.getElementById('input-login-email');
      const inputPwd = document.getElementById('input-login-password');
      const errBanner = document.getElementById('auth-error-banner');
      const form = document.getElementById('form-normal-login');
      const btnSubmit = form.querySelector('button[type="submit"]');

      // Toggle visibilidad de contraseña
      this.modalContainer.querySelectorAll('.btn-toggle-pwd-visibility').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = btn.getAttribute('data-target');
          const input = this.modalContainer.querySelector(`#${targetId}`);
          if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            btn.textContent = input.type === 'password' ? '👁️' : '🙈';
          }
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBanner.style.display = 'none';
        const emailVal = inputEmail.value.trim();
        const pwdVal = inputPwd.value;

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.innerHTML = 'Iniciando Sesión... ⏳';
          btnSubmit.style.opacity = '0.75';
        }

        const res = await staffService.iniciarSesionConEmailYPassword(emailVal, pwdVal);
        if (res.ok) {
          this.cerrarModal();
          if (onLoginExitoso) onLoginExitoso(res.usuario);
        } else {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Iniciar Sesión 🔓';
            btnSubmit.style.opacity = '1';
          }
          if (res.noRegistrado) {
            errBanner.innerHTML = `
              <div>${res.error}</div>
              <button type="button" id="btn-err-go-reg" style="margin-top: 6px; background: #0284c7; color: white; border: none; border-radius: 5px; padding: 5px 12px; font-size: 0.78rem; font-weight: 700; cursor: pointer;">
                Crear Mi Contraseña Ahora ➔
              </button>
            `;
            errBanner.style.display = 'block';
            document.getElementById('btn-err-go-reg')?.addEventListener('click', () => {
              renderNuevoRegistro(emailVal, '');
            });
          } else {
            errBanner.textContent = res.error;
            errBanner.style.display = 'block';
            inputPwd.focus();
            inputPwd.select();
          }
        }
      });

      document.getElementById('btn-go-to-register')?.addEventListener('click', () => {
        renderNuevoRegistro(inputEmail?.value || '', '');
      });

      document.getElementById('btn-forgot-pwd')?.addEventListener('click', () => {
        renderRestablecerPassword(null, inputEmail?.value || '');
      });

      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => inputEmail?.focus(), 100);
    };

    // ─────────────────────────────────────────────────────────────
    // VISTA 4: Nuevo Registro (Solo si el usuario es nuevo)
    // Solicita Correo Institucional, Cédula y Creación de Contraseña
    // ─────────────────────────────────────────────────────────────
    const renderNuevoRegistro = (emailPrevio = '', docPrevio = '') => {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 480px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-doc" style="background: #e0f2fe; color: #0369a1;">📝 Primer Ingreso</span>
                <span class="doc-code">Registro de Colaborador</span>
              </div>
              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}
            </div>

            <div class="modal-body" style="gap: 13px;">
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">
                  Registro de Nuevo Colaborador
                </h3>
                <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
                  Ingresa tu correo institucional, tu identificación y define tu contraseña personal para activar tu acceso.
                </p>
              </div>

              <form id="form-new-register" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="form-group">
                  <label for="input-reg-email" style="font-size: 0.80rem; font-weight: 600; color: #334155;">
                    1. Correo Institucional:
                  </label>
                  <input 
                    type="email" 
                    id="input-reg-email" 
                    class="form-input" 
                    placeholder="nombre.apellido@unionsaludvida.com" 
                    value="${emailPrevio}"
                    autocomplete="email"
                    required 
                    style="font-size: 0.90rem; padding: 8px 12px;"
                  />
                </div>

                <div class="form-group">
                  <label for="input-reg-doc" style="font-size: 0.80rem; font-weight: 600; color: #334155;">
                    2. Número de Documento (Cédula):
                  </label>
                  <input 
                    type="text" 
                    id="input-reg-doc" 
                    class="form-input" 
                    placeholder="Ej. 8160602" 
                    value="${docPrevio}"
                    autocomplete="off"
                    required 
                    style="font-size: 0.90rem; padding: 8px 12px;"
                  />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <div class="form-group">
                    <label for="input-reg-pwd" style="font-size: 0.80rem; font-weight: 600; color: #334155;">
                      3. Crear Contraseña:
                    </label>
                    <div style="position: relative;">
                      <input 
                        type="password" 
                        id="input-reg-pwd" 
                        class="form-input" 
                        placeholder="Mínimo 4 caract..." 
                        autocomplete="new-password"
                        required 
                        style="font-size: 0.90rem; padding: 8px 30px 8px 10px; width: 100%; box-sizing: border-box;"
                      />
                      <button type="button" class="btn-toggle-pwd-visibility" data-target="input-reg-pwd" style="position: absolute; right: 5px; top: 7px; background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Mostrar / Ocultar">👁️</button>
                    </div>
                  </div>

                  <div class="form-group">
                    <label for="input-reg-pwd-confirm" style="font-size: 0.80rem; font-weight: 600; color: #334155;">
                      4. Confirmar Clave:
                    </label>
                    <div style="position: relative;">
                      <input 
                        type="password" 
                        id="input-reg-pwd-confirm" 
                        class="form-input" 
                        placeholder="Repite la clave..." 
                        autocomplete="new-password"
                        required 
                        style="font-size: 0.90rem; padding: 8px 30px 8px 10px; width: 100%; box-sizing: border-box;"
                      />
                      <button type="button" class="btn-toggle-pwd-visibility" data-target="input-reg-pwd-confirm" style="position: absolute; right: 5px; top: 7px; background: none; border: none; cursor: pointer; font-size: 0.85rem;" title="Mostrar / Ocultar">👁️</button>
                    </div>
                  </div>
                </div>

                <div id="reg-error-banner" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 8px 12px; border-radius: 6px; font-size: 0.80rem; font-weight: 600;">
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.92rem; justify-content: center; margin-top: 4px;">
                  Validar y Crear Mi Contraseña 🚀
                </button>
              </form>
            </div>

            <div class="modal-footer" style="justify-content: space-between;">
              <button type="button" class="btn btn-secondary" id="btn-back-to-login">
                ← Volver al Inicio de Sesión
              </button>
              ${!esObligatorio ? '<button type="button" class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>' : ''}
            </div>
          </div>
        </div>
      `;

      const inputEmail = document.getElementById('input-reg-email');
      const inputDoc = document.getElementById('input-reg-doc');
      const inputP1 = document.getElementById('input-reg-pwd');
      const inputP2 = document.getElementById('input-reg-pwd-confirm');
      const errBanner = document.getElementById('reg-error-banner');
      const form = document.getElementById('form-new-register');
      const btnSubmit = form.querySelector('button[type="submit"]');

      this.modalContainer.querySelectorAll('.btn-toggle-pwd-visibility').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = btn.getAttribute('data-target');
          const input = this.modalContainer.querySelector(`#${targetId}`);
          if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
            btn.textContent = input.type === 'password' ? '👁️' : '🙈';
          }
        });
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBanner.style.display = 'none';

        const emailVal = inputEmail.value.trim();
        const docVal = inputDoc.value.trim();
        const p1 = inputP1.value;
        const p2 = inputP2.value;

        if (p1.length < 4) {
          errBanner.textContent = 'La contraseña debe tener al menos 4 caracteres.';
          errBanner.style.display = 'block';
          inputP1.focus();
          return;
        }

        if (p1 !== p2) {
          errBanner.textContent = 'Las contraseñas no coinciden. Por favor verifica.';
          errBanner.style.display = 'block';
          inputP2.focus();
          inputP2.select();
          return;
        }

        // 1. Validar vinculación en la matriz activa de colaboradores
        const validacion = staffService.validarIdentificacionYEmail(docVal, emailVal);
        if (!validacion.valido) {
          errBanner.textContent = validacion.error;
          errBanner.style.display = 'block';
          return;
        }

        const emp = validacion.empleado;

        // 2. Si ya está registrado con contraseña
        if (staffService.estaUsuarioRegistrado(emp.identificacion)) {
          errBanner.innerHTML = `
            <div>Este colaborador ya cuenta con una contraseña registrada.</div>
            <button type="button" id="btn-already-reg-login" style="margin-top: 6px; background: #0284c7; color: white; border: none; border-radius: 5px; padding: 5px 12px; font-size: 0.78rem; font-weight: 700; cursor: pointer;">
              Ir al Inicio de Sesión ➔
            </button>
          `;
          errBanner.style.display = 'block';
          document.getElementById('btn-already-reg-login')?.addEventListener('click', () => {
            renderLoginNormal(emailVal);
          });
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Guardando y Activando... ⏳';
          btnSubmit.style.opacity = '0.75';
        }

        // 3. Registrar contraseña y activar sesión
        const res = await staffService.registrarPassword(emp.identificacion, emp.email, p1);
        if (res.ok) {
          this.cerrarModal();
          if (onLoginExitoso) onLoginExitoso(res.usuario);
        } else {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Validar y Crear Mi Contraseña 🚀';
            btnSubmit.style.opacity = '1';
          }
          errBanner.textContent = res.error;
          errBanner.style.display = 'block';
        }
      });

      document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
        renderLoginNormal(inputEmail?.value || '');
      });

      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => (inputEmail?.value ? inputDoc?.focus() : inputEmail?.focus()), 100);
    };

    // ─────────────────────────────────────────────────────────────
    // VISTA 5: Restablecer Contraseña
    // ─────────────────────────────────────────────────────────────
    const renderRestablecerPassword = (usuarioObjetivo = null, emailInicial = '') => {
      const empNombre = usuarioObjetivo ? usuarioObjetivo.nombre : '';
      const empCargo = usuarioObjetivo ? usuarioObjetivo.cargo : '';

      this.modalContainer.innerHTML = `
        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 480px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-doc" style="background: #fef3c7; color: #b45309;">🔑 Recuperación</span>
                <span class="doc-code">Restablecer Contraseña</span>
              </div>
              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}
            </div>

            <div class="modal-body" style="gap: 14px;">
              ${usuarioObjetivo ? `
                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                  <div style="width: 42px; height: 42px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 700; flex-shrink: 0;">
                    ${empNombre ? empNombre.charAt(0).toUpperCase() : '👤'}
                  </div>
                  <div>
                    <div style="font-size: 0.72rem; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px;">Restableciendo contraseña para:</div>
                    <div style="font-size: 0.98rem; font-weight: 700; color: #0f172a;">${empNombre}</div>
                    <div style="font-size: 0.78rem; color: #166534; font-weight: 600;">
                      ${empCargo}
                    </div>
                  </div>
                </div>
              ` : `
                <div>
                  <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">
                    Restablecimiento de Contraseña
                  </h3>
                  <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
                    Ingresa tu correo institucional y los últimos 4 dígitos de tu cédula para validar tu identidad.
                  </p>
                </div>
              `}

              <form id="form-reset-step1" style="display: flex; flex-direction: column; gap: 12px;">
                ${!usuarioObjetivo ? `
                  <div class="form-group">
                    <label for="input-reset-email" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                      Correo Institucional:
                    </label>
                    <input 
                      type="email" 
                      id="input-reset-email" 
                      class="form-input" 
                      placeholder="nombre.apellido@unionsaludvida.com" 
                      value="${emailInicial}"
                      autocomplete="email"
                      required 
                      style="font-size: 0.92rem; padding: 9px 12px;"
                    />
                  </div>
                ` : ''}

                <div class="form-group" style="margin-top: 2px;">
                  <label for="input-reset-d4" style="font-size: 0.84rem; font-weight: 600; color: #334155; display: block; text-align: center; margin-bottom: 6px;">
                    Últimos 4 dígitos de tu Cédula:
                  </label>
                  <input 
                    type="password" 
                    id="input-reset-d4" 
                    class="form-input" 
                    placeholder="••••" 
                    maxlength="4"
                    inputmode="numeric"
                    value=""
                    autocomplete="off"
                    autofocus
                    required 
                    style="font-size: 1.35rem; padding: 10px; letter-spacing: 8px; text-align: center; font-weight: 700; max-width: 180px; margin: 0 auto; display: block;"
                  />
                </div>

                <div id="reset-error-banner" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 12px; border-radius: 6px; font-size: 0.82rem; font-weight: 600; text-align: center;">
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.92rem; justify-content: center; margin-top: 4px;">
                  Validar Identidad y Continuar ➔
                </button>
              </form>
            </div>

            <div class="modal-footer" style="justify-content: space-between;">
              <button type="button" class="btn btn-secondary" id="btn-back-to-login">Volver al Ingreso</button>
              ${!esObligatorio ? '<button type="button" class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>' : ''}
            </div>
          </div>
        </div>
      `;

      const inputEmail = document.getElementById('input-reset-email');
      const inputD4 = document.getElementById('input-reset-d4');
      const errBanner = document.getElementById('reset-error-banner');
      const form = document.getElementById('form-reset-step1');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        errBanner.style.display = 'none';

        const d4Val = inputD4.value.trim();
        const emailVal = inputEmail ? inputEmail.value.trim() : (usuarioObjetivo ? usuarioObjetivo.email : '');

        let validacion;
        if (usuarioObjetivo) {
          validacion = staffService.validarSolo4Digitos(d4Val, usuarioObjetivo);
        } else {
          validacion = staffService.validar4DigitosYEmail(d4Val, emailVal);
        }

        if (!validacion.valido) {
          errBanner.textContent = validacion.error;
          errBanner.style.display = 'block';
          inputD4.focus();
          inputD4.select();
          return;
        }

        renderCrearPassword(validacion.empleado, true);
      });

      document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
        if (usuarioRecordado && usuarioRecordado.identificacion) {
          renderIngresoRapido(usuarioRecordado);
        } else {
          renderLoginNormal(inputEmail ? inputEmail.value : '');
        }
      });
      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => (inputEmail && !inputEmail.value ? inputEmail.focus() : inputD4?.focus()), 100);
    };

    const renderCrearPassword = (emp, esRestablecimiento = false) => {
      this.modalContainer.innerHTML = `
        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>
          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 460px;">
            <div class="modal-header">
              <div class="modal-header-badge">
                <span class="badge badge-doc">${esRestablecimiento ? '🔑 Restablecer' : 'Primer Ingreso'}</span>
                <span class="doc-code">${esRestablecimiento ? 'Nueva Contraseña' : 'Crear Contraseña'}</span>
              </div>
              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}
            </div>

            <div class="modal-body" style="gap: 14px;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px;">
                <div style="font-size: 0.95rem; font-weight: 700; color: #14532d;">
                  ${esRestablecimiento ? `¡Identidad confirmada, ${emp.nombre}! ✅` : `¡Hola, ${emp.nombre}! 👋`}
                </div>
                <div style="font-size: 0.80rem; color: #15803d; font-weight: 600; margin-top: 2px;">
                  ${emp.cargo}
                </div>
              </div>

              <p style="font-size: 0.82rem; color: #64748b;">
                ${esRestablecimiento 
                  ? 'Define tu <strong>nueva contraseña personal</strong> para actualizar tu acceso.'
                  : 'Define tu <strong>contraseña personal</strong> para acceder al sistema.'}
              </p>

              <form id="form-create-password" style="display: flex; flex-direction: column; gap: 10px;">
                <div class="form-group">
                  <label for="input-new-pwd" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                    ${esRestablecimiento ? 'Nueva Contraseña:' : 'Contraseña:'}
                  </label>
                  <input 
                    type="password" 
                    id="input-new-pwd" 
                    class="form-input" 
                    placeholder="Mínimo 4 caracteres..." 
                    autocomplete="new-password"
                    autofocus
                    required 
                    style="font-size: 1rem; padding: 10px 12px; letter-spacing: 2px;"
                  />
                </div>

                <div class="form-group">
                  <label for="input-confirm-pwd" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                    Confirmar Contraseña:
                  </label>
                  <input 
                    type="password" 
                    id="input-confirm-pwd" 
                    class="form-input" 
                    placeholder="Repite la contraseña..." 
                    autocomplete="new-password"
                    required 
                    style="font-size: 1rem; padding: 10px 12px; letter-spacing: 2px;"
                  />
                </div>

                <div id="create-pwd-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 8px 12px; border-radius: 6px; font-size: 0.80rem; font-weight: 600;">
                </div>

                <button type="submit" class="btn btn-primary" style="padding: 10px; font-size: 0.92rem; justify-content: center; margin-top: 4px;">
                  ${esRestablecimiento ? 'Actualizar Contraseña e Ingresar 🚀' : 'Guardar Contraseña e Ingresar 🚀'}
                </button>
              </form>
            </div>

            <div class="modal-footer" style="justify-content: space-between;">
              <button type="button" class="btn btn-secondary" id="btn-back-step1">Atrás</button>
              ${!esObligatorio ? '<button type="button" class="btn btn-secondary" id="btn-auth-cancel">Cancelar</button>' : ''}
            </div>
          </div>
        </div>
      `;

      const inputNew = document.getElementById('input-new-pwd');
      const inputConf = document.getElementById('input-confirm-pwd');
      const errBanner = document.getElementById('create-pwd-error');
      const form = document.getElementById('form-create-password');
      const btnSubmit = form.querySelector('button[type="submit"]');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBanner.style.display = 'none';

        const p1 = inputNew.value;
        const p2 = inputConf.value;

        if (p1.length < 4) {
          errBanner.textContent = 'La contraseña debe tener al menos 4 caracteres.';
          errBanner.style.display = 'block';
          inputNew.focus();
          return;
        }

        if (p1 !== p2) {
          errBanner.textContent = 'Las contraseñas no coinciden. Por favor verifica.';
          errBanner.style.display = 'block';
          inputConf.focus();
          inputConf.select();
          return;
        }

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.textContent = 'Guardando... ⏳';
          btnSubmit.style.opacity = '0.75';
        }

        const res = await staffService.registrarPassword(emp.identificacion, emp.email, p1);
        if (res.ok) {
          this.cerrarModal();
          if (onLoginExitoso) onLoginExitoso(res.usuario);
        } else {
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = esRestablecimiento ? 'Actualizar Contraseña e Ingresar 🚀' : 'Guardar Contraseña e Ingresar 🚀';
            btnSubmit.style.opacity = '1';
          }
          errBanner.textContent = res.error;
          errBanner.style.display = 'block';
        }
      });

      document.getElementById('btn-back-step1')?.addEventListener('click', () => {
        if (esRestablecimiento) {
          renderRestablecerPassword(emp, emp.email);
        } else {
          renderNuevoRegistro(emp.email, emp.identificacion);
        }
      });
      document.getElementById('btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => inputNew?.focus(), 100);
    };

    // ─────────────────────────────────────────────────────────────
    // DECISIÓN INICIAL: ¿Usuario recordado o Inicio de Sesión Normal?
    // ─────────────────────────────────────────────────────────────
    if (usuarioRecordado && usuarioRecordado.identificacion) {
      renderIngresoRapido(usuarioRecordado);
    } else {
      renderLoginNormal('');
    }
  }

  /**
   * Obtiene el prefijo de nomenclatura estándar según el tipo de documento (desde Tablas Maestras)
   */
  obtenerPrefijoTipoDocumento(tipo) {
    const tipos = staffService.obtenerTiposDocumento();
    const key = (tipo || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const match = tipos.find((t) => {
      const nom = (t.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      return nom === key || nom.includes(key) || key.includes(nom);
    });

    if (match && match.prefijo) return match.prefijo.toUpperCase();
    return tipo ? tipo.substring(0, 3).toUpperCase() : 'DOC';
  }

  /**
   * Obtiene la sigla estándar institucional según el área seleccionada (desde Tablas Maestras)
   */
  obtenerSiglaArea(area) {
    const areas = staffService.obtenerAreasInstitucionales();
    const key = (area || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const match = areas.find((a) => {
      const nom = (a.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const sig = (a.sigla || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      return nom === key || sig === key || nom.includes(key) || key.includes(nom);
    });

    if (match && match.sigla) return match.sigla.toUpperCase();
    if (/^[A-Z]{2,5}$/.test(area.trim())) return area.trim();
    const palabras = key.split(/\s+/).filter((p) => p.length > 2);
    if (palabras.length >= 2) {
      return palabras.map((p) => p[0].toUpperCase()).join('').substring(0, 4);
    }
    return (area || 'GEN').substring(0, 3).toUpperCase();
  }

  /**
   * Calcula el código automático con el consecutivo más alto + 1 con 3 cifras
   */
  calcularSiguienteCodigo(tipoDoc, area) {
    const prefijo = this.obtenerPrefijoTipoDocumento(tipoDoc);
    const sigla = this.obtenerSiglaArea(area);
    const patron = new RegExp('^' + prefijo + '-' + sigla + '-(\\d+)', 'i');

    let maxConsecutivo = 0;
    const docs = sharepointService.documentosEnMemoria || [];
    for (const d of docs) {
      if (d.codigo) {
        const match = d.codigo.trim().match(patron);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxConsecutivo) {
            maxConsecutivo = num;
          }
        }
      }
    }

    const sigNum = maxConsecutivo + 1;
    const consecutivoStr = String(sigNum).padStart(3, '0');
    return {
      codigoCompleto: `${prefijo}-${sigla}-${consecutivoStr}`,
      prefijo: prefijo,
      siglaArea: sigla,
      consecutivo: consecutivoStr,
      numero: sigNum
    };
  }

  /**
   * Obtiene rutas de carpetas de SharePoint sugeridas a partir del prefijo o área de codificación
   */
  obtenerRutasSugeridas(codigo, tipoDoc, area, proceso) {
    const docs = sharepointService.documentosEnMemoria || [];
    const codUpper = (codigo || '').trim().toUpperCase();
    const partesCod = codUpper.split('-');
    const prefijo = partesCod.length >= 2 ? `${partesCod[0]}-${partesCod[1]}` : codUpper;

    const mapaRutas = new Map();

    const procesarDoc = (d) => {
      const spUrl = (d.sharepointUrl || d.downloadUrl || '').trim();
      if (!spUrl || spUrl === '#' || !spUrl.includes('/Documentos compartidos/')) return;

      let folderUrl = sharepointService.obtenerUrlCarpetaUbicacion(d);
      if (!folderUrl) {
        try {
          const urlLimpia = spUrl.split('?')[0];
          const lastSlash = urlLimpia.lastIndexOf('/');
          if (lastSlash > 0) {
            folderUrl = urlLimpia.substring(0, lastSlash);
          }
        } catch {}
      }

      if (!folderUrl || folderUrl === '#') return;

      const rutaLegible = sharepointService.obtenerRutaLegible(d) || `${d.tipoProceso || ''} / ${d.area || ''} / ${d.proceso || ''} / ${d.carpeta || d.tipoDocumento || ''}`;

      if (!mapaRutas.has(folderUrl)) {
        mapaRutas.set(folderUrl, {
          folderUrl: folderUrl,
          urlCarpeta: folderUrl,
          rutaLegible: rutaLegible,
          count: 0,
          ejemplos: []
        });
      }
      const entry = mapaRutas.get(folderUrl);
      entry.count += 1;
      if (entry.ejemplos.length < 3 && d.codigo) {
        entry.ejemplos.push(d.codigo);
      }
    };

    // 1. Filtrar por prefijo exacto (ej: "INS-GIC", "FMT-GTH", "DA-GMD")
    if (prefijo) {
      docs.filter((d) => (d.codigo || '').toUpperCase().startsWith(prefijo)).forEach(procesarDoc);
    }

    // 2. Si no encontró por prefijo, buscar por misma Área y Tipo de Documento
    if (mapaRutas.size === 0 && area && tipoDoc) {
      docs
        .filter(
          (d) =>
            (d.area || '').toLowerCase() === area.toLowerCase() &&
            (d.tipoDocumento || '').toLowerCase() === tipoDoc.toLowerCase()
        )
        .forEach(procesarDoc);
    }

    // 3. Si no encontró, buscar por misma Área
    if (mapaRutas.size === 0 && area) {
      docs.filter((d) => (d.area || '').toLowerCase() === area.toLowerCase()).forEach(procesarDoc);
    }

    return {
      prefijo: prefijo,
      rutas: Array.from(mapaRutas.values()).sort((a, b) => b.count - a.count)
    };
  }

  normalizarFechaAInputDate(str) {
    if (!str) {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const s = String(str).trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  convertirInputDateAFecha(dateVal) {
    if (!dateVal) {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    const s = String(dateVal).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]}`;
    }
    return s;
  }

  generarOptionsTiempoRetencion(seleccionado = '5 Años') {
    const opciones = ['1 Año', '2 Años', '3 Años', '4 Años', '5 Años', 'Indefinido', 'N/A'];
    const selNorm = (seleccionado || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let encontrada = false;
    const html = opciones.map((opt) => {
      const optNorm = opt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isSel = optNorm === selNorm;
      if (isSel) encontrada = true;
      return `<option value="${opt}" ${isSel ? 'selected' : ''}>${opt}</option>`;
    }).join('');

    if (!encontrada && seleccionado && seleccionado.trim()) {
      return `<option value="${seleccionado.trim()}" selected>${seleccionado.trim()}</option>` + html;
    }
    return html;
  }

  generarOptionsLugarCustodia(seleccionado = 'Oficina central y sede') {
    const opciones = ['Archivo digital', 'Oficina central', 'Oficina central y sede'];
    const selNorm = (seleccionado || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let encontrada = false;
    const html = opciones.map((opt) => {
      const optNorm = opt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isSel = optNorm === selNorm || (selNorm.includes('sede') && optNorm.includes('sede')) || (selNorm.includes('ofinica') && optNorm.includes('oficina'));
      if (isSel) encontrada = true;
      return `<option value="${opt}" ${isSel ? 'selected' : ''}>${opt}</option>`;
    }).join('');

    if (!encontrada && seleccionado && seleccionado.trim()) {
      return `<option value="${seleccionado.trim()}" selected>${seleccionado.trim()}</option>` + html;
    }
    return html;
  }

  /**
   * Modal interactivo para crear y registrar un nuevo documento en Google Sheets
   */
  abrirModalNuevoDocumento({ onGuardar = null } = {}) {
    document.body.classList.add('modal-open');

    // Cargar listas dinámicas desde las Tablas Maestras ordenadas alfabéticamente
    const tiposDocMaestros = [...staffService.obtenerTiposDocumento()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const areasMaestras = [...staffService.obtenerAreasInstitucionales()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

    const tipoDocDefault = tiposDocMaestros[0]?.nombre || 'Formato';
    const areaDefault = areasMaestras[0]?.nombre || 'Gestión Talento Humano';

    // Código inicial por defecto calculado
    const codigoInicial = this.calcularSiguienteCodigo(tipoDocDefault, areaDefault);

    const optionsTiposHtml = tiposDocMaestros
      .map((t, idx) => `<option value="${t.nombre}" ${idx === 0 ? 'selected' : ''}>${t.nombre} (${t.prefijo})</option>`)
      .join('');

    const optionsAreasHtml = areasMaestras
      .map((a, idx) => `<option value="${a.nombre}" ${idx === 0 ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
      .join('');

    const tiposProcesoMaestros = staffService.obtenerTiposProceso();
    const optionsTiposProcesoHtml = tiposProcesoMaestros
      .map((tp, idx) => `<option value="${tp.nombre}" ${idx === 0 ? 'selected' : ''}>${tp.nombre}</option>`)
      .join('');

    const generarOptionsProcesosND = (nombreArea, procesoSeleccionado = '') => {
      const procs = staffService.obtenerProcesosPorArea(nombreArea);
      if (procs.length === 0) {
        return `<option value="N/A">N/A</option>`;
      }
      return procs.map((p) => `<option value="${p}" ${p.toLowerCase() === (procesoSeleccionado || '').toLowerCase() ? 'selected' : ''}>${p}</option>`).join('');
    };

    const optionsProcesosHtml = generarOptionsProcesosND(areaDefault);

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 690px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
          
          <!-- Encabezado con Azul Institucional Corporativo -->
          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                📄
              </div>
              <div>
                <h2 style="font-family: var(--font-heading); font-size: 1.22rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em;">
                  Nuevo Documento Institucional
                </h2>
                <span style="font-size: 0.76rem; color: #e2edf5; font-weight: 500;">
                  Nomenclatura institucional y registro en catálogo maestro
                </span>
              </div>
            </div>
            <button type="button" class="modal-close-btn" id="btn-nuevo-doc-close" style="color: #ffffff; background: rgba(255,255,255,0.18); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; font-size: 1.2rem; cursor: pointer; transition: background 0.2s ease;">
              ✕
            </button>
          </div>

          <!-- Formulario con scroll -->
          <form id="form-nuevo-documento" style="padding: 22px 26px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; margin: 0;">
            
            <div id="nuevo-doc-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;"></div>

            <!-- Fila 1: Tipo de Documento, Área Institucional y Código Automático -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; align-items: start;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                  1. Tipo de Documento <span style="color: #dc2626;">*</span>
                </label>
                <select id="nd-tipo-doc" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">
                  ${optionsTiposHtml}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                  2. Área Institucional <span style="color: #dc2626;">*</span>
                </label>
                <select id="nd-area" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">
                  ${optionsAreasHtml}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                  3. Código Automático <span style="color: #dc2626;">*</span>
                </label>
                <input type="text" id="nd-codigo" class="form-input" value="${codigoInicial.codigoCompleto}" required style="width: 100%; height: 38px; font-weight: 800; font-size: 0.95rem; text-align: center; text-transform: uppercase; background: #ffffff; border: 1.5px solid #376c95; color: #1f4260; letter-spacing: 0.5px;" title="Código del documento (editable)" />
              </div>
            </div>

            <!-- Fila 2: Nombre / Título del Documento y Versión -->
            <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Nombre / Título del Documento <span style="color: #dc2626;">*</span>
                </label>
                <input type="text" id="nd-titulo" class="form-input" placeholder="Nombre completo del formato, guía o procedimiento..." required style="width: 100%; height: 38px;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Versión <span style="color: #dc2626;">*</span>
                </label>
                <input type="text" id="nd-version" class="form-input" value="v01" required style="width: 100%; height: 38px; font-weight: 700; text-align: center; color: var(--primary, #376c95);" />
              </div>
            </div>

            <!-- Fila 3: Tipo de Proceso y Proceso Específico -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Tipo de Proceso
                </label>
                <select id="nd-tipo-proceso" class="form-input" style="width: 100%; height: 38px;">
                  ${optionsTiposProcesoHtml}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Proceso Específico
                </label>
                <select id="nd-proceso" class="form-input" style="width: 100%; height: 38px;">
                  ${optionsProcesosHtml}
                </select>
              </div>
            </div>

            <!-- Fila 4: Estado del Documento -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                Estado del Documento
              </label>
              <select id="nd-estado" class="form-input" style="width: 100%; height: 38px;">
                <option value="Activo" selected>Activo</option>
                <option value="Inactivo">Inactivo</option>
                <option value="En Revisión">En Revisión</option>
                <option value="Obsoleto">Obsoleto</option>
              </select>
            </div>

            <!-- Fila 5: Vigencia, Tiempo de Retención y Lugar de Custodia -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Vigencia
                </label>
                <input type="date" id="nd-vigencia" class="form-input" value="${this.normalizarFechaAInputDate()}" style="width: 100%; height: 38px;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Tiempo de Retención
                </label>
                <select id="nd-tiempo-retencion" class="form-input" style="width: 100%; height: 38px;">
                  ${this.generarOptionsTiempoRetencion('5 Años')}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Lugar de Archivo / Custodia
                </label>
                <select id="nd-lugar" class="form-input" style="width: 100%; height: 38px;">
                  ${this.generarOptionsLugarCustodia('Archivo digital')}
                </select>
              </div>
            </div>

            <!-- Fila 6: Tipo de Cambio -->
            <div style="margin-top: 2px;">
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                Tipo de Cambio
              </label>
              <input type="text" id="nd-tipo-cambio" class="form-input" value="Creación del documento" style="width: 100%; height: 38px;" />
            </div>

            <!-- Fila 7: Permisos RBAC y Descarga -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>👥</span> Permisos de Consulta y Descarga:
              </div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.80rem; color: #1e293b;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="nd-perm-op" checked /> Operativo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="nd-perm-adm" checked /> Administrativo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="nd-perm-dir" checked /> Directivo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600; color: var(--brand-navy, #1f4260);">
                  <input type="checkbox" id="nd-descargable" checked /> Permitir Descarga de Copia
                </label>
              </div>
            </div>

            <!-- Fila 8: Sección Unificada: Disponibilidad Técnica y Ubicación / Rutas en SharePoint -->
            <div id="nd-disponibilidad-seccion-wrapper" style="background: #f0f7ff; border: 1.5px solid #b9d9f5; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <span id="nd-disp-seccion-titulo" style="font-size: 0.80rem; font-weight: 700; color: var(--brand-navy, #1f4260); display: flex; align-items: center; gap: 6px;">
                    <span>📁</span> Disponibilidad Técnica y Ubicación:
                  </span>
                  <div id="nd-disp-badge-container">
                    <!-- Badge renderizado dinámicamente -->
                  </div>
                </div>
                <span id="nd-rutas-prefijo-label" style="font-size: 0.72rem; color: #0284c7; font-weight: 700; background: #e0f2fe; padding: 2px 8px; border-radius: 10px;">
                  Prefijo: ${codigoInicial.prefijoTipo}-${codigoInicial.siglaArea}
                </span>
                <input type="hidden" id="nd-disponibilidad" value="NO DISPONIBLE" />
              </div>
              <div id="nd-rutas-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto;">
                <!-- Rutas o ubicación exacta renderizadas reactivamente -->
              </div>
            </div>

            <!-- Nota Informativa de Campos OneDrive -->
            <div style="background: #edf5fa; border: 1px solid #cddde9; border-radius: 8px; padding: 10px 14px; font-size: 0.76rem; color: var(--brand-navy, #1f4260); display: flex; align-items: flex-start; gap: 8px;">
              <span style="font-size: 0.95rem;">ℹ️</span>
              <div>
                <strong>Sincronización Técnica Automática:</strong> Al subir el documento en la carpeta correspondiente de SharePoint con el nombre o código oficial, el sistema vinculará la descarga y disponibilidad automáticamente desde el archivo en OneDrive (<code>REPOSITORIO_DOCUMENTAL.csv</code>).
              </div>
            </div>

            <!-- Botones Footer -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
              <button type="button" class="btn btn-secondary" id="btn-nuevo-doc-cancel" style="padding: 9px 20px; font-weight: 600;">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" id="btn-nuevo-doc-save" style="background-color: var(--primary, #376c95); border: 1px solid var(--primary-dark, #265072); padding: 9px 24px; font-weight: 700; display: flex; align-items: center; gap: 7px; box-shadow: var(--shadow-sm);">
                <span>💾</span> Guardar Documento
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    const inputTipoDoc = document.getElementById('nd-tipo-doc');
    const inputArea = document.getElementById('nd-area');
    const inputCodigo = document.getElementById('nd-codigo');
    const selectProceso = document.getElementById('nd-proceso');

    // Función reactiva unificada para verificar la disponibilidad y actualizar rutas o ubicación exacta
    const actualizarDisponibilidadYRutas = () => {
      const cod = inputCodigo.value.trim().toUpperCase();
      const tipo = inputTipoDoc.value;
      const ar = inputArea.value;
      const proc = selectProceso ? selectProceso.value : '';

      const docExistente = (sharepointService.documentosEnMemoria || []).find((d) => (d.codigo || '').toUpperCase() === cod);
      const tieneEnlace = Boolean(
        docExistente &&
        ((docExistente.sharepointUrl && docExistente.sharepointUrl.trim() !== '' && docExistente.sharepointUrl !== '#') ||
         (docExistente.downloadUrl && docExistente.downloadUrl.trim() !== '' && docExistente.downloadUrl !== '#'))
      );

      const containerBadge = document.getElementById('nd-disp-badge-container');
      const inputDisp = document.getElementById('nd-disponibilidad');
      const prefijoBadge = document.getElementById('nd-rutas-prefijo-label');
      const listContainer = document.getElementById('nd-rutas-list');
      const wrapperSeccion = document.getElementById('nd-disponibilidad-seccion-wrapper');
      const tituloSeccion = document.getElementById('nd-disp-seccion-titulo');

      const resRutas = this.obtenerRutasSugeridas(cod, tipo, ar, proc);
      if (prefijoBadge) prefijoBadge.textContent = `Prefijo: ${resRutas.prefijo || 'General'}`;

      if (tieneEnlace) {
        if (inputDisp) inputDisp.value = 'DISPONIBLE';
        if (containerBadge) {
          containerBadge.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 9px; background:#dcfce7; border:1px solid #86efac; border-radius:6px; color:#15803d; font-size:0.75rem; font-weight:700;">
              <span style="width:7px; height:7px; border-radius:50%; background:#22c55e; display:inline-block;"></span>
              DISPONIBLE
            </span>
          `;
        }
        if (wrapperSeccion) {
          wrapperSeccion.style.background = '#f0fdf4';
          wrapperSeccion.style.borderColor = '#86efac';
        }
        if (tituloSeccion) {
          tituloSeccion.innerHTML = `<span>🟢</span> Archivo detectado en Repositorio:`;
        }

        const rutaActual = sharepointService.obtenerRutaLegible(docExistente);
        const folderUrl = docExistente.sharepointUrl || docExistente.downloadUrl || '';

        if (listContainer) {
          listContainer.innerHTML = `
            <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 8px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 0.72rem; color: #166534; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">
                  Ubicación actual del documento en SharePoint
                </div>
                <div style="font-size: 0.78rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; word-break: break-all;">
                  <span>📄</span> ${rutaActual || 'Carpeta Oficial SharePoint'}
                </div>
              </div>
              ${folderUrl ? `
                <button type="button" class="btn btn-secondary btn-open-sp-folder" data-folder-url="${encodeURIComponent(folderUrl)}" style="padding: 5px 12px; font-size: 0.74rem; font-weight: 700; display: flex; align-items: center; gap: 5px; white-space: nowrap; background: #22c55e; color: #ffffff; border: 1px solid #16a34a;">
                  <span>↗</span> Abrir Carpeta
                </button>
              ` : ''}
            </div>
          `;
        }
      } else {
        if (inputDisp) inputDisp.value = 'NO DISPONIBLE';
        if (containerBadge) {
          containerBadge.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 9px; background:#fee2e2; border:1px solid #fca5a5; border-radius:6px; color:#b91c1c; font-size:0.75rem; font-weight:700;">
              <span style="width:7px; height:7px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
              NO DISPONIBLE
            </span>
          `;
        }
        if (wrapperSeccion) {
          wrapperSeccion.style.background = '#f0f7ff';
          wrapperSeccion.style.borderColor = '#b9d9f5';
        }
        if (tituloSeccion) {
          tituloSeccion.innerHTML = `<span>📁</span> Rutas sugeridas para almacenar el documento en SharePoint:`;
        }

        if (listContainer) {
          if (resRutas.rutas.length === 0) {
            listContainer.innerHTML = `
              <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 0.76rem; color: #64748b; text-align: center;">
                No se encontraron rutas previas para documentos con prefijo <strong>${resRutas.prefijo}</strong>. Al subir el archivo en la estructura de SharePoint se sincronizará automáticamente.
              </div>
            `;
          } else {
            listContainer.innerHTML = resRutas.rutas
              .map((r) => {
                const cleanRuta = r.rutaLegible
                  .replace(/^DOCUMENTOS_INSTITUCIONALES\/[^\/]+\/[^\/]+\/[^\/]+\//i, '')
                  .replace(/^DOCUMENTOS_INSTITUCIONALES\//i, '')
                  .replace(/\//g, ' ❯ ');

                return `
                  <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 9px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <div style="flex: 1; min-width: 0;">
                      <div style="font-size: 0.77rem; font-weight: 700; color: #1e3a8a; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.rutaLegible}">
                        <span>📂</span> ${cleanRuta}
                      </div>
                      <div style="font-size: 0.70rem; color: #64748b; margin-top: 2px;">
                        ${r.count} ${r.count === 1 ? 'documento referenciado' : 'documentos referenciados'} (${r.ejemplos.join(', ')})
                      </div>
                    </div>
                    <button type="button" class="btn btn-secondary btn-open-sp-folder" data-folder-url="${encodeURIComponent(r.urlCarpeta || r.folderUrl || '')}" style="padding: 4px 10px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                      <span>📂</span> Abrir
                    </button>
                  </div>
                `;
              })
              .join('');
          }
        }
      }

      if (listContainer) {
        listContainer.querySelectorAll('.btn-open-sp-folder').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const rawAttr = btn.getAttribute('data-folder-url') || '';
            const url = rawAttr ? decodeURIComponent(rawAttr) : '';
            if (url && url !== 'undefined' && url !== 'null' && url !== '#') {
              window.open(url, '_blank');
            } else {
              if (window.Swal) {
                Swal.fire('Ruta no disponible', 'La dirección de la carpeta de SharePoint no está disponible.', 'warning');
              } else {
                alert('La dirección de la carpeta de SharePoint no está disponible.');
              }
            }
          });
        });
      }
    };

    const selectTipoProceso = document.getElementById('nd-tipo-proceso');

    const obtenerTipoProcesoPorArea = (nombreArea) => {
      const a = (nombreArea || '').toLowerCase();
      if (a.includes('calidad') || a.includes('gic')) return 'Estratégicos';
      if (a.includes('talento humano') || a.includes('gth') || a.includes('seguridad y salud') || a.includes('sst') || a.includes('financiera') || a.includes('gfi') || a.includes('tecnolog') || a.includes('gti') || a.includes('admin')) return 'Apoyo';
      if (a.includes('auditor') || a.includes('control')) return 'Evaluación y Control';
      return 'Misional';
    };

    // Función reactiva para actualizar el código y opciones de procesos según Tipo de Documento y Área
    const recalcularCodigoEnTiempoReal = () => {
      const t = inputTipoDoc.value;
      const a = inputArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputCodigo.value = res.codigoCompleto;

      const tipoProcSugerido = obtenerTipoProcesoPorArea(a);
      if (selectTipoProceso) {
        selectTipoProceso.value = tipoProcSugerido;
      }

      if (selectProceso) {
        selectProceso.innerHTML = generarOptionsProcesosND(a);
      }

      actualizarDisponibilidadYRutas();
    };

    inputTipoDoc?.addEventListener('change', recalcularCodigoEnTiempoReal);
    inputArea?.addEventListener('input', recalcularCodigoEnTiempoReal);
    inputArea?.addEventListener('change', recalcularCodigoEnTiempoReal);
    inputCodigo?.addEventListener('input', () => {
      actualizarDisponibilidadYRutas();
    });

    // Inicializar estado reactivo
    recalcularCodigoEnTiempoReal();

    const form = document.getElementById('form-nuevo-documento');
    const errBox = document.getElementById('nuevo-doc-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      const codigo = document.getElementById('nd-codigo').value.trim().toUpperCase();
      const titulo = document.getElementById('nd-titulo').value.trim();
      const version = staffService.formatearVersion(document.getElementById('nd-version').value.trim() || 'v01');
      const tipoProceso = document.getElementById('nd-tipo-proceso').value;
      const areaNombre = document.getElementById('nd-area').value.trim() || 'Gestión Integral Calidad';
      const proceso = document.getElementById('nd-proceso').value.trim() || 'Gestión Integral de Calidad';
      const tipoDocNombre = document.getElementById('nd-tipo-doc').value;
      const estado = document.getElementById('nd-estado').value || 'Activo';
      const dispVal = document.getElementById('nd-disponibilidad').value;
      const vigenciaInput = document.getElementById('nd-vigencia')?.value.trim();
      const tiempoRetencion = document.getElementById('nd-tiempo-retencion')?.value.trim() || '5 Años';
      const lugar = document.getElementById('nd-lugar')?.value.trim() || 'Oficina central y sede';
      const tipoCambio = document.getElementById('nd-tipo-cambio')?.value.trim() || 'Creación del documento';
      const permOp = document.getElementById('nd-perm-op').checked;
      const permAdm = document.getElementById('nd-perm-adm').checked;
      const permDir = document.getElementById('nd-perm-dir').checked;
      const descargable = document.getElementById('nd-descargable').checked;

      const partesCod = codigo.split('-');
      const prefijoSigla = partesCod[0] || 'DA';
      const areaSigla = partesCod[1] || 'GMD';
      const consecutivoNum = partesCod[2] || '001';

      const hoy = new Date();
      const fechaAprobacion = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      const vigencia = vigenciaInput ? this.convertirInputDateAFecha(vigenciaInput) : fechaAprobacion;
      const fechaVencimiento = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear() + 5}`;

      const btnSave = document.getElementById('btn-nuevo-doc-save');
      btnSave.disabled = true;
      btnSave.innerHTML = '<span>⏳</span> Guardando documento...';

      const nuevoDocumentoObj = {
        codigo: codigo,
        titulo: titulo,
        documento: titulo,
        version: version,
        consecutivo: consecutivoNum,
        tipoDocumento: prefijoSigla,
        tipoDocumentoNombre: tipoDocNombre,
        area: areaSigla,
        areaNombre: areaNombre,
        tipoProceso: tipoProceso,
        proceso: proceso,
        carpeta: proceso,
        fechaAprobacion: fechaAprobacion,
        vigencia: vigencia,
        fechaVencimiento: fechaVencimiento,
        ubicacion: 'Intranet',
        lugar: lugar,
        lugarArchivo: lugar,
        tiempoRetencion: tiempoRetencion,
        tiempo: tiempoRetencion,
        tiempoVigencia: tiempoRetencion,
        tipoCambio: tipoCambio,
        permisoOperativo: permOp,
        permisoAdministrativo: permAdm,
        permisoDirectivo: permDir,
        descargable: descargable,
        disponible: dispVal === 'DISPONIBLE',
        disponibilidad: dispVal,
        estado: estado,
        estadoDocumento: estado
      };

      try {
        const res = await sharepointService.crearDocumento(nuevoDocumentoObj);
        if (res && res.exito) {
          // 1. Registrar en Auditoría Institucional
          staffService.registrarAuditoria('CREACION', {
            documentoCodigo: codigo,
            documentoTitulo: titulo,
            documentoExtension: nuevoDocumentoObj.extension || 'DOC',
            detalle: `Nuevo documento incorporado al catálogo (${codigo} - ${titulo})`
          });

          // 2. Registrar evento en control de cambios
          staffService.registrarCambioDocumental('CREACION', {
            codigo: codigo,
            titulo: titulo,
            versionAnterior: 'N/A',
            versionNueva: version,
            rutaAnterior: 'N/A',
            rutaNueva: `${tipoProceso} / ${areaNombre || areaSigla} / ${proceso}`,
            tipoAnterior: 'N/A',
            tipoNuevo: tipoDocNombre || prefijoSigla,
            detalle: `Nuevo documento incorporado al catálogo (${codigo})`
          });

          this.cerrarModal();
          if (typeof onGuardar === 'function') onGuardar(res.documento);
        } else {
          errBox.textContent = res?.error || 'Error al guardar el documento.';
          errBox.style.display = 'block';
          btnSave.disabled = false;
          btnSave.innerHTML = 'Guardar Documento';
        }
      } catch (err) {
        console.error('Error al guardar documento:', err);
        errBox.textContent = 'Error al guardar el documento: ' + (err.message || '');
        errBox.style.display = 'block';
        btnSave.disabled = false;
        btnSave.innerHTML = 'Guardar Documento';
      }
    });

    document.getElementById('btn-nuevo-doc-close')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('btn-nuevo-doc-cancel')?.addEventListener('click', () => this.cerrarModal());
    setTimeout(() => document.getElementById('nd-titulo')?.focus(), 100);
  }

  /**
   * Modal interactivo para modificar metadatos de un documento en Google Sheets
   */
  abrirModalEditarDocumento(doc, { onGuardar = null } = {}) {
    if (!doc) return;
    document.body.classList.add('modal-open');

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
          
          <!-- Encabezado con Azul Institucional -->
          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                ✏️
              </div>
              <div>
                <h2 style="font-family: var(--font-heading); font-size: 1.22rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em;">
                  Modificar Metadatos (${doc.codigo})
                </h2>
                <span style="font-size: 0.76rem; color: #e2edf5; font-weight: 500;">
                  Actualización de metadatos y parámetros del catálogo
                </span>
              </div>
            </div>
            <button type="button" class="modal-close-btn" id="btn-edit-doc-close" style="color: #ffffff; background: rgba(255,255,255,0.18); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; font-size: 1.2rem; cursor: pointer; transition: background 0.2s ease;">
              ✕
            </button>
          </div>

          <!-- Formulario con scroll -->
          <form id="form-edit-documento" style="padding: 22px 26px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; margin: 0;">
            
            <div id="edit-doc-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;"></div>

            <!-- Panel Informativo: Nomenclatura y Codificación Oficial (Solo Lectura con Botón de Recodificación) -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.2rem;">🏷️</span>
                  <div>
                    <span style="font-size: 0.70rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Estructura y Codificación Oficial</span>
                    <div style="font-size: 1.12rem; font-weight: 800; color: var(--brand-navy, #1f4260); letter-spacing: 0.5px;">${doc.codigo}</div>
                  </div>
                </div>
                <button type="button" id="btn-open-recodificar" class="btn btn-secondary" style="font-size: 0.76rem; font-weight: 700; color: var(--brand-navy, #1f4260); border: 1.5px solid #94a3b8; background: #ffffff; padding: 6px 14px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                  <span>🔄</span> Cambiar Codificación / Recodificar
                </button>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 0.76rem; color: #334155; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <div><strong>Tipo Doc:</strong> <span style="color:#0369a1; font-weight:600;">${doc.tipoDocumento || 'N/A'}</span></div>
                <div><strong>Área:</strong> <span style="color:#0369a1; font-weight:600;">${doc.areaNombre || doc.area || 'N/A'}</span></div>
                <div><strong>Proceso:</strong> <span style="color:#0369a1; font-weight:600;">${doc.proceso || doc.carpeta || 'N/A'}</span></div>
              </div>
              <div style="font-size: 0.71rem; color: #64748b; line-height: 1.35;">
                ℹ️ <em>Nota técnica:</em> El tipo de documento y el área determinan la codificación institucional. Para reclasificar este documento a otra área o tipo con su respectiva nomenclatura, utiliza la opción <strong>"Cambiar Codificación / Recodificar"</strong>.
              </div>
            </div>

            <!-- Fila 1: Nombre / Título y Versión -->
            <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Nombre / Título del Documento <span style="color: #dc2626;">*</span>
                </label>
                <input type="text" id="ed-titulo" class="form-input" value="${(doc.titulo || '').replace(/"/g, '&quot;')}" required style="width: 100%; height: 38px; font-weight: 600;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Versión <span style="color: #dc2626;">*</span>
                </label>
                <input type="text" id="ed-version" class="form-input" value="${doc.version || '01'}" required style="width: 100%; height: 38px; font-weight: 700; text-align: center;" />
              </div>
            </div>

            <!-- Fila 2: Estado del Documento y Motivo / Tipo de Cambio -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Estado del Documento
                </label>
                <select id="ed-estado" class="form-input" style="width: 100%; height: 38px;">
                  <option value="Activo" ${doc.estado === 'Activo' || doc.estadoDocumento === 'Activo' ? 'selected' : ''}>Activo</option>
                  <option value="Inactivo" ${doc.estado === 'Inactivo' || doc.estadoDocumento === 'Inactivo' ? 'selected' : ''}>Inactivo</option>
                  <option value="En Revisión" ${doc.estado === 'En Revisión' || doc.estadoDocumento === 'En Revisión' ? 'selected' : ''}>En Revisión</option>
                  <option value="Obsoleto" ${doc.estado === 'Obsoleto' || doc.estadoDocumento === 'Obsoleto' ? 'selected' : ''}>Obsoleto</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Motivo / Tipo de Cambio
                </label>
                <input type="text" id="ed-tipo-cambio" class="form-input" value="${(doc.tipoCambio || 'Actualización de metadatos').replace(/"/g, '&quot;')}" style="width: 100%; height: 38px;" />
              </div>
            </div>

            <!-- Fila 3: Vigencia, Tiempo de Retención y Lugar de Archivo -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Vigencia
                </label>
                <input type="date" id="ed-vigencia" class="form-input" value="${this.normalizarFechaAInputDate(doc.vigencia || doc.fechaAprobacion || '01/08/2026')}" style="width: 100%; height: 38px;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Tiempo de Retención
                </label>
                <select id="ed-tiempo-retencion" class="form-input" style="width: 100%; height: 38px;">
                  ${this.generarOptionsTiempoRetencion(doc.tiempoRetencion || doc.tiempo)}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  Lugar de Custodia
                </label>
                <select id="ed-lugar" class="form-input" style="width: 100%; height: 38px;">
                  ${this.generarOptionsLugarCustodia(doc.lugar || doc.lugarArchivo)}
                </select>
              </div>
            </div>

            <!-- Fila 4: Permisos RBAC y Descarga -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px 16px;">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <span>👥</span> Permisos de Consulta y Descarga:
              </div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.80rem; color: #1e293b;">
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="ed-perm-op" ${doc.permisoOperativo !== false ? 'checked' : ''} /> Operativo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="ed-perm-adm" ${doc.permisoAdministrativo !== false ? 'checked' : ''} /> Administrativo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 500;">
                  <input type="checkbox" id="ed-perm-dir" ${doc.permisoDirectivo !== false ? 'checked' : ''} /> Directivo
                </label>
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600; color: var(--brand-navy, #1f4260);">
                  <input type="checkbox" id="ed-descargable" ${doc.descargable !== false ? 'checked' : ''} /> Permitir Descarga
                </label>
              </div>
            </div>

            <!-- Fila 5: Datos Técnicos Extraídos de OneDrive (Solo Lectura) -->
            <div style="background: #f1f5f9; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: #475569;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong>Extensión:</strong> <span class="badge" style="background: #e2e8f0; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${doc.extension || 'DOC'}</span>
                &nbsp;|&nbsp;
                <strong>Modificación SharePoint:</strong> ${doc.modificacion || 'N/A'}
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${doc.disponible ? `
                  <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 8px; font-size: 0.70rem; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;">🟢 En Línea (OneDrive)</span>
                ` : `
                  <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 8px; font-size: 0.70rem; font-weight: 800; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;">🔴 No Disponible en OneDrive</span>
                `}
              </div>
            </div>

            <!-- Botones Footer -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
              <button type="button" class="btn btn-secondary" id="btn-edit-doc-cancel" style="padding: 9px 20px; font-weight: 600;">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" id="btn-edit-doc-save" style="background: linear-gradient(135deg, #265072 0%, #376c95 100%); padding: 9px 24px; font-weight: 700; display: flex; align-items: center; gap: 7px; box-shadow: 0 2px 6px rgba(31,66,96,0.25);">
                Actualizar Metadatos
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    const form = document.getElementById('form-edit-documento');
    const errBox = document.getElementById('edit-doc-error');

    // Botón para abrir el submodal de recodificación oficial
    document.getElementById('btn-open-recodificar')?.addEventListener('click', () => {
      this.abrirModalRecodificarDocumento(doc, {
        onRecodificado: (docRecod) => {
          if (typeof onGuardar === 'function') onGuardar(docRecod);
        }
      });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      const titulo = document.getElementById('ed-titulo').value.trim();
      const version = document.getElementById('ed-version').value.trim() || '01';
      const estado = document.getElementById('ed-estado').value;
      const rawVigencia = document.getElementById('ed-vigencia').value.trim();
      const vigencia = rawVigencia ? this.convertirInputDateAFecha(rawVigencia) : '01/08/2026';
      const tiempoRetencion = document.getElementById('ed-tiempo-retencion').value.trim() || '5 Años';
      const lugar = document.getElementById('ed-lugar').value.trim() || 'Oficina central y sede';
      const tipoCambio = document.getElementById('ed-tipo-cambio').value.trim() || 'Actualización de metadatos';
      const permOp = document.getElementById('ed-perm-op').checked;
      const permAdm = document.getElementById('ed-perm-adm').checked;
      const permDir = document.getElementById('ed-perm-dir').checked;
      const descargable = document.getElementById('ed-descargable').checked;

      const btnSave = document.getElementById('btn-edit-doc-save');
      btnSave.disabled = true;
      btnSave.innerHTML = '<span>⏳</span> Actualizando metadatos...';

      const nuevosDatos = {
        titulo: titulo,
        documento: titulo,
        nombre: titulo,
        version: version,
        tipoProceso: doc.tipoProceso || 'Estratégico',
        area: doc.area || 'GAD',
        areaNombre: doc.areaNombre || doc.area || 'Gestión Administrativa',
        proceso: doc.proceso || doc.carpeta || 'Planeación Estratégica y Dirección',
        carpeta: doc.carpeta || doc.proceso || 'Planeación Estratégica y Dirección',
        tipoDocumento: doc.tipoDocumento || 'Manual',
        estado: estado,
        vigencia: vigencia,
        tiempoRetencion: tiempoRetencion,
        tiempo: tiempoRetencion,
        tiempoVigencia: tiempoRetencion,
        lugar: lugar,
        lugarArchivo: lugar,
        tipoCambio: tipoCambio,
        permisoOperativo: permOp,
        permisoAdministrativo: permAdm,
        permisoDirectivo: permDir,
        directivo: permDir ? 'X' : '',
        administrativo: permAdm ? 'X' : '',
        operativo: permOp ? 'X' : '',
        descargable: descargable
      };

      try {
        const res = await sharepointService.modificarDocumento(doc.codigo, nuevosDatos);
        if (res && res.exito) {
          // Registrar en control de cambios
          const esCambioVersion = version && doc.version && !staffService.sonVersionesIguales(version, doc.version);
          staffService.registrarCambioDocumental(
            esCambioVersion ? 'CAMBIO_VERSION' : 'CAMBIO_METADATOS',
            {
              codigo: doc.codigo,
              titulo: titulo,
              versionAnterior: staffService.normalizarVersion(doc.version || '1'),
              versionNueva: staffService.normalizarVersion(version || '1'),
              rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
              rutaNueva: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
              tipoAnterior: doc.tipoDocumento || '',
              tipoNuevo: doc.tipoDocumento || '',
              motivo: tipoCambio || 'Actualización de metadatos',
              detalle: `Modificación de metadatos: ${tipoCambio || 'Datos actualizados en catálogo'}`
            }
          );

          this.cerrarModal();
          if (typeof onGuardar === 'function') onGuardar(res.documento);
        } else {
          errBox.textContent = res?.error || 'Error al actualizar metadatos.';
          errBox.style.display = 'block';
          btnSave.disabled = false;
          btnSave.textContent = 'Actualizar Metadatos';
        }
      } catch (err) {
        console.error('Error al actualizar documento:', err);
        errBox.textContent = 'Error al actualizar metadatos: ' + (err.message || '');
        errBox.style.display = 'block';
        btnSave.disabled = false;
        btnSave.textContent = 'Actualizar Metadatos';
      }
    });

    document.getElementById('btn-edit-doc-close')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('btn-edit-doc-cancel')?.addEventListener('click', () => this.cerrarModal());
    setTimeout(() => document.getElementById('ed-titulo')?.focus(), 100);
  }

  /**
   * Submodal dedicado: Recodificación Oficial y Reclasificación Estructural del Documento
   */
  abrirModalRecodificarDocumento(doc, { onRecodificado = null } = {}) {
    if (!doc) return;
    document.body.classList.add('modal-open');

    // Cargar listas dinámicas desde las Tablas Maestras ordenadas alfabéticamente
    const tiposDocMaestros = [...staffService.obtenerTiposDocumento()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const areasMaestras = [...staffService.obtenerAreasInstitucionales()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    const tiposProcesoMaestros = staffService.obtenerTiposProceso();

    // Tipo y Área iniciales seleccionados
    const tipoDocActualNombre = doc.tipoDocumento || tiposDocMaestros[0]?.nombre || 'Formato';
    const areaActualNombre = doc.areaNombre || doc.area || areasMaestras[0]?.nombre || 'Gestión Talento Humano';

    const codigoCalculadoInicial = this.calcularSiguienteCodigo(tipoDocActualNombre, areaActualNombre);

    const optionsTiposHtml = tiposDocMaestros
      .map((t) => `<option value="${t.nombre}" ${t.nombre.toLowerCase() === tipoDocActualNombre.toLowerCase() ? 'selected' : ''}>${t.nombre} (${t.prefijo})</option>`)
      .join('');

    const optionsAreasHtml = areasMaestras
      .map((a) => `<option value="${a.nombre}" ${a.nombre.toLowerCase() === areaActualNombre.toLowerCase() ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
      .join('');

    const optionsTiposProcesoHtml = tiposProcesoMaestros
      .map((tp) => `<option value="${tp.nombre}" ${(doc.tipoProceso || '').toLowerCase() === tp.nombre.toLowerCase() ? 'selected' : ''}>${tp.nombre}</option>`)
      .join('');

    const generarOptionsProcesosRecod = (nombreArea, procesoSeleccionado = '') => {
      const procs = staffService.obtenerProcesosPorArea(nombreArea);
      if (procs.length === 0) return `<option value="N/A">N/A</option>`;
      return procs.map((p) => `<option value="${p}" ${p.toLowerCase() === (procesoSeleccionado || '').toLowerCase() ? 'selected' : ''}>${p}</option>`).join('');
    };

    const optionsProcesosHtml = generarOptionsProcesosRecod(areaActualNombre, doc.proceso || doc.carpeta || '');

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 680px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">
          
          <!-- Encabezado Corporativo -->
          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                🔄
              </div>
              <div>
                <h2 style="font-family: var(--font-heading); font-size: 1.22rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em;">
                  Recodificación Oficial del Documento
                </h2>
                <span style="font-size: 0.76rem; color: #e2edf5; font-weight: 500;">
                  Reclasificación de tipo de documento, área institucional y reasignación de código
                </span>
              </div>
            </div>
            <button type="button" class="modal-close-btn" id="btn-recod-close" style="color: #ffffff; background: rgba(255,255,255,0.18); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; font-size: 1.2rem; cursor: pointer;">
              ✕
            </button>
          </div>

          <!-- Formulario de Recodificación -->
          <form id="form-recodificar-documento" style="padding: 22px 26px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; margin: 0;">
            
            <div id="recod-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;"></div>

            <!-- Comparativo Visual: Código Actual vs Nuevo Código Calculado -->
            <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 14px 16px; align-items: center; text-align: center;">
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.70rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Código Actual</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #334155; margin-top: 2px;">${doc.codigo}</div>
              </div>
              <div style="font-size: 1.3rem; color: #2563eb; font-weight: 800;">➔</div>
              <div style="background: #ffffff; border: 2px solid #2563eb; border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.70rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">Nuevo Código Sugerido</div>
                <input type="text" id="recod-nuevo-codigo" value="${codigoCalculadoInicial.codigoCompleto}" style="width: 100%; border: none; font-size: 1.08rem; font-weight: 800; color: #1e3a8a; text-align: center; background: transparent; padding: 2px 0;" />
              </div>
            </div>

            <!-- Título del Documento Referenciado -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                Documento a Recodificar:
              </label>
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 0.82rem; font-weight: 600; color: #1e293b;">
                ${doc.titulo || doc.nombre || 'Documento Institucional'}
              </div>
            </div>

            <!-- Sección de Reclasificación -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                  1. Nuevo Tipo de Documento <span style="color: #dc2626;">*</span>
                </label>
                <select id="recod-tipo-doc" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">
                  ${optionsTiposHtml}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                  2. Nueva Área Institucional <span style="color: #dc2626;">*</span>
                </label>
                <select id="recod-area" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">
                  ${optionsAreasHtml}
                </select>
              </div>
            </div>

            <!-- Fila: Tipo de Proceso y Proceso Específico -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  3. Tipo de Proceso
                </label>
                <select id="recod-tipo-proceso" class="form-input" style="width: 100%; height: 38px;">
                  ${optionsTiposProcesoHtml}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                  4. Proceso Específico
                </label>
                <select id="recod-proceso" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">
                  ${optionsProcesosHtml}
                </select>
              </div>
            </div>

            <!-- Justificación Obligatoria para Auditoría -->
            <div>
              <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                Motivo / Justificación de la Recodificación <span style="color: #dc2626;">*</span>
              </label>
              <input type="text" id="recod-motivo" class="form-input" placeholder="Ej: Reestructuración de procesos de calidad, cambio de alcance..." required style="width: 100%; height: 38px;" />
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; font-size: 0.75rem; color: #92400e; line-height: 1.4;">
              ⚠️ <strong>Advertencia institucional:</strong> Al confirmar la recodificación, el documento adoptará su nuevo código de forma inmediata y se dejará registro de la trazabilidad histórica en el Control de Cambios Documentales.
            </div>

            <!-- Botones Footer -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
              <button type="button" class="btn btn-secondary" id="btn-recod-cancel" style="padding: 9px 20px; font-weight: 600;">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" id="btn-recod-save" style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 9px 24px; font-weight: 700; display: flex; align-items: center; gap: 7px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">
                <span>🔄</span> Aplicar Recodificación Oficial
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    const formRecod = document.getElementById('form-recodificar-documento');
    const errBox = document.getElementById('recod-error');
    const selectTipoDoc = document.getElementById('recod-tipo-doc');
    const selectArea = document.getElementById('recod-area');
    const selectProceso = document.getElementById('recod-proceso');
    const inputNuevoCodigo = document.getElementById('recod-nuevo-codigo');

    const recalcularNuevoCodigo = () => {
      const t = selectTipoDoc.value;
      const a = selectArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputNuevoCodigo.value = res.codigoCompleto;
      selectProceso.innerHTML = generarOptionsProcesosRecod(a);
    };

    selectTipoDoc?.addEventListener('change', recalcularNuevoCodigo);
    selectArea?.addEventListener('change', recalcularNuevoCodigo);

    formRecod.addEventListener('submit', async (e) => {
      e.preventDefault();
      errBox.style.display = 'none';

      const nuevoCodigo = inputNuevoCodigo.value.trim().toUpperCase();
      const tipoDocNombre = selectTipoDoc.value;
      const areaNombre = selectArea.value;
      const tipoProceso = document.getElementById('recod-tipo-proceso').value;
      const proceso = selectProceso.value;
      const motivo = document.getElementById('recod-motivo').value.trim();

      if (!nuevoCodigo) {
        errBox.textContent = 'El nuevo código de documento es obligatorio.';
        errBox.style.display = 'block';
        return;
      }

      if (!motivo) {
        errBox.textContent = 'Por favor ingresa el motivo o justificación de la recodificación.';
        errBox.style.display = 'block';
        return;
      }

      const btnSave = document.getElementById('btn-recod-save');
      btnSave.disabled = true;
      btnSave.innerHTML = '<span>⏳</span> Aplicando recodificación...';

      const partesCod = nuevoCodigo.split('-');
      const prefijoSigla = partesCod[0] || this.obtenerPrefijoTipoDocumento(tipoDocNombre);
      const areaSigla = partesCod[1] || this.obtenerSiglaArea(areaNombre);

      const nuevosDatos = {
        ...doc,
        codigo: nuevoCodigo,
        codigoAnterior: doc.codigo,
        tipoDocumento: prefijoSigla,
        tipoDocumentoNombre: tipoDocNombre,
        area: areaSigla,
        areaNombre: areaNombre,
        tipoProceso: tipoProceso,
        proceso: proceso,
        carpeta: proceso,
        tipoCambio: `Recodificación oficial: ${doc.codigo} ➔ ${nuevoCodigo}. Motivo: ${motivo}`
      };

      try {
        const res = await sharepointService.recodificarDocumento(doc.codigo, nuevoCodigo, nuevosDatos);
        if (res && res.exito) {
          // Registrar en control de cambios
          staffService.registrarCambioDocumental('CAMBIO_RUTA', {
            codigo: nuevoCodigo,
            titulo: doc.titulo || doc.nombre || 'Documento',
            versionAnterior: staffService.normalizarVersion(doc.version || '1'),
            versionNueva: staffService.normalizarVersion(doc.version || '1'),
            rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''} (${doc.codigo})`,
            rutaNueva: `${tipoProceso} / ${areaSigla} / ${proceso} (${nuevoCodigo})`,
            tipoAnterior: doc.tipoDocumento || '',
            tipoNuevo: tipoDocNombre,
            motivo: motivo,
            detalle: `Recodificación oficial del documento: ${doc.codigo} ➔ ${nuevoCodigo}. Motivo: ${motivo}`
          });

          this.cerrarModal();
          if (window.antigravityApp?.mostrarToast) {
            window.antigravityApp.mostrarToast(`✅ Documento recodificado con éxito a "${nuevoCodigo}".`, 'success');
          }
          if (typeof onRecodificado === 'function') onRecodificado(res.documento);
        } else {
          errBox.textContent = res?.error || 'Error al aplicar la recodificación.';
          errBox.style.display = 'block';
          btnSave.disabled = false;
          btnSave.innerHTML = '<span>🔄</span> Aplicar Recodificación Oficial';
        }
      } catch (err) {
        console.error('Error recodificando documento:', err);
        errBox.textContent = 'Error al recodificar: ' + (err.message || '');
        errBox.style.display = 'block';
        btnSave.disabled = false;
        btnSave.innerHTML = '<span>🔄</span> Aplicar Recodificación Oficial';
      }
    });

    document.getElementById('btn-recod-close')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('btn-recod-cancel')?.addEventListener('click', () => this.cerrarModal());
    setTimeout(() => document.getElementById('recod-motivo')?.focus(), 100);
  }

  /**
   * Modal interactivo para dar de baja o retirar un documento de Google Sheets
   */
  abrirModalEliminarDocumento(doc, { onConfirmar = null } = {}) {
    if (!doc) return;
    document.body.classList.add('modal-open');

    this.modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 520px; padding: 0; overflow: hidden;">
          
          <div class="modal-header" style="background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); color: #ffffff; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">🗑️</span>
              <h2 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; margin: 0; color: #ffffff;">
                Retirar Documento del Catálogo
              </h2>
            </div>
            <button type="button" class="modal-close-btn" id="btn-del-close" style="color: #ffffff; background: rgba(255,255,255,0.15); border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: none; font-size: 1.1rem; cursor: pointer;">
              ✕
            </button>
          </div>

          <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
            <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 12px 14px;">
              <div style="font-size: 0.90rem; font-weight: 700; color: #991b1b;">
                ${doc.codigo} - ${doc.titulo}
              </div>
              <div style="font-size: 0.78rem; color: #7f1d1d; margin-top: 4px;">
                Área: <strong>${doc.area}</strong> &bull; Versión: <strong>${staffService.formatearVersion(doc.version)}</strong>
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.80rem; font-weight: 700; color: #334155; margin-bottom: 4px;">
                Motivo del Retiro / Justificación:
              </label>
              <textarea id="del-motivo" class="form-input" placeholder="Ej: Documento obsoleto reemplazado por nueva resolución..." style="width: 100%; height: 70px; resize: none; font-size: 0.84rem; padding: 8px;"></textarea>
            </div>

            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #64748b; cursor: pointer;">
              <input type="checkbox" id="del-borrado-fisico" />
              Eliminar fila permanentemente de la hoja (Por defecto se marca como Inactivo)
            </label>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
              <button type="button" class="btn btn-secondary" id="btn-del-cancel" style="padding: 8px 18px;">
                Cancelar
              </button>
              <button type="button" class="btn btn-primary" id="btn-del-confirm" style="background: #dc2626; padding: 8px 22px; font-weight: 700;">
                Confirmar Retiro 🗑️
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.getElementById('btn-del-confirm')?.addEventListener('click', async () => {
      const motivo = document.getElementById('del-motivo')?.value.trim() || 'Retiro institucional de catálogo';
      const borradoFisico = Boolean(document.getElementById('del-borrado-fisico')?.checked);

      const btn = document.getElementById('btn-del-confirm');
      btn.disabled = true;
      btn.textContent = 'Retirando...';

      const res = await sharepointService.eliminarDocumento(doc.codigo, motivo, borradoFisico);
      if (res.exito) {
        // 1. Registrar en Auditoría Institucional
        staffService.registrarAuditoria('ELIMINACION', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension,
          detalle: `Documento retirado del catálogo: ${motivo}`
        });

        // 2. Registrar en Control de Cambios Documentales
        staffService.registrarCambioDocumental('ELIMINACION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          versionAnterior: staffService.normalizarVersion(doc.version || '1'),
          versionNueva: 'Retirado / Obsoleto',
          rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
          rutaNueva: 'Archivo Inactivo / Fuera de Catálogo',
          tipoAnterior: doc.tipoDocumento || '',
          tipoNuevo: 'N/A',
          detalle: `Documento retirado del catálogo: ${motivo}`
        });

        this.cerrarModal();
        if (typeof onConfirmar === 'function') onConfirmar(doc.codigo);
      } else {
        alert(res.error || 'Error al retirar el documento.');
        btn.disabled = false;
        btn.textContent = 'Confirmar Retiro 🗑️';
      }
    });

    document.getElementById('btn-del-close')?.addEventListener('click', () => this.cerrarModal());
    document.getElementById('btn-del-cancel')?.addEventListener('click', () => this.cerrarModal());
  }
}

export const modalManager = new ModalManager();

