/**
 * GOOGLE APPS SCRIPT - SGC UNIÓN PARA LA SALUD Y LA VIDA SAS
 * Control Centralizado de Usuarios, Auditoría, Tablas Maestras y Biblioteca Documental en Google Sheets
 * ID Hoja de Cálculo: 1EOcucjQV4byUOp_AAfd1ySHk4tVdFmMeOoOQsSBbEa4
 * ID Archivo usuarios.conf: 1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl
 * ID Archivo auditoria.dat: 1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR
 * ID Archivo maestro.dat: 1NycmHFf8iAko2XsHIi9dmfe-lK6utpek
 */

const DEFAULT_FILE_ID = '1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl'; // usuarios.conf
const AUDITORIA_FILE_ID = '1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR'; // auditoria.dat
const MAESTRO_FILE_ID = '1NycmHFf8iAko2XsHIi9dmfe-lK6utpek'; // maestro.dat
const HISTORICO_FILE_ID = '1dsnwbq3qDwDnbz7QtcZf374M5ltucB8m'; // Historico_Documentos_USV.csv
const SPREADSHEET_DOCS_ID = '1EOcucjQV4byUOp_AAfd1ySHk4tVdFmMeOoOQsSBbEa4';
const HISTORICO_CSV_NAME = 'Historico_Documentos_USV.csv';

