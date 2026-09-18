const state={
  district:null,sections:null,index:null,allBlocks:null,blocks:null,
  selectedSection:null,selectedSectionFeature:null,selectedBlock:null,currentBlockLayer:null,
  blockLayer:null,userMarker:null,userAccuracy:null,base:'osm'
};

const map=L.map('map',{zoomControl:true,preferCanvas:true});
const bases={
  osm:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap'}),
  satellite:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,attribution:'Tiles © Esri'})
};
bases.osm.addTo(map);

const districtGroup=L.layerGroup().addTo(map);
const sectionGroup=L.layerGroup().addTo(map);
const blockGroup=L.layerGroup().addTo(map);

const $=id=>document.getElementById(id);
const sectionSelect=$('sectionSelect');
const blockSelect=$('blockSelect');
const btnSearch=$('btnSearch');
const statusPill=$('statusPill');
const sidebar=$('sidebar');

async function getJSON(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error(`No se pudo cargar ${url}`);
  return r.json();
}
function safe(v){return v===null||v===undefined||v===''?'—':v}
function blockType(v){const m={0:'Urbana',1:'Rural',2:'Mixta'};return m[v]??`Tipo ${v}`}
function isMobile(){return window.matchMedia('(max-width:900px)').matches}

function destinationFromFeature(feature){
  if(!feature)return null;
  const layer=L.geoJSON(feature);
  const bounds=layer.getBounds();
  if(!bounds.isValid())return null;

  // Primero usamos el centro visual. Si no cae dentro del polígono,
  // Leaflet nos da un centro estable para navegación de campo.
  const c=bounds.getCenter();
  return {lat:c.lat,lon:c.lng};
}

function setDestinationText(feature){
  const d=destinationFromFeature(feature);
  $('detailCoords').textContent=d
    ? `Destino: ${d.lat.toFixed(6)}, ${d.lon.toFixed(6)}`
    : 'Destino: no disponible';
}

function showSectionDetail(feature){
  if(!feature)return;
  const p=feature.properties||{};
  $('detailTitle').textContent=`Sección ${safe(p.seccion)}`;
  $('detailSection').textContent='Destino de sección';
  $('detailMunicipio').textContent=safe(p.municipio);
  $('detailLocalidad').textContent='—';
  $('detailTipo').textContent='Sección';
  $('detailId').textContent=safe(p.id);
  setDestinationText(feature);
  $('btnDirections').textContent='➤ Cómo llegar a la sección';
  $('detailPanel').classList.remove('hidden');
}

async function init(){
  try{
    const [district,sections,index,blocks]=await Promise.all([
      getJSON('data/distrito.geojson'),
      getJSON('data/secciones.geojson'),
      getJSON('data/indice.json'),
      getJSON('data/manzanas.geojson')
    ]);
    state.district=district;state.sections=sections;state.index=index;state.allBlocks=blocks;
    $('sectionCount').textContent=sections.features.length;
    $('blockCount').textContent=blocks.features.length.toLocaleString('es-MX');
    drawDistrict();drawSections();fillSections(index);
    map.fitBounds(L.geoJSON(district).getBounds(),{padding:[18,18]});
    updateLabelVisibility();
  }catch(e){
    console.error(e);
    statusPill.textContent='Error al cargar cartografía';
    alert('No fue posible cargar la cartografía.');
  }
}

function drawDistrict(){
  districtGroup.clearLayers();
  L.geoJSON(state.district,{style:{color:'#b00061',weight:4,fillColor:'#b00061',fillOpacity:.05,interactive:false}}).addTo(districtGroup);
}

function drawSections(){
  sectionGroup.clearLayers();
  L.geoJSON(state.sections,{
    style:{color:'#4f3350',weight:1.25,fillColor:'#c45a98',fillOpacity:.06},
    onEachFeature:(f,l)=>{
      l.bindTooltip(String(f.properties.seccion),{permanent:true,direction:'center',className:'section-label'});
      l.on('click',()=>selectSection(String(f.properties.seccion),true));
    }
  }).addTo(sectionGroup);
}

