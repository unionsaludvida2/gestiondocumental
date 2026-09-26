/**
 * Motor de Filtrado Reactivo, Búsqueda Inteligente y Ordenamiento Relacional
 * Unión para la salud y la vida S.A.S.
 * 
 * Jerarquía Documental: TIPO DE PROCESO -> ÁREA -> PROCESO -> TIPO DE DOCUMENTO
 */

export class FilterEngine {
  constructor() {
    this.estado = {
      busqueda: '',
      perfil: 'operativo', // 'operativo' (por defecto), 'administrativo', 'directivo'
      tiposProceso: new Set(),
      areas: new Set(),
      procesos: new Set(),
      tiposDocumento: new Set(),
      formato: 'TODOS', // 'TODOS', 'Word', 'PDF', 'Excel'
      soloFavoritos: false,
      soloTop10: false,
      ordenamiento: 'codigo-asc', // 'codigo-asc', 'codigo-desc', 'titulo-asc', 'titulo-desc', 'fecha-desc', 'fecha-asc'
      aplicarRestriccionPerfil: false
    };
  }

  setPerfil(perfilId) {
    this.estado.perfil = perfilId || 'operativo';
  }

  obtenerDocumentosPorPerfil(documentos) {
    if (!documentos) return [];
    const p = this.estado.perfil || 'operativo';

    // 1. Acceso Total: Sin restricciones de ningún tipo (todos los documentos)
    if (p === 'total' || p === 'administrador') {
      return documentos;
    }

    // 2. Directivo: Puede ver todos los documentos
    if (p === 'directivo') {
      return documentos;
    }

    // 3. Administrativo: Puede ver lo administrativo u operativo
    if (p === 'administrativo') {
      return documentos.filter((d) => d.permisoAdministrativo === true || d.permisoOperativo === true || d.permisoAdministrativo !== false || d.permisoOperativo !== false);
    }

    // 4. Operativo: Solo puede ver lo operativo
    if (p === 'operativo') {
      return documentos.filter((d) => d.permisoOperativo === true || (d.permisoOperativo !== false && d.permisoOperativo !== 'false'));
    }

    return documentos;
  }