const HEADERS_SHEET = [
  'Fecha de aprobacion',
  'Tipo de documento',
  'Area',
  'Consecutivo',
  'Codigo',
  'Nombre del documento',
  'Version',
  'Vigencia',
  'Ubicación',
  'Tipo de proceso',
  'Proceso',
  'Directivo',
  'Administrativo',
  'Operativo',
  'Descargable',
  'Tiempo',
  'Lugar',
  'Tipo de cambio',
  'Fecha de vencimiento',
  'Estado actual'
];

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action.toLowerCase() : '';

    // 1. Obtener listado de documentos desde Google Sheets
    if (action === 'documentos' || action === 'get_docs') {
      const docs = obtenerDocumentosDeSheet();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', total: docs.length, documentos: docs }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Obtener auditoria.dat
    if (action === 'auditoria') {
      const fileAud = DriveApp.getFileById(AUDITORIA_FILE_ID);
      const content = fileAud.getBlob().getDataAsString();
      return ContentService.createTextOutput(content || '{"version":"1.0","registroAuditoria":[]}')
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Obtener maestro.dat (Tablas Maestras)
    if (action === 'maestras' || action === 'maestro') {
      const fileMae = DriveApp.getFileById(MAESTRO_FILE_ID);
      const content = fileMae.getBlob().getDataAsString();
      return ContentService.createTextOutput(content || '{"version":"1.0","tablasMaestras":{}}')
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Obtener Historico_Documentos_USV.csv
    if (action === 'historico' || action === 'cambios') {
      const targetHistId = (e && e.parameter && e.parameter.fileId) ? e.parameter.fileId : HISTORICO_FILE_ID;
      const historicoList = obtenerHistoricoDeCsv(targetHistId);
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', total: historicoList.length, historicoDocumental: historicoList }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4.5 Backup Completo Consolidado (Para snapshots automáticos de GitHub Actions y auditoría)
    if (action === 'backup_completo' || action === 'backup') {
      const docs = obtenerDocumentosDeSheet();
      let confObj = {};
      let audObj = {};
      let maeObj = {};
      try {
        const fConf = DriveApp.getFileById(DEFAULT_FILE_ID);
        confObj = JSON.parse(fConf.getBlob().getDataAsString() || '{}');
      } catch (eC) { }
      try {
        const fAud = DriveApp.getFileById(AUDITORIA_FILE_ID);
        audObj = JSON.parse(fAud.getBlob().getDataAsString() || '{}');
      } catch (eA) { }
      try {
        const fMae = DriveApp.getFileById(MAESTRO_FILE_ID);
        maeObj = JSON.parse(fMae.getBlob().getDataAsString() || '{}');
      } catch (eM) { }

      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        totalDocumentos: docs.length,
        totalUsuarios: Object.keys(confObj.usuariosRegistrados || {}).length,
        totalAuditoria: (audObj.registroAuditoria || []).length,
        documentos: docs,
        usuariosConf: confObj,
        auditoriaDat: audObj,
        maestroDat: maeObj
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 5. Obtener usuarios.conf o archivo por fileId
    const targetId = (e && e.parameter && e.parameter.fileId) ? e.parameter.fileId : DEFAULT_FILE_ID;
    const file = DriveApp.getFileById(targetId);
    const content = file.getBlob().getDataAsString();
    return ContentService.createTextOutput(content || '{}')
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    let dataObj = null;

    try {
      dataObj = JSON.parse(body);
    } catch (parseErr) {}

    if (!dataObj) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: 'Cuerpo de solicitud inválido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const accion = dataObj.accion ? dataObj.accion.toLowerCase() : '';

    // A. CREAR DOCUMENTO EN GOOGLE SHEETS
    if (accion === 'crear_documento') {
      const res = crearDocumentoEnSheet(dataObj.documento);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // B. MODIFICAR DOCUMENTO EN GOOGLE SHEETS
    if (accion === 'modificar_documento') {
      const res = modificarDocumentoEnSheet(dataObj.codigo, dataObj.documento || dataObj);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // C. ELIMINAR / RETIRAR DOCUMENTO EN GOOGLE SHEETS
    if (accion === 'eliminar_documento') {
      const res = eliminarDocumentoEnSheet(dataObj.codigo, dataObj.motivo, dataObj.borradoFisico, dataObj.esRegistro, dataObj.titulo);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // D. SINCRONIZACIÓN COMPLETA DE DOCUMENTOS (BATCH)
    if (accion === 'sincronizar_documentos' && Array.isArray(dataObj.documentos)) {
      const res = sincronizarLoteDocumentosEnSheet(dataObj.documentos, dataObj.headers);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // E. GUARDAR EXCLUSIVAMENTE HISTÓRICO EN Historico_Documentos_USV.csv
    if (accion === 'guardar_historico' || (Array.isArray(dataObj.historicoDocumental) && !dataObj.usuariosRegistrados)) {
      if (Array.isArray(dataObj.historicoDocumental) && dataObj.historicoDocumental.length > 0) {
        actualizarHistoricoCsvEnDrive(dataObj.historicoDocumental, dataObj.fileId);
      }
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'ok', 
        mensaje: 'Historico_Documentos_USV.csv actualizado con éxito en Google Drive' 
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // E.2 GUARDAR AUDITORÍA ACUMULATIVA EN auditoria.dat (Sin sobreescritura destructiva ni límite artificial)
    if (accion === 'guardar_auditoria' || dataObj.fileId === AUDITORIA_FILE_ID || (dataObj.registroAuditoria && !dataObj.usuariosRegistrados)) {
      const resAudit = actualizarAuditoriaDatEnDrive(dataObj);
      return ContentService.createTextOutput(JSON.stringify(resAudit))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // F. GUARDAR CONFIGURACIÓN CON FUSIÓN ATÓMICA (usuarios.conf)
    // Modelo Append-Only & Deep Merge: NUNCA sobreescribe destructivamente ni borra usuarios existentes
    const resConf = actualizarConfiguracionConMerge(dataObj);
    return ContentService.createTextOutput(JSON.stringify(resConf))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ----------------------------------------------------
// FUNCIONES DE MANIPULACIÓN DE GOOGLE SHEETS
// ----------------------------------------------------

function obtenerSheetActiva() {
  try {
    const ssActive = SpreadsheetApp.getActiveSpreadsheet();
    if (ssActive) return ssActive.getSheets()[0];
  } catch (e) {}
  const ss = SpreadsheetApp.openById(SPREADSHEET_DOCS_ID);
  return ss.getSheets()[0];
}

function obtenerDocumentosDeSheet() {
  const sheet = obtenerSheetActiva();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(h => String(h || '').trim());
  const docs = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || !row[4]) continue;

    const docObj = {};
    for (let c = 0; c < headers.length; c++) {
      docObj[headers[c]] = row[c];
    }
    docs.push(docObj);
  }
  return docs;
}

function normalizarFilaDocumento(doc) {
  const codUpper = (doc.codigo || doc['Codigo'] || doc['Código'] || '').trim().toUpperCase();
  const partesCod = codUpper.split('-');
  
  // 1. Sigla de Tipo de Documento
  let tipoDocSigla = doc.tipoDocumento || doc['Tipo de documento'] || doc.tipo || (partesCod[0] || 'DA');
  const MAPA_SIGLAS_TIPO = {
    'INSTRUCTIVO': 'INS',
    'FORMATO': 'FMT',
    'DOCUMENTO ANEXO': 'DA',
    'GUÍA': 'GUA',
    'GUIA': 'GUA',
    'MANUAL': 'MN',
    'POLÍTICA': 'POL',
    'POLITICA': 'POL',
    'PROCEDIMIENTO': 'PRC',
    'PROGRAMA': 'PRG',
    'PROTOCOLO': 'PRT',
    'REGLAMENTO': 'RG',
    'PLAN': 'PLA'
  };
  if (MAPA_SIGLAS_TIPO[tipoDocSigla.toUpperCase()]) {
    tipoDocSigla = MAPA_SIGLAS_TIPO[tipoDocSigla.toUpperCase()];
  } else if (partesCod[0]) {
    tipoDocSigla = partesCod[0];
  }

  // 2. Sigla de Área
  let areaSigla = doc.area || doc['Area'] || (partesCod[1] || 'GMD');
  const MAPA_SIGLAS_AREA = {
    'GESTIÓN INTEGRAL CALIDAD': 'GIC',
    'GESTION INTEGRAL CALIDAD': 'GIC',
    'GESTIÓN INTEGRAL DE CALIDAD': 'GIC',
    'GESTIÓN TALENTO HUMANO': 'GTH',
    'GESTION TALENTO HUMANO': 'GTH',
    'GESTIÓN DEL TALENTO HUMANO': 'GTH',
    'SEGURIDAD Y SALUD EN EL TRABAJO': 'SST',
    'GESTIÓN MÉDICA': 'GMD',
    'GESTION MEDICA': 'GMD',
    'GESTIÓN FARMACÉUTICA': 'FAR',
    'GESTION FARMACEUTICA': 'FAR',
    'GESTIÓN ADMINISTRATIVA Y FINANCIERA': 'GFI',
    'GESTIÓN TECNOLOGÍAS DE LA INFORMACIÓN': 'GTI',
    'GESTIÓN TECNOLOGÍA INFORMACIÓN': 'GTI',
    'GESTIÓN AUDITORÍA': 'GAU'
  };
  if (MAPA_SIGLAS_AREA[areaSigla.toUpperCase()]) {
    areaSigla = MAPA_SIGLAS_AREA[areaSigla.toUpperCase()];
  } else if (partesCod[1]) {
    areaSigla = partesCod[1];
  }

  // 3. Consecutivo numérico o con sufijo secundario (ej: 016 o 016-1)
  let consecutivo = doc.consecutivo || doc['Consecutivo'] || (partesCod.length >= 4 ? partesCod.slice(2).join('-') : (partesCod[2] || '001'));
  if (/^\d+$/.test(consecutivo)) {
    consecutivo = String(consecutivo).padStart(3, '0');
  }

  // 4. Tipo de Proceso: Conservar fielmente la clasificación previa del documento (sin calcular por área)
  let tipoProceso = doc.tipoProceso || doc['Tipo de proceso'] || doc['Tipo de Proceso'] || doc.tipo_proceso || '';
  tipoProceso = String(tipoProceso).trim();
  if (!tipoProceso) {
    tipoProceso = 'Misional';
  }

  // 5. Fecha de Aprobación y Vigencia
  const hoyStr = new Date().toLocaleDateString('es-CO');
  const fechaAprobacion = doc.fechaAprobacion || doc['Fecha de aprobacion'] || hoyStr;
  const vigencia = doc.vigencia || doc['Vigencia'] || fechaAprobacion;

  // 6. Fecha de Vencimiento (+5 años por defecto)
  let fechaVencimiento = doc.fechaVencimiento || doc['Fecha de vencimiento'] || '';
  if (!fechaVencimiento && vigencia) {
    const p = vigencia.split('/');
    if (p.length === 3) {
      const year = parseInt(p[2], 10);
      if (!isNaN(year)) {
        fechaVencimiento = String(p[0]).padStart(2, '0') + '/' + String(p[1]).padStart(2, '0') + '/' + (year + 5);
      }
    }
  }
  if (!fechaVencimiento) {
    const yActual = new Date().getFullYear();
    fechaVencimiento = '01/08/' + (yActual + 5);
  }

  // 7. Estado del ciclo de vida (NUNCA "DISPONIBLE" / "NO DISPONIBLE")
  let estadoDoc = doc.estado || doc['Estado actual'] || doc.estadoDocumento || 'Activo';
  if (estadoDoc === 'DISPONIBLE' || estadoDoc === 'NO DISPONIBLE') {
    estadoDoc = 'Activo';
  }

  // 8. Lugar
  let lugar = doc.lugar || doc['Lugar'] || 'Archivo Digital';
  if (lugar === 'Gestión Integral de Calidad' || lugar === areaSigla) {
    lugar = 'Archivo Digital';
  }

  // Permisos RBAC estrictos (solo 'X', 'SI', true devuelven 'X'; vacío o falso devuelve '')
  const checkPerm = function(val1, val2, val3) {
    const v = (val1 !== undefined && val1 !== null && val1 !== '') ? val1 :
              ((val2 !== undefined && val2 !== null && val2 !== '') ? val2 : val3);
    if (v === true || v === 'X' || v === 'x' || v === 'SI' || v === 'SÍ' || v === 'TRUE' || v === '1') return 'X';
    return '';
  };

  const directivoVal = checkPerm(doc.permisoDirectivo, doc.directivo, doc['Directivo']);
  const adminVal = checkPerm(doc.permisoAdministrativo, doc.administrativo, doc['Administrativo']);
  const operativoVal = checkPerm(doc.permisoOperativo, doc.operativo, doc['Operativo']);

  // Descargable
  let descVal = 'SI';
  const rawDesc = (doc.descargable !== undefined && doc.descargable !== null) ? doc.descargable : doc['Descargable'];
  if (rawDesc === false || rawDesc === 'NO' || rawDesc === 'FALSE') {
    descVal = 'NO';
  }

  return [
    fechaAprobacion,
    tipoDocSigla,
    areaSigla,
    consecutivo,
    codUpper,
    doc.titulo || doc.nombre || doc['Nombre del documento'] || doc['Documento'] || '',
    doc.version || doc['Version'] || doc['Versión'] || '1',
    vigencia,
    doc.ubicacion || doc['Ubicación'] || doc['Ubicacion'] || 'Intranet',
    tipoProceso,
    doc.proceso || doc['Proceso'] || doc.carpeta || 'Gestión Integral de Calidad',
    directivoVal,
    adminVal,
        operativoVal,
        descVal,
        doc.tiempoRetencion || doc.tiempo || doc['Tiempo'] || '5 Años',
        lugar,
        doc.tipoCambio || doc['Tipo de cambio'] || 'Creación del documento',
        fechaVencimiento,
        estadoDoc
    ];
}

function crearDocumentoEnSheet(doc) {
  if (!doc || !doc.codigo) {
    return { status: 'error', error: 'El documento no contiene un código válido.' };
  }
  const sheet = obtenerSheetActiva();
  const codigoUpper = String(doc.codigo).trim().toUpperCase();
  const esRegistro = (doc.subclase === 'Registro' || doc.esRegistro === true);
  const data = sheet.getDataRange().getValues();

  let codIdx = 4;
  let tituloIdx = 5;
  let subclaseIdx = -1;
  if (data.length > 0) {
    const headers = data[0].map(h => String(h || '').trim().toLowerCase());
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      if (h === 'codigo' || h === 'código') {
        codIdx = c;
      }
      if (h === 'nombre del documento' || h === 'documento' || h === 'titulo' || h === 'título') {
        tituloIdx = c;
      }
      if (h === 'subclase' || h === 'nivel' || h === 'nivel documental') {
        subclaseIdx = c;
      }
    }
  }

  // Validar código duplicado: si es Registro, permitir mismo código si el título es diferente
  for (let r = 1; r < data.length; r++) {
    const rowCod = String(data[r][codIdx] || '').trim().toUpperCase();
    if (rowCod === codigoUpper) {
      if (!esRegistro) {
        return { status: 'error', error: 'Ya existe un documento registrado con el código ' + codigoUpper };
      } else {
        const rowTitulo = String(data[r][tituloIdx] || '').trim().toLowerCase();
        const nuevoTitulo = String(doc.titulo || doc.nombre || '').trim().toLowerCase();
        if (rowTitulo === nuevoTitulo) {
          return { status: 'error', error: 'Ya existe un registro con este mismo nombre para el código ' + codigoUpper };
        }
      }
    }
  }

  const fila = normalizarFilaDocumento(doc);
  if (subclaseIdx >= 0) {
    while (fila.length <= subclaseIdx) fila.push('');
    fila[subclaseIdx] = esRegistro ? 'Registro' : 'Base';
  }
  sheet.appendRow(fila);

  return { status: 'ok', mensaje: 'Documento creado exitosamente en Google Sheets', codigo: codigoUpper };
}

function modificarDocumentoEnSheet(codigo, docActualizado) {
  if (!codigo) {
    return { status: 'error', error: 'Código de documento requerido.' };
  }
  const sheet = obtenerSheetActiva();
  const codigoUpper = String(codigo).trim().toUpperCase();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', error: 'No hay datos en la hoja' };

  const headers = data[0].map(h => String(h || '').trim());
  let codIdx = 4;
  let tituloIdx = 5;
  let tipoDocIdx = 1;
  for (let c = 0; c < headers.length; c++) {
    const hNorm = headers[c].toLowerCase();
    if (hNorm === 'codigo' || hNorm === 'código') {
      codIdx = c;
    } else if (hNorm === 'nombre del documento' || hNorm === 'documento' || hNorm === 'titulo' || hNorm === 'título') {
      tituloIdx = c;
    } else if (hNorm === 'subclase' || hNorm === 'nivel' || hNorm === 'nivel documental') {
      subclaseIdx = c;
    } else if (hNorm === 'tipo de documento' || hNorm === 'tipo documento' || hNorm === 'tipo') {
      tipoDocIdx = c;
    }
  }

  const esRegistro = Boolean(docActualizado && (docActualizado.esRegistro === true || docActualizado.subclase === 'Registro' || (docActualizado.id && String(docActualizado.id).includes('_REG_'))));
  const normalizarTxt = function(t) {
    return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  };
  const tituloBuscarNorm = normalizarTxt(docActualizado ? (docActualizado.tituloAnterior || docActualizado.titulo || docActualizado.nombre || '') : '');

  for (let r = 1; r < data.length; r++) {
    const rowCod = String(data[r][codIdx] || '').trim().toUpperCase();
    if (rowCod === codigoUpper) {
      const rowTitulo = String(data[r][tituloIdx] || '');
      const rowTitNorm = normalizarTxt(rowTitulo);
      const rowSubclase = subclaseIdx >= 0 ? String(data[r][subclaseIdx] || '').trim().toLowerCase() : '';
      const rowTipoDoc = tipoDocIdx >= 0 ? String(data[r][tipoDocIdx] || '').trim().toLowerCase() : '';

      if (esRegistro) {
        // Un registro derivado NUNCA debe sobreescribir la fila del documento base ni formatos principales
        if (rowSubclase === 'base' || rowTipoDoc === 'formato' || rowTipoDoc === 'manual' || rowTipoDoc === 'politica' || rowTipoDoc === 'guia') {
          continue;
        }
        // Para registros derivados, buscar la fila que corresponda al título anterior o nuevo
        let coincide = false;
        if (tituloBuscarNorm && (rowTitNorm === tituloBuscarNorm || rowTitNorm.includes(tituloBuscarNorm) || tituloBuscarNorm.includes(rowTitNorm))) {
          coincide = true;
        }
        if (!coincide) {
          continue;
        }
      } else {
        // Para documentos base, omitir filas que sean registros derivados
        if (rowSubclase === 'registro' || rowTipoDoc === 'registro') {
          continue;
        }
      }

      const existingRow = data[r];
      const mapExisting = {};
      for (let c = 0; c < headers.length; c++) {
        mapExisting[headers[c]] = existingRow[c];
      }

      // Preservar metadatos y actualizar fielmente respetando el orden oficial de columnas
      const mergedDoc = {
        fechaAprobacion: mapExisting['Fecha de aprobacion'] || mapExisting['Fecha de aprobación'] || existingRow[0],
        tipoDocumento: docActualizado.tipoDocumento || mapExisting['Tipo de documento'] || existingRow[1],
        area: docActualizado.area || mapExisting['Area'] || mapExisting['Área'] || existingRow[2],
        consecutivo: mapExisting['Consecutivo'] || existingRow[3],
        codigo: codigoUpper,
        titulo: docActualizado.titulo || docActualizado.documento || docActualizado.nombre || mapExisting['Nombre del documento'] || existingRow[5],
        version: docActualizado.version || mapExisting['Version'] || mapExisting['Versión'] || existingRow[6],
        vigencia: docActualizado.vigencia || mapExisting['Vigencia'] || existingRow[7] || '01/08/2026',
        ubicacion: docActualizado.ubicacion || mapExisting['Ubicación'] || mapExisting['Ubicacion'] || existingRow[8] || 'Intranet',
        tipoProceso: docActualizado.tipoProceso || mapExisting['Tipo de proceso'] || mapExisting['Tipo de Proceso'] || existingRow[9] || 'Misional',
        proceso: docActualizado.proceso || docActualizado.carpeta || mapExisting['Proceso'] || existingRow[10],
        permisoDirectivo: docActualizado.permisoDirectivo !== undefined ? docActualizado.permisoDirectivo : (docActualizado.directivo !== undefined ? docActualizado.directivo : (mapExisting['Directivo'] !== undefined ? mapExisting['Directivo'] : existingRow[11])),
        permisoAdministrativo: docActualizado.permisoAdministrativo !== undefined ? docActualizado.permisoAdministrativo : (docActualizado.administrativo !== undefined ? docActualizado.administrativo : (mapExisting['Administrativo'] !== undefined ? mapExisting['Administrativo'] : existingRow[12])),
        permisoOperativo: docActualizado.permisoOperativo !== undefined ? docActualizado.permisoOperativo : (docActualizado.operativo !== undefined ? docActualizado.operativo : (mapExisting['Operativo'] !== undefined ? mapExisting['Operativo'] : existingRow[13])),
        descargable: docActualizado.descargable !== undefined ? docActualizado.descargable : (mapExisting['Descargable'] !== undefined ? mapExisting['Descargable'] : existingRow[14]),
        tiempo: docActualizado.tiempoRetencion || docActualizado.tiempo || mapExisting['Tiempo'] || existingRow[15] || '5 Años',
        lugar: docActualizado.lugar || docActualizado.lugarArchivo || mapExisting['Lugar'] || existingRow[16] || 'Oficina Central y sede',
        tipoCambio: docActualizado.tipoCambio || mapExisting['Tipo de cambio'] || existingRow[17] || 'Creación del documento',
        fechaVencimiento: docActualizado.fechaVencimiento || mapExisting['Fecha de vencimiento'] || existingRow[18],
        estado: docActualizado.estado || docActualizado.estadoDocumento || mapExisting['Estado actual'] || existingRow[19] || 'Activo'
      };

      const fila = normalizarFilaDocumento(mergedDoc);
      if (subclaseIdx >= 0) {
        while (fila.length <= subclaseIdx) fila.push('');
        fila[subclaseIdx] = esRegistro ? 'Registro' : (existingRow[subclaseIdx] || 'Base');
      }
      const range = sheet.getRange(r + 1, 1, 1, fila.length);
      range.setValues([fila]);
      return { status: 'ok', mensaje: (esRegistro ? 'Registro derivado de ' : 'Documento ') + codigoUpper + ' modificado exitosamente en Google Sheets' };
    }
  }

  return crearDocumentoEnSheet({ ...docActualizado, codigo: codigoUpper });
}

function eliminarDocumentoEnSheet(codigo, motivo, borradoFisico, esRegistro = false, titulo = '') {
  if (!codigo) {
    return { status: 'error', error: 'Código de documento requerido.' };
  }
  const sheet = obtenerSheetActiva();
  const codigoUpper = String(codigo).trim().toUpperCase();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', error: 'No hay datos en la hoja' };

  const headers = data[0].map(h => String(h || '').trim());
  let codIdx = 4;
  let tituloIdx = 5;
  let subclaseIdx = -1;
  let estadoIdx = 19; // Columna 20 por defecto
  let cambioIdx = 17; // Columna 18 por defecto

  for (let c = 0; c < headers.length; c++) {
    const hNorm = headers[c].toLowerCase();
    if (hNorm === 'codigo' || hNorm === 'código') {
      codIdx = c;
    } else if (hNorm === 'nombre del documento' || hNorm === 'documento' || hNorm === 'titulo' || hNorm === 'título') {
      tituloIdx = c;
    } else if (hNorm === 'subclase' || hNorm === 'nivel' || hNorm === 'nivel documental') {
      subclaseIdx = c;
    } else if (hNorm === 'estado actual' || hNorm === 'estado') {
      estadoIdx = c;
    } else if (hNorm === 'tipo de cambio' || hNorm === 'tipo cambio' || hNorm === 'cambio') {
      cambioIdx = c;
    }
  }

  // Política de Calidad: Soft-Delete obligatorio para trazabilidad documental.
  // El borrado físico solo se permite con autorización explícita de purga permanente.
  const isFisico = (borradoFisico === 'CONFIRMAR_BORRADO_PERMANENTE' || borradoFisico === 'PURGA_AUTORIZADA');
  const esReg = Boolean(esRegistro);
  const tituloBuscar = titulo ? String(titulo).trim().toLowerCase() : '';

  for (let r = 1; r < data.length; r++) {
    const rowCod = String(data[r][codIdx] || '').trim().toUpperCase();
    if (rowCod === codigoUpper) {
      const rowTitulo = String(data[r][tituloIdx] || '').trim().toLowerCase();
      const rowSubclase = subclaseIdx >= 0 ? String(data[r][subclaseIdx] || '').trim().toLowerCase() : '';

      if (esReg) {
        if (tituloBuscar && rowTitulo !== tituloBuscar && !rowTitulo.includes(tituloBuscar) && !tituloBuscar.includes(rowTitulo)) {
          continue;
        }
      } else {
        if (rowSubclase === 'registro') continue;
      }

      if (isFisico) {
        sheet.deleteRow(r + 1);
        return { status: 'ok', mensaje: (esReg ? 'Registro derivado de ' : 'Documento ') + codigoUpper + ' eliminado físicamente de Google Sheets (Purga permanente)' };
      } else {
        sheet.getRange(r + 1, estadoIdx + 1).setValue('Inactivo / Retirado');
        const motivoRetiro = motivo ? String(motivo).trim() : 'Retirado del listado activo por actualización documental';
        sheet.getRange(r + 1, cambioIdx + 1).setValue('Retirado: ' + motivoRetiro);
        return { 
          status: 'ok', 
          mensaje: (esReg ? 'Registro derivado de ' : 'Documento ') + codigoUpper + ' marcado como Inactivo / Retirado (Soft-Delete seguro)',
          softDelete: true 
        };
      }
    }
  }

  return { status: 'error', error: 'No se encontró el ' + (esReg ? 'registro derivado' : 'documento') + ' ' + codigoUpper + ' en Google Sheets.' };
}

function sincronizarLoteDocumentosEnSheet(documentos, headersCustom) {
  if (!Array.isArray(documentos)) return { status: 'error', error: 'Lista de documentos no válida.' };
  const sheet = obtenerSheetActiva();
  
  const headersFinales = (Array.isArray(headersCustom) && headersCustom.length > 0) ? headersCustom : HEADERS_SHEET;
  const filas = [headersFinales];
  documentos.forEach(doc => {
    if (doc && doc.codigo) {
      filas.push(normalizarFilaDocumento(doc));
    }
  });

  sheet.clearContents();
  sheet.getRange(1, 1, filas.length, headersFinales.length).setValues(filas);

  return { status: 'ok', mensaje: 'Se sincronizaron ' + (filas.length - 1) + ' documentos en Google Sheets con éxito.' };
}

function actualizarAuditoriaDatEnDrive(dataObj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Esperar hasta 30s para atomicidad y evitar colisiones concurrentes
  } catch (eLock) {
    Logger.log('Lock error: ' + eLock.message);
  }

  try {
    const fileId = dataObj.fileId || AUDITORIA_FILE_ID;
    const fileAud = DriveApp.getFileById(fileId);
    
    // 1. Leer contenido actual de auditoria.dat en Google Drive
    let existingContent = {};
    try {
      const raw = fileAud.getBlob().getDataAsString();
      if (raw && raw.trim().startsWith('{')) {
        existingContent = JSON.parse(raw);
      }
    } catch (eParse) {
      existingContent = {};
    }

    const existingEvents = Array.isArray(existingContent.registroAuditoria) ? existingContent.registroAuditoria : [];
    const incomingEvents = Array.isArray(dataObj.registroAuditoria) 
      ? dataObj.registroAuditoria 
      : (Array.isArray(dataObj.eventosNuevos) ? dataObj.eventosNuevos : (dataObj.tipo ? [dataObj] : []));

    if (incomingEvents.length === 0 && existingEvents.length > 0) {
      return { status: 'ok', mensaje: 'Sin eventos nuevos para procesar', total: existingEvents.length };
    }

    // 2. Fusión deduplicada por id o clave compuesta
    const mapAud = new Map();
    let nuevosAgregados = 0;

    // Primero incorporar los existentes en Drive
    for (let i = 0; i < existingEvents.length; i++) {
      const ev = existingEvents[i];
      if (ev && typeof ev === 'object') {
        const k = ev.id || `${ev.tipo}_${ev.identificacion || ev.usuario}_${ev.documentoCodigo || ''}_${ev.fechaHora || ev.timestamp}`;
        if (!mapAud.has(k)) {
          mapAud.set(k, ev);
        }
      }
    }

    const existingCount = mapAud.size;

    // Luego incorporar los entrantes
    for (let i = 0; i < incomingEvents.length; i++) {
      const ev = incomingEvents[i];
      if (ev && typeof ev === 'object') {
        const k = ev.id || `${ev.tipo}_${ev.identificacion || ev.usuario}_${ev.documentoCodigo || ''}_${ev.fechaHora || ev.timestamp}`;
        if (!mapAud.has(k)) {
          mapAud.set(k, ev);
          nuevosAgregados++;
        }
      }
    }

    // Si no hubo ningún registro nuevo y el total es idéntico, NO sobreescribir el archivo en Google Drive (evita versiones basura)
    if (nuevosAgregados === 0 && mapAud.size === existingCount && existingEvents.length > 0) {
      return { 
        status: 'ok', 
        mensaje: 'Auditoría ya sincronizada (sin cambios, no se requiere nueva versión en Drive)', 
        total: mapAud.size,
        nuevos: 0 
      };
    }

    // 3. Ordenar cronológicamente descendente (el más reciente arriba) - Historial ilimitado sin cortes
    const listaConsolidada = Array.from(mapAud.values());
    listaConsolidada.sort(function(a, b) {
      const msA = parsearFechaMilisegundosGas(a.fechaHora || a.timestamp);
      const msB = parsearFechaMilisegundosGas(b.fechaHora || b.timestamp);
      return msB - msA;
    });

    const resultadoFinal = {
      version: '1.0',
      empresa: 'Unión para la salud y la vida S.A.S.',
      ultimaActualizacion: new Date().toISOString(),
      registroAuditoria: listaConsolidada
    };

    // 4. Escribir únicamente cuando hay cambios reales
    fileAud.setContent(JSON.stringify(resultadoFinal, null, 2));

    return { 
      status: 'ok', 
      mensaje: 'Auditoría consolidada e incremental actualizada en Google Drive', 
      total: listaConsolidada.length,
      nuevos: nuevosAgregados
    };
  } catch (err) {
    Logger.log('Error en actualizarAuditoriaDatEnDrive: ' + err.message);
    return { status: 'error', error: err.message };
  } finally {
    try {
      lock.releaseLock();
    } catch (eRelease) { }
  }
}

function parsearFechaMilisegundosGas(val) {
  if (!val) return 0;
  const s = String(val).trim().replace(/\s+/g, ' ');
  if (s.indexOf('T') !== -1 || /^\d{4}-\d{2}-\d{2}/.test(s)) {
    try {
      const ms = new Date(s).getTime();
      if (!isNaN(ms) && ms > 0) return ms;
    } catch (e) { }
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    try {
      const d = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10) - 1;
      const a = parseInt(m[3], 10);
      const h = m[4] ? parseInt(m[4], 10) : 0;
      const min = m[5] ? parseInt(m[5], 10) : 0;
      const seg = m[6] ? parseInt(m[6], 10) : 0;
      return new Date(a, mes, d, h, min, seg).getTime();
    } catch (e) { }
  }
  return 0;
}

function actualizarHistoricoCsvEnDrive(historico, fileIdCustom) {
  try {
    if (!Array.isArray(historico) || historico.length === 0) return;

    const headers = [
      'id',
      'tipoEvento',
      'codigo',
      'titulo',
      'versionAnterior',
      'versionNueva',
      'rutaAnterior',
      'rutaNueva',
      'tipoAnterior',
      'tipoNuevo',
      'usuario',
      'identificacion',
      'cargo',
      'perfil',
      'detalle',
      'fechaModificacionPrevia',
      'fechaModificacionActual',
      'sharepointUrl',
      'fechaHora',
      'timestamp'
    ];

    const escapeCsv = function(val) {
      const s = (val === null || val === undefined) ? '' : String(val);
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const filas = [];
    filas.push(headers.map(escapeCsv).join(';'));

    for (let i = 0; i < historico.length; i++) {
      const ev = historico[i];
      if (!ev) continue;
      filas.push([
        escapeCsv(ev.id || ''),
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
        escapeCsv(ev.fechaModificacionPrevia || ''),
        escapeCsv(ev.fechaModificacionActual || ''),
        escapeCsv(ev.sharepointUrl || ''),
        escapeCsv(ev.fechaHora || ''),
        escapeCsv(ev.timestamp || '')
      ].join(';'));
    }

    const csvContent = '\uFEFF' + filas.join('\r\n');

    // 1. Si se proporciona un ID de archivo específico o el oficial HISTORICO_FILE_ID
    const targetId = fileIdCustom || HISTORICO_FILE_ID;
    if (targetId) {
      try {
        const targetFile = DriveApp.getFileById(targetId);
        targetFile.setContent(csvContent);
        return { status: 'ok', mensaje: 'Historico CSV actualizado por targetId ' + targetId };
      } catch (eId) {
        Logger.log('Error actualizando por targetId: ' + eId.message);
      }
    }

    // 2. Buscar todos los archivos con nombre HISTORICO_CSV_NAME en Google Drive y actualizarlos todos
    const files = DriveApp.getFilesByName(HISTORICO_CSV_NAME);
    let count = 0;
    while (files.hasNext()) {
      const csvFile = files.next();
      csvFile.setContent(csvContent);
      count++;
    }
    if (count === 0) {
      DriveApp.createFile(HISTORICO_CSV_NAME, csvContent, MimeType.CSV);
    }
  } catch (csvErr) {
    Logger.log('Error al actualizar Historico_Documentos_USV.csv: ' + csvErr.message);
  }
}

function obtenerHistoricoDeCsv(fileIdCustom) {
  try {
    let content = '';
    const targetId = fileIdCustom || HISTORICO_FILE_ID;
    if (targetId) {
      try {
        const file = DriveApp.getFileById(targetId);
        content = file.getBlob().getDataAsString();
      } catch (eId) {
        Logger.log('Error obteniendo por targetId: ' + eId.message);
      }
    }
    if (!content) {
      const files = DriveApp.getFilesByName(HISTORICO_CSV_NAME);
      if (files.hasNext()) {
        const file = files.next();
        content = file.getBlob().getDataAsString();
      }
    }
    if (!content || !content.trim()) return [];

    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l && l.trim());
    if (lines.length <= 1) return [];

    const sep = lines[0].includes(';') ? ';' : ',';
    const parseCsvLine = function(text) {
      const p = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
          if (inQuotes && text[i+1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === sep && !inQuotes) {
          p.push(cur);
          cur = '';
        } else {
          cur += c;
        }
      }
      p.push(cur);
      return p;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.trim());
    const lista = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols || cols.length === 0 || !cols[2]) continue;
      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        obj[headers[c]] = cols[c] !== undefined ? cols[c] : '';
      }
      lista.push(obj);
    }

    return lista;
  } catch (e) {
    Logger.log('Error leyendo Historico CSV: ' + e.message);
    return [];
  }
}

/**
 * Fusión Atómica y Conservativa de Configuración y Usuarios (usuarios.conf)
 * Garantiza modelo Append-Only: Jamás borra usuarios existentes ni sobreescribe credenciales válidas
 */
function actualizarConfiguracionConMerge(dataObj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // 20 segundos de espera para sincronización atómica
  } catch (eLock) {
    Logger.log('Aviso lock usuarios.conf: ' + eLock.message);
  }

  try {
    const targetId = dataObj.fileId || DEFAULT_FILE_ID;
    const fileConf = DriveApp.getFileById(targetId);
    let confExistente = {};
    try {
      const raw = fileConf.getBlob().getDataAsString();
      if (raw && raw.trim().startsWith('{')) {
        confExistente = JSON.parse(raw);
      }
    } catch (eParse) {
      Logger.log('Error parseando conf existente: ' + eParse.message);
      confExistente = {};
    }

    const usuariosActuales = confExistente.usuariosRegistrados || {};
    const usuariosEntrantes = dataObj.usuariosRegistrados || {};
    const perfilesActuales = confExistente.perfilesPersonalizados || {};
    const perfilesEntrantes = dataObj.perfilesPersonalizados || {};

    // 1. Fusión de Usuarios: Modelo Append-Only & Conservativo
    const usuariosFusionados = { ...usuariosActuales };
    let nuevosContados = 0;
    let actualizadosContados = 0;

    for (const key of Object.keys(usuariosEntrantes)) {
      const uIn = usuariosEntrantes[key];
      if (!uIn) continue;

      if (!usuariosFusionados[key]) {
        // Usuario nuevo: agregarlo de forma segura
        usuariosFusionados[key] = uIn;
        nuevosContados++;
      } else {
        // Usuario ya existente: actualizar datos respetando integridad de clave
        const uExistente = usuariosFusionados[key];
        usuariosFusionados[key] = {
          ...uExistente,
          ...uIn,
          // Preservar hash de clave salvo que el nuevo sea explícito y válido
          passwordHash: (uIn.passwordHash && String(uIn.passwordHash).length > 10) ? uIn.passwordHash : uExistente.passwordHash,
          // Preservar fecha original de registro
          fechaRegistro: uExistente.fechaRegistro || uIn.fechaRegistro || new Date().toISOString(),
          // Preservar el último ingreso más reciente cronológicamente
          ultimoIngreso: (uIn.ultimoIngreso && uIn.ultimoIngreso > (uExistente.ultimoIngreso || '')) ? uIn.ultimoIngreso : (uExistente.ultimoIngreso || uIn.ultimoIngreso)
        };
        actualizadosContados++;
      }
    }

    // 2. Fusión de Perfiles y Metadatos de Personalización
    const perfilesFusionados = {
      ...perfilesActuales,
      ...perfilesEntrantes
    };

    // 3. Documento final consolidado
    const confFinal = {
      ...confExistente,
      ...dataObj,
      usuariosRegistrados: usuariosFusionados,
      perfilesPersonalizados: perfilesFusionados,
      ultimaActualizacion: new Date().toISOString()
    };

    delete confFinal.historicoDocumental;
    delete confFinal.fileId;
    delete confFinal.accion;

    // 4. Escribir a Google Drive
    fileConf.setContent(JSON.stringify(confFinal, null, 2));

    // Si viene histórico adjunto, sincronizarlo en su respectivo CSV
    if (Array.isArray(dataObj.historicoDocumental) && dataObj.historicoDocumental.length > 0) {
      actualizarHistoricoCsvEnDrive(dataObj.historicoDocumental, dataObj.historicoFileId);
    }

    return {
      status: 'ok',
      mensaje: 'usuarios.conf consolidado con éxito en Google Drive (Fusión segura)',
      totalUsuarios: Object.keys(usuariosFusionados).length,
      nuevos: nuevosContados,
      actualizados: actualizadosContados
    };
  } catch (err) {
    Logger.log('Error en actualizarConfiguracionConMerge: ' + err.message);
    return { status: 'error', error: err.message };
  } finally {
    try {
      lock.releaseLock();
    } catch (eRel) { }
  }
}


