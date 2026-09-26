# 📘 REGLAS DE NEGOCIO Y ESPECIFICACIÓN ARQUITECTÓNICA DEL SISTEMA DE GESTIÓN DOCUMENTAL INSTITUCIONAL
## UNIÓN PARA LA SALUD Y LA VIDA S.A.S.
### Documento Maestro de Fuente Única de Verdad (SSOT - Single Source of Truth)

---

## 1. Declaración de Principios y Fuente Única de Verdad (SSOT)

### 1.1. Propósito y Carácter Vinculante
El presente documento constituye la **Fuente Única de Verdad (SSOT)** de la arquitectura, reglas de negocio, directrices de seguridad, flujos de datos y comportamiento de interfaz de usuario del **Sistema de Gestión Documental Institucional (SGC)** de **Unión para la salud y la vida S.A.S.**

Cualquier desarrollo, refactorización, integración o mantenimiento futuro **DEBE** apegarse estrictamente a las especificaciones aquí consagradas. **NO SE PERMITEN** modificaciones no solicitadas ni desviaciones arquitectónicas que vulneren las políticas operativas, la integridad de los registros o la gobernanza documental institucional.

### 1.2. Principios Rectores de la Arquitectura
1. **Prioridad Absoluta de la Integridad Documental:** Los documentos institucionales son activos regulados del Sistema de Gestión de Calidad en salud. Ningún proceso puede sobreescribir, corromper o desvincular un registro de su matriz de trazabilidad.
2. **Arquitectura Serverless Híbrida de Alta Disponibilidad:** La aplicación opera como una *Single Page Application* (SPA) estática optimizada para **GitHub Pages**, combinada con sincronización asíncrona hacia microservicios en **Google Workspace** (Google Sheets, Google Apps Script, Google Drive) y conectividad federada con **Microsoft 365** (SharePoint Online / OneDrive).
3. **Resiliencia y Carga Instantánea (*Stale-While-Revalidate*):** La interfaz de usuario **DEBE** renderizar en menos de 50 ms utilizando almacenamiento persistente local (`IndexedDB` y `localStorage`), mientras valida y reconcilia cambios en segundo plano sin congelar la experiencia del usuario.
4. **Protección de Datos Personales (Habeas Data):** En cumplimiento de la normativa de privacidad, el sistema **NO DEBE** solicitar números de identificación (cédulas) en la pantalla de inicio de sesión cotidiana; la autenticación rutinaria se realiza exclusivamente mediante **Correo Corporativo y Contraseña**. El documento de identidad se exige únicamente en el registro inicial y en la recuperación de credenciales.
5. **Inmutabilidad y No-Repudio (Append-Only):** Los registros de auditoría y el historial de cambios operan bajo un modelo estrictamente incremental (*Append-Only*). Las operaciones de retiro documental se realizan mediante *Soft-Delete* trazable; **NO SE DEBEN** ejecutar borrados físicos irreversibles en las fuentes maestras de datos.

---

## 2. Ecosistema de Archivos, Repositorios y Persistencia de Datos

### 2.1. Inventario y Función Canónica de Archivos

