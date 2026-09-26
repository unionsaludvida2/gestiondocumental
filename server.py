"""
Servidor Local de Desarrollo con Proxy Sincronico en Tiempo Real para OneDrive / SharePoint
Union para la salud y la vida S.A.S.
"""

import http.server
import http.cookiejar
import urllib.request
import os
import sys
import json
import base64
import re

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

ONEDRIVE_CSV_URL = (
    "https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/"
    "IQCctVunBodCQq97XWMPrue7AaIRpd-pVgSUuZrMBWBcA2A?e=revQbX&download=1"
)

ONEDRIVE_EMPLEADOS_URL = (
    "https://unionsaludvida-my.sharepoint.com/:x:/p/plantillas/"
    "IQDMt48585E1SJdtmCVBFpflAYIlEtWpENmxdj6ow3J3AR0?e=yLjbNy&download=1"
)

GOOGLE_SCRIPT_CONF_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbx4-82Ls3Zu5gdzXlAhezZ6ew9tnAece8xSDMQ8QmXcu7UCnMxwqB48ISG_LwNDUgMiQQ/exec"
)

GOOGLE_SHEETS_CSV_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1EOcucjQV4byUOp_AAfd1ySHk4tVdFmMeOoOQsSBbEa4/export?format=csv"
)


GOOGLE_DRIVE_AUDITORIA_URL = (
    "https://drive.google.com/uc?export=download&id=1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR"
)

GOOGLE_DRIVE_MAESTRO_URL = (
    "https://drive.google.com/uc?export=download&id=1NycmHFf8iAko2XsHIi9dmfe-lK6utpek"
)


def normalizar_version(ver):
    if ver is None:
        return '1'
    import re
    s = str(ver).strip()
    if not s or s in ('N/A', 'null', 'undefined'):
        return '1'
    if 'retirado' in s.lower() or 'obsoleto' in s.lower():
        return s
    s = re.sub(r'^v', '', s, flags=re.IGNORECASE).strip()
    if re.match(r'^\d+$', s):
        try:
            return str(int(s))
        except:
            return s
    if re.match(r'^\d+(\.\d+)+$', s):
        parts = s.split('.')
        clean_parts = []
        for p in parts:
            try:
                clean_parts.append(str(int(p)))
            except:
                clean_parts.append(p)
        return '.'.join(clean_parts)
    clean = re.sub(r'^0+(?=\d)', '', s)
    return clean or '1'


def son_versiones_iguales(v1, v2):
    if not v1 and not v2:
        return True
    n1 = normalizar_version(v1)
    n2 = normalizar_version(v2)
    if n1 == n2:
        return True
    try:
        if float(n1) == float(n2):
            return True
    except:
        pass
    return False


