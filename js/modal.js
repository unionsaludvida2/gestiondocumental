/**

 * Módulo de Gestión de Modales y Ficha de Detalle de Documentos
 * Unión para la salud y la vida S.A.S.
 */

import { sharepointService, determinarEstrategiaDescarga, esDocumentoFMT, normalizarAreaDoc } from './sharepoint-service.js?v=11.9.2';
import { staffService } from './staff-service.js?v=11.9.2';
import { filterEngine } from './filters.js?v=11.9.2';
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

   * Modal para solicitar contraseña de activación del Modo Administrativo / Edición
   */

  abrirModalPasswordEdicion(onPasswordCorrecto) {
    document.body.classList.add('modal-open');

    // Identificación y correo sugeridos para el perfil administrativo

    const sesion = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
    const docSugerido = (sesion && sesion.identificacion && sesion.identificacion !== 'OPERATIVO' && staffService.esUsuarioAdministrativo(sesion.identificacion))
      ? sesion.identificacion
      : (localStorage.getItem('agy_last_admin_doc') || '');

    const empSugerido = docSugerido ? (staffService.buscarPorDocumento(docSugerido) || staffService.configuracion?.usuariosRegistrados?.[docSugerido]) : null;
    const emailGuardado = (sesion && sesion.email && staffService.esUsuarioAdministrativo(sesion.identificacion))
      ? sesion.email
      : (localStorage.getItem('agy_last_admin_email') || empSugerido?.email || '');

    const usuarioEmailSugerido = emailGuardado ? String(emailGuardado).trim().toLowerCase().split('@')[0] : '';
    const togglePasswordBtn = (btnId, inputId) => {
      const btn = document.getElementById(btnId);
      const inp = document.getElementById(inputId);

      if (btn && inp) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();

          const esPwd = inp.type === 'password';
          inp.type = esPwd ? 'text' : 'password';
          btn.textContent = esPwd ? '🙈' : '👁️';
        });
      }
    };

    const bindEmailPrefixInput = (inputId) => {
      const inp = document.getElementById(inputId);

      if (!inp) return;

      inp.addEventListener('input', () => {
        if (inp.value.includes('@')) {
          inp.value = inp.value.split('@')[0].trim().toLowerCase();
        }
      });
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA 1: INICIO DE SESIÓN / DESBLOQUEO ADMINISTRATIVO (CORREO + CONTRASEÑA)

    // ─────────────────────────────────────────────────────────────

    const renderLogin = () => {
      this.modalContainer.innerHTML = `

        <div class="modal-backdrop">

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 450px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-doc">Seguridad</span>

                <span class="doc-code">Modo Administrativo</span>

              </div>

              <button class="btn-close" id="btn-modal-close" aria-label="Cerrar modal">&times;</button>

            </div>

<div class="modal-body" style="gap: 12px;">

              <div style="text-align: center; margin-bottom: 2px;">

                <div style="font-size: 2.2rem; margin-bottom: 4px;">🔒</div>

                <h3 style="font-family: inherit; color: var(--brand-navy); font-size: 1.15rem; font-weight:700; margin: 0 0 4px;">Acceso a Modo Administrativo</h3>

                <p style="font-size: 0.81rem; color: #64748b; margin: 0; line-height: 1.35;">

                  Ingresa tu correo institucional y contraseña para activar los permisos de edición y configuración.

                </p>

              </div>

<form id="form-pwd-edicion" autocomplete="off" style="display: flex; flex-direction: column; gap: 10px;">

                <input type="text" name="fake_user_edit" style="position: absolute; opacity: 0; pointer-events: none; width: 0; height: 0; left: -9999px;" tabindex="-1" autocomplete="username" />

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-email-edit" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Correo Institucional:</label>

                  <div style="display: flex; align-items: stretch; width: 100%;">

                    <input 

                      type="text" 

                      id="input-email-edit" 

                      name="user_email_unlock_field"

                      class="form-input" 

                      placeholder="nombre.apellido" 

                      value="${usuarioEmailSugerido || ''}"

                      autocomplete="off"

                      data-lpignore="true"

                      required

                      style="font-size: 0.92rem; padding: 9px 12px; flex: 1; min-width: 0; border-radius: 8px 0 0 8px; border-right: none;"

                    />

                    <span style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.86rem; padding: 9px 12px; border: 1.5px solid var(--border-color, #cbd5e1); border-left: 1px solid #cbd5e1; border-radius: 0 8px 8px 0; display: inline-flex; align-items: center; white-space: nowrap; user-select: none;">

                      @unionsaludvida.com

                    </span>

                  </div>

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-pwd-edit" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Contraseña de Acceso:</label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input 

                      type="password" 

                      id="input-pwd-edit" 

                      name="user_pwd_unlock_field"

                      class="form-input" 

                      placeholder="Escribe tu contraseña..." 

                      autocomplete="new-password"

                      data-lpignore="true"

                      data-form-type="other"

                      value=""

                      autofocus 

                      required 

                      style="font-size: 0.95rem; padding: 9px 40px 9px 12px; letter-spacing: 1.5px; width: 100%; border-radius: 8px;"

                    />

                    <button type="button" id="btn-toggle-pwd-login" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem; padding: 2px;" title="Mostrar / ocultar contraseña">👁️</button>

                  </div>

                </div>

<div id="pwd-error-msg" style="color: #dc2626; font-size: 0.80rem; font-weight: 600; display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 7px 10px; line-height: 1.35;">

                </div>

<div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0;">

                  <button type="button" id="link-goto-olvido" style="background: none; border: none; color: #0284c7; font-size: 0.79rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 3px 0;">

                    ¿Olvidaste tu contraseña?

                  </button>

                  <button type="button" id="link-goto-registro" style="background: none; border: none; color: #0284c7; font-size: 0.79rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 3px 0;">

                    ¿Primer ingreso? Registrarse

                  </button>

                </div>

                <button type="submit" id="btn-submit-pwd-hidden" style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;" tabindex="-1" aria-hidden="true"></button>
              </form>

            </div>

<div class="modal-footer" style="justify-content: space-between;">

              <button type="button" class="btn btn-secondary" id="btn-modal-cancel">Cancelar</button>

              <button type="button" class="btn btn-primary" id="btn-submit-pwd" style="padding: 8px 18px;">

                Desbloquear Administrativo 🔓

              </button>

            </div>

          </div>

        </div>

      `;

      togglePasswordBtn('btn-toggle-pwd-login', 'input-pwd-edit');

      bindEmailPrefixInput('input-email-edit');

      const inputEmail = document.getElementById('input-email-edit');
      const inputPwd = document.getElementById('input-pwd-edit');
      const errorMsg = document.getElementById('pwd-error-msg');
      const form = document.getElementById('form-pwd-edicion');
      const validar = async (e) => {
        if (e) e.preventDefault();

        const emailPrefix = inputEmail ? inputEmail.value.trim().toLowerCase().split('@')[0] : '';
        const emailCompleto = emailPrefix ? `${emailPrefix}@unionsaludvida.com` : '';
        const val = inputPwd ? inputPwd.value : '';

        if (!emailPrefix) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor escribe tu usuario de correo institucional.';
            errorMsg.style.display = 'block';
          }

          inputEmail?.focus();

          return;
        }

        if (!val) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor escribe tu contraseña de acceso.';
            errorMsg.style.display = 'block';
          }

          inputPwd?.focus();

          return;
        }

        const res = await staffService.validarClaveEdicion(val, emailCompleto);

        if (res.ok) {
          try {
            if (res.usuario?.identificacion) {
              localStorage.setItem('agy_last_admin_doc', res.usuario.identificacion);
            }

            localStorage.setItem('agy_last_admin_email', emailCompleto);
          } catch { }

          this.cerrarModal();

          if (typeof onPasswordCorrecto === 'function') onPasswordCorrecto(res.usuario);
        } else {
          if (errorMsg) {
            errorMsg.textContent = res.error ? `❌ ${res.error}` : '❌ Contraseña incorrecta. Intenta nuevamente.';
            errorMsg.style.display = 'block';
          }

          inputPwd?.focus();

          inputPwd?.select();
        }
      };

      // Permitir inicio de sesión directo con tecla Enter
      inputEmail?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (inputPwd && !inputPwd.value) {
            inputPwd.focus();
          } else {
            validar();
          }
        }
      });

      inputPwd?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          validar();
        }
      });

      form?.addEventListener('submit', (e) => {
        if (e) e.preventDefault();
        validar();
      });

      document.getElementById('btn-submit-pwd')?.addEventListener('click', validar);

      document.getElementById('btn-modal-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-modal-cancel')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('link-goto-registro')?.addEventListener('click', () => renderRegistro());
      document.getElementById('link-goto-olvido')?.addEventListener('click', () => renderOlvido());

      setTimeout(() => {
        if (inputEmail && !inputEmail.value) {
          inputEmail.focus();
        } else {
          inputPwd?.focus();
        }
      }, 50);
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA 2: REGISTRO DE CONTRASEÑA (SOLO PERFIL ADMINISTRATIVO)

    // ─────────────────────────────────────────────────────────────

    const renderRegistro = () => {
      this.modalContainer.innerHTML = `

        <div class="modal-backdrop">

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 460px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-doc">Seguridad</span>

                <span class="doc-code">Registro de Contraseña</span>

              </div>

              <button class="btn-close" id="btn-modal-close-reg" aria-label="Cerrar modal">&times;</button>

            </div>

<div class="modal-body" style="gap: 12px; max-height: 82vh; overflow-y: auto;">

              <div style="text-align: center; margin-bottom: 2px;">

                <div style="font-size: 2.2rem; margin-bottom: 4px;">🔐</div>

                <h3 style="font-family: inherit; color: var(--brand-navy); font-size: 1.15rem; font-weight:700; margin: 0 0 4px;">Registrar Contraseña Administrativa</h3>

                <p style="font-size: 0.80rem; color: #64748b; margin: 0; line-height: 1.35;">

                  Solo colaboradores registrados con perfil Administrativo pueden realizar el proceso de creación de contraseña.

                </p>

              </div>

<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; font-size: 0.77rem; color: #166534; display: flex; align-items: center; gap: 8px;">

                <span style="font-size: 1.1rem;">🛡️</span>

                <span><strong>Control Institucional:</strong> Se validará estrictamente que tu documento tenga permisos Administrativos antes de guardar las credenciales.</span>

              </div>

<form id="form-reg-edicion" autocomplete="off" style="display: flex; flex-direction: column; gap: 10px;">

                <div class="form-group" style="margin-bottom: 0;">

                  <label for="input-reg-email" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Correo Institucional:</label>

                  <div style="display: flex; align-items: stretch; width: 100%;">

                    <input 

                      type="text" 

                      id="input-reg-email" 

                      class="form-input" 

                      placeholder="nombre.apellido" 

                      value="${usuarioEmailSugerido || ''}"

                      autocomplete="off"

                      required

                      style="font-size: 0.90rem; padding: 9px 12px; flex: 1; min-width: 0; border-radius: 8px 0 0 8px; border-right: none;"

                    />

                    <span style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.86rem; padding: 9px 12px; border: 1.5px solid var(--border-color, #cbd5e1); border-left: 1px solid #cbd5e1; border-radius: 0 8px 8px 0; display: inline-flex; align-items: center; white-space: nowrap; user-select: none;">

                      @unionsaludvida.com

                    </span>

                  </div>

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-reg-doc" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Documento de Identidad (Cédula):</label>

                  <input 

                    type="text" 

                    id="input-reg-doc" 

                    class="form-input" 

                    placeholder="Ingresa tu cédula..." 

                    value="${docSugerido || ''}"

                    autocomplete="off"

                    required

                    style="font-size: 0.92rem; padding: 9px 12px; width: 100%; border-radius: 8px;"

                  />

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-reg-pwd" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Nueva Contraseña (mínimo 6 caracteres):</label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input 

                      type="password" 

                      id="input-reg-pwd" 

                      class="form-input" 

                      placeholder="Crea tu contraseña..." 

                      autocomplete="new-password"

                      required 

                      style="font-size: 0.95rem; padding: 9px 40px 9px 12px; width: 100%; border-radius: 8px;"

                    />

                    <button type="button" id="btn-toggle-pwd-reg1" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar contraseña">👁️</button>

                  </div>

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-reg-pwd2" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Confirmar Contraseña:</label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input 

                      type="password" 

                      id="input-reg-pwd2" 

                      class="form-input" 

                      placeholder="Repite tu contraseña..." 

                      autocomplete="new-password"

                      required 

                      style="font-size: 0.95rem; padding: 9px 40px 9px 12px; width: 100%; border-radius: 8px;"

                    />

                    <button type="button" id="btn-toggle-pwd-reg2" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar contraseña">👁️</button>

                  </div>

                </div>

<div id="reg-error-msg" style="color: #dc2626; font-size: 0.80rem; font-weight: 600; display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 7px 10px; line-height: 1.35;">

                </div>

                <button type="submit" id="btn-submit-reg-hidden" style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;" tabindex="-1" aria-hidden="true"></button>
              </form>

            </div>

<div class="modal-footer" style="justify-content: space-between;">

              <button type="button" class="btn btn-secondary" id="btn-reg-back">← Volver</button>

              <button type="button" class="btn btn-primary" id="btn-submit-reg" style="padding: 8px 18px;">

                Registrar y Activar 🚀

              </button>

            </div>

          </div>

        </div>

      `;

      togglePasswordBtn('btn-toggle-pwd-reg1', 'input-reg-pwd');

      togglePasswordBtn('btn-toggle-pwd-reg2', 'input-reg-pwd2');

      bindEmailPrefixInput('input-reg-email');

      const inputDoc = document.getElementById('input-reg-doc');
      const inputEmail = document.getElementById('input-reg-email');
      const inputPwd = document.getElementById('input-reg-pwd');
      const inputPwd2 = document.getElementById('input-reg-pwd2');
      const errorMsg = document.getElementById('reg-error-msg');
      const form = document.getElementById('form-reg-edicion');
      const registrar = async (e) => {
        if (e) e.preventDefault();

        const docVal = inputDoc ? inputDoc.value.trim() : '';
        const emailPrefix = inputEmail ? inputEmail.value.trim().toLowerCase().split('@')[0] : '';
        const emailVal = emailPrefix ? `${emailPrefix}@unionsaludvida.com` : '';
        const p1 = inputPwd ? inputPwd.value : '';
        const p2 = inputPwd2 ? inputPwd2.value : '';

        if (!emailPrefix) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor ingresa tu correo institucional.';
            errorMsg.style.display = 'block';
          }

          inputEmail?.focus();

          return;
        }

        if (!docVal) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor ingresa tu documento de identidad.';
            errorMsg.style.display = 'block';
          }

          inputDoc?.focus();

          return;
        }

        // VALIDACIÓN PREVIA ESTRICTA DE PERFIL ADMINISTRATIVO

        if (!staffService.esUsuarioAdministrativo(docVal)) {
          if (errorMsg) {
            errorMsg.textContent = `❌ Registro denegado: El documento ${docVal} no cuenta con perfil Administrativo asignado en el sistema. Solo usuarios autorizados como Administrativos pueden realizar el registro de contraseña.`;
            errorMsg.style.display = 'block';
          }

          inputDoc?.focus();

          return;
        }

        // VALIDACIÓN: PREVENIR RE-REGISTRO SI YA TIENE CONTRASEÑA

        const regCheck = staffService.configuracion?.usuariosRegistrados?.[docVal];

        if (regCheck && regCheck.passwordHash) {
          if (errorMsg) {
            errorMsg.textContent = `❌ El usuario administrativo asociado a la cédula ${docVal} ya tiene una contraseña registrada. Utiliza la opción "¿Olvidaste tu contraseña?" para restablecerla.`;
            errorMsg.style.display = 'block';
          }

          inputDoc?.focus();

          return;
        }

        // VALIDACIÓN ESTRICTA: CORREO INSTITUCIONAL DEBE COINCIDIR CON LA CÉDULA

        const empCheck = staffService.buscarPorDocumento(docVal) || {};
        const emailEsperado = staffService.normalizarCorreoInstitucional(
          empCheck.email || regCheck?.email || (docVal === '8160602' ? 'john.ramirez@unionsaludvida.com' : '')
        );

        if (emailEsperado && emailEsperado !== emailVal) {
          if (errorMsg) {
            errorMsg.textContent = `❌ Los datos no coinciden: El correo ingresado (${emailVal}) no corresponde a la cédula ${docVal} en los registros institucionales.`;
            errorMsg.style.display = 'block';
          }

          inputEmail?.focus();

          return;
        }

        if (!p1 || p1.length < 6) {
          if (errorMsg) {
            errorMsg.textContent = '❌ La contraseña debe tener al menos 6 caracteres.';
            errorMsg.style.display = 'block';
          }

          inputPwd?.focus();

          return;
        }

        if (p1 !== p2) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Las contraseñas no coinciden. Por favor verifica.';
            errorMsg.style.display = 'block';
          }

          inputPwd2?.focus();

          return;
        }

        const res = await staffService.registrarPasswordAdmin(docVal, p1, emailVal);

        if (res.ok) {
          try {
            localStorage.setItem('agy_last_admin_doc', docVal);

            if (emailVal) localStorage.setItem('agy_last_admin_email', emailVal);
          } catch { }

          this.cerrarModal();

          if (typeof onPasswordCorrecto === 'function') onPasswordCorrecto(res.usuario);
        } else {
          if (errorMsg) {
            errorMsg.textContent = res.error ? `❌ ${res.error}` : '❌ Error al registrar la contraseña.';
            errorMsg.style.display = 'block';
          }
        }
      };

      // Permitir registro directo con tecla Enter
      inputEmail?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputDoc ? inputDoc.focus() : registrar();
        }
      });
      inputDoc?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputPwd ? inputPwd.focus() : registrar();
        }
      });
      inputPwd?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputPwd2 ? inputPwd2.focus() : registrar();
        }
      });
      inputPwd2?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          registrar();
        }
      });

      form?.addEventListener('submit', (e) => {
        if (e) e.preventDefault();
        registrar();
      });

      document.getElementById('btn-submit-reg')?.addEventListener('click', registrar);

      document.getElementById('btn-reg-back')?.addEventListener('click', () => renderLogin());
      document.getElementById('btn-modal-close-reg')?.addEventListener('click', () => this.cerrarModal());
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA 3: RECUPERAR / RESTABLECER CONTRASEÑA (CORREO + CÉDULA + NUEVA CLAVE, SIN CLAVE MAESTRA)

    // ─────────────────────────────────────────────────────────────

    const renderOlvido = () => {
      this.modalContainer.innerHTML = `

        <div class="modal-backdrop">

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 460px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-doc">Seguridad</span>

                <span class="doc-code">Recuperar Contraseña</span>

              </div>

              <button class="btn-close" id="btn-modal-close-rec" aria-label="Cerrar modal">&times;</button>

            </div>

<div class="modal-body" style="gap: 12px; max-height: 82vh; overflow-y: auto;">

              <div style="text-align: center; margin-bottom: 2px;">

                <div style="font-size: 2.2rem; margin-bottom: 4px;">🔑</div>

                <h3 style="font-family: inherit; color: var(--brand-navy); font-size: 1.15rem; font-weight:700; margin: 0 0 4px;">Restablecer Contraseña Administrativa</h3>

                <p style="font-size: 0.80rem; color: #64748b; margin: 0; line-height: 1.35;">

                  Ingresa tu correo institucional y tu documento de identidad (cédula) para asignar una nueva contraseña.

                </p>

              </div>

<form id="form-rec-edicion" autocomplete="off" style="display: flex; flex-direction: column; gap: 10px;">

                <div class="form-group" style="margin-bottom: 0;">

                  <label for="input-rec-email" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Correo Institucional:</label>

                  <div style="display: flex; align-items: stretch; width: 100%;">

                    <input 

                      type="text" 

                      id="input-rec-email" 

                      class="form-input" 

                      placeholder="nombre.apellido" 

                      value="${usuarioEmailSugerido || ''}"

                      autocomplete="off"

                      required

                      style="font-size: 0.90rem; padding: 9px 12px; flex: 1; min-width: 0; border-radius: 8px 0 0 8px; border-right: none;"

                    />

                    <span style="background: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.86rem; padding: 9px 12px; border: 1.5px solid var(--border-color, #cbd5e1); border-left: 1px solid #cbd5e1; border-radius: 0 8px 8px 0; display: inline-flex; align-items: center; white-space: nowrap; user-select: none;">

                      @unionsaludvida.com

                    </span>

                  </div>

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-rec-doc" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Documento de Identidad (Cédula Administrativa):</label>

                  <input 

                    type="text" 

                    id="input-rec-doc" 

                    class="form-input" 

                    placeholder="Ingresa tu número de cédula..." 

                    value="${docSugerido || ''}"

                    autocomplete="off"

                    required

                    style="font-size: 0.92rem; padding: 9px 12px; width: 100%; border-radius: 8px;"

                  />

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-rec-pwd" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Nueva Contraseña Personal (mínimo 6 caracteres):</label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input 

                      type="password" 

                      id="input-rec-pwd" 

                      class="form-input" 

                      placeholder="Nueva contraseña..." 

                      autocomplete="new-password"

                      required 

                      style="font-size: 0.95rem; padding: 9px 40px 9px 12px; width: 100%; border-radius: 8px;"

                    />

                    <button type="button" id="btn-toggle-pwd-rec2" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar contraseña">👁️</button>

                  </div>

                </div>

<div class="form-group" style="margin-bottom: 0;">

                  <label for="input-rec-pwd2" style="font-size: 0.82rem; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">Confirmar Nueva Contraseña:</label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input 

                      type="password" 

                      id="input-rec-pwd2" 

                      class="form-input" 

                      placeholder="Repite la nueva contraseña..." 

                      autocomplete="new-password"

                      required 

                      style="font-size: 0.95rem; padding: 9px 40px 9px 12px; width: 100%; border-radius: 8px;"

                    />

                    <button type="button" id="btn-toggle-pwd-rec3" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar contraseña">👁️</button>

                  </div>

                </div>

<div id="rec-error-msg" style="color: #dc2626; font-size: 0.80rem; font-weight: 600; display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 7px 10px; line-height: 1.35;">

                </div>

                <button type="submit" id="btn-submit-rec-hidden" style="position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;" tabindex="-1" aria-hidden="true"></button>
              </form>

            </div>

<div class="modal-footer" style="justify-content: space-between;">

              <button type="button" class="btn btn-secondary" id="btn-rec-back">← Volver</button>

              <button type="button" class="btn btn-primary" id="btn-submit-rec" style="padding: 8px 18px;">

                Restablecer y Activar 🔄

              </button>

            </div>

          </div>

        </div>

      `;

      togglePasswordBtn('btn-toggle-pwd-rec2', 'input-rec-pwd');

      togglePasswordBtn('btn-toggle-pwd-rec3', 'input-rec-pwd2');

      bindEmailPrefixInput('input-rec-email');

      const inputEmail = document.getElementById('input-rec-email');
      const inputDoc = document.getElementById('input-rec-doc');
      const inputPwd = document.getElementById('input-rec-pwd');
      const inputPwd2 = document.getElementById('input-rec-pwd2');
      const errorMsg = document.getElementById('rec-error-msg');
      const form = document.getElementById('form-rec-edicion');
      const restablecer = async (e) => {
        if (e) e.preventDefault();

        const emailPrefix = inputEmail ? inputEmail.value.trim().toLowerCase().split('@')[0] : '';
        const emailCompleto = emailPrefix ? `${emailPrefix}@unionsaludvida.com` : '';
        const docVal = inputDoc ? inputDoc.value.trim() : '';
        const p1 = inputPwd ? inputPwd.value : '';
        const p2 = inputPwd2 ? inputPwd2.value : '';

        if (!emailPrefix) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor ingresa tu usuario de correo institucional.';
            errorMsg.style.display = 'block';
          }

          inputEmail?.focus();

          return;
        }

        if (!docVal) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Por favor ingresa tu documento de identidad (cédula).';
            errorMsg.style.display = 'block';
          }

          inputDoc?.focus();

          return;
        }

        if (!staffService.esUsuarioAdministrativo(docVal)) {
          if (errorMsg) {
            errorMsg.textContent = `❌ Operación denegada: El documento ${docVal} no cuenta con perfil Administrativo asignado.`;
            errorMsg.style.display = 'block';
          }

          inputDoc?.focus();

          return;
        }

        if (!p1 || p1.length < 6) {
          if (errorMsg) {
            errorMsg.textContent = '❌ La nueva contraseña debe tener al menos 6 caracteres.';
            errorMsg.style.display = 'block';
          }

          inputPwd?.focus();

          return;
        }

        if (p1 !== p2) {
          if (errorMsg) {
            errorMsg.textContent = '❌ Las contraseñas no coinciden. Por favor verifica.';
            errorMsg.style.display = 'block';
          }

          inputPwd2?.focus();

          return;
        }

        const res = await staffService.recuperarPasswordAdmin(docVal, emailCompleto, p1);

        if (res.ok) {
          try {
            localStorage.setItem('agy_last_admin_doc', docVal);

            localStorage.setItem('agy_last_admin_email', emailCompleto);
          } catch { }

          this.cerrarModal();

          if (typeof onPasswordCorrecto === 'function') onPasswordCorrecto(res.usuario);
        } else {
          if (errorMsg) {
            errorMsg.textContent = res.error ? `❌ ${res.error}` : '❌ Error al restablecer la contraseña.';
            errorMsg.style.display = 'block';
          }
        }
      };

      // Permitir restablecimiento directo con tecla Enter
      inputEmail?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputDoc ? inputDoc.focus() : restablecer();
        }
      });
      inputDoc?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputPwd ? inputPwd.focus() : restablecer();
        }
      });
      inputPwd?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputPwd2 ? inputPwd2.focus() : restablecer();
        }
      });
      inputPwd2?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          restablecer();
        }
      });

      form?.addEventListener('submit', (e) => {
        if (e) e.preventDefault();
        restablecer();
      });

      document.getElementById('btn-submit-rec')?.addEventListener('click', restablecer);

      document.getElementById('btn-rec-back')?.addEventListener('click', () => renderLogin());
      document.getElementById('btn-modal-close-rec')?.addEventListener('click', () => this.cerrarModal());
    };

    // Iniciar siempre en la vista de Login

    renderLogin();
  }

  /**

   * Modal para dar la opción al hacer clic en el candado desbloqueado:
   * Solo bloquear modo edición (manteniendo al usuario identificado) vs Salir y Cerrar Sesión
   */

  abrirModalOpcionesBloqueo({ usuario, onBloquearSoloEdicion, onCerrarSesionCompleta }) {
    if (!this.modalContainer) return;

    document.body.classList.add('modal-open');

    const nombre = usuario?.nombre || 'Usuario Administrativo';
    const doc = (usuario?.identificacion && usuario.identificacion !== 'OPERATIVO') ? usuario.identificacion : '';

    this.modalContainer.innerHTML = `

      <div class="modal-backdrop">

        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 480px;">

          <div class="modal-header">

            <div class="modal-header-badge">

              <span class="badge badge-seguridad">Seguridad</span>

              <span class="doc-code">Modo Administrativo</span>

            </div>

            <button class="btn-close" id="btn-lock-modal-close" aria-label="Cerrar modal">&times;</button>

          </div>

<div class="modal-body" style="gap: 14px; text-align: center; padding: 18px 20px;">

            <div style="font-size: 2.3rem; line-height: 1; margin-bottom: 2px;">🛡️</div>

            <div>

              <h3 style="color: var(--brand-navy); font-size: 1.16rem; font-weight: 700; margin: 0 0 6px;">

                Gestión de Edición y Sesión

              </h3>

              <p style="color: #64748b; font-size: 0.83rem; margin: 0; line-height: 1.45;">

                Estás identificado como <strong>${nombre}</strong>${doc ? ` (C.C. ${doc})` : ''}.<br/>

                Elige la acción que deseas realizar:

              </p>

            </div>

<!-- Opciones -->

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px; text-align: left;">

              <!-- Opción 1: Bloquear solo modo edición (Mantener usuario) -->

              <button type="button" id="btn-opt-bloquear-solo-edicion" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1.5px solid #bfdbfe; background: #eff6ff; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">

                <span style="font-size: 1.4rem; line-height: 1; flex-shrink: 0;">🔒</span>

                <div>

                  <strong style="color: #1e40af; font-size: 0.88rem; display: block; margin-bottom: 2px;">

                    Bloquear solo el Modo Edición (Recomendado)

                  </strong>

                  <span style="color: #475569; font-size: 0.77rem; line-height: 1.35; display: block;">

                    Protege los documentos contra modificaciones. Tu cuenta permanecerá identificada en este equipo para desbloquear nuevamente con un solo clic (sin pedir contraseña).

                  </span>

                </div>

              </button>

<!-- Opción 2: Cerrar sesión voluntariamente -->

              <button type="button" id="btn-opt-cerrar-sesion-completa" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1.5px solid #fecaca; background: #fef2f2; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;">

                <span style="font-size: 1.4rem; line-height: 1; flex-shrink: 0;">🚪</span>

                <div>

                  <strong style="color: #b91c1c; font-size: 0.88rem; display: block; margin-bottom: 2px;">

                    Salir y Cerrar Sesión

                  </strong>

                  <span style="color: #7f1d1d; font-size: 0.77rem; line-height: 1.35; display: block;">

                    Cierra voluntariamente la sesión de este equipo y regresa al modo operativo general. Se requerirá contraseña en el próximo ingreso.

                  </span>

                </div>

              </button>

            </div>

          </div>

<div class="modal-footer" style="justify-content: flex-end;">

            <button type="button" class="btn btn-secondary" id="btn-lock-modal-cancel">

              Continuar Editando

            </button>

          </div>

        </div>

      </div>

    `;

    this.modalContainer.querySelector('#btn-lock-modal-close')?.addEventListener('click', () => this.cerrarModal());
    this.modalContainer.querySelector('#btn-lock-modal-cancel')?.addEventListener('click', () => this.cerrarModal());

    this.modalContainer.querySelector('#btn-opt-bloquear-solo-edicion')?.addEventListener('click', () => {
      this.cerrarModal();

      if (typeof onBloquearSoloEdicion === 'function') onBloquearSoloEdicion();
    });

    this.modalContainer.querySelector('#btn-opt-cerrar-sesion-completa')?.addEventListener('click', () => {
      this.cerrarModal();

      if (typeof onCerrarSesionCompleta === 'function') onCerrarSesionCompleta();
    });
  }

  /**

   * Panel Lateral Deslizable (Drawer) con Ficha Técnica Completa, Historial, Registros Derivados y Acciones
   */

  abrirDrawerDocumento(doc, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc = null, onEliminarDoc = null, pestanaInicial = null) {
    if (!this.drawerContainer) {
      this.crearContenedoresModal();
    }

    this.documentoDrawerActivo = doc.id;
    const sesionActiva = staffService.obtenerSesionActiva() || staffService.obtenerUsuarioRecordado();
    const perfilActivo = (sesionActiva?.perfil === 'administrativo' && modoEdicion) ? 'administrativo' : (localStorage.getItem(STORAGE_KEY_USER_PROFILE) || 'operativo');
    const esAdmin = perfilActivo === 'administrativo' || perfilActivo === 'total' || perfilActivo === 'administrador';
    const puedeGestionarCatalogo = esAdmin && modoEdicion;
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

          ${!doc.esRegistro && (esDocumentoFMT(doc.codigo) || (Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0))

        ? `

              <button type="button" class="doc-drawer-tab-btn" data-tab="registros">

                <span>📂</span> Registros Derivados (${(doc.registrosDerivados || []).length})

              </button>

              `

        : ''

      }

          <button type="button" class="doc-drawer-tab-btn" data-tab="historial">

            <span>🕒</span> Historial & Versiones (${historialReal.length || 1})

          </button>

        </div>

<!-- Encabezado Fijo de Registros Derivados (Excluido de la barra de desplazamiento) -->

        ${!doc.esRegistro && (esDocumentoFMT(doc.codigo) || (Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0))

        ? `

            <div class="doc-drawer-registros-fixed-header" id="drawer-registros-fixed-header" style="display: none;">

              <div class="drawer-registros-header-box">

                <div style="flex: 1; min-width: 200px;">

                  <strong>Registros asociados:</strong> Estos documentos derivan de este formato institucional y conservan la codificación <strong>${doc.codigo}</strong>, pero corresponden a implementaciones operativas específicas con títulos diferenciales.

                </div>

                ${(modoEdicion && puedeGestionarCatalogo) ? `

                  <button type="button" class="btn btn-primary btn-drawer-crear-reg-fixed" id="btn-drawer-crear-registro" title="Añadir un nuevo registro derivado para este documento base">

                    <span>➕</span> Añadir Registro

                  </button>

                ` : ''}

              </div>

            </div>

            `

        : ''

      }

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

<!-- Banner Notificación de Registros Derivados en Ficha Técnica -->

            ${Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0

        ? `

                <div class="drawer-registros-alert-box" style="background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border: 1.5px solid #93c5fd; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

                  <div style="display: flex; align-items: center; gap: 10px;">

                    <span style="font-size: 1.5rem;">📂</span>

                    <div>

                      <div style="font-weight: 700; color: #1e3a8a; font-size: 0.86rem;">

                        ${doc.registrosDerivados.length} ${doc.registrosDerivados.length === 1 ? 'Registro Derivado Asociado' : 'Registros Derivados Asociados'}

                      </div>

                      <div style="font-size: 0.73rem; color: #475569; margin-top: 1px;">

                        Documentos modificados con este mismo código (${doc.codigo})

                      </div>

                    </div>

                  </div>

                  <button type="button" class="btn btn-primary" id="btn-ir-a-tab-registros" style="background: #0284c7; border: 1px solid #0369a1; font-size: 0.76rem; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 4px;">

                    <span>Ver Registros</span>

                    <span>➔</span>

                  </button>

                </div>

                `

        : ''

      }

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

            ${modoEdicion

        ? (() => {

          const tieneEnlace = Boolean(

            (doc.sharepointUrl && doc.sharepointUrl.startsWith('http') && doc.sharepointUrl !== '#' && doc.sharepointUrl !== 'N/A') ||

            (doc.downloadUrl && doc.downloadUrl.startsWith('http') && doc.downloadUrl !== '#' && doc.downloadUrl !== 'N/A')

          );

          const rutaTexto = sharepointService.obtenerRutaLegible(doc);

          return `

                    <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">

                      <div style="font-size: 0.76rem; font-weight: 700; color: #475569; display: flex; align-items: center; justify-content: space-between;">

                        <span>📁 Ubicación en Repositorio</span>

                        ${tieneEnlace && rutaTexto !== 'No se encuentra disponible'
              ? `

                            <button type="button" class="btn-drawer-folder" id="btn-drawer-open-folder" style="border:none; background:transparent; color:var(--primary); font-size:0.75rem; font-weight:700; cursor:pointer; text-decoration:underline;">

                              Abrir carpeta ↗

                            </button>

                            `
              : `

                            <span style="font-size: 0.72rem; color: #dc2626; font-weight: 700;">

                              No disponible

                            </span>

                            `
            }

                      </div>

                      <div style="font-size: 0.78rem; color: ${tieneEnlace && rutaTexto !== 'No se encuentra disponible' ? '#1e293b' : '#dc2626'}; font-family: monospace; word-break: break-all; font-weight: ${tieneEnlace && rutaTexto !== 'No se encuentra disponible' ? 'normal' : '600'};">

                        ${rutaTexto}

                      </div>

                    </div>

                    `;

        })()

        : ''

      }

${doc.descargable === false

        ? `

                <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 0.78rem; color: #92400e; line-height: 1.4;">

                  🔒 <strong>Descarga restringida:</strong> Para modificar el archivo original en SharePoint, activa el <strong>Modo Edición</strong> con tu contraseña institucional.

                </div>

                `

        : ''

      }

${estrategiaDescarga.esPdf

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

              ${historialReal && historialReal.length > 0

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

<!-- PESTAÑA: REGISTROS DERIVADOS -->

          ${!doc.esRegistro && (esDocumentoFMT(doc.codigo) || (Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0))

        ? `

              <div class="drawer-tab-content" id="drawer-tab-registros" style="display: none; flex-direction: column; gap: 10px;">

                ${(Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0) ? `

                  <div class="drawer-registros-list" style="display: flex; flex-direction: column; gap: 10px;">

                    ${(() => {

            const busqueda = filterEngine?.removerTildes ? filterEngine.removerTildes(filterEngine.estado.busqueda || '') : '';

            const palabras = busqueda ? busqueda.split(/\s+/).filter(Boolean) : [];

            let cantCoincidentes = 0;

const evaluados = doc.registrosDerivados.map((reg) => {

              if (palabras.length === 0) return { reg, coincide: true };

              const textoReg = filterEngine.removerTildes(`${reg.codigo || ''} ${reg.titulo || ''} ${reg.documento || ''} ${reg.descripcion || ''} ${reg.extension || ''}`);

              const textoDoc = filterEngine.removerTildes(`${doc.codigo || ''} ${doc.titulo || ''}`);

              const textoCombinado = `${textoDoc} ${textoReg}`;

              const coincide = palabras.every(p => textoReg.includes(p)) || palabras.every(p => textoCombinado.includes(p));

              if (coincide) cantCoincidentes++;

              return { reg, coincide };

            });

const hayFiltro = palabras.length > 0 && cantCoincidentes > 0 && cantCoincidentes < doc.registrosDerivados.length;

            const bannerHtml = hayFiltro ? `

                        <div class="drawer-filtro-banner" style="display: flex; justify-content: space-between; align-items: center; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 7px 12px; border-radius: 8px; font-size: 0.76rem; font-weight: 600; margin-bottom: 2px;">

                          <span>🔍 Mostrando ${cantCoincidentes} de ${doc.registrosDerivados.length} registros coincidentes</span>

                          <button type="button" class="btn-drawer-toggle-todos-reg" style="background: #2563eb; color: #ffffff; border: none; border-radius: 5px; padding: 3px 9px; font-size: 0.72rem; font-weight: 700; cursor: pointer;">

                            Ver todos (${doc.registrosDerivados.length})

                          </button>

                        </div>

                      ` : '';

const cardsHtml = evaluados.map(({ reg, coincide }) => {

              const esXls = (reg.extension && reg.extension.toUpperCase().includes('XLS')) || reg.formato === 'Excel';

              const rExt = esXls ? 'XLS' : 'PDF';

              const rBadgeClass = esXls ? 'badge-xls' : 'badge-pdf';

              const esCoincidente = (doc.registroCoincidente && (doc.registroCoincidente.id === reg.id || doc.registroCoincidente.titulo === reg.titulo)) || (palabras.length > 0 && coincide);

              const estaOculto = hayFiltro && !coincide;

              return `

                          <div class="drawer-registro-card ${esCoincidente ? 'registro-coincidente-active' : ''} ${estaOculto ? 'drawer-reg-filtrado-oculto' : ''}" style="display: ${estaOculto ? 'none' : 'flex'}; border: 1.5px solid ${esCoincidente ? '#f59e0b' : '#cbd5e1'}; border-radius: 8px; padding: 12px; background: ${esCoincidente ? '#fffbeb' : '#ffffff'}; flex-direction: column; gap: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">

                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">

                              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">

                                <span class="badge ${rBadgeClass}" style="font-size: 0.70rem; padding: 2px 6px;">${rExt}</span>

                                ${reg.codigo ? `<span class="badge badge-secondary" style="font-size: 0.70rem; padding: 2px 6px; font-weight: 700; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">${reg.codigo}</span>` : ''}

                                <span style="font-weight: 700; color: #1e293b; font-size: 0.85rem; line-height: 1.3;">${reg.titulo}</span>

                              </div>

                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap;">

                              <span style="font-size: 0.73rem; color: #64748b;">${staffService.formatearFechaHora(reg.modificacion)}</span>

                              <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">

                                ${modoEdicion
                  ? `

                                  ${puedeGestionarCatalogo

                    ? `

                                    <button type="button" class="btn btn-secondary btn-reg-meta" data-reg-id="${reg.id || reg.codigo}" style="width: 28px; height: 28px; padding: 0; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; background: #e0f2fe; color: #0369a1; border: 1.5px solid #bae6fd; border-radius: 6px;" title="Modificar metadatos del registro">

                                      <span>⚙️</span>

                                    </button>

                                    `

                    : ''

                  }

                                  ${reg.disponible

                    ? `

                                    ${reg.descargable === false
                      ? `<button type="button" class="btn btn-secondary" disabled style="width: 28px; height: 28px; padding: 0; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color:#92400e; background:#fef3c7; cursor:not-allowed;" title="Descarga restringida"><span>🔒</span></button>`
                      : `

                                      <button type="button" class="btn btn-secondary btn-reg-download" data-reg-id="${reg.id || reg.codigo}" style="width: 28px; height: 28px; padding: 0; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" title="Descargar registro en PDF">

                                        <span>📥</span>

                                      </button>

                                      `
                    }

                                    <button type="button" class="btn btn-primary btn-reg-edit" data-reg-id="${reg.id || reg.codigo}" style="width: 28px; height: 28px; padding: 0; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px;" title="Editar registro en SharePoint">

                                      <span>✏️</span>

                                    </button>

                                    `

                    : `<span style="width: 28px; height: 28px; font-size: 0.80rem; color: #94a3b8; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="Sin archivo individual asociado en SharePoint">📄</span>`

                  }

                                  ${puedeGestionarCatalogo

                    ? `

                                    <button type="button" class="btn btn-secondary btn-reg-delete" data-reg-id="${reg.id || reg.codigo}" style="width: 28px; height: 28px; padding: 0; font-size: 0.80rem; font-weight: 600; color: #dc2626; border: 1px solid #fecaca; background: #fff5f5; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;" title="Retirar este registro derivado">

                                      <span>🗑️</span>

                                    </button>

                                    `

                    : ''

                  }

                                  `
                  : !reg.disponible
                    ? `<button class="btn btn-disabled" disabled style="padding: 4px 8px; font-size: 0.72rem;" title="Registro no disponible en SharePoint">No Disponible</button>`
                    : reg.descargable === false
                      ? `<button type="button" class="btn btn-secondary" disabled style="padding: 4px 8px; font-size: 0.72rem; color:#92400e; background:#fef3c7; border: 1px solid #fcd34d; cursor:not-allowed;" title="Descarga restringida">🔒 Bloqueado</button>`
                      : `

                                      <button type="button" class="btn btn-primary btn-reg-download" data-reg-id="${reg.id || reg.codigo}" style="padding: 4px 10px; font-size: 0.74rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;" title="Descargar registro en PDF">

                                        <span>📥</span> Descargar

                                      </button>

                                      `
                }

                              </div>

                            </div>

                          </div>

                        `;

            }).join('');

return bannerHtml + cardsHtml;

          })()}

                  </div>

                ` : `

                  <div style="text-align: center; padding: 28px 16px; background: #ffffff; border: 1.5px dashed #cbd5e1; border-radius: 8px; color: #64748b;">

                    <span style="font-size: 2.2rem; display: block; margin-bottom: 8px;">📂</span>

                    <p style="margin: 0 0 6px 0; font-size: 0.88rem; font-weight: 700; color: #1e293b;">Aún no hay registros derivados</p>

                    <span style="font-size: 0.76rem; display: block; margin-bottom: 14px; color: #64748b; max-width: 380px; margin-left: auto; margin-right: auto;">

                       Puedes registrar variantes u hojas derivadas que salieron de este formato modificado conservando la misma codificación.

                    </span>

                    ${(modoEdicion && puedeGestionarCatalogo) ? `

                      <button type="button" class="btn btn-primary" id="btn-drawer-crear-primer-registro" style="background-color: var(--primary, #376c95); font-size: 0.78rem; font-weight: 700; padding: 8px 16px; display: inline-flex; align-items: center; gap: 6px;">

                        <span>➕</span> Añadir Primer Registro Derivado

                      </button>

                    ` : ''}

                  </div>

                `}

              </div>

              `

        : ''

      }

</div>

<!-- Pie de Acciones del Drawer -->

        <div class="doc-drawer-footer" style="display: grid; grid-template-columns: ${modoEdicion ? (puedeGestionarCatalogo ? '1fr 1fr 1fr' : '1fr 1fr') : '1fr'}; gap: 8px; padding: 12px 18px; border-top: 1px solid #e2e8f0; background: #ffffff; align-items: center;">

          ${modoEdicion

        ? `

              <button type="button" class="btn" id="btn-drawer-edit-sp" style="height: 40px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 8px; background: #1f4260; color: #ffffff; border: 1px solid #16334c; cursor: pointer; transition: all 0.2s ease; ${!doc.disponible ? 'opacity: 0.5; cursor: not-allowed;' : ''}" ${!doc.disponible ? 'disabled' : ''} title="Editar documento en SharePoint">

                <span style="font-size: 0.95rem;">✏️</span>

                <span>SharePoint</span>

              </button>

              ${puedeGestionarCatalogo
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

        const fixedRegHeader = this.drawerContainer.querySelector('#drawer-registros-fixed-header');

        if (fixedRegHeader) {
          fixedRegHeader.style.display = (tab === 'registros') ? 'block' : 'none';
        }
      });
    });

    // Activar pestaña inicial si se solicitó registros o si hubo coincidencia en un registro derivado

    const debeAbrirRegistros = (pestanaInicial === 'registros' || (!pestanaInicial && Boolean(doc.registroCoincidente))) && (esDocumentoFMT(doc.codigo) || (Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0));

    if (debeAbrirRegistros) {
      const btnReg = this.drawerContainer.querySelector('.doc-drawer-tab-btn[data-tab="registros"]');

      if (btnReg) {
        btnReg.click();
      }
    }

    // Toggle para mostrar/ocultar todos los registros derivados en el Drawer

    const btnToggleDrawerReg = this.drawerContainer.querySelector('.btn-drawer-toggle-todos-reg');

    if (btnToggleDrawerReg) {
      btnToggleDrawerReg.addEventListener('click', (e) => {
        e.stopPropagation();

        const ocultos = this.drawerContainer.querySelectorAll('.drawer-reg-filtrado-oculto');
        const estanOcultos = Array.from(ocultos).some((c) => c.style.display === 'none');

        ocultos.forEach((c) => {
          c.style.display = estanOcultos ? 'flex' : 'none';
        });

        btnToggleDrawerReg.textContent = estanOcultos ? 'Ver solo coincidentes' : `Ver todos (${(doc.registrosDerivados || []).length})`;
      });
    }

    // Descarga y edición individual de Registros Derivados en el Drawer

    this.drawerContainer.querySelectorAll('.btn-reg-download').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();

        const regId = btn.getAttribute('data-reg-id');
        const reg = (doc.registrosDerivados || []).find((r) => (r.id && r.id === regId) || (r.codigo && r.codigo === regId) || (regId === 'undefined' && r.codigo === 'FMT-GIC-015-2'));

        if (reg && onDescargar) {
          if (!reg.downloadUrl || reg.downloadUrl === doc.downloadUrl || reg.downloadUrl === '#') {
            const odDirecto = sharepointService?.buscarEnOneDriveMap?.(sharepointService._ultimoOnedriveMap, reg.codigo, reg.titulo, true);

            if (odDirecto && (odDirecto.downloadUrl || odDirecto.vinculoDescarga)) {
              reg.downloadUrl = odDirecto.downloadUrl || odDirecto.vinculoDescarga;
              reg.sharepointUrl = odDirecto.sharepointUrl || odDirecto.vinculoEdicion || reg.downloadUrl;
            }
          }

          if (!reg.downloadUrl || reg.downloadUrl === doc.downloadUrl || reg.downloadUrl === '#') {
            if (window.__agyApp) window.__agyApp.mostrarToast(`📄 El registro "${reg.titulo}" no tiene un archivo individual cargado en SharePoint.`, 'info');

            return;
          }

          btn.classList.add('btn-downloading');

          const iconSpan = btn.querySelector('span') || btn;
          const origHtml = iconSpan.innerHTML;
          iconSpan.innerHTML = '⏳';

          try {
            await onDescargar(reg);
          } finally {
            btn.classList.remove('btn-downloading');

            iconSpan.innerHTML = origHtml;
          }
        }
      });
    });

    this.drawerContainer.querySelectorAll('.btn-reg-edit').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        const regId = btn.getAttribute('data-reg-id');
        const reg = (doc.registrosDerivados || []).find((r) => (r.id && r.id === regId) || (r.codigo && r.codigo === regId) || (regId === 'undefined' && r.codigo === 'FMT-GIC-015-2'));

        if (reg && onEditarSharePoint) {
          if (!reg.sharepointUrl || reg.sharepointUrl === doc.sharepointUrl || reg.sharepointUrl === '#') {
            if (window.__agyApp) window.__agyApp.mostrarToast(`📄 El registro "${reg.titulo}" no tiene un archivo individual cargado en SharePoint para editar.`, 'info');

            return;
          }

          onEditarSharePoint(reg);
        }
      });
    });

    // Modificar Metadatos del Registro Derivado desde el Drawer

    this.drawerContainer.querySelectorAll('.btn-reg-meta').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!modoEdicion || !puedeGestionarCatalogo) {
          if (window.__agyApp) window.__agyApp.mostrarToast('🔒 No tiene permisos para modificar metadatos.', 'warning');

          return;
        }

        const regId = btn.getAttribute('data-reg-id');
        const reg = (doc.registrosDerivados || []).find((r) => (r.id && r.id === regId) || (r.codigo && r.codigo === regId) || (regId === 'undefined' && r.codigo === 'FMT-GIC-015-2'));

        if (reg) {
          this.abrirModalEditarDocumento(reg, {
            docPadre: doc,
            onGuardar: (docAct) => {
              if (window.__agyApp) {
                window.__agyApp.actualizarDocumentoEnApp(doc);
              }

              const docActualizado = this.obtenerDocumentosActuales().find((d) => (d.codigo || '').toUpperCase() === (doc.codigo || '').toUpperCase()) || doc;

              this.abrirDrawerDocumento(docActualizado, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc, onEliminarDoc, 'registros');
            }
          });
        }
      });
    });

    // Retirar Registro Derivado desde el Drawer

    this.drawerContainer.querySelectorAll('.btn-reg-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (!modoEdicion || !puedeGestionarCatalogo) {
          if (window.__agyApp) window.__agyApp.mostrarToast('🔒 No tiene permisos para retirar registros derivados.', 'warning');

          return;
        }

        const regId = btn.getAttribute('data-reg-id');
        const reg = (doc.registrosDerivados || []).find((r) => (r.id && r.id === regId) || (r.codigo && r.codigo === regId) || (regId === 'undefined' && r.codigo === 'FMT-GIC-015-2'));

        if (reg) {
          this.abrirModalEliminarDocumento(reg, {
            onConfirmar: async (motivo, borradoFisico) => {
              await sharepointService.eliminarDocumento(doc.codigo, motivo || 'Retiro de registro derivado', borradoFisico, reg.id, true, reg.titulo);

              const idxReg = (doc.registrosDerivados || []).findIndex(r => r.id === reg.id || r.codigo === reg.codigo);

              if (idxReg >= 0) doc.registrosDerivados.splice(idxReg, 1);

              if (window.__agyApp) {
                window.__agyApp.actualizarDocumentoEnApp(doc);
              }

              const docActualizado = this.obtenerDocumentosActuales().find((d) => (d.codigo || '').toUpperCase() === (doc.codigo || '').toUpperCase()) || doc;

              this.abrirDrawerDocumento(docActualizado, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc, onEliminarDoc, 'registros');
            }
          });
        }
      });
    });

    // Vincular Creación de Registro Derivado desde el Drawer

    const handlerCrearRegistro = () => {
      if (!modoEdicion || !puedeGestionarCatalogo) {
        if (window.__agyApp) window.__agyApp.mostrarToast('🔒 No tiene permisos para crear registros derivados.', 'warning');

        return;
      }

      this.abrirModalNuevoDocumento({
        esRegistro: true,
        docPadre: doc,
        onGuardar: (nuevoDoc) => {
          if (window.__agyApp) {
            window.__agyApp.agregarNuevoDocumentoEnApp(nuevoDoc);
          }

          const codPadre = (nuevoDoc.documentoPadreCodigo || nuevoDoc.codigoPadre || (nuevoDoc.codigo ? nuevoDoc.codigo.replace(/-(\d+)$/, '') : (doc.codigo || ''))).trim().toUpperCase();
          const docActualizado = this.obtenerDocumentosActuales().find((d) => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro) || doc;

          if (docActualizado) {
            this.abrirDrawerDocumento(docActualizado, modoEdicion, onEditarSharePoint, onDescargar, onActualizarDoc, onEliminarDoc, 'registros');

            setTimeout(() => {
              const tabBtn = this.drawerContainer?.querySelector('.doc-drawer-tab-btn[data-tab="registros"]');

              if (tabBtn) tabBtn.click();
            }, 60);
          }
        }
      });
    };

    this.drawerContainer.querySelector('#btn-drawer-crear-registro')?.addEventListener('click', handlerCrearRegistro);

    this.drawerContainer.querySelector('#btn-drawer-crear-primer-registro')?.addEventListener('click', handlerCrearRegistro);

    // Salto directo a la pestaña de registros desde el banner de la Ficha Técnica

    this.drawerContainer.querySelector('#btn-ir-a-tab-registros')?.addEventListener('click', () => {
      const tabBtn = this.drawerContainer?.querySelector('.doc-drawer-tab-btn[data-tab="registros"]');

      if (tabBtn) tabBtn.click();
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
        sesionActiva.perfil === 'administrativo' ||
        sesionActiva.perfil === 'total' ||
        sesionActiva.perfil === 'administrador'
      )
    );

    const esAdmin = perfilSeleccionado === 'administrativo' || perfilSeleccionado === 'total' || perfilSeleccionado === 'administrador' || perfilBaseUsuario;
    const esOperativo = perfilSeleccionado === 'operativo' && !perfilBaseUsuario;

    if (!esAdmin && (activeTab === 'perfiles' || activeTab === 'maestras')) {
      activeTab = 'preferencias';
    }

    if (esOperativo && (activeTab === 'sincronizar' || activeTab === 'edicion' || activeTab === 'perfiles' || activeTab === 'maestras')) {
      activeTab = 'preferencias';
    }

    // Conteo de documentos por perfil según las nuevas reglas

    const conteoAdminTotal = documentos.length;
    const conteoDirectivo = documentos.length; // Directivo ve todos los documentos

    const conteoAdmin = documentos.filter((d) => d.permisoAdministrativo === true || d.permisoOperativo === true).length;
    const conteoOperativo = documentos.filter((d) => d.permisoOperativo === true).length;

    this.modalContainer.innerHTML = `

      <div class="modal-backdrop" data-prevent-close="true">

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

            ${esAdmin

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

            ${!esOperativo

        ? `

                <button type="button" class="settings-tab-btn ${activeTab === 'sincronizar' ? 'active' : ''}" data-tab="sincronizar">

                  <span>🔄</span> Sincronizar

                </button>

                `

        : ''

      }

            <a href="reglas_de_negocio.html" target="_blank" class="settings-tab-btn" style="text-decoration: none; color: inherit; display: inline-flex; align-items: center; gap: 6px;" title="Abrir portal interactivo de Reglas de Negocio y SSOT">

              <span>📘</span> Reglas SSOT

            </a>

          </div>

<!-- Contenedor Desplazable de Contenido -->

          <div class="modal-body" style="padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column;">

<!-- PESTAÑA: PERFILES (ASIGNACIÓN Y GESTIÓN DE PERFILES DE EMPLEADOS) - EXCLUSIVO ACCESO TOTAL -->

            ${esAdmin

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

                              Rol a Asignar:
                            </label>

                            <div style="height: 34px; padding: 0 10px; border: 1.5px solid var(--primary, #376c95); border-radius: 6px; font-size: 0.82rem; font-weight: 700; color: #1d4ed8; background: #eff6ff; display: flex; align-items: center; gap: 6px;">

                              🛡️ Administrativo (Acceso Total)

                            </div>

                            <input type="hidden" id="select-special-profile" value="administrativo" />

                          </div>

                          <button 

                            type="button" 

                            id="btn-save-special-profile" 

                            class="btn btn-primary" 

                            style="height: 34px; margin-top: 16px; padding: 0 16px; font-size: 0.82rem; font-weight: 700; background-color: var(--primary); white-space: nowrap;"

                          >

                            Asignar Rol Administrativo 🛡️

                          </button>

                        </div>

                      </div>

                      <div id="special-profile-msg" style="font-size: 0.76rem; font-weight: 600; margin-top: 6px; display: none;"></div>

                    </div>

                  </div>

                  <!-- Tabla de Colaboradores con Rol Administrativo Asignado -->

                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0;">

                    <!-- Contador de Administrativos y Buscador -->

                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">

                      <div style="display: flex; align-items: center; gap: 6px;" id="staff-group-filter-btns">

                        <div style="background: #eff6ff; color: #1e40af; border: 1.5px solid #bfdbfe; padding: 4px 12px; border-radius: 6px; font-size: 0.80rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">

                          🛡️ Colaboradores con Rol Administrativo (<span id="count-group-administrativo">0</span>)

                        </div>

                      </div>

                      <input type="text" id="search-special-profiles" placeholder="🔍 Filtrar administrativos..." style="height: 28px; padding: 0 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.76rem; width: 200px;" />

                    </div>

                    <div style="flex: 1; max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">

                      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left;">

                        <thead style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; position: sticky; top: 0; z-index: 1;">

                          <tr>

                            <th style="padding: 6px 8px; color: #475569;">Colaborador</th>

                            <th style="padding: 6px 8px; color: #475569;">Cédula</th>

                            <th style="padding: 6px 8px; color: #475569;">Cargo en Matriz</th>

                            <th style="padding: 6px 8px; color: #475569;" id="th-col-profile-title">Rol Asignado</th>

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

<!-- PESTAÑA: PREFERENCIAS (DISEÑO DEL CATÁLOGO) -->

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

<div id="view-mode-feedback-msg" style="display:none; margin-top:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; border-radius:6px; font-size:0.78rem; font-weight:600;">

                ✅ Preferencia de vista actualizada correctamente

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

              ${esAdmin

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

                        <span>✏️</span> Modificar Rutas

                      </button>

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
    let grupoColaboradoresActual = 'administrativo';
    const renderListaColaboradoresEspeciales = (filtro = '') => {
      const tbody = document.getElementById('tbody-special-profiles');

      if (!tbody) return;

      const q = (filtro || '').toLowerCase().trim();
      const todos = staffService.obtenerColaboradoresConPerfilesEspeciales();
      const countAdmEl = document.getElementById('count-group-administrativo');

      if (countAdmEl) countAdmEl.textContent = todos.length;

      let lista = todos;

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

              ${q ? 'No hay colaboradores que coincidan con la búsqueda.' : 'No hay colaboradores con rol administrativo asignado.'}

            </td>

          </tr>

        `;

        return;
      }

      tbody.innerHTML = lista
        .map((u) => {
          const esRaiz = u.identificacion === '8160602' || u.esRaiz;

          // Comprobar si el usuario está bloqueado por tasa límite o bloqueo permanente

          const lockInfo = staffService.obtenerEstadoBloqueo(u.identificacion);
          const estaBloqueado = lockInfo.bloqueado;
          const badgeBloqueo = estaBloqueado
            ? `<span style="background:${lockInfo.tipo === 'cuenta' ? '#fee2e2' : '#fef3c7'}; color:${lockInfo.tipo === 'cuenta' ? '#991b1b' : '#92400e'}; border:1px solid ${lockInfo.tipo === 'cuenta' ? '#fca5a5' : '#fde68a'}; font-size:0.68rem; font-weight:700; padding:1px 6px; border-radius:10px; margin-left:4px; display:inline-block;" title="${lockInfo.error}">🔒 ${lockInfo.tipo === 'cuenta' ? 'Cuenta Bloqueada' : `Bloqueo Temporal (${lockInfo.minutosRestantes}m)`}</span>`
            : '';

          return `

            <tr style="border-bottom: 1px solid #f1f5f9;" data-row-doc="${u.identificacion}">

              <td style="padding: 6px 8px; font-weight: 600; color: #1e293b;">

                ${u.nombre} ${badgeBloqueo}

                ${u.email ? `<div style="font-size: 0.70rem; color: #64748b; font-weight: 400;">${u.email}</div>` : ''}

              </td>

              <td style="padding: 6px 8px; color: #475569; font-family: monospace;">${u.identificacion}</td>

              <td style="padding: 6px 8px; color: #475569;">${u.cargo}</td>

              <td style="padding: 6px 8px;">

                <span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">

                  🛡️ Administrativo

                </span>

              </td>

              <td style="padding: 6px 8px; text-align: right; white-space: nowrap;">

                <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">

                  ${estaBloqueado && esAdmin

              ? `<button type="button" class="btn-unlock-inline-user" data-doc="${u.identificacion}" style="background: #dc2626; color: #ffffff; border: none; border-radius: 4px; padding: 3px 8px; font-size: 0.70rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; box-shadow: 0 1px 3px rgba(220,38,38,0.3);" title="Desbloquear usuario por Superadministrador"><span>🔓</span> Desbloquear</button>`

              : ''

            }

                  ${esRaiz

              ? `<span style="color: #64748b; font-size: 0.72rem; font-weight: 700; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">Acceso Total</span>`

              : `<button type="button" class="btn-remove-special-profile" data-doc="${u.identificacion}" title="Remover rol administrativo (volverá al acceso operativo genérico)" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.95rem; padding: 2px 4px;">🗑️</button>`

            }

                </div>

              </td>

            </tr>

          `;
        })
        .join('');

      // Eventos del botón Desbloquear usuario (Superadministrador)

      tbody.querySelectorAll('.btn-unlock-inline-user').forEach((btnUnlock) => {
        btnUnlock.addEventListener('click', () => {
          const docNum = btnUnlock.getAttribute('data-doc');
          btnUnlock.disabled = true;
          btnUnlock.textContent = 'Desbloqueando...';
          const res = staffService.desbloquearUsuario(docNum);

          if (res.ok) {
            renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
          }
        });
      });

      // Eventos de eliminar rol administrativo

      tbody.querySelectorAll('.btn-remove-special-profile').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const docNum = btn.getAttribute('data-doc');

          if (confirm('¿Deseas remover el rol administrativo a este colaborador? Volverá al acceso operativo genérico.')) {
            await staffService.removerPerfilPersonalizado(docNum);

            if (window.antigravityApp?.mostrarToast) {
              window.antigravityApp.mostrarToast('✅ Rol administrativo removido correctamente.', 'success');
            }

            renderListaColaboradoresEspeciales(document.getElementById('search-special-profiles')?.value || '');
          }
        });
      });
    };

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

        const perfilEspecial = 'administrativo';
        const msg = document.getElementById('special-profile-msg');
        const btnSave = document.getElementById('btn-save-special-profile');
        const nombreColab = empleadoSeleccionadoParaPerfil.nombre;
        const idColab = empleadoSeleccionadoParaPerfil.identificacion;

        if (btnSave) {
          btnSave.disabled = true;
          btnSave.textContent = 'Asignando...';
        }

        await staffService.asignarPerfilPersonalizado(idColab, perfilEspecial);

        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Asignar Rol Administrativo 🛡️';
        }

        // Restablecer el buscador y la vista al estado inicial

        if (inputSearchStaff) inputSearchStaff.value = '';

        if (dropdownStaff) dropdownStaff.style.display = 'none';

        if (cardSelectedStaff) cardSelectedStaff.style.display = 'none';

        empleadoSeleccionadoParaPerfil = null;

        // Notificación de éxito

        if (window.antigravityApp?.mostrarToast) {
          window.antigravityApp.mostrarToast(`✅ Rol Administrativo asignado con éxito a ${nombreColab}.`, 'success');
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
        } catch { }

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
            const hora = staffService.formatearHoraSolo(new Date());
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

    if (btnUnlockRoutes) {
      btnUnlockRoutes.addEventListener('click', () => {
        btnUnlockRoutes.style.display = 'none';

        if (inputRouteEmp) {
          inputRouteEmp.disabled = false;
          inputRouteEmp.style.background = '#ffffff';

          inputRouteEmp.focus();
        }

        if (inputRouteRepo) {
          inputRouteRepo.disabled = false;
          inputRouteRepo.style.background = '#ffffff';
        }

        if (routesActionBar) routesActionBar.style.display = 'flex';
      });
    }

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
      } catch { }
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

    const sesionActiva = (typeof staffService.obtenerUsuarioAdministradorEnCache === 'function' && staffService.obtenerUsuarioAdministradorEnCache())

      || staffService.obtenerSesionActiva();

    const iconosPerfil = {
      directivo: '👑',
      administrativo: '💼',
      operativo: '👷',
      total: '🛡️',
      administrador: '🛡️'
    };

    const coloresPerfil = {
      directivo: '#7c3aed',
      administrativo: '#0284c7',
      operativo: '#16a34a',
      total: '#dc2626',
      administrador: '#dc2626'
    };

    const descripcionesPermisos = {
      total: 'Acceso Total: Creación, modificación, recodificación y retiro de documentos, configuración de rutas y auditoría institucional.',
      administrador: 'Acceso Total: Creación, modificación, recodificación y retiro de documentos, configuración de rutas y auditoría institucional.',
      directivo: 'Perfil Directivo: Visualización del 100% del catálogo documental, dashboard de analítica estratégica, auditoría y modo edición.',
      administrativo: 'Perfil Administrativo: Documentos operativos y administrativos, métricas en Dashboard y activación de modo edición.',
      operativo: 'Perfil Asistencial / Operativo: Consulta directa y descarga de formatos, guías y procedimientos asistenciales autorizados.'
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA 1: Sesión ya activa actualmente (Ficha de Colaborador)

    // ─────────────────────────────────────────────────────────────

    const renderSesionActiva = (sesion) => {
      const pNorm = (sesion.perfil || 'operativo').toLowerCase();
      const icono = iconosPerfil[pNorm] || '👤';
      const color = coloresPerfil[pNorm] || '#0284c7';
      const descPermiso = descripcionesPermisos[pNorm] || descripcionesPermisos.operativo;

      this.modalContainer.innerHTML = `

        <div class="modal-backdrop">

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 500px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-disponible">● Sesión Activa</span>

                <span class="doc-code">Perfil Administrativo</span>

              </div>

              <button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>

            </div>

<div class="modal-body" style="gap: 14px; max-height: 80vh; overflow-y: auto;">

              <div style="text-align: center; padding: 6px 0 2px;">

                <div style="width: 56px; height: 56px; margin: 0 auto 8px; border-radius: 50%; background: ${color}15; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">

                  ${icono}

                </div>

                <h3 style="color: var(--brand-navy); font-size: 1.22rem; font-weight: 700; margin-bottom: 4px;">

                  ${sesion.nombre || 'Colaborador Institucional'}

                </h3>

                <div style="display: inline-flex; align-items: center; gap: 5px; background: ${color}15; color: ${color}; font-weight: 700; font-size: 0.78rem; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">

                  <span>${icono}</span> Perfil ${sesion.perfil || 'Administrativo'}

                </div>

              </div>

<!-- Ficha de Datos Institucionales -->

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 7px; font-size: 0.83rem;">

                <div style="display: flex; justify-content: space-between;">

                  <span style="color: #64748b;">Identificación:</span>

                  <strong style="color: #1e293b;">C.C. ${sesion.identificacion || 'N/A'}</strong>

                </div>

                <div style="display: flex; justify-content: space-between;">

                  <span style="color: #64748b;">Cargo:</span>

                  <strong style="color: #1e293b; text-align: right;">${sesion.cargo || 'Colaborador'}</strong>

                </div>

                <div style="display: flex; justify-content: space-between;">

                  <span style="color: #64748b;">Sede:</span>

                  <strong style="color: #1e293b;">${sesion.sede || 'Principal'}</strong>

                </div>

                <div style="display: flex; justify-content: space-between;">

                  <span style="color: #64748b;">Correo M365:</span>

                  <span style="color: #0369a1; font-weight: 600;">${sesion.email || 'N/A'}</span>

                </div>

              </div>

<!-- Opción de Cambiar Contraseña Administrativa -->

              <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">

                <button type="button" id="btn-cambiar-password" class="btn btn-secondary" style="width: 100%; justify-content: center; padding: 10px 14px; font-size: 0.86rem; font-weight: 600; gap: 8px; color: #0284c7; border: 1.5px solid #bae6fd; background: #f0f9ff; transition: all 0.2s ease;">

                  🔑 Cambiar Contraseña

                </button>

              </div>

            </div>

<div class="modal-footer" style="justify-content: space-between;">

              <button type="button" class="btn btn-secondary" id="btn-auth-logout" style="color: #dc2626;">

                🚪 Cerrar Sesión

              </button>

              <button type="button" class="btn btn-primary" id="btn-auth-done" style="padding: 8px 20px;">

                Entendido ✓

              </button>

            </div>

          </div>

        </div>

      `;

      this.modalContainer.querySelector('#btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      this.modalContainer.querySelector('#btn-auth-done')?.addEventListener('click', () => this.cerrarModal());
      this.modalContainer.querySelector('#btn-cambiar-password')?.addEventListener('click', () => renderCambiarPassword(sesion));

      this.modalContainer.querySelector('#btn-auth-logout')?.addEventListener('click', () => {
        staffService.cerrarSesion();

        this.cerrarModal();

        if (onLogout) onLogout();
      });
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA: Cambiar Contraseña de Usuario Administrativo

    // ─────────────────────────────────────────────────────────────

    const renderCambiarPassword = (sesionActual) => {
      this.modalContainer.innerHTML = `

        <div class="modal-backdrop">

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 460px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-seguridad">Seguridad</span>

                <span class="doc-code">Cambiar Contraseña</span>

              </div>

              <button class="btn-close" id="btn-pwd-close" aria-label="Cerrar modal">&times;</button>

            </div>

<div class="modal-body" style="gap: 12px; max-height: 80vh; overflow-y: auto;">

              <div style="text-align: center; padding: 4px 0;">

                <div style="font-size: 2rem; margin-bottom: 4px;">🔑</div>

                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 2px;">

                  Cambiar Contraseña Administrativa

                </h3>

                <p style="color: #64748b; font-size: 0.80rem; margin: 0;">

                  Actualiza tu clave de acceso para <strong>${sesionActual.nombre || 'Usuario Administrativo'}</strong> (C.C. ${sesionActual.identificacion || ''})

                </p>

              </div>

<form id="form-cambiar-pwd" style="display: flex; flex-direction: column; gap: 10px;">

                <div>

                  <label style="display: block; font-size: 0.80rem; font-weight: 600; color: #334155; margin-bottom: 3px;">

                    Contraseña Actual:

                  </label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input type="password" id="input-pwd-actual" class="input-form" placeholder="Ingresa tu contraseña actual" required style="width: 100%; padding-right: 36px; height: 38px; font-size: 0.88rem;" />

                    <button type="button" id="btn-toggle-pwd-act" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar">👁️</button>

                  </div>

                </div>

<div>

                  <label style="display: block; font-size: 0.80rem; font-weight: 600; color: #334155; margin-bottom: 3px;">

                    Nueva Contraseña (mínimo 6 caracteres):

                  </label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input type="password" id="input-pwd-nueva" class="input-form" placeholder="Escribe tu nueva contraseña" minlength="6" required style="width: 100%; padding-right: 36px; height: 38px; font-size: 0.88rem;" />

                    <button type="button" id="btn-toggle-pwd-nue" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar">👁️</button>

                  </div>

                </div>

<div>

                  <label style="display: block; font-size: 0.80rem; font-weight: 600; color: #334155; margin-bottom: 3px;">

                    Confirmar Nueva Contraseña:

                  </label>

                  <div style="position: relative; display: flex; align-items: center;">

                    <input type="password" id="input-pwd-confirm" class="input-form" placeholder="Repite tu nueva contraseña" minlength="6" required style="width: 100%; padding-right: 36px; height: 38px; font-size: 0.88rem;" />

                    <button type="button" id="btn-toggle-pwd-conf" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1.05rem;" title="Mostrar / ocultar">👁️</button>

                  </div>

                </div>

<div id="cambiar-pwd-msg" style="display: none; font-size: 0.80rem; font-weight: 600; border-radius: 6px; padding: 7px 10px; line-height: 1.35;">

                </div>

              </form>

            </div>

<div class="modal-footer" style="justify-content: space-between;">

              <button type="button" class="btn btn-secondary" id="btn-pwd-cancel">

                ← Volver

              </button>

              <button type="button" class="btn btn-primary" id="btn-submit-cambiar-pwd" style="padding: 8px 18px;">

                Guardar Contraseña 💾

              </button>

            </div>

          </div>

        </div>

      `;

      const setupToggle = (btnId, inputId) => {
        const btn = document.getElementById(btnId);
        const inp = document.getElementById(inputId);

        if (btn && inp) {
          btn.addEventListener('click', (e) => {
            e.preventDefault();

            const esPwd = inp.type === 'password';
            inp.type = esPwd ? 'text' : 'password';
            btn.textContent = esPwd ? '🙈' : '👁️';
          });
        }
      };

      setupToggle('btn-toggle-pwd-act', 'input-pwd-actual');

      setupToggle('btn-toggle-pwd-nue', 'input-pwd-nueva');

      setupToggle('btn-toggle-pwd-conf', 'input-pwd-confirm');

      const inputAct = document.getElementById('input-pwd-actual');
      const inputNue = document.getElementById('input-pwd-nueva');
      const inputConf = document.getElementById('input-pwd-confirm');
      const msgBox = document.getElementById('cambiar-pwd-msg');
      const form = document.getElementById('form-cambiar-pwd');
      const ejecutarCambio = async (e) => {
        if (e) e.preventDefault();

        const pAct = inputAct ? inputAct.value : '';
        const pNue = inputNue ? inputNue.value : '';
        const pConf = inputConf ? inputConf.value : '';

        if (!pAct) {
          if (msgBox) {
            msgBox.textContent = '❌ Por favor ingresa tu contraseña actual.';
            msgBox.style.background = '#fef2f2';
            msgBox.style.color = '#dc2626';
            msgBox.style.border = '1px solid #fecaca';
            msgBox.style.display = 'block';
          }

          inputAct?.focus();

          return;
        }

        if (!pNue || pNue.length < 6) {
          if (msgBox) {
            msgBox.textContent = '❌ La nueva contraseña debe tener al menos 6 caracteres.';
            msgBox.style.background = '#fef2f2';
            msgBox.style.color = '#dc2626';
            msgBox.style.border = '1px solid #fecaca';
            msgBox.style.display = 'block';
          }

          inputNue?.focus();

          return;
        }

        if (pNue !== pConf) {
          if (msgBox) {
            msgBox.textContent = '❌ Las nuevas contraseñas no coinciden.';
            msgBox.style.background = '#fef2f2';
            msgBox.style.color = '#dc2626';
            msgBox.style.border = '1px solid #fecaca';
            msgBox.style.display = 'block';
          }

          inputConf?.focus();

          return;
        }

        const res = await staffService.cambiarPasswordAdmin(sesionActual.identificacion, pAct, pNue);

        if (res.ok) {
          if (msgBox) {
            msgBox.textContent = '✅ ¡Contraseña actualizada exitosamente!';
            msgBox.style.background = '#f0fdf4';
            msgBox.style.color = '#16a34a';
            msgBox.style.border = '1px solid #bbf7d0';
            msgBox.style.display = 'block';
          }

          setTimeout(() => {
            renderSesionActiva(sesionActual);
          }, 1200);
        } else {
          if (msgBox) {
            msgBox.textContent = res.error ? `❌ ${res.error}` : '❌ Error al actualizar contraseña.';
            msgBox.style.background = '#fef2f2';
            msgBox.style.color = '#dc2626';
            msgBox.style.border = '1px solid #fecaca';
            msgBox.style.display = 'block';
          }
        }
      };

      form?.addEventListener('submit', ejecutarCambio);

      document.getElementById('btn-submit-cambiar-pwd')?.addEventListener('click', ejecutarCambio);

      document.getElementById('btn-pwd-close')?.addEventListener('click', () => this.cerrarModal());
      document.getElementById('btn-pwd-cancel')?.addEventListener('click', () => renderSesionActiva(sesionActual));
      setTimeout(() => inputAct?.focus(), 50);
    };

    // ─────────────────────────────────────────────────────────────

    // VISTA 2: Selector de Colaborador (Directo, Instantáneo y Sin Contraseñas)

    // ─────────────────────────────────────────────────────────────

    const renderSelectorColaborador = () => {
      const listaBase = (Array.isArray(staffService.empleados) && staffService.empleados.length > 0)
        ? staffService.empleados
        : (Array.isArray(staffService.obtenerColaboradoresBase?.() || []) ? staffService.obtenerColaboradoresBase() : []);

      this.modalContainer.innerHTML = `

        <div class="modal-backdrop" ${esObligatorio ? 'data-prevent-close="true"' : ''}>

          <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 520px;">

            <div class="modal-header">

              <div class="modal-header-badge">

                <span class="badge badge-doc">Acceso Directo</span>

                <span class="doc-code">Selección de Colaborador</span>

              </div>

              ${!esObligatorio ? '<button class="btn-close" id="btn-auth-close" aria-label="Cerrar modal">&times;</button>' : ''}

            </div>

<div class="modal-body" style="gap: 12px; max-height: 78vh; overflow-y: auto;">

              <div>

                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 3px;">

                  Identificación de Colaborador

                </h3>

                <p style="font-size: 0.81rem; color: #64748b; margin: 0;">

                  El sistema detecta automáticamente tu usuario de SharePoint. También puedes seleccionar o buscar tu cuenta en la lista institucional.

                </p>

              </div>

<!-- Buscador Instantáneo -->

              <div style="position: relative;">

                <input 

                  type="text" 

                  id="input-filter-staff" 

                  class="form-input" 

                  placeholder="🔍 Buscar por nombre, cédula o correo corporativo..." 

                  autocomplete="off"

                  autofocus

                  style="width: 100%; font-size: 0.88rem; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1;"

                />

              </div>

<!-- Lista de Resultados Dinámicos -->

              <div id="staff-results-container" style="max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; padding: 4px; display: flex; flex-direction: column; gap: 4px;">

              </div>

<!-- Acceso alternativo por correo SharePoint directo -->

              <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 4px;">

                <div style="font-size: 0.78rem; font-weight: 600; color: #475569; margin-bottom: 6px;">

                  O ingresar con otro correo corporativo de SharePoint:

                </div>

                <div style="display: flex; gap: 6px;">

                  <input 

                    type="email" 

                    id="input-sp-direct-email" 

                    class="form-input" 

                    placeholder="usuario@unionsaludvida.com" 

                    style="flex: 1; height: 34px; padding: 0 10px; font-size: 0.82rem;"

                  />

                  <button type="button" id="btn-sp-direct-login" class="btn btn-primary" style="padding: 0 14px; height: 34px; font-size: 0.82rem;">

                    Ingresar ➔

                  </button>

                </div>

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

      const inputFilter = this.modalContainer.querySelector('#input-filter-staff');
      const resultsBox = this.modalContainer.querySelector('#staff-results-container');
      const inputDirect = this.modalContainer.querySelector('#input-sp-direct-email');
      const btnDirect = this.modalContainer.querySelector('#btn-sp-direct-login');
      const renderizarResultados = (filtro = '') => {
        const fNorm = filtro.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const coincidencias = listaBase.filter((emp) => {
          if (!fNorm) return true;

          const nom = (emp.nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
          const id = (emp.identificacion || '').toString();
          const email = (emp.email || '').toLowerCase();
          const cargo = (emp.cargo || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

          return nom.includes(fNorm) || id.includes(fNorm) || email.includes(fNorm) || cargo.includes(fNorm);
        }).slice(0, 30);

        if (coincidencias.length === 0) {
          resultsBox.innerHTML = `

            <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 0.82rem;">

              No se encontraron colaboradores que coincidan con la búsqueda.

            </div>

          `;

          return;
        }

        resultsBox.innerHTML = coincidencias.map((emp) => {
          const perfil = staffService.determinarPerfil(emp.cargo, emp.identificacion) || emp.perfil || 'operativo';
          const icono = iconosPerfil[perfil] || '👤';
          const color = coloresPerfil[perfil] || '#0284c7';

          return `

            <div class="staff-select-card" data-email="${emp.email || ''}" data-id="${emp.identificacion}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">

              <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">

                <div style="width: 34px; height: 34px; border-radius: 50%; background: ${color}15; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">

                  ${icono}

                </div>

                <div style="overflow: hidden;">

                  <div style="font-size: 0.84rem; font-weight: 700; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">

                    ${emp.nombre}

                  </div>

                  <div style="font-size: 0.73rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">

                    ${emp.cargo} &bull; C.C. ${emp.identificacion}

                  </div>

                </div>

              </div>

              <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: ${color}15; color: ${color}; text-transform: uppercase; flex-shrink: 0;">

                ${perfil}

              </span>

            </div>

          `;
        }).join('');

        resultsBox.querySelectorAll('.staff-select-card').forEach((card) => {
          card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#0284c7';
            card.style.background = '#f0f9ff';
          });

          card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#e2e8f0';
            card.style.background = '#ffffff';
          });

          card.addEventListener('click', async () => {
            const email = card.getAttribute('data-email');
            const id = card.getAttribute('data-id');
            const res = await staffService.iniciarSesionDirecta(email || id);

            if (res.ok) {
              this.cerrarModal();

              if (onLoginExitoso) onLoginExitoso(res.usuario);
            }
          });
        });
      };

      inputFilter?.addEventListener('input', (e) => {
        renderizarResultados(e.target.value);
      });

      renderizarResultados('');

      btnDirect?.addEventListener('click', async () => {
        const email = (inputDirect?.value || '').trim();

        if (!email || !email.includes('@')) {
          alert('Por favor ingresa un correo corporativo válido.');

          return;
        }

        const res = await staffService.iniciarSesionDirecta(email);

        if (res.ok) {
          this.cerrarModal();

          if (onLoginExitoso) onLoginExitoso(res.usuario);
        }
      });

      this.modalContainer.querySelector('#btn-auth-close')?.addEventListener('click', () => this.cerrarModal());
      this.modalContainer.querySelector('#btn-auth-cancel')?.addEventListener('click', () => this.cerrarModal());
      setTimeout(() => inputFilter?.focus(), 80);
    };

    // DECISIÓN INICIAL: Si hay sesión activa muestra la ficha, de lo contrario el selector directo

    if (sesionActiva) {
      renderSesionActiva(sesionActiva);
    } else {
      renderSelectorColaborador();
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

   * Obtiene la colección completa y actualizada de documentos consolidados
   * desde la aplicación activa (catálogo en vivo), sharepointService y el motor de filtros.
   */

  obtenerDocumentosActuales() {
    const mapa = new Map();

    // 1. Instancia viva de la aplicación (catálogo en memoria en tiempo real)

    const appDocs = (typeof window !== 'undefined' && window.__agyApp && Array.isArray(window.__agyApp.documentos))
      ? window.__agyApp.documentos
      : [];

    for (const d of appDocs) {
      if (d && d.codigo) {
        mapa.set((d.codigo || '').trim().toUpperCase(), d);
      }
    }

    // 2. Colección de sharepointService

    const spDocs = Array.isArray(sharepointService?.documentosEnMemoria)
      ? sharepointService.documentosEnMemoria
      : [];

    for (const d of spDocs) {
      if (d && d.codigo) {
        const cod = (d.codigo || '').trim().toUpperCase();

        if (!mapa.has(cod)) mapa.set(cod, d);
      }
    }

    // 3. Documentos originales en filterEngine

    const feDocs = (typeof filterEngine !== 'undefined' && Array.isArray(filterEngine?.documentosOriginales))
      ? filterEngine.documentosOriginales
      : [];

    for (const d of feDocs) {
      if (d && d.codigo) {
        const cod = (d.codigo || '').trim().toUpperCase();

        if (!mapa.has(cod)) mapa.set(cod, d);
      }
    }

    return Array.from(mapa.values());
  }

  /**

   * Calcula el código automático con el consecutivo más alto + 1 con 3 cifras
   * Garantiza que nunca se sugiera un código que ya exista en el catálogo institucional.
   */

  calcularSiguienteCodigo(tipoDoc, area) {
    const prefijo = this.obtenerPrefijoTipoDocumento(tipoDoc);
    const sigla = this.obtenerSiglaArea(area);
    const patron = new RegExp('^' + prefijo + '[-_]' + sigla + '[-_](\\d+)', 'i');
    let maxConsecutivo = 0;
    const docs = this.obtenerDocumentosActuales();
    const codigosExistentes = new Set();

    for (const d of docs) {
      if (!d) continue;

      if (d.codigo) {
        const cod = d.codigo.trim().toUpperCase();

        codigosExistentes.add(cod);

        const match = cod.match(patron);

        if (match && match[1]) {
          const num = parseInt(match[1], 10);

          if (!isNaN(num) && num > maxConsecutivo) {
            maxConsecutivo = num;
          }
        }
      }

      // Evaluar registros derivados asociados

      if (Array.isArray(d.registrosDerivados)) {
        for (const r of d.registrosDerivados) {
          if (r && r.codigo) {
            const codR = r.codigo.trim().toUpperCase();

            codigosExistentes.add(codR);

            const matchR = codR.match(patron);

            if (matchR && matchR[1]) {
              const numR = parseInt(matchR[1], 10);

              if (!isNaN(numR) && numR > maxConsecutivo) {
                maxConsecutivo = numR;
              }
            }
          }
        }
      }
    }

    let sigNum = maxConsecutivo + 1;
    let consecutivoStr = String(sigNum).padStart(3, '0');
    let codigoCompleto = `${prefijo}-${sigla}-${consecutivoStr}`;

    // Garantía absoluta contra duplicados:
    // Si por alguna razón el código generado ya existe en el catálogo,
    // avanzar secuencialmente hasta encontrar el siguiente consecutivo verdaderamente disponible

    while (codigosExistentes.has(codigoCompleto.toUpperCase())) {
      sigNum++;

      consecutivoStr = String(sigNum).padStart(3, '0');
      codigoCompleto = `${prefijo}-${sigla}-${consecutivoStr}`;
    }

    return {
      codigoCompleto: codigoCompleto,
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
    const docs = this.obtenerDocumentosActuales();
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
        } catch { }
      }

      if (!folderUrl || folderUrl === '#') return;

      const rutaLegible = sharepointService.obtenerRutaLegible(d);

      if (!rutaLegible || rutaLegible === 'No se encuentra disponible') return;

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

  abrirModalNuevoDocumento({ onGuardar = null, esRegistro = false, docPadre = null } = {}) {
    document.body.classList.add('modal-open');

    // Cargar listas dinámicas desde las Tablas Maestras ordenadas alfabéticamente

    const tiposDocMaestros = [...staffService.obtenerTiposDocumento()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

    const areasMaestras = [...staffService.obtenerAreasInstitucionales()]
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));

    // Lista de formatos base disponibles para registros derivados

    const formatosBase = this.obtenerDocumentosActuales()
      .filter((d) => !d.esRegistro && d.subclase !== 'Registro')
      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'es'));
    let docPadreSeleccionado = docPadre || (esRegistro && formatosBase.length > 0 ? formatosBase[0] : null);
    const tipoDocDefault = esRegistro ? 'Formato' : (tiposDocMaestros[0]?.nombre || 'Formato');
    const areaDefault = docPadreSeleccionado?.areaNombre || docPadreSeleccionado?.area || areasMaestras[0]?.nombre || 'Gestión Talento Humano';

    // Código inicial por defecto calculado

    const codInicialPadre = esRegistro && docPadreSeleccionado
      ? (sharepointService.calcularSiguienteCodigoRegistro ? sharepointService.calcularSiguienteCodigoRegistro(docPadreSeleccionado) : docPadreSeleccionado.codigo)
      : '';

    const codigoInicial = esRegistro && docPadreSeleccionado
      ? { codigoCompleto: codInicialPadre, prefijoTipo: 'FMT', siglaArea: docPadreSeleccionado.area || 'GIC' }
      : this.calcularSiguienteCodigo(tipoDocDefault, areaDefault);

    const optionsFormatosPadreHtml = formatosBase.map((d) => {
      const selected = docPadreSeleccionado && (docPadreSeleccionado.codigo === d.codigo) ? 'selected' : '';
      return `<option value="${d.codigo}" ${selected}>${d.codigo} - ${d.titulo}</option>`;
    }).join('');

    const optionsTiposHtml = tiposDocMaestros
      .map((t, idx) => `<option value="${t.nombre}" ${(esRegistro ? t.nombre === 'Formato' : idx === 0) ? 'selected' : ''}>${t.nombre} (${t.prefijo})</option>`)
      .join('');

    const tipoProcesoDefault = docPadreSeleccionado?.tipoProceso || staffService.obtenerTipoProcesoPorArea(areaDefault, docPadreSeleccionado?.proceso || '') || 'Apoyo';
    const tiposProcesoMaestros = staffService.obtenerTiposProceso();
    const optionsTiposProcesoHtml = tiposProcesoMaestros
      .map((tp) => `<option value="${tp.nombre}" ${tp.nombre.toLowerCase() === tipoProcesoDefault.toLowerCase() ? 'selected' : ''}>${tp.nombre}</option>`)
      .join('');

    const areasValidasDefault = staffService.obtenerAreasPorTipoProceso(tipoProcesoDefault);
    const optionsAreasHtml = (areasValidasDefault.length > 0 ? areasValidasDefault : areasMaestras)
      .map((a) => `<option value="${a.nombre}" ${(a.nombre || '').toLowerCase() === (areaDefault || '').toLowerCase() ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
      .join('');

    const generarOptionsProcesosND = (nombreArea, tipoProceso = '', procesoSeleccionado = '') => {
      const tp = tipoProceso || staffService.obtenerTipoProcesoPorArea(nombreArea, procesoSeleccionado);
      const procs = staffService.obtenerProcesosPorAreaYTipo(nombreArea, tp);

      if (procs.length === 0) {
        return `<option value="N/A">N/A</option>`;
      }

      return procs.map((p) => `<option value="${p}" ${p.toLowerCase() === (procesoSeleccionado || '').toLowerCase() ? 'selected' : ''}>${p}</option>`).join('');
    };

    const optionsProcesosHtml = generarOptionsProcesosND(areaDefault, tipoProcesoDefault, docPadreSeleccionado?.proceso || '');

    this.modalContainer.innerHTML = `

      <div class="modal-backdrop" data-prevent-close="true">

        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 690px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">

<!-- Encabezado con Azul Institucional Corporativo -->

          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.15);">

            <div style="display: flex; align-items: center; gap: 12px;">

              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">

                ${esRegistro ? '📂' : '📄'}

              </div>

              <div>

                <h2 id="nd-header-title" style="font-family: var(--font-heading); font-size: 1.22rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em;">

                  ${esRegistro ? 'Nuevo Registro Derivado' : 'Nuevo Documento Institucional'}

                </h2>

                <span id="nd-header-desc" style="font-size: 0.76rem; color: #e2edf5; font-weight: 500;">

                  ${esRegistro ? 'Alta de documento secundario modificado a partir de formato base' : 'Nomenclatura institucional y registro en catálogo maestro'}

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

<!-- Selector de Clasificación / Nivel Documental -->

            <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px;">

              <div style="display: flex; justify-content: space-between; align-items: center;">

                <span style="font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); display: flex; align-items: center; gap: 6px;">

                  <span>🏷️</span> Nivel / Clasificación Documental:

                </span>

                <span id="nd-subclase-badge" style="font-size: 0.70rem; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: ${esRegistro ? '#fef3c7' : '#e0f2fe'}; color: ${esRegistro ? '#92400e' : '#0369a1'};">

                  ${esRegistro ? '📂 REGISTRO DERIVADO' : '📄 DOCUMENTO BASE'}

                </span>

              </div>

              <div style="display: flex; gap: 18px; flex-wrap: wrap;">

                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #1e293b;">

                  <input type="radio" name="nd-subclase-radio" id="nd-subclase-base" value="Base" ${!esRegistro ? 'checked' : ''} />

                  <span>Documento Base (Principal)</span>

                </label>

                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; color: #1e293b;">

                  <input type="radio" name="nd-subclase-radio" id="nd-subclase-registro" value="Registro" ${esRegistro ? 'checked' : ''} />

                  <span>Registro Derivado (Hijo de Formato Base)</span>

                </label>

              </div>

            </div>

<!-- Panel de Formato Base Asociado (visible cuando es Registro) -->

            <div id="nd-seccion-padre" style="display: ${esRegistro ? 'flex' : 'none'}; flex-direction: column; gap: 6px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 10px; padding: 12px 14px;">

              <label for="nd-select-padre" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; font-weight: 700; color: #92400e;">

                <span>Formato Base Asociado <span style="color: #dc2626;">*</span></span>

                <span style="font-size: 0.70rem; font-weight: 600; color: #b45309;">Consecutivo numérico automático en subcarpeta dedicada del padre</span>

              </label>

              <select id="nd-select-padre" class="form-input" style="width: 100%; height: 38px; font-weight: 600; background: #ffffff; border: 1.5px solid #f59e0b;">

                ${optionsFormatosPadreHtml}

              </select>

            </div>

<!-- Fila 1: Tipo de Documento, Área Institucional y Código Automático / Heredado -->

            <div id="nd-fila-codificacion" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; align-items: start;">

              <div>

                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">

                  1. Tipo de Documento <span style="color: #dc2626;">*</span>

                </label>

                <select id="nd-tipo-doc" class="form-input" style="width: 100%; height: 38px; font-weight: 600;" ${esRegistro ? 'disabled' : ''}>

                  ${optionsTiposHtml}

                </select>

              </div>

              <div>

                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">

                  2. Área Institucional <span style="color: #dc2626;">*</span>

                </label>

                <select id="nd-area" class="form-input" style="width: 100%; height: 38px; font-weight: 600;" ${esRegistro ? 'disabled' : ''}>

                  ${optionsAreasHtml}

                </select>

              </div>

              <div>

                <label id="nd-label-codigo" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">

                  ${esRegistro ? '3. Código Secundario (Consecutivo) 🔒' : '3. Código Automático *'}

                </label>

                <input type="text" id="nd-codigo" class="form-input" value="${codigoInicial.codigoCompleto}" required style="width: 100%; height: 38px; font-weight: 800; font-size: 0.95rem; text-align: center; text-transform: uppercase; background: ${esRegistro ? '#f1f5f9' : '#ffffff'}; border: 1.5px solid #376c95; color: #1f4260; letter-spacing: 0.5px;" ${esRegistro ? 'readonly' : ''} title="Código del documento" />

              </div>

            </div>

<!-- Fila 2: Nombre / Título del Documento, Versión y Formato -->

            <div style="display: grid; grid-template-columns: 2.2fr 1fr 1.1fr; gap: 12px;">

              <div>

                <label id="nd-label-titulo" style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">

                  ${esRegistro ? 'Nombre / Título Diferencial del Registro *' : 'Nombre / Título del Documento *'}

                </label>

                <input type="text" id="nd-titulo" class="form-input" value="${esRegistro && docPadreSeleccionado ? docPadreSeleccionado.titulo + ' ' : ''}" placeholder="${esRegistro ? 'ej. ' + (docPadreSeleccionado?.titulo || 'Formato') + ' Anticoagulados' : 'Nombre completo del formato, guía o procedimiento...'}" required style="width: 100%; height: 38px;" />

              </div>

              <div>

                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">

                  Versión <span style="color: #dc2626;">*</span>

                </label>

                <input type="text" id="nd-version" class="form-input" value="v01" required style="width: 100%; height: 38px; font-weight: 700; text-align: center; color: var(--primary, #376c95);" />

              </div>

              <div>

                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">

                  Formato de Archivo <span style="color: #dc2626;">*</span>

                </label>

                <select id="nd-formato" class="form-input" style="width: 100%; height: 38px; font-weight: 600;">

                  <option value="AUTO" selected>Auto (Detectar)</option>

                  <option value="Excel">📊 Excel (.xlsx)</option>

                  <option value="Word">📄 Word (.docx)</option>

                  <option value="PDF">📑 PDF (.pdf)</option>

                </select>

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

<!-- Fila: Vínculo Directo Manual del Documento (SharePoint) -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
              <label for="nd-vinculo-directo" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                🔗 Vínculo Directo del Documento (SharePoint)
              </label>
              <input type="url" id="nd-vinculo-directo" class="form-input" placeholder="https://unionsaludvida.sharepoint.com/.../nombre_archivo.ext" style="width: 100%; height: 38px; font-size: 0.84rem;" />
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; line-height: 1.35;">
                ℹ️ Ingresa el vínculo completo oficial de SharePoint que incluya la ruta y el nombre del documento (no el vínculo corto). El vínculo de ubicación de la carpeta se derivará y guardará automáticamente.
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
      const esRegActual = Boolean(document.getElementById('nd-subclase-registro')?.checked);

      if (esRegActual) {
        const codPadre = selectPadre?.value;
        const padre = formatosBase.find((d) => (d.codigo || '').toUpperCase() === (codPadre || '').toUpperCase());
        const subcarpetaNombre = padre ? `${padre.codigo} ${padre.titulo}` : '';
        const tituloDoc = inputTitulo ? inputTitulo.value.trim() : '';
        const enlaceSecundario = (padre && sharepointService.generarEnlacesDocumentoSecundario)
          ? sharepointService.generarEnlacesDocumentoSecundario(padre, { codigo: cod, titulo: tituloDoc, extension: 'docx' })
          : null;

        const containerBadge = document.getElementById('nd-disp-badge-container');
        const inputDisp = document.getElementById('nd-disponibilidad');
        const prefijoBadge = document.getElementById('nd-rutas-prefijo-label');
        const listContainer = document.getElementById('nd-rutas-list');
        const wrapperSeccion = document.getElementById('nd-disponibilidad-seccion-wrapper');
        const tituloSeccion = document.getElementById('nd-disp-seccion-titulo');

        if (prefijoBadge) prefijoBadge.textContent = `Consecutivo: ${cod}`;

        if (inputDisp) inputDisp.value = 'DISPONIBLE';

        if (containerBadge) {
          containerBadge.innerHTML = `

            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 9px; background:#dbeafe; border:1px solid #93c5fd; border-radius:6px; color:#1e40af; font-size:0.75rem; font-weight:700;">

              <span style="width:7px; height:7px; border-radius:50%; background:#3b82f6; display:inline-block;"></span>

              VÍNCULO AUTOMÁTICO

            </span>

          `;
        }

        if (wrapperSeccion) {
          wrapperSeccion.style.background = '#f0fdf4';
          wrapperSeccion.style.borderColor = '#86efac';
        }

        if (tituloSeccion) {
          tituloSeccion.innerHTML = `<span>📂</span> Ubicación en Subcarpeta Dedicada del Formato Base:`;
        }

        if (listContainer) {
          listContainer.innerHTML = `

            <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 8px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

              <div style="flex: 1; min-width: 0;">

                <div style="font-size: 0.72rem; color: #166534; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">

                  Subcarpeta Oficial del Formato (Generación Automática de Vínculos)

                </div>

                <div style="font-size: 0.78rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; word-break: break-all;">

                  <span>📁</span> <strong>${subcarpetaNombre || 'Subcarpeta del Formato'}</strong>

                </div>

                <div style="font-size: 0.70rem; color: #64748b; margin-top: 3px;">

                  Los documentos secundarios se alojan dentro de esta subcarpeta con código consecutivo (${cod}).

                </div>

              </div>

              ${enlaceSecundario?.sharepointUrl ? `

                <button type="button" class="btn btn-secondary btn-open-sp-folder" data-folder-url="${encodeURIComponent(enlaceSecundario.sharepointUrl)}" style="padding: 5px 12px; font-size: 0.74rem; font-weight: 700; display: flex; align-items: center; gap: 5px; white-space: nowrap; background: #22c55e; color: #ffffff; border: 1px solid #16a34a;">

                  <span>↗</span> Ver Enlace

                </button>

              ` : ''}

            </div>

          `;

          listContainer.querySelectorAll('.btn-open-sp-folder').forEach((btn) => {
            btn.addEventListener('click', (e) => {
              e.preventDefault();

              const rawAttr = btn.getAttribute('data-folder-url') || '';
              const url = rawAttr ? decodeURIComponent(rawAttr) : '';

              if (url && url !== 'undefined' && url !== 'null' && url !== '#') {
                window.open(url, '_blank');
              }
            });
          });
        }

        return;
      }

      const docExistente = this.obtenerDocumentosActuales().find((d) => (d.codigo || '').toUpperCase() === cod && !d.esRegistro);
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
    const obtenerTipoProcesoPorArea = (nombreArea, proceso = '') => {
      return staffService.obtenerTipoProcesoPorArea(nombreArea, proceso);
    };

    // Selectores y elementos reactivos para cambio de Subclase / Registro

    const radioBase = document.getElementById('nd-subclase-base');
    const radioRegistro = document.getElementById('nd-subclase-registro');
    const seccionPadre = document.getElementById('nd-seccion-padre');
    const selectPadre = document.getElementById('nd-select-padre');
    const badgeSubclase = document.getElementById('nd-subclase-badge');
    const labelCodigo = document.getElementById('nd-label-codigo');
    const labelTitulo = document.getElementById('nd-label-titulo');
    const inputTitulo = document.getElementById('nd-titulo');
    const headerTitle = document.getElementById('nd-header-title');
    const headerDesc = document.getElementById('nd-header-desc');
    const actualizarDesdePadre = () => {
      const codPadre = selectPadre?.value;
      const padre = formatosBase.find((d) => (d.codigo || '').toUpperCase() === (codPadre || '').toUpperCase());

      if (padre) {
        inputCodigo.value = (sharepointService.calcularSiguienteCodigoRegistro ? sharepointService.calcularSiguienteCodigoRegistro(padre) : padre.codigo);

        if (inputArea) {
          const areaMatch = areasMaestras.find((a) =>
            (a.nombre || '').toLowerCase() === (padre.areaNombre || padre.area || '').toLowerCase() ||
            (a.sigla || '').toUpperCase() === (padre.area || '').toUpperCase()
          );

          if (areaMatch) inputArea.value = areaMatch.nombre;
        }

        if (selectTipoProceso) {
          selectTipoProceso.value = padre.tipoProceso || staffService.obtenerTipoProcesoPorArea(inputArea.value, padre.proceso) || 'Apoyo';
        }

        if (selectProceso) {
          selectProceso.innerHTML = generarOptionsProcesosND(inputArea.value, selectTipoProceso ? selectTipoProceso.value : '', padre.proceso || '');
        }

        if (inputTitulo) {
          inputTitulo.placeholder = `ej. ${padre.titulo} Anticoagulados`;

          if (!inputTitulo.value.trim() || formatosBase.some(f => inputTitulo.value.trim() === f.titulo || inputTitulo.value.trim() === `${f.titulo} `)) {
            inputTitulo.value = `${padre.titulo} `;
          }
        }

        actualizarDisponibilidadYRutas();
      }
    };

    const cambiarSubclase = (esReg) => {
      if (esReg) {
        if (seccionPadre) seccionPadre.style.display = 'flex';

        if (headerTitle) headerTitle.textContent = 'Nuevo Registro Derivado';

        if (headerDesc) headerDesc.textContent = 'Alta de documento secundario modificado a partir de formato base';

        if (badgeSubclase) {
          badgeSubclase.style.background = '#fef3c7';
          badgeSubclase.style.color = '#92400e';
          badgeSubclase.textContent = '📂 REGISTRO DERIVADO';
        }

        if (labelCodigo) labelCodigo.innerHTML = '3. Código Secundario (Consecutivo) 🔒';

        inputCodigo.readOnly = true;
        inputCodigo.style.background = '#f1f5f9';
        inputTipoDoc.value = 'Formato';
        inputTipoDoc.disabled = true;
        inputArea.disabled = true;

        if (labelTitulo) labelTitulo.innerHTML = 'Nombre / Título Diferencial del Registro <span style="color: #dc2626;">*</span>';

        actualizarDesdePadre();
      } else {
        if (seccionPadre) seccionPadre.style.display = 'none';

        if (headerTitle) headerTitle.textContent = 'Nuevo Documento Institucional';

        if (headerDesc) headerDesc.textContent = 'Nomenclatura institucional y registro en catálogo maestro';

        if (badgeSubclase) {
          badgeSubclase.style.background = '#e0f2fe';
          badgeSubclase.style.color = '#0369a1';
          badgeSubclase.textContent = '📄 DOCUMENTO BASE';
        }

        if (labelCodigo) labelCodigo.innerHTML = '3. Código Automático <span style="color: #dc2626;">*</span>';

        inputCodigo.readOnly = false;
        inputCodigo.style.background = '#ffffff';
        inputTipoDoc.disabled = false;
        inputArea.disabled = false;

        if (labelTitulo) labelTitulo.innerHTML = 'Nombre / Título del Documento <span style="color: #dc2626;">*</span>';

        if (inputTitulo) {
          inputTitulo.placeholder = 'Nombre completo del formato, guía o procedimiento...';

          if (formatosBase.some(f => inputTitulo.value.trim() === f.titulo || inputTitulo.value.trim() === `${f.titulo} `)) {
            inputTitulo.value = '';
          }
        }

        recalcularCodigoEnTiempoReal();
      }
    };

    radioBase?.addEventListener('change', () => cambiarSubclase(false));
    radioRegistro?.addEventListener('change', () => cambiarSubclase(true));

    selectPadre?.addEventListener('change', actualizarDesdePadre);

    // Función reactiva para actualizar el código, áreas y procesos según Tipo de Proceso

    const recalcularSegunTipoProceso = () => {
      const esReg = Boolean(document.getElementById('nd-subclase-registro')?.checked);

      if (esReg) return;

      const tp = selectTipoProceso?.value || 'Apoyo';
      const areasValidas = staffService.obtenerAreasPorTipoProceso(tp);
      const areaActual = inputArea.value;
      const areaEsValida = areasValidas.some((a) =>
        (a.nombre || '').toLowerCase() === (areaActual || '').toLowerCase() ||
        (a.sigla || '').toUpperCase() === (areaActual || '').toUpperCase()
      );

      if (!areaEsValida && areasValidas.length > 0) {
        inputArea.value = areasValidas[0].nombre;
      }

      if (areasValidas.length > 0) {
        inputArea.innerHTML = areasValidas
          .map((a) => `<option value="${a.nombre}" ${(a.nombre || '').toLowerCase() === (inputArea.value || '').toLowerCase() ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
          .join('');
      }

      const t = inputTipoDoc.value;
      const a = inputArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputCodigo.value = res.codigoCompleto;

      if (selectProceso) {
        selectProceso.innerHTML = generarOptionsProcesosND(a, tp);
      }

      actualizarDisponibilidadYRutas();
    };

    // Función reactiva para actualizar el código y opciones según el Área Institucional

    const recalcularSegunArea = () => {
      const esReg = Boolean(document.getElementById('nd-subclase-registro')?.checked);

      if (esReg) {
        actualizarDesdePadre();

        return;
      }

      const t = inputTipoDoc.value;
      const a = inputArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputCodigo.value = res.codigoCompleto;
      const tpActual = selectTipoProceso ? selectTipoProceso.value : '';
      const procsParaTpActual = staffService.obtenerProcesosPorAreaYTipo(a, tpActual);
      let tpFinal = tpActual;

      if (!tpActual || procsParaTpActual.length === 0) {
        tpFinal = staffService.obtenerTipoProcesoPorArea(a);

        if (selectTipoProceso) {
          selectTipoProceso.value = tpFinal;
        }
      }

      if (selectProceso) {
        selectProceso.innerHTML = generarOptionsProcesosND(a, tpFinal);
      }

      actualizarDisponibilidadYRutas();
    };

    const recalcularCodigoEnTiempoReal = () => {
      recalcularSegunArea();
    };

    selectTipoProceso?.addEventListener('change', recalcularSegunTipoProceso);

    selectProceso?.addEventListener('change', () => {
      actualizarDisponibilidadYRutas();
    });

    inputTipoDoc?.addEventListener('change', recalcularCodigoEnTiempoReal);

    inputArea?.addEventListener('input', recalcularCodigoEnTiempoReal);

    inputArea?.addEventListener('change', recalcularCodigoEnTiempoReal);

    inputCodigo?.addEventListener('input', () => {
      actualizarDisponibilidadYRutas();
    });

    // Inicializar estado reactivo

    if (esRegistro) {
      cambiarSubclase(true);
    } else {
      recalcularCodigoEnTiempoReal();
    }

    const form = document.getElementById('form-nuevo-documento');
    const errBox = document.getElementById('nuevo-doc-error');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      errBox.style.display = 'none';
      const esRegistroDoc = Boolean(document.getElementById('nd-subclase-registro')?.checked);
      let codigo = document.getElementById('nd-codigo').value.trim().toUpperCase();
      const titulo = document.getElementById('nd-titulo').value.trim();
      const version = staffService.formatearVersion(document.getElementById('nd-version').value.trim() || 'v01');
      const tipoProceso = document.getElementById('nd-tipo-proceso').value;
      const areaNombre = document.getElementById('nd-area').value.trim() || 'Gestión Integral Calidad';
      const proceso = document.getElementById('nd-proceso').value.trim() || 'Gestión Integral de Calidad';
      const tipoDocNombre = esRegistroDoc ? 'Registro Derivado' : document.getElementById('nd-tipo-doc').value;
      const estado = document.getElementById('nd-estado').value || 'Activo';
      const dispVal = document.getElementById('nd-disponibilidad').value;
      const vigenciaInput = document.getElementById('nd-vigencia')?.value.trim();
      const tiempoRetencion = document.getElementById('nd-tiempo-retencion')?.value.trim() || '5 Años';
      const lugar = document.getElementById('nd-lugar')?.value.trim() || 'Oficina central y sede';
      const tipoCambio = esRegistroDoc
        ? `Registro derivado de ${codigo}`
        : (document.getElementById('nd-tipo-cambio')?.value.trim() || 'Creación del documento');

      const permOp = document.getElementById('nd-perm-op').checked;
      const permAdm = document.getElementById('nd-perm-adm').checked;
      const permDir = document.getElementById('nd-perm-dir').checked;
      const descargable = document.getElementById('nd-descargable').checked;
      const codPadre = esRegistroDoc
        ? (document.getElementById('nd-select-padre')?.value || codigo.replace(/-(\d+)$/, ''))
        : null;

      const docPadreRef = esRegistroDoc
        ? this.obtenerDocumentosActuales().find((d) => (d.codigo || '').toUpperCase() === (codPadre || '').toUpperCase() && !d.esRegistro)
        : null;

      // Validación preventiva anti-colisión: Verificar si el código ya existe

      if (!esRegistroDoc) {
        const existeDoc = this.obtenerDocumentosActuales().some(d => (d.codigo || '').trim().toUpperCase() === codigo && !d.esRegistro);

        if (existeDoc) {
          errBox.textContent = `❌ Ya existe un documento registrado con el código ${codigo}. Por favor utiliza un consecutivo diferente.`;
          errBox.style.display = 'block';
          const btnSave = document.getElementById('btn-nuevo-doc-save');

          if (btnSave) {
            btnSave.disabled = false;
            btnSave.innerHTML = `<span>💾</span> Guardar y Publicar Documento`;
          }

          return;
        }
      }

      // Garantizar que un registro derivado siempre tenga el sufijo consecutivo -N

      if (esRegistroDoc && docPadreRef) {
        if (!/-(\d+)$/.test(codigo) || codigo === (docPadreRef.codigo || '').toUpperCase()) {
          codigo = sharepointService.calcularSiguienteCodigoRegistro
            ? sharepointService.calcularSiguienteCodigoRegistro(docPadreRef)
            : `${docPadreRef.codigo}-1`;
        }
      }

      const partesCod = codigo.split('-');
      const prefijoSigla = partesCod[0] || (esRegistroDoc ? 'FMT' : 'DA');
      const areaSigla = partesCod[1] || 'GMD';
      const consecutivoNum = partesCod.length >= 4 ? partesCod.slice(2).join('-') : (partesCod[2] || '001');
      const hoy = new Date();
      const fechaAprobacion = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
      const vigencia = vigenciaInput ? this.convertirInputDateAFecha(vigenciaInput) : fechaAprobacion;
      const fechaVencimiento = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear() + 5}`;
      const btnSave = document.getElementById('btn-nuevo-doc-save');
      btnSave.disabled = true;
      btnSave.innerHTML = `<span>⏳</span> ${esRegistroDoc ? 'Guardando registro...' : 'Guardando documento...'}`;
      const formatoSelectVal = document.getElementById('nd-formato')?.value || 'AUTO';
      const titLimpio = titulo.toLowerCase().trim();
      let formatoEfectivo = 'Word';
      let extensionEfectiva = 'DOC';

      if (formatoSelectVal === 'Excel' || titLimpio.endsWith('.xlsx') || titLimpio.endsWith('.xls')) {
        formatoEfectivo = 'Excel';

        extensionEfectiva = 'XLS';
      } else if (formatoSelectVal === 'PDF' || titLimpio.endsWith('.pdf')) {
        formatoEfectivo = 'PDF';

        extensionEfectiva = 'PDF';
      } else if (formatoSelectVal === 'Word' || titLimpio.endsWith('.docx') || titLimpio.endsWith('.doc')) {
        formatoEfectivo = 'Word';

        extensionEfectiva = 'DOC';
      } else {
        // Auto-detección inteligente

        if (docPadreRef) {
          formatoEfectivo = docPadreRef.formato || 'PDF';

          extensionEfectiva = docPadreRef.extension || (formatoEfectivo === 'Excel' ? 'XLS' : (formatoEfectivo === 'Word' ? 'DOC' : 'PDF'));
        } else if (titLimpio.includes('excel') || titLimpio.includes('calculo') || titLimpio.includes('.xlsx') || titLimpio.includes('.xls')) {
          formatoEfectivo = 'Excel';

          extensionEfectiva = 'XLS';
        } else {
          formatoEfectivo = (prefijoSigla === 'FMT' ? 'Word' : 'PDF');

          extensionEfectiva = (formatoEfectivo === 'Word' ? 'DOC' : 'PDF');
        }
      }

      let enlacesSecundarios = null;

      if (esRegistroDoc && docPadreRef && sharepointService.generarEnlacesDocumentoSecundario) {
        enlacesSecundarios = sharepointService.generarEnlacesDocumentoSecundario(docPadreRef, {
          codigo: codigo,
          titulo: titulo,
          extension: extensionEfectiva
        });
      }

      // Normalización canónica de Área para compatibilidad total con filtros activos

      const areaCanon = normalizarAreaDoc(areaNombre || areaSigla, codigo);
      const vinculoDirectoInput = (document.getElementById('nd-vinculo-directo')?.value || '').trim();
      let vinculoUbicacionDerivado = '';
      if (vinculoDirectoInput) {
        vinculoUbicacionDerivado = sharepointService.derivarVinculoUbicacion
          ? sharepointService.derivarVinculoUbicacion(vinculoDirectoInput)
          : (vinculoDirectoInput.split('?')[0].replace(/\/+$/, '').substring(0, vinculoDirectoInput.split('?')[0].replace(/\/+$/, '').lastIndexOf('/')));
      }
      const tieneEnlaceManual = Boolean(vinculoDirectoInput);
      const vinculoEdicionDerivado = vinculoDirectoInput 
        ? (sharepointService.derivarVinculoEdicion ? sharepointService.derivarVinculoEdicion(vinculoDirectoInput) : `${vinculoDirectoInput}?web=1`) 
        : '';

      const nuevoDocumentoObj = {
        codigo: codigo,
        titulo: titulo,
        documento: titulo,
        subclase: esRegistroDoc ? 'Registro' : 'Base',
        esRegistro: esRegistroDoc,
        documentoPadreCodigo: esRegistroDoc ? (docPadreRef?.codigo || codPadre) : undefined,
        formato: formatoEfectivo,
        extension: extensionEfectiva,
        version: version,
        consecutivo: consecutivoNum,
        tipoDocumento: esRegistroDoc ? 'Registro' : prefijoSigla,
        tipoDocumentoNombre: tipoDocNombre,
        area: areaCanon,
        areaNombre: areaCanon,
        areaSigla: areaSigla,
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
        disponible: esRegistroDoc ? true : (dispVal === 'DISPONIBLE'),
        disponibilidad: esRegistroDoc ? 'DISPONIBLE' : dispVal,
        sharepointUrl: enlacesSecundarios?.sharepointUrl || '',
        downloadUrl: vinculoDirectoInput || enlacesSecundarios?.downloadUrl || '',
        vinculoDirecto: vinculoDirectoInput || enlacesSecundarios?.downloadUrl || '',
        vinculoUbicacion: vinculoUbicacionDerivado || enlacesSecundarios?.sharepointUrl || '',
        vinculoEdicion: vinculoEdicionDerivado,
        descargas: 0,
        estado: estado,
        estadoDocumento: estado,
        modificacion: new Date().toISOString()
      };

      try {
        const res = await sharepointService.crearDocumento(nuevoDocumentoObj);

        if (res && res.exito) {
          // 1. Registrar en Auditoría Institucional

          staffService.registrarAuditoria('CREACION', {
            documentoCodigo: codigo,
            documentoTitulo: titulo,
            documentoExtension: nuevoDocumentoObj.extension || extensionHeredada,
            esRegistro: esRegistroDoc,
            documentoPadreCodigo: esRegistroDoc ? (docPadreRef?.codigo || codPadre) : '',
            detalle: esRegistroDoc
              ? `Nuevo registro derivado creado (${codigo} - ${titulo})`
              : `Nuevo documento incorporado al catálogo (${codigo} - ${titulo})`
          });

          // 2. Registrar evento en control de cambios

          staffService.registrarCambioDocumental('CREACION', {
            codigo: codigo,
            titulo: titulo,
            esRegistro: esRegistroDoc,
            documentoPadreCodigo: esRegistroDoc ? (docPadreRef?.codigo || codPadre) : '',
            versionAnterior: 'N/A',
            versionNueva: version,
            rutaAnterior: 'N/A',
            rutaNueva: `${tipoProceso} / ${areaNombre || areaSigla} / ${proceso}`,
            tipoAnterior: 'N/A',
            tipoNuevo: tipoDocNombre || (esRegistroDoc ? 'Registro Derivado' : prefijoSigla),
            detalle: esRegistroDoc
              ? `Registro derivado incorporado al catálogo (${codigo} - ${titulo})`
              : `Nuevo documento incorporado al catálogo (${codigo})`
          });

          this.cerrarModal();

          if (typeof onGuardar === 'function') onGuardar(res.documento);
        } else {
          errBox.textContent = res?.error || 'Error al guardar el documento.';
          errBox.style.display = 'block';
          btnSave.disabled = false;
          btnSave.innerHTML = esRegistroDoc ? 'Guardar Registro' : 'Guardar Documento';
        }
      } catch (err) {
        console.error('Error al guardar documento:', err);

        errBox.textContent = 'Error al guardar el documento: ' + (err.message || '');
        errBox.style.display = 'block';
        btnSave.disabled = false;
        btnSave.innerHTML = esRegistroDoc ? 'Guardar Registro' : 'Guardar Documento';
      }
    });

    const confirmarCierreNuevoDoc = () => {
      const tit = (document.getElementById('nd-titulo')?.value || '').trim();

      if (tit.length > 0) {
        if (!confirm('Tiene información ingresada en el formulario de creación. ¿Está seguro de que desea salir sin guardar? Todo lo que ha escrito se perderá.')) {
          return;
        }
      }

      this.cerrarModal();
    };

    document.getElementById('btn-nuevo-doc-close')?.addEventListener('click', confirmarCierreNuevoDoc);

    document.getElementById('btn-nuevo-doc-cancel')?.addEventListener('click', confirmarCierreNuevoDoc);

    const inputTit = document.getElementById('nd-titulo');
    const selectFmt = document.getElementById('nd-formato');

    if (inputTit && selectFmt) {
      inputTit.addEventListener('input', () => {
        const val = inputTit.value.toLowerCase().trim();

        if (val.endsWith('.xlsx') || val.endsWith('.xls') || val.includes('excel')) {
          selectFmt.value = 'Excel';
        } else if (val.endsWith('.pdf')) {
          selectFmt.value = 'PDF';
        } else if (val.endsWith('.docx') || val.endsWith('.doc')) {
          selectFmt.value = 'Word';
        }
      });
    }

    setTimeout(() => document.getElementById('nd-titulo')?.focus(), 100);
  }

  /**

   * Modal interactivo para modificar metadatos de un documento en Google Sheets
   */

  abrirModalEditarDocumento(doc, { onGuardar = null, docPadre = null } = {}) {
    if (!doc) return;

    const esRegistro = Boolean(doc.esRegistro || doc.subclase === 'Registro' || docPadre || (doc.id && String(doc.id).includes('_REG_')) || /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/.test(doc.codigo || ''));

    if (esRegistro && !docPadre) {
      const codPadre = doc.documentoPadreCodigo || (doc.codigo || '').replace(/-(\d+)$/, '');

      docPadre = this.obtenerDocumentosActuales().find(
        (d) => (d.codigo || '').toUpperCase() === (codPadre || '').toUpperCase() && !d.esRegistro
      );
    }

    this.modalContainer.innerHTML = `

      <div class="modal-backdrop" data-prevent-close="true">

        <div class="modal-card animate-scale-up" role="dialog" aria-modal="true" style="max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; padding: 0;">

<!-- Encabezado con Azul Institucional -->

          <div class="modal-header" style="background: linear-gradient(135deg, #1f4260 0%, #265072 50%, #376c95 100%); color: #ffffff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center;">

            <div style="display: flex; align-items: center; gap: 12px;">

              <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">

                ${esRegistro ? '⚙️' : '✏️'}

              </div>

              <div>

                <h2 style="font-family: var(--font-heading); font-size: 1.22rem; font-weight: 700; margin: 0; color: #ffffff; letter-spacing: -0.01em;">

                  ${esRegistro ? `Modificar Metadatos del Registro Derivado (${doc.codigo})` : `Modificar Metadatos (${doc.codigo})`}

                </h2>

                <span style="font-size: 0.76rem; color: #e2edf5; font-weight: 500;">

                  ${esRegistro ? 'Actualización de metadatos del registro secundario asociado al formato' : 'Actualización de metadatos y parámetros del catálogo'}

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

<!-- Panel Informativo: Nomenclatura y Codificación Oficial -->

            ${esRegistro ? `

              <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">

                  <div style="display: flex; align-items: center; gap: 8px;">

                    <span style="font-size: 1.2rem;">📑</span>

                    <div>

                      <span style="font-size: 0.70rem; font-weight: 700; color: #1e40af; text-transform: uppercase; letter-spacing: 0.5px;">Registro Secundario Derivado del Formato</span>

                      <div style="font-size: 1.12rem; font-weight: 800; color: #1e3a8a; letter-spacing: 0.5px;">${doc.codigo}</div>

                    </div>

                  </div>

                  <span class="badge" style="background: #dbeafe; color: #1d4ed8; font-weight: 700; font-size: 0.76rem; padding: 4px 10px; border-radius: 6px; border: 1px solid #bfdbfe;">

                    Subclase: Registro Derivado

                  </span>

                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 0.76rem; color: #1e293b; background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #bfdbfe;">

                  <div><strong>Tipo Doc:</strong> <span style="color:#0369a1; font-weight:600;">Registro</span></div>

                  <div><strong>Área:</strong> <span style="color:#0369a1; font-weight:600;">${doc.areaNombre || doc.area || (docPadre && (docPadre.areaNombre || docPadre.area)) || 'Gestión Integral Calidad'}</span></div>

                  <div><strong>Proceso:</strong> <span style="color:#0369a1; font-weight:600;">${doc.proceso || (docPadre && docPadre.proceso) || 'Gestión Integral de Calidad'}</span></div>

                </div>

                <div style="font-size: 0.71rem; color: #1e40af; line-height: 1.35;">

                  ℹ️ <em>Registro Derivado:</em> Este documento es una derivación o caso específico del formato base <strong>${docPadre ? docPadre.codigo : (doc.documentoPadreCodigo || (doc.codigo || '').replace(/-(\d+)$/, ''))}</strong>. Se ubica en su subcarpeta dedicada y posee su propio consecutivo (${doc.codigo}), título diferencial, versión y archivo individual.

                </div>

              </div>

            ` : `

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

            `}

<!-- Fila 1: Nombre / Título y Versión -->

            <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 12px;">

              <div>

                <label style="display: block; font-size: 0.78rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">

                  ${esRegistro ? 'Nombre / Título Diferencial del Registro' : 'Nombre / Título del Documento'} <span style="color: #dc2626;">*</span>

                </label>

                <input type="text" id="ed-titulo" class="form-input" value="${(doc.titulo || doc.nombre || '').replace(/"/g, '&quot;')}" required style="width: 100%; height: 38px; font-weight: 600;" placeholder="${esRegistro ? 'Ej: Criterios de Formación para Anticoagulados' : 'Título del documento'}" />

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

<!-- Fila: Vínculo Directo Manual del Documento (SharePoint) -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 14px;">
              <label for="ed-vinculo-directo" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy, #1f4260); margin-bottom: 4px;">
                🔗 Vínculo Directo del Documento (SharePoint)
              </label>
              <input type="url" id="ed-vinculo-directo" class="form-input" value="${(doc.vinculoDirecto || doc.downloadUrl || '').replace(/"/g, '&quot;')}" placeholder="https://unionsaludvida.sharepoint.com/.../nombre_archivo.ext" style="width: 100%; height: 38px; font-size: 0.84rem;" />
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px; line-height: 1.35;">
                ℹ️ Ingresa el vínculo completo de SharePoint con la ruta y el nombre del documento (no el vínculo corto). El vínculo de ubicación de la carpeta se derivará y guardará automáticamente.
              </div>
            </div>

            <!-- Fila 5: Datos Técnicos Extraídos de OneDrive (Solo Lectura) -->

            <div style="background: #f1f5f9; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: #475569;">

              <div style="display: flex; align-items: center; gap: 8px;">

                <strong>Extensión:</strong> <span class="badge" style="background: #e2e8f0; color: #0f172a; padding: 2px 8px; border-radius: 4px; font-weight: 700;">${doc.extension || 'DOC'}</span>

                &nbsp;|&nbsp;

                <strong>Modificación:</strong> ${staffService.formatearFechaHora(doc.modificacion)}

              </div>

              <div style="display: flex; align-items: center; gap: 6px;">

                ${doc.disponible ? `

                  <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 8px; font-size: 0.70rem; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;">🟢 En Línea (OneDrive)</span>

                ` : `

                  <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 8px; font-size: 0.70rem; font-weight: 800; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;">🔴 Sin archivo subido</span>

                `}

              </div>

            </div>

<!-- Botones Footer -->

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; padding-top: 14px; border-top: 1px solid #e2e8f0;">

              <button type="button" class="btn btn-secondary" id="btn-edit-doc-cancel" style="padding: 9px 20px; font-weight: 600;">

                Cancelar

              </button>

              <button type="submit" class="btn btn-primary" id="btn-edit-doc-save" style="background: linear-gradient(135deg, #265072 0%, #376c95 100%); padding: 9px 24px; font-weight: 700; display: flex; align-items: center; gap: 7px; box-shadow: 0 2px 6px rgba(31,66,96,0.25);">

                ${esRegistro ? 'Actualizar Registro Derivado' : 'Actualizar Metadatos'}

              </button>

            </div>

</form>

</div>

      </div>

    `;

    const form = document.getElementById('form-edit-documento');
    const errBox = document.getElementById('edit-doc-error');

    // Botón para abrir el submodal de recodificación oficial (solo para documentos base)

    if (!esRegistro) {
      document.getElementById('btn-open-recodificar')?.addEventListener('click', () => {
        this.abrirModalRecodificarDocumento(doc, {
          onRecodificado: (docRecod) => {
            if (typeof onGuardar === 'function') onGuardar(docRecod);
          }
        });
      });
    }

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
        tipoProceso: (docPadre && docPadre.tipoProceso) || doc.tipoProceso || 'Misional',
        area: (docPadre && docPadre.area) || doc.area || 'GIC',
        areaNombre: (docPadre && (docPadre.areaNombre || docPadre.area)) || doc.areaNombre || doc.area || 'Gestión Integral Calidad',
        proceso: (docPadre && (docPadre.proceso || docPadre.carpeta)) || doc.proceso || doc.carpeta || 'Gestión Integral de Calidad',
        carpeta: (docPadre && (docPadre.carpeta || docPadre.proceso)) || doc.carpeta || doc.proceso || 'Gestión Integral de Calidad',
        tipoDocumento: esRegistro ? 'Registro' : (doc.tipoDocumento || 'Formato'),
        subclase: esRegistro ? 'Registro' : (doc.subclase || 'Base'),
        esRegistro: esRegistro,
        tituloAnterior: doc.titulo,
        codigoPadre: docPadre?.codigo || doc.documentoPadreCodigo || (esRegistro ? (doc.codigo || '').replace(/-(\d+)$/, '') : doc.codigo),
        documentoPadreCodigo: esRegistro ? (docPadre?.codigo || doc.documentoPadreCodigo || (doc.codigo || '').replace(/-(\d+)$/, '')) : undefined,
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
        descargable: descargable,
        vinculoDirecto: vinculoDirectoInput || doc.vinculoDirecto || '',
        vinculoUbicacion: vinculoUbicacionDerivado,
        vinculoEdicion: vinculoEdicionDerivado,
        downloadUrl: vinculoDirectoInput || doc.downloadUrl || '',
        sharepointUrl: vinculoEdicionDerivado || vinculoUbicacionDerivado || doc.sharepointUrl || '',
        disponible: Boolean(vinculoDirectoInput || doc.downloadUrl || doc.sharepointUrl),
        descargas: doc.descargas !== undefined ? doc.descargas : 0
      };

      try {
        const res = await sharepointService.modificarDocumento(doc.codigo, nuevosDatos, doc.id, esRegistro, doc.titulo);

        if (res && res.exito) {
          // Registrar en control de cambios

          const esCambioVersion = version && doc.version && !staffService.sonVersionesIguales(version, doc.version);
          let tipoEventoHist = esCambioVersion ? 'CAMBIO_VERSION' : (huboCambioVinculo ? 'CAMBIO_VINCULO' : 'CAMBIO_METADATOS');
          let motivoHist = huboCambioVinculo ? `Vínculo directo actualizado manualmente a: ${vinculoDirectoInput}` : (tipoCambio || 'Actualización de metadatos');

          staffService.registrarCambioDocumental(
            tipoEventoHist,
            {
              codigo: doc.codigo,
              titulo: titulo,
              esRegistro: esRegistro,
              documentoPadreCodigo: doc.documentoPadreCodigo || '',
              versionAnterior: staffService.normalizarVersion(doc.version || '1'),
              versionNueva: staffService.normalizarVersion(version || '1'),
              rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
              rutaNueva: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
              tipoAnterior: esRegistro ? 'Registro' : (doc.tipoDocumento || ''),
              tipoNuevo: esRegistro ? 'Registro' : (doc.tipoDocumento || ''),
              motivo: tipoCambio || 'Actualización de metadatos',
              detalle: esRegistro
                ? `Modificación de metadatos de registro derivado (${doc.codigo} - ${titulo}): ${tipoCambio || 'Datos actualizados en catálogo'}`
                : `Modificación de metadatos: ${tipoCambio || 'Datos actualizados en catálogo'}`
            }
          );

          // Registrar en auditoría institucional

          staffService.registrarAuditoria('METADATOS', {
            documentoCodigo: doc.codigo,
            documentoTitulo: titulo,
            documentoExtension: doc.extension,
            esRegistro: esRegistro,
            documentoPadreCodigo: doc.documentoPadreCodigo || '',
            detalle: esRegistro
              ? `Modificación de metadatos de registro derivado (${doc.codigo} - ${titulo}): ${tipoCambio || 'Datos actualizados en catálogo'}`
              : `Modificación de metadatos (${doc.codigo}): ${tipoCambio || 'Datos actualizados en catálogo'}`
          });

          this.cerrarModal();

          if (typeof onGuardar === 'function') onGuardar(res.documento);
        } else {
          errBox.textContent = res?.error || 'Error al actualizar metadatos.';
          errBox.style.display = 'block';
          btnSave.disabled = false;
          btnSave.innerHTML = esRegistro ? 'Actualizar Registro Derivado' : 'Actualizar Metadatos';
        }
      } catch (err) {
        console.error('Error al actualizar documento:', err);

        errBox.textContent = 'Error al actualizar metadatos: ' + (err.message || '');
        errBox.style.display = 'block';
        btnSave.disabled = false;
        btnSave.innerHTML = esRegistro ? 'Actualizar Registro Derivado' : 'Actualizar Metadatos';
      }
    });

    const confirmarCierreEdit = () => {
      const tit = (document.getElementById('ed-titulo')?.value || '').trim();

      if (tit.length > 0 && tit !== (doc.titulo || '').trim()) {
        if (!confirm('Tiene cambios sin guardar en los metadatos. ¿Desea salir sin guardar?')) {
          return;
        }
      }

      this.cerrarModal();
    };

    document.getElementById('btn-edit-doc-close')?.addEventListener('click', confirmarCierreEdit);

    document.getElementById('btn-edit-doc-cancel')?.addEventListener('click', confirmarCierreEdit);

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

    const tipoProcesoActualDoc = doc.tipoProceso || staffService.obtenerTipoProcesoPorArea(areaActualNombre, doc.proceso || doc.carpeta || '') || 'Apoyo';
    const areasValidasRecodDefault = staffService.obtenerAreasPorTipoProceso(tipoProcesoActualDoc);
    const optionsAreasHtml = (areasValidasRecodDefault.length > 0 ? areasValidasRecodDefault : areasMaestras)
      .map((a) => `<option value="${a.nombre}" ${(a.nombre || '').toLowerCase() === (areaActualNombre || '').toLowerCase() ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
      .join('');

    const optionsTiposProcesoHtml = tiposProcesoMaestros
      .map((tp) => `<option value="${tp.nombre}" ${tp.nombre.toLowerCase() === tipoProcesoActualDoc.toLowerCase() ? 'selected' : ''}>${tp.nombre}</option>`)
      .join('');

    const generarOptionsProcesosRecod = (nombreArea, tipoProceso = '', procesoSeleccionado = '') => {
      const tp = tipoProceso || staffService.obtenerTipoProcesoPorArea(nombreArea, procesoSeleccionado);
      const procs = staffService.obtenerProcesosPorAreaYTipo(nombreArea, tp);

      if (procs.length === 0) return `<option value="N/A">N/A</option>`;

      return procs.map((p) => `<option value="${p}" ${p.toLowerCase() === (procesoSeleccionado || '').toLowerCase() ? 'selected' : ''}>${p}</option>`).join('');
    };

    const optionsProcesosHtml = generarOptionsProcesosRecod(areaActualNombre, tipoProcesoActualDoc, doc.proceso || doc.carpeta || '');

    this.modalContainer.innerHTML = `

      <div class="modal-backdrop" data-prevent-close="true">

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
    const selectTipoProceso = document.getElementById('recod-tipo-proceso');
    const selectProceso = document.getElementById('recod-proceso');
    const inputNuevoCodigo = document.getElementById('recod-nuevo-codigo');
    const recalcularSegunTipoProcesoRecod = () => {
      const tp = selectTipoProceso?.value || 'Apoyo';
      const areasValidas = staffService.obtenerAreasPorTipoProceso(tp);
      const areaActual = selectArea.value;
      const areaEsValida = areasValidas.some((a) =>
        (a.nombre || '').toLowerCase() === (areaActual || '').toLowerCase() ||
        (a.sigla || '').toUpperCase() === (areaActual || '').toUpperCase()
      );

      if (!areaEsValida && areasValidas.length > 0) {
        selectArea.value = areasValidas[0].nombre;
      }

      if (areasValidas.length > 0) {
        selectArea.innerHTML = areasValidas
          .map((a) => `<option value="${a.nombre}" ${(a.nombre || '').toLowerCase() === (selectArea.value || '').toLowerCase() ? 'selected' : ''}>${a.nombre} (${a.sigla})</option>`)
          .join('');
      }

      const t = selectTipoDoc.value;
      const a = selectArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputNuevoCodigo.value = res.codigoCompleto;

      if (selectProceso) {
        selectProceso.innerHTML = generarOptionsProcesosRecod(a, tp);
      }
    };

    const recalcularNuevoCodigo = () => {
      const t = selectTipoDoc.value;
      const a = selectArea.value;
      const res = this.calcularSiguienteCodigo(t, a);
      inputNuevoCodigo.value = res.codigoCompleto;
      const tpActual = selectTipoProceso ? selectTipoProceso.value : '';
      const procsParaTpActual = staffService.obtenerProcesosPorAreaYTipo(a, tpActual);
      let tpFinal = tpActual;

      if (!tpActual || procsParaTpActual.length === 0) {
        tpFinal = staffService.obtenerTipoProcesoPorArea(a);

        if (selectTipoProceso) {
          selectTipoProceso.value = tpFinal;
        }
      }

      if (selectProceso) {
        selectProceso.innerHTML = generarOptionsProcesosRecod(a, tpFinal);
      }
    };

    selectTipoDoc?.addEventListener('change', recalcularNuevoCodigo);

    selectArea?.addEventListener('change', recalcularNuevoCodigo);

    selectTipoProceso?.addEventListener('change', recalcularSegunTipoProcesoRecod);

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

          // Registrar en auditoría institucional

          staffService.registrarAuditoria('METADATOS', {
            documentoCodigo: nuevoCodigo,
            documentoTitulo: doc.titulo || doc.nombre || 'Documento',
            documentoExtension: doc.extension,
            detalle: `Recodificación oficial: ${doc.codigo} ➔ ${nuevoCodigo}. Motivo: ${motivo}`
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

      <div class="modal-backdrop" data-prevent-close="true">

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

<div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 0.78rem; color: #475569; display: flex; align-items: center; gap: 8px;">

              <span style="font-size: 1.1rem;">🔒</span>

              <span><strong>Política de Calidad Institucional:</strong> El borrado físico de registros en Google Sheets está estrictamente prohibido. El documento pasará a estado <em>Eliminado / Obsoleto</em> preservando la trazabilidad histórica y auditoría.</span>

            </div>

            <input type="hidden" id="del-borrado-fisico" value="false" />

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
      const borradoFisico = false; // Regla 9.3: Estrictamente prohibido el borrado físico. Soft-delete obligatorio.

      const btn = document.getElementById('btn-del-confirm');
      btn.disabled = true;
      btn.textContent = 'Retirando...';
      const res = await sharepointService.eliminarDocumento(doc.codigo, motivo, borradoFisico);

      if (res.exito) {
        const codDocUpper = (doc.codigo || '').trim().toUpperCase();
        const mDerivDoc = codDocUpper.match(/^([A-Z]{2,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/);
        const mBaseDoc = codDocUpper.match(/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}$/);
        let esRegDoc = false;
        let codPadreDoc = '';

        if (mDerivDoc) {
          esRegDoc = true;
          codPadreDoc = mDerivDoc[1];
        } else if (mBaseDoc) {
          esRegDoc = false;
          codPadreDoc = '';
        } else if (doc.documentoPadreCodigo && doc.documentoPadreCodigo.split('-').length >= 3) {
          esRegDoc = true;
          codPadreDoc = doc.documentoPadreCodigo;
        }

        // 1. Registrar en Auditoría Institucional

        staffService.registrarAuditoria('ELIMINACION', {
          documentoCodigo: doc.codigo,
          documentoTitulo: doc.titulo,
          documentoExtension: doc.extension,
          esRegistro: esRegDoc,
          documentoPadreCodigo: codPadreDoc,
          detalle: esRegDoc
            ? `Registro derivado retirado del catálogo: ${motivo}`
            : `Documento retirado del catálogo: ${motivo}`
        });

        // 2. Registrar en Control de Cambios Documentales

        staffService.registrarCambioDocumental('ELIMINACION', {
          codigo: doc.codigo,
          titulo: doc.titulo,
          esRegistro: esRegDoc,
          documentoPadreCodigo: codPadreDoc,
          versionAnterior: staffService.normalizarVersion(doc.version || '1'),
          versionNueva: 'Retirado / Obsoleto',
          rutaAnterior: `${doc.tipoProceso || ''} / ${doc.area || ''} / ${doc.proceso || ''}`,
          rutaNueva: 'Archivo Inactivo / Fuera de Catálogo',
          tipoAnterior: doc.tipoDocumento || '',
          tipoNuevo: 'N/A',
          detalle: esRegDoc
            ? `Registro derivado retirado del catálogo: ${motivo}`
            : `Documento retirado del catálogo: ${motivo}`
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
