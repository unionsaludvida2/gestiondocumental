# 🏥 Sistema de Gestión Documental Institucional - Unión para la salud y la vida S.A.S.

Aplicación web moderna, responsiva y de alto rendimiento diseñada para la administración, consulta y trazabilidad de documentos institucionales del Sistema de Garantía de Calidad en Salud.

Publicada como Single Page Application (SPA) en **GitHub Pages** e incrustada mediante un contenedor `<iframe>` dentro del portal corporativo de **SharePoint Online (Microsoft 365)**, operando bajo un modelo de sincronización en la nube con **Google Workspace** y enlaces federados a **SharePoint / OneDrive**.

---

## 📌 Enlace de Despliegue e Integración en SharePoint

### Código de Incrustación Oficial (Iframe)
```html
<iframe title="Gestión documental" style="width: 100%; height: 100%; border: none;" src="https://unionsaludvida2.github.io/gestiondocumental/" allow="clipboard-write; clipboard-read" allowfullscreen=""></iframe>
```

### Directriz de Diseño Responsivo sin Barras Horizontales
La interfaz está optimizada para adaptarse dinámicamente a pantallas de cualquier resolución, ventanas compactas o al contenedor del iframe en SharePoint:
- **Cero barras de desplazamiento horizontal (`overflow-x: hidden`):** Se evita cualquier scroll lateral que afecte la experiencia dentro del iframe.
- **Redimensionamiento adaptativo:** Fuentes, iconos, botones y contenedores escalan según el ancho disponible.
- **Ocultamiento progresivo de metadatos:** En pantallas estrechas o móviles, las columnas complementarias (fecha de modificación, área, proceso) se contraen o pliegan, preservando siempre la visualización limpia de *Código*, *Nombre del Documento*, *Descargas* y *Acciones*.

---

## 🌟 Perfiles de Usuario y Modos de Operación

### 1. Perfil Operativo (`Usuario Operativo` - Carga Automática por Defecto)
Al abrir la página de SharePoint, el sistema se inicializa de forma inmediata y automática bajo el perfil operativo:
- **Acceso habilitado:** Consulta y búsqueda multifacética en el catálogo completo de documentos vigentes.
- **Restricciones estrictas:** Edición de metadatos deshabilitada, bloqueo de eliminación/creación de documentos, sin acceso al Dashboard de Calidad ni al panel de configuraciones.
- **Caché local ultrarrápida:** Durante la primera carga, se importan a la caché local del navegador (IndexedDB y localStorage) la biblioteca de documentos y archivos de soporte. Esta caché se actualiza automáticamente cuando se detectan cambios en la nube.
- **Contador de Descargas en Hoja de Cálculo:** Al descargar un documento, el sistema envía una mutación inmediata hacia la hoja **`Biblioteca_Documental`** en Google Sheets, incrementando el valor de la columna **Descargas (Columna Y / celda 25)** en $+1$. *Nota: Las descargas no corresponden a modificaciones de contenido, por lo que no alteran la fecha de modificación*.
- **Favoritos Operativos:** Los documentos marcados como favoritos (⭐) por un usuario operativo se almacenan únicamente en la memoria caché local de su navegador.

### 2. Perfil Administrativo (Acceso Completo vía Candado 🔒)
Al pulsar el icono de candado en la cabecera, se abre el modal de autenticación administrativa:
- **Validación segura:** Valida la contraseña mediante hash criptográfico SHA-256 verificado contra el archivo **`usuarios.conf`** almacenado en Google Drive.
- **Sesión Activa Persistente en Caché:** Una vez el usuario inicia sesión como administrador, la credencial queda activa de forma permanente en la memoria caché del navegador. No se solicita reautenticación en visitas futuras, excepto si el usuario es revocado del grupo de administradores por otro administrador.
- **Privilegios Totales:** Habilitación de la edición de metadatos en línea, creación y retiro de documentos base y registros derivados, acceso al Dashboard Analítico (Resumen, Calidad, Control de Cambios), exportación de listados maestros, conmutador de vistas (Catálogo / Tarjetas), alta/baja de otros administradores y edición de tablas maestras (**`maestro.dat`**).
- **Favoritos Administrativos:** Se sincronizan y persisten centralizadamente en Google Drive en el archivo **`usuarios.conf`**.

---

## 📂 Arquitectura de Sincronización y Persistencia Cloud

El sistema opera bajo una arquitectura híbrida serverless que garantiza integridad absoluta y cero pérdida de datos:

| Archivo / Repositorio | Plataforma | Función y Gobernanza |
| :--- | :--- | :--- |
| **`Biblioteca_Documental`** | Google Sheets | **Fuente Única de Verdad (SSOT)**. Hoja de cálculo de 25 columnas que almacena los registros únicos de los documentos, códigos, nombres, categorías, vigencias, enlaces directos, fechas de creación/modificación y el conteo acumulado de descargas. |
| **`Historico_Documentos`** | Google Sheets | Registro inmutable de auditoría y movimientos. Registra cada creación, modificación y retiro de documentos con fecha, autor y detalle del cambio. |
| **`usuarios.conf`** | Google Drive | Almacén seguro para usuarios administrativos. Guarda hashes SHA-256 de contraseñas, opciones personalizadas de configuración y favoritos de administradores. |
| **`maestro.dat`** | Google Drive | Estructura oficial de tablas maestras (Tipos de Proceso, Áreas Institucionales, Procesos y Tipos de Documento). |
| **Archivos Deprecados / Eliminados** | — | `Historico_Documentos_USV.csv` y `auditoria.dat` fueron dados de baja definitivamente y retirados de la aplicación. |

---

## 🔥 Sección Destacada: Top 50 Más Descargados

- **Criterio Oficial:** Se basa de manera determinística en el valor registrado en la columna `Descargas` (columna Y) de la hoja de cálculo **`Biblioteca_Documental`**.
- **Visualización:** Al hacer clic en el botón **🔥 Top 50** del menú lateral, el catálogo filtra y presenta ordenados de mayor a menor número de descargas los 50 documentos más consultados institucionalmente.
- **Insignias de Rango:** Se destacan los primeros puestos con medallas visuales (🥇 #1, 🥈 #2, 🥉 #3) e insignias de posición (#4 a #50) acompañadas del badge que indica la cantidad exacta de descargas registradas en la hoja.

---

## 🔄 Flujo Automatizado de Cruce y Sincronización (GitHub Actions)

El flujo de trabajo en GitHub Actions:
1. Compara automáticamente el repositorio de archivos de OneDrive/SharePoint con los registros de la hoja de cálculo **`Biblioteca_Documental`**.
2. Detecta variaciones o nuevos vínculos directos generados en la nube.
3. Actualiza de manera atómica las columnas correspondientes en `Biblioteca_Documental`.
4. Reporta el cambio de vínculos de forma inmutable en la hoja **`Historico_Documentos`**.
*(El workflow de backup diario antiguo fue eliminado, consolidando toda la lógica en este flujo unificado de actualización).*

---

## 🚀 Ejecución Local

Para desarrollo o depuración local:
```bash
python server.py 8080
```
Luego abrir en el navegador: [http://localhost:8080](http://localhost:8080)
*(La aplicación se conecta en tiempo real al proxy `/api/biblioteca` y `/api/repositorio`, reflejando exactamente el comportamiento de producción).*
