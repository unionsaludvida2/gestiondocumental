/**
 * Módulo de Analítica y Dashboard
 * Unión para la salud y la vida S.A.S.
 * 
 * Calcula métricas, KPIs, semáforo de vigencia documental, distribuciones,
 * exportación del Listado Maestro y Auditoría de Actividad en pestañas separadas.
 */

import { staffService } from './staff-service.js?v=11.6.62';

export class AnalyticsManager {

  /**
   * Evalúa la vigencia y semaforización de un documento
   */
  evaluarVigenciaDoc(doc) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let fAprob = null;
    let fVenc = null;

    // 1. Extraer o parsear fecha de aprobación / vigencia (soporta ISO, DD/MM/YYYY, etc.)
    const msAprob = staffService.parsearFechaMilisegundos(doc.fechaAprobacion || doc.vigencia || doc.modificacion);
    if (msAprob > 0) {
      fAprob = new Date(msAprob);
    }

    // 2. Extraer o calcular fecha de vencimiento normativo
    const msVenc = staffService.parsearFechaMilisegundos(doc.fechaVencimiento);
    if (msVenc > 0) {
      fVenc = new Date(msVenc);
    } else if (fAprob && !isNaN(fAprob.getTime())) {
      fVenc = new Date(fAprob.getFullYear() + 5, fAprob.getMonth(), fAprob.getDate());
    } else {
      fVenc = new Date(2031, 7, 1);
    }

    const estadoDoc = (doc.estado || doc.estadoDocumento || 'Activo').trim();
    if (estadoDoc.toLowerCase() === 'en revisión' || estadoDoc.toLowerCase() === 'en revision') {
      return {
        estadoSemaforo: 'REVISION',
        badgeClass: 'semaforo-badge-revision',
        color: '#0284c7',
        bg: '#f0f9ff',
        border: '#bae6fd',
        icono: '🔵',
        etiqueta: 'En Revisión',
        diasRestantes: 9999,
        fechaAprobacionStr: strAprob || 'N/A',
        fechaVencimientoStr: strVenc || (fVenc ? `${String(fVenc.getDate()).padStart(2, '0')}/${String(fVenc.getMonth() + 1).padStart(2, '0')}/${fVenc.getFullYear()}` : 'N/A')
      };
    }

    if (!fVenc || isNaN(fVenc.getTime())) {
      return {
        estadoSemaforo: 'VIGENTE',
        badgeClass: 'semaforo-badge-vigente',
        color: '#15803d',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        icono: '🟢',
        etiqueta: 'Vigente (> 1 año)',
        diasRestantes: 1825,
        fechaAprobacionStr: strAprob || '01/08/2026',
        fechaVencimientoStr: '01/08/2031'
      };
    }

    const diffMs = fVenc.getTime() - hoy.getTime();
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const fechaVencStr = `${String(fVenc.getDate()).padStart(2, '0')}/${String(fVenc.getMonth() + 1).padStart(2, '0')}/${fVenc.getFullYear()}`;
    const fechaAprobStr = fAprob && !isNaN(fAprob.getTime()) ? `${String(fAprob.getDate()).padStart(2, '0')}/${String(fAprob.getMonth() + 1).padStart(2, '0')}/${fAprob.getFullYear()}` : (strAprob || '01/08/2026');

