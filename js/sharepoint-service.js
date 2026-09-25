/**
 * Servicio de Datos Universal - Unión para la salud y la vida S.A.S.
 * 
 * Conexión sincrónica en tiempo real al archivo REPOSITORIO_DOCUMENTAL.csv de OneDrive.
 */

import { DOCUMENTOS_REALES, URL_ORIGEN_CSV } from './data.js?v=11.6.31';
import { cacheService } from './cache-service.js?v=11.6.61';


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

  // 1. REGLA ESTRICTA: Prefijo FMT -> Formato institucional editable (Word o Excel)
  if (esDocumentoFMT(codigo)) {
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
    } catch {}
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

      const esExcel = extRaw.includes('xls') || extRaw.includes('csv') || (vinculoDescarga && (vinculoDescarga.toLowerCase().includes('.xlsx') || vinculoDescarga.toLowerCase().includes('.xls')));
      const esFMT = esDocumentoFMT(codigo);

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

      mapa.set(codigo.toUpperCase(), {
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
      });
    }

    return mapa;
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

    const filas = [];

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
      const odData = onedriveMap?.get(codUpper) || null;
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
      const rawExt = (odData?.extension || baseDoc?.extension || '').toUpperCase();
      const rawUrl = (odData?.downloadUrl || baseDoc?.downloadUrl || '').toLowerCase();
      const esExcel = rawExt.includes('XLS') || rawExt.includes('CSV') || rawUrl.endsWith('.xlsx') || rawUrl.endsWith('.xls');
      const esFMT = esDocumentoFMT(codigo);
      let formato = 'PDF';
      let extension = 'PDF';
      if (esExcel) {
        formato = 'Excel';
        extension = 'XLS';
      } else if (esFMT) {
        formato = 'Word';
        extension = 'DOC';
      }
      const modificacion = odData?.modificacion || baseDoc?.modificacion || 'N/A';
      const sharepointUrl = odData?.sharepointUrl || baseDoc?.sharepointUrl || '';
      const downloadUrl = odData?.downloadUrl || baseDoc?.downloadUrl || sharepointUrl;

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

      filas.push({
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
      });
    }

    // 8. Incorporar cualquier documento de onedriveMap que tenga URLs activas pero no esté aún en filas de Google Sheets
    if (onedriveMap && onedriveMap.size > 0) {
      const codigosEnFilas = new Set(filas.map((f) => (f.codigo || '').trim().toUpperCase()));
      let extraIdx = filas.length + 1;
      onedriveMap.forEach((od, cod) => {
        const codUpper = (cod || '').trim().toUpperCase();
        if (codUpper && !codigosEnFilas.has(codUpper)) {
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
      return `/api/descargar-pdf?codigo=${codEnc}&url=${urlEnc}&titulo=${titEnc}`;
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
    const spUrl = nuevoDoc.sharepointUrl || '';
    const dlUrl = nuevoDoc.downloadUrl || spUrl;
    const tieneEnlaceActivo = Boolean(
      (dlUrl && dlUrl.trim() !== '' && dlUrl !== '#' && dlUrl !== 'N/A') ||
      (spUrl && spUrl.trim() !== '' && spUrl !== '#' && spUrl !== 'N/A')
    );
    const estaDisponible = (nuevoDoc.disponible !== false) && tieneEnlaceActivo;

    const docNormalizado = {
      id: codUpper,
      codigo: codUpper,
      titulo: nuevoDoc.titulo || nuevoDoc.nombre || 'Nuevo Documento',
      version: nuevoDoc.version || '01',
      estado: estaDisponible ? 'DISPONIBLE' : 'NO DISPONIBLE',
      area: nuevoDoc.area || 'Gestión Integral Calidad',
      tipoProceso: nuevoDoc.tipoProceso || 'Estratégicos',
      proceso: nuevoDoc.proceso || 'Gestión Integral de Calidad',
      carpeta: nuevoDoc.carpeta || 'N/A',
      tipoDocumento: nuevoDoc.tipoDocumento || 'Instructivo',
      formato: nuevoDoc.formato || 'Word',
      extension: nuevoDoc.extension || 'DOC',
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
      creadosLocal[codUpper] = docNormalizado;
      localStorage.setItem('agy_sgc_documentos_creados', JSON.stringify(creadosLocal));

      const rawConf = localStorage.getItem('agy_sgc_conf_cache');
      if (rawConf) {
        const confObj = JSON.parse(rawConf);
        confObj.documentosCreados = confObj.documentosCreados || {};
        confObj.documentosCreados[codUpper] = docNormalizado;
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
    const idxExistente = this.documentosEnMemoria.findIndex((d) => (d.codigo || '').toUpperCase() === codUpper);
    if (idxExistente >= 0) {
      this.documentosEnMemoria[idxExistente] = { ...this.documentosEnMemoria[idxExistente], ...docNormalizado };
    } else {
      this.documentosEnMemoria.unshift(docNormalizado);
    }

    return { exito: true, documento: docNormalizado };
  }

  /**
   * Modifica metadatos de un documento existente en Google Sheets y en memoria
   */
  async modificarDocumento(codigo, nuevosDatos) {
    if (!codigo) return { exito: false, error: 'Código de documento requerido.' };

    const codUpper = codigo.trim().toUpperCase();
    const payload = {
      accion: 'modificar_documento',
      codigo: codUpper,
      documento: { ...nuevosDatos, codigo: codUpper }
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

    const idx = this.documentosEnMemoria.findIndex(d => (d.codigo || '').toUpperCase() === codUpper);
    if (idx >= 0) {
      this.documentosEnMemoria[idx] = {
        ...this.documentosEnMemoria[idx],
        ...nuevosDatos,
        codigo: codUpper
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
  async eliminarDocumento(codigo, motivo = '', borradoFisico = false) {
    if (!codigo) return { exito: false, error: 'Código de documento requerido.' };

    const codUpper = codigo.trim().toUpperCase();
    const payload = {
      accion: 'eliminar_documento',
      codigo: codUpper,
      motivo: motivo,
      borradoFisico: borradoFisico
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
