/**
 * Servicio de Datos Universal - Unión para la salud y la vida S.A.S.
 * 
 * Conexión sincrónica en tiempo real al archivo REPOSITORIO_DOCUMENTAL.csv de OneDrive.
 */

import { DOCUMENTOS_REALES, URL_ORIGEN_CSV } from './data.js?v=11.6.31';
import { cacheService } from './cache-service.js?v=11.6.85';


export const MAPA_NORMALIZACION_AREAS = {
  'GIC': 'Gestión Integral Calidad',
  'GESTION INTEGRAL CALIDAD': 'Gestión Integral Calidad',
  'GESTION INTEGRAL DE CALIDAD': 'Gestión Integral Calidad',
  'CALIDAD': 'Gestión Integral Calidad',

  'GTH': 'Gestión Talento Humano',
  'GHU': 'Gestión Talento Humano',
  'GESTION TALENTO HUMANO': 'Gestión Talento Humano',
  'GESTION DEL TALENTO HUMANO': 'Gestión Talento Humano',
  'TALENTO HUMANO': 'Gestión Talento Humano',
  'GESTION HUMANA': 'Gestión Talento Humano',

  'SST': 'Seguridad y Salud en el Trabajo',
  'SEGURIDAD Y SALUD EN EL TRABAJO': 'Seguridad y Salud en el Trabajo',

  'GMD': 'Gestión Médica',
  'GESTION MEDICA': 'Gestión Médica',
  'GESTION MEDICA Y ASISTENCIAL': 'Gestión Médica',
  'MEDICA': 'Gestión Médica',

  'FAR': 'Gestión Farmacéutica',
  'GESTION FARMACEUTICA': 'Gestión Farmacéutica',

  'GAD': 'Gestión Administrativa y Financiera',
  'GFI': 'Gestión Administrativa y Financiera',
  'ADM': 'Gestión Administrativa y Financiera',
  'GESTION ADMINISTRATIVA': 'Gestión Administrativa y Financiera',
  'GESTION FINANCIERA': 'Gestión Administrativa y Financiera',
  'GESTION ADMINISTRATIVA Y FINANCIERA': 'Gestión Administrativa y Financiera',

  'GTI': 'Gestión Tecnología Información',
  'TIC': 'Gestión Tecnología Información',
  'GESTION TECNOLOGIA INFORMACION': 'Gestión Tecnología Información',
  'GESTION TECNOLOGIAS DE LA INFORMACION': 'Gestión Tecnología Información',
  'TECNOLOGIAS DE LA INFORMACION': 'Gestión Tecnología Información',

  'GAU': 'Gestión Auditoría',
  'AUD': 'Gestión Auditoría',
  'AUDITORIA': 'Gestión Auditoría'
};

export function normalizarAreaDoc(rawArea, codigo = '') {
  const norm = (rawArea || '').toString().trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (MAPA_NORMALIZACION_AREAS[norm]) return MAPA_NORMALIZACION_AREAS[norm];

  const cod = (codigo || '').toUpperCase();
  if (cod.includes('-GIC-') || cod.startsWith('GIC-')) return 'Gestión Integral Calidad';
  if (cod.includes('-GTH-') || cod.includes('-GHU-')) return 'Gestión Talento Humano';
  if (cod.includes('-SST-')) return 'Seguridad y Salud en el Trabajo';
  if (cod.includes('-GMD-')) return 'Gestión Médica';
  if (cod.includes('-FAR-')) return 'Gestión Farmacéutica';
  if (cod.includes('-GAD-') || cod.includes('-GFI-') || cod.includes('-ADM-')) return 'Gestión Administrativa y Financiera';
  if (cod.includes('-GTI-') || cod.includes('-TIC-')) return 'Gestión Tecnología Información';
  if (cod.includes('-GAU-') || cod.includes('-AUD-')) return 'Gestión Auditoría';

  return rawArea || 'Gestión Integral Calidad';
}

export function normalizarTipoProcesoDoc(rawTipoProceso, areaNormalizada, codigo = '') {
  if (rawTipoProceso && typeof rawTipoProceso === 'string' && rawTipoProceso.trim() !== '' && rawTipoProceso !== 'N/A') {
    const rawTrim = rawTipoProceso.trim();
    const rawNorm = rawTrim.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (rawNorm === 'CALIDAD') return 'Calidad';
    if (rawNorm.startsWith('ESTRATEGIC')) return 'Estrategico';
    if (rawNorm.startsWith('MISIONAL')) return 'Misional';
    if (rawNorm === 'APOYO') return 'Apoyo';
    if (rawNorm.startsWith('EVALUACI')) return 'Evaluación y Control';

    return rawTrim;
  }

  return 'Misional';
}


export const MAPA_NORMALIZACION_TIPOS_DOC = {
  'FMT': 'Formato',
  'FT': 'Formato',
  'FORMATO': 'Formato',

  'DA': 'Documento Anexo',
  'DOC': 'Documento Anexo',
  'DOCUMENTO ANEXO': 'Documento Anexo',
  'DOCUMENTO DE APOYO': 'Documento Anexo',
  'ANEXO': 'Documento Anexo',

  'INS': 'Instructivo',
  'IN': 'Instructivo',
  'INSTRUCTIVO': 'Instructivo',

  'MN': 'Manual',
  'MANUAL': 'Manual',

  'POL': 'Política',
  'PO': 'Política',
  'POLITICA': 'Política',
  'POLÍTICA': 'Política',

  'PRC': 'Procedimiento',
  'PR': 'Procedimiento',
  'PROCEDIMIENTO': 'Procedimiento',

  'PRT': 'Protocolo',
  'PT': 'Protocolo',
  'PROTOCOLO': 'Protocolo',

  'PRG': 'Programa',
  'PG': 'Programa',
  'PROGRAMA': 'Programa',

  'GU': 'Guía',
  'GUA': 'Guía',
  'GUIA': 'Guía',
  'GUÍA': 'Guía',

  'CR': 'Caracterización',
  'CARACTERIZACION': 'Caracterización',
  'CARACTERIZACIÓN': 'Caracterización',

  'RG': 'Reglamento',
  'REGLAMENTO': 'Reglamento',

  'PLA': 'Plan',
  'PL': 'Plan',
  'PLAN': 'Plan'
};

export function normalizarTipoDocumentoDoc(rawTipo, codigo = '') {
  const norm = (rawTipo || '').toString().trim().toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (MAPA_NORMALIZACION_TIPOS_DOC[norm]) return MAPA_NORMALIZACION_TIPOS_DOC[norm];

  const cod = (codigo || '').toUpperCase();
  const pref = cod.split('-')[0];
  if (MAPA_NORMALIZACION_TIPOS_DOC[pref]) return MAPA_NORMALIZACION_TIPOS_DOC[pref];

  return rawTipo || 'Formato';
}

/**
 * REGLA INSTITUCIONAL ESTRICTA:
 * Verifica si un código documental corresponde exclusivamente al prefijo FMT.
 * No se admiten variaciones como FT- o FORMATO-.
 */
export function esDocumentoFMT(codigo) {
  if (!codigo) return false;
  const cod = codigo.toString().trim().toUpperCase();
  return cod.startsWith('FMT-') || cod.startsWith('FMT_') || cod.startsWith('FMT ') || cod === 'FMT';
}

/**
 * Determina la estrategia de descarga oficial del Sistema de Gestión Documental:
 * 1. Documentos de Excel (.xlsx, .xls): NUNCA se exportan a PDF. Descarga nativa.
 * 2. Documentos con prefijo FMT (Word o Excel): Siempre descarga nativa editable original.
 * 3. Documentos de Word no-FMT (DA, INS, MN, PR, PT, RG, etc.): OBLIGATORIO DESCARGA EN PDF.
 */
export function determinarEstrategiaDescarga(doc) {
  if (!doc) {
    return {
      esPdf: false,
      formato: 'DESCONOCIDO',
      etiquetaBoton: 'DESCARGAR 📥',
      tooltip: 'Descargar documento',
      tipoAccion: 'DESCONOCIDO'
    };
  }

  const codigo = (doc.codigo || '').toString().trim().toUpperCase();
  const extension = (doc.extension || '').toString().trim().toUpperCase();
  const nombre = (doc.titulo || doc.downloadUrl || doc.sharepointUrl || '').toLowerCase();
  const esExcel = extension.includes('XLS') || nombre.endsWith('.xlsx') || nombre.endsWith('.xls');

  // REGLA FUNDAMENTAL: Registros derivados / Documentos secundarios (subclase === 'Registro' o esRegistro === true o sufijo numérico)
  // Los documentos secundarios .doc se DEBEN descargar en PDF, independientemente si corresponden a formatos (FMT),
  // ya que corresponden a registros institucionales diligenciados que no se modifican por el usuario final.
  const esRegistro = Boolean(
    doc.esRegistro === true || 
    (doc.subclase && doc.subclase.toLowerCase().includes('registro')) ||
    doc.documentoPadreCodigo ||
    (doc.id && String(doc.id).includes('_REG_')) ||
    (codigo && /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/i.test(codigo))
  );
  if (esRegistro) {
    if (esExcel) {
      return {
        esPdf: false,
        formato: 'EXCEL',
        etiquetaBoton: 'DESCARGAR 📥',
        tooltip: 'Descargar registro en Excel',
        tipoAccion: 'NATIVO_EXCEL'
      };
    }
    return {
      esPdf: true,
      formato: 'PDF',
      etiquetaBoton: 'DESCARGAR 📥',
      tooltip: 'Descargar registro en PDF',
      tipoAccion: 'CONVERSION_PDF'
    };
  }

  // 1. REGLA ESTRICTA: Prefijo FMT -> Formato institucional editable (Word o Excel) exclusivamente si es documento base
  if (esDocumentoFMT(codigo) && !esRegistro) {
    return {
      esPdf: false,
      formato: esExcel ? 'EXCEL' : 'WORD',
      etiquetaBoton: 'DESCARGAR 📥',
      tooltip: 'Descargar documento',
      tipoAccion: 'NATIVO_FMT'
    };
  }

  // 2. REGLA ESTRICTA: Los documentos de Excel NUNCA se exportan a PDF
  if (esExcel) {
    return {
      esPdf: false,
      formato: 'EXCEL',
      etiquetaBoton: 'DESCARGAR 📥',
      tooltip: 'Descargar documento',
      tipoAccion: 'NATIVO_EXCEL'
    };
  }

  // 3. REGLA ESTRICTA: Documentos de Word no-FMT -> OBLIGATORIO EN FORMATO PDF
  const esWord = extension.includes('DOC') || nombre.endsWith('.docx') || nombre.endsWith('.doc');
  if (esWord || extension.includes('PDF') || nombre.endsWith('.pdf')) {
    return {
      esPdf: true,
      formato: 'PDF',
      etiquetaBoton: 'DESCARGAR 📥',
      tooltip: 'Descargar documento',
      tipoAccion: 'CONVERSION_PDF'
    };
  }

  // Por defecto para cualquier otro tipo documental no-FMT (normativa SGC)
  return {
    esPdf: true,
    formato: 'PDF',
    etiquetaBoton: 'DESCARGAR 📥',
    tooltip: 'Descargar documento',
    tipoAccion: 'CONVERSION_PDF'
  };
}

export class DataService {
  constructor() {
    this.urlCsvUniversal = URL_ORIGEN_CSV;
    this.documentosEnMemoria = (DOCUMENTOS_REALES || []).map((d) => {
      const cod = (d.codigo || '').toUpperCase();
      const ext = (d.extension || '').toUpperCase();
      const url = (d.downloadUrl || d.sharepointUrl || '').toLowerCase();
      const esExcel = ext.includes('XLS') || ext.includes('CSV') || url.endsWith('.xlsx') || url.endsWith('.xls');
      const esFMT = esDocumentoFMT(cod);
      let formato = 'PDF';
      let extension = 'PDF';
      if (esExcel) {
        formato = 'Excel';
        extension = 'XLS';
      } else if (esFMT) {
        formato = 'Word';
        extension = 'DOC';
      }
      return { ...d, formato, extension };
    });
    // Limpiar cachés antiguas para asegurar datos frescos
    try {
      localStorage.removeItem('agy_sgc_universal_docs');
      localStorage.removeItem('agy_sgc_imported_docs');
      localStorage.removeItem('agy_sgc_documentos_retirados');
      sessionStorage.removeItem('agy_sgc_universal_docs');
      this.sanitizarRegistrosLocales();
      this.iniciarEscuchaConectividad();
    } catch {}
  }

