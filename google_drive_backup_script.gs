/**
 * GOOGLE APPS SCRIPT - SGC UNIÓN PARA LA SALUD Y LA VIDA SAS
 * Control Centralizado de Usuarios Administrativos, Tablas Maestras, Biblioteca Documental e Histórico
 * 
 * Fuentes activas:
 * - Biblioteca_Documental: Google Sheet (25 columnas oficiales)
 * - Historico_Documentos: Google Sheet (5 columnas oficiales)
 * - usuarios.conf: Archivo JSON en Google Drive (Credenciales, configuración y favoritos de administradores)
 * - maestro.dat: Archivo JSON en Google Drive (Tablas Maestras)
 */

const DEFAULT_FILE_ID = '1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl'; // usuarios.conf
const MAESTRO_FILE_ID = '1NycmHFf8iAko2XsHIi9dmfe-lK6utpek'; // maestro.dat
const SPREADSHEET_DOCS_ID = '1ecwTurb2IyuO9qs4_PkAsQrULENh3J-RXEWbl5Ihhug'; // Biblioteca_Documental
const SPREADSHEET_HISTORICO_ID = '1kJjohcWIVYrAhIMrZwWfzex5zQXT769ZmAEmDlAUykk'; // Historico_Documentos

const HEADERS_HISTORICO_SHEET = ['Fecha y hora', 'Usuario administrador', 'Codigo', 'Tipo de cambio', 'Detalle'];

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
  'Estado actual',
  'Fecha y hora de creacion',
  'Fecha y hora de modificación',
  'Vinculo ubicacion',
  'Vinculo directo',
  'Descargas'
];

// ============================================================================
// FUNCIONES AUXILIARES DE VÍNCULOS E HISTÓRICO
// ============================================================================

function derivarVinculoUbicacion(url) {
  if (!url || typeof url !== 'string') return '';
  var clean = url.split('?')[0].trim();
  if (clean.slice(-1) === '/') clean = clean.slice(0, -1);
  var idxSlash = clean.lastIndexOf('/');
  return idxSlash > 0 ? clean.substring(0, idxSlash) : clean;
}

function derivarVinculoEdicion(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.indexOf('download=1') !== -1) {
    return url.replace('download=1', 'web=1');
  } else if (url.indexOf('web=1') !== -1) {
    return url;
  } else {
    var sep = url.indexOf('?') !== -1 ? '&' : '?';
    return url + sep + 'web=1';
  }
}

function registrarEnHistoricoSheet(registro) {
  if (!registro) return { status: 'error', error: 'Registro vacío' };
  try {
    const ssHist = SpreadsheetApp.openById(SPREADSHEET_HISTORICO_ID);
    const sheet = ssHist.getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS_HISTORICO_SHEET);
    }
    const ahoraStr = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
    const fechaHora = registro.fechaHora || registro.fecha || ahoraStr;
    const usuario = registro.usuario || registro.colaborador || registro.admin || 'Administrador Institucional';
    const codigo = registro.codigo || registro.codigoDocumento || '';
    const tipoCambio = registro.tipoCambio || registro.tipoEvento || 'Modificación';
    const detalle = registro.detalle || registro.motivo || '';
    sheet.appendRow([fechaHora, usuario, codigo, tipoCambio, detalle]);
    return { status: 'ok', mensaje: 'Registro añadido a Historico_Documentos' };
  } catch (err) {
    Logger.log('Error en registrarEnHistoricoSheet: ' + err.message);
    return { status: 'error', error: err.message };
  }
}

function obtenerHistoricoDeSheet() {
  try {
    const ssHist = SpreadsheetApp.openById(SPREADSHEET_HISTORICO_ID);
    const sheet = ssHist.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];
    const lista = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[2]) continue;
      lista.push({
        id: 'hist_' + i,
        fechaHora: row[0] ? String(row[0]) : '',
        usuario: row[1] ? String(row[1]) : '',
        codigo: row[2] ? String(row[2]) : '',
        tipoEvento: row[3] ? String(row[3]) : 'Modificación',
        detalle: row[4] ? String(row[4]) : ''
      });
    }
    return lista;
  } catch (err) {
    Logger.log('Error en obtenerHistoricoDeSheet: ' + err.message);
    return [];
  }
}