| Archivo / Recurso | Tipo / Formato | Ubicación | Función Arquitectónica | Regla Operativa Estricta |
| :--- | :--- | :--- | :--- | :--- |
| `REPOSITORIO_DOCUMENTAL.csv` | CSV delimitado por `;` (codificación Windows-1252 / UTF-8) | Raíz del Workspace / Servidor / OneDrive | Catálogo de enlaces físicos de Microsoft SharePoint Online y OneDrive. Contiene códigos, nombres con extensión, carpetas y URLs de visualización y descarga directa. | **ESTRICTAMENTE OBLIGATORIO:** Las filas correspondientes a carpetas de SharePoint (sin extensión de archivo) **DEBEN SER FILTRADAS Y EXCLUIDAS**. Jamás deben sobreescribir el archivo ejecutable o descargable. |
| `EMPLEADOS_ACTIVOS.csv` | CSV delimitado por `,` (UTF-8) | Raíz del Workspace / Servidor | Matriz oficial de colaboradores activos de la organización (1,305 registros). Contiene Identificación, Nombre, Cargo, Sede, Correo electrónico y Estado. | **FUENTE DE VALIDACIÓN PRIMARIA:** Ningún usuario puede iniciar sesión ni registrar contraseña si no se encuentra en estado `Activo` dentro de esta matriz. |
| `Historico_Documentos_USV.csv` | CSV delimitado por `;` (UTF-8 con BOM) | Raíz del Workspace / Servidor / Google Drive | Bitácora cronológica inmutable de cambios documentales (versiones, traslados de ruta, modificaciones de tipo, ediciones SharePoint, eliminaciones). | **MODELO APPEND-ONLY:** Solo admite adición de nuevos eventos. **NO DEBE** ser truncado ni editado manualmente. |
| `usuarios.conf` | JSON estructurado | Raíz del Workspace / Servidor / Google Drive | Almacén central de cuentas registradas (`passwordHash` en SHA-256), mapeo de perfiles personalizados, favoritos y preferencias de usuario. | **CONCURRENCIA Y MERGE ATÓMICO:** La sincronización en la nube **DEBE** emplear algoritmos de *Deep Merge* con `LockService`. Jamás debe purgar usuarios preexistentes. |
| `auditoria.dat` | JSON estructurado | Raíz del Workspace / Servidor / Google Drive | Registro inmutable de eventos de telemetría institucional (inicios de sesión, descargas de archivos, ediciones en SharePoint, modificaciones de seguridad). | **REGLA DE PROTECCIÓN:** Excluye consultas y búsquedas para prevenir saturación. Posee deduplicación temporal obligatoria. |
| `maestro.dat` | JSON estructurado | Raíz del Workspace / Servidor / Google Drive | Tablas maestras institucionales: Catálogo de Tipos de Documento, Áreas institucionales (con siglas) y Tipos de Proceso. | **FUENTE MAESTRA:** Gobierna los selectores de metadatos y filtros relacionales en cascada. |
| `google_drive_backup_script.gs` | Google Apps Script (JavaScript V8) | Google Drive / Apps Script Web App | Microservicio API cloud serverless. Gestiona la concurrencia, fusión de `usuarios.conf`, persistencia de `auditoria.dat` y actualización de la biblioteca Google Sheets. | **LOCK SERVICE:** Debe adquirir bloqueo de script (`getScriptLock`) con timeout de 30 segundos antes de cualquier escritura para evitar colisiones. |
| `.github/workflows/daily-backup.yml` | YAML (GitHub Actions) | `.github/workflows/` | Tarea programada (Cron) de respaldo diario automatizado a las 04:00 UTC (11:00 PM Colombia). | **VERSIONAMIENTO INMUTABLE:** Genera snapshots versionados en `backups/snapshots/backup_YYYY-MM-DD.json` y los consolida en el repositorio Git. |
| `server.py` | Python 3 (HTTP Server + COM Word) | Raíz del Workspace | Servidor local de desarrollo, API de datos y motor de conversión al vuelo de DOCX a PDF mediante Word COM Automation. | **GOBERNANZA LOCAL:** Expone endpoints `/api/*` y maneja caché en memoria (`CACHE`) con refresco en segundo plano. |
| `index.html` | HTML5 semántico | Raíz del Workspace | Estructura principal de la SPA, carga de módulos ES6 y montura de vistas de Catálogo y Analítica. | **CONTROL DE CACHÉ:** Todas las referencias a scripts y estilos **DEBEN** incluir control de versiones (`?v=11.6.XX`). |
| `styles.css` | CSS3 Vanilla | Raíz del Workspace | Sistema de diseño institucional: colores corporativos, tipografía *Quicksand* / *Montserrat*, modo oscuro, badges de formato y estados. | **NO TAILWIND:** Se debe usar CSS Vanilla estructurado con variables institucionales `--primary`, `--brand-navy`, etc. |
| `js/app.js` | JavaScript ES6 Module | `js/` | Controlador principal de la aplicación (`AppController`). Gestiona el ciclo de vida, renderizado de tablas/tarjetas, eventos de UI y vistas. | Orquestador de interacción. |
| `js/sharepoint-service.js` | JavaScript ES6 Module | `js/` | Motor de integración de datos, parseo de repositorios, resolución de URLs SharePoint/OneDrive y lógica de descargas. | Administrador de streaming y conversión. |
| `js/staff-service.js` | JavaScript ES6 Module | `js/` | Servicio de gestión de personal, cálculo de roles RBAC, autenticación, telemetría y auditoría institucional. | Autoridad de seguridad de usuario. |
| `js/filters.js` | JavaScript ES6 Module | `js/` | Motor de filtros relacionales en cascada, búsqueda global multi-criterio y ordenamiento. | Filtro de catálogo. |
| `js/modal.js` | JavaScript ES6 Module | `js/` | Gestor universal de modales, panel lateral deslizable (*Drawer*) y formularios de metadatos. | Presentación de diálogos. |
| `js/analytics.js` | JavaScript ES6 Module | `js/` | Motor del Dashboard de Analítica: cálculo de KPIs, semáforo de vigencia, auditoría en vivo y exportaciones maestras. | Inteligencia de datos. |
| `js/cache-service.js` | JavaScript ES6 Module | `js/` | Abstracción de persistencia local en `IndexedDB` para telemetría offline y almacenamiento local instantáneo. | Persistencia offline-first. |
| `js/data.js` | JavaScript ES6 Module | `js/` | Matriz base inicial de documentos institucionales (`DOCUMENTOS_REALES`) para arranque instantáneo sin red. | Catálogo estático de respaldo. |
| `js/staff-data.js` | JavaScript ES6 Module | `js/` | Matriz base estática de colaboradores (`EMPLEADOS_ACTIVOS_BASE`) para arranque instantáneo sin red. | Personal estático de respaldo. |

