/**
 * Servicio de Datos Universal - Unión para la salud y la vida S.A.S.
 * 
 * Conexión sincrónica en tiempo real al archivo REPOSITORIO_DOCUMENTAL.csv de OneDrive.
 */

import { DOCUMENTOS_REALES, URL_ORIGEN_CSV } from './data.js?v=11.6.31';
import { cacheService } from './cache-service.js?v=11.6.66';


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
    } catch {}
  }

  /**
   * Limpia registros derivados huérfanos o con nombres obsoletos y asegura los 3 documentos canónicos de FMT-GIC-016
   */
  sanitizarRegistrosLocales() {
    try {
      const padreFmt = (this.documentosEnMemoria || []).find((d) => (d.codigo || '').toUpperCase() === 'FMT-GIC-016' && !d.esRegistro) || {
        codigo: 'FMT-GIC-016',
        titulo: 'Definición de criterios de formación',
        extension: 'DOC',
        formato: 'Word',
        downloadUrl: 'https://unionsaludvida.sharepoint.com/sites/INTRANET/Documentos compartidos/DOCUMENTOS_INSTITUCIONALES/SISTEMAS_INFORMACION/GESTION DOCUMENTAL DE CALIDAD UT/Gestión documental de calidad Unión para la Salud Y la Vida SAS/Calidad/Gestión Integral de la calidad/Gestión Integral de Calidad/Formatos/FMT-GIC-016 Definición de criterios de formación.docx'
      };

      // Si el enlace de descarga o edición del padre apunta a la carpeta (sin extensión .docx), corregirlo al archivo .docx
      if (padreFmt.downloadUrl && !/\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(padreFmt.downloadUrl)) {
        padreFmt.downloadUrl = `${padreFmt.downloadUrl.replace(/\/?$/, '')}.docx`;
      }
      if (padreFmt.sharepointUrl && !/\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(padreFmt.sharepointUrl)) {
        padreFmt.sharepointUrl = `${padreFmt.downloadUrl}?web=1`;
      }
      padreFmt.extension = 'DOC';
      padreFmt.formato = 'Word';

      // Sincronizar también el objeto base en this.documentosEnMemoria si existe
      const docEnMem = (this.documentosEnMemoria || []).find((d) => (d.codigo || '').toUpperCase() === 'FMT-GIC-016' && !d.esRegistro);
      if (docEnMem) {
        if (docEnMem.downloadUrl && !/\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(docEnMem.downloadUrl)) {
          docEnMem.downloadUrl = `${docEnMem.downloadUrl.replace(/\/?$/, '')}.docx`;
        }
        if (docEnMem.sharepointUrl && !/\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(docEnMem.sharepointUrl)) {
          docEnMem.sharepointUrl = `${docEnMem.downloadUrl}?web=1`;
        }
        docEnMem.extension = 'DOC';
        docEnMem.formato = 'Word';
      }

      const docsOficiales = [
        {
          id: 'FMT-GIC-016_REG_001',
          codigo: 'FMT-GIC-016-1',
          titulo: 'Definición de criterios de formación anticoagulados 2026-1',
          formato: 'PDF',
          extension: 'PDF',
          version: '01',
          disponible: true,
          descargable: true,
          subclase: 'Registro',
          esRegistro: true,
          documentoPadreCodigo: 'FMT-GIC-016',
          proceso: 'Gestión Integral de Calidad',
          carpeta: 'Formatos',
          area: 'GIC',
          areaNombre: 'Gestión Integral Calidad',
          tipoProceso: 'Estratégicos',
          modificacion: '2026-09-26 00:45:00'
        },
        {
          id: 'FMT-GIC-016_REG_002',
          codigo: 'FMT-GIC-016-2',
          titulo: 'Definición de criterios de formación anticoagulados 2026-2',
          formato: 'PDF',
          extension: 'PDF',
          version: '01',
          disponible: true,
          descargable: true,
          subclase: 'Registro',
          esRegistro: true,
          documentoPadreCodigo: 'FMT-GIC-016',
          proceso: 'Gestión Integral de Calidad',
          carpeta: 'Formatos',
          area: 'GIC',
          areaNombre: 'Gestión Integral Calidad',
          tipoProceso: 'Estratégicos',
          modificacion: '2026-09-26 00:45:00'
        },
        {
          id: 'FMT-GIC-016_REG_003',
          codigo: 'FMT-GIC-016-3',
          titulo: 'Definición de criterios de formación Asma y EPOC 2026',
          formato: 'PDF',
          extension: 'PDF',
          version: '01',
          disponible: true,
          descargable: true,
          subclase: 'Registro',
          esRegistro: true,
          documentoPadreCodigo: 'FMT-GIC-016',
          proceso: 'Gestión Integral de Calidad',
          carpeta: 'Formatos',
          area: 'GIC',
          areaNombre: 'Gestión Integral Calidad',
          tipoProceso: 'Estratégicos',
          modificacion: '2026-09-26 00:45:00'
        }
      ].map((docSec) => {
        const enlaces = this.generarEnlacesDocumentoSecundario(padreFmt, docSec);
        return {
          ...docSec,
          downloadUrl: enlaces.downloadUrl,
          sharepointUrl: enlaces.sharepointUrl
        };
      });

      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      let creados = {};
      if (rawLocal) {
        try { creados = JSON.parse(rawLocal); } catch {}
      }
      for (const k of Object.keys(creados)) {
        if (k.startsWith('REG_FMT-GIC-016') || k.startsWith('FMT-GIC-016')) {
          delete creados[k];
        }
      }
      docsOficiales.forEach((docOfi) => {
        creados[docOfi.codigo] = { ...creados[docOfi.codigo], ...docOfi };
      });
      localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creados));

      const rawConf = localStorage.getItem('agy_sgc_conf_cache');
      if (rawConf) {
        try {
          const confObj = JSON.parse(rawConf);
          if (confObj && typeof confObj.documentosCreados === 'object') {
            for (const k of Object.keys(confObj.documentosCreados)) {
              if (k.startsWith('REG_FMT-GIC-016') || k.startsWith('FMT-GIC-016')) {
                delete confObj.documentosCreados[k];
              }
            }
            docsOficiales.forEach((docOfi) => {
              confObj.documentosCreados[docOfi.codigo] = { ...confObj.documentosCreados[docOfi.codigo], ...docOfi };
            });
            localStorage.setItem('agy_sgc_conf_cache', JSON.stringify(confObj));
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[DataService] Error en sanitizarRegistrosLocales:', e);
    }
  }

  /**
   * Genera de forma determinística la ruta de la subcarpeta y los vínculos automáticos para un documento secundario.
   * Regla técnica: La subcarpeta se aloja en la carpeta del documento base y se llama exactamente como el padre (sin extensión).
   */
  generarEnlacesDocumentoSecundario(docPadre, docSecundario) {
    if (!docPadre) {
      return { downloadUrl: '', sharepointUrl: '', subcarpeta: '', nombreArchivo: '' };
    }
    const urlBasePadre = (docPadre.downloadUrl || docPadre.sharepointUrl || '').split('?')[0].trim();
    if (!urlBasePadre || !urlBasePadre.startsWith('http')) {
      return { downloadUrl: '', sharepointUrl: '', subcarpeta: '', nombreArchivo: '' };
    }

    const lastSlash = urlBasePadre.lastIndexOf('/');
    const carpetaContenedora = urlBasePadre.substring(0, lastSlash);
    const archivoPadre = urlBasePadre.substring(lastSlash + 1);
    const nombrePadreSinExt = decodeURIComponent(archivoPadre).replace(/\.[^/.]+$/, '').trim();
    const subcarpeta = `${carpetaContenedora}/${nombrePadreSinExt}`;

    const rawExt = ((docSecundario && docSecundario.extension) || docPadre.extension || 'DOC').toUpperCase();
    const ext = (rawExt.includes('XLS') || rawExt.includes('CSV')) ? 'xlsx' : 'docx';

    const codPadre = (docPadre.codigo || '').trim().toUpperCase();
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
   * Calcula el siguiente código secuencial para un registro secundario (ej. FMT-GIC-016-1, FMT-GIC-016-2, ...)
   */
  calcularSiguienteCodigoRegistro(docPadre) {
    if (!docPadre || !docPadre.codigo) return 'REG-001-1';
    const codPadre = docPadre.codigo.trim().toUpperCase();

    const numerosExistentes = new Set();
    const regex = new RegExp(`^${codPadre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`, 'i');

    // 1. Revisar registrosDerivados del documento padre
    if (Array.isArray(docPadre.registrosDerivados)) {
      for (const r of docPadre.registrosDerivados) {
        if (!r) continue;
        const m = (r.codigo || '').match(regex);
        if (m) numerosExistentes.add(parseInt(m[1], 10));
        const mId = (r.id || '').match(regex);
        if (mId) numerosExistentes.add(parseInt(mId[1], 10));
        const mTit = (r.titulo || '').match(regex);
        if (mTit) numerosExistentes.add(parseInt(mTit[1], 10));
      }
    }

    // 2. Revisar documentosEnMemoria
    if (Array.isArray(this.documentosEnMemoria)) {
      for (const d of this.documentosEnMemoria) {
        if (!d) continue;
        const m = (d.codigo || '').match(regex);
        if (m) numerosExistentes.add(parseInt(m[1], 10));
        if (Array.isArray(d.registrosDerivados) && (d.codigo || '').toUpperCase() === codPadre) {
          for (const r of d.registrosDerivados) {
            const mR = (r.codigo || '').match(regex);
            if (mR) numerosExistentes.add(parseInt(mR[1], 10));
          }
        }
      }
    }

    // 3. Revisar en onedriveMap si existe
    if (this._ultimoOnedriveMap) {
      this._ultimoOnedriveMap.forEach((_, k) => {
        const m = (k || '').match(regex);
        if (m) numerosExistentes.add(parseInt(m[1], 10));
      });
    }

    // 4. Revisar localStorage
    try {
      const rawLocal = localStorage.getItem('agy_sgc_documentos_creados');
      if (rawLocal) {
        const obj = JSON.parse(rawLocal);
        for (const k of Object.keys(obj)) {
          const m = k.match(regex);
          if (m) numerosExistentes.add(parseInt(m[1], 10));
          if (obj[k] && obj[k].codigo) {
            const mC = obj[k].codigo.match(regex);
            if (mC) numerosExistentes.add(parseInt(mC[1], 10));
          }
        }
      }
    } catch {}

    const maxNum = numerosExistentes.size > 0 ? Math.max(...numerosExistentes) : 0;
    const siguienteNum = maxNum + 1;
    return `${codPadre}-${siguienteNum}`;
  }

  /**
   * Obtiene los documentos con estrategia Stale-While-Revalidate (IndexedDB + live sync)
   * Renderizado instantáneo a 0 ms y revalidación asíncrona en segundo plano.
   */
  async obtenerDocumentos(forzarRefresco = false) {
    // 1. Carga inmediata desde IndexedDB si no se fuerza refresco y no hay datos en memoria
    if (!forzarRefresco && (!this.documentosEnMemoria || this.documentosEnMemoria.length === 0)) {
      try {
        const cachedDocs = await cacheService.obtenerDocumentos();
        if (Array.isArray(cachedDocs) && cachedDocs.length > 0) {
          this.documentosEnMemoria = cachedDocs;
          console.log(`[DataService] ⚡ Catálogo cargado instantáneamente desde IndexedDB (${cachedDocs.length} docs).`);
          
          // Revalidar en segundo plano sin congelar la UI
          this.descargarCsvEnVivo(false).then((freshDocs) => {
            if (freshDocs && freshDocs.length > 0) {
              this.documentosEnMemoria = freshDocs;
              cacheService.guardarDocumentos(freshDocs);
              window.dispatchEvent(new CustomEvent('agy_docs_updated', { detail: freshDocs }));
            }
          }).catch(() => { });

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
    let textoOneDrive = null;
    let textoGoogleSheets = null;

    // 1. Descargar REPOSITORIO_DOCUMENTAL.csv (OneDrive / SharePoint)
    try {
      const responseOD = await fetch(`/api/repositorio${queryOD}`, {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
      });

      if (responseOD.ok) {
        const txt = await responseOD.text();
        if (txt && (txt.includes(';') || txt.includes(',')) && !txt.includes('<!DOCTYPE html')) {
          textoOneDrive = txt;
        }
      }
    } catch (err) {
      console.warn('[DataService] Error consultando /api/repositorio:', err.message);
    }

    if (!textoOneDrive) {
      try {
        const respLocal = await fetch(`REPOSITORIO_DOCUMENTAL.csv${queryOD}`, {
          cache: 'no-cache',
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        });
        if (respLocal.ok) {
          const txtLocal = await respLocal.text();
          if (txtLocal && (txtLocal.includes(';') || txtLocal.includes(',')) && !txtLocal.includes('<!DOCTYPE html')) {
            textoOneDrive = txtLocal;
          }
        }
      } catch (e) {}
    }

    // 2. Descargar Biblioteca (Google Sheets)
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

    // 3. Parsear mapa técnico de OneDrive (9 columnas)
    const onedriveMap = textoOneDrive ? this.parsearOneDriveMap(textoOneDrive) : new Map();
    this._ultimoOnedriveMap = onedriveMap;

    // 4. Si tenemos Google Sheets, parsear híbrido
    if (textoGoogleSheets) {
      let docsHibridos = this.parsearGoogleSheetsHibrido(textoGoogleSheets, onedriveMap);
      if (docsHibridos && docsHibridos.length > 0) {
        docsHibridos = this.incorporarDocumentosCreados(docsHibridos, onedriveMap);
        this.documentosEnMemoria = docsHibridos;
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

      // Incorporar también registros de onedriveMap que no estén en DOCUMENTOS_REALES
      const codigosReales = new Set(DOCUMENTOS_REALES.map((d) => (d.codigo || '').toUpperCase()));
      onedriveMap.forEach((od, cod) => {
        if (!codigosReales.has(cod)) {
          fusionados.push({
            id: cod,
            codigo: cod,
            titulo: od.titulo || cod,
            formato: od.formato || 'Word',
            extension: od.extension || 'DOC',
            estado: 'DISPONIBLE',
            disponible: true,
            descargable: true,
            permisoOperativo: true,
            permisoAdministrativo: true,
            permisoDirectivo: true,
            estadoDocumento: 'Activo',
            tipoProceso: od.tipoProceso || 'Estratégicos',
            area: od.area || 'Gestión Integral Calidad',
            proceso: od.proceso || 'Gestión Integral de Calidad',
            carpeta: od.carpeta || od.proceso || 'Formatos',
            tipoDocumento: od.tipoDocumento || 'Formato',
            modificacion: od.modificacion || 'N/A',
            version: '01',
            vigencia: '25/9/2026',
            tiempoRetencion: '5 Años',
            lugar: 'Archivo Digital',
            fechaVencimiento: '',
            tipoCambio: 'Creación del documento',
            descripcion: `${od.tipoDocumento || 'Formato'} para ${od.area || 'Calidad'}.`,
            sharepointUrl: od.sharepointUrl,
            downloadUrl: od.downloadUrl
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
      'DA-GMD-035': 'DA-GMD-004'
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

      // Ignorar filas que correspondan a carpetas o subdirectorios de SharePoint (sin extensión de archivo)
      const tieneExtValida = Boolean(
        extRaw ||
        (vinculoDescarga && /\.(docx|pdf|xlsx|doc|xls|csv)(\?|$)/i.test(vinculoDescarga)) ||
        (valores[1] && /\.(docx|pdf|xlsx|doc|xls|csv)$/i.test(valores[1].trim()))
      );
      if (!tieneExtValida) {
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
   * Busca de forma resiliente un archivo en el mapa de OneDrive considerando código y nombre único diferencial
   */
  buscarEnOneDriveMap(onedriveMap, codigo, titulo = '', esRegistro = false) {
    if (!onedriveMap || !codigo || esRegistro) return null;
    const codUpper = (codigo || '').trim().toUpperCase();
    const tNorm = this.normalizarTexto(titulo);
    const itemBaseOD = onedriveMap.get(codUpper);
    const titBaseODNorm = itemBaseOD ? this.normalizarTexto(itemBaseOD.titulo) : '';

    if (tNorm) {
      const claveCompuesta = `${codUpper}::${tNorm}`;
      if (onedriveMap.has(claveCompuesta)) {
        const item = onedriveMap.get(claveCompuesta);
        if (esRegistro && titBaseODNorm && this.normalizarTexto(item.titulo) === titBaseODNorm) {
          return null;
        }
        return item;
      }
      const lista = onedriveMap.get(`_LISTA_${codUpper}`);
      if (Array.isArray(lista) && lista.length > 0) {
        const exacto = lista.find((it) => {
          const itNorm = this.normalizarTexto(it.titulo);
          if (esRegistro && titBaseODNorm && itNorm === titBaseODNorm) return false;
          return itNorm === tNorm;
        });
        if (exacto) return exacto;
        const parcial = lista.find((it) => {
          const itNorm = this.normalizarTexto(it.titulo);
          if (esRegistro && titBaseODNorm && itNorm === titBaseODNorm) return false;
          return itNorm.includes(tNorm) || tNorm.includes(itNorm);
        });
        if (parcial) return parcial;
      }
    }

    if (esRegistro) {
      // Un registro derivado NUNCA debe asociarse al archivo del formato base padre
      return null;
    }

    return onedriveMap.get(codUpper) || null;
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
        'DA-GMD-035': 'DA-GMD-004'
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
      const modificacion = odData?.modificacion || (esRegistro ? 'N/A' : (baseDoc?.modificacion || 'N/A'));
      let sharepointUrl = odData?.sharepointUrl || (esRegistro ? '' : (baseDoc?.sharepointUrl || ''));
      let downloadUrl = odData?.downloadUrl || (esRegistro ? '' : (baseDoc?.downloadUrl || sharepointUrl));

      // Protección estricta: un registro derivado jamás debe apuntar al archivo del documento base padre
      if (esRegistro && baseDoc) {
        if (downloadUrl === baseDoc.downloadUrl || sharepointUrl === baseDoc.sharepointUrl) {
          downloadUrl = '';
          sharepointUrl = '';
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
      const titulo = tituloGS || baseDoc?.titulo || codigo;

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

          // Generación automática y determinística de vínculos: para documentos secundarios LA RUTA SE CALCULA
          const enlacesAuto = this.generarEnlacesDocumentoSecundario(docPadre, registroObj);
          registroObj.downloadUrl = enlacesAuto.downloadUrl;
          registroObj.sharepointUrl = enlacesAuto.sharepointUrl;
          registroObj.disponible = Boolean(enlacesAuto.downloadUrl || enlacesAuto.sharepointUrl);
          registroObj.estado = registroObj.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';

          const coincideYa = (r) => {
            if (r.id === registroObj.id) return true;
            if (r.codigo && registroObj.codigo && r.codigo.toUpperCase() === registroObj.codigo.toUpperCase()) return true;
            if (r.titulo && registroObj.titulo && r.titulo.toLowerCase().trim() === registroObj.titulo.toLowerCase().trim()) return true;
            const n1 = (r.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            const n2 = (registroObj.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return n1 === n2 || (n1.length > 5 && n2.length > 5 && (n1.includes(n2) || n2.includes(n1)));
          };
          const idxReg = docPadre.registrosDerivados.findIndex(coincideYa);
          if (idxReg >= 0) {
            docPadre.registrosDerivados[idxReg] = { ...docPadre.registrosDerivados[idxReg], ...registroObj };
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
        const enlacesAuto = this.generarEnlacesDocumentoSecundario(docPadre, registroObj);
        registroObj.downloadUrl = enlacesAuto.downloadUrl;
        registroObj.sharepointUrl = enlacesAuto.sharepointUrl;
        registroObj.disponible = Boolean(enlacesAuto.downloadUrl || enlacesAuto.sharepointUrl);
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

    // 8. Incorporar cualquier documento de onedriveMap que tenga URLs activas pero no esté aún en filas de Google Sheets
    if (onedriveMap && onedriveMap.size > 0) {
      const codigosEnFilas = new Set(filas.map((f) => (f.codigo || '').trim().toUpperCase()));
      let extraIdx = filas.length + 1;
      onedriveMap.forEach((od, cod) => {
        const codUpper = (cod || '').trim().toUpperCase();
        if (codUpper.includes('::') || codUpper.startsWith('_LISTA_')) return;
        if (codUpper && !codigosEnFilas.has(codUpper)) {
          // Si el código corresponde a un registro derivado (ej. FMT-GIC-016-1) y su padre existe, adjuntarlo a su padre
          const mSec = codUpper.match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
          if (mSec && mapaDocsBase.has(mSec[1])) {
            const codPadre = mSec[1];
            const docPadre = mapaDocsBase.get(codPadre);
            docPadre.registrosDerivados = docPadre.registrosDerivados || [];
            const rawExt = (od.extension || '').toUpperCase();
            const esExcel = rawExt.includes('XLS') || rawExt.includes('CSV') || (od.downloadUrl && od.downloadUrl.toLowerCase().includes('.xlsx'));
            const formato = esExcel ? 'Excel' : 'Word';
            const extension = esExcel ? 'XLS' : 'DOC';
            const registroObj = {
              id: `${codUpper}_REG_${Date.now()}`,
              codigo: codUpper,
              titulo: od.titulo || codUpper,
              formato: formato,
              extension: extension,
              estado: 'DISPONIBLE',
              disponible: true,
              descargable: true,
              permisoOperativo: true,
              permisoAdministrativo: true,
              permisoDirectivo: true,
              estadoDocumento: 'Activo',
              tipoProceso: docPadre.tipoProceso,
              area: docPadre.area,
              areaNombre: docPadre.areaNombre || docPadre.area,
              proceso: docPadre.proceso,
              carpeta: docPadre.carpeta || docPadre.proceso,
              tipoDocumento: 'Registro',
              subclase: 'Registro',
              esRegistro: true,
              documentoPadreCodigo: codPadre,
              modificacion: od.modificacion || new Date().toISOString().replace('T', ' ').substring(0, 19),
              version: '01',
              vigencia: docPadre.vigencia || '01/08/2026',
              tiempoRetencion: docPadre.tiempoRetencion || '5 Años',
              tiempo: docPadre.tiempoRetencion || '5 Años',
              tiempoVigencia: docPadre.tiempoRetencion || '5 Años',
              lugar: docPadre.lugar || 'Archivo Digital',
              lugarArchivo: docPadre.lugarArchivo || 'Archivo Digital',
              fechaVencimiento: docPadre.fechaVencimiento || '',
              tipoCambio: 'Creación del documento',
              descripcion: `Registro Derivado de ${codPadre}.`,
              sharepointUrl: od.sharepointUrl || '',
              downloadUrl: od.downloadUrl || od.sharepointUrl || ''
            };
            const enlaces = this.generarEnlacesDocumentoSecundario(docPadre, registroObj);
            if (!registroObj.downloadUrl) registroObj.downloadUrl = enlaces.downloadUrl;
            if (!registroObj.sharepointUrl) registroObj.sharepointUrl = enlaces.sharepointUrl;

            const coincideYa = (r) => (r.codigo && r.codigo.toUpperCase() === codUpper) || (r.titulo && r.titulo.toLowerCase().trim() === registroObj.titulo.toLowerCase().trim());
            const idxExistente = docPadre.registrosDerivados.findIndex(coincideYa);
            if (idxExistente >= 0) {
              docPadre.registrosDerivados[idxExistente] = { ...docPadre.registrosDerivados[idxExistente], ...registroObj };
            } else {
              docPadre.registrosDerivados.push(registroObj);
            }
            docPadre.registrosDerivados = this._deduplicarRegistros(docPadre.registrosDerivados);
            codigosEnFilas.add(codUpper);
            return;
          }
          const tieneUrl = Boolean(
            (od.sharepointUrl && od.sharepointUrl.trim() !== '' && od.sharepointUrl !== '#') ||
            (od.downloadUrl && od.downloadUrl.trim() !== '' && od.downloadUrl !== '#')
          );
          if (tieneUrl) {
            const rawExt = (od.extension || '').toUpperCase();
            const esExcel = rawExt.includes('XLS') || rawExt.includes('CSV') || (od.downloadUrl && od.downloadUrl.toLowerCase().includes('.xlsx'));
            const esFMT = esDocumentoFMT(codUpper);
            let formato = 'PDF';
            let extension = 'PDF';
            if (esExcel) {
              formato = 'Excel';
              extension = 'XLS';
            } else if (esFMT) {
              formato = 'Word';
              extension = 'DOC';
            }
            const tipoDoc = normalizarTipoDocumentoDoc(od.tipoDocumento || '', codUpper);
            const area = normalizarAreaDoc(od.area || '', codUpper);
            const proceso = od.proceso || area;
            const tipoProceso = normalizarTipoProcesoDoc(od.tipoProceso || '', area, codUpper);

            filas.push({
              id: `doc-${String(extraIdx++).padStart(3, '0')}`,
              codigo: codUpper,
              titulo: od.titulo || codUpper,
              formato: formato,
              extension: extension,
              estado: 'DISPONIBLE',
              disponible: true,
              descargable: true,
              permisoOperativo: true,
              permisoAdministrativo: true,
              permisoDirectivo: true,
              estadoDocumento: 'Activo',
              tipoProceso: tipoProceso,
              area: area,
              proceso: proceso,
              carpeta: proceso,
              tipoDocumento: tipoDoc,
              modificacion: od.modificacion || 'N/A',
              version: '01',
              vigencia: '25/9/2026',
              tiempoRetencion: '5 Años',
              tiempo: '5 Años',
              tiempoVigencia: '5 Años',
              lugar: 'Archivo Digital',
              lugarArchivo: 'Archivo Digital',
              fechaVencimiento: '',
              tipoCambio: 'Creación del documento',
              descripcion: `${tipoDoc} para ${area} dentro del proceso ${proceso}.`,
              sharepointUrl: od.sharepointUrl || '',
              downloadUrl: od.downloadUrl || od.sharepointUrl || ''
            });
            codigosEnFilas.add(codUpper);
          }
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

    // Transformación nativa para SharePoint Online REST v2.0 (Microsoft Graph Drive API)
    if (limpia.includes('/Documentos compartidos/')) {
      try {
        const idx = limpia.indexOf('/Documentos compartidos/');
        const siteBase = limpia.substring(0, idx); // Ej: https://unionsaludvida.sharepoint.com/sites/INTRANET
        const subpath = limpia.substring(idx + '/Documentos compartidos/'.length);
        const subpathEncoded = encodeURI(decodeURI(subpath));

        // Endpoint REST v2.0 oficial de SharePoint Online
        return `${siteBase}/_api/v2.0/drive/root:/${subpathEncoded}:/content?format=pdf`;
      } catch (e) {
        console.warn('[sharepointService] Error construyendo URL REST v2.0 PDF:', e);
      }
    }

    return urlOriginal;
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
    const urlPdf = this.obtenerUrlDescargaPdf(doc);
    if (!urlPdf || urlPdf === '#' || urlPdf === '') {
      alert(`El documento ${doc.codigo || ''} no tiene enlace de descarga disponible.`);
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
    // Para GARANTIZAR que el documento se abra SIEMPRE en una pestaña o página diferente
    // sin reemplazar la aplicación de Gestión Documental ni perder el contexto de trabajo:
    this.notificar(`📄 Generando y abriendo PDF de ${codigo} en nueva pestaña...`, 'info');

    // Construir la URL directa a la API REST de SharePoint Online para conversión en tiempo real
    let urlDestino = urlPdf;
    const limpia = (doc.downloadUrl || doc.sharepointUrl || '').split('?')[0];
    if (limpia.includes('/Documentos compartidos/')) {
      try {
        const idx = limpia.indexOf('/Documentos compartidos/');
        const siteBase = limpia.substring(0, idx);
        const subpath = limpia.substring(idx + '/Documentos compartidos/'.length);
        const subpathEncoded = encodeURI(decodeURI(subpath));
        urlDestino = `${siteBase}/_api/v2.0/drive/root:/${subpathEncoded}:/content?format=pdf`;
      } catch (e) {
        console.warn('[sharepointService] Error construyendo URL directa de SharePoint:', e);
      }
    }

    // Apertura en nueva pestaña garantizando una sola ventana (evita duplicación provocada por noopener)
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
    const url = doc.downloadUrl || doc.sharepointUrl;
    if (url && url !== '#' && url !== '') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    } else {
      alert(`El documento ${doc.codigo} no tiene enlace de descarga disponible.`);
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
    const url = (doc.sharepointUrl || doc.downloadUrl || '').trim();
    if (url && url.startsWith('http') && (url.includes('/Documentos compartidos/') || url.includes('/Shared Documents/'))) {
      try {
        const decoded = decodeURIComponent(url.split('?')[0]);
        const marker = decoded.includes('/Documentos compartidos/') ? '/Documentos compartidos/' : '/Shared Documents/';
        const idx = decoded.indexOf(marker);
        if (idx !== -1) {
          const fullRel = decoded.substring(idx + marker.length);
          const lastSlash = fullRel.lastIndexOf('/');
          if (lastSlash > 0) {
            return fullRel.substring(0, lastSlash);
          }
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

      // Si es un Registro Derivado, asociarlo a su Documento Base padre
      const mSecCod = (docObj.codigo || cod).match(/^([A-Z]{3,4}-[A-Z]{2,4}-\d{3,4})-(\d+)$/i);
      if (docObj.subclase === 'Registro' || docObj.esRegistro === true || cod.startsWith('REG_') || cod.includes('::') || docObj.codigoPadre || mSecCod) {
        const codUpper = (docObj.codigo || cod).trim().toUpperCase();
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
          const docCorregido = {
            ...docObj,
            id: docObj.id || `${codUpper}_REG_${Date.now()}`,
            codigo: codUpper,
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
            sharepointUrl: regSpUrl,
            downloadUrl: regDlUrl,
            disponible: Boolean(regDlUrl || regSpUrl),
            estado: (regDlUrl || regSpUrl) ? 'DISPONIBLE' : 'NO DISPONIBLE'
          };

          // La ruta de los documentos secundarios SE CALCULA SIEMPRE de forma determinística a partir del documento padre
          const enlaces = this.generarEnlacesDocumentoSecundario(base, docCorregido);
          docCorregido.downloadUrl = enlaces.downloadUrl;
          docCorregido.sharepointUrl = enlaces.sharepointUrl;
          docCorregido.disponible = Boolean(enlaces.downloadUrl || enlaces.sharepointUrl);
          docCorregido.estado = docCorregido.disponible ? 'DISPONIBLE' : 'NO DISPONIBLE';

          const coincideReg = (r) => {
            if (docObj.id && r.id === docObj.id) return true;
            if (r.codigo && docCorregido.codigo && r.codigo.toUpperCase() === docCorregido.codigo.toUpperCase()) return true;
            if (r.titulo && docObj.titulo && r.titulo.toLowerCase().trim() === docObj.titulo.toLowerCase().trim()) return true;
            const nR = (r.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            const nObj = (docObj.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
            return nR === nObj || (nR.length > 5 && nObj.length > 5 && (nR.includes(nObj) || nObj.includes(nR)));
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

      const codUpper = cod.trim().toUpperCase();
      if (!codigosExistentes.has(codUpper) && docObj) {
        const od = mapOD?.get(codUpper);
        const spUrl = od?.sharepointUrl || docObj.sharepointUrl || '';
        const dlUrl = od?.downloadUrl || docObj.downloadUrl || spUrl;
        const tieneEnlaceActivo = Boolean(
          (dlUrl && dlUrl.trim() !== '' && dlUrl !== '#' && dlUrl !== 'N/A') ||
          (spUrl && spUrl.trim() !== '' && spUrl !== '#' && spUrl !== 'N/A')
        );
        const estaDisponible = (docObj.disponible !== false && tieneEnlaceActivo) || Boolean(od && tieneEnlaceActivo);

        nuevosParaAgregar.push({
          id: codUpper,
          codigo: codUpper,
          titulo: od?.titulo || docObj.titulo || docObj.nombre || 'Documento Institucional',
          version: docObj.version || '01',
          estado: estaDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
          area: od?.area || docObj.area || 'Gestión Integral Calidad',
          tipoProceso: od?.tipoProceso || docObj.tipoProceso || 'Estratégicos',
          proceso: od?.proceso || docObj.proceso || 'Gestión Integral de Calidad',
          carpeta: od?.carpeta || docObj.carpeta || 'N/A',
          tipoDocumento: od?.tipoDocumento || docObj.tipoDocumento || 'Instructivo',
          formato: od?.formato || docObj.formato || 'Word',
          extension: od?.extension || docObj.extension || 'DOC',
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

    const esExcelSec = (nuevoDoc.formato === 'Excel' || docPadre?.formato === 'Excel' || (nuevoDoc.extension && nuevoDoc.extension.toUpperCase().includes('XLS')));
    const formatoEfectivo = esRegistro 
      ? (esExcelSec ? 'Excel' : 'PDF')
      : (nuevoDoc.formato || docPadre?.formato || (esDocumentoFMT(codUpper) ? 'Word' : 'PDF'));
    const extensionEfectiva = esRegistro
      ? (esExcelSec ? 'XLS' : 'PDF')
      : (nuevoDoc.extension || docPadre?.extension || (formatoEfectivo === 'Excel' ? 'XLS' : (formatoEfectivo === 'Word' ? 'DOC' : 'PDF')));

    const docNormalizado = {
      id: esRegistro ? `${codUpper}_REG_${Date.now()}` : codUpper,
      codigo: codUpper,
      titulo: nuevoDoc.titulo || nuevoDoc.nombre || 'Nuevo Documento',
      version: nuevoDoc.version || '01',
      estado: estaDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
      area: nuevoDoc.area || docPadre?.area || 'Gestión Integral Calidad',
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

    // 2. Enviar a endpoint local / servidor y Google Apps Script en segundo plano
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    try {
      fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    } catch (e) {
      try {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (e2) {}
    }

    // 3. Actualizar catálogo en memoria
    if (esRegistro) {
      const docBase = this.documentosEnMemoria.find((d) => (d.codigo || '').toUpperCase() === codPadre && !d.esRegistro);
      if (docBase) {
        docBase.registrosDerivados = docBase.registrosDerivados || [];
        const idxReg = docBase.registrosDerivados.findIndex(r => r.id === docNormalizado.id || (r.codigo && r.codigo.toUpperCase() === codUpper) || (r.titulo && r.titulo.toLowerCase() === docNormalizado.titulo.toLowerCase()));
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

      // Auto-generación de enlaces en la subcarpeta del documento base si faltan
      if (docPadre && (!reg.downloadUrl || !reg.sharepointUrl)) {
        const enlaces = this.generarEnlacesDocumentoSecundario(docPadre, reg);
        reg.downloadUrl = reg.downloadUrl || enlaces.downloadUrl;
        reg.sharepointUrl = reg.sharepointUrl || enlaces.sharepointUrl;
        if (reg.downloadUrl || reg.sharepointUrl) {
          reg.disponible = true;
          reg.estado = 'DISPONIBLE';
        }
      }

      // Normalización canónica para registros de FMT-GIC-016
      if (codPadre === 'FMT-GIC-016' || (reg.codigo && reg.codigo.startsWith('FMT-GIC-016'))) {
        const titLower = (reg.titulo || '').toLowerCase();
        if ((titLower.includes('anticoagulados') && (titLower.includes('2026-1') || titLower.includes('1') || !titLower.includes('2026-2'))) && !titLower.includes('2026-2')) {
          reg.codigo = 'FMT-GIC-016-1';
          reg.titulo = 'Definición de criterios de formación anticoagulados 2026-1';
        } else if (titLower.includes('anticoagulados') && (titLower.includes('2026-2') || titLower.includes('2'))) {
          reg.codigo = 'FMT-GIC-016-2';
          reg.titulo = 'Definición de criterios de formación anticoagulados 2026-2';
        } else if (titLower.includes('asma') || titLower.includes('epoc')) {
          reg.codigo = 'FMT-GIC-016-3';
          reg.titulo = 'Definición de criterios de formación Asma y EPOC 2026';
        }
        if (docPadre) {
          const enlaces = this.generarEnlacesDocumentoSecundario(docPadre, reg);
          reg.downloadUrl = enlaces.downloadUrl;
          reg.sharepointUrl = enlaces.sharepointUrl;
          reg.disponible = true;
          reg.estado = 'DISPONIBLE';
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
        const nExistente = normalizar(existente.titulo);
        if (nExistente === nReg) return true;
        if (nReg.length >= 8 && nExistente.length >= 8) {
          if (nReg.includes(nExistente) || nExistente.includes(nReg)) return true;
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

    // 1. Enviar vía proxy local / Google Apps Script
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec';
    try {
      fetch('/api/documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    } catch (e) {
      try {
        fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (e2) {}
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

    // 3. Actualizar en memoria
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

    return { exito: true, codigo: codUpper };
  }
}

export const sharepointService = new DataService();