function fillSections(index){
  [...index].sort((a,b)=>Number(a.seccion)-Number(b.seccion)).forEach(x=>{
    const o=document.createElement('option');o.value=x.seccion;o.textContent=x.seccion;sectionSelect.appendChild(o);
  });
}

async function selectSection(sec,zoom=false){
  if(!sec)return;
  state.selectedSection=String(sec);
  state.selectedBlock=null;
  state.currentBlockLayer=null;
  resetSelectedStyle();
  sectionSelect.value=String(sec);
  blockSelect.disabled=true;
  btnSearch.disabled=true;
  blockSelect.innerHTML='<option>Cargando…</option>';
  statusPill.textContent=`Cargando sección ${sec}…`;

  const features=state.allBlocks.features.filter(f=>String(f.properties.seccion)===String(sec));
  const gj={type:'FeatureCollection',features};
  state.blocks=gj;
  drawBlocks(gj);fillBlocks(gj);
  blockSelect.disabled=false;
  statusPill.textContent=`Sección ${sec} · ${features.length} manzanas`;

  const sf=state.sections.features.find(f=>String(f.properties.seccion)===String(sec));
  state.selectedSectionFeature=sf||null;
  if(sf){
    showSectionDetail(sf);
    if(zoom)map.fitBounds(L.geoJSON(sf).getBounds(),{padding:[35,35]});
  }
  if(isMobile()) closeSidebar();
}

function drawBlocks(gj){
  blockGroup.clearLayers();
  const layer=L.geoJSON(gj,{
    style:f=>blockStyle(f,false),
    onEachFeature:(f,l)=>{
      l.on('click',()=>selectBlockFeature(f,l,true));
      l.bindTooltip(String(f.properties.manzana),{permanent:true,direction:'center',className:'block-label'});
    }
  });
  layer.addTo(blockGroup);
  state.blockLayer=layer;
  updateLabelVisibility();
}

function blockStyle(f,selected){
  return selected
    ? {color:'#0b66d4',weight:3,fillColor:'#ffd72e',fillOpacity:.62}
    : {color:'#bd8e00',weight:1,fillColor:'#ffd72e',fillOpacity:.12};
}

function fillBlocks(gj){
  blockSelect.innerHTML='<option value="">— Selecciona —</option>';
  [...gj.features].sort((a,b)=>Number(a.properties.manzana)-Number(b.properties.manzana)).forEach(f=>{
    const o=document.createElement('option');o.value=f.properties.manzana;o.textContent=f.properties.manzana;blockSelect.appendChild(o);
  });
}

function findBlock(man){return state.blocks?.features.find(f=>String(f.properties.manzana)===String(man))}
function getLayerForFeature(feature){
  let result=null;state.blockLayer?.eachLayer(l=>{if(l.feature===feature)result=l});return result;
}
function resetSelectedStyle(){
  if(state.currentBlockLayer?.feature)state.currentBlockLayer.setStyle(blockStyle(state.currentBlockLayer.feature,false));
}

function selectBlockFeature(feature,layer,zoom=true){
  resetSelectedStyle();
  state.selectedBlock=feature;
  state.currentBlockLayer=layer||getLayerForFeature(feature);
  if(state.currentBlockLayer){
    state.currentBlockLayer.setStyle(blockStyle(feature,true));
    state.currentBlockLayer.bringToFront();
  }
  blockSelect.value=String(feature.properties.manzana);
  btnSearch.disabled=false;
  showDetail(feature);
  statusPill.textContent=`Sección ${feature.properties.seccion} · Manzana ${feature.properties.manzana}`;
  if(zoom&&state.currentBlockLayer)map.fitBounds(state.currentBlockLayer.getBounds(),{padding:[70,70],maxZoom:19});
  if(isMobile()) closeSidebar();
}

function showDetail(f){
  const p=f.properties;
  $('detailTitle').textContent=`Manzana ${p.manzana}`;
  $('detailSection').textContent=`Sección: ${p.seccion}`;
  $('detailMunicipio').textContent=safe(p.municipio);
  $('detailLocalidad').textContent=safe(p.localidad);
  $('detailTipo').textContent=blockType(p.tipo_manza);
  $('detailId').textContent=safe(p.id);
  setDestinationText(f);
  $('btnDirections').textContent='➤ Cómo llegar a la manzana';
  $('detailPanel').classList.remove('hidden');
}