def parsear_fecha_ms(str_val):
    if not str_val:
        return 0
    import re
    from datetime import datetime
    s = str(str_val).strip()
    if not s or s in ('N/A', 'Sincronizado', 'null', 'undefined'):
        return 0
    s = s.replace('\u202f', ' ').replace('\xa0', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    if 'T' in s or re.match(r'^\d{4}-\d{2}-\d{2}', s):
        try:
            dt = datetime.fromisoformat(s.replace('Z', ''))
            return int(dt.timestamp() * 1000)
        except:
            pass
    if re.match(r'^\d{12,14}$', s):
        try:
            return int(s)
        except:
            pass
    matchLatam = re.match(r'^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?)?', s, re.I)
    if matchLatam:
        dia = int(matchLatam.group(1))
        mes = int(matchLatam.group(2))
        anio = int(matchLatam.group(3))
        hora = int(matchLatam.group(4)) if matchLatam.group(4) else 0
        minuto = int(matchLatam.group(5)) if matchLatam.group(5) else 0
        seg = int(matchLatam.group(6)) if matchLatam.group(6) else 0
        ampm = (matchLatam.group(7) or '').lower().replace('.', '').replace(' ', '')
        if ampm == 'pm' and hora < 12: hora += 12
        if ampm == 'am' and hora == 12: hora = 0
        try:
            dt = datetime(anio, mes, dia, hora, minuto, seg)
            return int(dt.timestamp() * 1000)
        except:
            pass
    return 0


def formatear_fecha_hora(val):
    if not val or val in ('N/A', 'Sincronizado', 'null', 'undefined'):
        return val if val == 'Sincronizado' else 'N/A'
    ms = parsear_fecha_ms(val)
    if not ms or ms <= 0:
        return str(val).strip()
    from datetime import datetime
    dt = datetime.fromtimestamp(ms / 1000)
    return dt.strftime('%d/%m/%Y %H:%M:%S')


import time
import threading
import csv

HISTORICO_CSV_PATH = 'Historico_Documentos_USV.csv'
HISTORICO_CSV_HEADERS = [
    'id', 'tipoEvento', 'codigo', 'titulo', 'versionAnterior', 'versionNueva',
    'rutaAnterior', 'rutaNueva', 'tipoAnterior', 'tipoNuevo', 'usuario',
    'identificacion', 'cargo', 'perfil', 'detalle', 'fechaModificacionPrevia',
    'fechaModificacionActual', 'sharepointUrl', 'fechaHora', 'timestamp'
]

def leer_historico_csv():
    if not os.path.exists(HISTORICO_CSV_PATH):
        return []
    lista = []
    try:
        with open(HISTORICO_CSV_PATH, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                if row and (row.get('codigo') or row.get('id')):
                    lista.append(row)
    except Exception as e:
        print("[Server.py] Error leyendo Historico CSV:", e)
    return lista

def guardar_historico_csv(lista):
    try:
        with open(HISTORICO_CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=HISTORICO_CSV_HEADERS, delimiter=';', extrasaction='ignore')
            writer.writeheader()
            for row in lista:
                writer.writerow(row)
    except Exception as e:
        print("[Server.py] Error escribiendo Historico CSV:", e)

WORD_CONVERT_LOCK = threading.Lock()
PDF_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pdf_cache')

def obtener_o_convertir_pdf(url_original, codigo, titulo=""):
    """
    Convierte documentos DOCX de SharePoint Online directamente a PDF en segundo plano
    utilizando Microsoft Word COM en Windows y almacenamiento en caché ultrarrápido (<1 ms).
    """
    try:
        os.makedirs(PDF_CACHE_DIR, exist_ok=True)
    except Exception:
        pass

    clean_code = re.sub(r'[/\\?%*:|"<> ]', '_', codigo or '').strip() or 'DOC'
    cache_file = os.path.join(PDF_CACHE_DIR, f"{clean_code}.pdf")

    # 1. Si ya existe en caché con tamaño válido (> 1000 bytes), retornar de inmediato
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
        try:
            with open(cache_file, 'rb') as f:
                return f.read()
        except Exception as e_read:
            print(f"[Server.py] Error leyendo caché PDF {clean_code}:", e_read)

    # 2. Conversión nativa mediante Microsoft Word COM en Windows (SSO integrado con SharePoint)
    with WORD_CONVERT_LOCK:
        if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
            try:
                with open(cache_file, 'rb') as f:
                    return f.read()
            except Exception:
                pass

        try:
            import pythoncom
            import win32com.client
            pythoncom.CoInitialize()
            word = None
            try:
                word = win32com.client.Dispatch('Word.Application')
                word.Visible = False
                word.DisplayAlerts = 0
                doc = word.Documents.Open(url_original, ReadOnly=True)
                # 17 = wdFormatPDF
                doc.SaveAs(cache_file, FileFormat=17)
                doc.Close(False)
                print(f"[Server.py] ✅ Documento {codigo} convertido exitosamente a PDF con Word COM ({os.path.getsize(cache_file)} bytes).")
            finally:
                if word:
                    try:
                        word.Quit()
                    except Exception:
                        pass
                pythoncom.CoUninitialize()

            if os.path.exists(cache_file) and os.path.getsize(cache_file) > 1000:
                with open(cache_file, 'rb') as f:
                    return f.read()
        except Exception as e_conv:
            print(f"[Server.py] Error en conversión Word COM para {codigo}:", e_conv)

    return None

# Caché en memoria para respuesta instantánea (< 1 ms)
CACHE = {
    'repo': {'data': None, 'ts': 0, 'fetching': False},
    'biblioteca': {'data': None, 'ts': 0, 'fetching': False},
    'empleados': {'data': None, 'ts': 0, 'fetching': False},
    'config': {'data': None, 'ts': 0, 'fetching': False},
    'auditoria': {'data': None, 'ts': 0, 'fetching': False},
    'maestras': {'data': None, 'ts': 0, 'fetching': False},
    'historico': {'data': None, 'ts': 0, 'fetching': False},
}


def deduplicar_registro_auditoria(lista_aud):
    if not isinstance(lista_aud, list):
        return []
    purgados = [ev for ev in lista_aud if isinstance(ev, dict)]
    purgados.sort(key=lambda x: parsear_fecha_ms(x.get('fechaHora') or x.get('timestamp')), reverse=True)

    resultado = []
    for ev in purgados:
        if not resultado:
            resultado.append(ev)
            continue
        ant = resultado[-1]
        ms_actual = parsear_fecha_ms(ev.get('fechaHora') or ev.get('timestamp'))
        ms_ant = parsear_fecha_ms(ant.get('fechaHora') or ant.get('timestamp'))

        mismo_id = ev.get('id') and ant.get('id') and ev.get('id') == ant.get('id')
        mismo_usr = str(ev.get('identificacion') or ev.get('usuario') or '').strip().lower() == str(ant.get('identificacion') or ant.get('usuario') or '').strip().lower()
        mismo_tipo = str(ev.get('tipo') or '').strip().upper() == str(ant.get('tipo') or '').strip().upper()
        mismo_doc = str(ev.get('documentoCodigo') or '').strip().upper() == str(ant.get('documentoCodigo') or '').strip().upper()
        mismo_det = str(ev.get('detalle') or '').strip().lower() == str(ant.get('detalle') or '').strip().lower()

        es_duplicado_temporal = mismo_usr and mismo_tipo and (mismo_doc or mismo_det or mismo_tipo == 'LOGIN') and abs(ms_ant - ms_actual) < 10000

        if not mismo_id and not es_duplicado_temporal:
            resultado.append(ev)

    return resultado


FECHA_CORTE_PURGA_MS = 1788020640000  # 29/08/2026 11:24:00


def sanitizar_conf(conf_dict):
    if not isinstance(conf_dict, dict):
        return conf_dict
    if 'historicoDocumental' in conf_dict and isinstance(conf_dict['historicoDocumental'], list):
        lista_hist = []
        for h in conf_dict['historicoDocumental']:
            if not isinstance(h, dict):
                continue
            va = h.get('versionAnterior')
            vn = h.get('versionNueva')
            tipo = (h.get('tipoEvento') or '').upper()
            det = (h.get('detalle') or '')
            r_nue = h.get('rutaNueva') or ''
            r_ant = h.get('rutaAnterior') or ''
            t_ant = h.get('tipoAnterior') or ''
            if tipo == 'CREACION' and not h.get('codigo'):
                continue
            if 'Reubicación de ruta' in det or 'Intranet' in r_nue or 'Intranet' in r_ant:
                continue
            if 'PC de GIC' in det or 'PC de GIC' in r_nue or 'PC de GIC' in r_ant:
                continue
            if tipo == 'CAMBIO_TIPO' and len(t_ant) <= 4 and t_ant.isupper():
                continue
            if 'Cambio de tipo documental' in det and len(t_ant) <= 4:
                continue
            if r_ant == 'N/A' and ('/ Intranet' in r_nue or '/ N/A' in r_nue):
                continue
            if tipo == 'CAMBIO_VERSION' and son_versiones_iguales(va, vn):
                continue
            clean_h = dict(h)
            if va and va != 'N/A':
                clean_h['versionAnterior'] = normalizar_version(va)
            if vn and vn != 'N/A':
                clean_h['versionNueva'] = normalizar_version(vn)
            if clean_h.get('fechaHora'):
                clean_h['fechaHora'] = formatear_fecha_hora(clean_h['fechaHora'])
            if clean_h.get('fechaModificacionActual'):
                clean_h['fechaModificacionActual'] = formatear_fecha_hora(clean_h['fechaModificacionActual'])
            if clean_h.get('fechaModificacionPrevia'):
                clean_h['fechaModificacionPrevia'] = formatear_fecha_hora(clean_h['fechaModificacionPrevia'])
            lista_hist.append(clean_h)
        conf_dict['historicoDocumental'] = lista_hist
    return conf_dict


def _trigger_background_repo_sync():
    if CACHE['repo']['fetching']:
        return
    CACHE['repo']['fetching'] = True

    def _worker():
        try:
            # 1. Prioridad #1: Descargar directamente REPOSITORIO_DOCUMENTAL.csv desde OneDrive / SharePoint
            try:
                cj = http.cookiejar.CookieJar()
                opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
                opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]
                with opener.open(ONEDRIVE_CSV_URL, timeout=15) as resp:
                    d = resp.read()
                if len(d) > 100 and (b';' in d or b',' in d):
                    CACHE['repo']['data'] = d
                    CACHE['repo']['ts'] = time.time()
                    try:
                        with open("REPOSITORIO_DOCUMENTAL.csv", "wb") as f:
                            f.write(d)
                        print(f"[Server.py] ✅ REPOSITORIO_DOCUMENTAL.csv de OneDrive sincronizado ({len(d)} bytes).")
                    except Exception as e_write:
                        print("[Server.py] Error al escribir REPOSITORIO_DOCUMENTAL.csv:", e_write)
                    return
            except Exception as e_od:
                print("[Server.py] Error descargando OneDrive CSV:", e_od)

            # 2. Fallback: Google Sheets si OneDrive no responde
            try:
                req = urllib.request.Request(GOOGLE_SHEETS_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=8) as resp:
                    d = resp.read()
                if len(d) > 100 and (b',' in d or b';' in d):
                    CACHE['repo']['data'] = d
                    CACHE['repo']['ts'] = time.time()
                    return
            except Exception:
                pass
        finally:
            CACHE['repo']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_biblioteca_sync():
    if CACHE['biblioteca']['fetching']:
        return
    CACHE['biblioteca']['fetching'] = True

    def _worker():
        try:
            req = urllib.request.Request(GOOGLE_SHEETS_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=12) as resp:
                d = resp.read()
            if len(d) > 100 and (b',' in d or b';' in d):
                CACHE['biblioteca']['data'] = d
                CACHE['biblioteca']['ts'] = time.time()
                print(f"[Server.py] ✅ Biblioteca (Google Sheets) sincronizada ({len(d)} bytes).")
        except Exception as e:
            print("[Server.py] Error sincronizando Biblioteca GS:", e)
        finally:
            CACHE['biblioteca']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_empleados_sync():
    if CACHE['empleados']['fetching']:
        return
    CACHE['empleados']['fetching'] = True

    def _worker():
        try:
            cj = http.cookiejar.CookieJar()
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
            opener.addheaders = [('User-Agent', 'Mozilla/5.0')]
            resp = opener.open(ONEDRIVE_EMPLEADOS_URL, timeout=10)
            d = resp.read()
            if len(d) > 100:
                CACHE['empleados']['data'] = d
                CACHE['empleados']['ts'] = time.time()
                try:
                    with open("EMPLEADOS_ACTIVOS.csv", "wb") as f:
                        f.write(d)
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            CACHE['empleados']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_config_sync():
    if CACHE['config']['fetching']:
        return
    CACHE['config']['fetching'] = True

    def _worker():
        try:
            req_g = urllib.request.Request(
                GOOGLE_SCRIPT_CONF_URL,
                headers={'User-Agent': 'Mozilla/5.0'}
            )
            with urllib.request.urlopen(req_g, timeout=8) as resp:
                data = resp.read()
            if len(data) > 0 and data.strip().startswith(b'{'):
                cloud_conf = json.loads(data.decode('utf-8'))
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

                merged_conf = sanitizar_conf(merged_conf)

                # Remover claves desacopladas
                merged_conf.pop('historicoDocumental', None)
                merged_conf.pop('registroAuditoria', None)
                merged_conf.pop('tablasMaestras', None)
                merged_conf.pop('auditoria', None)

                try:
                    with open('usuarios.conf', 'w', encoding='utf-8') as f:
                        json.dump(merged_conf, f, indent=2, ensure_ascii=False)
                except Exception:
                    pass

                res_bytes = json.dumps(merged_conf, ensure_ascii=False).encode('utf-8')
                CACHE['config']['data'] = res_bytes
                CACHE['config']['ts'] = time.time()
        except Exception as err:
            print('[Server.py] Sync background config error:', err)
        finally:
            CACHE['config']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_historico_sync():
    if CACHE['historico']['fetching']:
        return
    CACHE['historico']['fetching'] = True

    def _worker():
        try:
            # 1. Cargar datos locales de Historico CSV si existen
            lista_local = leer_historico_csv()
            if lista_local:
                json_bytes = json.dumps({"status": "ok", "total": len(lista_local), "historicoDocumental": lista_local}, ensure_ascii=False).encode('utf-8')
                CACHE['historico']['data'] = json_bytes
                CACHE['historico']['ts'] = time.time()

            # 2. Consultar Google Apps Script (?action=historico)
            req = urllib.request.Request(f"{GOOGLE_SCRIPT_CONF_URL}?action=historico", headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = resp.read()
            if len(data) > 0 and data.strip().startswith(b'{'):
                cloud_data = json.loads(data.decode('utf-8'))
                cloud_list = cloud_data.get('historicoDocumental') or []
                if cloud_list and isinstance(cloud_list, list):
                    # Unir y deduplicar por id o tupla
                    map_h = {}
                    for h in (lista_local + cloud_list):
                        if isinstance(h, dict) and (h.get('codigo') or h.get('id')):
                            k = h.get('id') or f"{h.get('codigo')}_{h.get('tipoEvento')}_{h.get('fechaHora')}"
                            map_h[k] = h
                    lista_final = list(map_h.values())
                    lista_final.sort(key=lambda x: parsear_fecha_ms(x.get('fechaHora') or x.get('fechaModificacionActual') or x.get('timestamp')), reverse=True)
                    guardar_historico_csv(lista_final)
                    json_bytes = json.dumps({"status": "ok", "total": len(lista_final), "historicoDocumental": lista_final}, ensure_ascii=False).encode('utf-8')
                    CACHE['historico']['data'] = json_bytes
                    CACHE['historico']['ts'] = time.time()
                    print(f"[Server.py] ✅ Historico_Documentos_USV.csv sincronizado con Google Drive ({len(lista_final)} registros).")
        except Exception as err:
            print('[Server.py] Sync background historico error:', err)
        finally:
            CACHE['historico']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_auditoria_sync():
    if CACHE['auditoria']['fetching']:
        return
    CACHE['auditoria']['fetching'] = True

    def _worker():
        try:
            local_data = {"version": "1.0", "registroAuditoria": []}
            if os.path.exists('auditoria.dat'):
                try:
                    with open('auditoria.dat', 'r', encoding='utf-8') as f:
                        local_data = json.load(f)
                except Exception:
                    pass

            cloud_data = None
            # 1. Consultar Google Apps Script (?action=auditoria)
            try:
                req = urllib.request.Request(f"{GOOGLE_SCRIPT_CONF_URL}?action=auditoria", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    raw = resp.read()
                    if raw and raw.strip().startswith(b'{'):
                        cloud_data = json.loads(raw.decode('utf-8'))
            except Exception as e_script:
                pass

            # 2. Fallback a Google Drive directo si Apps Script falló
            if not cloud_data or not isinstance(cloud_data, dict) or not cloud_data.get('registroAuditoria'):
                try:
                    req_d = urllib.request.Request(GOOGLE_DRIVE_AUDITORIA_URL, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req_d, timeout=12) as resp_d:
                        raw_d = resp_d.read()
                        if raw_d and raw_d.strip().startswith(b'{'):
                            cloud_data = json.loads(raw_d.decode('utf-8'))
                except Exception as e_drive:
                    pass

            local_evs = local_data.get('registroAuditoria') or []
            cloud_evs = (cloud_data.get('registroAuditoria') or []) if isinstance(cloud_data, dict) else []

            # Unir y deduplicar por id o clave compuesta
            map_aud = {}
            for ev in (local_evs + cloud_evs):
                if isinstance(ev, dict):
                    k = ev.get('id') or f"{ev.get('tipo')}_{ev.get('identificacion') or ev.get('usuario')}_{ev.get('documentoCodigo')}_{ev.get('fechaHora') or ev.get('timestamp')}"
                    map_aud[k] = ev

            merged_list = deduplicar_registro_auditoria(list(map_aud.values()))

            res_obj = {
                "version": "1.0",
                "empresa": "Unión para la salud y la vida S.A.S.",
                "ultimaActualizacion": (cloud_data.get('ultimaActualizacion') if (isinstance(cloud_data, dict) and cloud_data.get('ultimaActualizacion')) else time.strftime('%Y-%m-%dT%H:%M:%SZ')),
                "registroAuditoria": merged_list
            }

            json_str = json.dumps(res_obj, ensure_ascii=False, indent=2)
            try:
                with open('auditoria.dat', 'w', encoding='utf-8') as f:
                    f.write(json_str)
            except Exception as e_w:
                print('[Server.py] Error escribiendo auditoria.dat:', e_w)

            json_bytes = json_str.encode('utf-8')
            CACHE['auditoria']['data'] = json_bytes
            CACHE['auditoria']['ts'] = time.time()
            print(f"[Server.py] ✅ auditoria.dat sincronizado con Google Drive ({len(merged_list)} registros totales, sin límite).")

            # Si localmente tenemos eventos que Google Drive no tenía, auto-reparar la nube
            if len(merged_list) > len(cloud_evs):
                aud_data_cloud = {**res_obj, 'accion': 'guardar_auditoria', 'fileId': '1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR'}
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, json.dumps(aud_data_cloud, ensure_ascii=False).encode('utf-8'))
                print(f"[Server.py] 🚀 Auto-reparando Google Drive con {len(merged_list)} eventos consolidados.")
        except Exception as e:
            print('[Server.py] Sync background auditoria error:', e)
        finally:
            CACHE['auditoria']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def _trigger_background_maestro_sync():
    if CACHE['maestras']['fetching']:
        return
    CACHE['maestras']['fetching'] = True

    def _worker():
        try:
            if os.path.exists('maestro.dat'):
                try:
                    with open('maestro.dat', 'rb') as f:
                        d = f.read()
                        if len(d) > 0 and d.strip().startswith(b'{'):
                            CACHE['maestras']['data'] = d
                            CACHE['maestras']['ts'] = time.time()
                except Exception:
                    pass
        except Exception as e:
            print('[Server.py] Sync background maestro error:', e)
        finally:
            CACHE['maestras']['fetching'] = False

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def sincronizar_con_google_async(url, payload_bytes):
    def _worker():
        try:
            req_g = urllib.request.Request(url, data=payload_bytes, method='POST')
            req_g.add_header('Content-Type', 'text/plain;charset=utf-8')
            opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
            opener.open(req_g, timeout=20)
        except Exception as e:
            print('[Server.py] Sincronización en la nube (background):', e)

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


class LiveOneDriveHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Pragma, Cache-Control')
        self.end_headers()

    def do_GET(self):
        # Endpoint institucional para descarga oficial en PDF (Word no-FMT) o formato nativo (FMT/Excel)
        if self.path.startswith('/api/descargar-pdf'):
            try:
                import urllib.parse
                parsed = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed.query)
                codigo = (params.get('codigo', [''])[0]).strip().upper()
                url_original = (params.get('url', [''])[0]).strip()
                titulo = (params.get('titulo', [''])[0]).strip()

                # 1. Si es formato FMT BASE (Word o Excel) o Excel general: Redirigir a descarga nativa original
                # NOTA: Los registros derivados / secundarios (incluso con prefijo FMT) NO son plantillas base y se descargan en PDF
                es_reg_param = (params.get('esRegistro', ['false'])[0]).strip().lower() == 'true'
                es_registro = es_reg_param or bool(re.search(r'-\d+$', codigo))
                es_fmt = (codigo.startswith('FMT-') or codigo.startswith('FMT_') or codigo.startswith('FMT ') or codigo == 'FMT') and not es_registro
                limpia_url = url_original.split('?')[0].lower()
                es_excel = limpia_url.endswith('.xlsx') or limpia_url.endswith('.xls')

                if es_fmt or es_excel:
                    self.send_response(302)
                    self.send_header('Location', url_original)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    return

                # 2. Si es Word no-FMT: Obtener o convertir a PDF localmente con Word COM
                nombre_base = f"{codigo} {titulo}".strip() if titulo else (codigo or "Documento")
                nombre_limpio = re.sub(r'[/\\?%*:|"<>]+', ' ', nombre_base).strip()
                nombre_archivo = f"{nombre_limpio}.pdf"

                pdf_bytes = obtener_o_convertir_pdf(url_original, codigo, titulo)
                if pdf_bytes and len(pdf_bytes) > 0:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/pdf')
                    self.send_header('Content-Disposition', f'attachment; filename="{nombre_archivo}"')
                    self.send_header('Content-Length', str(len(pdf_bytes)))
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Expose-Headers', 'Content-Disposition')
                    self.end_headers()
                    self.wfile.write(pdf_bytes)
                    return

                # Si falló la conversión local, fallback a redirección SharePoint REST v2.0
                if '/Documentos compartidos/' in url_original:
                    idx = url_original.index('/Documentos compartidos/')
                    site_base = url_original[:idx]
                    subpath = url_original[idx + len('/Documentos compartidos/'):].split('?')[0]
                    pdf_url = f"{site_base}/_api/v2.0/drive/root:/{subpath}:/content?format=pdf"
                    self.send_response(302)
                    self.send_header('Location', pdf_url)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    return

                self.send_response(302)
                self.send_header('Location', url_original)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                return
            except Exception as e_pdf:
                print("[Server.py] Error en /api/descargar-pdf:", e_pdf)
                self.send_response(500)
                self.end_headers()
                return

        # 1. Endpoint catálogo documental (Respuesta instantánea a <1ms desde caché)
        if self.path.startswith('/api/repositorio') or self.path.startswith('/api/documentos'):
            data = CACHE['repo']['data']
            if data is None and os.path.exists("REPOSITORIO_DOCUMENTAL.csv"):
                try:
                    with open("REPOSITORIO_DOCUMENTAL.csv", "rb") as f:
                        data = f.read()
                        CACHE['repo']['data'] = data
                        CACHE['repo']['ts'] = time.time()
                except Exception:
                    pass

            # Refrescar en background si tiene más de 90 segundos o si es la primera vez
            if CACHE['repo']['data'] is None or (time.time() - CACHE['repo']['ts'] > 90) or 'forzar=true' in self.path:
                _trigger_background_repo_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Length', '0')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        # 1.1 Endpoint Biblioteca Google Sheets
        if self.path.startswith('/api/biblioteca'):
            data = CACHE['biblioteca']['data']
            if CACHE['biblioteca']['data'] is None or (time.time() - CACHE['biblioteca']['ts'] > 60) or 'forzar=true' in self.path:
                _trigger_background_biblioteca_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Length', '0')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        # 2. Endpoint empleados activos (Respuesta instantánea a <1ms desde caché)
        if self.path.startswith('/api/empleados'):
            data = CACHE['empleados']['data']
            if data is None and os.path.exists("EMPLEADOS_ACTIVOS.csv"):
                try:
                    with open("EMPLEADOS_ACTIVOS.csv", "rb") as f:
                        data = f.read()
                        CACHE['empleados']['data'] = data
                        CACHE['empleados']['ts'] = time.time()
                except Exception:
                    pass

            if CACHE['empleados']['data'] is None or (time.time() - CACHE['empleados']['ts'] > 180) or 'forzar=true' in self.path:
                _trigger_background_empleados_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            self.send_response(200)
            self.send_header('Content-Type', 'text/csv; charset=utf-8')
            self.send_header('Content-Length', '0')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            return

        # 3. Endpoint configuración usuarios.conf (Respuesta instantánea y siempre actualizada desde disco)
        if self.path.startswith('/api/configuracion'):
            data = None
            if os.path.exists('usuarios.conf'):
                try:
                    with open('usuarios.conf', 'rb') as f:
                        content = f.read()
                        if len(content) > 0 and content.strip().startswith(b'{'):
                            data = content
                            CACHE['config']['data'] = content
                            CACHE['config']['ts'] = time.time()
                except Exception:
                    pass

            if data is None:
                data = CACHE['config']['data']

            if CACHE['config']['data'] is None or 'forzar=true' in self.path:
                _trigger_background_config_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            empty_b = b'{}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(empty_b)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(empty_b)
            return

        # 4. Endpoint auditoria.dat
        if self.path.startswith('/api/auditoria'):
            now = time.time()
            data = CACHE['auditoria']['data']

            if data is None or 'forzar=true' in self.path or (now - CACHE['auditoria']['ts'] > 20):
                _trigger_background_auditoria_sync()

            if data is None and os.path.exists('auditoria.dat'):
                try:
                    with open('auditoria.dat', 'rb') as f:
                        content = f.read()
                        if len(content) > 0 and content.strip().startswith(b'{'):
                            data = content
                            CACHE['auditoria']['data'] = content
                            CACHE['auditoria']['ts'] = now
                except Exception:
                    pass

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                self.wfile.write(data)
                return

            empty_aud = b'{"version":"1.0","registroAuditoria":[]}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(empty_aud)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.end_headers()
            self.wfile.write(empty_aud)
            return

        # 5. Endpoint maestro.dat (Tablas Maestras)
        if self.path.startswith('/api/maestras'):
            data = None
            if os.path.exists('maestro.dat'):
                try:
                    with open('maestro.dat', 'rb') as f:
                        content = f.read()
                        if len(content) > 0 and content.strip().startswith(b'{'):
                            data = content
                            CACHE['maestras']['data'] = content
                            CACHE['maestras']['ts'] = time.time()
                except Exception:
                    pass

            if data is None:
                data = CACHE['maestras']['data']

            if CACHE['maestras']['data'] is None or 'forzar=true' in self.path:
                _trigger_background_maestro_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            empty_maestras = b'{"version":"1.0","tablasMaestras":{"tiposDocumento":[],"tiposProceso":[],"areas":[]}}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(empty_maestras)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(empty_maestras)
            return

        # 6. Endpoint Historico_Documentos_USV.csv (Control de Cambios Documentales)
        if self.path.startswith('/api/historico') or self.path.startswith('/api/control-cambios'):
            data = None
            if os.path.exists(HISTORICO_CSV_PATH):
                try:
                    lista_local = leer_historico_csv()
                    if lista_local:
                        data = json.dumps({"status": "ok", "total": len(lista_local), "historicoDocumental": lista_local}, ensure_ascii=False).encode('utf-8')
                        CACHE['historico']['data'] = data
                        CACHE['historico']['ts'] = time.time()
                except Exception:
                    pass

            if data is None:
                data = CACHE['historico']['data']

            if CACHE['historico']['data'] is None or 'forzar=true' in self.path:
                _trigger_background_historico_sync()

            if data and len(data) > 0:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(data)
                return

            empty_hist = b'{"status":"ok","total":0,"historicoDocumental":[]}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(empty_hist)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(empty_hist)
            return

        return super().do_GET()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Pragma, Cache-Control')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        # 1. Endpoint para auditoria.dat
        if self.path.startswith('/api/auditoria'):
            try:
                import json
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                req_data = json.loads(body.decode('utf-8'))

                aud_data = {"version": "1.0", "registroAuditoria": []}
                if os.path.exists('auditoria.dat'):
                    try:
                        with open('auditoria.dat', 'r', encoding='utf-8') as f:
                            aud_data = json.load(f)
                    except Exception:
                        pass

                nuevos_evs = req_data.get('registroAuditoria') if isinstance(req_data, dict) and 'registroAuditoria' in req_data else ([req_data] if isinstance(req_data, dict) else [])
                if isinstance(nuevos_evs, list):
                    map_aud = {}
                    for ev in (aud_data.get('registroAuditoria') or []):
                        if isinstance(ev, dict) and ev.get('id'):
                            map_aud[ev['id']] = ev
                    for ev in nuevos_evs:
                        if isinstance(ev, dict) and ev.get('id'):
                            tipo = str(ev.get('tipo', '')).upper()
                            if tipo not in ['CONSULTA', 'BUSQUEDA', 'BUSCAR']:
                                map_aud[ev['id']] = ev
                    lista_aud = list(map_aud.values())
                    aud_data['registroAuditoria'] = deduplicar_registro_auditoria(lista_aud)

                aud_data['ultimaActualizacion'] = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                json_str = json.dumps(aud_data, ensure_ascii=False, indent=2)
                with open('auditoria.dat', 'w', encoding='utf-8') as f:
                    f.write(json_str)

                CACHE['auditoria']['data'] = json.dumps(aud_data, ensure_ascii=False).encode('utf-8')
                CACHE['auditoria']['ts'] = time.time()

                # Sincronizar con Google Drive en background con acción guardar_auditoria y fileId dedicado
                aud_data_cloud = {**aud_data, 'accion': 'guardar_auditoria', 'fileId': '1yNiuug2P-idZMUKkRb87DH_Mb3-Wn0hR'}
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, json.dumps(aud_data_cloud, ensure_ascii=False).encode('utf-8'))

                res_bytes = json_str.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(res_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_bytes)
                return
            except Exception as e:
                err_b = f'{{"error": "{str(e)}"}}\n'.encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_b)
                return

        # 2. Endpoint para maestro.dat (Tablas Maestras)
        if self.path.startswith('/api/maestras'):
            try:
                import json
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                req_data = json.loads(body.decode('utf-8'))

                maestras_data = {"version": "1.0", "tablasMaestras": {"tiposDocumento": [], "tiposProceso": [], "areas": []}}
                if os.path.exists('maestro.dat'):
                    try:
                        with open('maestro.dat', 'r', encoding='utf-8') as f:
                            maestras_data = json.load(f)
                    except Exception:
                        pass

                if isinstance(req_data, dict):
                    if 'tablasMaestras' in req_data and isinstance(req_data['tablasMaestras'], dict):
                        maestras_data['tablasMaestras'] = {
                            **(maestras_data.get('tablasMaestras') or {}),
                            **req_data['tablasMaestras']
                        }
                    else:
                        for k in ['tiposDocumento', 'tiposProceso', 'areas']:
                            if k in req_data:
                                if 'tablasMaestras' not in maestras_data:
                                    maestras_data['tablasMaestras'] = {}
                                maestras_data['tablasMaestras'][k] = req_data[k]

                maestras_data['ultimaActualizacion'] = time.strftime('%Y-%m-%dT%H:%M:%SZ')
                json_str = json.dumps(maestras_data, ensure_ascii=False, indent=2)
                with open('maestro.dat', 'w', encoding='utf-8') as f:
                    f.write(json_str)

                CACHE['maestras']['data'] = json.dumps(maestras_data, ensure_ascii=False).encode('utf-8')
                CACHE['maestras']['ts'] = time.time()

                # Sincronizar con Google Drive en background con su fileId dedicado
                mae_data_cloud = {**maestras_data, 'fileId': '1NycmHFf8iAko2XsHIi9dmfe-lK6utpek'}
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, json.dumps(mae_data_cloud, ensure_ascii=False).encode('utf-8'))

                res_bytes = json_str.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(res_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_bytes)
                return
            except Exception as e:
                err_b = f'{{"error": "{str(e)}"}}\n'.encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_b)
                return

        # 3. Endpoint para Historico_Documentos_USV.csv (Control de Cambios)
        if self.path.startswith('/api/historico') or self.path.startswith('/api/control-cambios'):
            try:
                import json
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                req_data = json.loads(body.decode('utf-8'))

                nuevos_evs = req_data.get('historicoDocumental') if isinstance(req_data, dict) and 'historicoDocumental' in req_data else ([req_data] if isinstance(req_data, dict) else (req_data if isinstance(req_data, list) else []))
                
                lista_existente = leer_historico_csv()
                map_h = {}
                for h in lista_existente:
                    if isinstance(h, dict) and (h.get('codigo') or h.get('id')):
                        k = h.get('id') or f"{h.get('codigo')}_{h.get('tipoEvento')}_{h.get('fechaHora')}"
                        map_h[k] = h

                for h in nuevos_evs:
                    if isinstance(h, dict) and (h.get('codigo') or h.get('id')):
                        k = h.get('id') or f"{h.get('codigo')}_{h.get('tipoEvento')}_{h.get('fechaHora')}"
                        map_h[k] = h

                lista_final = list(map_h.values())
                lista_final.sort(key=lambda x: parsear_fecha_ms(x.get('fechaHora') or x.get('fechaModificacionActual') or x.get('timestamp')), reverse=True)
                guardar_historico_csv(lista_final)

                json_resp = json.dumps({"status": "ok", "total": len(lista_final), "historicoDocumental": lista_final}, ensure_ascii=False)
                res_bytes = json_resp.encode('utf-8')
                CACHE['historico']['data'] = res_bytes
                CACHE['historico']['ts'] = time.time()

                # Sincronizar en background con Google Apps Script
                hist_cloud = {'accion': 'guardar_historico', 'historicoDocumental': lista_final}
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, json.dumps(hist_cloud, ensure_ascii=False).encode('utf-8'))

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(res_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_bytes)
                return
            except Exception as e:
                err_b = f'{{"error": "{str(e)}"}}\n'.encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_b)
                return

        # 4. Endpoint para guardar usuarios.conf (Usuarios, Credenciales, Perfiles, Favoritos, Preferencias)
        if self.path.startswith('/api/configuracion'):
            try:
                import json
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                req_data = json.loads(body.decode('utf-8'))

                conf_data = {}
                if os.path.exists('usuarios.conf'):
                    try:
                        with open('usuarios.conf', 'r', encoding='utf-8') as f:
                            conf_data = json.load(f)
                    except Exception:
                        conf_data = {}

                for k, v in req_data.items():
                    if k == 'usuariosRegistrados' and isinstance(v, dict):
                        if 'usuariosRegistrados' not in conf_data:
                            conf_data['usuariosRegistrados'] = {}
                        conf_data['usuariosRegistrados'].update(v)
                    elif k == 'favoritosPorUsuario' and isinstance(v, dict):
                        if 'favoritosPorUsuario' not in conf_data:
                            conf_data['favoritosPorUsuario'] = {}
                        conf_data['favoritosPorUsuario'].update(v)
                    elif k == 'mapeoPerfilesPersonalizados' and isinstance(v, dict):
                        if 'mapeoPerfilesPersonalizados' not in conf_data:
                            conf_data['mapeoPerfilesPersonalizados'] = {}
                        conf_data['mapeoPerfilesPersonalizados'].update(v)
                    elif k == 'preferenciasPorUsuario' and isinstance(v, dict):
                        if 'preferenciasPorUsuario' not in conf_data:
                            conf_data['preferenciasPorUsuario'] = {}
                        conf_data['preferenciasPorUsuario'].update(v)
                    elif k == 'usuario' and req_data.get('accion') == 'registrar_usuario':
                        doc = v.get('identificacion')
                        if doc:
                            if 'usuariosRegistrados' not in conf_data:
                                conf_data['usuariosRegistrados'] = {}
                            conf_data['usuariosRegistrados'][doc] = v
                    elif k not in ['accion', 'registroAuditoria', 'tablasMaestras', 'auditoria', 'historicoDocumental', 'fileId']:
                        conf_data[k] = v

                # Sanitizar y remover campos desacoplados
                conf_data = sanitizar_conf(conf_data)
                conf_data.pop('historicoDocumental', None)
                conf_data.pop('registroAuditoria', None)
                conf_data.pop('tablasMaestras', None)
                conf_data.pop('auditoria', None)

                json_str = json.dumps(conf_data, ensure_ascii=False, indent=2)
                
                # Guardar copia local inmediatamente
                with open('usuarios.conf', 'w', encoding='utf-8') as f:
                    f.write(json_str)

                # Actualizar caché en memoria inmediatamente
                CACHE['config']['data'] = json.dumps(conf_data, ensure_ascii=False).encode('utf-8')
                CACHE['config']['ts'] = time.time()

                # Sincronizar con Google Drive en background con fileId
                conf_cloud = {**conf_data, 'fileId': '1oBmanViv5bqhfE-isx7WnlbuP6Ylpegl'}
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, json.dumps(conf_cloud, ensure_ascii=False).encode('utf-8'))

                res_bytes = json_str.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(res_bytes)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_bytes)
                return
            except Exception as e:
                err_b = f'{{"error": "{str(e)}"}}\n'.encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_b)
                return

        # 2. Endpoint para Operaciones CRUD en Biblioteca Documental (Google Sheets)
        if self.path.startswith('/api/documento') or self.path.startswith('/api/repositorio/documento'):
            try:
                import json
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length) if length > 0 else b'{}'
                
                # Reenviar a Google Apps Script en background
                sincronizar_con_google_async(GOOGLE_SCRIPT_CONF_URL, body)

                resp_payload = {"status": "ok", "mensaje": "Operación documental registrada y enviada a Google Sheets"}
                res_b = json.dumps(resp_payload, ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(res_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(res_b)
                return
            except Exception as e:
                err_b = f'{{"status": "error", "error": "{str(e)}"}}\n'.encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_b)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(err_b)
                return

        self.send_response(404)
        self.end_headers()


import socketserver

class ThreadedHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = False

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server_address = ('0.0.0.0', port)
    httpd = ThreadedHTTPServer(server_address, LiveOneDriveHandler)
    print(f"Servidor iniciado en http://localhost:{port}/ y http://127.0.0.1:{port}/")
    sys.stdout.flush()
    # Disparar sincronizaciones en segundo plano con la nube
    _trigger_background_auditoria_sync()
    _trigger_background_config_sync()
    _trigger_background_historico_sync()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.server_close()