---

## 3. Arquitectura y Flujos de Datos

### 3.1. Cascada de Prioridad de Fuentes de Datos (*Source Priority Cascade*)
Para garantizar que el sistema opere en cualquier entorno (local con `server.py`, en producción sobre GitHub Pages o en situaciones de conectividad intermitente), las consultas de datos **DEBEN** seguir la siguiente cascada jerárquica:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 1: Caché en Memoria e IndexedDB (Respuesta < 50ms)               │
│ - Se hidrata inmediatamente al cargar la SPA                           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (Verificación en segundo plano)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 2: API Local Python (server.py)                                   │
│ - Endpoints: /api/configuracion, /api/auditoria, /api/maestras,         │
│   /api/historico, /api/empleados, /api/descargar-pdf                   │
│ - Si el hostname es 'localhost' o '127.0.0.1', se consulta primero     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (Si falla o está en GitHub Pages)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 3: Google Apps Script Web App (Cloud Microservice)               │
│ - Endpoints: ?action=documentos, ?action=auditoria, ?action=historico, │
│   ?action=maestras, ?action=backup_completo                            │
│ - Operaciones POST con payload JSON y keepalive                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (Si Apps Script no responde)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 4: Archivos Estáticos y Google Drive Directo                     │
│ - Descarga directa de archivos .csv y .dat de la raíz                  │
│ - URLs directas de Google Drive (export=download&id=...)               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ (En caso de desconexión total)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 5: Matrices Nativas en Memoria (data.js / staff-data.js)         │
│ - Garantiza funcionamiento mínimo vital (Catálogo offline de solo      │
│   lectura y consulta)                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Reglas de Integridad para Documentos Base y Registros Derivados (Subregistros)

#### A. Definiciones Conceptuales
1. **Documento Base (Padre):** Es el formato, procedimiento, instructivo o manual maestro del Sistema de Gestión de Calidad. Su código no contiene sufijos numéricos de secuencia secundaria (ejemplos: `FMT-GIC-016`, `INS-GIC-001`, `PRC-GMD-001`).
2. **Registro Derivado (Documento Secundario / Subregistro):** Es un documento específico generado o diligenciado a partir de un Documento Base. Su código incorpora un subíndice secuencial numérico precedido de un guion (ejemplos: `FMT-GIC-016-1`, `FMT-GIC-016-2`, `FMT-GIC-016-3`) o posee la propiedad `subclase === 'Registro'` / `esRegistro === true`.

#### B. Reglas de Integridad Estrictas
- **VINCULACIÓN JERÁRQUICA:** Todo registro secundario **DEBE** estar asociado a su documento padre mediante el campo `documentoPadreCodigo`. En memoria y en la interfaz, **DEBE** residir en el arreglo `base.registrosDerivados[]` del documento base correspondiente.
- **HERENCIA DE METADATOS:** Los registros derivados **DEBEN** heredar automáticamente el Área (`area`), el Nombre del Área (`areaNombre`), el Proceso (`proceso`), el Tipo de Proceso (`tipoProceso`) y la Carpeta (`carpeta`) de su documento base.
- **DESVINCULACIÓN ESTRICTA DE ARCHIVO:** Un registro derivado **JAMÁS DEBE** apuntar a la URL del archivo físico del documento base. Si un registro secundario tiene asignada la misma URL de descarga o SharePoint que su padre, el sistema **DEBE** blanquear dichos enlaces y clasificar el registro como `NO DISPONIBLE` hasta que se le asocie un archivo individual propio.
- **CÁLCULO DETERMINÍSTICO DE RUTAS:** La ubicación de los archivos de registros secundarios en SharePoint se calcula determinísticamente en una subcarpeta homónima dentro del proceso del padre, siguiendo la estructura:
  `.../[Proceso]/Formatos/[CodigoPadre] [TituloPadre]/[CodigoSecundario] [TituloSecundario].[ext]`
- **CASO CANÓNICO `FMT-GIC-016`:**
  - El documento base `FMT-GIC-016 Definición de criterios de formación` **DEBE** apuntar exclusivamente al archivo editable maestro `FMT-GIC-016 Definición de criterios de formación.docx`.
  - Sus tres registros derivados canónicos oficiales son:
    1. `FMT-GIC-016-1` -> *Definición de criterios de formación anticoagulados 2026-1*
    2. `FMT-GIC-016-2` -> *Definición de criterios de formación anticoagulados 2026-2*
    3. `FMT-GIC-016-3` -> *Definición de criterios de formación Asma y EPOC 2026*
  - **Deduplicación:** La función `_deduplicarRegistros` **DEBE** normalizar los títulos, prevenir repeticiones de concatenación (*ej: "Criterios de FormaciCriterios de Formacion"*) y ordenar los registros numéricamente por su sufijo (`-1`, `-2`, `-3`).

