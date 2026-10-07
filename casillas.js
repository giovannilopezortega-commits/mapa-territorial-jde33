// Functions shared by the independent polling-location search and its checks.
(function(root){
  function normalize(value){
    return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }
  function label(feature){
    const p=feature.properties;
    return `Sección ${p.seccion}${p.ubicaciones_seccion>1?` · Ubicación ${p.ubicacion_numero}`:''}`;
  }
  function search(features,query){
    const tokens=normalize(query).split(/\s+/).filter(Boolean);
    return features.filter(f=>{
      const p=f.properties;
      const text=normalize([label(f),p.ubicacion,p.domicilio,p.referencia].join(' '));
      return tokens.every(t=>/^\d+$/.test(t)?String(p.seccion)===t:text.includes(t));
    });
  }
  const api={label,search};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.Casillas=api;
})(globalThis);