function incrementarDescargaEnSheet(codigo) {
  if (!codigo) return { status: 'error', error: 'Código requerido' };
  try {
    const sheet = obtenerSheetActiva();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: 'error', error: 'Hoja vacía' };
    const codUpper = String(codigo).trim().toUpperCase();

    for (let r = 1; r < data.length; r++) {
      const rowCod = String(data[r][4] || '').trim().toUpperCase();
      if (rowCod === codUpper) {
        // Columna 25 (Y): Descargas (índice 24 en 0-based, celda 25 en 1-based)
        // NOTA: Las descargas NO modifican la fecha de modificación (Columna V)
        const actual = Number(data[r][24]) || 0;
        const nuevo = actual + 1;
        sheet.getRange(r + 1, 25).setValue(nuevo);
        return { status: 'ok', codigo: codUpper, descargas: nuevo };
      }
    }
    return { status: 'error', error: 'Documento no encontrado: ' + codUpper };
  } catch (err) {
    Logger.log('Error en incrementarDescargaEnSheet: ' + err.message);
    return { status: 'error', error: err.message };
  }
}

function actualizarVinculosLoteEnSheet(cambios) {
  if (!Array.isArray(cambios) || cambios.length === 0) {
    return { status: 'ok', mensaje: 'Sin cambios de vínculos para procesar', actualizados: 0 };
  }
  const sheet = obtenerSheetActiva();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { status: 'error', error: 'Hoja vacía' };

  const mapaCambios = {};
  cambios.forEach(c => {
    if (c && c.codigo) {
      mapaCambios[String(c.codigo).trim().toUpperCase()] = c;
    }
  });

  const ahoraStr = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
  let actualizados = 0;
  const registrosHist = [];

  for (let r = 1; r < data.length; r++) {
    const cod = String(data[r][4] || '').trim().toUpperCase();
    if (mapaCambios[cod]) {
      const c = mapaCambios[cod];
      const nuevoDirecto = c.vinculoDirecto || '';
      const nuevoUbicacion = c.vinculoUbicacion || derivarVinculoUbicacion(nuevoDirecto);
      const anteriorDirecto = String(data[r][23] || '').trim();

      if (nuevoDirecto && nuevoDirecto !== anteriorDirecto) {
        // Columna 22 (V): Fecha y hora de modificación
        sheet.getRange(r + 1, 22).setValue(ahoraStr);
        // Columna 23 (W): Vinculo ubicacion
        sheet.getRange(r + 1, 23).setValue(nuevoUbicacion);
        // Columna 24 (X): Vinculo directo
        sheet.getRange(r + 1, 24).setValue(nuevoDirecto);

        registrosHist.push({
          codigo: cod,
          usuario: c.usuario || 'Sincronizador Automático OneDrive',
          tipoCambio: 'Actualización de vínculo',
          detalle: c.detalle || 'Vínculo actualizado automáticamente por cruce con REPOSITORIO_DOCUMENTAL de OneDrive',
          fechaHora: ahoraStr
        });
        actualizados++;
      }
    }
  }

  // Registrar cada cambio en Historico_Documentos
  registrosHist.forEach(reg => registrarEnHistoricoSheet(reg));

  return {
    status: 'ok',
    mensaje: 'Se actualizaron ' + actualizados + ' vínculos en Biblioteca_Documental y se reportaron en Historico_Documentos.',
    actualizados: actualizados
  };
}