  removerTildes(texto) {
    if (!texto) return '';
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  setBusqueda(texto) {
    this.estado.busqueda = (texto || '').trim();
  }

  setSoloFavoritos(valor) {
    this.estado.soloFavoritos = Boolean(valor);
    if (this.estado.soloFavoritos) {
      this.estado.soloTop10 = false; // Mutuamente excluyente con Top 10
    }
  }

  setSoloTop10(valor) {
    this.estado.soloTop10 = Boolean(valor);
    if (this.estado.soloTop10) {
      this.estado.soloFavoritos = false; // Mutuamente excluyente con Favoritos
    }
  }

  normalizarTipoProceso(tp) {
    if (!tp) return '';
    const s = String(tp).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (s === 'CALIDAD') return 'Calidad';
    if (s.startsWith('ESTRATEGIC')) return 'Estrategico';
    if (s.startsWith('MISIONAL')) return 'Misional';
    if (s === 'APOYO') return 'Apoyo';
    return tp.trim();
  }

  toggleTipoProceso(tipoProceso) {
    const tpNorm = this.normalizarTipoProceso(tipoProceso);
    let encontrado = null;
    for (const t of this.estado.tiposProceso) {
      if (this.normalizarTipoProceso(t) === tpNorm) {
        encontrado = t;
        break;
      }
    }
    if (encontrado) {
      this.estado.tiposProceso.delete(encontrado);
    } else {
      this.estado.tiposProceso.add(tipoProceso);
    }
  }

  toggleArea(area) {
    const aNorm = this.removerTildes(area);
    let encontrado = null;
    for (const a of this.estado.areas) {
      if (this.removerTildes(a) === aNorm) {
        encontrado = a;
        break;
      }
    }
    if (encontrado) {
      this.estado.areas.delete(encontrado);
    } else {
      this.estado.areas.add(area);
    }
  }

  toggleProceso(proceso) {
    const pNorm = this.removerTildes(proceso);
    let encontrado = null;
    for (const p of this.estado.procesos) {
      if (this.removerTildes(p) === pNorm) {
        encontrado = p;
        break;
      }
    }
    if (encontrado) {
      this.estado.procesos.delete(encontrado);
    } else {
      this.estado.procesos.add(proceso);
    }
  }

  // Alias para compatibilidad con código existente
  toggleCarpeta(carpeta) {
    this.toggleProceso(carpeta);
  }

  toggleTipoDocumento(tipo) {
    const tNorm = this.removerTildes(tipo);
    let encontrado = null;
    for (const t of this.estado.tiposDocumento) {
      if (this.removerTildes(t) === tNorm) {
        encontrado = t;
        break;
      }
    }
    if (encontrado) {
      this.estado.tiposDocumento.delete(encontrado);
    } else {
      this.estado.tiposDocumento.add(tipo);
    }
  }

  /**
   * Determina el formato operativo y de descarga efectivo del documento:
   * - 'Excel': Todo documento de tipo Excel (.xlsx, .xls, .csv). NUNCA se convierten a PDF.
   * - 'Word': Exclusivamente los documentos institucionales tipo FMT de tipo Word.
   * - 'PDF': Todos los demás documentos (Word no-FMT o PDF nativos) que se entregan en PDF.
   */
  obtenerFormatoEfectivoDocumento(doc) {
    if (!doc) return 'DESCONOCIDO';
    const ext = (doc.extension || '').toString().trim().toUpperCase();
    const cod = (doc.codigo || '').toString().trim().toUpperCase();
    const urlLimpia = (doc.downloadUrl || doc.sharepointUrl || '').split('?')[0].toLowerCase();
    const esExcel = ext.includes('XLS') || ext.includes('CSV') || urlLimpia.endsWith('.xlsx') || urlLimpia.endsWith('.xls') || String(doc.formato || '').toUpperCase() === 'EXCEL';

    // 1. Todo documento de tipo Excel
    if (esExcel) {
      return 'Excel';
    }

    // 2. Documentos tipo FMT de tipo Word
    const esFMT = cod.startsWith('FMT-') || cod.startsWith('FMT_') || cod.startsWith('FMT ') || cod === 'FMT';
    if (esFMT) {
      return 'Word';
    }

    // 3. Todo documento descargable en PDF (Word no-FMT o PDF nativo)
    return 'PDF';
  }

  setFormato(formato) {
    this.estado.formato = formato || 'TODOS';
  }

  setOrdenamiento(orden) {
    this.estado.ordenamiento = orden;
  }

  setAplicarRestriccionPerfil(valor) {
    this.estado.aplicarRestriccionPerfil = Boolean(valor);
  }

  restablecerFiltros() {
    this.estado.busqueda = '';
    this.estado.tiposProceso.clear();
    this.estado.areas.clear();
    this.estado.procesos.clear();
    this.estado.tiposDocumento.clear();
    this.estado.formato = 'TODOS';
    this.estado.soloFavoritos = false;
    this.estado.soloTop10 = false;
    this.estado.ordenamiento = 'codigo-asc';
  }

  limpiarFiltros() {
    this.restablecerFiltros();
  }

  removerFiltroIndividual(categoria, valor) {
    if (categoria === 'busqueda') this.estado.busqueda = '';
    if (categoria === 'tipoProceso' || categoria === 'tipo-proceso') {
      const tpNorm = this.normalizarTipoProceso(valor);
      for (const t of this.estado.tiposProceso) {
        if (this.normalizarTipoProceso(t) === tpNorm) {
          this.estado.tiposProceso.delete(t);
          break;
        }
      }
    }
    if (categoria === 'area') {
      const vNorm = this.removerTildes(valor);
      for (const a of this.estado.areas) {
        if (this.removerTildes(a) === vNorm) {
          this.estado.areas.delete(a);
          break;
        }
      }
    }
    if (categoria === 'proceso' || categoria === 'carpeta') {
      const vNorm = this.removerTildes(valor);
      for (const p of this.estado.procesos) {
        if (this.removerTildes(p) === vNorm) {
          this.estado.procesos.delete(p);
          break;
        }
      }
    }
    if (categoria === 'tipo' || categoria === 'tipoDocumento') {
      const vNorm = this.removerTildes(valor);
      for (const t of this.estado.tiposDocumento) {
        if (this.removerTildes(t) === vNorm) {
          this.estado.tiposDocumento.delete(t);
          break;
        }
      }
    }
    if (categoria === 'formato') this.estado.formato = 'TODOS';
    if (categoria === 'favoritos') this.estado.soloFavoritos = false;
    if (categoria === 'top10') this.estado.soloTop10 = false;
  }

  /**
   * Obtiene los documentos aplicando todos los filtros activos excepto la categoría excluida
   * Permite el cálculo facetado responsivo en tiempo real de conteos y opciones
   */
  obtenerDocumentosFiltradosExcepto(documentos, categoriaExcluida = null, authService = null, favoritosSet = null, top10Set = null) {
    let filtrados = this.obtenerDocumentosPorPerfil(documentos);

    if (this.estado.aplicarRestriccionPerfil && authService) {
      filtrados = filtrados.filter((doc) => authService.puedeVerDocumento(doc));
    }

    if (this.estado.soloFavoritos && favoritosSet) {
      filtrados = filtrados.filter((doc) => favoritosSet.has(doc.id));
    }

    if (this.estado.soloTop10 && top10Set) {
      filtrados = filtrados.filter((doc) => top10Set.has(doc.id));
    }

    if (this.estado.formato && this.estado.formato !== 'TODOS') {
      const fSel = this.estado.formato.toUpperCase();
      filtrados = filtrados.filter((doc) => {
        const fmtDoc = this.obtenerFormatoEfectivoDocumento(doc).toUpperCase();
        return fmtDoc === fSel;
      });
    }

    if (categoriaExcluida !== 'tiposProceso' && this.estado.tiposProceso.size > 0) {
      const tiposNorm = new Set(Array.from(this.estado.tiposProceso).map((t) => this.normalizarTipoProceso(t)));
      filtrados = filtrados.filter((doc) => tiposNorm.has(this.normalizarTipoProceso(doc.tipoProceso)));
    }

    if (categoriaExcluida !== 'areas' && this.estado.areas.size > 0) {
      const areasNorm = new Set(Array.from(this.estado.areas).map((a) => this.removerTildes(a)));
      filtrados = filtrados.filter((doc) => areasNorm.has(this.removerTildes(doc.area)));
    }

    if (categoriaExcluida !== 'procesos' && this.estado.procesos.size > 0) {
      const procesosNorm = new Set(Array.from(this.estado.procesos).map((p) => this.removerTildes(p)));
      filtrados = filtrados.filter((doc) => procesosNorm.has(this.removerTildes(doc.proceso)));
    }

    if (categoriaExcluida !== 'tiposDocumento' && this.estado.tiposDocumento.size > 0) {
      const tiposNorm = new Set(Array.from(this.estado.tiposDocumento).map((t) => this.removerTildes(t)));
      filtrados = filtrados.filter((doc) => tiposNorm.has(this.removerTildes(doc.tipoDocumento)));
    }

    if (categoriaExcluida !== 'busqueda' && this.estado.busqueda) {
      const busquedaNorm = this.removerTildes(this.estado.busqueda);
      const palabras = busquedaNorm.split(/\s+/).filter(Boolean);
      filtrados = filtrados.filter((doc) => {
        doc.registroCoincidente = null;
        const textoDoc = this.removerTildes(`${doc.codigo || ''} ${doc.titulo || ''} ${doc.tipoProceso || ''} ${doc.area || ''} ${doc.proceso || ''} ${doc.tipoDocumento || ''} ${doc.formato || ''} ${doc.descripcion || ''} ${doc.extension || ''}`);
        const coincideBase = palabras.every((p) => textoDoc.includes(p));
        if (coincideBase) {
          return true;
        }

        // Búsqueda recursiva en registros derivados
        if (Array.isArray(doc.registrosDerivados) && doc.registrosDerivados.length > 0) {
          for (const reg of doc.registrosDerivados) {
            const textoReg = this.removerTildes(`${reg.codigo || ''} ${reg.titulo || ''} ${reg.descripcion || ''} ${reg.extension || ''}`);
            if (palabras.every((p) => textoReg.includes(p))) {
              doc.registroCoincidente = reg;
              return true;
            }
          }
        }

        return false;
      });
    }

    return filtrados;
  }

  /**
   * Calcula dinámicamente las opciones relacionadas y conteos responsivos en cascada bidireccional
   */
  obtenerOpcionesRelacionadas(documentos, authService = null, favoritosSet = null, top10Set = null) {
    if (!documentos || documentos.length === 0) {
      return {
        tiposProceso: [],
        areas: [],
        procesos: [],
        tiposDocumento: [],
        carpetas: [],
        conteos: { tiposProceso: {}, areas: {}, procesos: {}, tiposDocumento: {} }
      };
    }

    const docsBase = this.obtenerDocumentosPorPerfil(documentos);

    // Tipos de Proceso oficiales
    const todosTiposProceso = ['Apoyo', 'Calidad', 'Estrategico', 'Misional'];

    // Listas maestras ordenadas
    const todasAreas = Array.from(new Set(docsBase.map((d) => d.area).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));
    const todosProcesos = Array.from(new Set(docsBase.map((d) => d.proceso).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));
    const todosTiposDoc = Array.from(new Set(docsBase.map((d) => d.tipoDocumento).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es'));

    // Subconjuntos responsivos para conteos precisos por faceta
    const docsParaTiposProceso = this.obtenerDocumentosFiltradosExcepto(documentos, 'tiposProceso', authService, favoritosSet, top10Set);
    const docsParaAreas = this.obtenerDocumentosFiltradosExcepto(documentos, 'areas', authService, favoritosSet, top10Set);
    const docsParaProcesos = this.obtenerDocumentosFiltradosExcepto(documentos, 'procesos', authService, favoritosSet, top10Set);
    const docsParaTiposDoc = this.obtenerDocumentosFiltradosExcepto(documentos, 'tiposDocumento', authService, favoritosSet, top10Set);

    const conteos = {
      tiposProceso: {},
      areas: {},
      procesos: {},
      tiposDocumento: {}
    };

    todosTiposProceso.forEach((tp) => {
      const tpNorm = this.normalizarTipoProceso(tp);
      conteos.tiposProceso[tp] = docsParaTiposProceso.filter((d) => this.normalizarTipoProceso(d.tipoProceso) === tpNorm).length;
    });

    todasAreas.forEach((a) => {
      const aNorm = this.removerTildes(a);
      conteos.areas[a] = docsParaAreas.filter((d) => this.removerTildes(d.area) === aNorm).length;
    });

    todosProcesos.forEach((p) => {
      const pNorm = this.removerTildes(p);
      conteos.procesos[p] = docsParaProcesos.filter((d) => this.removerTildes(d.proceso) === pNorm).length;
    });

    todosTiposDoc.forEach((t) => {
      const tNorm = this.removerTildes(t);
      conteos.tiposDocumento[t] = docsParaTiposDoc.filter((d) => this.removerTildes(d.tipoDocumento) === tNorm).length;
    });

    // REGLA: Ocultar en los filtros todos los elementos que no tengan documentos (> 0)
    // (a menos que estén activamente seleccionados para permitir al usuario desmarcarlos)
    const tiposProcesoVisibles = todosTiposProceso.filter((tp) => {
      const cnt = conteos.tiposProceso[tp] || 0;
      const seleccionado = Array.from(this.estado.tiposProceso).some((t) => this.normalizarTipoProceso(t) === this.normalizarTipoProceso(tp));
      return cnt > 0 || seleccionado;
    });

    const areasVisibles = todasAreas.filter((a) => {
      const cnt = conteos.areas[a] || 0;
      const aNorm = this.removerTildes(a);
      const seleccionado = Array.from(this.estado.areas).some((sel) => this.removerTildes(sel) === aNorm);
      return cnt > 0 || seleccionado;
    });

    const procesosVisibles = todosProcesos.filter((p) => {
      const cnt = conteos.procesos[p] || 0;
      const pNorm = this.removerTildes(p);
      const seleccionado = Array.from(this.estado.procesos).some((sel) => this.removerTildes(sel) === pNorm);
      return cnt > 0 || seleccionado;
    });

    const tiposDocVisibles = todosTiposDoc.filter((t) => {
      const cnt = conteos.tiposDocumento[t] || 0;
      const tNorm = this.removerTildes(t);
      const seleccionado = Array.from(this.estado.tiposDocumento).some((sel) => this.removerTildes(sel) === tNorm);
      return cnt > 0 || seleccionado;
    });

    return {
      tiposProceso: tiposProcesoVisibles,
      areas: areasVisibles,
      procesos: procesosVisibles,
      carpetas: procesosVisibles,
      tiposDocumento: tiposDocVisibles,
      conteos
    };
  }

  obtenerEtiquetasActivas() {
    const etiquetas = [];

    if (this.estado.busqueda) {
      etiquetas.push({
        categoria: 'busqueda',
        valor: this.estado.busqueda,
        label: `Búsqueda: "${this.estado.busqueda}"`
      });
    }

    if (this.estado.soloFavoritos) {
      etiquetas.push({
        categoria: 'favoritos',
        valor: 'true',
        label: '⭐ Solo Favoritos'
      });
    }

    if (this.estado.soloTop10) {
      etiquetas.push({
        categoria: 'top10',
        valor: 'true',
        label: '🔥 Top 10 Más Consultados'
      });
    }

    if (this.estado.formato && this.estado.formato !== 'TODOS') {
      etiquetas.push({
        categoria: 'formato',
        valor: this.estado.formato,
        label: `Formato: ${this.estado.formato}`
      });
    }

    this.estado.tiposProceso.forEach((tp) => {
      etiquetas.push({ categoria: 'tipoProceso', valor: tp, label: `Tipo de proceso: ${tp}` });
    });

    this.estado.areas.forEach((a) => {
      etiquetas.push({ categoria: 'area', valor: a, label: `Área: ${a}` });
    });

    this.estado.procesos.forEach((p) => {
      etiquetas.push({ categoria: 'proceso', valor: p, label: `Proceso: ${p}` });
    });

    this.estado.tiposDocumento.forEach((t) => {
      etiquetas.push({ categoria: 'tipo', valor: t, label: `Tipo doc.: ${t}` });
    });

    return etiquetas;
  }

  tieneFiltrosSecundariosActivos() {
    return Boolean(
      (this.estado.busqueda && this.estado.busqueda.trim()) ||
      (this.estado.formato && this.estado.formato !== 'TODOS') ||
      this.estado.tiposProceso.size > 0 ||
      this.estado.areas.size > 0 ||
      this.estado.procesos.size > 0 ||
      this.estado.tiposDocumento.size > 0
    );
  }

  limpiarFiltrosSecundarios() {
    this.estado.busqueda = '';
    this.estado.formato = 'TODOS';
    this.estado.tiposProceso.clear();
    this.estado.areas.clear();
    this.estado.procesos.clear();
    this.estado.tiposDocumento.clear();
  }

  /**
   * Obtiene los documentos aplicando todos los filtros activos excepto la barra de búsqueda de texto
   */
  obtenerDocumentosFiltradosSinBusqueda(documentos, authService = null, favoritosSet = null, top10Set = null) {
    return this.obtenerDocumentosFiltradosExcepto(documentos, 'busqueda', authService, favoritosSet, top10Set);
  }

  /**
   * Aplica todos los filtros al conjunto de documentos
   */
  filtrar(documentos, authService, favoritosSet = null, top10Set = null, top10RankingMap = null) {
    let filtrados = this.obtenerDocumentosFiltradosSinBusqueda(documentos, authService, favoritosSet, top10Set);

    // Búsqueda inteligente multi-palabra insensible a mayúsculas y tildes
    if (this.estado.busqueda) {
      const busquedaNorm = this.removerTildes(this.estado.busqueda);
      const palabras = busquedaNorm.split(/\s+/).filter(Boolean);
      filtrados = filtrados.filter((doc) => {
        const textoDoc = this.removerTildes(`${doc.codigo || ''} ${doc.titulo || ''} ${doc.tipoProceso || ''} ${doc.area || ''} ${doc.proceso || ''} ${doc.tipoDocumento || ''} ${doc.formato || ''} ${doc.descripcion || ''} ${doc.extension || ''}`);
        return palabras.every((p) => textoDoc.includes(p));
      });
    }

    // 9. Ordenamiento (Prioridad a Top 10 por número de descargas si está activo)
    if (this.estado.soloTop10 && top10RankingMap) {
      filtrados.sort((a, b) => {
        const rA = top10RankingMap.get(a.id) || 999;
        const rB = top10RankingMap.get(b.id) || 999;
        if (rA !== rB) return rA - rB;
        return (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true });
      });
      return filtrados;
    }

    filtrados.sort((a, b) => {
      switch (this.estado.ordenamiento) {
        case 'codigo-asc':
          return a.codigo.localeCompare(b.codigo, 'es', { numeric: true });
        case 'codigo-desc':
          return b.codigo.localeCompare(a.codigo, 'es', { numeric: true });
        case 'titulo-asc':
          return a.titulo.localeCompare(b.titulo, 'es');
        case 'titulo-desc':
          return b.titulo.localeCompare(a.titulo, 'es');
        case 'fecha-desc':
        case 'modificacion-desc': {
          const tA = this.parsearFecha(a.modificacion);
          const tB = this.parsearFecha(b.modificacion);
          return tB - tA;
        }
        case 'fecha-asc':
        case 'modificacion-asc': {
          const tA = this.parsearFecha(a.modificacion);
          const tB = this.parsearFecha(b.modificacion);
          return tA - tB;
        }
        default:
          return 0;
      }
    });

    return filtrados;
  }

  parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === 'N/A') return 0;
    try {
      const partesEspacio = fechaStr.trim().split(' ');
      const partesFecha = partesEspacio[0].split('/');
      if (partesFecha.length === 3) {
        const dia = parseInt(partesFecha[0], 10);
        const mes = parseInt(partesFecha[1], 10) - 1;
        const anio = parseInt(partesFecha[2], 10);
        let horas = 0, minutos = 0, segundos = 0;
        if (partesEspacio.length > 1) {
          const partesHora = partesEspacio[1].split(':');
          if (partesHora.length >= 2) {
            horas = parseInt(partesHora[0], 10) || 0;
            minutos = parseInt(partesHora[1], 10) || 0;
            segundos = parseInt(partesHora[2], 10) || 0;
          }
        }
        return new Date(anio, mes, dia, horas, minutos, segundos).getTime();
      }
      const d = new Date(fechaStr).getTime();
      return isNaN(d) ? 0 : d;
    } catch {
      return 0;
    }
  }
}

export const filterEngine = new FilterEngine();