sectionSelect.addEventListener('change',e=>selectSection(e.target.value,true));
blockSelect.addEventListener('change',e=>{
  const f=findBlock(e.target.value);
  if(f)selectBlockFeature(f,getLayerForFeature(f),false); else {btnSearch.disabled=true;state.selectedBlock=null;state.currentBlockLayer=null;if(state.selectedSectionFeature)showSectionDetail(state.selectedSectionFeature);}
});
btnSearch.addEventListener('click',()=>{if(state.selectedBlock)selectBlockFeature(state.selectedBlock,state.currentBlockLayer,true)});
$('btnQuick').addEventListener('click',quickSearch);
$('quickSearch').addEventListener('keydown',e=>{if(e.key==='Enter')quickSearch()});

async function quickSearch(){
  const raw=$('quickSearch').value.trim().replace(/\s/g,'');
  const m=raw.match(/^(\d+)[-/,](\d+)$/);
  if(!m){alert('Usa el formato sección-manzana. Ejemplo: 1059-13');return}
  const [,sec,man]=m;
  await selectSection(sec,true);
  const f=findBlock(man);
  if(!f){alert(`No encontré la manzana ${man} en la sección ${sec}.`);return}
  selectBlockFeature(f,getLayerForFeature(f),true);
}

$('btnDirections').addEventListener('click',()=>{
  const feature=state.selectedBlock||state.selectedSectionFeature;
  const d=destinationFromFeature(feature);
  if(!d){alert('No fue posible calcular el destino.');return}
  const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.lat+','+d.lon)}&travelmode=driving`;
  window.open(url,'_blank','noopener');
});
$('btnCenter').addEventListener('click',()=>{if(state.currentBlockLayer){map.fitBounds(state.currentBlockLayer.getBounds(),{padding:[70,70],maxZoom:19});return}if(state.selectedSectionFeature)map.fitBounds(L.geoJSON(state.selectedSectionFeature).getBounds(),{padding:[35,35]})});
$('closeDetail').addEventListener('click',()=>$('detailPanel').classList.add('hidden'));
$('btnFitDistrict').addEventListener('click',()=>map.fitBounds(L.geoJSON(state.district).getBounds(),{padding:[20,20]}));

function pointInRing(point,ring){
  const [x,y]=point;let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    const intersect=((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);
    if(intersect)inside=!inside;
  }
  return inside;
}
function pointInPolygon(point,geom){
  if(!geom)return false;
  if(geom.type==='Polygon'){
    if(!pointInRing(point,geom.coordinates[0]))return false;
    for(let i=1;i<geom.coordinates.length;i++) if(pointInRing(point,geom.coordinates[i])) return false;
    return true;
  }
  if(geom.type==='MultiPolygon'){
    return geom.coordinates.some(poly=>pointInPolygon(point,{type:'Polygon',coordinates:poly}));
  }
  return false;
}

function identifyLocation(lat,lon){
  const point=[lon,lat];
  const section=state.sections.features.find(f=>pointInPolygon(point,f.geometry));
  const block=state.allBlocks.features.find(f=>pointInPolygon(point,f.geometry));
  return {section,block};
}

function locateMe(){
  hideMobileHint();
  if(!navigator.geolocation){alert('Tu dispositivo no permite geolocalización.');return}
  statusPill.textContent='Obteniendo ubicación…';
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude,lon=pos.coords.longitude,ll=[lat,lon];
    if(state.userMarker)map.removeLayer(state.userMarker);
    if(state.userAccuracy)map.removeLayer(state.userAccuracy);

    state.userAccuracy=L.circle(ll,{radius:pos.coords.accuracy,color:'#1267d6',weight:1,fillColor:'#1267d6',fillOpacity:.08}).addTo(map);
    state.userMarker=L.circleMarker(ll,{radius:9,color:'#fff',weight:3,fillColor:'#1267d6',fillOpacity:1}).addTo(map).bindPopup('Mi ubicación');

    map.setView(ll,18);
    const found=identifyLocation(lat,lon);
    $('locationCard').classList.remove('hidden');
    $('locationSection').textContent=`Sección: ${found.section?found.section.properties.seccion:'Fuera del distrito o no identificada'}`;
    $('locationBlock').textContent=`Manzana: ${found.block?found.block.properties.manzana:'No identificada'}`;
    $('locationAccuracy').textContent=`Precisión aproximada: ±${Math.round(pos.coords.accuracy)} m`;

    if(found.block){
      const sec=String(found.block.properties.seccion);
      selectSection(sec,false).then(()=>{
        const f=findBlock(found.block.properties.manzana);
        if(f) selectBlockFeature(f,getLayerForFeature(f),false);
        map.setView(ll,18);
        $('detailPanel').classList.add('hidden');
      });
      statusPill.textContent=`Estás en sección ${sec} · manzana ${found.block.properties.manzana}`;
    }else if(found.section){
      statusPill.textContent=`Estás en sección ${found.section.properties.seccion}`;
    }else{
      statusPill.textContent='Ubicación mostrada · fuera de cartografía identificada';
    }
  },err=>{
    console.error(err);
    alert('No fue posible obtener tu ubicación. Revisa los permisos de ubicación de Chrome.');
    statusPill.textContent='Ubicación no disponible';
  },{enableHighAccuracy:true,timeout:15000,maximumAge:5000});
}

$('btnLocate').addEventListener('click',locateMe);
$('fabLocate').addEventListener('click',locateMe);
$('closeLocationCard').addEventListener('click',()=>$('locationCard').classList.add('hidden'));

function hideMobileHint(){ const h=$('mobileHint'); if(h) h.classList.add('hidden'); }
function openSidebar(tab='buscar'){
  hideMobileHint();
  $('detailPanel').classList.add('hidden');
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  document.querySelectorAll('.tab-pane').forEach(x=>x.classList.toggle('active',x.id===`tab-${tab}`));
  sidebar.classList.add('open');
}
function closeSidebar(){sidebar.classList.remove('open')}
$('fabSearch').addEventListener('click',()=>openSidebar('buscar'));
$('fabLayers').addEventListener('click',()=>openSidebar('capas'));
$('btnCloseSidebar').addEventListener('click',closeSidebar);

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$(`tab-${b.dataset.tab}`).classList.add('active');
}));

$('layerDistrict').addEventListener('change',e=>e.target.checked?districtGroup.addTo(map):map.removeLayer(districtGroup));
$('layerSections').addEventListener('change',e=>e.target.checked?sectionGroup.addTo(map):map.removeLayer(sectionGroup));
$('layerBlocks').addEventListener('change',e=>e.target.checked?blockGroup.addTo(map):map.removeLayer(blockGroup));
document.querySelectorAll('input[name="base"]').forEach(r=>r.addEventListener('change',e=>{
  Object.values(bases).forEach(x=>map.removeLayer(x));
  bases[e.target.value].addTo(map);bases[e.target.value].bringToBack();
}));

$('btnHelp').addEventListener('click',()=>$('helpModal').classList.remove('hidden'));
$('closeHelp').addEventListener('click',()=>$('helpModal').classList.add('hidden'));
$('helpModal').addEventListener('click',e=>{if(e.target.id==='helpModal')$('helpModal').classList.add('hidden')});

function updateLabelVisibility(){
  const z=map.getZoom();
  const el=map.getContainer();
  el.classList.toggle('show-section-labels',z>=13 && z<17);
  el.classList.toggle('show-block-labels',z>=17);
}
map.on('zoomend',updateLabelVisibility);

init();


// V2.1: estabiliza el mapa y la barra móvil en navegadores móviles
function refreshMapSize(){
  setTimeout(()=>map.invalidateSize({pan:false}),120);
}
window.addEventListener('resize',refreshMapSize);
window.addEventListener('orientationchange',refreshMapSize);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMapSize()});

if(window.matchMedia('(max-width:900px)').matches){
  setTimeout(()=>{
    const nav=document.getElementById('mobileNav');
    if(nav) nav.style.display='grid';
    refreshMapSize();
  },250);
}