---

## 4. Gestión de Usuarios, Accesos y Matriz de Control de Acceso (RBAC)

### 4.1. Lógica de Asignación de Perfiles

El sistema contempla cuatro (4) perfiles de usuario jerárquicos:

```
[Acceso Total (total / administrador)]
         │
         ▼
    [Directivo]
         │
         ▼
  [Administrativo]
         │
         ▼
    [Operativo]
```

#### Reglas de Determinación Automática (`determinarPerfil`)
1. **Regla de Cédula Maestra (Acceso Total):** Si el número de identificación del colaborador es `8160602`, se asigna de forma directa, perpetua e inmutable el perfil `total`.
2. **Prioridad de Asignación Personalizada:** Si el usuario tiene un perfil asignado en `usuarios.conf` (`mapeoPerfilesPersonalizados`), dicho perfil prevalece, con la salvedad de la Regla de Saneamiento Directivo.
3. **Regla de Saneamiento y Exclusividad Directiva:**
   - El perfil `directivo` está reservado **EXCLUSIVAMENTE** para los cargos que contengan en su denominación: `director`, `directora`, `gerente`, `subdirector` o `subgerente`.
   - Si un colaborador con cargo de líder, analista, coordinador, auxiliar o profesional figura configurado erróneamente con perfil directivo, el sistema **DEBE reclasificarlo automáticamente a perfil `administrativo`**.
4. **Regla de Perfil Administrativo:** Corresponde a todos los colaboradores con cargos que contengan: `lider`, `líder`, `analista`, `coordinador`, `coordinadora`, `comunicador`, `gesis`, `administrati`, `financier`, `tecnolog`, `organizacional`, así como auxiliares y profesionales que no pertenezcan al ámbito exclusivamente asistencial/salud.
5. **Regla de Perfil Operativo (Por Defecto):** Aplica a todo el personal asistencial y de salud directa: Médicos Generales, Médicos Especialistas, Auxiliares de Enfermería, Terapeutas y personal asistencial operativo.

### 4.2. Matriz Exhaustiva de Permisos y Capacidades por Perfil

| Capacidad / Función | Acceso Total (`total`) | Directivo (`directivo`) | Administrativo (`administrativo`) | Operativo (`operativo`) |
| :--- | :---: | :---: | :---: | :---: |
| **Visualización en Catálogo** | Todos los documentos (100%) | Todos los documentos (100%) | Documentos Administrativos y Operativos (`permisoAdministrativo === true` o `permisoOperativo === true`) | Únicamente Documentos Operativos (`permisoOperativo === true`) |
| **Descarga Directa de Archivos** | Habilitada (Nativo o PDF) | Habilitada (Nativo o PDF) | Habilitada (Nativo o PDF) | Habilitada (Nativo o PDF según permisos) |
| **Acceso a Documentos Restringidos (`descargable: false`)** | Desbloqueable en Modo Edición | Desbloqueable en Modo Edición | Desbloqueable en Modo Edición | **ESTRICTAMENTE BLOQUEADO** (Insignia `🔒 Bloqueado`) |
| **Activación de Modo Edición** | **Automática e Inmediata** (Sin contraseña adicional) | Requiere Contraseña Personal de Acceso | Requiere Contraseña Personal de Acceso | **ESTRICTAMENTE BLOQUEADO** (El personal operativo jamás edita) |
| **Edición en SharePoint Online (`✏️ SharePoint`)** | Habilitada para cualquier archivo | Habilitada para cualquier archivo | Habilitada solo en archivos de su competencia | **ESTRICTAMENTE DESHABILITADA** |
| **Apertura de Carpeta en SharePoint (`📁`)** | Habilitada | Habilitada | Habilitada | **ESTRICTAMENTE DESHABILITADA** |
| **Modificar Metadatos de Documento (`⚙️`)** | Habilitada | Habilitada | **Deshabilitada** (Requiere permiso de gestión de catálogo) | **ESTRICTAMENTE DESHABILITADA** |
| **Retirar / Eliminar Documento (`🗑️`)** | Habilitada (*Soft-Delete*) | Habilitada (*Soft-Delete*) | **ESTRICTAMENTE DESHABILITADA** | **ESTRICTAMENTE DESHABILITADA** |
| **Crear Nuevo Documento Base / Registro (`➕`)** | Habilitada | Habilitada | **ESTRICTAMENTE DESHABILITADA** | **ESTRICTAMENTE DESHABILITADA** |
| **Gestión de Registros Derivados (Crear / Eliminar)** | Habilitada | Habilitada | **ESTRICTAMENTE DESHABILITADA** | **ESTRICTAMENTE DESHABILITADA** |
| **Dashboard: Pestaña Resumen Documental** | Habilitada | Habilitada | Habilitada | **ESTRICTAMENTE BLOQUEADA** (Redirección forzada a catálogo) |
| **Dashboard: Pestaña Calidad y Semaforización** | Habilitada | Habilitada | **ESTRICTAMENTE OCULTA** (`display: none`) | **ESTRICTAMENTE BLOQUEADA** |
| **Dashboard: Pestaña Auditoría Institucional** | Habilitada | Habilitada | **ESTRICTAMENTE OCULTA** (`display: none`) | **ESTRICTAMENTE BLOQUEADA** |
| **Dashboard: Pestaña Control de Cambios** | Habilitada | Habilitada | **ESTRICTAMENTE OCULTA** (`display: none`) | **ESTRICTAMENTE BLOQUEADA** |
| **Exportación de Informes y Listado Maestro** | Habilitada (Excel / CSV) | Habilitada (Excel / CSV) | **ESTRICTAMENTE OCULTA** (Grupo de exportación suprimido) | **ESTRICTAMENTE BLOQUEADA** |
| **Cambio de Contraseña Institucional** | Habilitada | Habilitada | **ESTRICTAMENTE DESHABILITADA** | **ESTRICTAMENTE DESHABILITADA** |
| **Asignación de Perfiles a Terceros** | Habilitada | **Deshabilitada** | **Deshabilitada** | **Deshabilitada** |

