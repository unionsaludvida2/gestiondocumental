#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de Actualización y Sincronización Universal de Cachés para GitHub
Unión para la salud y la vida S.A.S.

Descarga y sincroniza todos los archivos de datos estáticos desde la nube:
  1. repositorio.dat            <- OneDrive REPOSITORIO_DOCUMENTAL.csv
  2. usuarios.conf              <- Google Apps Script (Deep Merge Seguro)
  3. auditoria.dat              <- Google Drive / Apps Script (Append-Only)
  4. Historico_Documentos_USV.csv <- Google Drive / Apps Script (Deduplicación histórica)
  5. maestro.dat                <- Google Drive (Tablas Maestras)
  6. google_sheets_live.csv     <- Google Sheets Biblioteca
"""

import os
import sys
import json
import time
import csv
import io
import ssl
import http.cookiejar
import urllib.request
import server

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

SSL_CONTEXT = server.SSL_CONTEXT

def fetch_url(url, timeout=20, use_cookies=False):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    opener = None
    if use_cookies:
        cj = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=SSL_CONTEXT) if SSL_CONTEXT else urllib.request.HTTPSHandler(),
            urllib.request.HTTPCookieProcessor(cj)
        )
    else:
        opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=SSL_CONTEXT) if SSL_CONTEXT else urllib.request.HTTPSHandler()
        )
    with opener.open(req, timeout=timeout) as resp:
        return resp.read()

def sync_repositorio():
    print("[1/6] Sincronizando repositorio.dat desde OneDrive...")
    raw = fetch_url(server.ONEDRIVE_CSV_URL, timeout=25, use_cookies=True)
    if len(raw) < 100:
        raise ValueError("Respuesta de OneDrive vacía o insuficiente.")
    csv_text = raw.decode('utf-8-sig', errors='replace')
    reader = csv.reader(io.StringIO(csv_text), delimiter=';')
    rows = [r for r in reader if r and len(r) >= 2]
    
    items = []
    for r in rows[1:]:
        if not r or not r[0].strip():
            continue
        codigo = r[0].strip()
        documento = r[1].strip() if len(r) > 1 else ''
        extension = r[2].strip() if len(r) > 2 else ''
        carpeta = r[3].strip() if len(r) > 3 else ''
        tipo_doc = r[4].strip() if len(r) > 4 else ''
        mod = r[5].strip() if len(r) > 5 else ''
        edicion = r[6].strip() if len(r) > 6 else ''
        descarga = r[7].strip() if len(r) > 7 else ''

        ext_clean = extension.lstrip('.').lower()
        formato = 'Word' if ext_clean in ['docx', 'doc'] else ('Excel' if ext_clean in ['xlsx', 'xls', 'csv'] else ('PDF' if ext_clean == 'pdf' else ext_clean.upper()))

        items.append({
            'codigo': codigo,
            'titulo': documento,
            'documento': documento,
            'extension': extension,
            'formato': formato,
            'carpeta': carpeta,
            'proceso': carpeta,
            'tipoDocumento': tipo_doc,
            'modificacion': mod,
            'vinculoEdicion': edicion,
            'vinculoDescarga': descarga,
            'sharepointUrl': edicion or descarga,
            'downloadUrl': descarga or edicion,
            'disponible': bool(descarga or edicion)
        })

    res_obj = {
        'version': '1.0',
        'empresa': 'Unión para la salud y la vida S.A.S.',
        'ultimaActualizacion': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'total': len(items),
        'documentos': items
    }

    with open('repositorio.dat', 'w', encoding='utf-8') as f:
        json.dump(res_obj, f, ensure_ascii=False, indent=2)

    print(f"  ✅ repositorio.dat generado con éxito: {len(items)} documentos ({os.path.getsize('repositorio.dat'):,} bytes).")
    return len(items)

def sync_usuarios_conf():
    print("[2/6] Sincronizando usuarios.conf desde la nube...")
    raw = None
    try:
        raw = fetch_url(server.GOOGLE_SCRIPT_CONF_URL, timeout=12)
    except Exception as e:
        print(f"  ℹ️ Apps Script no respondió a tiempo ({e}), consultando Google Drive directo...")
        url_drive = 'https://drive.google.com/uc?export=download&id=1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl'
        raw = fetch_url(url_drive, timeout=15)
        
    cloud_conf = json.loads(raw.decode('utf-8'))
    
    local_conf = {}
    if os.path.exists('usuarios.conf'):
        try:
            with open('usuarios.conf', 'r', encoding='utf-8') as f:
                local_conf = json.load(f)
        except Exception:
            local_conf = {}

    merged_conf = {**local_conf, **cloud_conf}
    merged_conf['usuariosRegistrados'] = {
        **(local_conf.get('usuariosRegistrados') or {}),
        **(cloud_conf.get('usuariosRegistrados') or {})
    }
    merged_conf['favoritosPorUsuario'] = {
        **(local_conf.get('favoritosPorUsuario') or {}),
        **(cloud_conf.get('favoritosPorUsuario') or {})
    }
    merged_conf['mapeoPerfilesPersonalizados'] = {
        **(local_conf.get('mapeoPerfilesPersonalizados') or {}),
        **(cloud_conf.get('mapeoPerfilesPersonalizados') or {})
    }
    merged_conf['preferenciasPorUsuario'] = {
        **(local_conf.get('preferenciasPorUsuario') or {}),
        **(cloud_conf.get('preferenciasPorUsuario') or {})
    }
    if cloud_conf.get('ordenamientoGlobal') or local_conf.get('ordenamientoGlobal'):
        merged_conf['ordenamientoGlobal'] = cloud_conf.get('ordenamientoGlobal') or local_conf.get('ordenamientoGlobal')

    merged_conf = server.sanitizar_conf(merged_conf)

    # Limpiar claves desacopladas
    merged_conf.pop('historicoDocumental', None)
    merged_conf.pop('registroAuditoria', None)
    merged_conf.pop('tablasMaestras', None)
    merged_conf.pop('auditoria', None)

    with open('usuarios.conf', 'w', encoding='utf-8') as f:
        json.dump(merged_conf, f, indent=2, ensure_ascii=False)

    total_usr = len(merged_conf.get('usuariosRegistrados', {}))
    total_perf = len(merged_conf.get('mapeoPerfilesPersonalizados', {}))
    print(f"  ✅ usuarios.conf sincronizado con éxito: {total_usr} usuarios registrados, {total_perf} perfiles personalizados ({os.path.getsize('usuarios.conf'):,} bytes).")
    return total_usr

def sync_auditoria():
    print("[3/6] Sincronizando auditoria.dat desde Google Drive / Cloud...")
    raw = None
    try:
        raw = fetch_url(server.GOOGLE_DRIVE_AUDITORIA_URL, timeout=15)
    except Exception as e_drv:
        print(f"  ℹ️ Google Drive directo falló ({e_drv}), intentando Apps Script...")
        raw = fetch_url(f"{server.GOOGLE_SCRIPT_CONF_URL}?action=auditoria", timeout=20)
        
    cloud_data = json.loads(raw.decode('utf-8'))
    
    local_data = {"version": "1.0", "registroAuditoria": []}
    if os.path.exists('auditoria.dat'):
        try:
            with open('auditoria.dat', 'r', encoding='utf-8') as f:
                local_data = json.load(f)
        except Exception:
            pass

    local_evs = local_data.get('registroAuditoria') or []
    cloud_evs = cloud_data.get('registroAuditoria') or []

    sanitized_local = [server.sanitizar_evento_auditoria(e) for e in local_evs if isinstance(e, dict)]
    sanitized_cloud = [server.sanitizar_evento_auditoria(e) for e in cloud_evs if isinstance(e, dict)]

    map_aud = {}
    for ev in (sanitized_cloud + sanitized_local):
        k = ev.get('id') or f"{ev.get('tipo')}_{ev.get('identificacion') or ev.get('usuario')}_{ev.get('documentoCodigo')}_{ev.get('fechaHora') or ev.get('timestamp')}"
        map_aud[k] = ev

    merged_list = server.deduplicar_registro_auditoria(list(map_aud.values()))

    res_obj = {
        "version": "1.0",
        "empresa": "Unión para la salud y la vida S.A.S.",
        "ultimaActualizacion": cloud_data.get('ultimaActualizacion') or time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        "registroAuditoria": merged_list
    }

    with open('auditoria.dat', 'w', encoding='utf-8') as f:
        json.dump(res_obj, f, ensure_ascii=False, indent=2)

    print(f"  ✅ auditoria.dat consolidado (Append-Only): {len(merged_list)} eventos de auditoría ({os.path.getsize('auditoria.dat'):,} bytes).")
    return len(merged_list)

def sync_historico():
    print("[4/6] Sincronizando Historico_Documentos_USV.csv...")
    lista_local = server.leer_historico_csv()
    
    cloud_list = []
    try:
        url_hist = 'https://drive.google.com/uc?export=download&id=1dsnwbq3qDwDnbz7QtcZf374M5ltucB8m'
        raw = fetch_url(url_hist, timeout=15)
        txt = raw.decode('utf-8-sig', errors='replace')
        reader = csv.reader(io.StringIO(txt), delimiter=';')
        raw_headers = next(reader, None)
        if raw_headers:
            headers = [h.strip() for h in raw_headers]
            for row in reader:
                if row and len(row) >= 2:
                    obj = {headers[c]: row[c].strip() for c in range(min(len(headers), len(row)))}
                    sani = server.sanitizar_registro_historico(obj)
                    if sani:
                        cloud_list.append(sani)
    except Exception as e:
        print(f"  ⚠️ Aviso descargando histórico cloud adicional: {e}")

    map_h = {}
    for h in (lista_local + cloud_list):
        sani = server.sanitizar_registro_historico(h)
        if sani and (sani.get('codigo') or sani.get('id')):
            k = sani.get('id') or f"{sani.get('codigo')}_{sani.get('tipoEvento')}_{sani.get('fechaHora')}"
            map_h[k] = sani

    lista_final = list(map_h.values())
    lista_final.sort(key=lambda x: server.parsear_fecha_ms(x.get('fechaHora') or x.get('fechaModificacionActual') or x.get('timestamp')), reverse=True)
    server.guardar_historico_csv(lista_final)

    print(f"  ✅ Historico_Documentos_USV.csv consolidado: {len(lista_final)} registros históricos ({os.path.getsize('Historico_Documentos_USV.csv'):,} bytes).")
    return len(lista_final)

def sync_maestro():
    print("[5/6] Sincronizando maestro.dat desde Google Drive...")
    raw = fetch_url(server.GOOGLE_DRIVE_MAESTRO_URL, timeout=15)
    data = json.loads(raw.decode('utf-8'))
    if 'tablasMaestras' in data:
        with open('maestro.dat', 'wb') as f:
            f.write(raw)
        print(f"  ✅ maestro.dat sincronizado con éxito ({os.path.getsize('maestro.dat'):,} bytes).")
    return len(raw)

def sync_google_sheets():
    print("[6/6] Sincronizando google_sheets_live.csv desde Google Sheets...")
    raw = fetch_url(server.GOOGLE_SHEETS_CSV_URL, timeout=15)
    if len(raw) > 100 and (b',' in raw or b';' in raw):
        with open('google_sheets_live.csv', 'wb') as f:
            f.write(raw)
        print(f"  ✅ google_sheets_live.csv sincronizado con éxito ({os.path.getsize('google_sheets_live.csv'):,} bytes).")
    return len(raw)

def main():
    print("=" * 60)
    print("  INICIANDO ACTUALIZACIÓN INTEGRAL DE DATOS CACHÉ (SGC)")
    print("=" * 60)
    
    total_docs = sync_repositorio()
    total_usr = sync_usuarios_conf()
    total_aud = sync_auditoria()
    total_hist = sync_historico()
    sync_maestro()
    sync_google_sheets()

    print("=" * 60)
    print("  RESUMEN DE SINCRONIZACIÓN EXITOSA:")
    print(f"  • repositorio.dat:            {total_docs} documentos (OneDrive)")
    print(f"  • usuarios.conf:              {total_usr} usuarios / credenciales activas")
    print(f"  • auditoria.dat:              {total_aud} registros Append-Only inmutables")
    print(f"  • Historico_Documentos_USV.csv: {total_hist} eventos de control de cambios")
    print(f"  • maestro.dat:                Tablas maestras institucionales")
    print(f"  • google_sheets_live.csv:     Copia local espejo Google Sheets")
    print("=" * 60)
    print("⚡ Todos los archivos de caché están listos y actualizados para el commit/push a GitHub.")

if __name__ == '__main__':
    main()
