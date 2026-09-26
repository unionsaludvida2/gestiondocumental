# 📘 REGLAS DE NEGOCIO Y ESPECIFICACIÓN ARQUITECTÓNICA DEL SISTEMA DE GESTIÓN DOCUMENTAL INSTITUCIONAL
## UNIÓN PARA LA SALUD Y LA VIDA S.A.S.
### Documento Maestro de Fuente Única de Verdad (SSOT - Single Source of Truth)

---

## 📋 Ficha Técnica del Documento

| Atributo | Detalle Técnico |
| :--- | :--- |
| **Organización:** | Unión para la salud y la vida S.A.S. |
| **Sistema:** | Sistema de Gestión Documental y Calidad Institucional (SGC) |
| **Versión:** | 2.1.0 (Consolidación Oficial de Reglas, Tablas y Diagramas) |
| **Fecha:** | Septiembre 2026 |
| **Carácter:** | **Normativo, Estricto y Vinculante (Fuente Única de Verdad - SSOT)** |
| **Pila:** | SPA Vanilla JS (ES6), CSS3 Puro, Python COM, Apps Script, SharePoint/OneDrive, GHA |
| **Repositorio:** | `gesisusv/repo-doc-sharepoint` |
| **Producción:** | GitHub Pages (`https://gesisusv.github.io/repo-doc-sharepoint/`) |
| **Visor Web:** | Portal interactivo complementario disponible en `reglas_de_negocio.html` |

---

## 📑 Tabla de Contenido

