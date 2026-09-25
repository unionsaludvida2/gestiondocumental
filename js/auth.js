/**
 * Módulo de Autenticación con Microsoft 365 / SharePoint Online (MSAL.js)
 * Unión para la salud y la vida S.A.S.
 *
 * Utiliza OAuth 2.0 / OpenID Connect mediante @azure/msal-browser para permitir
 * a los colaboradores autenticarse con su usuario y contraseña institucional de SharePoint.
 */

const STORAGE_KEY_AUTH_CONFIG = 'agy_sgc_msal_config';

export const defaultAuthConfig = {
  // Client ID generado en el portal de Azure Entra ID
  clientId: '', 
  tenantId: 'badbef6a-5b9d-4919-9079-6da1f2062326', // Tenant ID de Unión para la salud y la vida S.A.S.
  authorityDomain: 'login.microsoftonline.com',
  sharepointResource: 'https://unionsaludvida.sharepoint.com',
  scopes: [
    'User.Read',
    'https://unionsaludvida.sharepoint.com/AllSites.Read',
    'https://unionsaludvida.sharepoint.com/AllSites.Write'
  ]
};

export class AuthService {
  constructor() {
    this.config = this.cargarConfiguracion();
    this.msalInstance = null;
    this.usuarioActual = null;
    this.listeners = [];
    this.isInitialized = false;
  }

  cargarConfiguracion() {
    try {
      const guardada = localStorage.getItem(STORAGE_KEY_AUTH_CONFIG);
      return guardada ? { ...defaultAuthConfig, ...JSON.parse(guardada) } : { ...defaultAuthConfig };
    } catch {
      return { ...defaultAuthConfig };
    }
  }

  guardarConfiguracion(nuevaConfig) {
    this.config = { ...this.config, ...nuevaConfig };
    localStorage.setItem(STORAGE_KEY_AUTH_CONFIG, JSON.stringify(this.config));
    // Reinicializar MSAL con la nueva configuración
    this.isInitialized = false;
    return this.init();
  }

  /**
   * Inicializa la instancia de MSAL Browser
   */
  async init() {
    if (typeof window.msal === 'undefined') {
      console.warn('[MSAL] La librería msal-browser no está disponible en window.msal.');
      return false;
    }

    const redirectUri = window.location.origin + window.location.pathname;

    const msalConfig = {
      auth: {
        clientId: this.config.clientId || defaultAuthConfig.clientId,
        authority: `https://${this.config.authorityDomain}/${this.config.tenantId || 'common'}`,
        redirectUri: redirectUri,
        postLogoutRedirectUri: redirectUri
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: true
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (!containsPii && level === 0) console.error('[MSAL Error]', message);
          }
        }
      }
    };

    try {
      this.msalInstance = new window.msal.PublicClientApplication(msalConfig);
      
      // Manejar el retorno de redirección si aplica
      const redirectResponse = await this.msalInstance.handleRedirectPromise();
      if (redirectResponse) {
        this.usuarioActual = this.formatearCuenta(redirectResponse.account);
      } else {
        // Verificar cuentas en caché
        const accounts = this.msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          this.usuarioActual = this.formatearCuenta(accounts[0]);
          this.msalInstance.setActiveAccount(accounts[0]);
        }
      }

      this.isInitialized = true;
      this.notificarCambio();
      return true;
    } catch (err) {
      console.error('[MSAL] Error inicializando MSAL:', err);
      this.isInitialized = false;
      return false;
    }
  }

  formatearCuenta(account) {
    if (!account) return null;
    const name = account.name || account.username || 'Usuario SharePoint';
    const email = account.username || '';
    
    // Obtener iniciales para el avatar
    const nameParts = name.trim().split(' ');
    const initials = nameParts.length >= 2 
      ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();

    return {
      name: name,
      email: email,
      initials: initials,
      tenantId: account.tenantId,
      homeAccountId: account.homeAccountId,
      esAutenticado: true
    };
  }

  estaAutenticado() {
    return !!this.usuarioActual && !!this.usuarioActual.esAutenticado;
  }

  obtenerUsuarioActual() {
    return this.usuarioActual;
  }

  /**
   * Inicia sesión con la ventana emergente segura oficial de Microsoft
   */
  async login() {
    if (!this.config.clientId || this.config.clientId.trim() === '') {
      const err = new Error('CLIENT_ID_REQUIRED');
      err.message = 'Por favor ingresa tu Application (Client) ID de Azure en el botón de Configuración (⚙️).';
      throw err;
    }

    if (!this.msalInstance) {
      await this.init();
    }

    if (!this.msalInstance) {
      throw new Error('La librería de autenticación de Microsoft no se pudo inicializar.');
    }

    const loginRequest = {
      scopes: this.config.scopes,
      prompt: 'select_account'
    };

    try {
      const response = await this.msalInstance.loginPopup(loginRequest);
      this.usuarioActual = this.formatearCuenta(response.account);
      this.msalInstance.setActiveAccount(response.account);
      this.notificarCambio();
      return this.usuarioActual;
    } catch (err) {
      // Si el popup fue bloqueado por el navegador, intentar redirección
      if (err.name === 'BrowserAuthError' && err.errorCode === 'popup_window_error') {
        console.warn('[MSAL] Popup bloqueado, redirigiendo a login...');
        return this.msalInstance.loginRedirect(loginRequest);
      }
      console.error('[MSAL] Error al iniciar sesión:', err);
      throw err;
    }
  }

  /**
   * Cierra la sesión activa en Microsoft
   */
  async logout() {
    if (!this.msalInstance) return;

    try {
      const account = this.msalInstance.getActiveAccount() || this.msalInstance.getAllAccounts()[0];
      this.usuarioActual = null;
      this.notificarCambio();

      if (account) {
        await this.msalInstance.logoutPopup({
          account: account,
          mainWindowRedirectUri: window.location.origin + window.location.pathname
        });
      }
    } catch (err) {
      console.warn('[MSAL] Error durante logout:', err);
      this.usuarioActual = null;
      this.notificarCambio();
    }
  }

  /**
   * Obtiene el Access Token Bearer para consultar la API REST de SharePoint
   */
  async getAccessToken() {
    if (!this.msalInstance) {
      await this.init();
    }

    if (!this.msalInstance) return null;

    const account = this.msalInstance.getActiveAccount() || this.msalInstance.getAllAccounts()[0];
    if (!account) return null;

    const tokenRequest = {
      scopes: this.config.scopes,
      account: account
    };

    try {
      // 1. Intentar obtener el token de forma silenciosa desde caché/refresh token
      const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
      return response.accessToken;
    } catch (err) {
      console.warn('[MSAL] Adquisición silenciosa falló, solicitando token interactivo:', err);
      try {
        const response = await this.msalInstance.acquireTokenPopup(tokenRequest);
        return response.accessToken;
      } catch (interactiveErr) {
        console.error('[MSAL] Error al obtener token interactivo:', interactiveErr);
        return null;
      }
    }
  }

  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  notificarCambio() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.usuarioActual);
      } catch (e) {
        console.error('Error en listener de auth:', e);
      }
    });
  }
}

export const authService = new AuthService();
