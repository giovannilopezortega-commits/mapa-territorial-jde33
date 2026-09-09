const state={district:null,sections:null,blocks:null,selectedSection:null,selectedBlock:null,currentBlockLayer:null,userMarker:null,base:'osm'};

const map=L.map('map',{zoomControl:true,preferCanvas:true});
const bases={
  osm:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}),
  satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri'})
};
bases.osm.addTo(map);
const districtGroup=L.layerGroup().addTo(map), sectionGroup=L.layerGroup().addTo(map), blockGroup=L.layerGroup().addTo(map);

const $=id=>document.getElementById(id);
const sectionSelect=$('sectionSelect'),blockSelect=$('blockSelect'),btnSearch=$('btnSearch'),statusPill=$('statusPill');

async function getJSON(url){const r=await fetch(url);if(!r.ok)throw new Error(`No se pudo cargar ${url}`);return r.json()}
function safe(v){return v===null||v===undefined||v===''?'—':v}
function blockType(v){const m={0:'Urbana',1:'Rural',2:'Mixta'};return m[v]??`Tipo ${v}`}

async function init(){
  try{
    const [district,sections,index,blocks]=await Promise.all([getJSON('data/distrito.geojson'),getJSON('data/secciones.geojson'),getJSON('data/indice.json'),getJSON('data/manzanas.geojson')]);
    state.district=district; state.sections=sections; state.index=index; state.allBlocks=blocks;
    $('sectionCount').textContent=sections.features.length;
    $('blockCount').textContent=index.reduce((a,b)=>a+b.count,0).toLocaleString('es-MX');
    drawDistrict(); drawSections(); fillSections(index);
    const bounds=L.geoJSON(district).getBounds();map.fitBounds(bounds,{padding:[18,18]});
  }catch(e){console.error(e);statusPill.textContent='Error al cargar cartografía. Abre la app desde un servidor web.';alert('No fue posible cargar la cartografía. Si abriste index.html directamente, publícala en un servidor web o GitHub Pages.');}
}

function drawDistrict(){districtGroup.clearLayers();L.geoJSON(state.district,{style:{color:'#b00061',weight:4,fillColor:'#b00061',fillOpacity:.06,interactive:false}}).addTo(districtGroup)}
function drawSections(){sectionGroup.clearLayers();L.geoJSON(state.sections,{style:f=>({color:'#4f3350',weight:1.4,fillColor:'#c45a98',fillOpacity:.08}),onEachFeature:(f,l)=>{l.bindTooltip(String(f.properties.seccion),{permanent:true,direction:'center',className:'section-label'});l.on('click',()=>selectSection(String(f.properties.seccion),true))}}).addTo(sectionGroup)}
function fillSections(index){index.forEach(x=>{const o=document.createElement('option');o.value=x.seccion;o.textContent=x.seccion;sectionSelect.appendChild(o)})}

async function selectSection(sec,zoom=false){
  if(!sec)return;state.selectedSection=String(sec);sectionSelect.value=String(sec);blockSelect.disabled=true;btnSearch.disabled=true;blockSelect.innerHTML='<option>Cargando…</option>';statusPill.textContent=`Cargando sección ${sec}…`;
  try{
    const gj={type:'FeatureCollection',features:state.allBlocks.features.filter(f=>String(f.properties.seccion)===String(sec))};state.blocks=gj;drawBlocks(gj);fillBlocks(gj);blockSelect.disabled=false;statusPill.textContent=`Sección ${sec} · ${gj.features.length} manzanas`;
    if(zoom){const sf=state.sections.features.find(f=>String(f.properties.seccion)===String(sec));if(sf)map.fitBounds(L.geoJSON(sf).getBounds(),{padding:[40,40]})}
  }catch(e){console.error(e);statusPill.textContent='No se pudo cargar la sección';}
}
function drawBlocks(gj){blockGroup.clearLayers();const layer=L.geoJSON(gj,{style:f=>blockStyle(f,false),onEachFeature:(f,l)=>{l.on('click',()=>selectBlockFeature(f,l,true));l.bindTooltip(String(f.properties.manzana),{direction:'center',className:'block-label',sticky:true})}});layer.addTo(blockGroup);state.blockLayer=layer}
function blockStyle(f,selected){return selected?{color:'#0b66d4',weight:3,fillColor:'#ffd72e',fillOpacity:.6}:{color:'#bd8e00',weight:1,fillColor:'#ffd72e',fillOpacity:.16}}
function fillBlocks(gj){blockSelect.innerHTML='<option value="">— Selecciona —</option>';[...gj.features].sort((a,b)=>Number(a.properties.manzana)-Number(b.properties.manzana)).forEach(f=>{const o=document.createElement('option');o.value=f.properties.manzana;o.textContent=f.properties.manzana;blockSelect.appendChild(o)})}
function findBlock(man){return state.blocks?.features.find(f=>String(f.properties.manzana)===String(man))}
function getLayerForFeature(feature){let result=null;state.blockLayer?.eachLayer(l=>{if(l.feature===feature)result=l});return result}
function resetSelectedStyle(){if(state.currentBlockLayer&&state.currentBlockLayer.feature)state.currentBlockLayer.setStyle(blockStyle(state.currentBlockLayer.feature,false))}
function selectBlockFeature(feature,layer,zoom=true){
  resetSelectedStyle();state.selectedBlock=feature;state.currentBlockLayer=layer||getLayerForFeature(feature);if(state.currentBlockLayer){state.currentBlockLayer.setStyle(blockStyle(feature,true));state.currentBlockLayer.bringToFront()}
  blockSelect.value=String(feature.properties.manzana);btnSearch.disabled=false;showDetail(feature);statusPill.textContent=`Sección ${feature.properties.seccion} · Manzana ${feature.properties.manzana}`;if(zoom&&state.currentBlockLayer)map.fitBounds(state.currentBlockLayer.getBounds(),{padding:[80,80],maxZoom:19});
}
function showDetail(f){const p=f.properties;$('detailTitle').textContent=`Manzana ${p.manzana}`;$('detailSection').textContent=`Sección: ${p.seccion}`;$('detailMunicipio').textContent=safe(p.municipio);$('detailLocalidad').textContent=safe(p.localidad);$('detailTipo').textContent=blockType(p.tipo_manza);$('detailId').textContent=safe(p.id);$('detailCoords').textContent=`Destino: ${Number(p.route_lat).toFixed(6)}, ${Number(p.route_lon).toFixed(6)}`;$('detailPanel').classList.remove('hidden')}