// ============================================================================
// ROUTING API: GET & POST
// ============================================================================

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action.toLowerCase() : '';

    // 1. Catálogo de documentos desde Google Sheets (Biblioteca_Documental)
    if (action === 'documentos' || action === 'get_docs') {
      const docs = obtenerDocumentosDeSheet();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', total: docs.length, documentos: docs }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Histórico de Modificaciones Documentales (Historico_Documentos)
    if (action === 'historico' || action === 'cambios') {
      const historicoList = obtenerHistoricoDeSheet();
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', total: historicoList.length, historicoDocumental: historicoList }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'inicializar_historico') {
      const resHist = inicializarHistoricoSheet();
      return ContentService.createTextOutput(JSON.stringify(resHist))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'normalizar_fechas') {
      const resNorm = actualizarFechasYHorasBibliotecaSheet();
      return ContentService.createTextOutput(JSON.stringify(resNorm))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. Tablas Maestras del SGC (maestro.dat)
    if (action === 'maestras' || action === 'maestro') {
      const fileMae = DriveApp.getFileById(MAESTRO_FILE_ID);
      const content = fileMae.getBlob().getDataAsString();
      return ContentService.createTextOutput(content || '{"version":"1.0","tablasMaestras":{}}')
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Proxy CORS de contingencia para SharePoint/OneDrive
    if (action === 'repositorio' || action === 'onedrive') {
      try {
        const urlOD = 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQCctVunBodCQq97XWMPrue7AaIRpd-pVgSUuZrMBWBcA2A?e=revQbX&download=1';
        const respOD = UrlFetchApp.fetch(urlOD, { muteHttpExceptions: true, followRedirects: true });
        return ContentService.createTextOutput(respOD.getContentText())
          .setMimeType(ContentService.MimeType.TEXT);
      } catch (errOD) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: errOD.toString() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 5. Respaldo consolidado
    if (action === 'backup_completo' || action === 'backup') {
      const docs = obtenerDocumentosDeSheet();
      const hist = obtenerHistoricoDeSheet();
      let confObj = {};
      let maeObj = {};
      try { confObj = JSON.parse(DriveApp.getFileById(DEFAULT_FILE_ID).getBlob().getDataAsString() || '{}'); } catch (eC) { }
      try { maeObj = JSON.parse(DriveApp.getFileById(MAESTRO_FILE_ID).getBlob().getDataAsString() || '{}'); } catch (eM) { }
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        totalDocumentos: docs.length,
        totalHistorico: hist.length,
        totalUsuariosAdministrativos: Object.keys(confObj.usuariosRegistrados || {}).length,
        documentos: docs,
        historico: hist,
        usuariosConf: confObj,
        maestroDat: maeObj
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. Por defecto: usuarios.conf (usuarios administrativos, claves, configuración y favoritos)
    const targetId = (e && e.parameter && e.parameter.fileId) ? e.parameter.fileId : DEFAULT_FILE_ID;
    const file = DriveApp.getFileById(targetId);
    return ContentService.createTextOutput(file.getBlob().getDataAsString() || '{}')
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
    try { dataObj = JSON.parse(body); } catch (parseErr) {}

    if (!dataObj) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: 'Cuerpo de solicitud inválido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const accion = dataObj.accion ? dataObj.accion.toLowerCase() : '';

    // A. Registrar en Histórico Documental
    if (accion === 'registrar_historico' || accion === 'guardar_historico') {
      if (Array.isArray(dataObj.historicoDocumental) && dataObj.historicoDocumental.length > 0) {
        dataObj.historicoDocumental.forEach(reg => registrarEnHistoricoSheet(reg));
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok', mensaje: 'Lote registrado en Historico_Documentos' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const res = registrarEnHistoricoSheet(dataObj.registro || dataObj);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // B. Crear Documento en Google Sheets
    if (accion === 'crear_documento') {
      const res = crearDocumentoEnSheet(dataObj.documento);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // C. Modificar Documento en Google Sheets
    if (accion === 'modificar_documento') {
      const res = modificarDocumentoEnSheet(dataObj.codigo, dataObj.documento || dataObj);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // D. Eliminar / Retirar Documento en Google Sheets (Soft-Delete o Purga)
    if (accion === 'eliminar_documento') {
      const res = eliminarDocumentoEnSheet(dataObj.codigo, dataObj.motivo, dataObj.borradoFisico, dataObj.esRegistro, dataObj.titulo);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // E. Sincronización en lote de documentos
    if (accion === 'sincronizar_documentos' && Array.isArray(dataObj.documentos)) {
      const res = sincronizarLoteDocumentosEnSheet(dataObj.documentos, dataObj.headers);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // F. Actualizar lote de vínculos desde sincronización automática OneDrive
    if (accion === 'actualizar_vinculos_lote' && Array.isArray(dataObj.cambios)) {
      const res = actualizarVinculosLoteEnSheet(dataObj.cambios);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // G. Incrementar contador de descargas en Biblioteca_Documental (sin alterar fecha de modificación)
    if (accion === 'incrementar_descarga') {
      const res = incrementarDescargaEnSheet(dataObj.codigo);
      return ContentService.createTextOutput(JSON.stringify(res))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // H. Guardar Configuración con Fusión Atómica (usuarios.conf: claves, perfiles y favoritos de administradores)
    const resConf = actualizarConfiguracionConMerge(dataObj);
    return ContentService.createTextOutput(JSON.stringify(resConf))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// MANIPULACIÓN DEL CATÁLOGO EN GOOGLE SHEETS (Biblioteca_Documental)
// ============================================================================

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
    if (!row || row.length === 0 || !row[4]) continue;

    const doc = {};
    for (let c = 0; c < headers.length; c++) {
      doc[headers[c]] = row[c] !== undefined ? row[c] : '';
    }

    doc.codigo = row[4];
    doc.nombre = row[5];
    doc.titulo = row[5];
    doc.version = row[6];
    doc.vigencia = row[7];
    doc.ubicacion = row[8];
    doc.tipoProceso = row[9];
    doc.proceso = row[10];
    doc.directivo = (row[11] === 'X' || row[11] === 'SI' || row[11] === true);
    doc.administrativo = (row[12] === 'X' || row[12] === 'SI' || row[12] === true);
    doc.operativo = (row[13] === 'X' || row[13] === 'SI' || row[13] === true);
    doc.descargable = (row[14] !== 'NO' && row[14] !== false);
    doc.tiempoRetencion = row[15] || '5 Años';
    doc.lugar = row[16] || 'Oficina central';
    doc.tipoCambio = row[17] || 'Creación del documento';
    doc.fechaVencimiento = row[18];
    doc.estado = row[19] || 'Activo';
    doc.fechaCreacion = row[20] || '';
    doc.fechaModificacion = row[21] || '';
    doc.vinculoUbicacion = row[22] || '';
    doc.vinculoDirecto = row[23] || '';
    doc.descargas = Number(row[24] || 0);

    docs.push(doc);
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

  // 3. Consecutivo numérico o con sufijo
  let consecutivo = doc.consecutivo || doc['Consecutivo'] || (partesCod.length >= 4 ? partesCod.slice(2).join('-') : (partesCod[2] || '001'));
  if (/^\d+$/.test(consecutivo)) {
    consecutivo = String(consecutivo).padStart(3, '0');
  }

  // 4. Tipo de Proceso
  let tipoProceso = doc.tipoProceso || doc['Tipo de proceso'] || doc['Tipo de Proceso'] || doc.tipo_proceso || 'Misional';
  tipoProceso = String(tipoProceso).trim();
  if (!tipoProceso) tipoProceso = 'Misional';

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
    fechaVencimiento = '01/08/' + (new Date().getFullYear() + 5);
  }

  // 7. Estado
  let estadoDoc = doc.estado || doc['Estado actual'] || doc.estadoDocumento || 'Activo';
  if (estadoDoc === 'DISPONIBLE' || estadoDoc === 'NO DISPONIBLE') estadoDoc = 'Activo';

  // 8. Lugar
  let lugar = doc.lugar || doc['Lugar'] || 'Archivo Digital';
  if (lugar === 'Gestión Integral de Calidad' || lugar === areaSigla) lugar = 'Archivo Digital';

  // Permisos RBAC
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
  if (rawDesc === false || rawDesc === 'NO' || rawDesc === 'FALSE') descVal = 'NO';

  const ahoraStr = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
  const fechaCreacion = doc.fechaCreacion || doc.fechaHoraCreacion || doc['Fecha y hora de creacion'] || ahoraStr;
  const fechaModificacion = doc.fechaModificacion || doc.fechaHoraModificacion || doc['Fecha y hora de modificación'] || ahoraStr;

  const vinculoDirecto = doc.vinculoDirecto || doc.downloadUrl || doc['Vinculo directo'] || '';
  let vinculoUbicacion = doc.vinculoUbicacion || doc.sharepointUrl || doc['Vinculo ubicacion'] || '';
  if (!vinculoUbicacion && vinculoDirecto) {
    vinculoUbicacion = derivarVinculoUbicacion(vinculoDirecto);
  }
  const descargas = (doc.descargas !== undefined && doc.descargas !== null) ? Number(doc.descargas) : (doc['Descargas'] !== undefined ? Number(doc['Descargas']) : 0);

  return [
    fechaAprobacion,                                                              // 0
    tipoDocSigla,                                                                 // 1
    areaSigla,                                                                    // 2
    consecutivo,                                                                  // 3
    codUpper,                                                                     // 4
    doc.titulo || doc.nombre || doc['Nombre del documento'] || doc['Documento'] || '', // 5
    doc.version || doc['Version'] || doc['Versión'] || '1',                        // 6
    vigencia,                                                                     // 7
    doc.ubicacion || doc['Ubicación'] || doc['Ubicacion'] || 'Intranet',          // 8
    tipoProceso,                                                                  // 9
    doc.proceso || doc['Proceso'] || doc.carpeta || 'Gestión Integral de Calidad', // 10
    directivoVal,                                                                 // 11
    adminVal,                                                                     // 12
    operativoVal,                                                                 // 13
    descVal,                                                                      // 14
    doc.tiempoRetencion || doc.tiempo || doc['Tiempo'] || '5 Años',               // 15
    lugar,                                                                        // 16
    doc.tipoCambio || doc['Tipo de cambio'] || 'Creación del documento',          // 17
    fechaVencimiento,                                                             // 18
    estadoDoc,                                                                    // 19
    fechaCreacion,                                                                // 20
    fechaModificacion,                                                            // 21
    vinculoUbicacion,                                                             // 22
    vinculoDirecto,                                                               // 23
    descargas                                                                     // 24
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
      if (h === 'codigo' || h === 'código') codIdx = c;
      if (h === 'nombre del documento' || h === 'documento' || h === 'titulo' || h === 'título') tituloIdx = c;
      if (h === 'subclase' || h === 'nivel' || h === 'nivel documental') subclaseIdx = c;
    }
  }

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

  registrarEnHistoricoSheet({
    codigo: codigoUpper,
    usuario: doc.usuario || 'Administrador Institucional',
    tipoCambio: 'Creación',
    detalle: (esRegistro ? 'Registro derivado creado: ' : 'Documento creado: ') + (doc.titulo || doc.nombre || '')
  });

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
  let subclaseIdx = -1;
  let tipoDocIdx = 1;
  for (let c = 0; c < headers.length; c++) {
    const hNorm = headers[c].toLowerCase();
    if (hNorm === 'codigo' || hNorm === 'código') codIdx = c;
    else if (hNorm === 'nombre del documento' || hNorm === 'documento' || hNorm === 'titulo' || hNorm === 'título') tituloIdx = c;
    else if (hNorm === 'subclase' || hNorm === 'nivel' || hNorm === 'nivel documental') subclaseIdx = c;
    else if (hNorm === 'tipo de documento' || hNorm === 'tipo documento' || hNorm === 'tipo') tipoDocIdx = c;
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
        if (rowSubclase === 'base' || rowTipoDoc === 'formato' || rowTipoDoc === 'manual' || rowTipoDoc === 'politica' || rowTipoDoc === 'guia') {
          continue;
        }
        let coincide = false;
        if (tituloBuscarNorm && (rowTitNorm === tituloBuscarNorm || rowTitNorm.includes(tituloBuscarNorm) || tituloBuscarNorm.includes(rowTitNorm))) {
          coincide = true;
        }
        if (!coincide) continue;
      } else {
        if (rowSubclase === 'registro' || rowTipoDoc === 'registro') continue;
      }

      const existingRow = data[r];
      const mapExisting = {};
      for (let c = 0; c < headers.length; c++) {
        mapExisting[headers[c]] = existingRow[c];
      }

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

      // Preservar columnas 20 a 24
      mergedDoc.fechaCreacion = mapExisting['Fecha y hora de creacion'] || existingRow[20] || mergedDoc.fechaCreacion;
      mergedDoc.fechaModificacion = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
      mergedDoc.vinculoUbicacion = docActualizado.vinculoUbicacion || (docActualizado.vinculoDirecto ? derivarVinculoUbicacion(docActualizado.vinculoDirecto) : '') || mapExisting['Vinculo ubicacion'] || existingRow[22] || '';
      mergedDoc.vinculoDirecto = docActualizado.vinculoDirecto || docActualizado.downloadUrl || mapExisting['Vinculo directo'] || existingRow[23] || '';
      mergedDoc.descargas = (docActualizado.descargas !== undefined && docActualizado.descargas !== null) ? Number(docActualizado.descargas) : (mapExisting['Descargas'] !== undefined ? Number(mapExisting['Descargas']) : (existingRow[24] || 0));

      const fila = normalizarFilaDocumento(mergedDoc);
      if (subclaseIdx >= 0) {
        while (fila.length <= subclaseIdx) fila.push('');
        fila[subclaseIdx] = esRegistro ? 'Registro' : (existingRow[subclaseIdx] || 'Base');
      }

      const range = sheet.getRange(r + 1, 1, 1, fila.length);
      range.setValues([fila]);

      let tipoCambioHist = docActualizado.tipoCambio || 'Edición de metadatos';
      if (docActualizado.huboCambioVinculo || (docActualizado.vinculoDirecto && docActualizado.vinculoDirecto !== existingRow[23])) {
        tipoCambioHist = 'Cambio de vínculo manual';
      }

      registrarEnHistoricoSheet({
        codigo: codigoUpper,
        usuario: docActualizado.usuario || 'Administrador Institucional',
        tipoCambio: tipoCambioHist,
        detalle: docActualizado.detalle || (tipoCambioHist + ' en catálogo institucional')
      });

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
  let estadoIdx = 19;
  let cambioIdx = 17;

  for (let c = 0; c < headers.length; c++) {
    const hNorm = headers[c].toLowerCase();
    if (hNorm === 'codigo' || hNorm === 'código') codIdx = c;
    else if (hNorm === 'nombre del documento' || hNorm === 'documento' || hNorm === 'titulo' || hNorm === 'título') tituloIdx = c;
    else if (hNorm === 'subclase' || hNorm === 'nivel' || hNorm === 'nivel documental') subclaseIdx = c;
    else if (hNorm === 'estado actual' || hNorm === 'estado') estadoIdx = c;
    else if (hNorm === 'tipo de cambio' || hNorm === 'tipo cambio' || hNorm === 'cambio') cambioIdx = c;
  }

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

      const motivoRetiro = motivo ? String(motivo).trim() : 'Retirado del catálogo por actualización documental';

      registrarEnHistoricoSheet({
        codigo: codigoUpper,
        usuario: 'Administrador Institucional',
        tipoCambio: 'Eliminación',
        detalle: (esReg ? 'Registro derivado retirado: ' : 'Documento retirado: ') + motivoRetiro
      });

      if (isFisico) {
        sheet.deleteRow(r + 1);
        return { status: 'ok', mensaje: (esReg ? 'Registro derivado de ' : 'Documento ') + codigoUpper + ' eliminado físicamente de Google Sheets' };
      } else {
        sheet.getRange(r + 1, estadoIdx + 1).setValue('Inactivo / Retirado');
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

// ============================================================================
// GESTIÓN DE USUARIOS ADMINISTRATIVOS (usuarios.conf en Google Drive)
// ============================================================================

function actualizarConfiguracionConMerge(dataObj) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
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
      confExistente = {};
    }

    const usuariosActuales = confExistente.usuariosRegistrados || {};
    const usuariosEntrantes = dataObj.usuariosRegistrados || {};
    const perfilesActuales = confExistente.perfilesPersonalizados || {};
    const perfilesEntrantes = dataObj.perfilesPersonalizados || {};

    const fusionUsuarios = { ...usuariosActuales };
    for (const docKey in usuariosEntrantes) {
      if (Object.prototype.hasOwnProperty.call(usuariosEntrantes, docKey)) {
        fusionUsuarios[docKey] = {
          ...(fusionUsuarios[docKey] || {}),
          ...usuariosEntrantes[docKey]
        };
      }
    }

    const fusionPerfiles = {
      ...perfilesActuales,
      ...perfilesEntrantes
    };

    const confFinal = {
      ...confExistente,
      ...dataObj,
      usuariosRegistrados: fusionUsuarios,
      perfilesPersonalizados: fusionPerfiles,
      ultimaActualizacion: new Date().toISOString()
    };

    delete confFinal.fileId;
    delete confFinal.accion;

    fileConf.setContent(JSON.stringify(confFinal, null, 2));
    return {
      status: 'ok',
      mensaje: 'usuarios.conf sincronizado atómicamente',
      totalUsuarios: Object.keys(fusionUsuarios).length
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ============================================================================
// FUNCIONES DE INICIALIZACIÓN, MIGRACIÓN Y MENÚ EN GOOGLE SHEETS
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SGC Documental')
    .addItem('1. Inicializar / Poblar Histórico de Documentos', 'inicializarHistoricoSheet')
    .addItem('2. Estandarizar Fechas y Horas en Biblioteca Documental', 'actualizarFechasYHorasBibliotecaSheet')
    .addToUi();
}

function inicializarHistoricoSheet() {
  try {
    const ssHist = SpreadsheetApp.openById(SPREADSHEET_HISTORICO_ID);
    const sheet = ssHist.getSheets()[0];
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS_HISTORICO_SHEET);
      const headerRange = sheet.getRange(1, 1, 1, HEADERS_HISTORICO_SHEET.length);
      headerRange.setBackground('#1f4260')
                 .setFontColor('#ffffff')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }
    
    if (sheet.getLastRow() === 1) {
      const docs = obtenerDocumentosDeSheet();
      const filasHist = [];
      const ahoraStr = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
      
      docs.forEach(doc => {
        if (!doc.codigo) return;
        const fechaHora = doc.fechaCreacion || doc.fechaAprobacion || ahoraStr;
        filasHist.push([
          fechaHora,
          'Administrador Institucional',
          doc.codigo,
          'Creación del documento',
          'Registro inicial incorporado al catálogo institucional (' + (doc.nombre || doc.titulo || '') + ')'
        ]);
      });
      
      if (filasHist.length > 0) {
        sheet.getRange(2, 1, filasHist.length, HEADERS_HISTORICO_SHEET.length).setValues(filasHist);
      }
    }
    
    for (let col = 1; col <= HEADERS_HISTORICO_SHEET.length; col++) {
      sheet.autoResizeColumn(col);
    }
    
    return { status: 'ok', mensaje: 'Historico_Documentos inicializado correctamente con ' + (sheet.getLastRow() - 1) + ' registros.' };
  } catch (err) {
    Logger.log('Error en inicializarHistoricoSheet: ' + err.message);
    return { status: 'error', error: err.message };
  }
}

function actualizarFechasYHorasBibliotecaSheet() {
  try {
    const sheet = obtenerSheetActiva();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { status: 'error', error: 'Biblioteca vacía' };
    
    const ahoraStr = Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
    let modificadas = 0;
    
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || !row[4]) continue;
      
      let fCreacion = row[20];
      if (!fCreacion || String(fCreacion).trim() === '') {
        sheet.getRange(r + 1, 21).setValue(ahoraStr);
        modificadas++;
      } else if (fCreacion instanceof Date) {
        sheet.getRange(r + 1, 21).setValue(Utilities.formatDate(fCreacion, 'America/Bogota', 'dd/MM/yyyy HH:mm:ss'));
        modificadas++;
      }
      
      let fMod = row[21];
      if (!fMod || String(fMod).trim() === '') {
        sheet.getRange(r + 1, 22).setValue(ahoraStr);
        modificadas++;
      } else if (fMod instanceof Date) {
        sheet.getRange(r + 1, 22).setValue(Utilities.formatDate(fMod, 'America/Bogota', 'dd/MM/yyyy HH:mm:ss'));
        modificadas++;
      }
    }
    
    return { status: 'ok', mensaje: 'Se normalizaron fechas y horas en ' + modificadas + ' campos de Biblioteca_Documental.' };
  } catch (err) {
    Logger.log('Error en actualizarFechasYHorasBibliotecaSheet: ' + err.message);
    return { status: 'error', error: err.message };
  }
}
