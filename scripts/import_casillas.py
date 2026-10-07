"""Import only the CASILLAS folder from the supplied KMZ (no unrelated layers)."""
import collections
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ns = {'k': 'http://www.opengis.net/kml/2.2'}
with zipfile.ZipFile(sys.argv[1]) as archive:
    root = ET.fromstring(archive.read('doc.kml'))
folders = [f for f in root.findall('.//k:Folder', ns) if f.findtext('k:name', '', ns) == 'CASILLAS']
if len(folders) != 1:
    raise ValueError('Se esperaba exactamente una carpeta CASILLAS')
features = []
seen = collections.Counter()
for placemark in folders[0].findall('k:Placemark', ns):
    if placemark.find('k:Point', ns) is None:
        print(f'Omitido trazo sin punto: {placemark.findtext("k:name", "", ns)}')
        continue
    section = str(int(float(placemark.findtext('k:name', '', ns))))
    coordinates = [float(v) for v in placemark.findtext('k:Point/k:coordinates', '', ns).strip().split(',')[:2]]
    if len(coordinates) != 2 or not (-180 <= coordinates[0] <= 180 and -90 <= coordinates[1] <= 90):
        raise ValueError(f'Coordenadas inválidas en sección {section}')
    values = {d.attrib['name']: d.findtext('k:value', '', ns).strip() for d in placemark.findall('k:ExtendedData/k:Data', ns)}
    seen[section] += 1
    count = values.get('NO. CASILLAS', '')
    features.append({'type': 'Feature', 'properties': {
        'id': f'{section}-{seen[section]}', 'seccion': section, 'ubicacion_numero': seen[section],
        'domicilio': values.get('DOMICILIO', ''), 'ubicacion': values.get('UBICACIÓN', ''),
        'referencia': values.get('REFERENCIA', ''), 'tipo_domicilio': values.get('TIPO DE DOMICILIO', ''),
        'numero_casillas': int(float(count)) if count else None,
    }, 'geometry': {'type': 'Point', 'coordinates': coordinates}})
for feature in features:
    feature['properties']['ubicaciones_seccion'] = seen[feature['properties']['seccion']]
features.sort(key=lambda f: (int(f['properties']['seccion']), f['properties']['ubicacion_numero']))
output = Path(__file__).resolve().parents[1] / 'data' / 'casillas.geojson'
output.write_text(json.dumps({'type': 'FeatureCollection', 'source': 'UC 2026.kmz / CASILLAS', 'features': features}, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(features)} ubicaciones, {len(seen)} secciones; {sum(not f["properties"]["domicilio"] for f in features)} sin domicilio')