sectionSelect.addEventListener('change',e=>selectSection(e.target.value,true));
blockSelect.addEventListener('change',e=>{const f=findBlock(e.target.value);if(f)selectBlockFeature(f,getLayerForFeature(f),false);else btnSearch.disabled=true});
btnSearch.addEventListener('click',()=>{if(state.selectedBlock)selectBlockFeature(state.selectedBlock,state.currentBlockLayer,true)});
$('btnQuick').addEventListener('click',quickSearch);$('quickSearch').addEventListener('keydown',e=>{if(e.key==='Enter')quickSearch()});
async function quickSearch(){const raw=$('quickSearch').value.trim().replace(/\s/g,'');const m=raw.match(/^(\d+)[-/,](\d+)$/);if(!m){alert('Usa el formato sección-manzana. Ejemplo: 1059-13');return}const [,sec,man]=m;await selectSection(sec,true);const f=findBlock(man);if(!f){alert(`No encontré la manzana ${man} en la sección ${sec}.`);return}selectBlockFeature(f,getLayerForFeature(f),true)}

$('btnDirections').addEventListener('click',()=>{if(!state.selectedBlock)return;const p=state.selectedBlock.properties;const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.route_lat+','+p.route_lon)}&travelmode=driving`;window.open(url,'_blank','noopener')});
$('btnCenter').addEventListener('click',()=>{if(state.currentBlockLayer)map.fitBounds(state.currentBlockLayer.getBounds(),{padding:[70,70],maxZoom:19})});
$('closeDetail').addEventListener('click',()=>$('detailPanel').classList.add('hidden'));
$('btnFitDistrict').addEventListener('click',()=>map.fitBounds(L.geoJSON(state.district).getBounds(),{padding:[20,20]}));
$('btnLocate').addEventListener('click',()=>{if(!navigator.geolocation){alert('Tu dispositivo no permite geolocalización.');return}statusPill.textContent='Obteniendo ubicación…';navigator.geolocation.getCurrentPosition(pos=>{const ll=[pos.coords.latitude,pos.coords.longitude];if(state.userMarker)map.removeLayer(state.userMarker);state.userMarker=L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:'#1267d6',fillOpacity:1}).addTo(map).bindPopup('Mi ubicación').openPopup();map.setView(ll,17);statusPill.textContent='Ubicación actual mostrada';},err=>{alert('No fue posible obtener tu ubicación. Revisa los permisos del navegador.');statusPill.textContent='Ubicación no disponible';},{enableHighAccuracy:true,timeout:12000,maximumAge:10000})});

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(`tab-${b.dataset.tab}`).classList.add('active')}));
$('layerDistrict').addEventListener('change',e=>e.target.checked?districtGroup.addTo(map):map.removeLayer(districtGroup));
$('layerSections').addEventListener('change',e=>e.target.checked?sectionGroup.addTo(map):map.removeLayer(sectionGroup));
$('layerBlocks').addEventListener('change',e=>e.target.checked?blockGroup.addTo(map):map.removeLayer(blockGroup));
document.querySelectorAll('input[name="base"]').forEach(r=>r.addEventListener('change',e=>{Object.values(bases).forEach(x=>map.removeLayer(x));bases[e.target.value].addTo(map);bases[e.target.value].bringToBack()}));
$('btnHelp').addEventListener('click',()=>$('helpModal').classList.remove('hidden'));$('closeHelp').addEventListener('click',()=>$('helpModal').classList.add('hidden'));$('helpModal').addEventListener('click',e=>{if(e.target.id==='helpModal')$('helpModal').classList.add('hidden')});

init();
