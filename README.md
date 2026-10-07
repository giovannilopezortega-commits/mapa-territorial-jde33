# Mapa Territorial JDE 33

Aplicación cartográfica para consulta de secciones y manzanas, ubicación y navegación de campo.

## Web
La versión web se publica mediante GitHub Pages.

## Android / Google Play
La carpeta `android/` contiene el proyecto Android preparado para Google Play con:
- `compileSdk 36`
- `targetSdk 36`
- paquete `com.giovannilopez.mapaterritorialjde33`
- WebView seguro sobre HTTPS
- permiso de ubicación solicitado en tiempo de ejecución
- apertura de enlaces externos fuera de la app

Consulta `android/README.md` y `PLAY_STORE.md` para los pasos de firma y publicación.

## Privacidad
La política pública se encuentra en `privacy.html`.

## Ubicaciones de casillas

La pestaña Casillas permite elegir entre las 112 ubicaciones en una lista desplegable o escribir sección, lugar o domicilio para filtrar esa lista, sin elegir una sección en el buscador de manzanas. Seleccionar un resultado centra el punto y permite abrir Google Maps con sus coordenadas exactas. La capa azul se puede activar o desactivar.

Datos: 112 puntos de la carpeta CASILLAS de UC 2026.kmz. No se importan las otras capas del KMZ ni los tres trazos sin punto de la carpeta CASILLAS. El archivo no identifica básica/contigua; las secciones con varios puntos conservan ubicaciones separadas. Los domicilios ausentes se muestran como no indicados. No se infiere vigencia electoral del nombre del archivo.

Para regenerar los datos desde el KMZ original: `python scripts/import_casillas.py ruta/al/archivo.kmz`.