---

## 5. Políticas de Seguridad, Motor de Salida y Descargas

### 5.1. Matriz de Decisión de Descarga (*Download Strategy Matrix*)

El tratamiento de cada archivo al momento de pulsar el botón **Descargar** (`📥`) se rige de forma determinística por la función `determinarEstrategiaDescarga(doc)`:

```
                                 ¿Es Documento Excel (.xlsx, .xls)?
                                       /                    \
                                    SÍ                       NO
                                   /                           \
                 [DESCARGA NATIVA EXCEL]             ¿Es Registro Derivado / Secundario?
                                                     (esRegistro=true o sufijo -\d+)
                                                           /                  \
                                                        SÍ                     NO
                                                       /                         \
                                             [CONVERSIÓN A PDF]       ¿Código inicia con FMT-?
                                                                         /               \
                                                                      SÍ                  NO
                                                                     /                      \
                                                        [DESCARGA NATIVA WORD]     [CONVERSIÓN A PDF]
```

### 5.2. Reglas Específicas de Formatos de Salida

#### Regla 1: Inmutabilidad de Hojas de Cálculo (Excel)
Los documentos en formato Microsoft Excel (`.xlsx`, `.xls` o CSV) **NUNCA DEBEN SER CONVERTIDOS A PDF**. Las hojas de cálculo contienen fórmulas, macros y matrices operativas que deben descargarse en su formato editable nativo original (`tipoAccion: 'NATIVO_EXCEL'`).

#### Regla 2: Formatos Base Institucionales (FMT)
Los documentos Word cuyo código inicie con el prefijo `FMT-` y que sean **Documentos Base** (`!esRegistro`) representan plantillas institucionales destinadas a ser diligenciadas por los colaboradores. Por ende, **DEBEN DESCARGARSE EN SU FORMATO EDITABLE ORIGINAL (.docx)** (`tipoAccion: 'NATIVO_FMT'`) y lucir la insignia azul `DOC`.

#### Regla 3: Documentos Institucionales No-FMT (Normativa SGC)
Todo documento Word que **NO** corresponda a formato (códigos que inician con `INS-`, `PRC-`, `MAN-`, `POL-`, `DA-`, `AA-`, `RG-`, `AUT-`, etc.) representa normativa y directrices institucionales protegidas. **ESTOS DOCUMENTOS DEBEN DESCARGARSE ESTRICTAMENTE EN FORMATO PDF PROTEGIDO**, independientemente de que el archivo almacenado en SharePoint sea `.docx`. En la interfaz lucen la insignia roja `PDF`.

#### Regla 4: Blindaje Obligatorio de Registros Derivados (Subregistros)
**TODOS los documentos secundarios o registros derivados (incluso aquellos cuyo código inicie con `FMT-` como `FMT-GIC-016-1`, `FMT-GIC-016-2`, `FMT-GIC-016-3`) DEBEN DESCARGARSE ESTRICTAMENTE EN FORMATO PDF PROTEGIDO.**
- **Justificación de Negocio:** Aunque deriven de una plantilla FMT, los registros secundarios ya contienen información clínica, técnica o administrativa ejecutada y no deben ser modificados por terceros no autorizados.
- **Insignia Visual:** En la tabla del catálogo y en el panel lateral (*Drawer*), **DEBEN** exhibir la insignia roja **`PDF`** (`badge-pdf`).
- **Preservación del Modo Edición:** Los usuarios autorizados en Modo Edición conservan la facultad de editar el archivo original en SharePoint Online mediante el botón `✏️ SharePoint`.