  /**
   * Inicia escucha de eventos de conectividad para sincronizar mutaciones pendientes (Offline Outbox)
   */
  iniciarEscuchaConectividad() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[DataService] 🌐 Conexión reestablecida. Vaciando cola de mutaciones documentales pendientes...');
        this.procesarColaMutacionesPendientes();
      });
      setTimeout(() => this.procesarColaMutacionesPendientes(), 4000);
    }
  }

  /**
   * Procesa y despacha a Google Apps Script las mutaciones creadas sin conexión
   */
  async procesarColaMutacionesPendientes() {
    if (!cacheService || !cacheService.obtenerColaMutaciones) return;
    try {
      const cola = await cacheService.obtenerColaMutaciones();
      if (!Array.isArray(cola) || cola.length === 0) return;

      console.log(`[DataService] 🔄 Procesando ${cola.length} mutaciones pendientes en segundo plano...`);
      const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
      const idsLimpiar = [];

      for (const item of cola) {
        const payload = item.mutacion || item;
        try {
          let enviado = false;
          try {
            const res = await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload),
              signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
            });
            if (res.ok) enviado = true;
          } catch (eGas) {
            await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload)
            });
            enviado = true;
          }

          if (enviado && item.id) {
            idsLimpiar.push(item.id);
          }
        } catch (errSync) {
          console.warn('[DataService] Error sincronizando mutación pendiente:', errSync);
          break;
        }
      }

      if (idsLimpiar.length > 0 && cacheService.limpiarMutaciones) {
        await cacheService.limpiarMutaciones(idsLimpiar);
        console.log(`[DataService] ✅ ${idsLimpiar.length} mutaciones sincronizadas exitosamente en Google Sheets.`);
      }
    } catch (e) {
      console.warn('[DataService] Error en procesarColaMutacionesPendientes:', e);
    }
  }

  /**
   * Limpia registros derivados huérfanos o con nombres obsoletos y asegura los documentos canónicos
   */
  sanitizarRegistrosLocales() {
    try {
      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      let creados = {};
      if (rawLocal) {
        try { creados = JSON.parse(rawLocal); } catch {}
      }
      for (const k of Object.keys(creados)) {
        if (k.startsWith('REG_FMT-GIC-016') || k.startsWith('FMT-GIC-016')) {
          delete creados[k];
        } else if (creados[k]?.esRegistro || creados[k]?.subclase === 'Registro') {
          // Regla de Negocio: Los registros derivados no almacenan URLs estáticas directas
          delete creados[k].downloadUrl;
          delete creados[k].sharepointUrl;
        }
      }
      localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creados));

      const rawConf = localStorage.getItem('agy_sgc_conf_cache');
      if (rawConf) {
        try {
          const confObj = JSON.parse(rawConf);
          if (confObj && typeof confObj.documentosCreados === 'object') {
            for (const k of Object.keys(confObj.documentosCreados)) {
              if (k.startsWith('REG_FMT-GIC-016') || k.startsWith('FMT-GIC-016')) {
                delete confObj.documentosCreados[k];
              } else if (confObj.documentosCreados[k]?.esRegistro || confObj.documentosCreados[k]?.subclase === 'Registro') {
                delete confObj.documentosCreados[k].downloadUrl;
                delete confObj.documentosCreados[k].sharepointUrl;
              }
            }
            localStorage.setItem('agy_sgc_conf_cache', JSON.stringify(confObj));
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[DataService] Error en sanitizarRegistrosLocales:', e);
    }
  }

  /**
   * Genera de forma determinística la ruta de la subcarpeta y los vínculos dinámicos para un documento secundario.
   * Regla de Negocio Institucional:
   * Los documentos derivados NO tienen vínculos directos almacenados en archivos estáticos.
   * Dependen única y exclusivamente de la ruta del archivo base y se encuentran dentro de una
   * subcarpeta que tendrá el nombre similar al documento padre (ej. 'FMT-GIC-015 Definición de criterios de formación').
   */
  generarEnlacesDocumentoSecundario(docPadre, docSecundario) {
    if (!docPadre) {
      return { downloadUrl: '', sharepointUrl: '', subcarpeta: '', carpetaSub: '', nombreArchivo: '' };
    }

    // PRIORIDAD ABSOLUTA: Consultar primero el mapa oficial del repositorio de OneDrive sin calcular rutas
    const codSecundario = (docSecundario && docSecundario.codigo ? docSecundario.codigo : '').trim().toUpperCase();
    if (this._ultimoOnedriveMap && codSecundario) {
      const odDirecto = this.buscarEnOneDriveMap(this._ultimoOnedriveMap, codSecundario, docSecundario.titulo || '', true);
      if (odDirecto && (odDirecto.downloadUrl || odDirecto.vinculoDescarga || odDirecto.sharepointUrl)) {
        return {
          downloadUrl: odDirecto.downloadUrl || odDirecto.vinculoDescarga || '',
          sharepointUrl: odDirecto.sharepointUrl || odDirecto.vinculoEdicion || odDirecto.downloadUrl || '',
          subcarpeta: '',
          carpetaSub: '',
          nombreArchivo: odDirecto.documento || odDirecto.titulo || ''
        };
      }
    }

    const urlBasePadre = (docPadre.downloadUrl || docPadre.sharepointUrl || '').split('?')[0].trim();
    if (!urlBasePadre || !urlBasePadre.startsWith('http')) {
      return { downloadUrl: '', sharepointUrl: '', subcarpeta: '', carpetaSub: '', nombreArchivo: '' };
    }

    const lastSlash = urlBasePadre.lastIndexOf('/');
    const carpetaContenedora = urlBasePadre.substring(0, lastSlash);
    const archivoPadre = urlBasePadre.substring(lastSlash + 1);
    const nombrePadreSinExt = decodeURIComponent(archivoPadre).replace(/\.[^/.]+$/, '').trim();

    // 1. Determinar el nombre de la subcarpeta institucional del padre
    const codPadre = (docPadre.codigo || '').trim().toUpperCase();
    let subcarpeta = '';

    // Si existe en el mapa de carpetas físicas indexadas de SharePoint/OneDrive
    if (this._mapaCarpetasOneDrive && this._mapaCarpetasOneDrive.has(codPadre)) {
      subcarpeta = this._mapaCarpetasOneDrive.get(codPadre).urlDescarga || this._mapaCarpetasOneDrive.get(codPadre).urlEdicion || '';
    }

    if (!subcarpeta) {
      // Regla de Negocio: Subcarpeta en la misma ubicación del padre con nombre similar al documento padre
      const nombreSubcarpeta = `${docPadre.codigo} ${docPadre.titulo || ''}`.trim() || nombrePadreSinExt;
      subcarpeta = `${carpetaContenedora}/${nombreSubcarpeta}`;
    }

    const rawExt = ((docSecundario && docSecundario.extension) || docPadre.extension || 'DOC').toUpperCase();
    const ext = (rawExt.includes('XLS') || rawExt.includes('CSV')) ? 'xlsx' : 'docx';

    const codSec = ((docSecundario && docSecundario.codigo) || codPadre).trim().toUpperCase();

    let tit = ((docSecundario && (docSecundario.titulo || docSecundario.nombre)) || '').trim();
    tit = tit.replace(/\.(docx|xlsx|pdf|doc|xls)$/i, '').trim();

    let titSinCod = tit;
    if (tit.toUpperCase().startsWith(codSec)) {
      titSinCod = tit.substring(codSec.length).replace(/^[\s\-_]+/, '').trim();
    } else if (tit.toUpperCase().startsWith(codPadre)) {
      titSinCod = tit.substring(codPadre.length).replace(/^[\s\-_]+/, '').trim();
    }

    const nombreArchivo = titSinCod ? `${codSec} ${titSinCod}.${ext}` : `${codSec}.${ext}`;
    const downloadUrl = `${subcarpeta}/${nombreArchivo}`;
    const sharepointUrl = `${downloadUrl}?web=1`;

    return {
      carpetaSub: subcarpeta,
      subcarpeta: subcarpeta,
      nombreArchivo: nombreArchivo,
      downloadUrl: downloadUrl,
      sharepointUrl: sharepointUrl
    };
  }

  /**
   * Obtiene un documento por su código institucional
   */
  obtenerDocumentoPorCodigo(codigo) {
    if (!codigo) return null;
    const codUpper = codigo.trim().toUpperCase();
    if (Array.isArray(this.documentosEnMemoria)) {
      const d = this.documentosEnMemoria.find((doc) => (doc.codigo || '').toUpperCase() === codUpper && !doc.esRegistro);
      if (d) return d;
    }
    if (typeof DOCUMENTOS_REALES !== 'undefined' && Array.isArray(DOCUMENTOS_REALES)) {
      const d = DOCUMENTOS_REALES.find((doc) => (doc.codigo || '').toUpperCase() === codUpper && !doc.esRegistro);
      if (d) return d;
    }
    const MAPA_RENOMBRES = { 'FMT-GIC-016': 'FMT-GIC-015', 'FMT-GIC-015': 'FMT-GIC-016' };
    const alias = MAPA_RENOMBRES[codUpper];
    if (alias) {
      if (Array.isArray(this.documentosEnMemoria)) {
        const d = this.documentosEnMemoria.find((doc) => (doc.codigo || '').toUpperCase() === alias && !doc.esRegistro);
        if (d) return d;
      }
      if (typeof DOCUMENTOS_REALES !== 'undefined' && Array.isArray(DOCUMENTOS_REALES)) {
        const d = DOCUMENTOS_REALES.find((doc) => (doc.codigo || '').toUpperCase() === alias && !doc.esRegistro);
        if (d) return d;
      }
    }
    return null;
  }

  /**
   * Obtiene el documento base (padre) asociado a un documento derivado
   */
  obtenerDocumentoPadre(doc) {
    if (!doc) return null;
    let codPadre = (doc.documentoPadreCodigo || '').trim().toUpperCase();
    if (!codPadre && doc.codigo) {
      const m = (doc.codigo || '').match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-\d+$/i);
      if (m) codPadre = m[1].toUpperCase();
    }
    if (!codPadre) return null;
    return this.obtenerDocumentoPorCodigo(codPadre);
  }

  /**
   * Verifica si un documento tiene un archivo físico individual registrado en OneDrive con extensión válida
   */
  existeArchivoEnOneDrive(doc) {
    if (!doc || !doc.codigo) return false;
    const codUpper = (doc.codigo || '').trim().toUpperCase();
    if (!this._ultimoOnedriveMap) return false;

    const od = this._ultimoOnedriveMap.get(codUpper);
    if (od && od.downloadUrl && /\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(od.downloadUrl)) {
      return true;
    }
    if (doc.titulo) {
      const tNorm = this.normalizarTexto(doc.titulo);
      const odComp = this._ultimoOnedriveMap.get(`${codUpper}::${tNorm}`);
      if (odComp && odComp.downloadUrl && /\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(odComp.downloadUrl)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calcula el siguiente código secuencial para un registro secundario (ej. FMT-GIC-015-1, FMT-GIC-015-2, ...)
   * Se basa estrictamente en los registros derivados oficiales asociados al documento base en el catálogo oficial (Google Sheets / SSOT).
   */
  calcularSiguienteCodigoRegistro(docPadre) {
    if (!docPadre || !docPadre.codigo) return 'REG-001-1';
    const codPadre = docPadre.codigo.trim().toUpperCase();

    // 1. Obtener la referencia oficial del documento base padre en memoria
    const padreOficial = (Array.isArray(this.documentosEnMemoria)
      ? this.documentosEnMemoria.find((d) => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro)
      : null) || docPadre;

    const numerosExistentes = new Set();
    const regex = new RegExp(`^${codPadre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');

    // 2. Revisar los registros derivados oficiales asociados al documento padre
    const listaDerivados = Array.isArray(padreOficial.registrosDerivados)
      ? padreOficial.registrosDerivados
      : (Array.isArray(docPadre.registrosDerivados) ? docPadre.registrosDerivados : []);

    for (const r of listaDerivados) {
      if (!r || !r.codigo) continue;
      const m = r.codigo.trim().match(regex);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num)) numerosExistentes.add(num);
      }
    }

    // 3. Revisar cualquier documento derivado oficial presente en el catálogo activo en memoria
    if (Array.isArray(this.documentosEnMemoria)) {
      for (const d of this.documentosEnMemoria) {
        if (!d || !d.codigo) continue;
        if (d.esRegistro && (d.documentoPadreCodigo || '').toUpperCase() === codPadre) {
          const m = d.codigo.trim().match(regex);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (!isNaN(num)) numerosExistentes.add(num);
          }
        }
      }
    }

    const maxNum = numerosExistentes.size > 0 ? Math.max(...numerosExistentes) : 0;
    const siguienteNum = maxNum + 1;
    return `${codPadre}-${siguienteNum}`;
  }

  /**
   * Obtiene los documentos con estrategia Stale-While-Revalidate no volátil (IndexedDB + 24h TTL)
   * Renderizado instantáneo a 0 ms y revalidación asíncrona en segundo plano diariamente o bajo demanda.
   */
  async obtenerDocumentos(forzarRefresco = false) {
    // 0. Verificación estricta de versión de esquema documental SSOT (Google Sheets como fuente de la verdad)
    const SCHEMA_VERSION_SSOT = '20260928_ssot_v4';
    try {
      const verLocal = typeof localStorage !== 'undefined' ? localStorage.getItem('agy_sgc_ssot_version') : null;
      if (verLocal !== SCHEMA_VERSION_SSOT) {
        localStorage.setItem('agy_sgc_ssot_version', SCHEMA_VERSION_SSOT);
        console.log('[DataService] 🔄 Actualización de esquema documental SSOT detectada. Limpiando caché local para refresco fiel desde Google Sheets...');
        if (cacheService && cacheService.guardarDocumentos) {
          await cacheService.guardarDocumentos([]);
        }
        // Purgar borradores residuales o registros fantasma que distorsionen los consecutivos oficiales
        try {
          const rawCreados = localStorage.getItem('agy_sgc_documentos_creados');
          if (rawCreados) {
            const creados = JSON.parse(rawCreados);
            let cambiado = false;
            for (const k of Object.keys(creados)) {
              if (k.startsWith('REG_FMT-GIC-016') || k.startsWith('FMT-GIC-016') || k.includes('::') || k.startsWith('_LISTA_')) {
                delete creados[k];
                cambiado = true;
              }
            }
            if (cambiado) {
              localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creados));
            }
          }
        } catch {}
        forzarRefresco = true;
      }
    } catch {}

    // 1. Carga inmediata desde IndexedDB si no se fuerza refresco
    if (!forzarRefresco) {
      try {
        const repoMeta = await cacheService.obtenerColeccionConMeta('documentos_catalogo');
        const cachedDocs = await cacheService.obtenerDocumentos();
        if (Array.isArray(cachedDocs) && cachedDocs.length > 0) {
          // Sanitización obligatoria: purgar residuos con prefijo _LISTA_ o ::
          const validos = cachedDocs.filter(d => d && d.codigo && !d.codigo.startsWith('_') && !d.codigo.includes('::'));
          if (validos.length !== cachedDocs.length) {
            console.warn(`[DataService] 🧹 Detectados ${cachedDocs.length - validos.length} registros residuales obsoletos (_LISTA_). Purgando caché y forzando refresco limpio...`);
            return await this.descargarCsvEnVivo(true);
          }
          this.documentosEnMemoria = validos;
          const ahora = Date.now();
          const edadMs = ahora - (repoMeta?.timestamp || 0);
          const TTL_REVALIDACION_MS = 3 * 60 * 1000; // 3 minutos para asegurar sincronización constante con Google Sheets

          if (edadMs < TTL_REVALIDACION_MS) {
            console.log(`[DataService] ⚡ Catálogo cargado desde caché persistente (${validos.length} docs, edad: ${Math.round(edadMs / 60000)} min).`);
            return validos;
          }

          // Si superó 3 minutos, devolver inmediatamente para renderizado a 0 ms y revalidar en segundo plano con Google Sheets
          console.log(`[DataService] 🔄 Caché documental revalidando en segundo plano con Google Sheets (SSOT)...`);
          setTimeout(() => {
            this.descargarCsvEnVivo(true).then((freshDocs) => {
              if (freshDocs && freshDocs.length > 0) {
                this.documentosEnMemoria = freshDocs;
                cacheService.guardarDocumentos(freshDocs);
                cacheService.guardarColeccion('documentos_catalogo', { total: freshDocs.length });
                window.dispatchEvent(new CustomEvent('agy_docs_updated', { detail: freshDocs }));
              }
            }).catch(() => {});
          }, 100);

          return cachedDocs;
        }
      } catch (eCache) {
        console.warn('[DataService] Error leyendo IndexedDB:', eCache);
      }
    }

    try {
      const liveDocs = await this.descargarCsvEnVivo(forzarRefresco);
      if (liveDocs && liveDocs.length > 0) {
        this.documentosEnMemoria = liveDocs;
        cacheService.guardarDocumentos(liveDocs);
        cacheService.guardarColeccion('documentos_catalogo', { total: liveDocs.length });
        return liveDocs;
      }
    } catch (e) {
      console.warn('[DataService] Sincronización en vivo falló:', e.message);
      if (forzarRefresco) {
        throw e;
      }
    }

    // Catálogo actualizado en memoria
    return this.documentosEnMemoria;
  }


  /**
   * Descarga en vivo Biblioteca (Google Sheets) y REPOSITORIO_DOCUMENTAL.csv (OneDrive) y los fusiona
   */
  async descargarCsvEnVivo(forzarRefresco = false) {
    const timestamp = Date.now();
    const queryOD = `?_t=${timestamp}${forzarRefresco ? '&forzar=true' : ''}`;
    const queryGS = `?_t=${timestamp}${forzarRefresco ? '&forzar=true' : ''}`;
    const esLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    let jsonObjRepositorio = null;
    let textoOneDrive = null;
    let textoGoogleSheets = null;

    // 1. Descargar catálogo estructurado (repositorio.dat / /api/repositorio) o REPOSITORIO_DOCUMENTAL.csv
    // En entorno local se consulta el proxy /api/repositorio; en GitHub Pages o red estática se descarga repositorio.dat
    if (esLocal) {
      try {
        const responseOD = await fetch(`/api/repositorio${queryOD}`, {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
        });

        if (responseOD.ok) {
          const txt = await responseOD.text();
          if (txt && txt.trim().startsWith('{')) {
            try {
              jsonObjRepositorio = JSON.parse(txt);
              cacheService.guardarRepositorio(jsonObjRepositorio);
            } catch {}
          } else if (txt && (txt.includes(';') || txt.includes(',')) && !txt.includes('<!DOCTYPE html')) {
            textoOneDrive = txt;
          }
        }
      } catch (err) {
        console.warn('[DataService] Error consultando /api/repositorio:', err.message);
      }
    }

    // Consulta estática directa a repositorio.dat si no se obtuvo por proxy
    if (!jsonObjRepositorio && !textoOneDrive) {
      try {
        const respDat = await fetch(`repositorio.dat${queryOD}`, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (respDat.ok) {
          const txtDat = await respDat.text();
          if (txtDat && txtDat.trim().startsWith('{')) {
            jsonObjRepositorio = JSON.parse(txtDat);
            cacheService.guardarRepositorio(jsonObjRepositorio);
          }
        }
      } catch (eDat) {}
    }

    // Consulta directa a la ruta oficial de OneDrive en la nube si no se obtuvo por proxy local ni repositorio.dat
    if (!jsonObjRepositorio && !textoOneDrive) {
      let rutaCloud = 'https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/IQCctVunBodCQq97XWMPrue7AaIRpd-pVgSUuZrMBWBcA2A?e=revQbX&download=1';
      try {
        const savedRoutes = localStorage.getItem('agy_sgc_custom_routes');
        if (savedRoutes) {
          const parsed = JSON.parse(savedRoutes);
          if (parsed.repositorioCsv && parsed.repositorioCsv.startsWith('http')) {
            rutaCloud = parsed.repositorioCsv;
          }
        }
      } catch {}

      try {
        const respCloud = await fetch(`${rutaCloud}${rutaCloud.includes('?') ? '&' : '?'}_t=${timestamp}`, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
        });
        if (respCloud.ok) {
          const txtCloud = await respCloud.text();
          if (txtCloud && (txtCloud.includes(';') || txtCloud.includes(',')) && !txtCloud.includes('<!DOCTYPE html')) {
            textoOneDrive = txtCloud;
          }
        }
      } catch (eCloud) {}
    }

    // Consulta de contingencia vía Google Apps Script (proxy en la nube con CORS habilitado para GitHub Pages)
    if (!jsonObjRepositorio && !textoOneDrive) {
      try {
        const urlGasOD = `https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec?action=repositorio&_t=${timestamp}`;
        const respGasOD = await fetch(urlGasOD, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
        });
        if (respGasOD.ok) {
          const txtGasOD = await respGasOD.text();
          if (txtGasOD && (txtGasOD.includes(';') || txtGasOD.includes(',')) && !txtGasOD.includes('<!DOCTYPE html')) {
            textoOneDrive = txtGasOD;
            console.log('[DataService] ✅ Catálogo de OneDrive descargado en vivo vía proxy en la nube (CORS habilitado).');
          }
        }
      } catch (eGasOD) {}
    }

    // Fallback de contingencia: Caché web temporal/persistente del usuario (IndexedDB)
    if (!jsonObjRepositorio && !textoOneDrive) {
      try {
        const repoCacheWeb = await cacheService.obtenerRepositorio();
        if (repoCacheWeb && repoCacheWeb.documentos && repoCacheWeb.documentos.length > 0) {
          jsonObjRepositorio = repoCacheWeb;
          console.log(`[DataService] ⚡ Recuperado catálogo estructurado desde almacenamiento web local del usuario (${repoCacheWeb.documentos.length} docs).`);
        }
      } catch (eWebCache) {}
    }


    // 2. Descargar Biblioteca (Google Sheets - SSOT Maestra)
    // En entorno local se consulta el proxy /api/biblioteca; en GitHub Pages se conecta directo a la nube
    if (esLocal) {
      try {
        const responseGS = await fetch(`/api/biblioteca${queryGS}`, {
          method: 'GET',
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined
        });
        if (responseGS.ok) {
          const txtGS = await responseGS.text();
          if (txtGS && (txtGS.includes(',') || txtGS.includes(';')) && !txtGS.includes('<!DOCTYPE html')) {
            textoGoogleSheets = txtGS;
          }
        }
      } catch (errGS) {}
    }

    // Consulta directa a Google Sheets Cloud (exportación CSV oficial)
    if (!textoGoogleSheets) {
      try {
        const urlDirectaGS = `https://docs.google.com/spreadsheets/d/1EOcucjQV4byUOp_AAfd1ySHk4tVdFmMeOoOQsSBbEa4/export?format=csv&_t=${timestamp}`;
        const respDirecta = await fetch(urlDirectaGS, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
        });
        if (respDirecta.ok) {
          const txtDirecta = await respDirecta.text();
          if (txtDirecta && (txtDirecta.includes(',') || txtDirecta.includes(';')) && !txtDirecta.includes('<!DOCTYPE html')) {
            textoGoogleSheets = txtDirecta;
          }
        }
      } catch (e) {}
    }

    // Fallback secundario a Google Apps Script API en caso de restricción CORS en exportación directa
    if (!textoGoogleSheets) {
      try {
        const urlGasDocs = `https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec?action=documentos&_t=${timestamp}`;
        const respGas = await fetch(urlGasDocs, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
        });
        if (respGas.ok) {
          const jsonGas = await respGas.json();
          if (jsonGas && Array.isArray(jsonGas.documentos) && jsonGas.documentos.length > 0) {
            const headers = Object.keys(jsonGas.documentos[0]);
            const filasCsv = [headers.join(',')];
            jsonGas.documentos.forEach((d) => {
              const fila = headers.map((h) => {
                const val = String(d[h] !== undefined && d[h] !== null ? d[h] : '').replace(/"/g, '""');
                return `"${val}"`;
              });
              filasCsv.push(fila.join(','));
            });
            textoGoogleSheets = filasCsv.join('\n');
          }
        }
      } catch (eGas) {}
    }

    // 3. Parsear mapa técnico de OneDrive indexado a <1ms (prioridad estructurada repositorio.dat)
    let onedriveMap = new Map();
    if (jsonObjRepositorio) {
      onedriveMap = this.parsearRepositorioDat(jsonObjRepositorio);
    } else if (textoOneDrive) {
      onedriveMap = this.parsearOneDriveMap(textoOneDrive);
      try {
        const docsArray = [];
        onedriveMap.forEach((v, k) => {
          if (!k.includes('::') && !k.startsWith('_LISTA_')) {
            docsArray.push({
              codigo: v.codigo || k,
              titulo: v.nombre || v.titulo || '',
              extension: v.extension || '',
              formato: v.formato || '',
              carpeta: v.carpeta || '',
              proceso: v.carpeta || '',
              tipoDocumento: v.tipoDoc || '',
              vinculoEdicion: v.urlEdicion || '',
              vinculoDescarga: v.urlDescarga || '',
              sharepointUrl: v.urlEdicion || v.urlDescarga || '',
              downloadUrl: v.urlDescarga || v.urlEdicion || '',
              disponible: true
            });
          }
        });
        if (docsArray.length > 0) {
          cacheService.guardarRepositorio({
            version: '1.0',
            empresa: 'Unión para la salud y la vida S.A.S.',
            ultimaActualizacion: new Date().toISOString(),
            total: docsArray.length,
            documentos: docsArray
          });
          console.log(`[DataService] 💾 Guardado repositorio en almacenamiento web local del usuario (${docsArray.length} docs).`);
        }
      } catch (eSave) {}
    } else {
      const repoPersistente = await cacheService.obtenerRepositorio();
      if (repoPersistente) {
        onedriveMap = this.parsearRepositorioDat(repoPersistente);
      }
    }

    // Incorporar a onedriveMap cualquier documento o registro creado por el usuario en almacenamiento web
    try {
      const rawCreados = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawCreados) {
        const objCreados = JSON.parse(rawCreados);
        Object.entries(objCreados).forEach(([cCode, cDoc]) => {
          if (cDoc && cDoc.codigo) {
            const codNorm = cDoc.codigo.trim().toUpperCase();
            if (!onedriveMap.has(codNorm)) {
              onedriveMap.set(codNorm, {
                codigo: codNorm,
                nombre: cDoc.titulo || '',
                titulo: cDoc.titulo || '',
                extension: cDoc.extension || '',
                formato: cDoc.formato || '',
                carpeta: cDoc.carpeta || cDoc.proceso || '',
                proceso: cDoc.proceso || cDoc.carpeta || '',
                tipoDoc: cDoc.tipoDocumento || '',
                urlEdicion: cDoc.sharepointUrl || '',
                urlDescarga: cDoc.downloadUrl || cDoc.sharepointUrl || '',
                sharepointUrl: cDoc.sharepointUrl || '',
                downloadUrl: cDoc.downloadUrl || cDoc.sharepointUrl || '',
                modificacion: cDoc.modificacion || new Date().toISOString()
              });
            }
          }
        });
      }
    } catch {}
    this._ultimoOnedriveMap = onedriveMap;


    // 4. Si tenemos Google Sheets, parsear híbrido
    if (textoGoogleSheets) {
      let docsHibridos = this.parsearGoogleSheetsHibrido(textoGoogleSheets, onedriveMap);
      if (docsHibridos && docsHibridos.length > 0) {
        docsHibridos = this.incorporarDocumentosCreados(docsHibridos, onedriveMap);
        this.documentosEnMemoria = docsHibridos;
        if (cacheService && cacheService.guardarDocumentos) {
          cacheService.guardarDocumentos(docsHibridos);
        }
        console.log(`[DataService] ✅ ${docsHibridos.length} documentos sincronizados desde Biblioteca (Google Sheets) y OneDrive.`);
        return docsHibridos;
      }
    }

    // 5. Fallback con DOCUMENTOS_REALES y el mapa de OneDrive
    if (onedriveMap.size > 0) {
      let fusionados = DOCUMENTOS_REALES.map((docBase, idx) => {
        const codUpper = (docBase.codigo || '').toUpperCase();
        const od = onedriveMap.get(codUpper);
        if (!od) return docBase;
        return {
          ...docBase,
          extension: od.extension || docBase.extension,
          formato: od.formato || docBase.formato,
          proceso: od.proceso || docBase.proceso,
          area: od.area || docBase.area,
          tipoDocumento: od.tipoDocumento || docBase.tipoDocumento,
          tipoProceso: od.tipoProceso || docBase.tipoProceso,
          modificacion: od.modificacion || docBase.modificacion,
          sharepointUrl: od.sharepointUrl || docBase.sharepointUrl,
          downloadUrl: od.downloadUrl || docBase.downloadUrl || od.sharepointUrl,
          disponible: Boolean(od.downloadUrl || od.sharepointUrl || docBase.downloadUrl),
          estado: Boolean(od.downloadUrl || od.sharepointUrl || docBase.downloadUrl) ? 'DISPONIBLE' : 'NO DISPONIBLE'
        };
      });

      // Enriquecer registros derivados existentes en DOCUMENTOS_REALES con vínculos directos de onedriveMap
      fusionados.forEach((docBase) => {
        if (docBase.titulo) {
          docBase.titulo = docBase.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
        }
        if (Array.isArray(docBase.registrosDerivados)) {
          docBase.registrosDerivados.forEach((reg) => {
            const codR = (reg.codigo || '').toUpperCase();
            const odR = this.buscarEnOneDriveMap(onedriveMap, codR, reg.titulo);
            if (odR) {
              reg.downloadUrl = odR.downloadUrl || reg.downloadUrl || odR.sharepointUrl || '';
              reg.sharepointUrl = odR.sharepointUrl || reg.sharepointUrl || odR.downloadUrl || '';
              if (odR.modificacion && odR.modificacion !== 'N/A') reg.modificacion = odR.modificacion;
              reg.disponible = Boolean(reg.downloadUrl || reg.sharepointUrl);
              reg.estado = reg.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
            }
            if (reg.titulo) {
              reg.titulo = reg.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
            }
          });
        }
      });


      fusionados = this.incorporarDocumentosCreados(fusionados, onedriveMap);
      this.documentosEnMemoria = fusionados;
      return fusionados;
    }

    return null;
  }

  normalizarTexto(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Parsea la nueva estructura de REPOSITORIO_DOCUMENTAL.csv de OneDrive (9 columnas técnicas):
  /**
   * Parsea la estructura de REPOSITORIO_DOCUMENTAL.csv de OneDrive (8 o 9 columnas técnicas)
   * de forma completamente resiliente, extrayendo metadatos, nombres limpios y URLs.
   */
  parsearOneDriveMap(textoOD) {
    const mapa = new Map();
    if (!textoOD) return mapa;

    const MAPA_RENOMBRES = {
      'DA-GMD-032': 'DA-GMD-001',
      'DA-GMD-033': 'DA-GMD-002',
      'DA-GMD-034': 'DA-GMD-003',
      'DA-GMD-035': 'DA-GMD-004',
      'FMT-GIC-016': 'FMT-GIC-015'
    };

    const lineas = textoOD.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length < 2) return mapa;

    const delimitador = lineas[0].includes(';') ? ';' : ',';

    const extraerNombreDesdeUrl = (url, cod) => {
      if (!url) return '';
      try {
        const urlDec = decodeURIComponent(url.split('?')[0]);
        const fileName = urlDec.split('/').pop() || '';
        let clean = fileName.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '');
        if (cod) {
          clean = clean.replace(new RegExp(`^${cod}[\\s\\-_]*`, 'i'), '');
        }
        return clean.trim();
      } catch (e) {
        return '';
      }
    };

    for (let i = 1; i < lineas.length; i++) {
      const valores = this.dividirLineaCsv(lineas[i], delimitador).map((v) => (v || '').trim().replace(/^"|"$/g, ''));
      if (valores.length < 2) continue;

      let codigo = valores[0] ? valores[0].trim().toUpperCase() : '';
      if (!codigo || codigo === 'CÓDIGO' || codigo === 'CODIGO') continue;

      if (MAPA_RENOMBRES[codigo]) {
        codigo = MAPA_RENOMBRES[codigo];
      }

      // 1. Extraer URLs (Columna 6: Vinculo edición con ?web=1, Columna 7: Vinculo descarga directo)
      let vinculoEdicion = '';
      let vinculoDescarga = '';

      if (valores.length >= 8 && (valores[6].startsWith('http') || valores[7].startsWith('http'))) {
        vinculoEdicion = valores[6].startsWith('http') ? valores[6] : valores[7];
        vinculoDescarga = valores[7].startsWith('http') ? valores[7] : valores[6];
      } else {
        const urls = valores.filter((p) => p.startsWith('http://') || p.startsWith('https://'));
        vinculoEdicion = urls.length > 0 ? urls[0] : '';
        vinculoDescarga = urls.length > 1 ? urls[1] : (urls.length > 0 ? urls[0] : '');
      }

      // 2. Extraer extensión
      let extRaw = '';
      for (const p of valores) {
        if (p.startsWith('.') && p.length <= 6) {
          extRaw = p.toLowerCase();
          break;
        }
      }
      if (!extRaw && vinculoDescarga) {
        const m = vinculoDescarga.match(/\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i);
        if (m) extRaw = '.' + m[1].toLowerCase();
      }

      // Ignorar filas que correspondan a carpetas o subdirectorios de SharePoint (sin extensión de archivo), pero almacenarlas como mapa de carpetas
      const tieneExtValida = Boolean(
        extRaw ||
        (vinculoDescarga && /\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(vinculoDescarga)) ||
        (valores[1] && /\.(docx|pdf|xlsx|doc|xls|csv)$/i.test(valores[1].trim()))
      );
      if (!tieneExtValida) {
        this._mapaCarpetasOneDrive = this._mapaCarpetasOneDrive || new Map();
        const codUpper = codigo.toUpperCase();
        this._mapaCarpetasOneDrive.set(codUpper, {
          codigo: codUpper,
          nombreCarpeta: valores[1] || '',
          urlEdicion: vinculoEdicion,
          urlDescarga: vinculoDescarga
        });
        continue;
      }

      const esExcel = extRaw.includes('xls') || extRaw.includes('csv') || (vinculoDescarga && (vinculoDescarga.toLowerCase().includes('.xlsx') || vinculoDescarga.toLowerCase().includes('.xls')));
      const esRegistroCod = /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/i.test(codigo);
      const esFMT = esDocumentoFMT(codigo) && !esRegistroCod;

      let formato = 'PDF';
      let extension = 'PDF';
      if (esExcel) {
        formato = 'Excel';
        extension = 'XLS';
      } else if (esFMT) {
        formato = 'Word';
        extension = 'DOC';
      }

      // 3. Modificación
      let modificacion = '';
      for (const p of valores) {
        if (/^\d{4}-\d{2}-\d{2}/.test(p)) {
          modificacion = p;
          break;
        }
      }

      // 4. Título
      let titulo = '';
      for (const p of valores.slice(1)) {
        if ((p.endsWith('.docx') || p.endsWith('.pdf') || p.endsWith('.xlsx')) && !p.startsWith('http')) {
          let t = p.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '');
          t = t.replace(new RegExp(`^${codigo}[\\s\\-_]*`, 'i'), '');
          titulo = t.trim();
          break;
        }
      }
      if (!titulo) {
        titulo = extraerNombreDesdeUrl(vinculoDescarga || vinculoEdicion, codigo);
      }

      // 5. Carpeta / Proceso
      let carpeta = '';
      for (const p of valores) {
        if (!p.startsWith('http') && !p.startsWith('.') && !/^\d{4}-\d{2}-\d{2}/.test(p) && p.toUpperCase() !== codigo && p !== titulo && !/\.(docx|pdf|xlsx|doc|xls|csv)$/i.test(p)) {
          if (/gesti[oó]n|seguridad y salud|planeaci[oó]n|bienestar|n[oó]mina|talento humano|tecnolog[ií]a|calidad|especialistas|medicina general/i.test(p)) {
            carpeta = p;
            break;
          }
        }
      }
      if (!carpeta && vinculoDescarga) {
        try {
          const urlDec = decodeURIComponent(vinculoDescarga);
          const partesRuta = urlDec.split('/');
          for (let s = partesRuta.length - 2; s >= 0; s--) {
            const seg = partesRuta[s];
            if (/gesti[oó]n|seguridad y salud|planeaci[oó]n|bienestar|n[oó]mina|talento humano|tecnolog[ií]a|calidad|especialistas|medicina general/i.test(seg)) {
              carpeta = seg;
              break;
            }
          }
        } catch (e) {}
      }

      // 6. Área y Tipo de Proceso Canónicos
      const area = normalizarAreaDoc(valores.find(v => MAPA_NORMALIZACION_AREAS[(v || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]) || '', codigo);
      const tipoProceso = normalizarTipoProcesoDoc('', area, codigo);

      if (!carpeta) {
        carpeta = area;
      }

      // 8. Tipo de Documento
      let tipoDoc = '';
      for (const p of valores) {
        if (/^(Documento Anexo|Formato|Instructivo|Manual|Pol[ií]tica|Procedimiento|Programa|Protocolo|Reglamento|Plan)$/i.test(p)) {
          tipoDoc = p;
          break;
        }
      }
      if (!tipoDoc) {
        const prefijo = codigo.split('-')[0];
        const mapaTipos = {
          DA: 'Documento Anexo', DOC: 'Documento Anexo', FMT: 'Formato', FT: 'Formato',
          GUA: 'Guía', GU: 'Guía', INS: 'Instructivo', IN: 'Instructivo', MN: 'Manual',
          POL: 'Política', PT: 'Política', PRC: 'Procedimiento', PR: 'Procedimiento',
          PRG: 'Programa', PG: 'Programa', PRT: 'Protocolo', RG: 'Reglamento', PLA: 'Plan'
        };
        tipoDoc = mapaTipos[prefijo] || 'Documento Anexo';
      }

      const itemOD = {
        codigo: codigo,
        titulo: titulo,
        extension: extension,
        formato: formato,
        tipoProceso: tipoProceso,
        area: area,
        proceso: carpeta || area,
        carpeta: carpeta || area,
        tipoDocumento: normalizarTipoDocumentoDoc(tipoDoc, codigo),
        modificacion: modificacion,
        sharepointUrl: vinculoEdicion || vinculoDescarga,
        downloadUrl: vinculoDescarga || vinculoEdicion
      };

      const codUpper = codigo.toUpperCase();
      // Guardar el primero como referencia base por código
      if (!mapa.has(codUpper)) {
        mapa.set(codUpper, itemOD);
      }
      // Guardar por clave compuesta (código + título normalizado) para vincular archivos con nombre único
      const tNorm = this.normalizarTexto(titulo);
      if (tNorm) {
        mapa.set(`${codUpper}::${tNorm}`, itemOD);
      }
      // Guardar en la lista acumulada de ese código
      const claveLista = `_LISTA_${codUpper}`;
      if (!mapa.has(claveLista)) {
        mapa.set(claveLista, []);
      }
      mapa.get(claveLista).push(itemOD);
    }

    return mapa;
  }

  /**
   * Parsea el catálogo estructurado JSON (repositorio.dat / /api/repositorio)
   * creando el mapa de indexación inmediata a <1 ms para documentos base y secundarios.
   */
  parsearRepositorioDat(jsonObj) {
    const mapa = new Map();
    if (!jsonObj) return mapa;
    const items = Array.isArray(jsonObj) ? jsonObj : (jsonObj.documentos || []);

    for (const item of items) {
      if (!item || !item.codigo) continue;
      const codUpper = item.codigo.trim().toUpperCase();
      const itemOD = {
        codigo: item.codigo,
        titulo: item.titulo || item.documento || '',
        extension: item.extension || '',
        formato: item.formato || 'Word',
        tipoProceso: item.tipoProceso || '',
        area: item.area || item.carpeta || '',
        proceso: item.proceso || item.carpeta || '',
        carpeta: item.carpeta || '',
        tipoDocumento: item.tipoDocumento || '',
        modificacion: item.modificacion || '',
        sharepointUrl: item.sharepointUrl || item.vinculoEdicion || item.vinculoDescarga || '',
        downloadUrl: item.downloadUrl || item.vinculoDescarga || item.vinculoEdicion || ''
      };

      if (!mapa.has(codUpper)) {
        mapa.set(codUpper, itemOD);
      }
      const tNorm = this.normalizarTexto(itemOD.titulo);
      if (tNorm) {
        mapa.set(`${codUpper}::${tNorm}`, itemOD);
      }
      const claveLista = `_LISTA_${codUpper}`;
      if (!mapa.has(claveLista)) {
        mapa.set(claveLista, []);
      }
      mapa.get(claveLista).push(itemOD);
    }

    return mapa;
  }

  /**
   * Busca de forma directa y oficial un archivo en el mapa de OneDrive.
   * POLÍTICA INSTITUCIONAL ACTUALIZADA:
   * El repositorio contiene los vínculos oficiales de TODOS los documentos (tanto base como secundarios).
   * NO se calculan rutas.
   */
  buscarEnOneDriveMap(onedriveMap, codigo, titulo = '', esRegistro = false) {
    if (!onedriveMap || !codigo) return null;
    const codUpper = (codigo || '').trim().toUpperCase();
    const tNorm = this.normalizarTexto(titulo);

    // 1. Coincidencia exacta por código oficial (aplica tanto para base FMT-GIC-015 como derivado FMT-GIC-015-3)
    if (onedriveMap.has(codUpper)) {
      return onedriveMap.get(codUpper);
    }

    // 2. Coincidencia compuesta código::título normalizado
    if (tNorm) {
      const claveCompuesta = `${codUpper}::${tNorm}`;
      if (onedriveMap.has(claveCompuesta)) {
        return onedriveMap.get(claveCompuesta);
      }
      const lista = onedriveMap.get(`_LISTA_${codUpper}`);
      if (Array.isArray(lista) && lista.length > 0) {
        const exacto = lista.find((it) => this.normalizarTexto(it.titulo) === tNorm);
        if (exacto) return exacto;
        const parcial = lista.find((it) => {
          const itNorm = this.normalizarTexto(it.titulo);
          return itNorm.includes(tNorm) || tNorm.includes(itNorm);
        });
        if (parcial) return parcial;
      }
    }

    return null;
  }


  /**
   * Procesa la hoja de Google Sheets (Biblioteca) y combina los metadatos y vínculos técnicos de OneDrive
   */
  parsearGoogleSheetsHibrido(textoGS, onedriveMap) {
    const lineas = textoGS.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length < 2) return [];

    const delimitador = lineas[0].includes(';') ? ';' : ',';
    const rawHeaders = this.dividirLineaCsv(lineas[0], delimitador);
    const headers = rawHeaders.map((h) => this.normalizarTexto(h));

    const getColIndex = (nombresPosibles, fallbackIdx) => {
      // 1. Prioridad: Coincidencia exacta
      for (const nombre of nombresPosibles) {
        const target = this.normalizarTexto(nombre);
        const idx = headers.findIndex((h) => h === target);
        if (idx !== -1) return idx;
      }
      // 2. Fallback: Coincidencia parcial
      for (const nombre of nombresPosibles) {
        const target = this.normalizarTexto(nombre);
        const idx = headers.findIndex((h) => h.includes(target));
        if (idx !== -1) return idx;
      }
      return fallbackIdx;
    };

    const idxCodigo = getColIndex(['codigo'], 4);
    const idxTitulo = getColIndex(['nombredeldocumento', 'documento', 'titulo', 'nombre'], 5);
    const idxArea = getColIndex(['area', 'areainstitucional', 'macroproceso'], 2);
    const idxDisp = getColIndex(['disponibilidad', 'disponible', 'estadoactual'], 19);
    const idxVersion = getColIndex(['version'], 6);
    const idxVigencia = getColIndex(['vigencia'], 7);
    const idxUbicacion = getColIndex(['ubicacion', 'ubicación'], 8);
    const idxTipoProcesoGS = getColIndex(['tipodeproceso', 'tipoproceso', 'procesoestrategico'], 9);
    const idxProceso = getColIndex(['proceso', 'procesoespecifico', 'carpeta'], 10);
    const idxDir = getColIndex(['directivo', 'permisodirectivo'], 11);
    const idxAdm = getColIndex(['administrativo', 'permisoadministrativo'], 12);
    const idxOp = getColIndex(['operativo', 'permisooperativo'], 13);
    const idxDescargable = getColIndex(['descargable'], 14);
    const idxTiempoRetencion = getColIndex(['tiempo', 'tiempoderetencion', 'retencion'], 15);
    const idxLugar = getColIndex(['lugar', 'lugardearchivo', 'custodia'], 16);
    const idxTipoCambio = getColIndex(['tipodecambio', 'tipocambio', 'cambio'], 17);
    const idxFechaVencimiento = getColIndex(['fechadevencimiento', 'vencimiento'], 18);
    const idxEstado = getColIndex(['estadoactual', 'estado'], 19);
    const idxTipoDoc = getColIndex(['tipodedocumento', 'tipodocumento', 'tipo'], 1);
    const idxSubclase = getColIndex(['subclase', 'nivel', 'niveldocumental', 'tiporegistro', 'jerarquia', 'clasedocumento'], -1);
    const idxFechaAprobacion = getColIndex(['fechadeaprobacion', 'fechaaprobacion', 'fecha'], 0);

    const filas = [];
    const mapaDocsBase = new Map();
    const registrosPendientes = [];

    for (let i = 1; i < lineas.length; i++) {
      const linea = lineas[i];
      const valores = this.dividirLineaCsv(linea, delimitador);
      if (valores.length < 2) continue;

      let codigo = idxCodigo !== -1 && valores[idxCodigo] ? valores[idxCodigo].trim() : '';
      const tituloGS = idxTitulo !== -1 && valores[idxTitulo] ? valores[idxTitulo].trim() : '';
      if (!codigo && !tituloGS) continue;

      const MAPA_RENOMBRES = {
        'DA-GMD-032': 'DA-GMD-001',
        'DA-GMD-033': 'DA-GMD-002',
        'DA-GMD-034': 'DA-GMD-003',
        'DA-GMD-035': 'DA-GMD-004',
        'FMT-GIC-016': 'FMT-GIC-015'
      };
      if (codigo && MAPA_RENOMBRES[codigo.toUpperCase()]) {
        codigo = MAPA_RENOMBRES[codigo.toUpperCase()];
      }

      const codUpper = codigo.toUpperCase();
      const mCodSec = codUpper.match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
      const subclaseRaw = idxSubclase !== -1 && valores[idxSubclase] ? valores[idxSubclase].trim().toLowerCase() : '';
      const codPadre = mCodSec ? mCodSec[1] : codUpper;
      const esRegistro = Boolean(mCodSec) || subclaseRaw.includes('registro') || subclaseRaw.includes('derivado') || mapaDocsBase.has(codUpper) || mapaDocsBase.has(codPadre);

      const odData = this.buscarEnOneDriveMap(onedriveMap, codUpper, tituloGS, esRegistro);
      const baseDoc = DOCUMENTOS_REALES.find((d) => d.codigo && d.codigo.toUpperCase() === codUpper) || null;

      // 1. Estado y exclusión de obsoletos, inactivos y retirados de la hoja
      const estadoRaw = idxEstado !== -1 && valores[idxEstado] ? valores[idxEstado].trim() : 'Activo';
      const estadoLower = estadoRaw.toLowerCase();
      if (
        estadoLower.includes('obsoleto') ||
        estadoLower.includes('inactivo') ||
        estadoLower.includes('retirado') ||
        estadoLower.includes('eliminado') ||
        estadoLower.includes('dado de baja') ||
        estadoLower.includes('fuera de cat')
      ) {
        continue;
      }

      // 2. Metadatos y URLs de OneDrive
      const rawExt = (odData?.extension || (!esRegistro ? baseDoc?.extension : '') || '').toUpperCase();
      const rawUrl = (odData?.downloadUrl || (!esRegistro ? baseDoc?.downloadUrl : '') || '').toLowerCase();
      const esExcel = rawExt.includes('XLS') || rawExt.includes('CSV') || rawUrl.endsWith('.xlsx') || rawUrl.endsWith('.xls');
      const esFMT = esDocumentoFMT(codigo) && !esRegistro;
      let formato = 'PDF';
      let extension = 'PDF';
      if (esExcel) {
        formato = 'Excel';
        extension = 'XLS';
      } else if (esFMT) {
        formato = 'Word';
        extension = 'DOC';
      }
      let modificacion = odData?.modificacion || (esRegistro ? 'N/A' : (baseDoc?.modificacion || 'N/A'));
      let sharepointUrl = odData?.sharepointUrl || (esRegistro ? '' : (baseDoc?.sharepointUrl || ''));
      let downloadUrl = odData?.downloadUrl || (esRegistro ? '' : (baseDoc?.downloadUrl || sharepointUrl));

      // Protección estricta: un registro derivado jamás debe apuntar al archivo del documento base padre
      if (esRegistro && baseDoc) {
        if (downloadUrl === baseDoc.downloadUrl || sharepointUrl === baseDoc.sharepointUrl) {
          downloadUrl = '';
          sharepointUrl = '';
        }
      }

      // Si es un registro derivado oficial de la hoja y aún no tiene enlaces en onedriveMap,
      // resolver su enlace oficial SharePoint a partir del documento base padre
      if (esRegistro && (!downloadUrl || !sharepointUrl)) {
        const padreDoc = (baseDoc && !baseDoc.esRegistro) ? baseDoc : (DOCUMENTOS_REALES.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro) || null);
        if (padreDoc && (padreDoc.sharepointUrl || padreDoc.downloadUrl)) {
          const enlacesAuto = this.generarEnlacesDocumentoSecundario(padreDoc, {
            codigo: codUpper,
            titulo: tituloGS,
            extension: rawExt || 'DOC'
          });
          if (enlacesAuto) {
            sharepointUrl = sharepointUrl || enlacesAuto.sharepointUrl;
            downloadUrl = downloadUrl || enlacesAuto.downloadUrl || sharepointUrl;
          }
        }
      }

      // Si la fecha de modificación no vino de OneDrive, usar la fecha de aprobación de Google Sheets
      if (esRegistro && modificacion === 'N/A') {
        const fechaSheet = idxFechaAprobacion !== -1 && valores[idxFechaAprobacion] ? valores[idxFechaAprobacion].trim() : '';
        if (fechaSheet && fechaSheet !== 'N/A') {
          modificacion = fechaSheet;
        } else {
          const padreDoc = (baseDoc && !baseDoc.esRegistro) ? baseDoc : (DOCUMENTOS_REALES.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro) || null);
          if (padreDoc?.modificacion && padreDoc.modificacion !== 'N/A') {
            modificacion = padreDoc.modificacion;
          }
        }
      }

      const tieneEnlaceActivo = Boolean(
        (downloadUrl && downloadUrl.trim() !== '' && downloadUrl !== '#' && downloadUrl !== 'N/A') ||
        (sharepointUrl && sharepointUrl.trim() !== '' && sharepointUrl !== '#' && sharepointUrl !== 'N/A')
      );

      // 3. Disponibilidad
      const dispStr = idxDisp !== -1 && valores[idxDisp] ? valores[idxDisp].trim().toUpperCase() : '';
      const dispValida = dispStr ? (dispStr === 'SI' || dispStr === 'SÍ' || dispStr === 'DISPONIBLE' || dispStr === 'TRUE' || dispStr === 'ACTIVO') : true;
      const disponible = dispValida && tieneEnlaceActivo;

      // 4. Descargable
      const descStr = idxDescargable !== -1 && valores[idxDescargable] ? valores[idxDescargable].trim().toUpperCase() : '';
      const descargable = descStr === 'NO' || descStr === 'FALSE' ? false : true;

      // 5. Permisos RBAC estrictos según la celda (X = permitido, vacía = no permitido)
      const opStr = idxOp !== -1 && valores[idxOp] ? valores[idxOp].trim().toUpperCase() : '';
      const admStr = idxAdm !== -1 && valores[idxAdm] ? valores[idxAdm].trim().toUpperCase() : '';
      const dirStr = idxDir !== -1 && valores[idxDir] ? valores[idxDir].trim().toUpperCase() : '';

      const permisoOperativo = Boolean(opStr === 'X' || opStr === 'TRUE' || opStr === 'SI' || opStr === 'SÍ' || opStr === '1');
      const permisoAdministrativo = Boolean(admStr === 'X' || admStr === 'TRUE' || admStr === 'SI' || admStr === 'SÍ' || admStr === '1');
      const permisoDirectivo = Boolean(dirStr === 'X' || dirStr === 'TRUE' || dirStr === 'SI' || dirStr === 'SÍ' || dirStr === '1');

      // 6. Versión, Tipo de Cambio, Vigencia, Tiempo de Retención, Lugar y Vencimiento
      const version = idxVersion !== -1 && valores[idxVersion] && valores[idxVersion].trim() ? valores[idxVersion].trim() : (baseDoc?.version || '1');
      const tipoCambio = idxTipoCambio !== -1 && valores[idxTipoCambio] && valores[idxTipoCambio].trim() ? valores[idxTipoCambio].trim() : (baseDoc?.tipoCambio || 'Creacion del documento');
      const vigencia = idxVigencia !== -1 && valores[idxVigencia] && valores[idxVigencia].trim() ? valores[idxVigencia].trim() : (baseDoc?.vigencia || baseDoc?.fechaAprobacion || '01/08/2026');
      const tiempoRetencion = idxTiempoRetencion !== -1 && valores[idxTiempoRetencion] && valores[idxTiempoRetencion].trim() ? valores[idxTiempoRetencion].trim() : (baseDoc?.tiempoRetencion || baseDoc?.tiempo || '5 Años');
      const lugar = idxLugar !== -1 && valores[idxLugar] && valores[idxLugar].trim() ? valores[idxLugar].trim() : (baseDoc?.lugar || 'Oficina Central y sede');
      const fechaVencimiento = idxFechaVencimiento !== -1 && valores[idxFechaVencimiento] && valores[idxFechaVencimiento].trim() ? valores[idxFechaVencimiento].trim() : (baseDoc?.fechaVencimiento || '');
      const rawTitulo = (tituloGS || baseDoc?.titulo || codigo).trim();
      const titulo = rawTitulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();

      // 7. Campos Categóricos
      const rawAreaGS = idxArea !== -1 && valores[idxArea] ? valores[idxArea].trim() : '';
      const rawProcesoGS = idxProceso !== -1 && valores[idxProceso] ? valores[idxProceso].trim() : '';
      const rawTipoDocGS = idxTipoDoc !== -1 && valores[idxTipoDoc] ? valores[idxTipoDoc].trim() : '';
      const rawTipoProcesoGS = idxTipoProcesoGS !== -1 && valores[idxTipoProcesoGS] ? valores[idxTipoProcesoGS].trim() : '';

      const tipoDoc = normalizarTipoDocumentoDoc(rawTipoDocGS || odData?.tipoDocumento || baseDoc?.tipoDocumento || '', codigo);

      const areaRaw = (rawAreaGS && rawAreaGS !== 'N/A' && rawAreaGS !== '') ? rawAreaGS : (odData?.area || baseDoc?.area || '');
      const area = normalizarAreaDoc(areaRaw, codigo);

      const proceso = (rawProcesoGS && rawProcesoGS !== 'N/A' && rawProcesoGS !== '') ? rawProcesoGS : (odData?.proceso || baseDoc?.proceso || area);

      const rawTipoProceso = (rawTipoProcesoGS && rawTipoProcesoGS !== 'N/A' && rawTipoProcesoGS !== '') ? rawTipoProcesoGS : (odData?.tipoProceso || baseDoc?.tipoProceso || '');
      const tipoProceso = normalizarTipoProcesoDoc(rawTipoProceso, area, codigo);

      if (!esRegistro) {
        const docBase = {
          id: `doc-${String(i).padStart(3, '0')}`,
          codigo: codigo,
          titulo: titulo,
          formato: formato,
          extension: extension,
          estado: disponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
          disponible: disponible,
          descargable: descargable,
          permisoOperativo: permisoOperativo,
          permisoAdministrativo: permisoAdministrativo,
          permisoDirectivo: permisoDirectivo,
          estadoDocumento: estadoRaw,
          tipoProceso: tipoProceso,
          area: area,
          proceso: proceso,
          carpeta: proceso,
          tipoDocumento: normalizarTipoDocumentoDoc(tipoDoc, codigo),
          subclase: 'Base',
          esRegistro: false,
          registrosDerivados: [],
          modificacion: modificacion,
          version: version,
          vigencia: vigencia,
          tiempoRetencion: tiempoRetencion,
          tiempo: tiempoRetencion,
          tiempoVigencia: tiempoRetencion,
          lugar: lugar,
          lugarArchivo: lugar,
          fechaVencimiento: fechaVencimiento,
          tipoCambio: tipoCambio,
          descripcion: `${tipoDoc} para ${area} dentro del proceso ${proceso}.`,
          sharepointUrl: sharepointUrl,
          downloadUrl: downloadUrl
        };
        filas.push(docBase);
        mapaDocsBase.set(codUpper, docBase);
      } else {
        const registroObj = {
          id: `${codUpper}_REG_${String(i).padStart(3, '0')}`,
          codigo: codigo,
          titulo: titulo,
          formato: formato,
          extension: extension,
          estado: disponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
          disponible: disponible,
          descargable: descargable,
          permisoOperativo: permisoOperativo,
          permisoAdministrativo: permisoAdministrativo,
          permisoDirectivo: permisoDirectivo,
          estadoDocumento: estadoRaw,
          tipoProceso: tipoProceso,
          area: area,
          proceso: proceso,
          carpeta: proceso,
          tipoDocumento: normalizarTipoDocumentoDoc(tipoDoc, codigo),
          subclase: 'Registro',
          esRegistro: true,
          documentoPadreCodigo: codPadre,
          modificacion: modificacion,
          version: version,
          vigencia: vigencia,
          tiempoRetencion: tiempoRetencion,
          tiempo: tiempoRetencion,
          tiempoVigencia: tiempoRetencion,
          lugar: lugar,
          lugarArchivo: lugar,
          fechaVencimiento: fechaVencimiento,
          tipoCambio: tipoCambio,
          descripcion: `${tipoDoc} (Registro Derivado) para ${area} dentro del proceso ${proceso}.`,
          sharepointUrl: sharepointUrl,
          downloadUrl: downloadUrl
        };
        if (mapaDocsBase.has(codPadre)) {
          const docPadre = mapaDocsBase.get(codPadre);
          docPadre.registrosDerivados = docPadre.registrosDerivados || [];
          registroObj.proceso = docPadre.proceso;
          registroObj.carpeta = docPadre.carpeta || docPadre.proceso;
          registroObj.area = docPadre.area;
          registroObj.areaNombre = docPadre.areaNombre || docPadre.area;
          registroObj.tipoProceso = docPadre.tipoProceso;
          registroObj.documentoPadreCodigo = docPadre.codigo;

          // POLÍTICA INSTITUCIONAL ACTUALIZADA:
          // Todos los documentos secundarios y base tienen sus vínculos oficiales directos en el repositorio.
          // NO se calculan rutas. Se toma directamente el enlace de OneDrive/SharePoint indexado.
          if (!registroObj.downloadUrl && !registroObj.sharepointUrl) {
            const odDirecto = this.buscarEnOneDriveMap(onedriveMap, registroObj.codigo, registroObj.titulo);
            if (odDirecto) {
              registroObj.downloadUrl = odDirecto.downloadUrl;
              registroObj.sharepointUrl = odDirecto.sharepointUrl;
              if (odDirecto.modificacion && odDirecto.modificacion !== 'N/A') {
                registroObj.modificacion = odDirecto.modificacion;
              }
            }
          }
          registroObj.disponible = Boolean(registroObj.downloadUrl || registroObj.sharepointUrl);
          registroObj.estado = registroObj.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';

          const coincideYa = (r) => {
            if (r.id === registroObj.id) return true;
            if (r.codigo && registroObj.codigo && r.codigo.toUpperCase() === registroObj.codigo.toUpperCase()) return true;
            const m1 = (r.codigo || '').match(/-(\d+)$/);
            const m2 = (registroObj.codigo || '').match(/-(\d+)$/);
            if (m1 && m2 && m1[1] !== m2[1]) return false;
            if (r.titulo && registroObj.titulo && r.titulo.toLowerCase().trim() === registroObj.titulo.toLowerCase().trim()) return true;
            const n1 = (r.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            const n2 = (registroObj.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return !m1 && !m2 && (n1 === n2 || (n1.length > 5 && n2.length > 5 && (n1.includes(n2) || n2.includes(n1))));
          };
          const idxReg = docPadre.registrosDerivados.findIndex(coincideYa);
          if (idxReg >= 0) {
            docPadre.registrosDerivados[idxReg] = { 
              ...docPadre.registrosDerivados[idxReg], 
              ...registroObj,
              titulo: (registroObj.titulo || docPadre.registrosDerivados[idxReg].titulo || '').replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim()
            };
          } else {
            docPadre.registrosDerivados.push(registroObj);
          }
          docPadre.registrosDerivados = this._deduplicarRegistros(docPadre.registrosDerivados);
        } else {
          registrosPendientes.push({ codUpper: codPadre, registroObj });
        }
      }
    }

    // Vincular registros derivados pendientes con su documento base
    registrosPendientes.forEach(({ codUpper: codP, registroObj }) => {
      if (mapaDocsBase.has(codP)) {
        const docPadre = mapaDocsBase.get(codP);
        docPadre.registrosDerivados = docPadre.registrosDerivados || [];
        if (!registroObj.downloadUrl && !registroObj.sharepointUrl) {
          const odDirecto = this.buscarEnOneDriveMap(onedriveMap, registroObj.codigo, registroObj.titulo);
          if (odDirecto) {
            registroObj.downloadUrl = odDirecto.downloadUrl;
            registroObj.sharepointUrl = odDirecto.sharepointUrl;
            if (odDirecto.modificacion && odDirecto.modificacion !== 'N/A') {
              registroObj.modificacion = odDirecto.modificacion;
            }
          }
        }
        registroObj.disponible = Boolean(registroObj.downloadUrl || registroObj.sharepointUrl);
        registroObj.estado = registroObj.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
        docPadre.registrosDerivados.push(registroObj);
        docPadre.registrosDerivados = this._deduplicarRegistros(docPadre.registrosDerivados);
      } else {

        const docBaseSintetico = {
          ...registroObj,
          id: codP,
          subclase: 'Base',
          esRegistro: false,
          registrosDerivados: [registroObj]
        };
        filas.push(docBaseSintetico);
        mapaDocsBase.set(codP, docBaseSintetico);
      }
    });

    // 8. POLÍTICA ESTRICTA: Google Sheets es la ÚNICA FUENTE DE LA VERDAD (SSOT).
    // Solo los documentos y registros derivados registrados en Google Sheets son válidos y oficiales.
    // El mapa de OneDrive/SharePoint se utiliza ÚNICAMENTE para enriquecer los vínculos directos y metadatos técnicos.
    // NUNCA se deben inyectar archivos de SharePoint/OneDrive que no estén registrados en la hoja de cálculo.
    if (onedriveMap && onedriveMap.size > 0) {
      filas.forEach((docBase) => {
        if (!docBase.downloadUrl && !docBase.sharepointUrl) {
          const od = this.buscarEnOneDriveMap(onedriveMap, docBase.codigo, docBase.titulo);
          if (od) {
            docBase.downloadUrl = od.downloadUrl || od.sharepointUrl || '';
            docBase.sharepointUrl = od.sharepointUrl || od.downloadUrl || '';
            if (od.modificacion && od.modificacion !== 'N/A') docBase.modificacion = od.modificacion;
            docBase.disponible = Boolean(docBase.downloadUrl || docBase.sharepointUrl);
            docBase.estado = docBase.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
          }
        }
        if (docBase.titulo) {
          docBase.titulo = docBase.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
        }
        if (Array.isArray(docBase.registrosDerivados)) {
          docBase.registrosDerivados.forEach((reg) => {
            if (!reg.downloadUrl && !reg.sharepointUrl) {
              const odR = this.buscarEnOneDriveMap(onedriveMap, reg.codigo, reg.titulo);
              if (odR) {
                reg.downloadUrl = odR.downloadUrl || odR.sharepointUrl || '';
                reg.sharepointUrl = odR.sharepointUrl || odR.downloadUrl || '';
                if (odR.modificacion && odR.modificacion !== 'N/A') reg.modificacion = odR.modificacion;
                reg.disponible = Boolean(reg.downloadUrl || reg.sharepointUrl);
                reg.estado = reg.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
              }
            }
            if (reg.titulo) {
              reg.titulo = reg.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
            }
          });
          docBase.registrosDerivados = this._deduplicarRegistros(docBase.registrosDerivados);
        }
      });
    }

    return filas;
  }

  parsearCsv(texto) {
    const onedriveMap = this.parsearOneDriveMap(texto);
    if (!onedriveMap || onedriveMap.size === 0) return [...DOCUMENTOS_REALES];

    return DOCUMENTOS_REALES.map((docBase, idx) => {
      const codUpper = (docBase.codigo || '').toUpperCase();
      const od = onedriveMap.get(codUpper);
      if (!od) return docBase;
      return {
        ...docBase,
        subclase: docBase.subclase || 'Base',
        esRegistro: Boolean(docBase.esRegistro),
        registrosDerivados: Array.isArray(docBase.registrosDerivados) ? docBase.registrosDerivados : [],
        extension: od.extension || docBase.extension,
        formato: od.formato || docBase.formato,
        proceso: od.proceso || docBase.proceso,
        area: od.area || docBase.area,
        tipoDocumento: od.tipoDocumento || docBase.tipoDocumento,
        tipoProceso: od.tipoProceso || docBase.tipoProceso,
        modificacion: od.modificacion || docBase.modificacion,
        sharepointUrl: od.sharepointUrl || docBase.sharepointUrl,
        downloadUrl: od.downloadUrl || docBase.downloadUrl || od.sharepointUrl,
        disponible: Boolean(od.downloadUrl || od.sharepointUrl || docBase.downloadUrl),
        estado: Boolean(od.downloadUrl || od.sharepointUrl || docBase.downloadUrl) ? 'DISPONIBLE' : 'NO DISPONIBLE'
      };
    });
  }

  dividirLineaCsv(linea, delimitador) {
    const resultado = [];
    let valorActual = '';
    let dentroDeComillas = false;

    for (let j = 0; j < linea.length; j++) {
      const char = linea[j];
      if (char === '"') {
        dentroDeComillas = !dentroDeComillas;
      } else if (char === delimitador && !dentroDeComillas) {
        resultado.push(valorActual.replace(/^"|"$/g, '').trim());
        valorActual = '';
      } else {
        valorActual += char;
      }
    }
    resultado.push(valorActual.replace(/^"|"$/g, '').trim());
    return resultado;
  }

  obtenerUrlSoloLectura(urlOriginal) {
    if (!urlOriginal || urlOriginal === '#' || urlOriginal === '') return '';
    let limpia = urlOriginal
      .replace(/(\?|&)action=[^&]*/gi, '')
      .replace(/(\?|&)web=[^&]*/gi, '');
    const sep = limpia.includes('?') ? '&' : '?';
    return `${limpia}${sep}action=view&web=1`;
  }

  obtenerUrlEdicion(urlOriginal) {
    if (!urlOriginal || urlOriginal === '#' || urlOriginal === '') return '';
    let limpia = urlOriginal
      .replace(/(\?|&)action=[^&]*/gi, '')
      .replace(/(\?|&)web=[^&]*/gi, '');
    const sep = limpia.includes('?') ? '&' : '?';
    return `${limpia}${sep}action=edit&web=1`;
  }

  esDocumentoFMT(codigo) {
    return esDocumentoFMT(codigo);
  }

  determinarEstrategiaDescarga(doc) {
    return determinarEstrategiaDescarga(doc);
  }

  /**
   * Construye el endpoint de streaming y conversión al vuelo a PDF
   * utilizando la API REST v2.0 nativa de Microsoft 365 / SharePoint Online.
   */
  obtenerUrlDescargaPdf(doc) {
    const urlOriginal = (doc.downloadUrl || doc.sharepointUrl || '').trim();
    if (!urlOriginal || urlOriginal === '#' || urlOriginal === '') return '';

    const limpia = urlOriginal.split('?')[0];

    // Si ya es un enlace a PDF
    if (limpia.toLowerCase().endsWith('.pdf')) {
      return urlOriginal;
    }

    // En servidor local (server.py con Word COM), priorizar el endpoint /api/descargar-pdf:
    // Garantiza entrega con cabecera Content-Disposition: attachment y conversión local al vuelo
    const esServidorLocal = typeof window !== 'undefined' && 
      window.location && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (esServidorLocal) {
      const codEnc = encodeURIComponent(doc.codigo || '');
      const urlEnc = encodeURIComponent(urlOriginal);
      const titEnc = encodeURIComponent(doc.titulo || '');
      const esReg = Boolean(doc.esRegistro || (doc.codigo && /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/i.test(doc.codigo)));
      return `/api/descargar-pdf?codigo=${codEnc}&url=${urlEnc}&titulo=${titEnc}&esRegistro=${esReg}`;
    }

    // Transformación nativa para SharePoint Online en entorno web / GitHub Pages:
    // Utilizar la API REST v2.0 oficial de SharePoint Online que convierte el Word a PDF al vuelo
    const libMarker = limpia.includes('/Documentos compartidos/') ? '/Documentos compartidos/' : (limpia.includes('/Shared Documents/') ? '/Shared Documents/' : null);
    if (libMarker) {
      try {
        const idx = limpia.indexOf(libMarker);
        const siteBase = limpia.substring(0, idx); // Ej: https://unionsaludvida.sharepoint.com/sites/INTRANET
        const subpath = limpia.substring(idx + libMarker.length);
        const subpathEncoded = encodeURI(decodeURI(subpath));

        // Endpoint REST v2.0 oficial de SharePoint Online que entrega el PDF convertido al vuelo
        return `${siteBase}/_api/v2.0/drive/root:/${subpathEncoded}:/content?format=pdf`;
      } catch (e) {
        console.warn('[sharepointService] Error construyendo URL REST v2.0 PDF:', e);
      }
    }

    let urlDirecta = urlOriginal;
    if (urlDirecta.includes('sharepoint.com') && !urlDirecta.includes('download=1')) {
      const sep = urlDirecta.includes('?') ? '&' : '?';
      urlDirecta = `${urlDirecta}${sep}download=1`;
    }
    return urlDirecta;
  }

  /**
   * Muestra notificaciones toast institucionales integradas con AppController o de forma autónoma
   */
  notificar(mensaje, tipo = 'info') {
    if (typeof window === 'undefined') return;

    if (window.__agyApp && typeof window.__agyApp.mostrarToast === 'function') {
      window.__agyApp.mostrarToast(mensaje, tipo);
      return;
    }
    if (window.antigravityApp && typeof window.antigravityApp.mostrarToast === 'function') {
      window.antigravityApp.mostrarToast(mensaje, tipo);
      return;
    }

    try {
      let toast = document.createElement('div');
      toast.className = `app-toast toast-${tipo}`;
      toast.textContent = mensaje;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('visible'), 50);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
      }, 4500);
    } catch (e) {}
  }

  /**
   * Genera la descarga local directa del documento en formato PDF en el disco del usuario,
   * sin abrir páginas en blanco ni visores en el navegador.
   */
  async descargarDocumentoComoPdf(doc) {
    if (!doc) return false;

    const urlPdf = this.obtenerUrlDescargaPdf(doc);
    if (!urlPdf || urlPdf === '#' || urlPdf === '') {
      alert(`El documento ${doc.codigo || ''} no tiene enlace de descarga disponible en el repositorio.`);
      return false;
    }

    const codigo = (doc.codigo || 'DOC').trim();
    const titulo = (doc.titulo || 'documento').trim();
    const nombreArchivo = `${codigo} ${titulo}.pdf`.replace(/[/\\?%*:|"<>]/g, '_');

    // Detectar si la aplicación se está ejecutando en el servidor local (server.py) o en la nube (GitHub Pages / Web)
    const esServidorLocal = typeof window !== 'undefined' && 
      window.location && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (esServidorLocal) {
      // 1. Servidor Local (Python server.py con Word COM): Descarga binaria directa al disco
      this.notificar(`⏳ Descargando ${codigo} en formato PDF...`, 'info');
      try {
        const resp = await fetch(urlPdf, {
          method: 'GET',
          cache: 'no-cache'
        });

        if (resp && resp.ok) {
          const contentType = (resp.headers.get('content-type') || '').toLowerCase();
          if (!contentType.includes('text/html')) {
            const blob = await resp.blob();
            if (blob && blob.size > 0) {
              const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
              const blobUrl = URL.createObjectURL(pdfBlob);
              const enlace = document.createElement('a');
              enlace.href = blobUrl;
              enlace.download = nombreArchivo;
              enlace.style.display = 'none';
              document.body.appendChild(enlace);
              enlace.click();

              setTimeout(() => {
                try {
                  document.body.removeChild(enlace);
                  URL.revokeObjectURL(blobUrl);
                } catch (eLimpieza) {}
              }, 3500);

              this.notificar(`✅ Descarga completada: ${nombreArchivo}`, 'success');
              return true;
            }
          }
        }
      } catch (errLocal) {
        console.warn('[sharepointService] Descarga local en memoria falló, abriendo en nueva pestaña:', errLocal);
      }
    }

    // 2. Entorno Producción / Web (GitHub Pages / Online):
    // Descarga y conversión oficial directa a PDF utilizando la API de SharePoint Online
    this.notificar(`📄 Descargando ${codigo} en formato PDF...`, 'info');
    let urlDestino = urlPdf;

    // Apertura directa para descarga en el navegador del usuario
    window.open(urlDestino, '_blank', 'noopener,noreferrer');
    return true;
  }

  /**
   * Descarga de documento institucional cumpliendo la política de Calidad:
   * - FMT (Word/Excel): Descarga nativa editable original.
   * - Excel general: Descarga nativa original (Excel nunca a PDF).
   * - Word no-FMT: Descarga obligatoria en formato PDF directamente al disco local.
   * - Modo Edición: La descarga entrega igualmente el PDF para Word no-FMT;
   *   la edición del archivo Word original se realiza exclusivamente con '✏️ SharePoint'.
   */
  async descargarDocumento(doc, esModoEdicion = false) {
    if (doc.descargable === false && !esModoEdicion) {
      alert(`El documento ${doc.codigo} tiene restringida la descarga directa.\n\nPara acceder y modificar este archivo original, active el Modo Edición con su contraseña de ingreso.`);
      return false;
    }

    const estrategia = determinarEstrategiaDescarga(doc);

    // REGLA INSTITUCIONAL: Todos los documentos de Word no-FMT se descargan estrictamente en PDF directo al disco
    if (estrategia.esPdf) {
      return await this.descargarDocumentoComoPdf(doc);
    }

    // Documentos con prefijo FMT (Word o Excel) y hojas de cálculo: Descarga nativa editable original
    let url = doc.downloadUrl || doc.sharepointUrl;
    if (url && url !== '#' && url !== '') {
      if (url.includes('sharepoint.com') && !url.includes('download=1')) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}download=1`;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } else {
      alert(`El documento ${doc.codigo} no tiene enlace de descarga disponible en el repositorio.`);
      return false;
    }
  }

  abrirEnSoloLectura(doc) {
    const url = doc.sharepointUrl || doc.downloadUrl;
    if (url && url !== '#' && url !== '') {
      const urlSoloLectura = this.obtenerUrlSoloLectura(url);
      window.open(urlSoloLectura, '_blank', 'noopener,noreferrer');
    } else {
      alert(`El documento ${doc.codigo} no tiene enlace de visualización disponible.`);
    }
  }

  abrirEnEdicion(doc) {
    const url = doc.sharepointUrl || doc.downloadUrl;
    if (url && url !== '#' && url !== '') {
      const urlEdicion = this.obtenerUrlEdicion(url);
      window.open(urlEdicion, '_blank', 'noopener,noreferrer');
    } else {
      alert(`El documento ${doc.codigo} no tiene enlace de edición configurado.`);
    }
  }


  abrirEnSharePoint(doc) {
    this.abrirEnEdicion(doc);
  }

  construirRutaRedInstitucional(doc) {
    if (!doc) {
      return 'DOCUMENTOS_INSTITUCIONALES/SISTEMAS_INFORMACION/GESTION DOCUMENTAL DE CALIDAD UT/Gestión documental de calidad Unión para la Salud Y la Vida SAS';
    }

    // 1. Si ya existe un vínculo directo oficial con SharePoint, extraer la ruta real exacta
    const url = (doc.sharepointUrl || doc.downloadUrl || '').trim();
    if (url && url.includes('/Documentos compartidos/')) {
      try {
        const decoded = decodeURIComponent(url.split('?')[0]);
        const idx = decoded.indexOf('/Documentos compartidos/');
        if (idx !== -1) {
          const fullRel = decoded.substring(idx + '/Documentos compartidos/'.length);
          const lastSlash = fullRel.lastIndexOf('/');
          if (lastSlash > 0) {
            return fullRel.substring(0, lastSlash);
          }
        }
      } catch (e) {
        console.warn('[sharepointService] Error extrayendo ruta de URL:', e);
      }
    }

    // 2. Mapeo normalizado de subcarpetas por Tipo de Documento
    const mapeoSubcarpetas = {
      'formato': 'Formatos',
      'manual': 'Manuales',
      'procedimiento': 'Procedimientos',
      'guia': 'Guías',
      'guía': 'Guías',
      'instructivo': 'Instructivos',
      'documento anexo': 'Documentos de Apoyo',
      'documento apoyo': 'Documentos de Apoyo',
      'politica': 'Políticas',
      'política': 'Políticas',
      'caracterizacion': 'Caracterizaciones',
      'caracterización': 'Caracterizaciones',
      'reglamento': 'Reglamentos',
      'protocolo': 'Protocolos'
    };

    const tipoDocNorm = (doc.tipoDocumento || '').trim().toLowerCase();
    const subcarpetaTipo = mapeoSubcarpetas[tipoDocNorm] || (doc.tipoDocumento ? `${doc.tipoDocumento}s` : 'Formatos');

    // 3. Normalizar Área y Proceso institucional
    let tipoProceso = doc.tipoProceso && doc.tipoProceso !== 'N/A' ? doc.tipoProceso.trim() : '';
    let area = doc.area && doc.area !== 'N/A' ? doc.area.trim() : 'Gestión Integral Calidad';
    let proceso = doc.proceso && doc.proceso !== 'N/A' ? doc.proceso.trim() : (doc.carpeta && doc.carpeta !== 'N/A' ? doc.carpeta.trim() : '');

    // Corregir siglas conocidas como "PC de GIC"
    if (proceso.toUpperCase() === 'PC DE GIC' || proceso.toUpperCase() === 'PC DE GTH' || !proceso) {
      proceso = area;
    }

    if (area === 'Gestión Integral Calidad' && !tipoProceso) {
      tipoProceso = 'Calidad';
    } else if (!tipoProceso) {
      tipoProceso = 'Misional';
    }

    // Mapeo refinado de áreas a su carpeta oficial en SharePoint
    if (area === 'Gestión Integral Calidad') {
      area = 'Gestión Integral de la calidad';
      if (!proceso || proceso === 'Gestión Integral Calidad') proceso = 'Gestión Integral de Calidad';
    } else if (area === 'Gestión Médica') {
      area = 'Gestión Médica y Asistencial';
    }

    // Raíz institucional oficial del repositorio documental
    const root = 'DOCUMENTOS_INSTITUCIONALES/SISTEMAS_INFORMACION/GESTION DOCUMENTAL DE CALIDAD UT/Gestión documental de calidad Unión para la Salud Y la Vida SAS';

    const partes = [root, tipoProceso, area];
    if (proceso && proceso.toLowerCase() !== area.toLowerCase()) {
      partes.push(proceso);
    }
    partes.push(subcarpetaTipo);

    return partes.join('/');
  }

  obtenerUrlCarpetaUbicacion(doc) {
    if (!doc) return null;

    const esDerivado = Boolean(
      doc.esRegistro === true ||
      doc.documentoPadreCodigo ||
      (doc.id && String(doc.id).includes('_REG_')) ||
      (doc.codigo && /^[A-Z]{3,4}-[A-Z]{2,4}-\d{3,4}-\d+$/i.test(doc.codigo))
    );

    // REGLA DE NEGOCIO: Los documentos derivados se encuentran dentro de una subcarpeta
    // que depende exclusivamente de la ruta del documento base y cuyo nombre es similar al documento padre.
    if (esDerivado) {
      if (doc.subcarpetaUrl && doc.subcarpetaUrl.startsWith('http')) {
        return doc.subcarpetaUrl;
      }
      const docPadre = this.obtenerDocumentoPadre(doc);
      if (docPadre) {
        const enlaces = this.generarEnlacesDocumentoSecundario(docPadre, doc);
        if (enlaces && enlaces.subcarpeta) {
          return enlaces.subcarpeta;
        }
      }
    }

    const url = (doc.sharepointUrl || doc.downloadUrl || '').trim();
    if (url && url.startsWith('http') && (url.includes('/Documentos compartidos/') || url.includes('/Shared Documents/'))) {
      try {
        const urlLimpia = url.split('?')[0];
        const ultimaBarra = urlLimpia.lastIndexOf('/');
        if (ultimaBarra > 0) {
          return urlLimpia.substring(0, ultimaBarra);
        }
      } catch (e) {
        console.warn('[sharepointService] Error obteniendo URL de carpeta:', e);
      }
      return url;
    }
    return null;
  }

  abrirCarpetaUbicacion(doc) {
    if (!doc) return;
    const urlCarpeta = this.obtenerUrlCarpetaUbicacion(doc);
    if (urlCarpeta && urlCarpeta.startsWith('http')) {
      window.open(urlCarpeta, '_blank');
    } else {
      alert(`El documento ${doc.codigo || ''} no tiene una ruta configurada en el repositorio de SharePoint.`);
    }
  }

  abrirCarpetaSharePoint(doc) {
    this.abrirCarpetaUbicacion(doc);
  }

  obtenerRutaLegible(doc) {
    if (!doc) return 'No se encuentra disponible';
    const url = (doc.sharepointUrl || doc.downloadUrl || this.obtenerUrlCarpetaUbicacion(doc) || '').trim();
    if (url && url.startsWith('http') && (url.includes('/Documentos compartidos/') || url.includes('/Shared Documents/'))) {
      try {
        const decoded = decodeURIComponent(url.split('?')[0]);
        const marker = decoded.includes('/Documentos compartidos/') ? '/Documentos compartidos/' : '/Shared Documents/';
        const idx = decoded.indexOf(marker);
        if (idx !== -1) {
          const fullRel = decoded.substring(idx + marker.length);
          const lastSlash = fullRel.lastIndexOf('/');
          if (/\.(docx|pdf|xlsx|doc|xls|csv)$/i.test(fullRel) && lastSlash > 0) {
            return fullRel.substring(0, lastSlash);
          }
          return fullRel;
        }
      } catch (e) {
        console.warn('[sharepointService] Error extrayendo ruta de URL:', e);
      }
    }
    // POLÍTICA INSTITUCIONAL ESTRICTA:
    // Si el documento no posee enlace directo en el REPOSITORIO_DOCUMENTAL.csv publicado en SharePoint,
    // NO se calcula ninguna ruta artificial ni teórica; se informa estrictamente que no se encuentra disponible.
    return 'No se encuentra disponible';
  }

  incorporarDocumentosCreados(listaDocs, onedriveMap = null) {
    if (!Array.isArray(listaDocs)) return [];
    const mapOD = onedriveMap || this._ultimoOnedriveMap || null;

    // 1. Enriquecer los documentos que ya están en listaDocs con datos de OneDrive si tienen URLs disponibles
    const docsEnriquecidos = listaDocs.map((doc) => {
      const codUpper = (doc.codigo || '').trim().toUpperCase();
      const od = mapOD?.get(codUpper);
      if (od) {
        const tieneEnlaceOD = Boolean(
          (od.downloadUrl && od.downloadUrl.trim() !== '' && od.downloadUrl !== '#' && od.downloadUrl !== 'N/A') ||
          (od.sharepointUrl && od.sharepointUrl.trim() !== '' && od.sharepointUrl !== '#' && od.sharepointUrl !== 'N/A')
        );
        if (tieneEnlaceOD) {
          const spUrl = od.sharepointUrl || doc.sharepointUrl || '';
          const dlUrl = od.downloadUrl || doc.downloadUrl || spUrl;
          return {
            ...doc,
            sharepointUrl: spUrl,
            downloadUrl: dlUrl,
            modificacion: od.modificacion && od.modificacion !== 'N/A' ? od.modificacion : doc.modificacion,
            disponible: true,
            estado: 'DISPONIBLE'
          };
        }
      }
      return doc;
    });

    const codigosExistentes = new Set(docsEnriquecidos.map((d) => (d.codigo || '').trim().toUpperCase()));

    let creadosConf = {};
    try {
      const rawConf = localStorage.getItem('agy_sgc_conf_cache');
      if (rawConf) {
        const confObj = JSON.parse(rawConf);
        if (confObj && confObj.documentosCreados) {
          creadosConf = confObj.documentosCreados;
        }
      }
    } catch {}

    let creadosLocal = {};
    try {
      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawLocal) creadosLocal = JSON.parse(rawLocal);
    } catch {}

    const todosCreados = { ...creadosConf, ...creadosLocal };
    const nuevosParaAgregar = [];
    Object.entries(todosCreados).forEach(([cod, docObj]) => {
      if (!docObj) return;
      const codRaw = (docObj.codigo || cod || '').trim().toUpperCase();
      if (
        !codRaw ||
        codRaw.includes('HIST_') ||
        codRaw.startsWith('_LISTA_') ||
        codRaw.includes('::') ||
        !/^[A-Z]{2,4}-[A-Z]{2,4}-\d{3,4}/.test(codRaw)
      ) {
        return;
      }

      // Sanitizar título institucional
      if (docObj.titulo) {
        docObj.titulo = docObj.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
      }

      // Si es un Registro Derivado, asociarlo a su Documento Base padre
      const mSecCod = codRaw.match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
      if (docObj.subclase === 'Registro' || docObj.esRegistro === true || cod.startsWith('REG_') || cod.includes('::') || docObj.codigoPadre || mSecCod) {
        const codUpper = codRaw;
        const codPadre = (docObj.documentoPadreCodigo || docObj.codigoPadre || (mSecCod ? mSecCod[1] : (docObj.codigo ? docObj.codigo.replace(/-(\d+)$/, '') : '')) || cod.replace(/^REG_/, '').replace(/-(\d+)$/, '').split('::')[0]).trim().toUpperCase();
        const base = docsEnriquecidos.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro) ||
                     nuevosParaAgregar.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro);
        if (base) {
          base.registrosDerivados = base.registrosDerivados || [];
          const esExcel = base.formato === 'Excel' || base.extension === 'XLS' || (docObj.extension && docObj.extension.toUpperCase().includes('XLS'));
          const formatoSec = esExcel ? 'Excel' : 'PDF';
          const extSec = esExcel ? 'XLS' : 'PDF';
          let regSpUrl = docObj.sharepointUrl || '';
          let regDlUrl = docObj.downloadUrl || regSpUrl;
          if (regSpUrl === base.sharepointUrl || regDlUrl === base.downloadUrl) {
            regSpUrl = '';
            regDlUrl = '';
          }
          let spUrlFinal = regSpUrl;
          let dlUrlFinal = regDlUrl;
          if (!spUrlFinal && !dlUrlFinal && mapOD) {
            const odDirecto = this.buscarEnOneDriveMap(mapOD, codUpper, docObj.titulo);
            if (odDirecto) {
              dlUrlFinal = odDirecto.downloadUrl;
              spUrlFinal = odDirecto.sharepointUrl;
            }
          }
          const docCorregido = {
            ...docObj,
            id: docObj.id || `${codUpper}_REG_${Date.now()}`,
            codigo: codUpper,
            titulo: (docObj.titulo || codUpper).replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim(),
            subclase: 'Registro',
            esRegistro: true,
            documentoPadreCodigo: codPadre,
            area: base.area,
            areaNombre: base.areaNombre || base.area,
            proceso: base.proceso,
            carpeta: base.carpeta || base.proceso,
            tipoProceso: base.tipoProceso,
            formato: formatoSec,
            extension: extSec,
            sharepointUrl: spUrlFinal,
            downloadUrl: dlUrlFinal,
            disponible: Boolean(dlUrlFinal || spUrlFinal),
            estado: (dlUrlFinal || spUrlFinal) ? 'DISPONIBLE' : 'NO DISPONIBLE'
          };


          const coincideReg = (r) => {
            if (docObj.id && r.id === docObj.id) return true;
            if (r.codigo && docCorregido.codigo && r.codigo.toUpperCase() === docCorregido.codigo.toUpperCase()) return true;
            const m1 = (r.codigo || '').match(/-(\d+)$/);
            const m2 = (docCorregido.codigo || '').match(/-(\d+)$/);
            if (m1 && m2 && m1[1] !== m2[1]) return false;
            if (r.titulo && docObj.titulo && r.titulo.toLowerCase().trim() === docObj.titulo.toLowerCase().trim()) return true;
            const nR = (r.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            const nObj = (docObj.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return !m1 && !m2 && (nR === nObj || (nR.length > 5 && nObj.length > 5 && (nR.includes(nObj) || nObj.includes(nR))));
          };

          const idxReg = base.registrosDerivados.findIndex(coincideReg);
          if (idxReg >= 0) {
            base.registrosDerivados[idxReg] = { ...base.registrosDerivados[idxReg], ...docCorregido };
          } else {
            base.registrosDerivados.push(docCorregido);
          }

          // Deduplicar registros derivados inteligentemente
          base.registrosDerivados = this._deduplicarRegistros(base.registrosDerivados);
        }
        return;
      }

      const codUpper = codRaw;
      if (!codigosExistentes.has(codUpper) && docObj) {
        const od = mapOD?.get(codUpper);
        const spUrl = od?.sharepointUrl || docObj.sharepointUrl || '';
        const dlUrl = od?.downloadUrl || docObj.downloadUrl || spUrl;
        const tieneEnlaceActivo = Boolean(
          (dlUrl && dlUrl.trim() !== '' && dlUrl !== '#' && dlUrl !== 'N/A') ||
          (spUrl && spUrl.trim() !== '' && spUrl !== '#' && spUrl !== 'N/A')
        );
        const estaDisponible = (docObj.disponible !== false && tieneEnlaceActivo) || Boolean(od && tieneEnlaceActivo);

        const areaNormalizadaOficial = normalizarAreaDoc(od?.area || docObj.area || docObj.areaNombre || 'Gestión Integral Calidad', codUpper);
        const titLower = (docObj.titulo || docObj.nombre || od?.titulo || '').toLowerCase();
        const esExcelCreated = (od?.formato === 'Excel') || (docObj.formato === 'Excel') || (od?.extension && od.extension.toUpperCase().includes('XLS')) || (docObj.extension && docObj.extension.toUpperCase().includes('XLS')) || titLower.endsWith('.xlsx') || titLower.endsWith('.xls') || titLower.includes('excel');

        nuevosParaAgregar.push({
          id: codUpper,
          codigo: codUpper,
          titulo: (docObj.titulo || docObj.nombre || od?.titulo || 'Documento Institucional').replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim(),
          version: docObj.version || '01',
          estado: estaDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
          area: areaNormalizadaOficial,
          areaNombre: areaNormalizadaOficial,
          tipoProceso: od?.tipoProceso || docObj.tipoProceso || 'Estratégicos',
          proceso: od?.proceso || docObj.proceso || 'Gestión Integral de Calidad',
          carpeta: od?.carpeta || docObj.carpeta || 'N/A',
          tipoDocumento: od?.tipoDocumento || docObj.tipoDocumento || 'Instructivo',
          formato: esExcelCreated ? 'Excel' : (od?.formato || docObj.formato || 'Word'),
          extension: esExcelCreated ? 'XLS' : (od?.extension || docObj.extension || 'DOC'),
          tiempoVigencia: docObj.tiempoVigencia || '5 Años',
          descargable: docObj.descargable !== false,
          disponible: estaDisponible,
          permisoDirectivo: docObj.permisoDirectivo !== false,
          permisoAdministrativo: docObj.permisoAdministrativo !== false,
          permisoOperativo: docObj.permisoOperativo !== false,
          sharepointUrl: spUrl,
          downloadUrl: dlUrl,
          modificacion: od?.modificacion || docObj.modificacion || new Date().toISOString().replace('T', ' ').substring(0, 19)
        });
      }
    });

    return [...nuevosParaAgregar, ...docsEnriquecidos];
  }

  /**
   * Crea un nuevo documento en la biblioteca de Google Sheets y en memoria
   */
  async crearDocumento(nuevoDoc) {
    if (!nuevoDoc || !nuevoDoc.codigo) {
      return { exito: false, error: 'El código del documento es obligatorio.' };
    }

    const codUpper = (nuevoDoc.codigo || '').trim().toUpperCase();
    const esRegistro = Boolean(nuevoDoc.esRegistro || nuevoDoc.subclase === 'Registro');
    const mCodSec = codUpper.match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
    const codPadre = (nuevoDoc.documentoPadreCodigo || nuevoDoc.codigoPadre || (mCodSec ? mCodSec[1] : codUpper)).trim().toUpperCase();

    let spUrl = nuevoDoc.sharepointUrl || '';
    let dlUrl = nuevoDoc.downloadUrl || spUrl;

    const docPadre = esRegistro 
      ? this.documentosEnMemoria.find((d) => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro)
      : null;

    if (esRegistro && docPadre) {
      const enlacesAuto = this.generarEnlacesDocumentoSecundario(docPadre, {
        codigo: codUpper,
        titulo: nuevoDoc.titulo || nuevoDoc.nombre,
        extension: nuevoDoc.extension || docPadre.extension
      });
      spUrl = enlacesAuto.sharepointUrl;
      dlUrl = enlacesAuto.downloadUrl || spUrl;
    }

    const tieneEnlaceActivo = Boolean(
      (dlUrl && dlUrl.trim() !== '' && dlUrl !== '#' && dlUrl !== 'N/A') ||
      (spUrl && spUrl.trim() !== '' && spUrl !== '#' && spUrl !== 'N/A')
    );
    const estaDisponible = (nuevoDoc.disponible !== false) && tieneEnlaceActivo;

    const titDocLower = (nuevoDoc.titulo || nuevoDoc.nombre || '').toLowerCase().trim();
    const esExcelDoc = (
      nuevoDoc.formato === 'Excel' || 
      docPadre?.formato === 'Excel' || 
      (nuevoDoc.extension && nuevoDoc.extension.toUpperCase().includes('XLS')) ||
      titDocLower.endsWith('.xlsx') ||
      titDocLower.endsWith('.xls') ||
      titDocLower.includes('excel')
    );
    const formatoEfectivo = esRegistro 
      ? (esExcelDoc ? 'Excel' : 'PDF')
      : (esExcelDoc ? 'Excel' : (nuevoDoc.formato || docPadre?.formato || (esDocumentoFMT(codUpper) ? 'Word' : 'PDF')));
    const extensionEfectiva = esRegistro
      ? (esExcelDoc ? 'XLS' : 'PDF')
      : (esExcelDoc ? 'XLS' : (nuevoDoc.extension || docPadre?.extension || (formatoEfectivo === 'Excel' ? 'XLS' : (formatoEfectivo === 'Word' ? 'DOC' : 'PDF'))));

    const areaNormalizada = normalizarAreaDoc(nuevoDoc.area || nuevoDoc.areaNombre || docPadre?.area || '', codUpper);

    const docNormalizado = {
      id: esRegistro ? `${codUpper}_REG_${Date.now()}` : codUpper,
      codigo: codUpper,
      titulo: nuevoDoc.titulo || nuevoDoc.nombre || 'Nuevo Documento',
      version: nuevoDoc.version || '01',
      estado: estaDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
      area: areaNormalizada,
      areaNombre: areaNormalizada,
      areaSigla: nuevoDoc.areaSigla || '',
      tipoProceso: nuevoDoc.tipoProceso || docPadre?.tipoProceso || 'Estratégicos',
      proceso: nuevoDoc.proceso || docPadre?.proceso || 'Gestión Integral de Calidad',
      carpeta: nuevoDoc.carpeta || docPadre?.carpeta || 'N/A',
      tipoDocumento: nuevoDoc.tipoDocumento || (esRegistro ? 'Registro' : 'Instructivo'),
      subclase: esRegistro ? 'Registro' : 'Base',
      esRegistro: esRegistro,
      documentoPadreCodigo: esRegistro ? codPadre : null,
      registrosDerivados: [],
      formato: formatoEfectivo,
      extension: extensionEfectiva,
      tiempoVigencia: nuevoDoc.tiempoVigencia || '5 Años',
      descargable: nuevoDoc.descargable !== false,
      disponible: estaDisponible,
      permisoDirectivo: nuevoDoc.permisoDirectivo !== false,
      permisoAdministrativo: nuevoDoc.permisoAdministrativo !== false,
      permisoOperativo: nuevoDoc.permisoOperativo !== false,
      sharepointUrl: spUrl,
      downloadUrl: dlUrl,
      modificacion: nuevoDoc.modificacion || new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    // 1. Guardar permanentemente en localStorage y cache de configuración
    try {
      let creadosLocal = {};
      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawLocal) creadosLocal = JSON.parse(rawLocal);
      const storageKey = esRegistro ? codUpper : codUpper;
      creadosLocal[storageKey] = docNormalizado;
      localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creadosLocal));

      const rawConf = localStorage.getItem('agy_sgc_conf_cache');
      if (rawConf) {
        const confObj = JSON.parse(rawConf);
        confObj.documentosCreados = confObj.documentosCreados || {};
        confObj.documentosCreados[storageKey] = docNormalizado;
        localStorage.setItem('agy_sgc_conf_cache', JSON.stringify(confObj));
      }
    } catch {}

    const payload = {
      accion: 'crear_documento',
      documento: docNormalizado
    };

    // 2. Persistencia en la nube: Google Sheets ("Biblioteca") es la fuente única de verdad (SSOT)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    let guardadoEnNube = false;

    // A. Si existe proxy local activo (/api/documento), intentar primero
    try {
      const resLocal = await fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (resLocal.ok) {
        const jsonLocal = await resLocal.json();
        if (jsonLocal && jsonLocal.status === 'ok') {
          guardadoEnNube = true;
        }
      }
    } catch (eLocal) {}

    // B. Enviar DIRECTAMENTE a Google Apps Script (Google Sheets) para asegurar persistencia en la nube
    if (!guardadoEnNube) {
      try {
        const resGAS = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
        });
        if (resGAS.ok) {
          guardadoEnNube = true;
        }
      } catch (errGAS) {
        // En navegadores con restricción de redirección CORS, mode: 'no-cors' garantiza entrega al endpoint
        try {
          await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          guardadoEnNube = true;
        } catch (errNoCors) {
          console.error('[sharepointService] Error enviando documento a Google Sheets:', errNoCors);
        }
      }
    }

    // C. Si no se pudo confirmar la escritura cloud (modo offline), encolar en Outbox para reintento automático
    if (!guardadoEnNube && cacheService && cacheService.encolarMutacion) {
      await cacheService.encolarMutacion(payload);
      console.log('[sharepointService] 📦 Documento encolado en Outbox para sincronización automática al reconectar.');
    }

    // 3. Actualizar catálogo en memoria
    if (esRegistro) {
      const docBase = this.documentosEnMemoria.find((d) => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro);
      if (docBase) {
        docBase.registrosDerivados = docBase.registrosDerivados || [];
        const idxReg = docBase.registrosDerivados.findIndex(r => {
          if (docNormalizado.id && r.id === docNormalizado.id) return true;
          if (r.codigo && codUpper && r.codigo.toUpperCase() === codUpper) return true;
          const m1 = (r.codigo || '').match(/-(\d+)$/);
          const m2 = codUpper.match(/-(\d+)$/);
          if (m1 && m2 && m1[1] !== m2[1]) return false;
          return r.titulo && docNormalizado.titulo && r.titulo.toLowerCase().trim() === docNormalizado.titulo.toLowerCase().trim();
        });
        if (idxReg >= 0) {
          docBase.registrosDerivados[idxReg] = { ...docBase.registrosDerivados[idxReg], ...docNormalizado };
        } else {
          docBase.registrosDerivados.push(docNormalizado);
        }
        docBase.registrosDerivados = this._deduplicarRegistros(docBase.registrosDerivados);
      }
    } else {
      const idxExistente = this.documentosEnMemoria.findIndex((d) => (d.codigo || '').toUpperCase() === codUpper && !d.esRegistro);
      if (idxExistente >= 0) {
        this.documentosEnMemoria[idxExistente] = { ...this.documentosEnMemoria[idxExistente], ...docNormalizado };
      } else {
        this.documentosEnMemoria.unshift(docNormalizado);
      }
    }

    // Persistir catálogo en caché IndexedDB inmediatamente (Optimistic Cache Update)
    if (cacheService && cacheService.guardarDocumentos) {
      await cacheService.guardarDocumentos(this.documentosEnMemoria);
      if (cacheService.guardarColeccion) {
        await cacheService.guardarColeccion('documentos_catalogo', { total: this.documentosEnMemoria.length, timestamp: Date.now() });
      }
    }

    return { exito: true, documento: docNormalizado };
  }

  /**
   * Deduplica inteligentemente registros derivados basándose en similitud de títulos
   * y remueve repeticiones o versiones duplicadas/antiguas.
   */
  _deduplicarRegistros(registros) {
    if (!Array.isArray(registros)) return [];
    const normalizar = (txt) => String(txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    let resultado = [];

    for (let reg of registros) {
      if (!reg || !reg.titulo) continue;

      // Limpiar extensión de archivo si viniera en el título
      reg.titulo = reg.titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();

      // Corregir posibles repeticiones de título introducidas por duplicación
      if (reg.titulo && /Criterios de FormaciCriterios de Formacion/i.test(reg.titulo)) {
        reg.titulo = reg.titulo.replace(/Criterios de FormaciCriterios de Formacion/i, 'Criterios de Formación');
      }

      // Desvincular archivos heredados accidentalmente del formato base
      const codPadre = (reg.documentoPadreCodigo || reg.codigoPadre || (reg.codigo ? reg.codigo.replace(/-(\d+)$/, '') : '')).toUpperCase();
      const docPadre = this.documentosEnMemoria?.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro);
      if (docPadre) {
        if (reg.downloadUrl === docPadre.downloadUrl || reg.sharepointUrl === docPadre.sharepointUrl) {
          reg.downloadUrl = '';
          reg.sharepointUrl = '';
          reg.disponible = false;
          reg.estado = 'NO DISPONIBLE';
        }
      }

      // Vincular directamente desde el mapa de OneDrive si faltan enlaces, o resolver via padre
      if (!reg.downloadUrl || !reg.sharepointUrl) {
        const odExacto = this.buscarEnOneDriveMap(this._ultimoOnedriveMap, reg.codigo, reg.titulo, true);
        if (odExacto) {
          reg.downloadUrl = odExacto.downloadUrl || odExacto.urlDescarga || '';
          reg.sharepointUrl = odExacto.sharepointUrl || odExacto.urlEdicion || '';
          reg.disponible = Boolean(reg.downloadUrl || reg.sharepointUrl);
          reg.estado = reg.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
        } else if (docPadre && (docPadre.downloadUrl || docPadre.sharepointUrl)) {
          const enlacesAuto = this.generarEnlacesDocumentoSecundario(docPadre, reg);
          if (enlacesAuto) {
            reg.downloadUrl = enlacesAuto.downloadUrl;
            reg.sharepointUrl = enlacesAuto.sharepointUrl;
            reg.disponible = Boolean(reg.downloadUrl || reg.sharepointUrl);
            reg.estado = reg.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';
          }
        }
      }

      // Asegurar que todo registro secundario (Word) se descargue y etiquete como PDF
      const esExcelReg = reg.formato === 'Excel' || reg.extension === 'XLS' || (reg.downloadUrl && (reg.downloadUrl.endsWith('.xlsx') || reg.downloadUrl.endsWith('.xls')));
      reg.esRegistro = true;
      reg.subclase = 'Registro';
      reg.id = reg.id || `${reg.codigo || 'REG'}_REG`;
      if (!esExcelReg) {
        reg.formato = 'PDF';
        reg.extension = 'PDF';
      }

      const nReg = normalizar(reg.titulo);
      if (!nReg) continue;

      const idxExistente = resultado.findIndex(existente => {
        if (reg.codigo && existente.codigo && reg.codigo === existente.codigo && reg.codigo.includes('-')) return true;
        if (reg.id && existente.id && reg.id === existente.id) return true;

        // Si ambos registros tienen códigos distintos con sufijo numérico -N (ej: -4 vs -5), NUNCA son duplicados
        const mReg = (reg.codigo || '').match(/-(\d+)$/);
        const mExt = (existente.codigo || '').match(/-(\d+)$/);
        if (mReg && mExt && mReg[1] !== mExt[1]) return false;

        const nExistente = normalizar(existente.titulo);
        if (nExistente === nReg) return true;
        if (nReg.length >= 8 && nExistente.length >= 8) {
          if (!mReg && !mExt && (nReg.includes(nExistente) || nExistente.includes(nReg))) return true;
        }
        return false;
      });

      if (idxExistente >= 0) {
        const existente = resultado[idxExistente];
        const tieneRepeticion = (t) => /([a-z]{5,})\1/i.test(t) || /(criterios).*\1/i.test(t);
        const preferirNuevo = tieneRepeticion(existente.titulo) && !tieneRepeticion(reg.titulo);
        const fechaExistente = new Date(existente.modificacion || 0).getTime();
        const fechaReg = new Date(reg.modificacion || 0).getTime();

        if (preferirNuevo || (!tieneRepeticion(reg.titulo) && (fechaReg >= fechaExistente || reg.titulo.length <= existente.titulo.length))) {
          resultado[idxExistente] = { ...existente, ...reg, id: existente.id || reg.id || `${reg.codigo || existente.codigo || 'REG'}_REG` };
        }
        if (resultado[idxExistente].titulo) {
          resultado[idxExistente].titulo = resultado[idxExistente].titulo.replace(/\.(docx|pdf|xlsx|doc|xls|csv)$/i, '').trim();
        }
      } else {
        resultado.push(reg);
      }
    }

    // Ordenar registros derivados numéricamente por su sufijo
    resultado.sort((a, b) => {
      const mA = (a.codigo || '').match(/-(\d+)$/);
      const mB = (b.codigo || '').match(/-(\d+)$/);
      if (mA && mB) {
        return parseInt(mA[1], 10) - parseInt(mB[1], 10);
      }
      return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
    });

    return resultado;
  }

  /**
   * Modifica metadatos de un documento existente en Google Sheets y en memoria
   */
  async modificarDocumento(codigo, nuevosDatos, id = null, esRegistro = false, tituloAnterior = null) {
    if (!codigo) return { exito: false, error: 'Código de documento requerido.' };

    const codUpper = codigo.trim().toUpperCase();
    const codPadre = (nuevosDatos.documentoPadreCodigo || nuevosDatos.codigoPadre || (codUpper ? codUpper.replace(/-(\d+)$/, '') : '') || codUpper).trim().toUpperCase();
    const docBase = this.documentosEnMemoria.find(d => (d.codigo || '').toUpperCase() === (esRegistro ? codPadre : codUpper) && !d.esRegistro);

    // Si es un registro derivado, heredar estrictamente proceso, carpeta, área y tipo de proceso de su formato padre
    if (esRegistro && docBase) {
      nuevosDatos.proceso = docBase.proceso || docBase.carpeta;
      nuevosDatos.carpeta = docBase.carpeta || docBase.proceso;
      nuevosDatos.area = docBase.area;
      nuevosDatos.areaNombre = docBase.areaNombre || docBase.area;
      nuevosDatos.tipoProceso = docBase.tipoProceso;
      nuevosDatos.extension = docBase.extension || nuevosDatos.extension || 'doc';
      nuevosDatos.documentoPadreCodigo = docBase.codigo;

      // Auto-generación de enlaces con subcarpeta en SharePoint
      const enlaces = this.generarEnlacesDocumentoSecundario(docBase, {
        codigo: nuevosDatos.codigo || codUpper,
        titulo: nuevosDatos.titulo || tituloAnterior,
        extension: nuevosDatos.extension
      });
      nuevosDatos.downloadUrl = enlaces.downloadUrl;
      nuevosDatos.sharepointUrl = enlaces.sharepointUrl;
      nuevosDatos.disponible = true;
      nuevosDatos.estado = 'DISPONIBLE';
    }

    const payload = {
      accion: 'modificar_documento',
      codigo: codUpper,
      documento: {
        ...nuevosDatos,
        codigo: codUpper,
        id: id || nuevosDatos.id,
        esRegistro: Boolean(esRegistro),
        subclase: esRegistro ? 'Registro' : (nuevosDatos.subclase || 'Base'),
        tipoDocumento: esRegistro ? 'Registro' : (nuevosDatos.tipoDocumento || 'Formato'),
        tituloAnterior: tituloAnterior || nuevosDatos.tituloAnterior
      }
    };

    let syncOk = false;
    // 1. Enviar vía endpoint proxy local
    try {
      const res = await fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.status === 'ok') syncOk = true;
      }
    } catch (e) {
      console.warn('[sharepointService] Proxy local no disponible, intentando sincronización directa:', e);
    }

    // 2. Fallback directo a Google Apps Script
    if (!syncOk) {
      try {
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        syncOk = true;
      } catch (e) {
        console.warn('[sharepointService] Fallo envío directo a Google Sheets:', e);
      }
    }

    if (!syncOk && cacheService && cacheService.encolarMutacion) {
      await cacheService.encolarMutacion(payload);
      console.log('[sharepointService] 📦 Modificación encolada en Outbox para sincronización automática al reconectar.');
    }

    // 3. Si es un registro derivado, actualizarlo ÚNICAMENTE dentro de registrosDerivados de su documento padre
    if (esRegistro || (id && String(id).includes('_REG_'))) {
      if (docBase) {
        docBase.registrosDerivados = docBase.registrosDerivados || [];
        const titAntNorm = (tituloAnterior || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const titNuevoNorm = (nuevosDatos.titulo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        let regIdx = docBase.registrosDerivados.findIndex(r => {
          if (id && r.id === id) return true;
          if (r.codigo && (nuevosDatos.codigo || codUpper) && r.codigo.toUpperCase() === (nuevosDatos.codigo || codUpper).toUpperCase()) return true;
          const rTitNorm = (r.titulo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (titAntNorm && (rTitNorm === titAntNorm || rTitNorm.includes(titAntNorm) || titAntNorm.includes(rTitNorm))) return true;
          if (titNuevoNorm && (rTitNorm === titNuevoNorm || rTitNorm.includes(titNuevoNorm) || titNuevoNorm.includes(rTitNorm))) return true;
          return false;
        });

        let regSpUrl = nuevosDatos.sharepointUrl || (regIdx >= 0 ? docBase.registrosDerivados[regIdx].sharepointUrl : '') || '';
        let regDlUrl = nuevosDatos.downloadUrl || (regIdx >= 0 ? docBase.registrosDerivados[regIdx].downloadUrl : '') || regSpUrl;
        if (regSpUrl === docBase.sharepointUrl || regDlUrl === docBase.downloadUrl) {
          regSpUrl = '';
          regDlUrl = '';
        }
        const tieneEnlaceReg = Boolean(
          (regDlUrl && regDlUrl.trim() !== '' && regDlUrl !== '#' && regDlUrl !== 'N/A') ||
          (regSpUrl && regSpUrl.trim() !== '' && regSpUrl !== '#' && regSpUrl !== 'N/A')
        );

        const registroFinal = {
          ...(regIdx >= 0 ? docBase.registrosDerivados[regIdx] : {}),
          ...nuevosDatos,
          id: id || (regIdx >= 0 ? docBase.registrosDerivados[regIdx].id : `REG_${codUpper}_${Date.now()}`),
          codigo: nuevosDatos.codigo || codUpper,
          documentoPadreCodigo: docBase.codigo,
          esRegistro: true,
          subclase: 'Registro',
          tipoDocumento: 'Registro',
          proceso: docBase.proceso || docBase.carpeta,
          carpeta: docBase.carpeta || docBase.proceso,
          area: docBase.area,
          areaNombre: docBase.areaNombre || docBase.area,
          tipoProceso: docBase.tipoProceso,
          extension: docBase.extension || nuevosDatos.extension || 'doc',
          sharepointUrl: regSpUrl,
          downloadUrl: regDlUrl,
          disponible: tieneEnlaceReg,
          estado: tieneEnlaceReg ? 'DISPONIBLE' : 'NO DISPONIBLE'
        };

        if (regIdx >= 0) {
          docBase.registrosDerivados[regIdx] = registroFinal;
        } else {
          docBase.registrosDerivados.push(registroFinal);
        }

        // Deduplicar registros en el documento padre
        docBase.registrosDerivados = this._deduplicarRegistros(docBase.registrosDerivados);

        // Actualizar en localStorage limpiando registros duplicados/obsoletos
        try {
          const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
          if (rawLocal) {
            const creadosLocal = JSON.parse(rawLocal);
            for (const k of Object.keys(creadosLocal)) {
              const v = creadosLocal[k];
              if (v && ((v.codigo === codUpper) || (v.codigo === codPadre && (v.esRegistro || String(k).startsWith('REG_'))))) {
                const vTitNorm = (v.titulo || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (vTitNorm === titAntNorm || vTitNorm === titNuevoNorm || (id && v.id === id) || k === codUpper) {
                  delete creadosLocal[k];
                }
              }
            }
            creadosLocal[registroFinal.codigo] = registroFinal;
            localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creadosLocal));
          }
        } catch (e) {}

        if (cacheService && cacheService.guardarDocumentos) {
          cacheService.guardarDocumentos(this.documentosEnMemoria);
        }

        return { exito: true, documento: registroFinal, docPadre: docBase };
      }
      return { exito: true, documento: nuevosDatos };
    }

    // 4. Modificación de Documento Base (preserva registros derivados existentes)
    const idx = this.documentosEnMemoria.findIndex(d => (d.codigo || '').toUpperCase() === codUpper && !d.esRegistro);
    if (idx >= 0) {
      const regsExistentes = this.documentosEnMemoria[idx].registrosDerivados || [];
      this.documentosEnMemoria[idx] = {
        ...this.documentosEnMemoria[idx],
        ...nuevosDatos,
        codigo: codUpper,
        registrosDerivados: nuevosDatos.registrosDerivados || regsExistentes
      };

      if (cacheService && cacheService.guardarDocumentos) {
        cacheService.guardarDocumentos(this.documentosEnMemoria);
      }

      return { exito: true, documento: this.documentosEnMemoria[idx] };
    }

    return { exito: true, documento: nuevosDatos };
  }

  /**
   * Recodifica un documento oficial: actualiza el código anterior al nuevo código
   */
  async recodificarDocumento(codigoAnterior, nuevoCodigo, nuevosDatos) {
    if (!codigoAnterior || !nuevoCodigo) return { exito: false, error: 'Código anterior y nuevo requeridos.' };

    const codAntUpper = codigoAnterior.trim().toUpperCase();
    const nuevoCodUpper = nuevoCodigo.trim().toUpperCase();

    const payload = {
      accion: 'recodificar_documento',
      codigoAnterior: codAntUpper,
      nuevoCodigo: nuevoCodUpper,
      documento: { ...nuevosDatos, codigo: nuevoCodUpper, codigoAnterior: codAntUpper }
    };

    // 1. Enviar vía proxy local / Google Apps Script (Google Sheets)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    let syncRecodOk = false;
    try {
      const resLocal = await fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
      });
      if (resLocal.ok) {
        const jsonRes = await resLocal.json();
        if (jsonRes && jsonRes.status === 'ok') syncRecodOk = true;
      }
    } catch (e) {}

    if (!syncRecodOk) {
      try {
        const resGAS = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
        });
        if (resGAS.ok) syncRecodOk = true;
      } catch (errGAS) {
        try {
          await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          syncRecodOk = true;
        } catch (e2) {}
      }
    }

    if (!syncRecodOk && cacheService && cacheService.encolarMutacion) {
      await cacheService.encolarMutacion(payload);
      console.log('[sharepointService] 📦 Recodificación encolada en Outbox para sincronización automática al reconectar.');
    }

    // 2. Actualizar permanentemente en localStorage
    try {
      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawLocal) {
        const creadosLocal = JSON.parse(rawLocal);
        if (creadosLocal[codAntUpper]) {
          const docGuardado = { ...creadosLocal[codAntUpper], ...nuevosDatos, codigo: nuevoCodUpper, codigoAnterior: codAntUpper };
          delete creadosLocal[codAntUpper];
          creadosLocal[nuevoCodUpper] = docGuardado;
          localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creadosLocal));
        }
      }
    } catch (e) {}

    // 3. Actualizar en memoria y en IndexedDB
    const idx = this.documentosEnMemoria.findIndex((d) => (d.codigo || '').toUpperCase() === codAntUpper);
    let docActualizado = { ...nuevosDatos, codigo: nuevoCodUpper, codigoAnterior: codAntUpper };
    if (idx >= 0) {
      docActualizado = {
        ...this.documentosEnMemoria[idx],
        ...nuevosDatos,
        codigo: nuevoCodUpper,
        id: nuevoCodUpper,
        codigoAnterior: codAntUpper
      };
      this.documentosEnMemoria[idx] = docActualizado;
    }

    if (cacheService && cacheService.guardarDocumentos) {
      cacheService.guardarDocumentos(this.documentosEnMemoria);
    }

    return { exito: true, documento: docActualizado, codigoAnterior: codAntUpper, nuevoCodigo: nuevoCodUpper };
  }

  /**
   * Elimina o retira un documento de Google Sheets y de la memoria
   */
  async eliminarDocumento(codigo, motivo = '', borradoFisico = false, id = null, esRegistro = false, titulo = null) {
    if (!codigo) return { exito: false, error: 'Código de documento requerido.' };

    const codUpper = codigo.trim().toUpperCase();
    const payload = {
      accion: 'eliminar_documento',
      codigo: codUpper,
      motivo: motivo,
      borradoFisico: borradoFisico,
      id: id,
      esRegistro: Boolean(esRegistro),
      titulo: titulo
    };

    let syncOk = false;
    // 1. Enviar vía endpoint proxy local
    try {
      const res = await fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const jsonRes = await res.json();
        if (jsonRes.status === 'ok') syncOk = true;
      }
    } catch (e) {
      console.warn('[sharepointService] Proxy local no disponible para eliminar, intentando directo:', e);
    }

    // 2. Fallback directo a Google Apps Script
    if (!syncOk) {
      try {
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
        await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        syncOk = true;
      } catch (e) {
        console.warn('[sharepointService] Fallo envío directo de retiro a Google Sheets:', e);
      }
    }

    if (!syncOk && cacheService && cacheService.encolarMutacion) {
      await cacheService.encolarMutacion(payload);
      console.log('[sharepointService] 📦 Retiro encolado en Outbox para sincronización automática al reconectar.');
    }

    // Si es un registro derivado, retirarlo únicamente de su documento padre
    const mSecDel = codUpper.match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
    if (esRegistro || (id && String(id).includes('_REG_')) || mSecDel) {
      const codPadre = (mSecDel ? mSecDel[1] : codUpper).trim().toUpperCase();
      const docBase = this.documentosEnMemoria.find(d => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro);
      if (docBase && Array.isArray(docBase.registrosDerivados)) {
        const idxReg = docBase.registrosDerivados.findIndex(r => r.id === id || (r.codigo && r.codigo.toUpperCase() === codUpper) || (titulo && r.titulo && r.titulo.toLowerCase() === titulo.toLowerCase()));
        if (idxReg >= 0) {
          docBase.registrosDerivados.splice(idxReg, 1);
        }
      }
      try {
        const rawCreados = localStorage.getItem('agy_sgc_documentos_creados');
        if (rawCreados) {
          const creados = JSON.parse(rawCreados);
          for (const [k, v] of Object.entries(creados)) {
            if (v && (v.id === id || (v.codigo === codUpper) || (v.codigo === codPadre && v.titulo === titulo))) {
              delete creados[k];
            }
          }
          localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creados));
        }
      } catch {}

      if (cacheService && cacheService.guardarDocumentos) {
        cacheService.guardarDocumentos(this.documentosEnMemoria);
      }

      return { exito: true, codigo: codUpper, esRegistro: true, id };
    }

    // 3. Remover de documentos creados en caché local si existía
    try {
      const rawCreados = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawCreados) {
        const creados = JSON.parse(rawCreados);
        if (creados && creados[codUpper]) {
          delete creados[codUpper];
          localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creados));
        }
      }
    } catch {}

    this.documentosEnMemoria = this.documentosEnMemoria.filter(d => (d.codigo || '').toUpperCase() !== codUpper);

    if (cacheService && cacheService.guardarDocumentos) {
      cacheService.guardarDocumentos(this.documentosEnMemoria);
    }

    return { exito: true, codigo: codUpper };
  }
}

export const sharepointService = new DataService();
