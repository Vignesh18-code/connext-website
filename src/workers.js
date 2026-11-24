// The two Web Worker sources — reproduced verbatim from
// united-carriers.netlify.app/chunks/my-flights-*.js
// EDGE worker  -> samples coastline outlines into dots
// FILL worker  -> lat/lon grid + point-in-polygon -> interior land dots
// Both return a Float32Array of unit-sphere XYZ (transferred, zero-copy).

export const EDGE_WORKER_SRC = `
function wrapLon(lon){ return ((lon + 540) % 360) - 180; }
function sampleEdgeFlat(ring, maxDegStep){
  var out = [];
  var currentDist = 0;
  if (ring.length >= 2) out.push(wrapLon(ring[0]), ring[1]);
  for (var i=0; i<ring.length-2; i+=2){
    var lon1 = ring[i], lat1 = ring[i+1];
    var lon2 = ring[i+2], lat2 = ring[i+3];
    var dLon = lon2 - lon1, lon2n = lon2;
    if (Math.abs(dLon)>180){ lon2n += dLon>0?-360:360; dLon = lon2n - lon1; }
    var dLat = lat2 - lat1;
    var avgLat = (lat1 + lat2) * 0.5;
    var cosLat = Math.cos(avgLat * Math.PI / 180);
    var segLen = Math.sqrt((dLon * cosLat) * (dLon * cosLat) + dLat * dLat);
    var remain = segLen;
    var t = 0;
    while (currentDist + remain >= maxDegStep) {
      var move = maxDegStep - currentDist;
      t += move / segLen;
      var lon = lon1 + dLon * t;
      var lat = lat1 + dLat * t;
      out.push(wrapLon(lon), lat);
      remain -= move;
      currentDist = 0;
    }
    currentDist += remain;
  }
  return new Float32Array(out);
}
function lonLatToVec3(lon,lat,r){
  if (r === void 0) r = 1;
  var phi = (90 - lat) * Math.PI/180;
  var theta = (lon + 180) * Math.PI/180;
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}
onmessage = function(e){
  var densityDeg = e.data.densityDeg, polysIn = e.data.polysIn;
  var edgeOut = [];
  for (var p=0;p<polysIn.length;p++){
    var poly = polysIn[p];
    for (var r=0;r<poly.length;r++){
      var sampled = sampleEdgeFlat(poly[r], densityDeg * 0.7);
      for (var i=0;i<sampled.length;i+=2){
        var v = lonLatToVec3(sampled[i], sampled[i+1], 1);
        edgeOut.push(v[0],v[1],v[2]);
      }
    }
  }
  var arr = new Float32Array(edgeOut);
  postMessage({ ok:true, edge:arr }, [arr.buffer]);
};
`;

export const FILL_WORKER_SRC = `
var PI=Math.PI;
function wrap180(lon){ return ((lon+540)%360)-180; }
function vec3(lon,lat){
  var phi=(90-lat)*PI/180, th=(lon+180)*PI/180;
  return [-Math.sin(phi)*Math.cos(th), Math.cos(phi), Math.sin(phi)*Math.sin(th)];
}
function unwrapRing(ring, refLon){
  var out=new Array(ring.length), prev=null;
  for(var i=0;i<ring.length;i++){
    var L=ring[i][0], A=ring[i][1];
    var d=L-refLon;
    if(d>180) L-=360; else if(d<-180) L+=360;
    if(prev){
      var step=L-prev[0];
      if(step>180) L-=360; else if(step<-180) L+=360;
    }
    out[i]=[L,A]; prev=out[i];
  }
  return out;
}
function pointInRing(pt, ring){
  var x=pt[0], y=pt[1], inside=false, n=ring.length;
  for(var i=0,j=n-1;i<n;j=i++){
    var xi=ring[i][0], yi=ring[i][1];
    var xj=ring[j][0], yj=ring[j][1];
    var denom=yj-yi; if(denom===0) continue;
    var inter=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/denom + xi);
    if(inter) inside=!inside;
  }
  return inside;
}
function containsUnwrapped(poly, refLon, lon, lat){
  var rings=poly.coordinates; if(!rings||!rings.length) return false;
  var r0=unwrapRing(rings[0], refLon);
  var pt=[lon,lat];
  if(!pointInRing(pt, r0)) return false;
  for(var k=1;k<rings.length;k++){
    var rk=unwrapRing(rings[k], refLon);
    if(pointInRing(pt, rk)) return false;
  }
  return true;
}
function bbox(r){
  var minLon=1e9,maxLon=-1e9,minLat=90,maxLat=-90;
  for(var i=0;i<r.length;i++){
    var L=r[i][0], A=r[i][1];
    if(L<minLon)minLon=L; if(L>maxLon)maxLon=L;
    if(A<minLat)minLat=A; if(A>maxLat)maxLat=A;
  }
  return {minLon:minLon,maxLon:maxLon,minLat:minLat,maxLat:maxLat};
}
onmessage=function(e){
  var geos=e.data.geos, step=Math.max(0.2, Math.min(6.0, e.data.tileDeg||1.0));
  var out=[];
  for(var p=0;p<geos.length;p++){
    var r0 = unwrapRing(geos[p].coordinates[0], 0);
    var bb = bbox(r0);
    var refLon = (bb.minLon+bb.maxLon)/2;
    r0 = unwrapRing(geos[p].coordinates[0], refLon);
    bb = bbox(r0);
    var latStart = Math.floor((bb.minLat-1)/step)*step;
    var latEnd   = Math.ceil((bb.maxLat+1)/step)*step;
    for(var lat=latStart; lat<=latEnd; lat+=step){
      var odd = Math.round(Math.abs(lat/step))%2;
      var cosLat = Math.cos(lat * PI / 180);
      var lonStep = step / Math.max(0.15, cosLat);
      var lonStart = Math.floor((bb.minLon-1)/lonStep)*lonStep + (odd? lonStep*0.5 : 0);
      var lonEnd   = Math.ceil((bb.maxLon+1)/lonStep)*lonStep;
      for(var lon=lonStart; lon<=lonEnd; lon+=lonStep){
        var llLon = lon, llLat = Math.max(-90, Math.min(90, lat));
        if(containsUnwrapped(geos[p], refLon, llLon, llLat)){
          var v = vec3(wrap180(llLon), llLat);
          out.push(v[0],v[1],v[2]);
        }
      }
    }
  }
  var arr=new Float32Array(out);
  postMessage({ok:true, fill:arr}, [arr.buffer]);
};
`;

// their `z(src, data)` helper: spin up a Blob worker, resolve with its message
export function runWorker(src, data) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
    const w = new Worker(url);
    w.onmessage = (ev) => { URL.revokeObjectURL(url); w.terminate(); (ev.data && ev.data.ok) ? resolve(ev.data) : reject(new Error('worker failed')); };
    w.onerror = (err) => { URL.revokeObjectURL(url); w.terminate(); reject(err); };
    w.postMessage(data);
  });
}