### 5.3. Motor de Conversión al Vuelo (`server.py`) y Fallback Cloud

1. **Entorno Local / Servidor (`server.py`):**
   - Cuando la aplicación opera en `localhost` o `127.0.0.1`, las descargas que requieran PDF se envían al endpoint `/api/descargar-pdf?codigo=...&url=...&titulo=...&esRegistro=...`.
   - **Exclusión de FMT Base:** Si `es_fmt` es verdadero y `not es_registro`, el servidor responde inmediatamente con redirección HTTP 302 a la URL nativa del archivo en SharePoint.
   - **Conversión Word COM:** Para documentos no-FMT y registros secundarios, el servidor invoca en segundo plano `win32com.client.Dispatch('Word.Application')` con bloqueo de exclusión mutua (`WORD_CONVERT_LOCK`).
   - **Caché Instantánea de PDF:** El archivo convertido se almacena en el directorio local `pdf_cache/{codigo}.pdf`. Las descargas subsecuentes se sirven directamente desde caché en **menos de 1 milisegundo**.
   - **Entrega Segura:** El archivo se transmite con cabecera `Content-Type: application/pdf` y `Content-Disposition: attachment; filename="{codigo} {titulo}.pdf"`.

2. **Entorno Remoto / Cloud (GitHub Pages / SharePoint Online):**
   - Si el servidor local no está disponible, el cliente transforma la URL de SharePoint hacia el endpoint REST v2.0 oficial de Microsoft Graph Drive API:
     `${siteBase}/_api/v2.0/drive/root:/${subpathEncoded}:/content?format=pdf`
   - El motor de Microsoft 365 genera y transmite la versión PDF al vuelo.

---

## 6. Comportamiento y Reglas de la Interfaz de Usuario (UI/UX)

### 6.1. Modos Operativos: Modo Consulta vs. Modo Edición

#### A. Modo Consulta (Modo No Edición)
- **Estado Inicial Obligatorio:** Todo usuario que ingresa al sistema inicia en **Modo Consulta**, con excepción exclusiva del usuario con perfil `total`.
- **Botón de Modo Edición:** Exhibe el candado cerrado `🔒 Modo Edición`.
- **Botones en Tabla y Tarjetas:** Se muestra exclusivamente el botón `📥 Descargar` (o `🔒 Bloqueado` si `descargable: false`).
- **Acciones Suprimidas:** Los botones de edición directa (`✏️`), carpetas (`📁`), menú de metadatos (`⚙️`), retiro (`🗑️`) y creación de nuevos documentos (`➕`) se encuentran ocultos o deshabilitados.
- **Interacción de Fila:** Al hacer clic en cualquier fila o tarjeta, se abre el panel lateral (*Drawer*) en modo de solo lectura (Ficha Técnica e Historial).

#### B. Modo Edición
- **Desbloqueo:**
  - Perfil `total` / `administrador`: Se activa automáticamente sin solicitar contraseña.
  - Perfiles `directivo` y `administrativo`: Requiere confirmación de contraseña personal mediante `modalManager.abrirModalPasswordEdicion()`.
  - Perfil `operativo`: **ESTRICTAMENTE PROHIBIDO**. El sistema emite un toast de restricción y rechaza la activación.
- **Indicador Visual:** El botón conmuta a `🔓 Modo Edición` con estilo resaltado y se añade la clase CSS `modo-edicion-activo`.
- **Acciones Disponibles en Tabla:**
  - `✏️`: Abre el documento en SharePoint Online en modo de edición colaborativa (`action=edit&web=1`).
  - `📁`: Abre la carpeta contenedora del documento en SharePoint Online.
  - `⋮`: Despliega menú contextual para modificar metadatos (`⚙️`) o retirar del catálogo (`🗑️`).
  - Botón flotante `➕ Nuevo Documento`: Visible en la barra inferior para directivos y administradores.

### 6.2. Panel Lateral Deslizable (*Drawer*) y Ficha Técnica
El Drawer ofrece una vista exhaustiva del documento con las siguientes pestañas gobernadas por perfil:
1. **Ficha Técnica:** Metadatos institucionales (Código, Versión `v01`, Proceso, Área, Tiempo de Retención, Lugar de Custodia, Fecha de Aprobación, Vigencia, Enlaces de visualización).
2. **Historial de Cambios:** Línea de tiempo con el registro de versiones, modificaciones y eventos de auditoría específicos del documento.
3. **Registros Derivados:** Acordeón con los registros secundarios asociados. Cada subregistro exhibe su badge (`PDF` o `XLS`), fecha y acciones (`Descargar en PDF`, `✏️ SharePoint` en modo edición, `⚙️` y `🗑️` para roles autorizados).