1. [Declaración de Principios y Gobernanza Vinculante](#1-declaración-de-principios-y-gobernanza-vinculante)
2. [Topología y Arquitectura Serverless Híbrida](#2-topología-y-arquitectura-serverless-híbrida)
   - 2.1. Diagrama de Arquitectura del Ecosistema
   - 2.2. Diagrama de Cascada de Prioridad en la Adquisición de Datos
   - 2.3. Matriz de Capas de Persistencia y Tiempos de Respuesta
3. [Inventario Canónico de Archivos y Persistencia de Datos](#3-inventario-canónico-de-archivos-y-persistencia-de-datos)
4. [Jerarquía Documental: Documentos Base vs. Registros Derivados](#4-jerarquía-documental-documentos-base-vs-registros-derivados)
   - 4.1. Diagrama de Relación Jerárquica Padre-Hijo
   - 4.2. Matriz Comparativa: Documento Base vs. Registro Derivado
   - 4.3. Reglas de Integridad Estricta y Desvinculación de URLs
5. [Gestión de Identidad, Perfiles y Matriz de Acceso (RBAC)](#5-gestión-de-identidad-perfiles-y-matriz-de-acceso-rbac)
   - 5.1. Diagrama de Jerarquía de Perfiles
   - 5.2. Diagrama de Flujo de Autenticación y Asignación de Perfil
   - 5.3. Matriz de Mapeo de Cargos y Regla de Saneamiento Directivo
   - 5.4. Matriz Exhaustiva de Capacidades por Perfil (RBAC)
6. [Motor de Salida y Matriz Determinística de Descarga](#6-motor-de-salida-y-matriz-determinística-de-descarga)
   - 6.1. Árbol de Decisión Determinística de Descarga
   - 6.2. Matriz de Prefijos Oficiales y Formatos de Salida
   - 6.3. Matriz de Casos Especiales y Manejo de Extensiones
7. [Experiencia de Usuario (UI/UX), Modos de Operación y Filtros](#7-experiencia-de-usuario-uiux-modos-de-operación-y-filtros)
   - 7.1. Diagrama de Estados: Modo Consulta vs. Modo Edición
   - 7.2. Diagrama de Flujo de Filtros en Cascada y Búsqueda NFD
   - 7.3. Matriz de Controles de Interfaz según Modo y Perfil
8. [Telemetría, Auditoría Inmutable y Trazabilidad](#8-telemetría-auditoría-inmutable-y-trazabilidad)
   - 8.1. Diagrama de Ingesta y Filtrado Anti-Flood de Telemetría
   - 8.2. Matriz de Eventos Auditados en `auditoria.dat`
9. [Procesos Asíncronos, Respaldo y Automatización](#9-procesos-asíncronos-respaldo-y-automatización)
   - 9.1. Diagrama de Secuencia de Respaldo Diario Automatizado (GitHub Actions)
   - 9.2. Diagrama de Concurrencia y Sincronización Cloud con LockService
   - 9.3. Matriz de Políticas de Respaldo y Retención
10. [Políticas Oficiales de Seguridad y Decisiones de Negocio](#10-políticas-oficiales-de-seguridad-y-decisiones-de-negocio)
    - 10.1. Arquitectura de Autenticación Local con SSO de Navegador
      - *Diagrama 10.1.1: Flujo de Autenticación Local y Acceso Federado M365*
      - *Tabla 10.1.1: Comparativa Modelo Local Oficial vs. Modelo MSAL Deprecado*
    - 10.2. Política de Mínimo Privilegio y Denegación por Defecto (Default Deny)
      - *Diagrama 10.2.1: Árbol Lógico de Evaluación de Permisos en Hoja de Cálculo*
      - *Tabla 10.2.1: Tabla de Verdad y Visibilidad según Celda y Perfil*
    - 10.3. Prohibición de Borrado Físico y Retiro Lógico (Soft-Delete)
      - *Diagrama 10.3.1: Ciclo de Vida Documental y Retiro Lógico*
      - *Tabla 10.3.1: Matriz Diferencial: Retiro Lógico vs. Borrado Físico Prohibido*
    - 10.4. Tasa Límite (Rate Limiting) y Bloqueo Escalonado
      - *Diagrama 10.4.1: Flujo de Bloqueo Escalonado por Intentos Fallidos*
      - *Tabla 10.4.1: Matriz de Estados de Seguridad y Reglas de Desbloqueo*
11. [Decálogo de Gobernanza para Desarrolladores](#11-decálogo-de-gobernanza-para-desarrolladores)
    - 11.1. Tabla Maestra de Mandamientos Técnicos y Sanción por Violación
    - 11.2. Resumen Nemotécnico para el Desarrollador

---

## 1. Declaración de Principios y Gobernanza Vinculante

### 1.1. Propósito y Carácter Obligatorio
El presente documento constituye la **Fuente Única de Verdad (Single Source of Truth - SSOT)** que rige la totalidad de la lógica de software, flujos de integración, restricciones de seguridad y diseño de interfaz del **Sistema de Gestión Documental Institucional** de **Unión para la salud y la vida S.A.S.**

> [!IMPORTANT]
> **Carácter Vinculante:** Ningún desarrollo presente o futuro, mantenimiento, refactorización o corrección puede desviarse de los lineamientos consagrados en este documento. Toda modificación al código fuente debe preservar estrictamente estas reglas.

### 1.2. Principios Rectores de la Solución

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRINCIPIOS RECTORES DEL SISTEMA                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Integridad Documental Absoluta (Activos Regulados de Salud)        │
│ 2. Arquitectura Serverless Híbrida de Alta Disponibilidad              │
│ 3. Rendimiento Ultrarrápido (< 50 ms via Stale-While-Revalidate)       │
│ 4. Mínimo Privilegio y Denegación por Defecto (Default Deny)           │
│ 5. Protección de Datos Personales y Habeas Data                        │
│ 6. Inmutabilidad y Trazabilidad sin Borrado Físico (Soft-Delete)       │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Prioridad Absoluta de la Integridad Documental:** Los documentos institucionales son activos regulados en el marco del Sistema de Garantía de Calidad en Salud. Ninguna rutina informática puede sobrescribir, desvincular o corromper el histórico documental.
2. **Arquitectura Serverless Híbrida:** Despliegue cliente estático de alta disponibilidad en **GitHub Pages**, respaldado por sincronización en la nube con **Google Workspace** (Google Sheets, Drive y Apps Script) y enlaces federados a **Microsoft 365** (SharePoint Online / OneDrive).
3. **Resiliencia y Carga Instantánea (*Stale-While-Revalidate*):** La aplicación debe responder inmediatamente al usuario en menos de 50 ms sirviendo datos desde la caché persistente local (`IndexedDB` y `localStorage`), reconciliando las actualizaciones remotas en segundo plano sin bloqueos visuales.
4. **Protección de Datos Personales (Habeas Data):** En cumplimiento de la normativa legal de privacidad, el inicio de sesión cotidiano se efectúa mediante **Correo Corporativo y Contraseña**. El documento de identidad no se expone ni solicita en accesos de rutina, reservándose exclusivamente para registro primario y validación de desbloqueo.
5. **Inmutabilidad y No-Repudio (*Append-Only*):** La auditoría y el control de cambios documentales operan bajo un modelo estrictamente incremental. El retiro de documentos se efectúa mediante *Soft-Delete* trazable; el borrado físico de registros maestros está estrictamente prohibido.

---

## 2. Topología y Arquitectura Serverless Híbrida

La solución integra armónicamente componentes de cliente web, microservicios locales de conversión, microservicios en la nube de Google y almacenamiento colaborativo en Microsoft 365.

### 2.1. Diagrama de Arquitectura del Ecosistema

```mermaid
flowchart TD
    subgraph CLIENTE["Capa Cliente (Navegador Web / SPA)"]
        UI["Interfaz Web SPA (index.html + CSS3)"]
        APP["AppController (app.js)"]
        FILTER["Motor de Filtros NFD (filters.js)"]
        STAFF["Servicio de Personal & RBAC (staff-service.js)"]
        MODAL["Gestor de Modales & Drawer (modal.js)"]
        IDB[("Caché Local Persistente (IndexedDB / localStorage)")]
    end

    subgraph ENTORNO_LOCAL["Servidor Local de Soporte (server.py)"]
        API_LOCAL["API Local REST (/api/*)"]
        COM_WORD["Word COM Automation (win32com)"]
        PDF_CACHE[("pdf_cache/ (PDFs preconvertidos)")]
    end

    subgraph GOOGLE_CLOUD["Google Workspace Cloud Platform"]
        GAS["Google Apps Script (Web App Endpoint)"]
        GSHEET[("Google Sheets (Biblioteca Maestra SGC)")]
        GDRIVE[("Google Drive (usuarios.conf / auditoria.dat)")]
    end

    subgraph MICROSOFT_CLOUD["Microsoft 365 Enterprise"]
        SPO["SharePoint Online (unionsaludvida.sharepoint.com)"]
        OD["OneDrive Corporativo (REPOSITORIO_DOCUMENTAL.csv)"]
    end

    subgraph CI_CD["Automatización & CI/CD"]
        GHA["GitHub Actions (daily-backup.yml)"]
        GHPAGES["GitHub Pages (Alojamiento Web SPA)"]
    end

    %% Relaciones Cliente
    UI <--> APP
    APP <--> FILTER
    APP <--> STAFF
    APP <--> MODAL
    APP <--> IDB

    %% Rutas de datos
    APP -- "1. Consulta Rápida (<50ms)" --> IDB
    APP -- "2. Localhost (/api/*)" --> API_LOCAL
    API_LOCAL --> COM_WORD
    COM_WORD --> PDF_CACHE

    APP -- "3. Nube Serverless (POST JSON)" --> GAS
    GAS --> GSHEET
    GAS --> GDRIVE

    APP -- "4. Enlaces Directos + SSO Navegador" --> SPO
    APP -- "5. Sincronización Catálogo" --> OD

    GHA -- "Respaldo diario 04:00 UTC" --> GAS
    GHA -- "Commit de snapshots" --> GHPAGES
```

### 2.2. Diagrama de Cascada de Prioridad en la Adquisición de Datos

Para asegurar alta disponibilidad tanto en línea como fuera de línea, la adquisición de datos obedece a la siguiente jerarquía determinística:

```mermaid
flowchart TD
    N1["⚡ Nivel 1: Caché en Memoria e IndexedDB
    Latencia: < 50 ms | Carga instantánea e hidratación inmediata"]
    -->|"Verificación asíncrona en segundo plano"| N2["🐍 Nivel 2: API Local Python (server.py:8086)
    Latencia: < 100 ms | Endpoints /api/biblioteca, /api/configuracion"]
    -->|"Si no es localhost o en GitHub Pages"| N3["☁️ Nivel 3: Google Apps Script Web App
    Latencia: 500 - 1,500 ms | Endpoint Cloud con LockService"]
    -->|"Si falla la conectividad Cloud"| N4["📂 Nivel 4: Archivos Estáticos Raíz / Google Drive
    Latencia: 1,000 - 2,500 ms | Descarga directa .csv y .dat"]
    -->|"En contingencia o corte total de red"| N5["💾 Nivel 5: Matrices Nativas en Memoria (data.js)
    Latencia: Inmediata | Catálogo estático mínimo vital en solo lectura"]
```

### 2.3. Matriz de Capas de Persistencia y Tiempos de Respuesta

| Nivel | Componente | Protocolo / API | Latencia | Modo Offline | Criterio de Activación |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **Nivel 1** | `IndexedDB` / `localStorage` | Storage API | `< 50 ms` | **100% Offline** | Todo arranque de la SPA. |
| **Nivel 2** | `server.py` (`:8086`) | HTTP REST (`/api/*`) | `50 - 120 ms` | Parcial (Local) | Si `hostname === 'localhost'`. |
| **Nivel 3** | Apps Script Web App | HTTPS POST / JSON | `600 - 1,800 ms` | Requiere Red | En GitHub Pages con conexión. |
| **Nivel 4** | CSV/DAT Estáticos | Fetch HTTP GET | `800 - 2,500 ms` | Requiere Red | Falla en microservicio Cloud. |
| **Nivel 5** | `data.js` en memoria | ES6 Module | `0 ms (RAM)` | **100% Offline** | Contingencia total sin red ni caché. |

---

## 3. Inventario Canónico de Archivos y Persistencia de Datos

### 3.1. Matriz Canónica de Componentes del Sistema

| Archivo / Componente | Formato | Ubicación | Función Principal | Regla Operativa Clave |
| :--- | :--- | :--- | :--- | :--- |
| `REPOSITORIO_DOCUMENTAL.csv` | CSV (`;`) | Raíz / OneDrive | Enlaces físicos SharePoint | Filtrar carpetas sin extensión |
| `EMPLEADOS_ACTIVOS.csv` | CSV (`,`) | Raíz / Servidor | Matriz 1,305 empleados | Requiere estado `Activo` para ingresar |
| `Historico_Documentos_USV.csv` | CSV (`;`) | Raíz / Drive | Histórico de cambios SGC | Modelo estricto *Append-Only* |
| `usuarios.conf` | JSON | Raíz / Drive | Claves SHA-256 y perfiles | *Deep Merge* atómico con LockService |
| `auditoria.dat` | JSON | Raíz / Drive | Bitácora de telemetría | Excluye búsquedas; deduplicación 5-10s |
| `maestro.dat` | JSON | Raíz / Drive | Metadatos y taxonomía | Alimenta selectores de Tipos y Áreas |
| `google_drive_backup_script.gs`| GAS (V8) | Apps Script | Microservicio Cloud | Bloqueo exclusivo `LockService` (30s) |
| `daily-backup.yml` | GHA YAML | `.github/` | Respaldo 04:00 UTC | Snapshots inmutables en `backups/` |
| `server.py` | Python 3 | Raíz Local | API local y DOCX a PDF | Exclusión mutua `WORD_CONVERT_LOCK` |
| `index.html` | HTML5 | Raíz | Estructura SPA | Versionado estricto `?v=11.6.XX` |
| `styles.css` | CSS3 | Raíz | Diseño visual y temas | Vanilla CSS estricto (sin Tailwind) |
| `js/app.js` | ES6 | `js/` | Controlador principal | Coordinador de eventos e interfaz |
| `js/sharepoint-service.js` | ES6 | `js/` | SharePoint y OneDrive | Descargas y conversión PDF |
| `js/staff-service.js` | ES6 | `js/` | Seguridad y RBAC | Autenticación, bloqueo y auditoría |
| `js/filters.js` | ES6 | `js/` | Motor de búsqueda | Normalización NFD y filtros en cascada |
| `js/modal.js` | ES6 | `js/` | Modales y Drawer | Interacción y formularios |
| `js/analytics.js` | ES6 | `js/` | Dashboard SGC | Indicadores y semaforización |
| `js/cache-service.js` | ES6 | `js/` | IndexedDB Cache | Persistencia local resiliente |
| `js/data.js` | ES6 | `js/` | Respaldo estático | Catálogo de arranque rápido |
| `js/staff-data.js` | ES6 | `js/` | Respaldo estático | Personal de contingencia offline |

---

## 4. Jerarquía Documental: Documentos Base vs. Registros Derivados

### 4.1. Diagrama de Relación Jerárquica Padre-Hijo

```mermaid
graph TD
    subgraph DOC_BASE["Documento Base (Padre)"]
        BASE["Código Canónico: FMT-GIC-016
        Título: Definición de criterios de formación
        Formato Físico: Word (.docx) Editable
        Insignia Visual: DOC (Azul)
        Naturaleza: Plantilla Maestra en Blanco"]
    end

    subgraph DERIVADOS["Registros Derivados (Subregistros / Hijos)"]
        REG1["Código: FMT-GIC-016-1
        ID Canónico: FMT-GIC-016_REG_001
        Título: Formación anticoagulados 2026-1
        Formato Salida: PDF Protegido
        Insignia Visual: PDF (Roja)"]

        REG2["Código: FMT-GIC-016-2
        ID Canónico: FMT-GIC-016_REG_002
        Título: Formación anticoagulados 2026-2
        Formato Salida: PDF Protegido
        Insignia Visual: PDF (Roja)"]

        REG3["Código: FMT-GIC-016-3
        ID Canónico: FMT-GIC-016_REG_003
        Título: Formación Asma y EPOC 2026
        Formato Salida: PDF Protegido
        Insignia Visual: PDF (Roja)"]
    end

    BASE -->|"Contiene arreglo registrosDerivados[]"| REG1
    BASE -->|"Contiene arreglo registrosDerivados[]"| REG2
    BASE -->|"Contiene arreglo registrosDerivados[]"| REG3
```

### 4.2. Matriz Comparativa: Documento Base vs. Registro Derivado

| Criterio | Documento Base (Padre) | Registro Derivado (Hijo) |
| :--- | :--- | :--- |
| **Código** | Sin sufijos secuenciales (`FMT-GIC-016`, `PRC-GMD-001`). | Con sufijo numérico (`-1`, `-2`) o `esRegistro === true`. |
| **Propósito** | Plantilla en blanco o directriz normativa institucional. | Registro diligenciado con información asistencial o clínica. |
| **Descarga (`📥`)** | **Word (.docx)** en formatos FMT; **PDF** en PRC/INS/MN. | **OBLIGATORIAMENTE PDF PROTEGIDO** (salvo `.xlsx`). |
| **Insignia UI** | `DOC` (Azul) en Word; `PDF` (Roja) en normativos; `XLS`. | **Siempre `PDF` (Roja)** o `XLS` si es hoja de cálculo. |
| **Clic en Fila** | Despliega / Oculta el acordeón de subregistros hijos. | Abre Drawer lateral con ficha técnica detallada. |
| **URL de Archivo** | Apunta al archivo maestro en SharePoint Online. | **JAMÁS** hereda URL del padre; requiere archivo propio. |
| **Búsqueda DOM** | Localizado por `doc.codigo`. | Búsqueda dual: `r.id === regId || r.codigo === regId`. |

### 4.3. Reglas de Integridad Estricta y Desvinculación de URLs
- **Vinculación Jerárquica:** Todo subregistro **DEBE** residir dentro del arreglo `base.registrosDerivados[]` de su documento padre.
- **Herencia de Metadatos:** Los registros derivados heredan automáticamente Área, Proceso, Tipo de Proceso y Carpeta de su padre.
- **Desvinculación Estricta de Archivos:** Un subregistro **JAMÁS** debe apuntar a la URL del archivo de su padre. Si no cuenta con archivo propio publicado en OneDrive/SharePoint, se marca como `NO DISPONIBLE`.
- **Identificador Único y Resolución Dual:** Todo subregistro posee una propiedad `id` inmutable (ej. `FMT-GIC-016_REG_002`). Los botones del DOM emiten `data-reg-id="${reg.id || reg.codigo}"` y los controladores resuelven el elemento mediante búsqueda dual: `r.id === regId || r.codigo === regId`.

---

## 5. Gestión de Identidad, Perfiles y Matriz de Acceso (RBAC)

### 5.1. Diagrama de Jerarquía de Perfiles

```mermaid
graph TD
    TOTAL["🛡️ Acceso Total (total / administrador)
    Cédula Maestra: 8160602
    Control Total de Catálogo, Seguridad, Desbloqueo y Auditoría"]
    
    DIR["👑 Directivo (directivo)
    Cargos: Director, Gerente, Subdirector, Subgerente
    Visualiza 100% de documentos, Edición habilitada con Clave"]
    
    ADM["💼 Administrativo (administrativo)
    Cargos: Líderes, Analistas, Coordinadores, Auxiliares no asistenciales
    Visualiza Administrativos y Operativos con permiso explícito"]
    
    OPE["👷 Operativo (operativo)
    Cargos: Médicos, Terapeutas, Enfermeros, Personal asistencial
    Visualiza únicamente Operativos con permiso explícito en Solo Lectura"]

    TOTAL --> DIR
    DIR --> ADM
    ADM --> OPE
```

### 5.2. Diagrama de Flujo de Autenticación y Asignación de Perfil

```mermaid
flowchart TD
    IN(["Colaborador inicia sesión con Correo y Contraseña"]) --> V_EMP{"¿Existe en EMPLEADOS_ACTIVOS.csv con estado 'Activo'?"}
    
    V_EMP -- NO --> DENY_EMP["⛔ ACCESO DENEGADO
    'Colaborador no figura activo en nómina'"]
    
    V_EMP -- SÍ --> V_LOCK{"¿Usuario con Bloqueo Activo?"}
    V_LOCK -- SÍ: Temporal --> ERR_TEMP["⏳ Interfaz bloqueada por 15 min"]
    V_LOCK -- SÍ: Permanente --> ERR_PERM["⛔ Cuenta Bloqueada. Requiere Superadmin"]
    
    V_LOCK -- NO --> V_CONF{"¿Tiene contraseña en usuarios.conf?"}
    
    V_CONF -- NO --> FIRST_TIME["🔑 Primer Acceso
    Validar 4 últimos dígitos de cédula y registrar nueva contraseña"]
    
    V_CONF -- SÍ --> CHECK_PWD{"¿Contraseña SHA-256 coincide?"}
    CHECK_PWD -- NO --> ERR_FAIL["⚠️ Credenciales Incorrectas
    Incrementar contador de intentos fallidos"]
    
    CHECK_PWD -- SÍ --> CHECK_TOTAL{"¿Cédula === 8160602?"}
    CHECK_TOTAL -- SÍ --> ROLE_TOTAL["🛡️ Perfil: TOTAL (Superadministrador)"]
    
    CHECK_TOTAL -- NO --> CHECK_CUSTOM{"¿Tiene perfil especial en usuarios.conf?"}
    CHECK_CUSTOM -- SÍ --> CHECK_DIR_VALID{"¿Perfil 'directivo' pero cargo NO es directivo?"}
    CHECK_DIR_VALID -- "SÍ (Saneamiento)" --> ROLE_ADM["💼 Perfil Reclasificado: ADMINISTRATIVO"]
    CHECK_DIR_VALID -- NO --> ROLE_CUSTOM["Asignar perfil especial configurado"]
    
    CHECK_CUSTOM -- NO --> CHECK_CARGO{"Evaluar cargo oficial en EMPLEADOS_ACTIVOS.csv"}
    CHECK_CARGO -- "Director, Gerente, Subdirector, Subgerente" --> ROLE_DIR["👑 Perfil: DIRECTIVO"]
    CHECK_CARGO -- "Líder, Coordinador, Analista, Calidad, GESIS" --> ROLE_ADM
    CHECK_CARGO -- "Médico, Terapeuta, Enfermero, Auxiliar Clínico" --> ROLE_OPE["👷 Perfil: OPERATIVO"]
```

### 5.3. Matriz de Mapeo de Cargos y Regla de Saneamiento Directivo

| Perfil Resultante | Palabras Clave en Cargo | Regla de Saneamiento y Restricción |
| :---: | :--- | :--- |
| **`total`** | Cédula `8160602` (Superadministrador). | Asignación perpetua e inmutable por código fuente. |
| **`directivo`** | `director`, `directora`, `gerente`, `subdirector`, `subgerente`. | **Exclusividad Estricta:** Si no contiene estas palabras exactas, **se reclasifica a `administrativo`**. |
| **`administrativo`** | `lider`, `analista`, `coordinador`, `gesis`, `calidad`, `financiero`. | Gestión institucional con edición en sus propios procesos. |
| **`operativo`** | `medico`, `enfermero`, `terapeuta`, `auxiliar`, `odontologo`. | Personal asistencial. **Solo lectura estricta.** Sin edición ni dashboard. |

### 5.4. Matriz Exhaustiva de Capacidades por Perfil (RBAC)

| Capacidad / Función del Sistema | Total (`total`) | Directivo (`directivo`) | Administrativo (`administrativo`) | Operativo (`operativo`) |
| :--- | :---: | :---: | :---: | :---: |
| **Visualización en Catálogo** | 100% documentos | 100% documentos | Admin u Oper (`=== true`) | Únicamente Oper (`=== true`) |
| **Descarga Directa (`📥`)** | Habilitada | Habilitada | Habilitada | Habilitada (según matriz) |
| **Descarga Restringida** | Desbloqueable | Desbloqueable | Desbloqueable | **BLOQUEADO (`🔒`)** |
| **Activar Modo Edición** | **Automática** | Requiere Clave | Requiere Clave | **BLOQUEADO** |
| **Editar en SharePoint (`✏️`)** | Habilitada | Habilitada | Habilitada (en su proceso) | **DESHABILITADA** |
| **Abrir Carpeta (`📁`)** | Habilitada | Habilitada | Habilitada | **DESHABILITADA** |
| **Modificar Metadatos (`⚙️`)**| Habilitada | Habilitada | **Deshabilitada** | **DESHABILITADA** |
| **Retirar Doc (`🗑️` Soft-Delete)**| Habilitada | Habilitada | **DESHABILITADA** | **DESHABILITADA** |
| **Crear Documento (`➕`)** | Habilitada | Habilitada | **DESHABILITADA** | **DESHABILITADA** |
| **Dashboard Resumen** | Habilitada | Habilitada | Habilitada | **BLOQUEADA** |
| **Dashboard Calidad y Auditoría**| Habilitada | Habilitada | **OCULTA** | **BLOQUEADA** |
| **Exportar Excel / CSV** | Habilitada | Habilitada | **OCULTA** | **BLOQUEADA** |
| **Desbloquear Cuentas** | Habilitada | **Deshabilitada** | **Deshabilitada** | **Deshabilitada** |

---

## 6. Motor de Salida y Matriz Determinística de Descarga

### 6.1. Árbol de Decisión Determinística de Descarga

```mermaid
flowchart TD
    START(["Clic en Botón Descargar (📥)"]) --> CHECK_EXCEL{"¿El archivo es Excel?
    (.xlsx, .xls, .csv)"}

    CHECK_EXCEL -- SÍ --> OUT_EXCEL["🟩 DESCARGA NATIVA EXCEL
    (tipoAccion: 'NATIVO_EXCEL')
    Conserva fórmulas, macros y datos"]

    CHECK_EXCEL -- NO --> CHECK_REG{"¿Es un Registro Derivado?
    (esRegistro === true o sufijo -\\d+)"}

    CHECK_REG -- SÍ --> OUT_PDF_REG["🟥 CONVERSIÓN A PDF PROTEGIDO
    (Insignia Roja 'PDF')
    Protege información clínica y operativa"]

    CHECK_REG -- NO --> CHECK_FMT{"¿Es Documento Base FMT?
    (Inicia con FMT- y !esRegistro)"}

    CHECK_FMT -- SÍ --> OUT_WORD["🟦 DESCARGA NATIVA WORD (.docx)
    (Insignia Azul 'DOC')
    Plantilla en blanco para diligenciamiento"]

    CHECK_FMT -- NO --> OUT_PDF_DOC["🟥 CONVERSIÓN A PDF PROTEGIDO
    (Insignia Roja 'PDF')
    Normativa SGC: Procedimientos, Manuales, Guías"]
```

### 6.2. Matriz de Prefijos Oficiales y Formatos de Salida

| Prefijo Oficial | Tipo de Documento Institucional | Formato Base (Padre) | Formato Derivado (Hijo) | Justificación de Calidad |
| :---: | :--- | :---: | :---: | :--- |
| **`FMT-` / `FT-`** | Formato / Plantilla Institucional | **Word (.docx)** | **PDF Protegido** | Plantilla editable; registro diligenciado protegido. |
| **`PRC-` / `PR-`** | Procedimiento Institucional | **PDF Protegido** | **PDF Protegido** | Directriz normativa inalterable. |
| **`INS-` / `IN-`** | Instructivo Técnico | **PDF Protegido** | **PDF Protegido** | Instrucción técnica en solo lectura. |
| **`MN-`** | Manual Organizacional | **PDF Protegido** | **PDF Protegido** | Manual de calidad de consulta inmutable. |
| **`POL-` / `PT-`** | Política Corporativa | **PDF Protegido** | **PDF Protegido** | Política institucional vinculante. |
| **`GUA-` / `GU-`**| Guía Operativa / Práctica Clínica | **PDF Protegido** | **PDF Protegido** | Protocolo asistencial de estricto apego clínico. |
| **`PRG-` / `PG-`**| Programa de Gestión / Salud | **PDF Protegido** | **PDF Protegido** | Documento programático institucional. |
| **`DA-` / `DOC-`** | Documento Anexo | **PDF** (o Excel) | **PDF Protegido** | Soporte técnico o normativo complementario. |
| **`XLSX` / `XLS`** | Cualquier hoja de cálculo | **Excel Nativo** | **Excel Nativo** | Conservación de fórmulas, filtros y macros. |

### 6.3. Matriz de Casos Especiales y Manejo de Extensiones

| Caso Especial / Escenario | Comportamiento del Sistema | Acción en Interfaz de Usuario |
| :--- | :--- | :--- |
| **Caso Canónico `FMT-GIC-016`** | Debe descargar su archivo Word `.docx` original en blanco. **Bajo ninguna circunstancia debe abrir la carpeta de SharePoint**. | Botón `📥 Descargar` sirve archivo Word con insignia azul `DOC`. |
| **Subregistros `FMT-GIC-016-1`, `2`, `3`** | Aunque provienen de un formato `FMT`, contienen datos clínicos diligenciados. **Deben descargarse en PDF protegido**. | Botón `📥 Descargar` invoca conversión PDF y muestra insignia roja `PDF`. |
| **Carpetas de SharePoint (Sin Extensión)** | Las rutas correspondientes a carpetas de SharePoint **jamás deben reemplazar a un archivo descargable**. | El servicio excluye las carpetas del motor de descarga y las asigna exclusivamente al botón `📁 Abrir Carpeta`. |
| **Documentos con Descarga Restringida** | El documento se encuentra catalogado pero protegido contra descargas operativas no autorizadas. | Usuario operativo visualiza `🔒 Bloqueado`. Usuarios autorizados pueden desbloquear mediante Modo Edición. |

---

## 7. Experiencia de Usuario (UI/UX), Modos de Operación y Filtros

### 7.1. Diagrama de Estados: Modo Consulta vs. Modo Edición

```mermaid
stateDiagram-v2
    [*] --> ModoConsulta: Inicio de Sesión Exitoso
    
    state ModoConsulta {
        DescargaLibre: Botón 📥 Descargar Habilitado
        EdicionBloqueada: Botones ✏️, 📁, ⚙️, 🗑️ Ocultos
        DrawerSoloLectura: Clic en Fila abre Ficha Técnica en Drawer
    }

    ModoConsulta --> ModoEdicion: Perfil Total (Automático e Inmediato)
    ModoConsulta --> ValidarClave: Perfil Directivo / Administrativo solicita activar
    ModoConsulta --> BloqueoOperativo: Perfil Operativo intenta activar

    state ValidarClave {
        IngresoClave: modalManager.abrirModalPasswordEdicion()
    }
    
    ValidarClave --> ModoEdicion: Contraseña Correcta
    ValidarClave --> ModoConsulta: Contraseña Incorrecta / Cancelar
    
    state BloqueoOperativo {
        ToastError: Rechazo 'Personal Operativo solo lectura'
    }
    BloqueoOperativo --> ModoConsulta

    state ModoEdicion {
        EdicionActiva: Botón 🔓 Modo Edición Resaltado
        SharePointDirecto: Botón ✏️ SharePoint Activo
        CarpetaDirecta: Botón 📁 Abrir Carpeta Activo
        GestionMetadatos: Menú ⚙️ Metadatos y 🗑️ Retiro Lógico
        BotonNuevo: Botón Flotante ➕ Nuevo Documento
    }

    ModoEdicion --> ModoConsulta: Clic en Candado / Cerrar Sesión
```

### 7.2. Diagrama de Flujo de Filtros en Cascada y Búsqueda NFD

```mermaid
flowchart TD
    INPUT(["Usuario interactúa con Filtros o Buscador"]) --> CASC{"¿Es selector de filtro en cascada?"}
    
    CASC -- SÍ --> SEL_TP{"¿Cambio en Tipo de Proceso?"}
    SEL_TP -->|"Filtra"| SEL_AREA["Actualizar Áreas hijas disponibles"]
    SEL_AREA -->|"Filtra"| SEL_PROC["Actualizar Procesos hijos disponibles"]
    SEL_PROC -->|"Filtra"| SEL_TD["Actualizar Tipos de Documento disponibles"]
    
    CASC -- NO --> BUSQ{"¿Texto en buscador global?"}
    BUSQ --> NFD["Normalización NFD:
    Eliminar tildes, diacríticos y pasar a minúsculas"]
    NFD --> EVAL_ROWS["Evaluar cada Documento Base:
    - Código del documento
    - Título del documento
    - Proceso, Área y Tipo
    - Títulos de Registros Derivados asociados"]
    
    SEL_TD --> RBAC_FILTER{"Filtrar por permisos RBAC del usuario activo"}
    EVAL_ROWS --> RBAC_FILTER
    
    RBAC_FILTER --> RENDER["Renderizar tabla dinámica en DOM
    Resaltar coincidencias de registros derivados"]
```

### 7.3. Matriz de Controles de Interfaz según Modo y Perfil

| Elemento de Control | Modo Consulta (`total`) | Modo Consulta (`dir` / `adm`) | Modo Consulta (`operativo`) | Modo Edición Activo (`total` / `dir` / `adm`) |
| :--- | :---: | :---: | :---: | :---: |
| **Botón `📥 Descargar`** | Visible y Activo | Visible y Activo | Visible y Activo | Visible y Activo |
| **Botón `✏️ SharePoint`**| Oculto | Oculto | Oculto | **Visible y Activo** |
| **Botón `📁 Carpeta`** | Oculto | Oculto | Oculto | **Visible y Activo** |
| **Menú `⚙️ Metadatos`** | Oculto | Oculto | Oculto | **Visible** (Solo `total` y `dir`) |
| **Botón `🗑️ Retirar`** | Oculto | Oculto | Oculto | **Visible** (Solo `total` y `dir`) |
| **Botón `➕ Nuevo Doc`** | Oculto | Oculto | Oculto | **Visible** (Solo `total` y `dir`) |
| **Dashboard Analítica**| Visible y Activo | Visible y Activo | **Bloqueada** | Visible y Activo |
| **Gestión de Perfiles** | Visible (Solo `total`)| Oculta | Oculta | Visible (Solo `total`) |

---

## 8. Telemetría, Auditoría Inmutable y Trazabilidad

### 8.1. Diagrama de Ingesta y Filtrado Anti-Flood de Telemetría

```mermaid
flowchart TD
    EVT(["Evento Generado en el Navegador Cliente"]) --> CHECK_TYPE{"¿Es Consulta Pasiva o Búsqueda?"}
    
    CHECK_TYPE -- SÍ: Búsqueda / Navegación --> DISCARD["🚫 DESCARTAR EVENTO
    (Evita sobrecargar auditoria.dat con tráfico irrelevante)"]
    
    CHECK_TYPE -- NO: Evento Transaccional --> FLOOD{"¿Existe evento idéntico en ventana Anti-Flood?
    (5 a 10 segundos según el tipo de acción)"}
    
    FLOOD -- SÍ: Duplicado Rápido --> DEDUP["⏱️ DEDUPLICAR CLIC
    (Ignorar ráfagas accidentales del usuario)"]
    
    FLOOD -- NO: Evento Válido --> QUEUE["📦 ENCOLAR EN INDEXEDDB LOCAL
    Garantiza persistencia aún ante microcortes de red"]
    
    QUEUE --> ASYNC_SEND["🚀 TRANSMISIÓN ASÍNCRONA A GOOGLE APPS SCRIPT
    Payload JSON enviado en segundo plano vía fetch()"]
    
    ASYNC_SEND --> APPEND_AUDIT["🔒 REGISTRO ATÓMICO EN auditoria.dat
    Modelo Append-Only strictly inmutable"]
```

### 8.2. Matriz de Eventos Auditados en `auditoria.dat`

| Evento | Descripción y Atributos Registrados | Ventana Anti-Flood | Criticidad | Justificación de Seguridad |
| :---: | :--- | :---: | :---: | :--- |
| **`LOGIN`** | Identificación, Nombre, Cargo, Perfil, Dispositivo, Timestamp. | 10 s | Alta | Control de acceso y no-repudio. |
| **`DESCARGA`** | Código documental, Título, Extensión y Formato servido. | 5 s | Media | Trazabilidad del consumo documental. |
| **`EDICION`** | Apertura de documento para edición en SharePoint Online. | 5 s | Alta | Identificación del editor de contenidos. |
| **`CARPETA`** | Apertura del directorio de SharePoint desde la SPA. | 5 s | Baja | Auditoría de navegación estructural. |
| **`CREACION`** | Alta de documento base o registro derivado y autor. | Inmediato | **Crítica** | Control de versiones iniciales. |
| **`METADATOS`**| Cambio de versión, vigencia, custodia o retención. | Inmediato | **Crítica** | Integridad de la ficha técnica. |
| **`ELIMINACION`**| Retiro lógico (*Soft-Delete*) con justificación obligatoria. | Inmediato | **Crítica** | Trazabilidad legal del retiro. |
| **`SEGURIDAD`** | Registro, cambio de contraseña o desbloqueo de cuenta. | Inmediato | **Crítica** | Auditoría de identidades y accesos. |

---

## 9. Procesos Asíncronos, Respaldo y Automatización

### 9.1. Diagrama de Secuencia de Respaldo Diario Automatizado (GitHub Actions)

```mermaid
sequenceDiagram
    autonumber
    participant CRON as GitHub Actions (Cron 04:00 UTC)
    participant GAS as Google Apps Script (Web App)
    participant DRIVE as Google Drive / Sheets
    participant REPO as Repositorio GitHub (backups/)

    CRON->>GAS: GET ?action=backup_completo
    activate GAS
    GAS->>GAS: LockService.getScriptLock(30s)
    GAS->>DRIVE: Extraer snapshot completo (Catálogo + Histórico + Usuarios + Auditoría)
    DRIVE-->>GAS: Datos consolidados en memoria
    GAS-->>CRON: Retorna JSON { status: 'success', data: {...}, timestamp: ... }
    deactivate GAS
    
    CRON->>CRON: Validar integridad del payload JSON (tamaño > 10KB y claves válidas)
    
    alt Payload Válido y Completo
        CRON->>REPO: Guardar backups/snapshots/backup_YYYY-MM-DD.json
        CRON->>REPO: Sobrescribir backups/snapshot_latest.json
        CRON->>REPO: Git commit y push a rama principal
    else Error en Respuesta o Payload Vacío
        CRON->>CRON: Abortar proceso (Exit 1) sin tocar repositorio para proteger histórico
    end
```

### 9.2. Diagrama de Concurrencia y Sincronización Cloud con LockService

```mermaid
sequenceDiagram
    autonumber
    participant CLI1 as Cliente A (Actualización Metadatos)
    participant CLI2 as Cliente B (Cambio de Contraseña)
    participant GAS as Google Apps Script Web App
    participant LOCK as LockService (Google Cloud)
    participant DB as Google Sheets / Google Drive

    CLI1->>GAS: POST /exec (actualizar_metadato)
    CLI2->>GAS: POST /exec (guardar_usuario)
    
    GAS->>LOCK: LockService.getScriptLock(30s) [Cliente A]
    activate LOCK
    LOCK-->>GAS: Bloqueo Exclusivo Concedido a Cliente A
    GAS->>DB: Leer estado actual del recurso
    DB-->>GAS: Estado previo
    GAS->>DB: Aplicar modificación atómica (Deep Merge)
    GAS->>LOCK: releaseLock()
    deactivate LOCK
    GAS-->>CLI1: Respuesta: 200 OK { success: true }

    GAS->>LOCK: LockService.getScriptLock(30s) [Cliente B]
    activate LOCK
    LOCK-->>GAS: Bloqueo Exclusivo Concedido a Cliente B
    GAS->>DB: Leer estado fresco actualizado
    DB-->>GAS: Estado fresco
    GAS->>DB: Aplicar modificación atómica (Deep Merge)
    GAS->>LOCK: releaseLock()
    deactivate LOCK
    GAS-->>CLI2: Respuesta: 200 OK { success: true }
```

### 9.3. Matriz de Políticas de Respaldo y Retención

| Componente | Frecuencia | Mecanismo | Destino | Retención |
| :--- | :---: | :--- | :--- | :--- |
| **Snapshot Diario** | Diario (04:00 UTC) | GitHub Actions (`daily-backup.yml`) | Repositorio Git (`backups/snapshots/`) | Perpetua (Git). |
| **Snapshot Último** | Diario (04:00 UTC) | Sobrescritura controlada | `backups/snapshot_latest.json` | Estado más reciente. |
| **Control de Cambios** | En tiempo real | Apps Script Append | `Historico_Documentos_USV.csv` | Historial acumulativo. |
| **Auditoría de Seguridad**| En tiempo real | Apps Script Append | `auditoria.dat` | Bitácora inmutable. |

---

## 10. Políticas Oficiales de Seguridad y Decisiones de Negocio

### 10.1. Arquitectura de Autenticación Local con SSO de Navegador

#### Contexto Histórico y Decisión de Arquitectura
En fases tempranas de diseño se proyectó una integración interactiva mediante la biblioteca `MSAL.js` contra Microsoft Entra ID (Azure AD). Sin embargo, tras analizar las restricciones de licenciamiento, la incompatibilidad operativa en quioscos compartidos y las dificultades de registro de la aplicación en el tenant corporativo, **la Dirección y el Equipo de Desarrollo formalizaron el Modelo de Autenticación Local Oficial**.

#### Directrices Vigentes:
1. **Autoridad de Identidad Local:** La identidad del colaborador se autentica exclusivamente mediante `staff-service.js` validando contra `EMPLEADOS_ACTIVOS.csv` y contraseñas hash SHA-256 en `usuarios.conf`.
2. **Acceso Federado Pasivo (SSO Navegador):** Al hacer clic en enlaces de edición colaborativa (`✏️`) o carpetas (`📁`) de SharePoint Online, la SPA redirige o abre una nueva pestaña en `unionsaludvida.sharepoint.com`, aprovechando la sesión activa de Microsoft 365 que el colaborador ya posee en su navegador web.
3. **Decomisionamiento Permanente:** El artefacto legado `js/auth.js` y cualquier código asociado a la autenticación MSAL/Azure ha sido **oficialmente eliminado y dado de baja** del repositorio.

#### Diagrama 10.1.1: Flujo de Autenticación Local y Acceso Federado M365

```mermaid
sequenceDiagram
    autonumber
    participant USR as Colaborador (Navegador)
    participant APP as AppController (SPA)
    participant STAFF as StaffService (Local)
    participant GAS as Apps Script Cloud
    participant SPO as SharePoint Online / Microsoft 365

    Note over USR,STAFF: FASE 1: Autenticación en Sistema Documental
    USR->>APP: Ingresa Correo Institucional y Contraseña
    APP->>STAFF: autenticarUsuario(email, password)
    STAFF->>STAFF: Validar existencia y estado en EMPLEADOS_ACTIVOS.csv
    STAFF->>STAFF: Validar Hash SHA-256(password) contra usuarios.conf
    
    alt Credenciales Válidas
        STAFF-->>APP: Sesión Aprobada (Perfil RBAC, Nombre, Cargo)
        APP-->>USR: Despliega Catálogo Documental Personalizado
    else Credenciales Incorrectas
        STAFF->>STAFF: Incrementar intentos fallidos (Rate Limiting)
        STAFF-->>APP: Rechazo y advertencia de intentos restantes
    end

    Note over USR,SPO: FASE 2: Consumo y Edición en Microsoft 365
    USR->>APP: Clic en 'Editar en SharePoint' (✏️) o 'Abrir Carpeta' (📁)
    APP->>USR: Abre ventana a URL oficial en unionsaludvida.sharepoint.com
    USR->>SPO: Petición HTTP acompañada de cookies corporativas M365
    SPO-->>USR: Abre documento en Word/Excel Online bajo SSO institucional
```

#### Tabla 10.1.1: Comparativa Modelo Local Oficial vs. Modelo MSAL Deprecado

| Atributo Arquitectónico | Modelo Local Oficial Vigente | Modelo MSAL / Azure (Deprecado) |
| :--- | :--- | :--- |
| **Componente de Software** | `js/staff-service.js` (Modular ES6) | `js/auth.js` (**ELIMINADO**) |
| **Validación de Personal** | Matriz `EMPLEADOS_ACTIVOS.csv` (1,305 empleados). | Tenant de Azure Active Directory / Entra ID. |
| **Almacenamiento Claves** | Hash criptográfico SHA-256 en `usuarios.conf`. | Tokens JWT / OAuth2 administrados por Microsoft. |
| **Dependencia Tenant** | **Ninguna.** Autonomía total del aplicativo. | Crítica. Bloqueado por restricciones de tenant. |
| **Acceso a SharePoint** | Enlace directo federado vía SSO pasivo de navegador. | Redirección interactiva con popups y tokens. |
| **Resiliencia Offline** | Alta (valida credenciales cacheadas localmente). | Nula (falla inmediatamente sin conexión a Azure). |

---

### 10.2. Política de Mínimo Privilegio y Denegación por Defecto (Default Deny)

#### Directriz Oficial:
Si en la hoja de cálculo maestra de Google Sheets las columnas de permisos `Directivo`, `Administrativo` u `Operativo` se encuentran en blanco, con espacios o vacías, la política de seguridad corresponde de forma estricta a **DENEGACIÓN POR DEFECTO (`false`)**.

#### Reglas de Evaluación:
1. **Concesión Explícita Únicamente:** Solo la presencia exacta del caracter `'X'` (o valores afirmativos normalizados `'SI'`, `'TRUE'`, `'1'`) otorga permiso afirmativo (`true`).
2. **Evaluación Booleana Estricta:** Las cláusulas del código deben usar operadores de igualdad estricta (`=== true`). Quedan terminantemente prohibidas cláusulas permisivas como `!== false`.
3. **Visibilidad por Perfil:**
   - **Perfil Directivo:** Visualiza el 100% de los documentos activos.
   - **Perfil Administrativo:** Requiere estrictamente `d.permisoAdministrativo === true || d.permisoOperativo === true`.
   - **Perfil Operativo:** Requiere estrictamente `d.permisoOperativo === true`.

#### Diagrama 10.2.1: Árbol Lógico de Evaluación de Permisos en Hoja de Cálculo

```mermaid
flowchart TD
    CELL["Lectura de Celda en Google Sheets
    (Columnas: Directivo, Administrativo, Operativo)"] --> NORM["Normalización de Cadena:
    trim().toUpperCase()"]
    
    NORM --> CHECK_CHAR{"¿El valor coincide exactamente con:
    'X', 'SI', 'TRUE' o '1'?"}
    
    CHECK_CHAR -- SÍ --> GRANT["✅ PERMISO OTORGADO
    booleano = true"]
    
    CHECK_CHAR -- NO (Vacío, Espacio, Otro) --> DENY["⛔ DENEGACIÓN POR DEFECTO
    booleano = false"]

    GRANT --> EVAL_PROFILE{"Evaluación según Perfil del Usuario Activo"}
    DENY --> EVAL_PROFILE

    EVAL_PROFILE --> P_TOTAL["🛡️ Total: Visualiza 100%"]
    EVAL_PROFILE --> P_DIR["👑 Directivo: Visualiza 100%"]
    EVAL_PROFILE --> P_ADM{"💼 Administrativo:
    ¿permisoAdmin === true || permisoOper === true?"}
    EVAL_PROFILE --> P_OPE{"👷 Operativo:
    ¿permisoOper === true?"}

    P_ADM -- SÍ --> SHOW_ADM["Mostrar en Catálogo"]
    P_ADM -- NO --> HIDE_ADM["Ocultar del Catálogo"]
    
    P_OPE -- SÍ --> SHOW_OPE["Mostrar en Catálogo (Solo Lectura)"]
    P_OPE -- NO --> HIDE_OPE["Ocultar del Catálogo"]
```

#### Tabla 10.2.1: Tabla de Verdad y Visibilidad según Celda y Perfil

| Valor en Celda | Booleano | Perfil Total | Perfil Directivo | Perfil Administrativo | Perfil Operativo |
| :---: | :---: | :---: | :---: | :---: | :---: |
| `'X'` / `'x'` | `true` | Visible | Visible | Visible | Visible (si en col Operativo) |
| `'SI'` / `'si'` | `true` | Visible | Visible | Visible | Visible (si en col Operativo) |
| `[En Blanco]` | **`false`** | Visible | Visible | **Oculto** (si no tiene otra col) | **Oculto** |
| `[Espacios]` | **`false`** | Visible | Visible | **Oculto** | **Oculto** |
| `'NO'` / `'0'` | **`false`** | Visible | Visible | **Oculto** | **Oculto** |
| *Cualquier otro* | **`false`** | Visible | Visible | **Oculto** | **Oculto** |

---

### 10.3. Prohibición de Borrado Físico y Retiro Lógico (Soft-Delete)

#### Directriz Oficial:
El borrado físico de filas en la hoja maestra de Google Sheets está **estrictamente prohibido por políticas de calidad en salud**.

#### Mecanismo de Retiro Lógico (*Soft-Delete*):
- Al retirar un documento base o subregistro, el sistema actualiza su estado a `Eliminado` u `Obsoleto`.
- Se exige de forma obligatoria el ingreso de una **justificación detallada** del retiro.
- El evento se registra en el histórico inmutable (`Historico_Documentos_USV.csv`) y en `auditoria.dat`.
- El parámetro de borrado físico en el código queda permanentemente fijado en `borradoFisico: false`.

#### Diagrama 10.3.1: Ciclo de Vida Documental y Retiro Lógico

```mermaid
stateDiagram-v2
    [*] --> Activo: Creación de Documento
    
    state Activo {
        VisibleEnCatalogo: Visible para usuarios según RBAC
        DisponibleDescarga: Enlaces de Descarga y Edición Operativos
    }
    
    Activo --> RetiroSolicitado: Usuario Directivo pulsa 🗑️ Retirar
    
    state RetiroSolicitado {
        Justificacion: Ingreso OBLIGATORIO de justificación técnica
        ProhibicionPurga: Borrado Físico BLOQUEADO (borradoFisico = false)
    }

    RetiroSolicitado --> RetiroLogico: Confirmación en el modal
    RetiroSolicitado --> Activo: Cancelación de la acción

    state RetiroLogico {
        EstadoActualizado: Estado cambia a 'Eliminado' u 'Obsoleto'
        ExclusionCatalogo: Se oculta de las vistas operativas
        AuditoriaInmutable: Registro en Historico_Documentos y auditoria.dat
    }

    RetiroLogico --> [*]: Registro preservado permanentemente en base de datos
```

#### Tabla 10.3.1: Matriz Diferencial: Retiro Lógico vs. Borrado Físico Prohibido

| Criterio Técnico / Legal | Retiro Lógico (*Soft-Delete* - Vigente) | Borrado Físico (*Purga* - Prohibido) |
| :--- | :--- | :--- |
| **Acción en Sheets** | Actualiza columna `Estado` a `Eliminado` u `Obsoleto`. | Elimina físicamente la fila (`deleteRow`). |
| **Historial SGC** | **100% Preservado.** Trazabilidad completa garantizada. | Destruye el registro y rompe la auditoría. |
| **Normativa Salud** | Conforme con el Sistema de Calidad en Salud. | **No conforme.** Incumple entes de control. |
| **Justificación** | Exigida obligatoriamente en modal antes de procesar. | No aplicable (eliminación sin rastro). |
| **Recuperabilidad** | Reversible reactivando el estado por administrador. | Irreversible sin restauración compleja de backups. |
| **Control en Código** | Parámetro `borradoFisico = false` forzado en `modal.js`. | Checkbox de purga física **eliminado de la UI**. |

---

### 10.4. Tasa Límite (Rate Limiting) y Bloqueo Escalonado

#### Directriz Oficial:
Para salvaguardar la integridad de las cuentas y prevenir ataques de fuerza bruta o suplantación de identidad:
- **Nivel 1 (Bloqueo Temporal de Interfaz):** Tras **3 intentos fallidos consecutivos** de ingreso o cambio de contraseña, la interfaz se bloquea temporalmente por **15 minutos**.
- **Nivel 2 (Bloqueo Permanente de Cuenta):** Si un mismo usuario acumula **3 bloqueos temporales consecutivos**, su cuenta pasa a estado de **Bloqueo Permanente**.
- **Nivel 3 (Desbloqueo Exclusivo de Superadministrador):** La única persona facultada para desbloquear una cuenta bloqueada de forma permanente es el usuario con perfil **Acceso Total (Cédula 8160602)** desde el módulo de personal.

#### Diagrama 10.4.1: Flujo de Bloqueo Escalonado por Intentos Fallidos

```mermaid
flowchart TD
    START(["Intento de Inicio de Sesión o Cambio de Clave"]) --> CHECK_LOCKED{"¿Usuario presenta bloqueo activo?"}

    CHECK_LOCKED -- SÍ: Bloqueo Permanente --> ERR_PERM["⛔ CUENTA BLOQUEADA PERMANENTEMENTE
    Requiere desbloqueo manual por Superadministrador (Cédula 8160602)"]

    CHECK_LOCKED -- SÍ: Bloqueo Temporal --> ERR_TEMP["⏳ INTERFAZ BLOQUEADA TEMPORALMENTE
    Esperar transcurso de los 15 minutos programados"]

    CHECK_LOCKED -- NO --> VALIDAR{"¿Credenciales Correctas?"}

    VALIDAR -- SÍ --> RESET["✅ ACCESO EXITOSO
    Resetear contador de fallos y bloqueos acumulados"]
    
    VALIDAR -- NO --> INCR_FAIL["Incrementar intentosFallidos++"]
    
    INCR_FAIL --> COUNT_FAIL{"¿intentosFallidos >= 3?"}
    
    COUNT_FAIL -- NO --> WARN_FAIL["⚠️ Credenciales Incorrectas
    Mostrar intentos restantes (3 - n) al usuario"]
    
    COUNT_FAIL -- SÍ --> INCR_CYCLE["bloqueosConsecutivos++
    intentosFallidos = 0"]

    INCR_CYCLE --> COUNT_CYCLE{"¿bloqueosConsecutivos >= 3?"}

    COUNT_CYCLE -- NO --> SET_TEMP["⏳ ACTIVAR BLOQUEO TEMPORAL
    bloqueadoHasta = Ahora + 15 minutos
    Deshabilitar inputs y botones en interfaz"]

    COUNT_CYCLE -- SÍ --> SET_PERM["⛔ ACTIVAR BLOQUEO PERMANENTE
    cuentaBloqueada = true
    Solo Superadministrador puede desbloquear"]

    SET_PERM --> UNLOCK_ADMIN{"Superadministrador pulsa '🔓 Desbloquear' en Perfiles"}
    UNLOCK_ADMIN --> RESET
```

#### Tabla 10.4.1: Matriz de Estados de Seguridad y Reglas de Desbloqueo

| Estado de Seguridad | Condición de Disparo | Impacto en Interfaz | Duración | Procedimiento de Desbloqueo |
| :---: | :--- | :--- | :---: | :--- |
| **Normal (Activo)** | 0 a 2 fallos. | Interfaz totalmente funcional. | Indefinida. | No requerido. Acceso normal. |
| **Bloqueo Nivel 1** | 3 fallos consecutivos. | Banner advertencia; inputs deshabilitados. | **15 min** | Automático al expirar el tiempo. |
| **Bloqueo Nivel 2** | 3 fallos tras cumplir nivel 1. | Banner advertencia; inputs deshabilitados. | **15 min** | Automático al expirar el tiempo. |
| **Bloqueo Permanente** | Acumulación de **3 bloqueos**. | Acceso denegado; badge `🔒 Bloqueado`. | **Perpetuo** | **Solo Superadministrador (8160602)**. |

---

## 11. Decálogo de Gobernanza para Desarrolladores

### 11.1. Tabla Maestra de Mandamientos Técnicos y Sanción por Violación

| # | Mandamiento Técnico | Justificación Técnica | Módulos Afectados | Sanción por Incumplimiento |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **FORMATO SUBREGISTROS:** Ningún derivado en Word. Todos en PDF protegido (salvo `.xlsx`). | Protección de datos clínicos diligenciados. | `sharepoint-service`, `modal` | Sanción de Calidad: Fuga de datos editables. |
| **2** | **CANÓNICO FMT-GIC-016:** Documento base descarga `.docx` en blanco. Jamás abre carpeta. | Plantilla maestra para diligenciamiento. | `sharepoint-service`, `app` | Error UX: Apertura indebida de carpeta. |
| **3** | **RESTRICCIÓN OPERATIVO:** Perfil Operativo jamás accede a botones de edición ni Dashboard. | Mínimo Privilegio y segregación de funciones. | `modal.js`, `analytics.js` | Brecha Seguridad: Alteración no autorizada. |
| **4** | **HASH DE CONTRASEÑAS:** Toda contraseña en `usuarios.conf` se hashea con SHA-256. | Protección criptográfica de credenciales. | `staff-service.js`, GAS | Brecha Crítica: Compromiso de contraseñas. |
| **5** | **BLOQUEO COM WORD:** `server.py` mantiene exclusión mutua `WORD_CONVERT_LOCK`. | Word COM no es thread-safe en Windows. | `server.py` | Fallo de Sistema: Cuelgue de `WINWORD.EXE`. |
| **6** | **DEFAULT DENY EN SHEETS:** Celdas vacías = `false`. Solo `'X'` otorga permiso explícito. | Mínimo Privilegio. Evita fuga de documentos. | `filters.js`, Apps Script | Brecha Privacidad: Acceso no autorizado. |
| **7** | **PROHIBICIÓN BORRADO FÍSICO:** Prohibida purga de filas. Todo retiro es *Soft-Delete*. | Inmutabilidad y trazabilidad legal SGC. | `modal.js`, Apps Script | Violación Legal: Pérdida de histórico. |
| **8** | **TASA LÍMITE Y BLOQUEO:** 3 fallos = 15 min; 3 bloqueos = permanente; desbloqueo Superadmin. | Prevención de ataques de fuerza bruta. | `staff-service.js`, `modal` | Vulnerabilidad: Exposición de cuentas. |
| **9** | **AUTENTICACIÓN LOCAL:** Modelo Local Oficial con SSO de navegador. `auth.js` eliminado. | Autonomía técnica ante bloqueos de Azure. | `staff-service.js`, `index` | Inestabilidad: Errores de token en Azure. |
| **10**| **RESOLUCIÓN DUAL:** Registros derivados se resuelven por `r.id === id \|\| r.codigo === id`. | Consistencia en el DOM ante nombres dispares. | `app.js`, `modal.js` | Error Funcional: Drawer/botones no responden. |

### 11.2. Resumen Nemotécnico para el Desarrollador

```
================================================================================
           DECÁLOGO DE GOBERNANZA TÉCNICA Y ARQUITECTÓNICA (SSOT)
================================================================================
1. FORMATO DE SUBREGISTROS:
   NINGÚN registro derivado debe descargarse en Word.
   TODOS los registros derivados deben descargarse en PDF protegido (insignia roja PDF),
   a menos que sean hojas de cálculo (.xlsx).

2. CASO CANÓNICO FMT-GIC-016:
   El documento base FMT-GIC-016 DEBE descargar su archivo .docx original.
   NO DEBE abrir la carpeta de SharePoint.

3. RESTRICCIÓN OPERATIVA:
   El perfil Operativo JAMÁS debe tener acceso a botones de edición ni al Dashboard.

4. CRIPTOGRAFÍA DE CONTRASEÑAS:
   Las contraseñas en usuarios.conf SIEMPRE se hashean en SHA-256 antes de guardarse.

5. BLOQUEO COM EN CONVERSIÓN:
   El servidor local server.py debe mantener activo el bloqueo WORD_CONVERT_LOCK
   en toda conversión para garantizar estabilidad en Windows.

6. PERMISOS EN GOOGLE SHEETS (DEFAULT DENY):
   Columnas en blanco en Directivo, Administrativo u Operativo = DENEGACIÓN POR DEFECTO.
   Únicamente la presencia explícita de 'X' concede permiso de visualización o edición.

7. PROHIBICIÓN DE BORRADO FÍSICO (SOFT-DELETE):
   Queda estrictamente PROHIBIDO el borrado físico de filas en Google Sheets.
   Todo retiro debe ser un retiro lógico (Soft-Delete) a 'Eliminado' u 'Obsoleto'.

8. TASA LÍMITE Y BLOQUEO ESCALONADO:
   3 intentos fallidos = 15 minutos de bloqueo temporal.
   3 bloqueos temporales consecutivos = Bloqueo permanente de cuenta.
   Desbloqueo condicionado exclusivamente a Superadministradores (Acceso Total).

9. ARQUITECTURA DE AUTENTICACIÓN OFICIAL:
   Modelo Local Oficial (staff-service.js contra EMPLEADOS_ACTIVOS.csv y usuarios.conf)
   con SSO federado por navegador hacia SharePoint. El componente legado auth.js
   queda formalmente dado de baja y eliminado.

10. RESOLUCIÓN DUAL DE SUBREGISTROS:
    Todo registro derivado DEBE tener un ID canónico y resolverse mediante búsqueda
    dual (r.id === regId || r.codigo === regId) para garantizar funcionalidad en el DOM.
================================================================================
```
