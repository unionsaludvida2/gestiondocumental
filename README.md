# 🏥 Sistema de Gestión Documental - Unión para la salud y la vida S.A.S.

Aplicación web moderna, rápida y adaptable para la administración y consulta de documentos institucionales, conectada con **listas y bibliotecas de carpetas de SharePoint Online (Microsoft 365)** con control de acceso por perfiles y publicación gratuita.

---

## 🌟 Características Principales

- **Fidelidad Visual Total:** Replicación de la interfaz institucional con tarjetas estilizadas por formato (`DOC`, `PDF`, `XLS`), estados `• DISPONIBLE / • NO DISPONIBLE`, botón de acción directa `EDITAR ↗` a SharePoint y contador global de documentos (`Total documentos: 224`).
- **Filtros Multifacéticos en Tiempo Real:**
  - **Buscador global:** Filtrado instantáneo por código, título, proceso, área, carpeta y palabras clave.
  - **Botones rápidos de formato:** Acceso en un clic a documentos de Excel, PDF y Word.
  - **Filtros por Procesos:** Apoyo, Calidad, Estratégico, Misionales.
  - **Filtros por Áreas:** Gestión Administrativa, Gestión Financiera, Gestión Integral Calidad, Gestión Médica, Gestión Talento Humano, Gestión TI.
  - **Filtros por Tipo de Documento:** Actas, Documentos Anexos, Formatos, Instructivos, Manuales, Políticas, Procedimientos, Registros.
  - **Barra de filtros activos:** Con chips eliminables individualmente y botón *Restablecer filtros*.
- **Control de Acceso por Perfiles (RBAC) de SharePoint:**
  - La aplicación consulta la lista de usuarios en SharePoint (`Perfiles_Usuarios`) para determinar a qué procesos y áreas tiene acceso cada persona.
  - Selector de perfiles integrado en la cabecera para simular y auditar los permisos de cada cargo institucional (Administrador, Médicos, Auditores de Calidad, Personal Asistencial, TI).
- **Conector y Enlace con Microsoft 365 / SharePoint Online:**
  - Enlaces directos determinísticos a SharePoint Online y OneDrive corporativo con Single Sign-On (SSO) federado de navegador.
  - Autenticación institucional interna (`staff-service.js`) validada contra matriz de 1,305 colaboradores activos (`EMPLEADOS_ACTIVOS.csv`) y contraseñas SHA-256 en `usuarios.conf`.

---

## 🚀 Cómo Ejecutar Localmente

### Opción 1: Servidor Local con Sincronización en Vivo (Recomendada)
Ejecuta el archivo `iniciar_servidor.bat` o abre PowerShell en la carpeta del proyecto y ejecuta:
```bash
python server.py 8080
```
Luego abre tu navegador en: [http://localhost:8080](http://localhost:8080)

### Opción 2: Abrir directamente
Puedes abrir directamente el archivo `index.html` en Google Chrome, Microsoft Edge o cualquier navegador moderno.

---

## 🌐 Publicación Oficial en GitHub Pages

Esta aplicación es una **Single Page Application (SPA)** estática cliente, compatible al 100% con **GitHub Pages**, con certificado SSL (HTTPS) gratuito, alta velocidad y persistencia en la nube mediante Google Sheets / Google Drive / OneDrive:

### Pasos para Despliegue en GitHub Pages:
1. Sube este proyecto a tu repositorio en GitHub.
2. En GitHub, ingresa a la pestaña **Settings** (Configuración) del repositorio.
3. En el menú lateral izquierdo, haz clic en **Pages**.
4. En la sección **Build and deployment > Source**, selecciona **Deploy from a branch**.
5. En **Branch**, selecciona la rama principal (`main` o `master`) y la carpeta `/ (root)`.
6. Haz clic en **Save** (Guardar).
7. GitHub generará automáticamente el enlace oficial en: `https://<tu-usuario-o-organizacion>.github.io/<repositorio>/`.

---

---

## 🏛️ Arquitectura de Persistencia y Resiliencia de Datos

El sistema opera bajo una arquitectura **Serverless Híbrida de Alta Disponibilidad**, optimizada para ejecutarse en **GitHub Pages** manteniendo la gobernanza centralizada de datos en el ecosistema **Google Workspace (Google Sheets + Google Apps Script + Google Drive)** y **Microsoft 365 (SharePoint / OneDrive)**:

```
┌─────────────────────────────────────────────────────────────┐
│                 CLIENTE (GitHub Pages SPA)                  │
│                                                             │
│  [ UI Rápida < 50ms ]  ◄──►  [ IndexedDB: CacheService ]   │
│            ▲                              ▲                 │
│            │ (Stale-While-Revalidate)     │ (Telemetría)    │
│            ▼                              ▼                 │
│  [ SharePoint Service ]        [ Staff / Auth Service ]     │
└────────────┬──────────────────────────────┬─────────────────┘
             │                              │
             ▼ (Lectura Documental)         ▼ (Fusión Atómica y Append-Only)
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Google Sheets (Maestro)   │  │ Google Apps Script Web App  │
│  - Catálogo de Documentos   │  │  - LockService Anti-Colisión│
│  - OneDrive / SharePoint    │  │  - Merge Seguro usuarios.conf│
│  - EMPLEADOS_ACTIVOS.csv    │  │  - Auditoría Inmutable .dat │
└─────────────────────────────┘  └──────────────┬──────────────┘
                                                │
                                                ▼ (Snapshot Diario)
                                 ┌─────────────────────────────┐
                                 │   GitHub Actions Workflow   │
                                 │  - Cron diario a las 04 UTC │
                                 │  - Respaldo versionado .json│
                                 └─────────────────────────────┘
```

### Garantías Técnicas Implementadas:

1. **🛡️ Blindaje Contra Sobrescritura Accidental (Modelo Append-Only)**:
   - En [`google_drive_backup_script.gs`](google_drive_backup_script.gs), la función `actualizarConfiguracionConMerge` utiliza `LockService` y algoritmos de **Deep Merge**. Jamás se eliminan usuarios preexistentes ni se sobreescriben contraseñas válidas si un cliente con caché antigua sincroniza datos.
   - **Soft-Delete Obligatorio**: Los documentos retirados nunca se eliminan físicamente de la hoja de cálculo por accidente; se marcan como `Inactivo / Retirado` con autor, timestamp y motivo del retiro.

2. **⚡ Carga Instantánea con IndexedDB (Stale-While-Revalidate)**:
   - Mediante [`js/cache-service.js`](js/cache-service.js), el catálogo documental, matriz de personal y auditoría cargan en **menos de 50 ms** directamente desde `IndexedDB` local.
   - En segundo plano, el sistema verifica cambios y deltas sin congelar la interfaz ni exigir recarga forzada (F5).

3. **🔒 Protección de Datos Personales en Autenticación**:
   - Para evitar la exposición de cédulas, la pantalla de inicio de sesión solicita **únicamente Correo Corporativo y Contraseña**.
   - El número de identificación (cédula) se solicita **exclusivamente al crear la cuenta en "Realizar Nuevo Registro"**, validándolo contra la matriz activa de colaboradores.

4. **🔄 Respaldos Automatizados Diarios (GitHub Actions)**:
   - El workflow [`.github/workflows/daily-backup.yml`](.github/workflows/daily-backup.yml) se ejecuta automáticamente a las 04:00 UTC (11:00 PM Colombia) capturando un snapshot completo de usuarios, auditoría y documentos, archivándolo de forma inmutable en el repositorio.