### 6.3. Búsqueda, Filtros y Ordenamiento

- **Jerarquía Relacional en Cascada:** La selección de un *Tipo de Proceso* restringe dinámicamente las *Áreas* disponibles; la selección de un *Área* restringe los *Procesos* hijos; y la selección de un *Proceso* restringe los *Tipos de Documento*.
- **Buscador Inteligente con Normalización:** Realiza coincidencia insensible a mayúsculas, minúsculas y tildes (*NFD Regex*). Busca sobre: Código, Título, Proceso, Área, Carpeta y Títulos de Registros Derivados asociados. Si la búsqueda coincide con un subregistro, la fila padre despliega un aviso destacado: `⭐ Coincide con búsqueda en: "[Título del Subregistro]"`.
- **Persistencia de Preferencias:** El ordenamiento seleccionado (`codigo-asc`, `codigo-desc`, `titulo-asc`, `fecha-desc`, etc.) y la vista de catálogo (`tabla` o `tarjetas`) se guardan en `usuarios.conf` y se replican en todos los dispositivos del colaborador.

---

## 7. Telemetría, Seguridad y Auditoría Inmutable

### 7.1. Eventos Registrados en `auditoria.dat`

Se auditan de forma obligatoria los siguientes tipos de evento:

| Tipo de Evento | Descripción y Datos Capturados | Ventana Anti-Flooding |
| :--- | :--- | :---: |
| `LOGIN` | Autenticación exitosa del colaborador (Identificación, Nombre, Cargo, Perfil, Timestamp, Dispositivo). | 10 segundos |
| `DESCARGA` | Descarga de documento o registro secundario (Código, Título, Extensión, Formato entregado). | 5 segundos |
| `EDICION` | Apertura de documento para modificación en SharePoint Online (Código, Título, Versión). | 5 segundos |
| `CARPETA` | Acceso a la carpeta de SharePoint Online desde la aplicación. | 5 segundos |
| `CREACION` | Registro de un nuevo documento base o registro derivado en el catálogo. | Inmediato |
| `METADATOS` | Modificación de metadatos de un documento existente (versión, proceso, retención, etc.). | Inmediato |
| `ELIMINACION` | Retiro de un documento del catálogo (*Soft-Delete* con motivo documentado). | Inmediato |
| `SEGURIDAD` | Cambio de contraseña personal o institucional. | Inmediato |

### 7.2. Reglas de Exclusión y Protección de Telemetría
1. **Exclusión de Consultas y Búsquedas:** Los eventos de consulta pasiva (`CONSULTA`, `BUSQUEDA`, visualización de tarjetas) **NO SE GUARDAN EN AUDITORIA.DAT** para evitar la sobrecarga del almacenamiento y preservar el rendimiento.
2. **Falsos Positivos de Perfil Operativo:** El personal operativo tiene restringida la edición. Por regla de integridad, el sistema **BLOQUEA cualquier falso positivo de evento `EDICION` asociado a un usuario con perfil operativo**.
3. **Deduplicación Temporal:** Si se producen múltiples clics idénticos dentro de la ventana de protección (por ejemplo, doble clic al descargar), solo el primer evento es registrado en auditoría.
4. **Cola Offline de Telemetría:** Cuando no hay conexión a internet, los eventos de auditoría se almacenan en una cola local en `IndexedDB`. Al restablecerse la conexión (`window.addEventListener('online')`), la cola se transmite automáticamente a Google Apps Script.

---

## 8. Tareas Automatizadas y Procesos en Segundo Plano

### 8.1. Respaldo Diario Automatizado (`daily-backup.yml`)
- **Frecuencia:** Diaria a las 04:00 UTC (11:00 PM hora de Colombia).
- **Mecanismo:** Disparado por GitHub Actions. Consulta el endpoint `?action=backup_completo` de Google Apps Script.
- **Validación de Integridad:** El workflow verifica que la respuesta contenga JSON válido con `"status":"ok"`. Si la respuesta es inválida o vacía, **ABORTA** el commit para evitar la corrupción del histórico.
- **Destino:** Archiva el archivo con marca de tiempo en `backups/snapshots/backup_YYYY-MM-DD.json` y actualiza `backups/snapshot_latest.json`.

### 8.2. Microservicio de Google Apps Script (`google_drive_backup_script.gs`)
- **Bloqueo Concurrente:** Utiliza `LockService.getScriptLock()` con espera de hasta 30,000 ms para serializar escrituras concurrentes.
- **Algoritmo Deep Merge:** Al recibir actualizaciones de `usuarios.conf`, combina los diccionarios de usuarios y contraseñas. Nunca permite que un cliente sobreescriba contraseñas con valores vacíos o nulos.
- **Sincronización Bidireccional de Control de Cambios:** Actualiza simultáneamente el archivo `Historico_Documentos_USV.csv` en Google Drive y la hoja de cálculo de biblioteca.