    if (diffDias < 0) {
      const diasAtras = Math.abs(diffDias);
      return {
        estadoSemaforo: 'VENCIDO',
        badgeClass: 'semaforo-badge-vencido',
        color: '#dc2626',
        bg: '#fef2f2',
        border: '#fecaca',
        icono: '🔴',
        etiqueta: `Vencido (${diasAtras} d)`,
        diasRestantes: diffDias,
        fechaAprobacionStr: fechaAprobStr,
        fechaVencimientoStr: fechaVencStr
      };
    } else if (diffDias <= 365) {
      const meses = Math.ceil(diffDias / 30);
      return {
        estadoSemaforo: 'PROXIMO',
        badgeClass: 'semaforo-badge-proximo',
        color: '#b45309',
        bg: '#fffbeb',
        border: '#fde68a',
        icono: '🟡',
        etiqueta: `Vence en ${meses} m`,
        diasRestantes: diffDias,
        fechaAprobacionStr: fechaAprobStr,
        fechaVencimientoStr: fechaVencStr
      };
    } else {
      const anios = (diffDias / 365.25).toFixed(1);
      return {
        estadoSemaforo: 'VIGENTE',
        badgeClass: 'semaforo-badge-vigente',
        color: '#15803d',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        icono: '🟢',
        etiqueta: `Vigente (${anios} a)`,
        diasRestantes: diffDias,
        fechaAprobacionStr: fechaAprobStr,
        fechaVencimientoStr: fechaVencStr
      };
    }
  }

  constructor() {
    this.container = null;
    this.onSelectFiltro = null;
        this.filtroAuditoriaActual = 'TODOS';
    this.filtroCalidadSemaforo = 'TODOS';
    this.filtroCalidadMacroproceso = 'TODOS';
    this.filtroCalidadArea = 'TODOS';
    this.filtroCalidadProceso = 'TODOS';
    this.filtroCalidadTipoDoc = 'TODOS';
    this.busquedaCalidad = '';
    this.pestanaActiva = 'resumen'; // 'resumen' | 'calidad' | 'auditoria' | 'cambios'
  }

  init(containerId, onSelectFiltroCallback) {
    this.container = document.getElementById(containerId);
    this.onSelectFiltro = onSelectFiltroCallback;
  }

  /**
   * Procesa los documentos y retorna las métricas calculadas
   */
  calcularMetricas(documentos) {
    const total = documentos.length;
    if (total === 0) {
      return {
        total: 0,
        disponibles: 0,
        noDisponibles: 0,
        porcentajeDisponibilidad: 0,
        porTipoProceso: {},
        porArea: {},
        porProceso: {},
        porTipo: {},
        porExtension: {},
        semaforoVigencia: { vigentes: 0, revision: 0, desactualizados: 0, sinFecha: 0 }
      };
    }

    let disponibles = 0;
    const porTipoProceso = {};
    const porArea = {};
    const porProceso = {};
    const porTipo = {};
    const porExtension = {};
    const semaforo = { vigentes: 0, revision: 0, desactualizados: 0, sinFecha: 0 };

    const hoy = new Date();

    documentos.forEach((doc) => {
      if (doc.disponible) disponibles++;

      // Agrupación por Tipo de Proceso (Macroproceso)
      const tipoProc = (doc.tipoProceso && doc.tipoProceso !== 'N/A' && doc.tipoProceso.trim()) ? doc.tipoProceso.trim() : (doc.macroproceso || 'Misional');
      porTipoProceso[tipoProc] = (porTipoProceso[tipoProc] || 0) + 1;

      // Agrupación por Área
      const area = (doc.area && doc.area !== 'N/A' && doc.area.trim()) ? doc.area.trim() : (doc.departamento || 'Gestión Integral Calidad');
      porArea[area] = (porArea[area] || 0) + 1;

      // Agrupación por Proceso
      const proceso = (doc.proceso && doc.proceso !== 'N/A' && doc.proceso.trim()) ? doc.proceso.trim() : (doc.carpeta || 'General');
      porProceso[proceso] = (porProceso[proceso] || 0) + 1;

      // Agrupación por Tipo de Documento
      const tipo = (doc.tipoDocumento && doc.tipoDocumento !== 'N/A' && doc.tipoDocumento.trim()) ? doc.tipoDocumento.trim() : 'Documento Anexo';
      porTipo[tipo] = (porTipo[tipo] || 0) + 1;

      // Agrupación por Extensión
      const ext = (doc.extension || 'OTRO').toUpperCase();
      porExtension[ext] = (porExtension[ext] || 0) + 1;

      // Cálculo del semáforo de vigencia por fecha de modificación (soporta ISO y formatos estándar)
      const msMod = staffService.parsearFechaMilisegundos(doc.modificacion);
      if (msMod > 0) {
        const diffDias = Math.floor((hoy.getTime() - msMod) / (1000 * 60 * 60 * 24));
        if (diffDias < 365) {
          semaforo.vigentes++;
        } else if (diffDias < 730) {
          semaforo.revision++;
        } else {
          semaforo.desactualizados++;
        }
      } else {
        semaforo.desactualizados++;
      }
    });

    return {
      total,
      disponibles,
      noDisponibles: total - disponibles,
      porcentajeDisponibilidad: Math.round((disponibles / total) * 100),
      porTipoProceso,
      porArea,
      porProceso,
      porTipo,
      porExtension,
      semaforoVigencia: semaforo
    };
  }

  /**
   * Genera y descarga el Listado Maestro de Documentos en CSV compatible con Excel
   */
  descargarListadoMaestro(documentos) {
    if (!documentos || documentos.length === 0) {
      alert('No hay documentos disponibles para exportar.');
      return;
    }

    const headers = [
      'Código',
      'Título del Documento',
      'Formato',
      'Versión Vigente',
      'Tipo de Cambio / Emisión',
      'Fecha de Última Modificación',
      'Tipo de Documento',
      'Área Responsable',
      'Macroproceso (Tipo de Proceso)',
      'Proceso',
      'Estado',
      'Disponibilidad',
      'Descargable',
      'Tiempo de Vigencia / Retención',
      'Permiso Operativo',
      'Permiso Administrativo',
      'Permiso Directivo',
      'Ruta / Enlace SharePoint'
    ];

    const rows = documentos.map((d) => [
      `"${d.codigo || ''}"`,
      `"${(d.titulo || '').replace(/"/g, '""')}"`,
      `"${d.extension || ''}"`,
      `"${d.version || '01'}"`,
      `"${(d.tipoCambio || 'Creación del documento').replace(/"/g, '""')}"`,
      `"${d.modificacion || ''}"`,
      `"${(d.tipoDocumento || '').replace(/"/g, '""')}"`,
      `"${(d.area || '').replace(/"/g, '""')}"`,
      `"${(d.tipoProceso || '').replace(/"/g, '""')}"`,
      `"${(d.proceso || '').replace(/"/g, '""')}"`,
      `"${d.estado || 'Activo'}"`,
      `"${d.disponible ? 'Disponible' : 'No Disponible'}"`,
      `"${d.descargable !== false ? 'SI' : 'NO'}"`,
      `"${d.tiempoVigencia || '5 Años'}"`,
      `"${d.permisoOperativo ? 'SI' : 'NO'}"`,
      `"${d.permisoAdministrativo ? 'SI' : 'NO'}"`,
      `"${d.permisoDirectivo ? 'SI' : 'NO'}"`,
      `"${(d.sharepointUrl || d.downloadUrl || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Listado_Maestro_Documentos_USV_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Genera y descarga el reporte específico de documentos vencidos o pendientes por actualizar (> 2 años o sin fecha)
   */
  descargarDocumentosVencidos(documentos) {
    if (!documentos || documentos.length === 0) {
      alert('No hay documentos disponibles para exportar.');
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencidos = [];

    documentos.forEach((doc) => {
      // 1. Verificar disponibilidad técnica
      const esDisponible = Boolean(doc.disponible && doc.disponible !== 'false');
      if (!esDisponible) {
        vencidos.push({
          doc,
          diagnostico: 'Documento No Disponible / Pendiente de Publicación'
        });
        return;
      }

      // 2. Verificar vencimiento normativo formal (evaluarVigenciaDoc)
      const vig = this.evaluarVigenciaDoc(doc);
      if (vig && vig.estadoSemaforo === 'VENCIDO') {
        const diasAtras = Math.abs(vig.diasRestantes || 0);
        vencidos.push({
          doc,
          diagnostico: `Documento Vencido Normativamente (Vencido hace ${diasAtras} días - ${vig.fechaVencimientoStr})`
        });
        return;
      }

      // 3. Verificar si no posee fecha de modificación registrada
      const msMod = staffService.parsearFechaMilisegundos(doc.modificacion);
      if (!msMod || msMod <= 0) {
        vencidos.push({
          doc,
          diagnostico: 'Sin registro de fecha de modificación'
        });
        return;
      }

      // 4. Verificar obsolescencia (> 2 años sin actualización / 730 días)
      const diffDias = Math.floor((hoy.getTime() - msMod) / (1000 * 60 * 60 * 24));
      if (diffDias >= 730) {
        const aniosSinAct = (diffDias / 365.25).toFixed(1);
        vencidos.push({
          doc,
          diagnostico: `Mayor a 2 años sin actualización (${aniosSinAct} años - Revisión Urgente)`
        });
        return;
      }
    });

    if (vencidos.length === 0) {
      alert('¡Excelente noticia! No se registran documentos vencidos o no disponibles en el catálogo.');
      return;
    }

    const headers = [
      'Código',
      'Título del Documento',
      'Formato',
      'Versión Vigente',
      'Tipo de Documento',
      'Área Responsable',
      'Proceso',
      'Macroproceso',
      'Estado SGC',
      'Disponibilidad',
      'Fecha de Última Modificación',
      'Diagnóstico de Calidad',
      'Ruta SharePoint'
    ];

    const rows = vencidos.map((item) => {
      const d = item.doc;
      const diagnostico = item.diagnostico;
      const dispTexto = (d.disponible && d.disponible !== 'false') ? 'Disponible' : 'No Disponible';
      return [
        `"${d.codigo || ''}"`,
        `"${(d.titulo || '').replace(/"/g, '""')}"`,
        `"${d.extension || ''}"`,
        `"${d.version || '01'}"`,
        `"${(d.tipoDocumento || '').replace(/"/g, '""')}"`,
        `"${(d.area || '').replace(/"/g, '""')}"`,
        `"${(d.proceso || '').replace(/"/g, '""')}"`,
        `"${(d.tipoProceso || '').replace(/"/g, '""')}"`,
        `"${d.estado || 'Activo'}"`,
        `"${dispTexto}"`,
        `"${d.modificacion || 'Sin fecha'}"`,
        `"${diagnostico}"`,
        `"${(d.sharepointUrl || d.downloadUrl || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DOCUMENTOS_VENCIDOS_USV_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta el registro de auditoría a CSV
   */
  
  /**
   * Exporta la Matriz de Calidad y Seguimiento de Vigencias a CSV
   */
  exportarMatrizCalidadCSV(documentos) {
    const docs = documentos || this.documentosActuales || [];
    if (docs.length === 0) {
      alert('No hay documentos disponibles para exportar.');
      return;
    }

    const headers = [
      'Código',
      'Título del Documento',
      'Tipo de Documento',
      'Área Responsable',
      'Macroproceso (Tipo de Proceso)',
      'Proceso Específico',
      'Versión Vigente',
      'Fecha de Aprobación / Emisión',
      'Fecha de Vencimiento Normativo',
      'Días Restantes para Vencimiento',
      'Diagnóstico del Semáforo',
      'Estado del Ciclo de Vida (SGC)',
      'Disponibilidad Técnica',
      'Tiempo de Retención',
      'Lugar de Custodia',
      'Enlace SharePoint'
    ];

    const rows = docs.map((d) => {
      const v = this.evaluarVigenciaDoc(d);
      return [
        `"${d.codigo || ''}"`,
        `"${(d.titulo || '').replace(/"/g, '""')}"`,
        `"${(d.tipoDocumento || '').replace(/"/g, '""')}"`,
        `"${(d.area || '').replace(/"/g, '""')}"`,
        `"${(d.tipoProceso || '').replace(/"/g, '""')}"`,
        `"${(d.proceso || '').replace(/"/g, '""')}"`,
        `"${d.version || '01'}"`,
        `"${v.fechaAprobacionStr}"`,
        `"${v.fechaVencimientoStr}"`,
        `"${v.diasRestantes === 9999 ? 'N/A' : v.diasRestantes}"`,
        `"${v.etiqueta}"`,
        `"${d.estado || d.estadoDocumento || 'Activo'}"`,
        `"${d.disponible ? 'Disponible' : 'No Disponible'}"`,
        `"${d.tiempo || d.tiempoVigencia || '5 Años'}"`,
        `"${d.lugar || 'Archivo Digital'}"`,
        `"${(d.sharepointUrl || d.downloadUrl || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fechaStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `Matriz_Calidad_y_Vigencias_USV_${fechaStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportarAuditoriaCSV() {
    const eventos = staffService.obtenerRegistroAuditoria();
    if (!eventos || eventos.length === 0) {
      alert('No hay registros de auditoría para exportar.');
      return;
    }

    const headers = ['ID', 'Fecha_Hora', 'Evento', 'Colaborador', 'Identificación', 'Cargo', 'Perfil', 'Código_Documento', 'Título_Documento', 'Formato', 'Detalle'];
    const rows = eventos.map((e) => [
      `"${e.id || ''}"`,
      `"${staffService.formatearFechaHora(e.fechaHora || e.timestamp || '')}"`,
      `"${e.tipo || ''}"`,
      `"${(e.usuario || '').replace(/"/g, '""')}"`,
      `"${e.identificacion || ''}"`,
      `"${(e.cargo || '').replace(/"/g, '""')}"`,
      `"${e.perfil || ''}"`,
      `"${e.documentoCodigo || ''}"`,
      `"${(e.documentoTitulo || '').replace(/"/g, '""')}"`,
      `"${e.documentoExtension || ''}"`,
      `"${(e.detalle || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_Actividad_USV_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Actualización silenciosa e inteligente que preserva la posición de scroll y la pestaña activa
   */
  actualizarDatosSilencioso(documentos, perfilActual = null, todosDocumentos = null) {
    if (!this.container) return;

    // Guardar posición de scroll de la tabla de auditoría si está activa
    const tableContainer = this.container.querySelector('.audit-table')?.parentElement;
    const tableScrollTop = tableContainer ? tableContainer.scrollTop : 0;
    const inputSearchVal = this.container.querySelector('#search-audit-input-dashboard')?.value || '';

    // Re-renderizar
    this.render(documentos, perfilActual, todosDocumentos);

    // Restaurar valor de búsqueda si existía
    if (inputSearchVal) {
      const newInputSearch = this.container.querySelector('#search-audit-input-dashboard');
      if (newInputSearch) {
        newInputSearch.value = inputSearchVal;
      }
    }

    // Restaurar scroll de la tabla
    if (tableScrollTop > 0) {
      const newTableContainer = this.container.querySelector('.audit-table')?.parentElement;
      if (newTableContainer) {
        newTableContainer.scrollTop = tableScrollTop;
      }
    }
  }

  /**
   * Renderiza el Dashboard interactivo con soporte de pestañas (Resumen vs Auditoría)
   */
  render(documentos, perfilActual = null, todosDocumentos = null) {
    if (!this.container) return;
    this.documentosActuales = documentos || [];

    // Determinar perfil efectivo de forma infalible desde sesión / staffService
    let perfilEfectivo = perfilActual;
    if (!perfilEfectivo) {
      const sesion = staffService.obtenerSesionActiva();
      if (sesion) {
        perfilEfectivo = staffService.determinarPerfil(sesion.cargo, sesion.identificacion) || sesion.perfil;
      }
    }
    if (!perfilEfectivo) {
      perfilEfectivo = localStorage.getItem('agy_sgc_user_profile') || 'operativo';
    }

    const data = this.calcularMetricas(documentos);
    const listaCompleta = documentos; // Estrictamente limitado a la documentación permitida para el perfil
    const esAccesoTotal = Boolean(perfilEfectivo && (perfilEfectivo === 'total' || perfilEfectivo === 'administrador'));
    const esDirectivo = Boolean(perfilEfectivo && perfilEfectivo === 'directivo');
    const esAdministrativo = Boolean(perfilEfectivo && perfilEfectivo === 'administrativo');
    const esOperativo = Boolean(!perfilEfectivo || perfilEfectivo === 'operativo');
    const tieneAccesoModulosCompletos = esAccesoTotal || esDirectivo;

    // Si el perfil es administrativo u operativo, forzar estrictamente a resumen
    if (!tieneAccesoModulosCompletos && this.pestanaActiva !== 'resumen') {
      this.pestanaActiva = 'resumen';
    }

    // Ocultar exportaciones para administrativo u operativo
    const exportGroup = document.getElementById('sidebar-dash-export-group');
    if (exportGroup) {
      exportGroup.style.display = (esAdministrativo || esOperativo) ? 'none' : 'block';
    }

    // Ordenar agrupaciones de mayor a menor
    const tiposProcesoOrdenados = Object.entries(data.porTipoProceso).sort((a, b) => b[1] - a[1]);
    const areasOrdenadas = Object.entries(data.porArea).sort((a, b) => b[1] - a[1]);
    const procesosOrdenados = Object.entries(data.porProceso).sort((a, b) => b[1] - a[1]);
    const tiposOrdenados = Object.entries(data.porTipo).sort((a, b) => b[1] - a[1]);

    this.container.innerHTML = `
      <div class="analytics-dashboard animate-scale-up">

        <!-- ══════════════════════════════════════════════════════════════════════════
             PESTAÑA 1: RESUMEN DOCUMENTAL Y MÉTRICAS DE CALIDAD
             ══════════════════════════════════════════════════════════════════════════ -->
        <div id="tab-dash-content-resumen" style="${this.pestanaActiva === 'resumen' ? 'display: flex;' : 'display: none;'} flex-direction: column; height: 100%; min-height: 0; gap: 10px; box-sizing: border-box;">
          
          <!-- 1. BLOQUE SUPERIOR FIJO (Fila Única: KPIs Generales + Semáforo de Vigencia Integrado) -->
          <div class="dash-fixed-top-section" style="flex-shrink: 0;">
            <div class="analytics-kpi-unified-row">
              <!-- KPI 1: Total Documentos -->
              <div class="kpi-card kpi-card-unified">
                <div class="kpi-icon-box" style="background:#eaf2f8; color:#1f4260;">📚</div>
                <div class="kpi-info">
                  <span class="kpi-label">Total Documentos</span>
                  <span class="kpi-value">${data.total}</span>
                  <span class="kpi-subtext">Catálogo general</span>
                </div>
              </div>

              <!-- KPI 2: Disponibilidad -->
              <div class="kpi-card kpi-card-unified">
                <div class="kpi-icon-box" style="background:#e6f7ef; color:#137947;">✅</div>
                <div class="kpi-info">
                  <span class="kpi-label">Disponibilidad</span>
                  <span class="kpi-value">${data.porcentajeDisponibilidad}%</span>
                  <span class="kpi-subtext" title="${data.disponibles} vigentes / ${data.noDisponibles} no disponibles">${data.disponibles} vig. / ${data.noDisponibles} no disp.</span>
                </div>
              </div>

              <!-- KPI 3: Áreas y Procesos -->
              <div class="kpi-card kpi-card-unified">
                <div class="kpi-icon-box" style="background:#fef3c7; color:#b45309;">🏛️</div>
                <div class="kpi-info">
                  <span class="kpi-label">Áreas y Procesos</span>
                  <span class="kpi-value">${Object.keys(data.porArea).length}</span>
                  <span class="kpi-subtext" title="${Object.keys(data.porProceso).length} procesos / ${Object.keys(data.porTipoProceso).length} macroprocesos">${Object.keys(data.porProceso).length} proc. / ${Object.keys(data.porTipoProceso).length} macrop.</span>
                </div>
              </div>

              <!-- KPI 4: Tipos de Documentos -->
              <div class="kpi-card kpi-card-unified">
                <div class="kpi-icon-box" style="background:#f3e8ff; color:#7e22ce;">📑</div>
                <div class="kpi-info">
                  <span class="kpi-label">Tipos Documento</span>
                  <span class="kpi-value">${Object.keys(data.porTipo).length}</span>
                  <span class="kpi-subtext" title="Formatos, Manuales, Instructivos, etc.">Formatos, Manuales...</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. CUERPO INTERMEDIO DESPLAZABLE (Distribuciones por Tipo de Proceso, Área y Procesos) -->
          <div class="dash-resumen-scrollable-body">

            <!-- Gráficas de Distribución: 2 Columnas simétricas -->
            <div class="analytics-charts-grid">
              
              <!-- Distribución por Tipo de Proceso -->
              <div class="analytics-section-card">
                <div class="analytics-section-header">
                  <h3 class="analytics-section-title">🧭 Documentos por Tipo de Proceso</h3>
                  <span style="font-size:0.75rem; color:#64748b;">Clic para filtrar</span>
                </div>
                <div class="analytics-bars-list" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">
                  ${tiposProcesoOrdenados
                    .map(([tp, count]) => {
                      const pct = Math.round((count / data.total) * 100);
                      return `
                      <div class="chart-bar-item" data-filter-type="tipoProceso" data-filter-val="${tp}">
                        <div class="chart-bar-labels">
                          <span class="chart-bar-name" title="${tp}">${tp}</span>
                          <span class="chart-bar-val">${count} (${pct}%)</span>
                        </div>
                        <div class="chart-bar-track">
                          <div class="chart-bar-fill" style="width: ${pct}%; background-color: #0d9488;"></div>
                        </div>
                      </div>`;
                    })
                    .join('')}
                </div>
              </div>

              <!-- Distribución por Área -->
              <div class="analytics-section-card">
                <div class="analytics-section-header">
                  <h3 class="analytics-section-title">🏢 Documentos por Área</h3>
                  <span style="font-size:0.75rem; color:#64748b;">Clic para filtrar</span>
                </div>
                <div class="analytics-bars-list" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">
                  ${areasOrdenadas
                    .map(([area, count]) => {
                      const pct = Math.round((count / data.total) * 100);
                      return `
                      <div class="chart-bar-item" data-filter-type="area" data-filter-val="${area}">
                        <div class="chart-bar-labels">
                          <span class="chart-bar-name" title="${area}">${area}</span>
                          <span class="chart-bar-val">${count} (${pct}%)</span>
                        </div>
                        <div class="chart-bar-track">
                          <div class="chart-bar-fill" style="width: ${pct}%; background-color: var(--primary);"></div>
                        </div>
                      </div>`;
                    })
                    .join('')}
                </div>
              </div>

            </div>

            <!-- Distribución por Proceso (Ancho Completo dentro de scroll) -->
            <div class="analytics-section-card">
              <div class="analytics-section-header">
                <h3 class="analytics-section-title">⚙️ Documentos por Proceso</h3>
                <span style="font-size:0.75rem; color:#64748b;">Clic para filtrar</span>
              </div>
              <div class="analytics-bars-list" style="max-height: 240px; overflow-y: auto; padding-right: 4px;">
                ${procesosOrdenados
                  .map(([proceso, count]) => {
                    const pct = Math.round((count / data.total) * 100);
                    return `
                    <div class="chart-bar-item" data-filter-type="proceso" data-filter-val="${proceso}">
                      <div class="chart-bar-labels">
                        <span class="chart-bar-name" title="${proceso}">${proceso}</span>
                        <span class="chart-bar-val">${count} (${pct}%)</span>
                      </div>
                      <div class="chart-bar-track">
                        <div class="chart-bar-fill" style="width: ${pct}%; background-color: #1f4260;"></div>
                      </div>
                    </div>`;
                  })
                  .join('')}
              </div>
            </div>

          </div>

          <!-- 3. FILA INFERIOR FIJA: TIPOS DE DOCUMENTOS INSTITUCIONALES (Alineada con el borde inferior del sidebar) -->
          <div class="analytics-section-card dash-types-fixed-footer">
            <div class="dash-types-fixed-header">
              <h3 class="dash-types-fixed-title">📋 Tipos de Documentos Institucionales</h3>
              <span style="font-size:0.72rem; color:#64748b;">Clic para filtrar</span>
            </div>
            <div class="dash-types-horizontal-list">
              ${tiposOrdenados
                .map(([tipo, count]) => {
                  const pct = Math.round((count / data.total) * 100);
                  return `
                  <div class="type-metric-box-compact chart-bar-item" data-filter-type="tipo" data-filter-val="${tipo}">
                    <span class="type-metric-count">${count}</span>
                    <span class="type-metric-name">${tipo}</span>
                    <span class="type-metric-pct">${pct}% del total</span>
                  </div>`;
                })
                .join('')}
            </div>
          </div>

        </div>

        ${esAccesoTotal ? `
        
        <!-- ══════════════════════════════════════════════════════════════════════════
             PESTAÑA 2: GESTIÓN DE CALIDAD Y SEGUIMIENTO DE VIGENCIAS
             ══════════════════════════════════════════════════════════════════════════ -->
        <div id="tab-dash-content-calidad" style="${this.pestanaActiva === 'calidad' ? 'display: flex;' : 'display: none;'} flex-direction: column; height: 100%; min-height: 0; gap: 10px; box-sizing: border-box;">

          <!-- Encabezado del Módulo de Calidad -->
          <div class="analytics-card" style="padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1f4260 0%, #265072 100%); color: #ffffff; border-radius: 8px; flex-shrink: 0; margin-bottom: 0;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.4rem;">🎯</span>
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.01em;">
                  Gestión de Calidad y Semáforo de Vigencias Documentales
                </h3>
                <span style="font-size: 0.73rem; color: #cbd5e1;">
                  Monitoreo preventivo del ciclo de vida, vigencias normativas a 5 años y estado del SGC
                </span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="calidad-salud-global-badge" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); padding: 4px 10px; border-radius: 12px; font-size: 0.74rem; font-weight: 700; color: #ffffff;">
                Salud Documental: 100%
              </span>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-exportar-calidad-inline" style="background: #ffffff; color: #1f4260; font-weight: 700; border: none; padding: 4px 10px; font-size: 0.74rem; border-radius: 6px; display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <span>📥</span> Exportar Matriz
              </button>
            </div>
          </div>

          <!-- Fila de Tarjetas del Semáforo de Calidad y Disponibilidad -->
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; flex-shrink: 0;">
            
            <!-- 1. Vigentes (> 1 año) -->
            <div class="analytics-card kpi-calidad-card active-filter-calidad" id="kpi-calidad-vigentes" data-semaforo="VIGENTE" style="padding: 9px 12px; border-left: 4px solid #16a34a; background: #f0fdf4; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #166534;">🟢 VIGENTES (> 1 AÑO)</span>
                <span style="font-size: 0.70rem; background: #dcfce7; color: #15803d; font-weight: 800; padding: 2px 6px; border-radius: 10px;" id="kpi-pct-vigentes">0%</span>
              </div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #14532d; margin-top: 2px;" id="kpi-count-vigentes">0</div>
              <div style="font-size: 0.68rem; color: #16a34a;">Al día y estables</div>
            </div>

            <!-- 2. Próximos a Vencer (≤ 1 año) -->
            <div class="analytics-card kpi-calidad-card" id="kpi-calidad-proximos" data-semaforo="PROXIMO" style="padding: 9px 12px; border-left: 4px solid #f59e0b; background: #fffbeb; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #92400e;">🟡 POR VENCER (≤ 1 AÑO)</span>
                <span style="font-size: 0.70rem; background: #fef3c7; color: #b45309; font-weight: 800; padding: 2px 6px; border-radius: 10px;" id="kpi-pct-proximos">0%</span>
              </div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #78350f; margin-top: 2px;" id="kpi-count-proximos">0</div>
              <div style="font-size: 0.68rem; color: #d97706;">Requieren revisión preventiva</div>
            </div>

            <!-- 3. Vencidos / Caducados -->
            <div class="analytics-card kpi-calidad-card" id="kpi-calidad-vencidos" data-semaforo="VENCIDO" style="padding: 9px 12px; border-left: 4px solid #ef4444; background: #fef2f2; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #991b1b;">🔴 VENCIDOS</span>
                <span style="font-size: 0.70rem; background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 2px 6px; border-radius: 10px;" id="kpi-pct-vencidos">0%</span>
              </div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #7f1d1d; margin-top: 2px;" id="kpi-count-vencidos">0</div>
              <div style="font-size: 0.68rem; color: #dc2626;">Actualización urgente</div>
            </div>

            <!-- 4. En Revisión / Nuevos -->
            <div class="analytics-card kpi-calidad-card" id="kpi-calidad-revision" data-semaforo="REVISION" style="padding: 9px 12px; border-left: 4px solid #0284c7; background: #f0f9ff; cursor: pointer; transition: all 0.2s ease;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #075985;">🔵 EN REVISIÓN</span>
                <span style="font-size: 0.70rem; background: #e0f2fe; color: #0284c7; font-weight: 800; padding: 2px 6px; border-radius: 10px;" id="kpi-pct-revision">0%</span>
              </div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #0c4a6e; margin-top: 2px;" id="kpi-count-revision">0</div>
              <div style="font-size: 0.68rem; color: #0284c7;">En ciclo de aprobación</div>
            </div>

            <!-- 5. No Disponibles en Línea -->
            <div class="analytics-card kpi-calidad-card" id="kpi-calidad-nodisponibles" data-semaforo="NO_DISPONIBLE" style="padding: 9px 12px; border-left: 4px solid #dc2626; background: #fff5f5; cursor: pointer; transition: all 0.2s ease;" title="Ver documentos que no se encuentran disponibles en línea">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #991b1b;">⚠️ NO DISPONIBLES</span>
                <span style="font-size: 0.70rem; background: #fee2e2; color: #b91c1c; font-weight: 800; padding: 2px 6px; border-radius: 10px;" id="kpi-pct-nodisp">0%</span>
              </div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #7f1d1d; margin-top: 2px;" id="kpi-count-nodisp">0</div>
              <div style="font-size: 0.68rem; color: #dc2626;">Sin archivo o enlace en línea</div>
            </div>

          </div>

          <!-- Matriz de Seguimiento y Tabla de Calidad Documental -->
          <div class="analytics-card" style="flex: 1 1 0; min-height: 0; display: flex; flex-direction: column; padding: 10px 14px; gap: 8px; margin-bottom: 0; overflow: hidden;">
            
            <!-- Barra de Herramientas y Filtros de la Matriz de Calidad -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; flex-shrink: 0;">
              
              <!-- Filtros Rápidos por Semáforo y Disponibilidad -->
              <div style="display: flex; gap: 5px; flex-wrap: wrap;" id="calidad-semaforo-filter-group">
                <button type="button" class="btn btn-secondary btn-calidad-filter active" data-filter="TODOS" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700;">Todos (<span id="count-filter-todos">0</span>)</button>
                <button type="button" class="btn btn-secondary btn-calidad-filter" data-filter="VIGENTE" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700; color: #166534;">🟢 Vigentes</button>
                <button type="button" class="btn btn-secondary btn-calidad-filter" data-filter="PROXIMO" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700; color: #92400e;">🟡 Por Vencer</button>
                <button type="button" class="btn btn-secondary btn-calidad-filter" data-filter="VENCIDO" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700; color: #991b1b;">🔴 Vencidos</button>
                <button type="button" class="btn btn-secondary btn-calidad-filter" data-filter="REVISION" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700; color: #075985;">🔵 En Revisión</button>
                <button type="button" class="btn btn-secondary btn-calidad-filter" data-filter="NO_DISPONIBLE" style="padding: 4px 9px; font-size: 0.75rem; font-weight: 700; color: #b91c1c; background: #fef2f2; border: 1.5px solid #fca5a5;" title="Filtrar solo documentos no disponibles en línea">⚠️ No Disponibles (<span id="count-filter-nodisp">0</span>)</button>
              </div>

              <!-- Filtros Desplegables Maestros: Macroproceso, Área, Proceso y Tipo de Documento -->
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <select id="select-calidad-macroproceso" class="form-input" style="height: 30px; font-size: 0.74rem; padding: 2px 6px; width: 125px;" title="Filtrar por Tipo de Proceso (Maestro)">
                  <option value="TODOS">Todos Macroproc.</option>
                </select>

                <select id="select-calidad-area" class="form-input" style="height: 30px; font-size: 0.74rem; padding: 2px 6px; width: 135px;" title="Filtrar por Área Institucional (Maestro)">
                  <option value="TODOS">Todas las Áreas</option>
                </select>

                <select id="select-calidad-proceso" class="form-input" style="height: 30px; font-size: 0.74rem; padding: 2px 6px; width: 145px;" title="Filtrar por Proceso Específico (Maestro)">
                  <option value="TODOS">Todos los Procesos</option>
                </select>

                <select id="select-calidad-tipo-doc" class="form-input" style="height: 30px; font-size: 0.74rem; padding: 2px 6px; width: 125px;" title="Filtrar por Tipo de Documento (Maestro)">
                  <option value="TODOS">Todos los Tipos</option>
                </select>

                <!-- Buscador en Vivo -->
                <div style="position: relative; width: 155px;">
                  <input type="text" id="search-calidad-input" class="form-input" placeholder="🔍 Buscar..." style="height: 30px; font-size: 0.75rem; padding: 2px 8px; width: 100%; box-sizing: border-box;" />
                </div>
              </div>

            </div>

            <!-- Tabla de la Matriz de Calidad con Scroll -->
            <div style="flex: 1 1 0; min-height: 180px; overflow-y: auto; border: 1.5px solid #d0dfea; border-radius: 6px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;" id="tabla-matriz-calidad">
                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                  <tr style="text-align: left; color: #475569; border-bottom: 1.5px solid #cbd5e1;">
                    <th style="padding: 7px 9px; width: 105px;">Código</th>
                    <th style="padding: 7px 9px;">Nombre del Documento</th>
                    <th style="padding: 7px 9px; width: 150px;">Proceso / Área</th>
                    <th style="padding: 7px 9px; width: 55px; text-align: center;">Ver.</th>
                    <th style="padding: 7px 9px; width: 85px; text-align: center;">Aprobación</th>
                    <th style="padding: 7px 9px; width: 85px; text-align: center;">Vencimiento</th>
                    <th style="padding: 7px 9px; width: 130px; text-align: center;">Semáforo Vigencia</th>
                    <th style="padding: 7px 9px; width: 110px; text-align: center;">Disponibilidad</th>
                    <th style="padding: 7px 9px; width: 80px; text-align: center;">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tbody-calidad-matriz">
                  <!-- Se llena dinámicamente -->
                </tbody>
              </table>
            </div>

          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════════════════════════
             PESTAÑA 3: AUDITORÍA INSTITUCIONAL (EXCLUSIVO ACCESO TOTAL)
             ══════════════════════════════════════════════════════════════════════════ -->
        <div id="tab-dash-content-auditoria" style="${this.pestanaActiva === 'auditoria' ? 'display: flex;' : 'display: none;'} flex-direction: column; flex: 1; height: 100%; min-height: 0;">
          
          <div class="analytics-section-card audit-dashboard-card" style="border: 1.5px solid #b4c9de; background: #ffffff; display: flex; flex-direction: column; flex: 1; min-height: 0; box-sizing: border-box;">
            
            <!-- Encabezado de la Sección -->
            <div class="analytics-section-header" style="flex-wrap: wrap; gap: 12px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
              <div style="flex: 1; min-width: 240px;">
                <h3 class="analytics-section-title" id="audit-main-title" style="color: var(--brand-navy); display: flex; align-items: center; gap: 8px;">
                  ${this.pestanaActiva === 'cambios' ? '📜 Trazabilidad y Control de Cambios Documentales' : '🛡️ Registro de Auditoría de Actividad y Accesos'}
                </h3>
                <span id="audit-main-subtitle" style="font-size: 0.76rem; color: #64748b;">
                  ${this.pestanaActiva === 'cambios' ? 'Histórico oficial de versiones (Google Drive), metadatos (Google Drive), ediciones físicas en SharePoint, creaciones y eliminaciones' : 'Trazabilidad institucional en tiempo real de inicios de sesión, descargas, aperturas de carpetas, creaciones y modificaciones'}
                </span>
              </div>
              <div id="container-audit-sync-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span id="badge-audit-sync-status" style="font-size: 0.72rem; color: #166534; background: #dcfce7; padding: 3px 9px; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #bbf7d0;">
                  <span style="width: 7px; height: 7px; background: #16a34a; border-radius: 50%; display: inline-block;"></span> Google Drive Sincronizado
                </span>
                <button type="button" id="btn-sync-auditoria-ahora" class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px; display: flex; align-items: center; gap: 6px; cursor: pointer; border-radius: 6px;">
                  <span id="icon-sync-spin">🔄</span> Sincronizar ahora
                </button>
              </div>
            </div>

            <!-- SECCIÓN 2A: AUDITORÍA DE ACTIVIDAD Y ACCESOS -->
            <div id="subtab-content-audit-actividad" style="${this.pestanaActiva === 'auditoria' ? 'display: flex;' : 'display: none;'} flex-direction: column; flex: 1; min-height: 0;">
              <!-- Métricas de Auditoría de Gestión Documental y Accesos -->
              <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; margin: 4px 0 10px 0;">
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #15803d;" id="kpi-dash-logins">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #166534;">🟢 Inicios</div>
                </div>
                <div style="background: #edf5fa; border: 1px solid var(--border-color, #cddde9); border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: var(--primary, #376c95);" id="kpi-dash-downloads">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: var(--brand-navy, #1f4260);">📥 Descargas</div>
                </div>
                <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #a16207;" id="kpi-dash-folders">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #854d0e;">📁 Carpetas</div>
                </div>
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #059669;" id="kpi-dash-creates">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #065f46;">✨ Creados</div>
                </div>
                <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #7e22ce;" id="kpi-dash-edits">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #6b21a8;">✏️ Ediciones</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #dc2626;" id="kpi-dash-elims">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #991b1b;">🗑️ Eliminados</div>
                </div>
                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #be123c;" id="kpi-dash-security">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #9f1239;">🔑 Seguridad</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 4px; text-align: center;">
                  <div style="font-size: 1.10rem; font-weight: 800; color: #334155;" id="kpi-dash-users">0</div>
                  <div style="font-size: 0.68rem; font-weight: 600; color: #475569;">👥 Gestores</div>
                </div>
              </div>

              <!-- Filtros de Auditoría y Búsqueda -->
              <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="group-audit-filters-dashboard">
                  <button class="btn btn-secondary btn-audit-filter active" data-audit-filter="TODOS" style="padding: 4px 10px; font-size: 0.76rem;">Todos</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="LOGIN" style="padding: 4px 10px; font-size: 0.76rem;">🟢 Inicios Sesión</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="DESCARGA" style="padding: 4px 10px; font-size: 0.76rem;">📥 Descargas</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="CARPETA" style="padding: 4px 10px; font-size: 0.76rem;">📁 Carpetas</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="CREACION" style="padding: 4px 10px; font-size: 0.76rem;">✨ Creaciones</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="EDICION" style="padding: 4px 10px; font-size: 0.76rem;">✏️ Edición</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="METADATOS" style="padding: 4px 10px; font-size: 0.76rem;">📋 Metadatos</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="ELIMINACION" style="padding: 4px 10px; font-size: 0.76rem;">🗑️ Eliminaciones</button>
                  <button class="btn btn-secondary btn-audit-filter" data-audit-filter="SEGURIDAD" style="padding: 4px 10px; font-size: 0.76rem;">🔑 Seguridad</button>
                </div>
                <div style="position: relative; min-width: 240px; flex: 1; max-width: 360px;">
                  <input 
                    type="text" 
                    id="search-audit-input-dashboard" 
                    class="form-input" 
                    placeholder="Buscar por colaborador, documento..." 
                    style="padding: 5px 10px; font-size: 0.80rem; height: 32px; width: 100%; box-sizing: border-box;"
                  />
                </div>
              </div>

              <!-- Tabla de Eventos de Actividad -->
              <div class="audit-table-wrapper" style="flex: 1 1 0; min-height: 180px; overflow-y: auto; border: 1px solid #d0dfea; border-radius: 6px;">
                <table class="audit-table" style="width: 100%; border-collapse: collapse; font-size: 0.80rem;">
                  <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <tr style="text-align: left; color: #475569; border-bottom: 1.5px solid #cbd5e1;">
                      <th style="padding: 8px 10px;">Fecha y Hora</th>
                      <th style="padding: 8px 10px;">Evento</th>
                      <th style="padding: 8px 10px;">Colaborador</th>
                      <th style="padding: 8px 10px;">Perfil</th>
                      <th style="padding: 8px 10px;">Documento / Detalle</th>
                    </tr>
                  </thead>
                  <tbody id="tbody-audit-events-dashboard">
                    <!-- Se llena dinámicamente -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- SECCIÓN 2B: CONTROL DE CAMBIOS DOCUMENTALES (HISTÓRICO) -->
            <div id="subtab-content-audit-cambios" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
              <!-- Métricas KPI de Control de Cambios -->
              <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 4px 0 10px 0;">
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: #059669;" id="kpi-hist-creaciones">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: #047857;">🆕 Creados</div>
                </div>
                <div style="background: #edf5fa; border: 1px solid var(--border-color, #cddde9); border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary, #376c95);" id="kpi-hist-versiones">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: var(--brand-navy, #1f4260);">🔄 Versiones</div>
                </div>
                <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: #7c3aed;" id="kpi-hist-metadatos">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: #6d28d9;">📋 Metadatos</div>
                </div>
                <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: #475569;" id="kpi-hist-ediciones">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: #334155;">✏️ Ediciones SP</div>
                </div>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: #dc2626;" id="kpi-hist-eliminaciones">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: #b91c1c;">❌ Eliminados</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 6px; text-align: center;">
                  <div style="font-size: 1.15rem; font-weight: 800; color: #334155;" id="kpi-hist-autores">0</div>
                  <div style="font-size: 0.70rem; font-weight: 600; color: #475569;">👥 Gestores</div>
                </div>
              </div>

              <!-- Filtros de Control de Cambios y Buscador -->
              <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="group-hist-filters-dashboard">
                  <button class="btn btn-secondary btn-hist-filter active" data-hist-filter="TODOS" style="padding: 4px 10px; font-size: 0.76rem;">Todos</button>
                  <button class="btn btn-secondary btn-hist-filter" data-hist-filter="CREACION" style="padding: 4px 10px; font-size: 0.76rem;">🆕 Creados</button>
                  <button class="btn btn-secondary btn-hist-filter" data-hist-filter="CAMBIO_VERSION" style="padding: 4px 10px; font-size: 0.76rem;">🔄 Versiones</button>
                  <button class="btn btn-secondary btn-hist-filter" data-hist-filter="METADATOS" style="padding: 4px 10px; font-size: 0.76rem;">📋 Metadatos</button>
                  <button class="btn btn-secondary btn-hist-filter" data-hist-filter="EDICION_SHAREPOINT" style="padding: 4px 10px; font-size: 0.76rem;">✏️ Ediciones SP</button>
                  <button class="btn btn-secondary btn-hist-filter" data-hist-filter="ELIMINACION" style="padding: 4px 10px; font-size: 0.76rem;">❌ Eliminados</button>
                </div>
                <div style="position: relative; min-width: 240px; flex: 1; max-width: 360px;">
                  <input 
                    type="text" 
                    id="search-hist-input-dashboard" 
                    class="form-input" 
                    placeholder="Buscar por código, título, autor, ruta..." 
                    style="padding: 5px 10px; font-size: 0.80rem; height: 32px; width: 100%; box-sizing: border-box;"
                  />
                </div>
              </div>

              <!-- Tabla de Control de Cambios Documentales -->
              <div class="audit-table-wrapper" style="flex: 1 1 0; min-height: 180px; overflow-y: auto; border: 1px solid #d0dfea; border-radius: 6px;">
                <table class="audit-table" style="width: 100%; border-collapse: collapse; font-size: 0.80rem;">
                  <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <tr style="text-align: left; color: #475569; border-bottom: 1.5px solid #cbd5e1;">
                      <th style="padding: 8px 10px; width: 130px;">Fecha y Hora</th>
                      <th style="padding: 8px 10px; width: 120px;">Evento</th>
                      <th style="padding: 8px 10px; width: 110px;">Código</th>
                      <th style="padding: 8px 10px;">Documento</th>
                      <th style="padding: 8px 10px;">Detalle del Cambio</th>
                      <th style="padding: 8px 10px; width: 120px; text-align: center;">SharePoint</th>
                      <th style="padding: 8px 10px; width: 150px;">Colaborador</th>
                    </tr>
                  </thead>
                  <tbody id="tbody-hist-events-dashboard">
                    <!-- Se llena dinámicamente -->
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
        ` : ''}

      </div>
    `;

    // 1. Vincular clic interactivo en los gráficos para saltar al catálogo con filtro aplicado
    this.container.querySelectorAll('.chart-bar-item').forEach((item) => {
      item.addEventListener('click', () => {
        const { filterType, filterVal } = item.dataset;
        if (this.onSelectFiltro && filterType && filterVal) {
          this.onSelectFiltro(filterType, filterVal);
        }
      });
    });

    this.inicializarModuloCalidad(documentos);

    // 2. Si es Acceso Total, inicializar lógica y render de auditoría
    if (esAccesoTotal) {
      this.inicializarAuditoriaDashboard();
    }

    // 3. Sincronizar estado inicial de pestañas y botones de exportación
    this.cambiarPestana(this.pestanaActiva || 'resumen');
  }

  /**
   * Cambia la pestaña activa del Dashboard (Resumen Documental / Calidad / Auditoría / Control de Cambios)
   */
  cambiarPestana(tabTarget) {
    const sesion = staffService.obtenerSesionActiva();
    const perfilUsuario = String(sesion?.perfil || localStorage.getItem('agy_sgc_user_profile') || 'operativo').toLowerCase();
    const esAccesoTotal = perfilUsuario === 'total' || perfilUsuario === 'administrador';
    const esDirectivo = perfilUsuario === 'directivo';
    const esAdministrativo = perfilUsuario === 'administrativo';
    const esOperativo = perfilUsuario === 'operativo';
    const tieneAccesoModulosCompletos = esAccesoTotal || esDirectivo;

    // Regla estricta: perfil administrativo u operativo NO tienen acceso a calidad, auditoría ni cambios
    if (!tieneAccesoModulosCompletos) {
      tabTarget = 'resumen';
    }

    this.pestanaActiva = tabTarget;
    const contentResumen = this.container?.querySelector('#tab-dash-content-resumen');
    const contentCalidad = this.container?.querySelector('#tab-dash-content-calidad');
    const contentAuditoria = this.container?.querySelector('#tab-dash-content-auditoria');
    const secSubActividad = this.container?.querySelector('#subtab-content-audit-actividad');
    const secSubCambios = this.container?.querySelector('#subtab-content-audit-cambios');
    const title = this.container?.querySelector('#audit-main-title');
    const subtitle = this.container?.querySelector('#audit-main-subtitle');

    const btnSideResumen = document.getElementById('btn-sidebar-dash-resumen');
    const btnSideCalidad = document.getElementById('btn-sidebar-dash-calidad');
    const btnSideAuditoria = document.getElementById('btn-sidebar-dash-auditoria');
    const btnSideCambios = document.getElementById('btn-sidebar-dash-cambios');

    btnSideResumen?.classList.remove('active');
    btnSideCalidad?.classList.remove('active');
    btnSideAuditoria?.classList.remove('active');
    btnSideCambios?.classList.remove('active');

    const btnMaster = document.getElementById('btn-sidebar-dash-master');
    const btnVencidos = document.getElementById('btn-sidebar-dash-vencidos');
    const btnCalidadExport = document.getElementById('btn-sidebar-dash-calidad-export');
    const btnAudit = document.getElementById('btn-sidebar-dash-audit');
    const btnHistory = document.getElementById('btn-sidebar-dash-history');
    const exportGroup = document.getElementById('sidebar-dash-export-group');

    // Regla: Ocultar todos los botones de exportación y el grupo si es administrativo u operativo
    if (esAdministrativo || esOperativo) {
      if (exportGroup) exportGroup.style.display = 'none';
      if (btnMaster) btnMaster.style.display = 'none';
      if (btnVencidos) btnVencidos.style.display = 'none';
      if (btnCalidadExport) btnCalidadExport.style.display = 'none';
      if (btnAudit) btnAudit.style.display = 'none';
      if (btnHistory) btnHistory.style.display = 'none';
    } else if (exportGroup) {
      exportGroup.style.display = 'block';
    }

    if (tabTarget === 'resumen') {
      if (contentResumen) contentResumen.style.display = 'flex';
      if (contentCalidad) contentCalidad.style.display = 'none';
      if (contentAuditoria) contentAuditoria.style.display = 'none';
      if (btnSideResumen) btnSideResumen.classList.add('active');
      if (!esAdministrativo && !esOperativo) {
        if (btnMaster) btnMaster.style.display = 'flex';
        if (btnVencidos) btnVencidos.style.display = 'flex';
      }
      if (btnCalidadExport) btnCalidadExport.style.display = 'none';
      if (btnAudit) btnAudit.style.display = 'none';
      if (btnHistory) btnHistory.style.display = 'none';
    } else if (tabTarget === 'calidad') {
      if (contentResumen) contentResumen.style.display = 'none';
      if (contentCalidad) contentCalidad.style.display = 'flex';
      if (contentAuditoria) contentAuditoria.style.display = 'none';
      if (btnSideCalidad) btnSideCalidad.classList.add('active');
      if (btnMaster) btnMaster.style.display = 'none';
      if (btnVencidos) btnVencidos.style.display = 'none';
      if (btnCalidadExport) btnCalidadExport.style.display = 'flex';
      if (btnAudit) btnAudit.style.display = 'none';
      if (btnHistory) btnHistory.style.display = 'none';
      if (typeof this.renderTablaCalidadActual === 'function') {
        this.renderTablaCalidadActual();
      }
    } else if (tabTarget === 'auditoria') {
      if (this._intervaloAuditoriaAutoSync) {
        clearInterval(this._intervaloAuditoriaAutoSync);
        this._intervaloAuditoriaAutoSync = null;
      }
      if (contentResumen) contentResumen.style.display = 'none';
      if (contentCalidad) contentCalidad.style.display = 'none';
      if (contentAuditoria) contentAuditoria.style.display = 'flex';
      if (secSubActividad) secSubActividad.style.display = 'flex';
      if (secSubCambios) secSubCambios.style.display = 'none';
      if (title) title.innerHTML = '🛡️ Registro de Auditoría de Actividad y Accesos';
      if (subtitle) subtitle.textContent = 'Trazabilidad en tiempo real de accesos, consultas, descargas y carpetas';
      if (btnSideAuditoria) btnSideAuditoria.classList.add('active');
      if (btnMaster) btnMaster.style.display = 'none';
      if (btnVencidos) btnVencidos.style.display = 'none';
      if (btnCalidadExport) btnCalidadExport.style.display = 'none';
      if (btnAudit) btnAudit.style.display = 'flex';
      if (btnHistory) btnHistory.style.display = 'none';
      if (typeof this.renderTablaAuditoriaActual === 'function') {
        this.renderTablaAuditoriaActual();
      }
      // Sincronización inmediata con la caché de Google al ingresar
      staffService.sincronizarAuditoria(true).then((res) => {
        if (typeof this.renderTablaAuditoriaActual === 'function') {
          this.renderTablaAuditoriaActual();
        }
      });
      // Monitoreo en vivo: verificación periódica de cambios en la nube cada 15 segundos
      this._intervaloAuditoriaAutoSync = setInterval(() => {
        if (this.pestanaActiva === 'auditoria' && !document.hidden) {
          staffService.sincronizarAuditoria(true).then((res) => {
            if (res && res.huboCambios && typeof this.renderTablaAuditoriaActual === 'function') {
              this.renderTablaAuditoriaActual();
            }
          });
        }
      }, 15000);
    } else if (tabTarget === 'cambios') {
      if (contentResumen) contentResumen.style.display = 'none';
      if (contentCalidad) contentCalidad.style.display = 'none';
      if (contentAuditoria) contentAuditoria.style.display = 'flex';
      if (secSubActividad) secSubActividad.style.display = 'none';
      if (secSubCambios) secSubCambios.style.display = 'flex';
      if (title) title.innerHTML = '📜 Trazabilidad y Control de Cambios Documentales';
      if (subtitle) subtitle.textContent = 'Histórico oficial de creaciones, versiones, modificaciones en SharePoint, traslados y bajas';
      if (btnSideCambios) btnSideCambios.classList.add('active');
      if (btnMaster) btnMaster.style.display = 'none';
      if (btnVencidos) btnVencidos.style.display = 'none';
      if (btnCalidadExport) btnCalidadExport.style.display = 'none';
      if (btnAudit) btnAudit.style.display = 'none';
      if (btnHistory) btnHistory.style.display = 'flex';
      if (typeof this.renderTablaHistoricoActual === 'function') {
        this.renderTablaHistoricoActual();
      }
      staffService.sincronizarConfiguracion().then(() => {
        if (typeof this.renderTablaHistoricoActual === 'function') {
          this.renderTablaHistoricoActual();
        }
      });
    }
  }

  /**
   * Manejador de visualización y filtrado de las tablas de auditoría y control de cambios en el Dashboard
   */
  
    /**
   * Normaliza un texto para comparaciones flexibles (elimina tildes, mayúsculas, sufijos)
   */
  normalizarTextoCalidad(str) {
    if (!str) return '';
    return str
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }

  /**
   * Inicializa la lógica interactiva, filtrado y render de la Matriz de Calidad usando Tablas Maestras
   */
  inicializarModuloCalidad(documentos) {
    const tbodyCalidad = document.getElementById('tbody-calidad-matriz');
    if (!tbodyCalidad) return;

    const docs = documentos || this.documentosActuales || [];

    const selectMacro = document.getElementById('select-calidad-macroproceso');
    const selectArea = document.getElementById('select-calidad-area');
    const selectProcesos = document.getElementById('select-calidad-proceso');
    const selectTipoDoc = document.getElementById('select-calidad-tipo-doc');

    // 1. Obtener Tablas Maestras oficiales desde staffService
    const maestrosTiposProceso = staffService.obtenerTiposProceso ? staffService.obtenerTiposProceso() : [];
    const maestrosAreas = staffService.obtenerAreasInstitucionales ? staffService.obtenerAreasInstitucionales() : [];
    const maestrosTiposDoc = staffService.obtenerTiposDocumento ? staffService.obtenerTiposDocumento() : [];

    // Fallbacks si estuvieran vacíos
    const listaMacroprocesos = maestrosTiposProceso.length > 0 
      ? maestrosTiposProceso.map((tp) => tp.nombre) 
      : ['Apoyo', 'Calidad', 'Estrategico', 'Misional'];

    // 2. Función Maestra de Cascada Reactiva para Filtros de Calidad
    const actualizarCascadaCalidad = () => {
      const fMacro = this.filtroCalidadMacroproceso || 'TODOS';
      const normFMacro = this.normalizarTextoCalidad(fMacro);

      // 1. Filtrar documentos según Macroproceso para obtener Áreas disponibles
      let docsParaAreas = docs;
      if (fMacro !== 'TODOS') {
        docsParaAreas = docs.filter((d) => {
          const docTp = this.normalizarTextoCalidad(d.tipoProceso || '');
          return docTp.includes(normFMacro) || normFMacro.includes(docTp);
        });
      }

      // Encontrar qué áreas maestras tienen documentos en este macroproceso
      const areasFinales = [];
      const setNombresAgregados = new Set();

      maestrosAreas.forEach((ma) => {
        const siglaM = (ma.sigla || '').toUpperCase();
        const nomM = this.normalizarTextoCalidad(ma.nombre || '');
        
        const tieneDocs = docsParaAreas.some((d) => {
          const codUpper = (d.codigo || '').toUpperCase();
          const docAreaNorm = this.normalizarTextoCalidad(d.area || '');
          if (siglaM && (codUpper.includes(`-${siglaM}-`) || codUpper.startsWith(`${siglaM}-`))) return true;
          if ((siglaM === 'GHU' || siglaM === 'GTH') && (codUpper.includes('-GTH-') || codUpper.includes('-GHU-') || codUpper.includes('-SST-') || docAreaNorm.includes('talento') || docAreaNorm.includes('humana') || docAreaNorm.includes('sst'))) return true;
          if (siglaM === 'GTI' && (codUpper.includes('-TIC-') || codUpper.includes('-GTI-') || docAreaNorm.includes('tecnolog'))) return true;
          if (siglaM === 'GAD' && (codUpper.includes('-GAD-') || docAreaNorm.includes('administrativ'))) return true;
          if (siglaM === 'GFI' && (codUpper.includes('-GFI-') || docAreaNorm.includes('financier'))) return true;
          if (siglaM === 'GIC' && (codUpper.includes('-GIC-') || docAreaNorm.includes('calidad'))) return true;
          if (siglaM === 'GMD' && (codUpper.includes('-GMD-') || codUpper.includes('-FAR-') || docAreaNorm.includes('medica') || docAreaNorm.includes('farmaceut'))) return true;
          return docAreaNorm === nomM || docAreaNorm.includes(nomM) || nomM.includes(docAreaNorm);
        });

        if (tieneDocs && !setNombresAgregados.has(ma.nombre)) {
          areasFinales.push(ma);
          setNombresAgregados.add(ma.nombre);
        }
      });

      // Si aún así no hay en maestras, tomar de los docs directamente
      if (areasFinales.length === 0) {
        const setDirecto = new Set();
        docsParaAreas.forEach((d) => {
          if (d.area && d.area !== 'N/A') setDirecto.add(d.area.trim());
        });
        setDirecto.forEach((a) => areasFinales.push({ nombre: a, sigla: '' }));
      }

      // Validar si el área seleccionada sigue existiendo en el subconjunto
      const areaActual = this.filtroCalidadArea || 'TODOS';
      const existeAreaActual = areaActual === 'TODOS' || areasFinales.some((a) => 
        this.normalizarTextoCalidad(a.nombre) === this.normalizarTextoCalidad(areaActual) ||
        (a.sigla && this.normalizarTextoCalidad(a.sigla) === this.normalizarTextoCalidad(areaActual))
      );
      if (!existeAreaActual) {
        this.filtroCalidadArea = 'TODOS';
      }

      if (selectArea) {
        selectArea.innerHTML = `<option value="TODOS">Todas las Áreas (${areasFinales.length})</option>` +
          areasFinales.map((a) => {
            const valor = a.nombre;
            const texto = a.sigla && a.sigla !== a.nombre ? `${a.sigla} - ${a.nombre}` : a.nombre;
            const isSelected = this.normalizarTextoCalidad(a.nombre) === this.normalizarTextoCalidad(this.filtroCalidadArea) || 
                               (a.sigla && this.normalizarTextoCalidad(a.sigla) === this.normalizarTextoCalidad(this.filtroCalidadArea));
            return `<option value="${valor}" ${isSelected ? 'selected' : ''}>${texto}</option>`;
          }).join('');
      }

      // 2. Filtrar documentos según Área para obtener Procesos disponibles
      let docsParaProcesos = docsParaAreas;
      const fArea = this.filtroCalidadArea || 'TODOS';
      const normFArea = this.normalizarTextoCalidad(fArea);
      if (fArea !== 'TODOS') {
        const areaMaestraSel = maestrosAreas.find(
          (a) => this.normalizarTextoCalidad(a.nombre) === normFArea || (a.sigla && this.normalizarTextoCalidad(a.sigla) === normFArea)
        );
        const siglaMSel = areaMaestraSel ? (areaMaestraSel.sigla || '').toUpperCase() : '';

        docsParaProcesos = docsParaAreas.filter((d) => {
          const docArea = this.normalizarTextoCalidad(d.area || '');
          const codUpper = (d.codigo || '').toUpperCase();
          if (docArea === normFArea || docArea.includes(normFArea) || normFArea.includes(docArea)) return true;
          if (siglaMSel) {
            if (codUpper.includes(`-${siglaMSel}-`) || codUpper.startsWith(`${siglaMSel}-`)) return true;
            if ((siglaMSel === 'GHU' || siglaMSel === 'GTH') && (codUpper.includes('-GTH-') || codUpper.includes('-GHU-') || codUpper.includes('-SST-') || docArea.includes('talento') || docArea.includes('humana') || docArea.includes('sst'))) return true;
            if (siglaMSel === 'GTI' && (codUpper.includes('-TIC-') || codUpper.includes('-GTI-') || docArea.includes('tecnolog'))) return true;
            if (siglaMSel === 'GAD' && (codUpper.includes('-GAD-') || docArea.includes('administrativ'))) return true;
            if (siglaMSel === 'GFI' && (codUpper.includes('-GFI-') || docArea.includes('financier'))) return true;
            if (siglaMSel === 'GIC' && (codUpper.includes('-GIC-') || docArea.includes('calidad'))) return true;
            if (siglaMSel === 'GMD' && (codUpper.includes('-GMD-') || codUpper.includes('-FAR-') || docArea.includes('medica') || docArea.includes('farmaceut'))) return true;
          }
          return false;
        });
      }

      const setProcesos = new Set();
      docsParaProcesos.forEach((d) => {
        const p = (d.proceso || d.carpeta || '').trim();
        if (p && p !== 'N/A' && !p.toLowerCase().includes('.doc') && !listaMacroprocesos.map((m) => m.toLowerCase()).includes(p.toLowerCase())) {
          setProcesos.add(p);
        }
      });
      const procesosFinales = Array.from(setProcesos).sort((a, b) => a.localeCompare(b, 'es'));

      const procActual = this.filtroCalidadProceso || 'TODOS';
      const existeProcActual = procActual === 'TODOS' || procesosFinales.some((p) => this.normalizarTextoCalidad(p) === this.normalizarTextoCalidad(procActual));
      if (!existeProcActual) {
        this.filtroCalidadProceso = 'TODOS';
      }

      if (selectProcesos) {
        selectProcesos.innerHTML = `<option value="TODOS">Todos los Procesos (${procesosFinales.length})</option>` +
          procesosFinales.map((p) => {
            const isSelected = this.normalizarTextoCalidad(p) === this.normalizarTextoCalidad(this.filtroCalidadProceso);
            return `<option value="${p}" ${isSelected ? 'selected' : ''}>${p}</option>`;
          }).join('');
      }

      // 3. Filtrar documentos según Proceso para obtener Tipos de Documento disponibles
      let docsParaTipos = docsParaProcesos;
      const fProc = this.filtroCalidadProceso || 'TODOS';
      const normFProc = this.normalizarTextoCalidad(fProc);
      if (fProc !== 'TODOS') {
        docsParaTipos = docsParaProcesos.filter((d) => {
          const docProc = this.normalizarTextoCalidad(d.proceso || d.carpeta || d.area || '');
          return docProc.includes(normFProc) || normFProc.includes(docProc);
        });
      }

      const setTiposDoc = new Set();
      docsParaTipos.forEach((d) => {
        const t = (d.tipoDocumento || '').trim();
        if (t && t !== 'N/A') setTiposDoc.add(t);
      });
      const tiposFinales = Array.from(setTiposDoc).sort((a, b) => a.localeCompare(b, 'es'));

      const tipoActual = this.filtroCalidadTipoDoc || 'TODOS';
      const existeTipoActual = tipoActual === 'TODOS' || tiposFinales.some((t) => this.normalizarTextoCalidad(t) === this.normalizarTextoCalidad(tipoActual));
      if (!existeTipoActual) {
        this.filtroCalidadTipoDoc = 'TODOS';
      }

      if (selectTipoDoc) {
        selectTipoDoc.innerHTML = `<option value="TODOS">Todos los Tipos (${tiposFinales.length})</option>` +
          tiposFinales.map((t) => {
            const isSelected = this.normalizarTextoCalidad(t) === this.normalizarTextoCalidad(this.filtroCalidadTipoDoc);
            return `<option value="${t}" ${isSelected ? 'selected' : ''}>${t}</option>`;
          }).join('');
      }
    };

    // Poblar Selector de Macroprocesos
    if (selectMacro) {
      const macroActual = this.filtroCalidadMacroproceso || 'TODOS';
      selectMacro.innerHTML = `<option value="TODOS">Todos Macroproc. (${listaMacroprocesos.length})</option>` +
        listaMacroprocesos.map((m) => `<option value="${m}" ${this.normalizarTextoCalidad(m) === this.normalizarTextoCalidad(macroActual) ? 'selected' : ''}>${m}</option>`).join('');
    }

    actualizarCascadaCalidad();
    const renderTablaCalidad = () => {
      // 1. Calcular KPIs de Semáforo y Disponibilidad
      let vigentes = 0;
      let proximos = 0;
      let vencidos = 0;
      let revision = 0;
      let noDisponibles = 0;

      const docsEvaluados = docs.map((d) => {
        const v = this.evaluarVigenciaDoc(d);
        const spUrl = d.sharepointUrl || d.downloadUrl || '';
        const esDisponible = Boolean(d.disponible && d.disponible !== 'false' && spUrl && spUrl !== '#' && spUrl.trim() !== '');
        
        if (!esDisponible) noDisponibles++;
        if (v.estadoSemaforo === 'VIGENTE') vigentes++;
        else if (v.estadoSemaforo === 'PROXIMO') proximos++;
        else if (v.estadoSemaforo === 'VENCIDO') vencidos++;
        else if (v.estadoSemaforo === 'REVISION') revision++;
        return { doc: d, vigencia: v, esDisponible, spUrl };
      });

      const total = docs.length;
      const pctVigentes = total > 0 ? Math.round((vigentes / total) * 100) : 0;
      const pctProximos = total > 0 ? Math.round((proximos / total) * 100) : 0;
      const pctVencidos = total > 0 ? Math.round((vencidos / total) * 100) : 0;
      const pctRevision = total > 0 ? Math.round((revision / total) * 100) : 0;
      const pctNoDisp = total > 0 ? Math.round((noDisponibles / total) * 100) : 0;
      const saludGlobal = total > 0 ? Math.round(((vigentes + revision) / total) * 100) : 100;

      // Actualizar contadores superiores
      const elCountVig = document.getElementById('kpi-count-vigentes');
      const elPctVig = document.getElementById('kpi-pct-vigentes');
      const elCountProx = document.getElementById('kpi-count-proximos');
      const elPctProx = document.getElementById('kpi-pct-proximos');
      const elCountVenc = document.getElementById('kpi-count-vencidos');
      const elPctVenc = document.getElementById('kpi-pct-vencidos');
      const elCountRev = document.getElementById('kpi-count-revision');
      const elPctRev = document.getElementById('kpi-pct-revision');
      const elCountNoDisp = document.getElementById('kpi-count-nodisp');
      const elPctNoDisp = document.getElementById('kpi-pct-nodisp');
      const elFilterNoDisp = document.getElementById('count-filter-nodisp');
      const elSaludBadge = document.getElementById('calidad-salud-global-badge');
      const elCountTodos = document.getElementById('count-filter-todos');

      if (elCountVig) elCountVig.textContent = vigentes;
      if (elPctVig) elPctVig.textContent = `${pctVigentes}%`;
      if (elCountProx) elCountProx.textContent = proximos;
      if (elPctProx) elPctProx.textContent = `${pctProximos}%`;
      if (elCountVenc) elCountVenc.textContent = vencidos;
      if (elPctVenc) elPctVenc.textContent = `${pctVencidos}%`;
      if (elCountRev) elCountRev.textContent = revision;
      if (elPctRev) elPctRev.textContent = `${pctRevision}%`;
      if (elCountNoDisp) elCountNoDisp.textContent = noDisponibles;
      if (elPctNoDisp) elPctNoDisp.textContent = `${pctNoDisp}%`;
      if (elFilterNoDisp) elFilterNoDisp.textContent = noDisponibles;
      if (elCountTodos) elCountTodos.textContent = total;
      if (elSaludBadge) elSaludBadge.textContent = `Salud Documental: ${saludGlobal}%`;

      // 2. Aplicar filtros interactivos usando normalización
      const fSem = this.filtroCalidadSemaforo || 'TODOS';
      const fMacro = this.filtroCalidadMacroproceso || 'TODOS';
      const fArea = this.filtroCalidadArea || 'TODOS';
      const fProc = this.filtroCalidadProceso || 'TODOS';
      const fTipoDoc = this.filtroCalidadTipoDoc || 'TODOS';
      const q = this.normalizarTextoCalidad(this.busquedaCalidad || '');

      const normFMacro = this.normalizarTextoCalidad(fMacro);
      const normFArea = this.normalizarTextoCalidad(fArea);
      const normFProc = this.normalizarTextoCalidad(fProc);
      const normFTipo = this.normalizarTextoCalidad(fTipoDoc);

      const filtrados = docsEvaluados.filter(({ doc, vigencia, esDisponible }) => {
        // Filtro por Semáforo o Disponibilidad
        if (fSem === 'NO_DISPONIBLE') {
          if (esDisponible) return false;
        } else if (fSem !== 'TODOS') {
          if (vigencia.estadoSemaforo !== fSem) return false;
        }

        // Filtro Macroproceso (Tipo de Proceso)
        if (fMacro !== 'TODOS') {
          const docTp = this.normalizarTextoCalidad(doc.tipoProceso || '');
          if (!docTp.includes(normFMacro) && !normFMacro.includes(docTp)) return false;
        }

        // Filtro Área (compara por nombre o por sigla del maestro)
        if (fArea !== 'TODOS') {
          const docArea = this.normalizarTextoCalidad(doc.area || '');
          const codUpper = (doc.codigo || '').toUpperCase();
          const areaMaestra = maestrosAreas.find(
            (a) => this.normalizarTextoCalidad(a.nombre) === normFArea || (a.sigla && this.normalizarTextoCalidad(a.sigla) === normFArea)
          );
          const siglaMaestra = areaMaestra ? (areaMaestra.sigla || '').toUpperCase() : '';
          const nombreMaestro = areaMaestra ? this.normalizarTextoCalidad(areaMaestra.nombre) : normFArea;

          let coincide = (docArea === nombreMaestro) || docArea.includes(nombreMaestro) || nombreMaestro.includes(docArea);
          if (!coincide && siglaMaestra) {
            if (codUpper.includes(`-${siglaMaestra}-`) || codUpper.startsWith(`${siglaMaestra}-`)) coincide = true;
            if ((siglaMaestra === 'GHU' || siglaMaestra === 'GTH') && (codUpper.includes('-GTH-') || codUpper.includes('-GHU-') || codUpper.includes('-SST-') || docArea.includes('talento') || docArea.includes('humana') || docArea.includes('sst'))) coincide = true;
            if (siglaMaestra === 'GTI' && (codUpper.includes('-TIC-') || codUpper.includes('-GTI-') || docArea.includes('tecnolog'))) coincide = true;
            if (siglaMaestra === 'GAD' && (codUpper.includes('-GAD-') || docArea.includes('administrativ'))) coincide = true;
            if (siglaMaestra === 'GFI' && (codUpper.includes('-GFI-') || docArea.includes('financier'))) coincide = true;
            if (siglaMaestra === 'GIC' && (codUpper.includes('-GIC-') || docArea.includes('calidad'))) coincide = true;
            if (siglaMaestra === 'GMD' && (codUpper.includes('-GMD-') || codUpper.includes('-FAR-') || docArea.includes('medica') || docArea.includes('farmaceut'))) coincide = true;
          }
          if (!coincide) return false;
        }

        // Filtro Proceso
        if (fProc !== 'TODOS') {
          const docProc = this.normalizarTextoCalidad(doc.proceso || doc.carpeta || doc.area || '');
          if (!docProc.includes(normFProc) && !normFProc.includes(docProc)) return false;
        }

        // Filtro Tipo de Documento
        if (fTipoDoc !== 'TODOS') {
          const docTipo = this.normalizarTextoCalidad(doc.tipoDocumento || doc.codigo || '');
          const tipoObj = maestrosTiposDoc.find(
            (t) => this.normalizarTextoCalidad(t.prefijo) === normFTipo || this.normalizarTextoCalidad(t.nombre) === normFTipo
          );
          const pref = tipoObj ? this.normalizarTextoCalidad(tipoObj.prefijo) : normFTipo;
          const nom = tipoObj ? this.normalizarTextoCalidad(tipoObj.nombre) : normFTipo;

          const coincideTipo = docTipo.includes(pref) || docTipo.includes(nom) || (doc.codigo && this.normalizarTextoCalidad(doc.codigo).startsWith(pref));
          if (!coincideTipo) return false;
        }

        // Buscador
        if (!q) return true;
        const texto = this.normalizarTextoCalidad(`${doc.codigo || ''} ${doc.titulo || ''} ${doc.area || ''} ${doc.proceso || ''} ${doc.tipoDocumento || ''}`);
        return texto.includes(q);
      });

      if (filtrados.length === 0) {
        tbodyCalidad.innerHTML = `
          <tr>
            <td colspan="9" style="padding: 28px; text-align: center; color: #94a3b8;">
              <span style="font-size: 1.5rem; display: block; margin-bottom: 4px;">🔍</span>
              No se encontraron documentos de calidad con los filtros seleccionados.
            </td>
          </tr>
        `;
        return;
      }

      tbodyCalidad.innerHTML = filtrados
        .map(({ doc, vigencia, esDisponible, spUrl }) => {
          let rowBorderColor = '#16a34a';
          let rowBgColor = '#ffffff';
          if (!esDisponible) {
            rowBorderColor = '#dc2626';
            rowBgColor = '#fffafa';
          } else if (vigencia.estadoSemaforo === 'VENCIDO') {
            rowBorderColor = '#ef4444';
            rowBgColor = '#fff8f8';
          } else if (vigencia.estadoSemaforo === 'PROXIMO') {
            rowBorderColor = '#f59e0b';
            rowBgColor = '#fffdf7';
          } else if (vigencia.estadoSemaforo === 'REVISION') {
            rowBorderColor = '#0284c7';
            rowBgColor = '#f7fbff';
          }

          const tieneSpUrl = Boolean(spUrl && spUrl !== '#' && spUrl.trim() !== '');

          const nombreProceso = (doc.proceso && doc.proceso !== 'N/A' && !doc.proceso.includes('.doc') && !listaMacroprocesos.includes(doc.proceso))
            ? doc.proceso
            : (doc.area || 'Gestión Integral de Calidad');

          return `
            <tr style="border-bottom: 1px solid #e2e8f0; border-left: 3.5px solid ${rowBorderColor}; background: ${rowBgColor}; transition: background 0.15s ease;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='${rowBgColor}'">
              <td style="padding: 7px 9px; font-weight: 800; color: #1e3a8a; font-size: 0.77rem; white-space: nowrap;">
                ${doc.codigo || 'N/A'}
              </td>
              <td style="padding: 7px 9px; font-weight: 600; color: #1e293b; font-size: 0.77rem;" title="${doc.titulo || ''}">
                ${doc.titulo || 'Sin título'}
              </td>
              <td style="padding: 7px 9px; font-size: 0.72rem; color: #475569;">
                <div style="font-weight: 700; color: #334155;">${nombreProceso}</div>
                <div style="font-size: 0.68rem; color: #64748b;">${doc.tipoProceso || 'Misional'} • ${doc.area || ''}</div>
              </td>
              <td style="padding: 7px 9px; text-align: center; font-weight: 700; font-size: 0.74rem; color: #1e40af;">
                ${doc.version || '01'}
              </td>
              <td style="padding: 7px 9px; text-align: center; font-size: 0.72rem; color: #475569; white-space: nowrap;">
                ${vigencia.fechaAprobacionStr}
              </td>
              <td style="padding: 7px 9px; text-align: center; font-size: 0.72rem; font-weight: 700; color: #1e293b; white-space: nowrap;">
                ${vigencia.fechaVencimientoStr}
              </td>
              <td style="padding: 7px 9px; text-align: center; white-space: nowrap;">
                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 10px; font-size: 0.70rem; font-weight: 800; background: ${vigencia.bg}; color: ${vigencia.color}; border: 1px solid ${vigencia.border};">
                  <span>${vigencia.icono}</span> ${vigencia.etiqueta}
                </span>
              </td>
              <td style="padding: 7px 9px; text-align: center; white-space: nowrap;">
                ${esDisponible ? `
                  <span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 8px; font-size: 0.69rem; font-weight: 700; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;" title="Documento accesible y disponible en línea">
                    🟢 En Línea
                  </span>
                ` : `
                  <span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 8px; font-size: 0.69rem; font-weight: 800; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca;" title="Documento no disponible en línea / Sin enlace o archivo">
                    🔴 No Disponible
                  </span>
                `}
              </td>
              <td style="padding: 7px 9px; text-align: center; white-space: nowrap;">
                <div style="display: flex; gap: 4px; justify-content: center;">
                  <button type="button" class="btn-calidad-ver-drawer" data-doc-id="${doc.id || doc.codigo}" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 5px; padding: 3px 6px; font-size: 0.70rem; font-weight: 700; cursor: pointer;" title="Ver Ficha y Metadatos">
                    📄 Ficha
                  </button>
                  ${tieneSpUrl ? `
                    <a href="${spUrl}" target="_blank" rel="noopener noreferrer" style="background: #2563eb; color: #ffffff; border-radius: 5px; padding: 3px 6px; font-size: 0.70rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 2px;" title="Abrir en SharePoint">
                      ↗ SP
                    </a>
                  ` : `
                    <span style="color: #ef4444; font-weight: 700; font-size: 0.68rem;" title="Documento sin archivo en línea">Sin Archivo</span>
                  `}
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      tbodyCalidad.querySelectorAll('.btn-calidad-ver-drawer').forEach((btn) => {
        btn.addEventListener('click', () => {
          const docId = btn.getAttribute('data-doc-id');
          const doc = docs.find((d) => (d.id || d.codigo) === docId);
          if (doc && window.antigravityApp) {
            window.antigravityApp.abrirDrawer(doc);
          }
        });
      });
    };

    this.renderTablaCalidadActual = renderTablaCalidad;

    // Conectar botones de filtro rápido de semáforo
    const btnsSemaforo = document.querySelectorAll('.btn-calidad-filter');
    btnsSemaforo.forEach((btn) => {
      btn.addEventListener('click', () => {
        btnsSemaforo.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.filtroCalidadSemaforo = btn.getAttribute('data-filter') || 'TODOS';
        renderTablaCalidad();
      });
    });

    // Conectar clic en las tarjetas superiores KPI para filtrar
    const kpiCards = document.querySelectorAll('.kpi-calidad-card');
    kpiCards.forEach((card) => {
      card.addEventListener('click', () => {
        const sem = card.getAttribute('data-semaforo') || 'TODOS';
        this.filtroCalidadSemaforo = sem;
        btnsSemaforo.forEach((b) => {
          b.classList.toggle('active', (b.getAttribute('data-filter') || 'TODOS') === sem);
        });
        renderTablaCalidad();
      });
    });

    // Conectar select de Macroproceso
    selectMacro?.addEventListener('change', (e) => {
      this.filtroCalidadMacroproceso = e.target.value;
      actualizarCascadaCalidad();
      renderTablaCalidad();
    });

    // Conectar select de Área con actualización en cascada de Procesos
    selectArea?.addEventListener('change', (e) => {
      this.filtroCalidadArea = e.target.value;
      actualizarCascadaCalidad();
      renderTablaCalidad();
    });

    // Conectar select de Proceso
    selectProcesos?.addEventListener('change', (e) => {
      this.filtroCalidadProceso = e.target.value;
      actualizarCascadaCalidad();
      renderTablaCalidad();
    });

    // Conectar select de Tipo de Documento
    selectTipoDoc?.addEventListener('change', (e) => {
      this.filtroCalidadTipoDoc = e.target.value;
      renderTablaCalidad();
    });

    // Conectar Buscador
    const inputSearch = document.getElementById('search-calidad-input');
    inputSearch?.addEventListener('input', (e) => {
      this.busquedaCalidad = e.target.value;
      renderTablaCalidad();
    });

    // Conectar botón inline exportar
    document.getElementById('btn-exportar-calidad-inline')?.addEventListener('click', () => {
      this.exportarMatrizCalidadCSV(docs);
    });

    // Render inicial
    renderTablaCalidad();
  }

  inicializarAuditoriaDashboard() {
    const tbodyActividad = document.getElementById('tbody-audit-events-dashboard');
    const tbodyHistorico = document.getElementById('tbody-hist-events-dashboard');
    if (!tbodyActividad) return;

    // Estado local de filtros
    let filtroActividadActual = this.filtroAuditoriaActual || 'TODOS';
    let busquedaActividadActual = '';
    let filtroHistoricoActual = 'TODOS';
    let busquedaHistoricoActual = '';

    // ── 1. RENDER AUDITORÍA DE ACTIVIDAD Y ACCESOS ──
    const renderTablaAuditoria = () => {
      const eventos = staffService.obtenerRegistroAuditoria();

      // Calcular KPIs
      const logins = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'LOGIN').length;
      const downloads = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'DESCARGA').length;
      const folders = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'CARPETA').length;
      const creates = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'CREACION').length;
      const edits = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'EDICION').length;
      const elims = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'ELIMINACION').length;
      const security = eventos.filter((e) => (e.tipo || '').toUpperCase() === 'SEGURIDAD').length;
      const usersSet = new Set(eventos.map((e) => e.identificacion).filter(Boolean));

      const kpiLogins = document.getElementById('kpi-dash-logins');
      const kpiDownloads = document.getElementById('kpi-dash-downloads');
      const kpiFolders = document.getElementById('kpi-dash-folders');
      const kpiCreates = document.getElementById('kpi-dash-creates');
      const kpiEdits = document.getElementById('kpi-dash-edits');
      const kpiElims = document.getElementById('kpi-dash-elims');
      const kpiSecurity = document.getElementById('kpi-dash-security');
      const kpiUsers = document.getElementById('kpi-dash-users');
      if (kpiLogins) kpiLogins.textContent = logins;
      if (kpiDownloads) kpiDownloads.textContent = downloads;
      if (kpiFolders) kpiFolders.textContent = folders;
      if (kpiCreates) kpiCreates.textContent = creates;
      if (kpiEdits) kpiEdits.textContent = edits;
      if (kpiElims) kpiElims.textContent = elims;
      if (kpiSecurity) kpiSecurity.textContent = security;
      if (kpiUsers) kpiUsers.textContent = usersSet.size;

      const q = (busquedaActividadActual || '').toLowerCase().trim();
      const fTipoUpper = (filtroActividadActual || 'TODOS').toUpperCase();

      const filtrados = eventos.filter((ev) => {
        const evTipoUpper = (ev.tipo || '').toUpperCase();
        if (fTipoUpper !== 'TODOS') {
          if (fTipoUpper === 'METADATOS') {
            if (!['METADATOS', 'CAMBIO_METADATOS', 'CAMBIO_RUTA', 'CAMBIO_TIPO'].includes(evTipoUpper)) return false;
          } else if (evTipoUpper !== fTipoUpper) {
            return false;
          }
        }
        if (!q) return true;
        const texto = `${ev.usuario || ''} ${ev.identificacion || ''} ${ev.cargo || ''} ${ev.documentoCodigo || ''} ${ev.documentoTitulo || ''} ${ev.detalle || ''}`.toLowerCase();
        return texto.includes(q);
      });

      filtrados.sort((a, b) => {
        const tA = staffService.parsearFechaMilisegundos(a.fechaHora || a.timestamp);
        const tB = staffService.parsearFechaMilisegundos(b.fechaHora || b.timestamp);
        if (tB !== tA) return tB - tA;
        return (b.id || '').localeCompare(a.id || '');
      });

      if (filtrados.length === 0) {
        tbodyActividad.innerHTML = `
          <tr>
            <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8;">
              No se encontraron eventos de actividad con los filtros aplicados.
            </td>
          </tr>`;
        return;
      }

      tbodyActividad.innerHTML = filtrados
        .map((ev) => {
          let badgeEvento = '';
          const tipoNorm = (ev.tipo || '').toUpperCase();
          if (tipoNorm === 'LOGIN') {
            badgeEvento = '<span class="audit-badge audit-badge-login" style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">🟢 Inicio Sesión</span>';
          } else if (tipoNorm === 'CONSULTA') {
            badgeEvento = '<span class="audit-badge audit-badge-consulta" style="background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">🔍 Consulta</span>';
          } else if (tipoNorm === 'DESCARGA') {
            badgeEvento = '<span class="audit-badge audit-badge-download" style="background:#edf5fa; color:var(--brand-navy, #1f4260); border:1px solid #cddde9; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">📥 Descarga</span>';
          } else if (tipoNorm === 'CARPETA') {
            badgeEvento = '<span class="audit-badge audit-badge-folder" style="background:#fef9c3; color:#854d0e; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">📁 Carpeta</span>';
          } else if (tipoNorm === 'CREACION') {
            badgeEvento = '<span class="audit-badge" style="background:#ecfdf5; color:#059669; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #a7f3d0;">✨ Creación</span>';
          } else if (tipoNorm === 'EDICION') {
            badgeEvento = '<span class="audit-badge audit-badge-edit" style="background:#f3e8ff; color:#6b21a8; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">✏️ Edición</span>';
          } else if (tipoNorm === 'METADATOS' || tipoNorm === 'CAMBIO_METADATOS') {
            badgeEvento = '<span class="audit-badge audit-badge-meta" style="background:#faf5ff; color:#7c3aed; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #e9d5ff;">📋 Metadatos</span>';
          } else if (tipoNorm === 'ELIMINACION') {
            badgeEvento = '<span class="audit-badge" style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #fecaca;">🗑️ Eliminación</span>';
          } else if (tipoNorm === 'SEGURIDAD') {
            badgeEvento = '<span class="audit-badge audit-badge-security" style="background:#fef2f2; color:#b91c1c; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #fecaca;">🔑 Seguridad / Clave</span>';
          } else {
            const labelCapitalized = ev.tipo ? (ev.tipo.charAt(0).toUpperCase() + ev.tipo.slice(1).toLowerCase()) : 'Actividad';
            badgeEvento = `<span class="audit-badge" style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">ℹ️ ${labelCapitalized}</span>`;
          }

          let badgePerfil = '';
          const perfNorm = (ev.perfil || '').toLowerCase();
          if (perfNorm === 'total' || perfNorm === 'administrador') {
            badgePerfil = '<span class="audit-badge-profile" style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #bae6fd; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">🛡️ Acceso Total</span>';
          } else if (perfNorm === 'directivo') {
            badgePerfil = '<span class="audit-badge-profile" style="background:#fffbeb; color:#b45309; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #fde68a; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">👑 Directivo</span>';
          } else if (perfNorm === 'administrativo') {
            badgePerfil = '<span class="audit-badge-profile" style="background:#f0fdfa; color:#0f766e; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #99f6e4; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">💼 Administrativo</span>';
          } else {
            badgePerfil = '<span class="audit-badge-profile" style="background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #a7f3d0; display:inline-flex; align-items:center; gap:4px; white-space:nowrap;">👷 Operativo</span>';
          }

          let detalleDoc = '-';
          if (ev.documentoCodigo || ev.documentoTitulo) {
            detalleDoc = `
              <div style="font-weight: 700; color: #1e293b;">${ev.documentoCodigo || ''}</div>
              <div style="font-size: 0.74rem; color: #64748b;">${ev.documentoTitulo || ''}</div>
            `;
          } else if (ev.detalle) {
            detalleDoc = `<div style="font-size: 0.74rem; color: #475569;">${ev.detalle}</div>`;
          }

          return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
              <td style="padding: 8px 12px; white-space: nowrap; color: #64748b; font-family: monospace; font-size: 0.75rem;">
                ${staffService.formatearFechaHora(ev.fechaHora || ev.timestamp)}
              </td>
              <td style="padding: 8px 12px; white-space: nowrap;">
                ${badgeEvento}
              </td>
              <td style="padding: 8px 12px;">
                <div style="font-weight: 700; color: #0f172a;">${ev.usuario || 'Colaborador'}</div>
                <div style="font-size: 0.72rem; color: #64748b;">${ev.cargo || ''}</div>
              </td>
              <td style="padding: 8px 12px; white-space: nowrap;">
                ${badgePerfil}
              </td>
              <td style="padding: 8px 12px;">
                ${detalleDoc}
              </td>
            </tr>
          `;
        })
        .join('');
    };

    // ── 2. RENDER CONTROL DE CAMBIOS DOCUMENTALES (HISTÓRICO) ──
    const renderTablaHistorico = () => {
      if (!tbodyHistorico) return;
      const eventosHistCrudo = staffService.obtenerHistoricoDocumental();
      const snapshotBase = staffService.obtenerSnapshotDocumentos() || {};

      const mapaDocs = new Map();
      (this.documentosActuales || []).forEach((d) => {
        if (d && d.codigo) {
          mapaDocs.set(d.codigo.trim().toUpperCase(), d);
        }
      });

      const eventosHist = (eventosHistCrudo || []).map((ev) => {
        if (!ev || !ev.codigo) return null;
        const codUpper = (ev.codigo || '').trim().toUpperCase();
        const docCat = mapaDocs.get(codUpper) || snapshotBase[codUpper];
        const fMod = (ev.fechaModificacionActual || docCat?.modificacion || ev.fechaHora || '').trim();

        const rutaCompleta = (docCat && (docCat.proceso || docCat.area || docCat.tipoProceso))
          ? `${docCat.tipoProceso || 'Misional'} / ${docCat.area || ''} / ${docCat.proceso || ''}`.replace(/\s*\/\s*\/\s*/g, ' / ').replace(/^\s*\/\s*|\s*\/\s*$/g, '')
          : (ev.rutaNueva && ev.rutaNueva !== 'N/A' ? ev.rutaNueva : (ev.rutaAnterior || 'N/A'));

        return {
          ...ev,
          codigo: codUpper,
          titulo: ev.titulo || docCat?.titulo || 'Documento Institucional',
          rutaNueva: rutaCompleta,
          fechaModificacionActual: fMod
        };
      }).filter(Boolean);

      // Calcular KPIs de Histórico
      const creaciones = eventosHist.filter((e) => (e.tipoEvento || '').toUpperCase() === 'CREACION').length;
      const versiones = eventosHist.filter((e) => (e.tipoEvento || '').toUpperCase() === 'CAMBIO_VERSION').length;
      const metadatos = eventosHist.filter((e) => ['CAMBIO_METADATOS', 'CAMBIO_RUTA', 'CAMBIO_TIPO', 'METADATOS'].includes((e.tipoEvento || '').toUpperCase())).length;
      const ediciones = eventosHist.filter((e) => ['EDICION_SHAREPOINT', 'EDICION'].includes((e.tipoEvento || '').toUpperCase())).length;
      const eliminaciones = eventosHist.filter((e) => (e.tipoEvento || '').toUpperCase() === 'ELIMINACION').length;
      const autoresSet = new Set(eventosHist.map((e) => e.identificacion || e.usuario).filter(Boolean));

      const kpiCreaciones = document.getElementById('kpi-hist-creaciones');
      const kpiVersiones = document.getElementById('kpi-hist-versiones');
      const kpiMetadatos = document.getElementById('kpi-hist-metadatos');
      const kpiEdiciones = document.getElementById('kpi-hist-ediciones');
      const kpiEliminaciones = document.getElementById('kpi-hist-eliminaciones');
      const kpiAutores = document.getElementById('kpi-hist-autores');
      if (kpiCreaciones) kpiCreaciones.textContent = creaciones;
      if (kpiVersiones) kpiVersiones.textContent = versiones;
      if (kpiMetadatos) kpiMetadatos.textContent = metadatos;
      if (kpiEdiciones) kpiEdiciones.textContent = ediciones;
      if (kpiEliminaciones) kpiEliminaciones.textContent = eliminaciones;
      if (kpiAutores) kpiAutores.textContent = autoresSet.size;

      const q = (busquedaHistoricoActual || '').toLowerCase().trim();
      const fTipoUpper = (filtroHistoricoActual || 'TODOS').toUpperCase();

      let filtrados = eventosHist.filter((ev) => {
        const evTipoUpper = (ev.tipoEvento || '').toUpperCase();
        if (fTipoUpper !== 'TODOS') {
          if (fTipoUpper === 'METADATOS') {
            if (!['CAMBIO_METADATOS', 'CAMBIO_RUTA', 'CAMBIO_TIPO', 'METADATOS'].includes(evTipoUpper)) return false;
          } else if (fTipoUpper === 'EDICION_SHAREPOINT') {
            if (!['EDICION_SHAREPOINT', 'EDICION'].includes(evTipoUpper)) return false;
          } else if (evTipoUpper !== fTipoUpper) {
            return false;
          }
        }
        if (!q) return true;
        const texto = `${ev.codigo || ''} ${ev.titulo || ''} ${ev.usuario || ''} ${ev.identificacion || ''} ${ev.detalle || ''} ${ev.motivo || ''} ${ev.tipoNuevo || ''}`.toLowerCase();
        return texto.includes(q);
      });

      // Filtrar eventos inconsistentes (ej. versiones con nombres de áreas o versiones idénticas)
      filtrados = filtrados.filter((ev) => {
        const tipoNorm = (ev.tipoEvento || '').toUpperCase();
        if (tipoNorm === 'CAMBIO_VERSION') {
          const vA = (ev.versionAnterior || '').trim();
          const vN = (ev.versionNueva || '').trim();
          if (staffService.sonVersionesIguales(vA, vN)) return false;
          if (vA.length > 8 || vN.length > 8 || /[a-záéíóúñ]/i.test(vA.replace(/^v/i, '')) || /[a-záéíóúñ]/i.test(vN.replace(/^v/i, ''))) {
            return false;
          }
        }
        return true;
      });

      if (filtrados.length === 0) {
        tbodyHistorico.innerHTML = `
          <tr>
            <td colspan="7" style="padding: 24px; text-align: center; color: #94a3b8;">
              No se encontraron registros de control de cambios con los filtros aplicados.
            </td>
          </tr>`;
        return;
      }

      // Ordenar rigurosamente por fecha de evento más reciente primero (Descendente)
      filtrados.sort((a, b) => {
        const getT = (item) => {
          return staffService.parsearFechaMilisegundos(item.fechaHora || item.timestamp || item.fechaModificacionActual);
        };
        const tA = getT(a);
        const tB = getT(b);
        if (tB !== tA) return tB - tA;
        return (b.id || '').localeCompare(a.id || '');
      });

      tbodyHistorico.innerHTML = filtrados
        .map((ev) => {
          let badgeEvento = '';
          const tipoNorm = (ev.tipoEvento || '').toUpperCase();
          if (tipoNorm === 'CREACION') {
            badgeEvento = '<span style="background:#dcfce7; color:#15803d; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #bbf7d0;">🆕 Creado</span>';
          } else if (tipoNorm === 'CAMBIO_VERSION') {
            badgeEvento = '<span style="background:#edf5fa; color:var(--brand-navy, #1f4260); padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #cddde9;">🔄 Versión</span>';
          } else if (tipoNorm === 'CAMBIO_RUTA' || tipoNorm === 'CAMBIO_TIPO' || tipoNorm === 'CAMBIO_METADATOS' || tipoNorm === 'METADATOS') {
            badgeEvento = '<span style="background:#faf5ff; color:#7c3aed; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #e9d5ff;">📋 Metadatos</span>';
          } else if (tipoNorm === 'ELIMINACION') {
            badgeEvento = '<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #fecaca;">❌ Eliminado</span>';
          } else if (tipoNorm === 'EDICION_SHAREPOINT' || tipoNorm === 'EDICION') {
            badgeEvento = '<span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem; border:1px solid #cbd5e1;">✏️ Edición SP</span>';
          } else {
            badgeEvento = `<span style="background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:12px; font-weight:700; font-size:0.72rem;">ℹ️ ${ev.tipoEvento || 'Modificación'}</span>`;
          }

          const docCat = mapaDocs.get((ev.codigo || '').trim().toUpperCase());
          const fDocReal = staffService.formatearFechaHora(
            ev.fechaHora || ev.timestamp || ev.fechaModificacionActual || docCat?.modificacion || '-'
          );
          const fAnt = staffService.formatearFechaHora(ev.fechaModificacionPrevia || ev.modificacionPrevia || 'N/A');
          const vAnt = staffService.formatearVersion(ev.versionAnterior || docCat?.version || '01');
          const vNueva = staffService.formatearVersion(ev.versionNueva || docCat?.version || '01');
          const motivoCambio = (ev.motivo || ev.tipoCambio || docCat?.tipoCambio || '').trim();

          let detalleCambioHtml = '';

          if (tipoNorm === 'ELIMINACION') {
            const motivoElim = ev.motivo || ev.detalle || docCat?.motivo || 'Baja y retiro oficial del catálogo institucional.';
            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: #b91c1c; font-weight: 700;">Documento retirado del catálogo oficial (${vNueva || vAnt})</div>
                <div style="margin-top: 2px; color: #475569;">
                  <strong>Motivo:</strong> ${motivoElim}
                </div>
              </div>
            `;
          } else if (tipoNorm === 'CREACION') {
            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: #15803d; font-weight: 700;">Creación inicial en catálogo maestro</div>
                <div style="margin-top: 2px; color: #475569;">
                  Versión inicial: <strong>${vNueva}</strong> &bull; Estado: Vigente
                </div>
              </div>
            `;
          } else if (tipoNorm === 'CAMBIO_VERSION') {
            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: var(--brand-navy, #1f4260); font-weight: 700;">Actualización de versión: <strong>${vAnt} ➔ ${vNueva}</strong></div>
                ${motivoCambio ? `<div style="margin-top: 2px; color: #475569;"><strong>Motivo:</strong> ${motivoCambio}</div>` : ''}
              </div>
            `;
          } else if (tipoNorm === 'CAMBIO_RUTA' || tipoNorm === 'CAMBIO_TIPO' || tipoNorm === 'CAMBIO_METADATOS' || tipoNorm === 'METADATOS') {
            const cambios = [];
            if (ev.tipoAnterior && ev.tipoNuevo && ev.tipoAnterior !== ev.tipoNuevo && ev.tipoAnterior !== 'N/A' && ev.tipoNuevo !== 'N/A') {
              cambios.push(`Tipo de doc: <strong>${ev.tipoAnterior} ➔ ${ev.tipoNuevo}</strong>`);
            }
            if (ev.versionAnterior && ev.versionNueva && ev.versionAnterior !== ev.versionNueva && ev.versionAnterior !== 'N/A') {
              cambios.push(`Versión: <strong>${staffService.formatearVersion(ev.versionAnterior)} ➔ ${staffService.formatearVersion(ev.versionNueva)}</strong>`);
            }
            if (ev.motivo && ev.motivo !== 'N/A') {
              cambios.push(`<strong>Motivo:</strong> ${ev.motivo}`);
            }
            const textoMetadatos = cambios.length > 0 
              ? cambios.join(' &bull; ') 
              : (ev.detalle && !ev.detalle.toLowerCase().includes('cambio de contenido') ? ev.detalle : 'Modificación y actualización de metadatos del documento.');

            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: #7c3aed; font-weight: 700;">Modificación de metadatos</div>
                <div style="margin-top: 2px; color: #475569;">
                  ${textoMetadatos}
                </div>
              </div>
            `;
          } else if (tipoNorm === 'EDICION_SHAREPOINT' || tipoNorm === 'EDICION') {
            let edicionFechas = '';
            if (fAnt && fAnt !== 'N/A' && fAnt !== fDocReal) {
              edicionFechas = `Edición previa: <span style="font-family:monospace;">${fAnt}</span> ➔ Edición reciente: <span style="font-family:monospace; font-weight:700; color:#0f766e;">${fDocReal}</span>`;
            } else if (ev.fechaModificacionActual && ev.fechaModificacionActual !== 'N/A' && ev.fechaModificacionActual !== fDocReal) {
              const fModActualFormateada = staffService.formatearFechaHora(ev.fechaModificacionActual);
              edicionFechas = `Registro de sesión: <span style="font-family:monospace; font-weight:700; color:#0f766e;">${fDocReal}</span> &bull; Modificación archivo: <span style="font-family:monospace; color:#475569;">${fModActualFormateada}</span>`;
            } else {
              edicionFechas = `Fecha de modificación: <span style="font-family:monospace; font-weight:700; color:#0f766e;">${fDocReal}</span>`;
            }
            const desc = ev.detalle && !ev.detalle.toLowerCase().includes('fecha de modificación') ? ev.detalle : 'Modificación de archivo en SharePoint Online';
            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: #334155; font-weight: 700;">${desc}</div>
                <div style="margin-top: 2px; color: #475569;">
                  ${edicionFechas}
                </div>
              </div>
            `;
          } else {
            detalleCambioHtml = `
              <div style="font-size: 0.75rem; line-height: 1.45; color: #334155;">
                <div style="color: #475569; font-weight: 700;">${ev.tipoEvento || 'Modificación'}</div>
                <div style="margin-top: 2px; color: #64748b;">${ev.detalle || 'Control de cambios registrado.'}</div>
              </div>
            `;
          }

          const fechaPrincipal = fDocReal;

          // Enlace directo a Microsoft SharePoint
          const urlSharepoint = ev.sharepointUrl || docCat?.sharepointUrl || docCat?.downloadUrl;
          let enlaceSharepointHtml = '<span style="color:#94a3b8; font-size:0.72rem;">N/A</span>';
          if (urlSharepoint && urlSharepoint !== '#') {
            enlaceSharepointHtml = `
              <a 
                href="${urlSharepoint}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="btn btn-secondary" 
                title="Abrir documento en Microsoft SharePoint"
                style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 8px; font-size: 0.72rem; font-weight: 700; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; text-decoration: none; border-radius: 5px;"
              >
                🌐 Abrir SP
              </a>
            `;
          }

          return `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease;">
              <td style="padding: 8px 10px; white-space: nowrap; color: #64748b; font-family: monospace; font-size: 0.74rem;">
                ${fechaPrincipal}
              </td>
              <td style="padding: 8px 10px; white-space: nowrap;">
                ${badgeEvento}
              </td>
              <td style="padding: 8px 10px; font-weight: 800; color: #0f172a; white-space: nowrap;">
                ${ev.codigo || '-'}
              </td>
              <td style="padding: 8px 10px;">
                <div style="font-weight: 600; color: #1e293b; line-height: 1.3; font-size: 0.82rem;">${ev.titulo || docCat?.titulo || '-'}</div>
              </td>
              <td style="padding: 8px 10px;">
                ${detalleCambioHtml}
              </td>
              <td style="padding: 8px 10px; text-align: center; white-space: nowrap;">
                ${enlaceSharepointHtml}
              </td>
              <td style="padding: 8px 10px; white-space: nowrap;">
                <div style="font-weight: 700; color: #0f172a; font-size: 0.78rem;">${ev.usuario || 'Gestor'}</div>
                <div style="font-size: 0.71rem; color: #64748b;">${ev.cargo || ''}</div>
              </td>
            </tr>
          `;
        })
        .join('');
    };

    this.renderTablaAuditoriaActual = renderTablaAuditoria;
    this.renderTablaHistoricoActual = renderTablaHistorico;

    // Render inicial
    renderTablaAuditoria();
    renderTablaHistorico();

    // Filtros de botones de evento de Actividad
    this.container.querySelectorAll('#group-audit-filters-dashboard .btn-audit-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('#group-audit-filters-dashboard .btn-audit-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filtroActividadActual = btn.getAttribute('data-audit-filter');
        this.filtroAuditoriaActual = filtroActividadActual;
        renderTablaAuditoria();
      });
    });

    // Búsqueda en vivo de Actividad
    const inputSearchAct = this.container.querySelector('#search-audit-input-dashboard');
    if (inputSearchAct) {
      inputSearchAct.addEventListener('input', (e) => {
        busquedaActividadActual = e.target.value;
        renderTablaAuditoria();
      });
    }

    // Filtros de botones de Control de Cambios (Histórico)
    this.container.querySelectorAll('#group-hist-filters-dashboard .btn-hist-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('#group-hist-filters-dashboard .btn-hist-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        filtroHistoricoActual = btn.getAttribute('data-hist-filter');
        renderTablaHistorico();
      });
    });

    // Búsqueda en vivo de Histórico
    const inputSearchHist = this.container.querySelector('#search-hist-input-dashboard');
    if (inputSearchHist) {
      inputSearchHist.addEventListener('input', (e) => {
        busquedaHistoricoActual = e.target.value;
        renderTablaHistorico();
      });
    }

    // Botón manual de Sincronización en vivo con Google Drive
    const btnSyncAuditoria = this.container.querySelector('#btn-sync-auditoria-ahora');
    const iconSyncSpin = this.container.querySelector('#icon-sync-spin');
    const badgeSyncStatus = this.container.querySelector('#badge-audit-sync-status');
    if (btnSyncAuditoria) {
      btnSyncAuditoria.addEventListener('click', async () => {
        btnSyncAuditoria.disabled = true;
        if (iconSyncSpin) {
          iconSyncSpin.style.display = 'inline-block';
          iconSyncSpin.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 800, iterations: Infinity });
        }
        if (badgeSyncStatus) {
          badgeSyncStatus.innerHTML = '<span style="width: 7px; height: 7px; background: #eab308; border-radius: 50%; display: inline-block;"></span> Sincronizando con Google...';
          badgeSyncStatus.style.background = '#fef9c3';
          badgeSyncStatus.style.color = '#854d0e';
          badgeSyncStatus.style.borderColor = '#fef08a';
        }
        try {
          const res = await staffService.sincronizarAuditoria(true);
          renderTablaAuditoria();
          if (badgeSyncStatus) {
            badgeSyncStatus.innerHTML = res.huboCambios
              ? '✅ ¡Nuevos registros sincronizados!'
              : '<span style="width: 7px; height: 7px; background: #16a34a; border-radius: 50%; display: inline-block;"></span> Google Drive Sincronizado';
            badgeSyncStatus.style.background = '#dcfce7';
            badgeSyncStatus.style.color = '#166534';
            badgeSyncStatus.style.borderColor = '#bbf7d0';
          }
        } catch (e) {
          if (badgeSyncStatus) {
            badgeSyncStatus.innerHTML = '⚠️ Error en sincronización';
          }
        } finally {
          btnSyncAuditoria.disabled = false;
        }
      });
    }

    // Exportar CSV de Control de Cambios Documentales
    const btnExportHist = this.container.querySelector('#btn-export-hist-csv');
    if (btnExportHist) {
      btnExportHist.addEventListener('click', () => {
        const csvContent = staffService.exportarHistoricoDocumentalCSV(filtroHistoricoActual, busquedaHistoricoActual);
        if (!csvContent) {
          alert('No hay registros de control de cambios documentales para exportar con los filtros seleccionados.');
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
    }
  }
}

export const analyticsManager = new AnalyticsManager();

// Actualización reactiva en tiempo real al registrarse o sincronizarse eventos sin requerir F5
window.addEventListener('agy_audit_event_logged', () => {
  if (analyticsManager && typeof analyticsManager.renderTablaAuditoriaActual === 'function') {
    analyticsManager.renderTablaAuditoriaActual();
  }
});

window.addEventListener('agy_doc_history_logged', () => {
  if (analyticsManager && typeof analyticsManager.renderTablaHistoricoActual === 'function') {
    analyticsManager.renderTablaHistoricoActual();
  }
});

// Sincronización automática de auditoría al reenfocar o volver a la pestaña activa del navegador
window.addEventListener('focus', () => {
  if (analyticsManager && analyticsManager.pestanaActiva === 'auditoria' && !document.hidden) {
    staffService.sincronizarAuditoria(true);
  }
});

document.addEventListener('visibilitychange', () => {
  if (analyticsManager && analyticsManager.pestanaActiva === 'auditoria' && !document.hidden) {
    staffService.sincronizarAuditoria(true);
  }
});