---

## 9. Reglas Pendientes de Definición y Brechas Arquitectónicas Detectadas

A partir del análisis exhaustivo del código fuente actual, se identifican las siguientes brechas operativas y ambigüedades que **deben ser sometidas a definición y validación por la dirección del proyecto**:

### 9.1. Coexistencia de Autenticación Local vs. Azure Entra ID (MSAL)
- **Situación Actual:** Existen dos módulos de autenticación:
  1. `staff-service.js`: Autenticación corporativa interna contra `EMPLEADOS_ACTIVOS.csv` y contraseñas hash en `usuarios.conf` (Flujo primario activo).
  2. `auth.js`: Conector MSAL.js / OAuth2 con Tenant ID configurado de Azure Entra ID para SharePoint.
- **Brecha Detectada:** `auth.js` se encuentra implementado pero desacoplado del inicio de sesión principal. Si un colaborador inicia sesión con su contraseña local, el sistema no obtiene un token Bearer OAuth de SharePoint Online, dependiendo de que el usuario ya tenga una sesión SSO activa en el navegador para abrir los enlaces `sharepoint.com`.
- **Definición Requerida:** Determinar si en una fase futura se unificará el inicio de sesión para que el login local desencadene silenciosamente el flujo interactivo de Azure MSAL, o si se mantendrá el modelo actual de SSO federado por navegador.

### 9.2. Lógica de Flags de Permisos en Blanco en Google Sheets
- **Situación Actual:** En `filters.js`, la evaluación de visibilidad para perfiles administrativos y operativos contiene la siguiente condición:
  ```javascript
  d.permisoAdministrativo === true || d.permisoOperativo === true || d.permisoAdministrativo !== false || d.permisoOperativo !== false
  ```
- **Brecha Detectada:** Si en la hoja de cálculo de Google Sheets las columnas `Administrativo` u `Operativo` se encuentran vacías (es decir, ni `true` ni `false`), la condición `!== false` evalúa como verdadero, lo que provoca que documentos potencialmente restringidos sean visibles por defecto para personal operativo.
- **Definición Requerida:** Se recomienda definir formalmente si la política de seguridad debe operar bajo el principio de **"Mínimo Privilegio / Denegación por Defecto"** (`d.permisoOperativo === true`), exigiendo que la casilla esté explícitamente marcada para conceder acceso.

### 9.3. Borrado Físico vs. Retiro (*Soft-Delete*) en la Hoja de Google Sheets
- **Situación Actual:** El modal de eliminación ofrece al administrador la casilla de verificación *"Eliminar físicamente el registro de la hoja de cálculo"*. Sin embargo, el script `google_drive_backup_script.gs` implementa preferentemente una actualización de estado a `Inactivo / Retirado` para salvaguardar la auditoría.
- **Definición Requerida:** Formalizar si el borrado físico de filas en la hoja maestra debe quedar **estrictamente prohibido por política de calidad**, restringiendo la acción a un retiro lógico (*Soft-Delete*) que preserve la trazabilidad histórica de los documentos que alguna vez estuvieron vigentes.

### 9.4. Tasa Límite (*Rate Limiting*) en la Recuperación de Contraseñas
- **Situación Actual:** La recuperación y cambio de contraseñas valida los últimos 4 dígitos de la cédula y el correo corporativo. No se evidencia en el cliente un límite estricto de intentos fallidos antes de bloquear temporalmente la interfaz.
- **Definición Requerida:** Definir si se debe incorporar un bloqueo temporal de 15 minutos tras tres (3) intentos fallidos consecutivos de ingreso de los 4 dígitos o contraseña, fortaleciendo el esquema de protección ante intentos de fuerza bruta local.

---

## 10. Resumen de Gobernanza para Desarrolladores

```
================================================================================
RECORDATORIO CRÍTICO DE ARQUITECTURA:
1. NINGÚN registro derivado (subregistro) debe descargarse en Word.
   TODOS los registros derivados deben descargarse en PDF (insignia roja PDF),
   a menos que sean archivos de Excel (.xlsx).
2. El documento base FMT-GIC-016 DEBE descargar su archivo .docx original.
   NO DEBE abrir la carpeta de SharePoint.
3. El perfil Operativo JAMÁS debe tener acceso a botones de edición ni al Dashboard.
4. Las contraseñas en usuarios.conf SIEMPRE se hashean en SHA-256 antes de guardarse.
5. El servidor local server.py debe mantener activo el bloqueo WORD_CONVERT_LOCK
   en toda conversión para garantizar estabilidad en Windows.
================================================================================
```
