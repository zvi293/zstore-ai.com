/* Zstore AI — "Tactile Play" piece engine.
   The Z monogram is cut into glazed ceramic pieces (two bars and a mitred diagonal) plus small
   pieces derived from the same geometry: a mini Z, a corner, a stroke tile and a mitred stub.
   Hand-written WebGL1: an SDF raymarcher generated per piece (soft shadows, AO, studio environment,
   speckled glaze with an inlaid groove), an FXAA pass, and a small spring/impulse physics sim.
   Layouts are fitted to DOM "stages" and satellites are pushed out of the text rectangles. */
(() => {
  'use strict';
  const canvas = document.getElementById('gl');
  const root = document.documentElement;
  if (!canvas) return;
  const noGL = () => { root.classList.remove('gl-pending'); root.classList.add('no-gl'); };
  if (!window.WebGLRenderingContext) { noGL(); return; }

  // Evaluating this file reads no layout and creates no context: the context, the canvas size and the first
  // measurements all happen in boot(), in idle time after first paint (html.gl-pending is set by the head script).
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = () => innerWidth < 768;
  const MOBILE = coarse || matchMedia('(max-width: 767.98px)').matches;

  let gl = null;

  /* ------------------------------------------------------------ Z geometry (shared with the SVG mark) */
  const PI = Math.PI;
  const TH = Math.atan2(14, 19);                 // diagonal angle of the mark (36.4°)
  const CT = Math.cos(TH), SN = Math.sin(TH);
  const BAR = [2.1, 0.59, 0.46], BAR_Y = 1.51;   // 48-unit mark scaled to a 4.2-unit Z
  const GR = 0.075;                              // inlaid groove radius

  // kind: bar | diag | miniz | corner.  mat: 0 orange, 1 deep orange, 2 porcelain, 3 ink.
  const ALL = [
    { kind: 'bar', b: BAR, r: 0.2, L: 1.5, mat: 0, group: 'Z', seg: [1.5, 0, 0], cr: 0.62, hh: 0.59 },
    { kind: 'diag', b: [2.7, 0.505, 0.44], r: 0.18, cut: 1.17, L: 1.45, mat: 1, group: 'Z', seg: [1.5, 0, 0], cr: 0.55, hh: 1.17 },
    { kind: 'bar', b: BAR, r: 0.2, L: 1.5, mat: 0, group: 'Z', seg: [1.5, 0, 0], cr: 0.62, hh: 0.59 },
    { kind: 'miniz', s: 0.4, mat: 3, seg: [0.5, 0, 0], cr: 0.95, hh: 0.84, dz: 0.3 },
    { kind: 'corner', mat: 2, seg: [0.8, 0, 0], cr: 0.72, hh: 1.1, dz: 0.4 },
    { kind: 'bar', b: [1.0, 0.59, 0.46], r: 0.2, L: 0.45, mat: 3, seg: [0.45, 0, 0], cr: 0.62, hh: 0.59 },
    { kind: 'diag', b: [1.5, 0.505, 0.44], r: 0.18, cut: 0.62, L: 0.42, mat: 2, seg: [0.7, 0, 0], cr: 0.55, hh: 0.62 },
    { kind: 'corner', mat: 0, seg: [0.8, 0, 0], cr: 0.72, hh: 1.1, dz: 0.4 }
  ];
  const NP = MOBILE ? 6 : ALL.length;
  const PIECES = ALL.slice(0, NP);
  PIECES.forEach(p => {
    p.bound = p.kind === 'bar' || p.kind === 'diag' ? Math.hypot(p.b[0], p.b[1], p.b[2]) : p.kind === 'miniz' ? p.s * Math.hypot(2.1, 2.1, 0.46 * 1.7) + 0.02 : 1.72;
    p.depth = p.kind === 'miniz' ? p.s * 0.46 * 1.7 : p.kind === 'corner' ? 0.42 : p.b[2];
    // local half extents (a box around the piece), for depth- and orientation-correct ceilings
    p.ext = p.kind === 'bar' || p.kind === 'diag' ? p.b.slice() : p.kind === 'miniz' ? [2.1 * p.s, (BAR_Y + 0.59) * p.s, 0.46 * 1.7 * p.s] : [1.45, 1.1, 0.42];
  });

  /* ------------------------------------------------------------ shader */
  const f = n => (Math.round(n * 10000) / 10000).toFixed(4);
  const v3 = a => `vec3(${f(a[0])},${f(a[1])},${f(a[2])})`;
  function sdfFn(p, i) {
    if (p.kind === 'bar') return `float sd${i}(vec3 p){ return smax(sdRBox(p,${v3(p.b)},${f(p.r)}),-sdGroove(p,${f(p.L)},${f(p.b[2])}),0.025); }
float gv${i}(vec3 p){ return gvFace(p,${f(p.L)},${f(p.b[2])}); }`;
    if (p.kind === 'diag') return `float sd${i}(vec3 p){ float d=smax(sdRBox(p,${v3(p.b)},${f(p.r)}),abs(dot(p.xy,vec2(${f(SN)},${f(CT)})))-${f(p.cut)},0.06); return smax(d,-sdGroove(p,${f(p.L)},${f(p.b[2])}),0.025); }
float gv${i}(vec3 p){ return gvFace(p,${f(p.L)},${f(p.b[2])}); }`;
    if (p.kind === 'miniz') {
      const s = p.s, dz = 0.46 * 1.7 * s;
      return `float sd${i}(vec3 p){ vec3 bb=vec3(${f(2.1 * s)},${f(0.59 * s)},${f(dz)});
  float d=min(sdRBox(p-vec3(0.,${f(BAR_Y * s)},0.),bb,${f(0.09)}),sdRBox(p+vec3(0.,${f(BAR_Y * s)},0.),bb,${f(0.09)}));
  vec3 q=rz(p); float e=smax(sdRBox(q,vec3(${f(2.7 * s)},${f(0.505 * s)},${f(dz * 0.94)}),${f(0.08)}),abs(p.y)-${f(1.17 * s)},0.03);
  return min(d,e); }
float gv${i}(vec3 p){ return 1e3; }`;
    }
    // corner: a stroke bar with the diagonal leaving its right end, the Z's top-right joint
    return `float sd${i}(vec3 p){ vec3 a=p-vec3(-0.25,0.55,0.); float d=sdRBox(a,vec3(1.15,0.5,0.42),0.19); d=smax(d,-sdGroove(a,0.62,0.42),0.025);
  vec3 q=rz(p-vec3(0.12,-0.32,0.)); float e=smax(sdRBox(q,vec3(1.2,0.43,0.40),0.17),abs(p.y+0.1)-0.95,0.05);
  return min(d,e); }
float gv${i}(vec3 p){ return gvFace(p-vec3(-0.25,0.55,0.),0.62,0.42); }`;
  }
  const MATS = [
    { alb: 'vec3(1.0,0.115,0.018)', gloss: '1.0', sss: '1.0', gro: 'vec3(0.018,0.016,0.02)', fl: 'vec3(0.42,0.035,0.004)' },
    { alb: 'vec3(0.88,0.07,0.012)', gloss: '1.0', sss: '1.0', gro: 'vec3(0.018,0.016,0.02)', fl: 'vec3(0.36,0.025,0.003)' },
    { alb: 'vec3(0.80,0.80,0.78)', gloss: '0.85', sss: '0.2', gro: 'vec3(1.0,0.115,0.018)', fl: 'vec3(0.10,0.10,0.11)' },
    { alb: 'vec3(0.013,0.013,0.017)', gloss: '1.25', sss: '0.0', gro: 'vec3(1.0,0.115,0.018)', fl: 'vec3(0.22,0.22,0.24)' }
  ];
  const STEPS = MOBILE ? 48 : 72, SH = MOBILE ? 12 : 20, AOS = MOBILE ? 3 : 4;

  const vert = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
  const makeFrag = (hp, nh) => `precision ${hp} float;
#define NP ${NP}
uniform vec2 uRes; uniform vec3 uCamPos; uniform mat3 uCam; uniform float uTan;
uniform vec3 uP[NP]; uniform mat3 uR[NP];
uniform vec3 uL; uniform vec4 uPlane; uniform float uFloor; uniform float uShadowA; uniform vec4 uFade;
// Output confinement (render px, y up): GL may only draw inside uBand and never inside a hole (text boxes).
// uClipK: x feather width, y global alpha. It masks pieces and floor shadow alike, whatever the physics does.
uniform vec4 uBand; uniform vec2 uClipK;${nh ? `\nuniform vec4 uHole[${nh}];` : ''}
float clipM(vec2 f){
  float k=uClipK.x;
  float m=smoothstep(uBand.x,uBand.x+k,f.x)*(1.-smoothstep(uBand.z-k,uBand.z,f.x))*smoothstep(uBand.y,uBand.y+k,f.y)*(1.-smoothstep(uBand.w-k,uBand.w,f.y));
${nh ? `  for(int i=0;i<${nh};i++){ vec2 q=max(uHole[i].xy-f,f-uHole[i].zw); m*=smoothstep(0.,k,max(q.x,q.y)); }\n` : ''}  return m*uClipK.y;
}

float sdRBox(vec3 p, vec3 b, float r){ vec3 q=abs(p)-(b-r); return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r; }
float smax(float a, float b, float k){ float h=max(k-abs(a-b),0.)/k; return max(a,b)+h*h*k*.25; }
float sdGroove(vec3 p, float L, float z){ vec3 q=vec3(p.x-clamp(p.x,-L,L),p.y,p.z-z); return length(q)-${f(GR)}; }
// groove colour mask: distance to the groove axis in the face plane (insensitive to where along the ray the hit landed,
// which beaded the inlay edge), limited to the front of the piece so the back face stays plain
float gvFace(vec3 p, float L, float z){ return max(length(vec2(p.x-clamp(p.x,-L,L),p.y))-${f(GR)},z-0.16-p.z); }
vec3 rz(vec3 p){ return vec3(${f(CT)}*p.x+${f(SN)}*p.y,-${f(SN)}*p.x+${f(CT)}*p.y,p.z); }
${PIECES.map(sdfFn).join('\n')}

float mapD(vec3 p, out float id){
  float d=1e5; id=-1.; float b; float e;
${PIECES.map((p, i) => `  b=length(p-uP[${i}])-${f(p.bound)}; if(b<d){ e=sd${i}(uR[${i}]*(p-uP[${i}])); if(e<d){d=e;id=${i}.;} }`).join('\n')}
  return d;
}
float mapS(vec3 p){ float id; return mapD(p,id); }
// tetrahedral normal as a loop: one inlined map call instead of four keeps ANGLE/D3D compile time ~5x lower
vec3 calcN(vec3 p){ vec3 n=vec3(0.);
  for(int i=0;i<4;i++){ vec3 e=i==0?vec3(1.,-1.,-1.):i==1?vec3(-1.,-1.,1.):i==2?vec3(-1.,1.,-1.):vec3(1.); n+=e*mapS(p+e*0.0015); }
  return normalize(n); }
float softSh(vec3 ro, vec3 rd, float k, float tmax){ float res=1.; float t=0.03;
  for(int i=0;i<${SH};i++){ float h=mapS(ro+rd*t); res=min(res,k*h/t); t+=clamp(h,0.04,0.6); if(res<0.01||t>tmax) break; }
  return clamp(res,0.,1.); }
float calcAO(vec3 p, vec3 n){ float o=0.; float s=1.;
  for(int i=1;i<=${AOS};i++){ float h=0.03+0.12*float(i); float d=mapS(p+n*h); o+=(h-d)*s; s*=0.75; }
  return clamp(1.-1.6*o,0.,1.); }
vec3 hash3(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float speck(vec3 p){ ${MOBILE ? 'return 0.;' : 'vec3 q=p*6.5; vec3 h=hash3(floor(q)); float d=length(fract(q)-(.25+.5*h)); return (1.-smoothstep(.06,.12,d))*step(.5,h.x);'} }
vec3 env(vec3 r){
  vec3 c=mix(vec3(0.34,0.35,0.40),vec3(0.92,0.93,0.97),smoothstep(-0.35,0.7,r.y));
  c+=vec3(4.2)*smoothstep(0.80,0.94,dot(r,normalize(vec3(-0.55,0.72,0.42))));
  c+=vec3(2.0)*smoothstep(0.10,0.02,abs(r.x-0.72))*smoothstep(-0.25,0.35,r.y)*step(0.,r.z+0.3);
  c+=vec3(1.1,0.55,0.35)*0.9*smoothstep(0.86,0.98,dot(r,normalize(vec3(0.7,-0.25,0.65))));
  c*=mix(0.18,1.,smoothstep(-0.55,0.05,r.y));
  return c;
}
vec3 shade(vec3 p, vec3 rd, float id, float fw){
  vec3 n=calcN(p); float hw=max(0.013,fw); // inlay edge width follows the pixel footprint
  vec3 alb=vec3(1.); float gloss=1.; float sss=0.; vec3 gro=vec3(0.); vec3 fl=vec3(0.); float g=0.; vec3 lp=p;
${PIECES.map((p, i) => { const m = MATS[p.mat]; return `  ${i ? 'else ' : ''}if(id<${i}.5){ lp=uR[${i}]*(p-uP[${i}]); alb=${m.alb}; gloss=${m.gloss}; sss=${m.sss}; gro=${m.gro}; fl=${m.fl}; g=1.-smoothstep(0.017-hw,0.017+hw,gv${i}(lp)); }`; }).join('\n')}
  alb=mix(alb,fl,speck(lp)*0.9);
  alb=mix(alb,gro,g); gloss=mix(gloss,0.04,g); sss*=1.-g; // a matte inlay: the concave channel's glints beaded along the groove
  float dif=clamp(dot(n,uL),0.,1.);
  float sh=dif>0.001?softSh(p+n*0.02,uL,9.,9.):0.;
  float occ=calcAO(p,n);
  vec3 h=normalize(uL-rd);
  float nh=clamp(dot(n,h),0.,1.);
  float nv=clamp(dot(n,-rd),0.,1.);
  float fre=0.04+0.96*pow(1.-nv,5.);
  vec3 amb=mix(vec3(0.28,0.29,0.34),vec3(0.98,0.98,1.02),n.y*0.5+0.5);
  vec3 col=alb*(amb*0.55*occ+vec3(1.35,1.28,1.18)*dif*sh);
  col+=alb*alb*sss*0.5*pow(clamp(1.-nv,0.,1.),2.)*occ;
  col+=alb*sss*0.22*clamp(-dot(n,uL)*0.5+0.5,0.,1.)*occ*vec3(1.,0.6,0.5);
  vec3 rf=env(reflect(rd,n));
  col=mix(col,rf*(0.35+0.65*occ),clamp(fre*gloss,0.,1.));
  col+=vec3(1.)*pow(nh,220.)*sh*2.8*gloss;
  col+=vec3(1.)*pow(nh,30.)*sh*0.1*gloss;
  return col;
}
vec3 tone(vec3 c){ c=c/(1.+c*0.18); return pow(clamp(c,0.,1.),vec3(1./2.2)); }

void main(){
  float clipA=clipM(gl_FragCoord.xy);
  if(clipA<=0.){ gl_FragColor=vec4(0.); return; }
  vec2 uv=(gl_FragCoord.xy*2.-uRes)/uRes.y;
  vec3 ro=uCamPos; vec3 rd=normalize(uCam*vec3(uv*uTan,1.));
  float pix=2.*uTan/uRes.y;
  float t0=1e5; float t1=-1.; vec3 oc; float bb; float cc; float hh;
${PIECES.map((p, i) => `  oc=ro-uP[${i}]; bb=dot(oc,rd); cc=dot(oc,oc)-${f((p.bound + 0.05) ** 2)}; hh=bb*bb-cc; if(hh>0.){ hh=sqrt(hh); t0=min(t0,-bb-hh); t1=max(t1,-bb+hh); }`).join('\n')}
  vec4 outc=vec4(0.);
  float hitId=-1.; float t=max(t0,0.); float minR=1e5; float minT=0.; float id;
  if(t1>0.){
    for(int i=0;i<${STEPS};i++){
      vec3 p=ro+rd*t; float d=mapD(p,id);
      float r=d/(pix*t); if(r<minR){minR=r;minT=t;}
      if(d<0.0006*t){hitId=id;break;}
      t+=d; if(t>t1) break;
    }
  }
  float shA=0.;
  float dn=dot(uPlane.xyz,rd);
  if(abs(dn)>1e-4){
    float tp=-(dot(uPlane.xyz,ro)+uPlane.w)/dn;
    if(tp>0.){
      vec3 q=ro+rd*tp; bool need=false; float s; vec3 pr;
      float dl=dot(uPlane.xyz,uL);
${PIECES.map((p, i) => `      if(!need){ s=(dot(uPlane.xyz,uP[${i}])+uPlane.w)/dl; pr=uP[${i}]-uL*s; need=length(q-pr)<${f(p.bound * 1.6)}+abs(s)*0.9; }`).join('\n')}
      if(need){
        float sh=softSh(q+uPlane.xyz*0.01,uL,uFloor>0.?5.5:7.,14.);
        float o=clamp(mapS(q+uPlane.xyz*0.35)/0.9,0.,1.);
        shA=((1.-sh)*0.9+(1.-o)*uFloor)*uShadowA;
      }
    }
  }
  // the floor shadow fades out before it reaches copy: below uFade.x..y (headline / stage button), above uFade.z..w (clock line / caption)
  shA*=smoothstep(uFade.x,uFade.y,gl_FragCoord.y)*(1.-smoothstep(uFade.z,uFade.w,gl_FragCoord.y));
  vec4 bg=vec4(vec3(0.16,0.10,0.10)*shA,shA);
  // a single shade() call site (hit or edge coverage) halves what the driver has to inline
  float cov=0.; vec3 sp=ro; float sid=-1.;
  if(hitId>=0.){ cov=1.; sp=ro+rd*t; sid=hitId; }
  else if(minR<1.){ sp=ro+rd*minT; mapD(sp,sid); cov=1.-smoothstep(0.,1.,minR); }
  outc=bg;
  if(cov>0.) outc=vec4(tone(shade(sp,rd,sid,pix*length(sp-ro)))*cov,cov)+bg*(1.-cov);
  gl_FragColor=outc*clipA;
}`;
  // FXAA 3.11-style pass (luma includes alpha so dark pieces over the transparent page are smoothed too).
  // The raymarch renders into the bottom-left `sc` fraction of a target allocated once at the maximum size;
  // this pass stretches that sub-rectangle over the canvas, so a quality step never reallocates anything.
  const fxaa = `precision mediump float; uniform sampler2D t; uniform vec2 px; uniform vec2 sc; varying vec2 v;
float L(vec4 c){ return dot(c.rgb,vec3(.299,.587,.114))+c.a*.5; }
void main(){
  vec2 u=min(v*sc,sc-px*.5);
  vec4 cNW=texture2D(t,u+vec2(-1.,-1.)*px), cNE=texture2D(t,u+vec2(1.,-1.)*px), cSW=texture2D(t,u+vec2(-1.,1.)*px), cSE=texture2D(t,u+vec2(1.,1.)*px), cM=texture2D(t,u);
  float lNW=L(cNW), lNE=L(cNE), lSW=L(cSW), lSE=L(cSE), lM=L(cM);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  if(lMax-lMin<max(.04,lMax*.1)){ gl_FragColor=cM; return; }
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),(lNW+lSW)-(lNE+lSE));
  float red=max((lNW+lNE+lSW+lSE)*.03125,1./128.);
  dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+red),vec2(-8.),vec2(8.))*px;
  vec4 A=.5*(texture2D(t,u+dir*(1./3.-.5))+texture2D(t,u+dir*(2./3.-.5)));
  vec4 B=A*.5+.25*(texture2D(t,u-dir*.5)+texture2D(t,u+dir*.5));
  float lB=L(B);
  gl_FragColor=(lB<lMin||lB>lMax)?A:B;
}`;

  /* Shaders are compiled after first paint and, where KHR_parallel_shader_compile exists, off the main thread
     (status is only polled, never blocked on), so a slow driver can't freeze scrolling or taps after load.
     Until the pieces are ready the static SVG Z holds their place (html.gl-pending). */
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function program(vs, fs) {
    const a = compile(gl.VERTEX_SHADER, vs), b = compile(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
    return { p, fs: b };
  }
  function linked(o) {
    if (gl.getProgramParameter(o.p, gl.LINK_STATUS)) return o.p;
    if (!gl.isContextLost()) console.warn('[zstore] shader', gl.getShaderInfoLog(o.fs) || gl.getProgramInfoLog(o.p));
    return null;
  }
  let prog = null, post = null, U = {}, PU = null, ready = false, NH = 0, HB = null;
  // Output confinement in CSS px (y down), recomputed every frame from the DOM: GL draws only inside `band`, never inside
  // `holes` (every hero text box, measured with margin), softened over `feather` px, times a global `alpha`.
  const CLIP = { band: [-1e4, -1e4, 1e4, 1e4], holes: [], feather: 12, alpha: 1 };
  let fbo = null, tex = null, useFx = false;
  function boot() {
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', depth: false, stencil: false }); } catch (e) { gl = null; }
    if (!gl) { noGL(); return; }
    let hp = 'highp';
    try { const pf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); if (!pf || pf.precision === 0) hp = 'mediump'; } catch (e) {}
    // text holes are a uniform array: take as many as the fragment uniform budget allows (up to 12)
    let maxU = 16; try { maxU = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 16; } catch (e) {}
    NH = clamp(maxU - (13 + 4 * NP) - 2, 0, 12); HB = new Float32Array(Math.max(1, NH) * 4);
    const main = program(vert, makeFrag(hp, NH)), fx = program(vert, fxaa);
    const ext = gl.getExtension('KHR_parallel_shader_compile');
    const done = () => {
      prog = linked(main);
      if (!prog) { noGL(); return; }
      post = linked(fx);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uCamPos', 'uCam', 'uTan', 'uL', 'uPlane', 'uFloor', 'uShadowA', 'uFade', 'uBand', 'uClipK'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
      U.uP = gl.getUniformLocation(prog, 'uP[0]'); U.uR = gl.getUniformLocation(prog, 'uR[0]');
      U.uHole = NH ? gl.getUniformLocation(prog, 'uHole[0]') : null;
      PU = post ? { t: gl.getUniformLocation(post, 't'), px: gl.getUniformLocation(post, 'px'), sc: gl.getUniformLocation(post, 'sc') } : null;
      useFx = !!post; applySize(); layoutKey = keyNow();
      ready = true;
      root.classList.remove('gl-pending'); root.classList.add('has-gl');
      measureHero(); kick();
      // subscribed here, not at eval time: touching document.fonts before first paint forces a layout
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ready) { measureHero(); kick(); } }).catch(() => {});
    };
    if (!ext) { done(); return; }
    const poll = () => {
      if (gl.isContextLost()) return;
      if (gl.getProgramParameter(main.p, ext.COMPLETION_STATUS_KHR) && gl.getProgramParameter(fx.p, ext.COMPLETION_STATUS_KHR)) done();
      else setTimeout(poll, 40);
    };
    setTimeout(poll, 40);
  }
  function allocTarget(w, h) {
    if (!post) return;
    if (tex) gl.deleteTexture(tex);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (!fbo) fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    useFx = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ------------------------------------------------------------ math */
  const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qAx = (x, y, z, a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
  const qE = (rx, ry, rz) => qMul(qAx(0, 1, 0, ry), qMul(qAx(1, 0, 0, rx), qAx(0, 0, 1, rz)));
  const qNorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  const qRotV = (q, v) => { const [x, y, z, w] = q; const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2]; return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ------------------------------------------------------------ state */
  const S = PIECES.map((p, i) => ({ i, p, pos: [0, 60 + i, 0], vel: [0, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0], T: [0, 0, 0], Q: [0, 0, 0, 1], delay: 0, seed: Math.random() * 100, up: false }));
  const cam = { pos: [0, 0, 20], f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0], tan: Math.tan(14 * PI / 180), D: 20 };
  let region = 'none', armed = false, buildLevel = 0, paused = false;
  const mouse = { x: -1e4, y: -1e4, nx: 0, ny: 0, snx: 0, sny: 0, speed: 0, active: false };
  // phones start a notch lower and only step up if frames stay well inside budget (see frame())
  // phones never climb above 0.9 (a DPR-3 raymarch at full 1.35 costs ~40% more for no visible gain)
  const QMIN = 0.45, QMAX = MOBILE ? 0.9 : 1;
  let W = 1, Hh = 1, scale = 1, quality = MOBILE ? 0.85 : 0.9, frames = 0, acc = 0, mnDt = 1, rw = 2, rh = 2;
  const heroEl = document.querySelector('[data-gl-hero]');
  const heroInner = document.querySelector('[data-hero-inner]');
  const heroStage = document.querySelector('[data-hero-stage]');
  const workEl = document.querySelector('[data-gl-cover]');
  const stageEl = document.querySelector('[data-gl-stage]');
  const navBar = document.querySelector('.nav-bar');
  const motionOff = () => root.classList.contains('motion-off');

  const scaleFor = q => {
    const dpr = devicePixelRatio || 1;
    let s = Math.min(dpr, MOBILE ? 1.35 : 1.5) * q;
    if (MOBILE && q >= 0.7) s = Math.max(s, Math.min(dpr, 1));
    return s;
  };
  // The canvas and the FXAA target are sized once for the best quality this device may reach (only a real viewport
  // resize reallocates them). Adaptive quality just changes the raymarch viewport (rw x rh) inside that target.
  function applySize() {
    W = canvas.clientWidth || innerWidth; Hh = canvas.clientHeight || innerHeight;
    const top = scaleFor(QMAX);
    const cw = Math.max(2, Math.round(W * top)), ch = Math.max(2, Math.round(Hh * top));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; allocTarget(cw, ch); }
    else if (post && !tex) allocTarget(cw, ch);
    setQuality(quality);
  }
  function setQuality(q) {
    quality = q;
    if (useFx) {
      const s = Math.min(scaleFor(q), scaleFor(QMAX));
      rw = Math.min(canvas.width, Math.max(2, Math.round(W * s))); rh = Math.min(canvas.height, Math.max(2, Math.round(Hh * s)));
    } else { rw = canvas.width; rh = canvas.height; }
    scale = rw / W;
  }

  function setCamera(target, pitch, H) {
    const D = H / (2 * cam.tan); cam.D = D;
    const fwd = [0, Math.sin(pitch), -Math.cos(pitch)];
    cam.f = fwd; cam.r = [1, 0, 0]; cam.u = [0, Math.cos(pitch), Math.sin(pitch)];
    cam.pos = [target[0] - fwd[0] * D, target[1] - fwd[1] * D, target[2] - fwd[2] * D];
  }
  function rayFrom(x, y) {
    const a = W / Hh; const ux = ((x / W) * 2 - 1) * a * cam.tan, uy = (1 - (y / Hh) * 2) * cam.tan;
    const d = [cam.r[0] * ux + cam.u[0] * uy + cam.f[0], cam.r[1] * ux + cam.u[1] * uy + cam.f[1], cam.r[2] * ux + cam.u[2] * uy + cam.f[2]];
    const l = Math.hypot(d[0], d[1], d[2]); return [d[0] / l, d[1] / l, d[2] / l];
  }
  function planeHitAt(x, y, n, w) {
    const rd = rayFrom(x, y), ro = cam.pos;
    const dn = n[0] * rd[0] + n[1] * rd[1] + n[2] * rd[2]; if (Math.abs(dn) < 1e-4) return null;
    const t = -(n[0] * ro[0] + n[1] * ro[1] + n[2] * ro[2] + w) / dn; if (t < 0) return null;
    return [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
  }

  /* ------------------------------------------------------------ hero layout: fit the Z to its stage, keep satellites off the copy */
  const Z_LOCAL = [[0, BAR_Y, 0, 0], [0, 0, 0.03, TH], [0, -BAR_Y, 0, 0]];
  const SAT = { // stage-relative anchor [ax, ay, z, rx, ry, rz]
    desk: [[-0.5, 0.1, 0.7, 0.35, 0.5, 0.3], [1.02, 0.06, -0.5, 0.5, -0.5, -0.45], [-0.18, 0.95, 0.9, -0.4, 0.4, 0.25], [1.0, 0.86, 0.5, 0.2, -0.6, 0.6], [-0.9, 0.58, -0.8, 0.6, 0.3, -0.35]],
    mob: [[0.06, 0.12, 0.5, 0.35, 0.5, 0.3], [0.95, 0.34, -0.4, 0.5, -0.5, -0.45], [0.9, 0.96, 0.7, -0.4, 0.4, 0.25]]
  };
  const HL = { ok: false, upp: 0.01, H: 10, zc: [0, 0], sats: [], rects: [] };
  const inside = (pt, R, r) => pt.x > R.l - r && pt.x < R.r + r && pt.y > R.t - r && pt.y < R.b + r;
  function pushOut(pt, r, rects, B) {
    for (let it = 0; it < 8; it++) {
      const hit = rects.find(R => inside(pt, R, r)); if (!hit) return true;
      const opts = [{ x: hit.l - r - 2, y: pt.y }, { x: hit.r + r + 2, y: pt.y }, { x: pt.x, y: hit.t - r - 2 }, { x: pt.x, y: hit.b + r + 2 }]
        .filter(o => o.x >= B.l && o.x <= B.r && o.y >= B.t && o.y <= B.b)
        .sort((a, b) => Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y));
      if (!opts.length) return false;
      const free = opts.find(o => !rects.some(R => inside(o, R, r)));
      pt.x = (free || opts[0]).x; pt.y = (free || opts[0]).y;
    }
    return !rects.some(R => inside(pt, R, r));
  }
  function measureHero() {
    if (!heroInner || !heroStage || !heroEl) return;
    // un-scale with the transform .hero-inner really has now: on a jump back to the top this frame runs before app.js
    // writes the new --hp, so the scroll position alone would give the wrong scale (and holes 8% off the copy)
    let s = 1; const mt = /matrix\(([^,]+)/.exec(getComputedStyle(heroInner).transform || ''); if (mt) s = parseFloat(mt[1]) || 1;
    const before = region === 'hero' && HL.ok ? S.map(st => st.T.slice()) : null;
    const hr = heroEl.getBoundingClientRect();
    const ox = hr.left + heroInner.offsetLeft + heroInner.offsetWidth / 2, oy = hr.top + heroInner.offsetTop + heroInner.offsetHeight;
    const un = r => ({ l: ox + (r.left - ox) / s, r: ox + (r.right - ox) / s, t: oy + (r.top - oy) / s, b: oy + (r.bottom - oy) / s });
    const st = un(heroStage.getBoundingClientRect());
    // on short phones the stage row can be squeezed: never let the Z band run into the meta line or the headline stacked above/below it
    const xOver = R => R.l < st.r && R.r > st.l;
    const metaEl = heroEl.querySelector('.hero-meta'), titleEl = heroEl.querySelector('.hero-title');
    if (metaEl && metaEl.getClientRects().length) { const m = un(metaEl.getBoundingClientRect()); if (xOver(m) && m.b < st.b) st.t = Math.max(st.t, m.b + 6); }
    if (titleEl) { const tr = un(titleEl.getBoundingClientRect()); if (xOver(tr) && tr.t > st.t) st.b = Math.min(st.b, tr.t - 4); }
    const sw = Math.max(80, st.r - st.l), sh = Math.max(80, st.b - st.t);
    const vis = innerHeight;
    // world units per pixel: the Z (4.2 units) fills the stage with a margin for its lean
    let upp = Math.max(5.3 / sh, 5.0 / sw);
    upp = Math.max(upp, 4.2 / (vis * 0.62));
    const H = upp * Hh; const D = H / (2 * cam.tan);
    const cx = (st.l + st.r) / 2, cy = (st.t + st.b) / 2;
    HL.upp = upp; HL.H = H; HL.zc = [(cx - W / 2) * upp, -(cy - Hh / 2) * upp];
    const margin = small() ? 12 : 16;
    const rects = [];
    heroEl.querySelectorAll('[data-avoid], .hero-title .w').forEach(el => {
      if (!el.getClientRects().length) return; const r = un(el.getBoundingClientRect());
      if (r.r - r.l < 2) return; rects.push({ l: r.l - margin, r: r.r + margin, t: r.t - margin, b: r.b + margin });
    });
    const navB = navBar ? navBar.getBoundingClientRect().bottom : 70;
    // Phones + tablets, where the clock line and the headline share the stage's column: every piece stays below the
    // clock line (so never under the nav capsule), the Z stays above the headline, and the floor shadow fades out
    // before either. Landscape (headline in its own column) is left free.
    const narrow = innerWidth < 1024;
    const metaR = metaEl && metaEl.getClientRects().length ? un(metaEl.getBoundingClientRect()) : null;
    const titleR = titleEl ? un(titleEl.getBoundingClientRect()) : null;
    // desktop too: every piece stays below the nav capsule, and the Z above a headline that runs under the stage
    const band = narrow && metaR && xOver(metaR) ? Math.max(navB, metaR.b) + 10 : navB + 8;
    const below = titleR && xOver(titleR) && titleR.t > st.t;
    HL.contain = narrow;
    HL.topY = -(band - Hh / 2) * upp;
    HL.botY = below ? -(titleR.t - 6 - Hh / 2) * upp : -1e4;
    HL.fadePx = below ? titleR.t : -1;
    HL.fadeTopPx = band > navB + 8 ? band : -1;
    HL.oW = [(ox - W / 2) * upp, -(oy - Hh / 2) * upp]; // the scroll-away scale origin in world units (z = 0)
    HL.rects = rects.map(R => ({ l: (R.l - W / 2) * upp, r: (R.r - W / 2) * upp, t: -(R.t - Hh / 2) * upp, b: -(R.b - Hh / 2) * upp }));
    // output mask: text boxes + 3px (unscaled like everything here; heroClip() applies the scroll-away scale each frame),
    // the nav bottom, and on phones/tablets the clock line as the top of the band
    HL.o = [ox, oy]; HL.navB = navB;
    HL.holes = rects.map(R => ({ l: R.l + margin - 3, r: R.r - margin + 3, t: R.t + margin - 3, b: R.b - margin + 3 }));
    HL.bandTopU = narrow && metaR && xOver(metaR) ? metaR.b + 8 : -1;
    const zr = { l: cx - 2.1 / upp, r: cx + 2.1 / upp, t: cy - 2.2 / upp, b: cy + 2.2 / upp };
    const shrink = small() ? 0.35 : 0.08; const zw = (zr.r - zr.l) * shrink, zh = (zr.b - zr.t) * shrink;
    const zrect = { l: zr.l + zw, r: zr.r - zw, t: zr.t + zh, b: zr.b - zh };
    const anchors = small() ? SAT.mob : SAT.desk;
    const placed = [];
    HL.sats = anchors.map((a, j) => {
      const stp = S[j + 3]; if (!stp) return null;
      const ds = D / (D - a[2]);
      const rpx = stp.p.bound * 0.8 / upp * ds;
      const pt = { x: st.l + a[0] * sw, y: st.t + a[1] * sh };
      // whole piece below the band top (clock line on phones, nav capsule everywhere)
      const B = { l: -rpx * 0.45, r: W + rpx * 0.45, t: band + rpx * (narrow ? 1.15 : 1.35), b: vis - rpx * 0.25 };
      const avoid = rects.concat([zrect], placed);
      pt.y = Math.max(pt.y, B.t);
      let ok = pushOut(pt, rpx, avoid, B);
      if (ok && pt.y < B.t) { pt.y = B.t; ok = pushOut(pt, rpx, avoid, B); }
      if (!ok) { pt.x = pt.x < W / 2 ? -rpx * 2.5 : W + rpx * 2.5; }
      placed.push({ l: pt.x - rpx * 0.75, r: pt.x + rpx * 0.75, t: pt.y - rpx * 0.75, b: pt.y + rpx * 0.75 });
      return { x: (pt.x - W / 2) * upp / ds, y: -(pt.y - Hh / 2) * upp / ds, z: a[2], rx: a[3], ry: a[4], rz: a[5] };
    });
    HL.ok = true;
    // a re-measure (fonts, load, resize) that moves the targets carries the pieces along instead of letting the springs
    // sweep them across the copy (first load at 1920: an ink satellite swept over the intro)
    if (before) {
      heroTargets(tNow);
      S.forEach((st, i) => { const d = [st.T[0] - before[i][0], st.T[1] - before[i][1], st.T[2] - before[i][2]]; if (Math.hypot(d[0], d[1]) / upp > 24) { st.pos[0] += d[0]; st.pos[1] += d[1]; st.pos[2] += d[2]; } });
    }
  }
  function heroProgress() {
    if (!workEl) return 0;
    return clamp(1 - workEl.getBoundingClientRect().top / innerHeight, 0, 1);
  }
  // hero mask for this frame: .hero-inner scales by 1 - hp*.08 about its bottom centre while the work slab rises
  function heroClip() {
    const s = 1 - heroProgress() * 0.08, o = HL.o || [W / 2, Hh];
    const sy = y => o[1] + (y - o[1]) * s, sx = x => o[0] + (x - o[0]) * s;
    let top = (HL.navB || 0) + 4;
    if (HL.bandTopU > 0) top = Math.max(top, sy(HL.bandTopU));
    CLIP.band = [-1e4, top, 1e4, 1e4]; CLIP.feather = 14;
    CLIP.holes = (HL.holes || []).map(R => [sx(R.l), sy(R.t), sx(R.r), sy(R.b)]);
  }
  function heroTargets(t) {
    const hpv = heroProgress(); const still = motionOff();
    // Scroll-away follows the copy: .hero-inner shrinks by s about its bottom centre while the work slab rises, so the
    // toy shrinks toward the same point by receding in depth (dz) and turns away. Nothing lifts toward the clock or nav.
    const s = 1 - hpv * 0.08, O = HL.oW || [0, 0], D = cam.D, dz = D * (1 - 1 / s);
    const zc = [O[0] + (HL.zc[0] - O[0]) * s, O[1] + (HL.zc[1] - O[1]) * s];
    const c = [zc[0] / s, zc[1] / s, dz];
    const tilt = still ? qE(0.05, -0.32, 0) : qE(-mouse.sny * 0.14 + Math.sin(t * 0.5) * 0.04 + 0.05, mouse.snx * 0.3 + Math.sin(t * 0.37) * 0.1 - 0.32 + hpv * 0.7, hpv * 0.06 + Math.sin(t * 0.29) * 0.02);
    for (let i = 0; i < 3; i++) {
      const l = Z_LOCAL[i]; const off = qRotV(tilt, [0, l[1], l[2] + (i - 1) * hpv * 0.8]);
      S[i].T = [c[0] + off[0], c[1] + off[1], c[2] + off[2]];
      S[i].Q = qMul(tilt, qE(0, 0, l[3]));
    }
    HL.sats.forEach((sa, j) => {
      const st = S[j + 3]; if (!st || !sa) return;
      const bob = still ? 0 : Math.sin(t * 0.9 + st.seed) * 0.14;
      const par = 1 + sa.z * 0.08;
      // anchor on screen (world units at z = 0) → scaled toward the origin, drifting outward and down, receding
      const k0 = D / (D - sa.z), px = sa.x * k0, py = sa.y * k0;
      const tx = O[0] + (px - O[0]) * s + (px - zc[0]) * hpv * 0.25, ty = O[1] + (py - O[1]) * s - hpv * (0.5 + j * 0.2);
      const tz = sa.z + dz - hpv * 0.6, k1 = (D - tz) / D;
      st.T = [tx * k1 + mouse.snx * 0.3 * par, ty * k1 + bob - mouse.sny * 0.22 * par, tz];
      const sway = still ? 0 : Math.sin(t * 0.33 + j * 1.7) * 0.45;
      st.Q = qE(sa.rx + (still ? 0 : Math.sin(t * 0.4 + j) * 0.12), sa.ry + sway, sa.rz);
    });
  }
  // pieces pop out of their own spot, from deeper in the scene (keeping their screen position), with a little spin
  function popIn() {
    const D = cam.D;
    S.forEach((st, i) => {
      const z0 = st.T[2] - 2.2 - rand(0, 1), k = (D - z0) / (D - st.T[2]);
      st.pos = [st.T[0] * k, st.T[1] * k, z0];
      st.vel = [0, 0, rand(3, 6)]; st.q = qNorm([st.Q[0] + rand(-0.3, 0.3), st.Q[1] + rand(-0.3, 0.3), st.Q[2] + rand(-0.3, 0.3), st.Q[3]]);
      st.w = [rand(-3, 3), rand(-3, 3), rand(-3, 3)]; st.delay = i * 0.05;
    });
  }

  /* ------------------------------------------------------------ contact: a composed kit on a tray that builds into a standing Z */
  // Resting kit: every piece lies groove-up in tidy rows, like a toy in its box insert. [x, z, flipped]
  const ZC = 0.35, TRAY = 0.08;
  const KIT = [[-2.6, -1.75, 0], [-1.9, 0.35, 0], [2.6, -1.75, 0], [-4.3, 1.75, 0], [2.4, 0, 0], [-1.8, 1.75, 0], [0.9, 1.75, 0], [3.9, 1.75, 1]];
  // Phones: the two ink pieces sit at opposite corners (back right, front left) with the porcelain corner between the
  // rows, so no dark piece ever lies behind the other one under the tilted camera.
  const KIT_M = [[-1.1, -1.8, 0], [-1.2, 0, 0], [1.3, 1.8, 0], [2.9, -1.8, 0], [3.0, 0, 0], [-2.8, 1.8, 0]];
  // Touch tablets and landscape phones (6 pieces on the wide tray): the ink stub takes the front-right slot the 8-piece
  // kit fills with porcelain, so it doesn't lie against the ink mini-Z at the front left.
  const KIT_T = [[-2.6, -1.75, 0], [-1.9, 0.35, 0], [2.6, -1.75, 0], [-4.1, 1.75, 0], [2.4, 0, 0], [1.3, 1.8, 0]];
  // Phones, built: the satellites lie in a tidy row at the front of the tray, clear of the Z's bottom stroke. [x]
  const ROW_M = [null, null, null, -2.75, 0.1, 2.85];
  // While the Z is being built it stands where the middle rows were, so the pieces in its way move aside.
  const MOVE = { 4: [4.3, -1.2, 0] };
  const MOVE_M = { 3: [3.4, -1.9, 0], 4: [2.9, 1.9, 0] };
  // Built: the Z stands at the back; the other pieces stand in front of it ('f', outside its bottom stroke), flank it
  // ('b') or lie low in front of it ('l', below the stroke on screen). [x, row, ry]
  const SHOW = [null, null, null, [-3.25, 'f', 0.25], [-3.95, 'b', 0.3], [0, 'l', 0], [3.25, 'f', -0.2], [3.95, 'b', PI - 0.3]];
  const SHOW_M = [null, null, null, [-2.35, 'f', 0.2], [2.35, 'f', -0.2], [0, 'f', 0]];
  const CL = { walls: [-5.9, 5.9, ZC - 2.7, ZC + 2.95] };
  const Z_Z = ZC - 1.1, Z_RY = -0.28;
  const stageCap = stageEl && stageEl.querySelector('.stage-cap'), stageBtn = stageEl && stageEl.querySelector('.stage-btn');
  function project(p) {
    const v = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
    const dz = Math.max(0.1, v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2]);
    return { x: W / 2 + (v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2]) / (dz * cam.tan * (W / Hh)) * W / 2,
      y: Hh / 2 - (v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2]) / (dz * cam.tan) * Hh / 2 };
  }
  // World y whose projection lands on the stage's ceiling line (caption bottom + feather) for a point at depth z. The
  // contact camera has no roll or yaw, so x drops out: (v·u) / (v·f) = (1 - 2y/H)·tan solves linearly for v.y.
  function ceilY(z) {
    const k = (1 - 2 * (CL.capLine || 0) / Hh) * cam.tan, b = z - cam.pos[2];
    return cam.pos[1] + b * (k * cam.f[2] - cam.u[2]) / (cam.u[1] - k * cam.f[1]);
  }
  // Fit the whole scene (the built Z on top, the front row at the bottom) between the stage caption and the stage button,
  // so no state of the toy ever covers copy.
  function updateContactCamera() {
    const r = stageEl.getBoundingClientRect(); const mob = small();
    const box = el => el && el.getClientRects().length ? el.getBoundingClientRect() : null;
    const c = box(stageCap), b = box(stageBtn);
    const capB = c ? c.bottom : r.top + 60, btnT = b ? b.top : r.bottom - 60;
    const navB = navBar ? navBar.getBoundingClientRect().bottom : 0;
    // output band: the stage box between its caption and its button, never under the nav capsule. The scene is fitted
    // inside it with room for the feather, so the mask trims only motion, never the resting or built kit.
    CLIP.band = [r.left, Math.max(capB + 4, navB + 4), r.right, btnT - 4]; CLIP.holes = []; CLIP.feather = 12;
    const top = capB + 20, bot = btnT - 20;
    const free = Math.max(120, bot - top), L = r.left + 18, R = r.right - 18;
    CL.fade = [capB, btnT]; CL.capLine = capB + 16; // physics ceiling: where the mask reaches full strength
    const hw = mob ? 4.2 : 5.6, pitch = mob ? -0.46 : -0.42;
    CL.walls = [-hw - 0.3, hw + 0.3, ZC - 2.7, ZC + 2.95];
    // the built Z's top includes its back edge and a little headroom for the build hop and the celebrate jump
    const pts = [[0, 4.6, Z_Z - 0.46], [-2.2, 4.45, Z_Z - 0.46], [2.2, 4.45, Z_Z - 0.46], [-hw, 0, ZC + 2.7], [hw, 0, ZC + 2.7], [-hw, 0.2, ZC - 2.4], [hw, 0.2, ZC - 2.4]];
    let upp = Math.max(7 / free, (2 * hw) / (R - L)), px = 0, py = 0;
    const place = () => { setCamera([0, 1.6, ZC], pitch, upp * Hh); cam.pos = [cam.pos[0] + px, cam.pos[1] + cam.u[1] * py, cam.pos[2] + cam.u[2] * py]; };
    for (let it = 0; it < 4; it++) {
      place();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      pts.forEach(p => { const s = project(p); x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
      const s = Math.max((y1 - y0) / free, (x1 - x0) / (R - L));
      px += ((x0 + x1) / 2 - (L + R) / 2) * upp; py -= ((y0 + y1) / 2 - (top + bot) / 2) * upp;
      upp *= s;
    }
    place();
    return r;
  }
  function contactTargets() {
    const mob = small();
    const kit = mob ? KIT_M : NP < ALL.length ? KIT_T : KIT, show = mob ? SHOW_M : SHOW;
    const zOrder = [2, 1, 0]; // bottom bar, diagonal, top bar
    const ca = Math.cos(TRAY), sa = Math.sin(TRAY);
    for (let i = 0; i < NP; i++) {
      const st = S[i], p = st.p, zi = zOrder.indexOf(i);
      if (zi >= 0 && buildLevel > zi) {
        st.T = [0, [BAR_Y * 2 + 0.59, BAR_Y + 0.59, 0.59][i], Z_Z]; st.Q = qE(0, Z_RY, i === 1 ? TH : 0); st.up = true;
      } else if (zi < 0 && buildLevel >= 4 && (mob || NP < ALL.length)) {
        // phones + touch tablets (6 pieces): a tidy row at the front of the tray, spread to the tray's width
        st.T = [ROW_M[i] * (mob ? 1 : 1.3), p.depth, ZC + 2.05]; st.Q = qE(-PI / 2, 0, 0); st.up = false;
      } else if (zi < 0 && buildLevel >= 4 && show[i][1] === 'l') {
        st.T = [show[i][0], p.depth, ZC + 2.1]; st.Q = qE(-PI / 2, show[i][2], 0); st.up = false;
      } else if (zi < 0 && buildLevel >= 4) {
        const sh = show[i];
        st.T = [sh[0], p.hh, sh[1] === 'b' ? Z_Z + 0.15 : ZC + 1.25 + (i % 2) * 0.2]; st.Q = qE(0, sh[2], p.kind === 'diag' ? TH : 0); st.up = true;
      } else {
        const mv = buildLevel > 0 ? (mob ? MOVE_M : MOVE)[i] : null; const k = mv || kit[i];
        st.T = [k[0] * ca + k[1] * sa, p.depth, ZC - k[0] * sa + k[1] * ca]; st.Q = qE(-PI / 2, TRAY + (k[2] ? PI : 0), 0); st.up = false;
      }
    }
  }

  /* ------------------------------------------------------------ input */
  function onMove(x, y) {
    const dx = x - mouse.x, dy = y - mouse.y;
    if (mouse.active) mouse.speed = Math.min(60, mouse.speed * 0.6 + Math.hypot(dx, dy) * 0.4);
    mouse.x = x; mouse.y = y; mouse.active = true;
    mouse.nx = (x / W) * 2 - 1; mouse.ny = (y / Hh) * 2 - 1;
    if (region !== 'none') kick(); // pointer moves can't change the region; scroll does
  }
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') onMove(e.clientX, e.clientY); }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; if (t) { mouse.active = false; onMove(t.clientX, t.clientY); mouse.speed = 26; } }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchend', () => { mouse.active = false; setTimeout(() => { if (!mouse.active) mouse.x = -1e4; }, 250); }, { passive: true });
  document.addEventListener('mouseleave', () => { mouse.x = -1e4; mouse.active = false; });

  heroEl && heroEl.addEventListener('pointerdown', e => {
    if (motionOff() || region !== 'hero' || e.target.closest('a,button')) return;
    const m = planeHitAt(e.clientX, e.clientY, [0, 0, 1], 0); if (!m) return;
    const mob = HL.contain; // phones + tablets: a softer, flatter shove that stays inside the stage band
    S.forEach(st => {
      const d = [st.pos[0] - m[0], st.pos[1] - m[1]]; const l = Math.hypot(d[0], d[1]) || 1;
      // desktop: the Z bars get less throw and more spin, so a burst reads as big without flinging a bar over the headline
      const k = 24 / (1 + l * 0.35) * (mob ? 0.5 : st.i < 3 ? 0.55 : 0.8);
      const vy = mob ? (d[1] > 0 ? 0.35 : 0.6) : (d[1] > 0 ? 0.7 : 0.9);
      const sp = mob ? 3 : st.i < 3 ? 10 : 8;
      st.vel[0] += d[0] / l * k; st.vel[1] += d[1] / l * k * vy; st.vel[2] += mob ? rand(0.4, 1.2) : rand(1.5, 4);
      // phones + tablets: the long Z bars barely roll, so a shove can't tip a bar's end up into the clock line
      const roll = mob && st.i < 3 ? 0.25 : 1;
      st.w[0] += rand(-sp, sp); st.w[1] += rand(-sp, sp); st.w[2] += rand(-sp, sp) * roll;
    });
    kick();
  });

  addEventListener('zs:build', e => {
    const lv = clamp(e.detail && e.detail.level || 0, 0, 4);
    if (lv === buildLevel) return;
    const prev = buildLevel; buildLevel = lv;
    if (region === 'contact' && armed) {
      contactTargets();
      if (motionOff()) snapToTargets();
      // a hop, not a throw: the spring lifts the piece, and the stage ceiling (step) keeps any overshoot under the caption
      else S.forEach(st => { if (st.up || prev > lv) { st.vel[1] += st.up ? 3.5 + rand(0, 1.2) : 2.5; st.w[0] += rand(-5, 5); st.w[2] += rand(-5, 5); st.delay = 0; } });
    }
    kick();
  });
  addEventListener('zs:celebrate', () => {
    if (region !== 'contact' || motionOff()) return;
    S.forEach((st, i) => { st.vel[1] += i < 3 ? 6 : 4.5; st.w[1] += i < 3 ? 14 : rand(-8, 8); });
    kick();
  });
  // A popup cancels the pending frame at once; closing resumes after a beat, so the close, the scroll unlock and
  // the history pop paint before the first full GL frame competes with them.
  let resumeT = 0;
  addEventListener('zs:popup', e => {
    clearTimeout(resumeT);
    if (e.detail && e.detail.open) { paused = true; if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
    resumeT = setTimeout(() => { paused = false; last = 0; kick(); }, 260);
  });

  /* ------------------------------------------------------------ physics */
  function snapToTargets() { S.forEach(st => { st.pos = st.T.slice(); st.vel = [0, 0, 0]; st.q = st.Q.slice(); st.w = [0, 0, 0]; st.delay = 0; }); }
  function step(dt, t) {
    if (region === 'hero') heroTargets(t);
    const inContact = region === 'contact';
    // hero limits follow the copy's scroll-away scale (heroTargets); rects are converted to each piece's depth below
    const hs = inContact ? 1 : 1 - heroProgress() * 0.08, hO = HL.oW || [0, 0];
    const topY = hO[1] + (HL.topY - hO[1]) * hs, botY = HL.botY > -1e3 ? hO[1] + (HL.botY - hO[1]) * hs : -1e4;
    const rectAt = (R, k) => ({ l: (hO[0] + (R.l - hO[0]) * hs) * k, r: (hO[0] + (R.r - hO[0]) * hs) * k, t: (hO[1] + (R.t - hO[1]) * hs) * k, b: (hO[1] + (R.b - hO[1]) * hs) * k });
    let m = null;
    if (mouse.x > -1e3 && !motionOff()) m = inContact ? planeHitAt(mouse.x, mouse.y, [0, 1, 0], -0.6) : planeHitAt(mouse.x, mouse.y, [0, 0, 1], 0);
    mouse.speed *= Math.pow(0.02, dt);
    mouse.snx += (mouse.nx - mouse.snx) * Math.min(1, dt * 3); mouse.sny += (mouse.ny - mouse.sny) * Math.min(1, dt * 3);

    for (const st of S) {
      if (st.delay > 0) { st.delay -= dt; continue; }
      const k = inContact ? 34 : 62, c = inContact ? 6.5 : 7.5;
      const a = [(st.T[0] - st.pos[0]) * k - st.vel[0] * c, (st.T[1] - st.pos[1]) * k - st.vel[1] * c, (st.T[2] - st.pos[2]) * k - st.vel[2] * c];
      if (inContact && !st.up) a[1] = -32 - st.vel[1] * 0.3;
      if (inContact && st.up) { a[1] = (st.T[1] - st.pos[1]) * 48 - st.vel[1] * 7; }
      if (m) {
        const ax = qRotV(st.q, st.p.seg);
        const ex = m[0] - st.pos[0], ey = m[1] - st.pos[1], ez = m[2] - st.pos[2];
        const al = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2];
        const s = al > 1e-5 ? clamp((ex * ax[0] + ey * ax[1] + ez * ax[2]) / al, -1, 1) : 0;
        const cx = st.pos[0] + ax[0] * s, cy = st.pos[1] + ax[1] * s, cz = st.pos[2] + ax[2] * s;
        const dx = cx - m[0], dy = inContact ? 0 : cy - m[1], dz = inContact ? cz - m[2] : 0;
        const dist = Math.hypot(dx, dy, dz) || 1e-3; const R = st.p.cr + (inContact ? 1.2 : 1.5);
        if (dist < R) {
          const energy = Math.min(1.1, mouse.speed / 14); // a resting pointer barely nudges; a fast one shoves
          const fall = 1 - dist / R; const pw = fall * fall * (inContact ? 140 : HL.contain ? 100 : 200) * (0.04 + energy);
          a[0] += dx / dist * pw; a[1] += dy / dist * pw; a[2] += dz / dist * pw + (inContact ? 0 : -fall * 20 * energy);
          if (inContact && !st.up && st.pos[1] <= st.T[1] + 0.05) st.vel[1] += fall * 0.9 * energy;
          const tw = fall * (0.4 + mouse.speed * 0.25) * dt * 8;
          st.w[0] += -dy / dist * tw - dz / dist * tw * 0.5; st.w[1] += dx / dist * tw * 0.6; st.w[2] += -dx / dist * tw;
        }
      }
      // keep hero satellites off the copy even while they are being shoved around
      if (!inContact && st.i >= 3) for (const R0 of HL.rects) {
        const R = rectAt(R0, Math.max(0.2, (cam.D - st.pos[2]) / cam.D)), pad = st.p.bound * 0.72;
        if (st.pos[0] > R.l - pad && st.pos[0] < R.r + pad && st.pos[1] < R.t + pad && st.pos[1] > R.b - pad) {
          const pl = st.pos[0] - (R.l - pad), pr = (R.r + pad) - st.pos[0], pt = (R.t + pad) - st.pos[1], pb = st.pos[1] - (R.b - pad);
          const mn = Math.min(pl, pr, pt, pb);
          if (mn === pl) a[0] -= 90 * pl; else if (mn === pr) a[0] += 90 * pr; else if (mn === pt) a[1] += 90 * pt; else a[1] -= 90 * pb;
        }
      }
      if (!inContact) { // every layout: a band under the clock line / nav, and the Z above a headline that runs under it
        const sat = st.i >= 3, pad = sat ? st.p.bound * 0.75 : 0.9;
        const hi = topY - pad;
        if (st.pos[1] > hi) { a[1] -= 260 * (st.pos[1] - hi); if (st.vel[1] > 0) st.vel[1] *= 0.5; }
        if (!sat && botY > -1e3) { // satellites already steer around each headline word; the Z itself stays above the headline
          const lo = botY + pad;
          if (st.pos[1] < lo) { a[1] += 260 * (lo - st.pos[1]); if (st.vel[1] < 0) st.vel[1] *= 0.5; }
        }
        if (st.pos[2] > 1.3) { a[2] -= 200 * (st.pos[2] - 1.3); if (st.vel[2] > 0) st.vel[2] *= 0.6; }
      }
      st.vel[0] += a[0] * dt; st.vel[1] += a[1] * dt; st.vel[2] += a[2] * dt;
      st.pos[0] += st.vel[0] * dt; st.pos[1] += st.vel[1] * dt; st.pos[2] += st.vel[2] * dt;
      if (inContact) {
        const floorY = st.up ? st.p.hh : st.T[1];
        if (st.pos[1] < floorY) {
          if (st.vel[1] < 0) { st.pos[1] = floorY; st.vel[1] *= -0.26; st.vel[0] *= 0.9; st.vel[2] *= 0.9; if (Math.abs(st.vel[1]) < 0.6) st.vel[1] = 0; }
          else st.vel[1] += (floorY - st.pos[1]) * 60 * dt;
        }
        const [xl, xr, zb, zf] = CL.walls; const pad = st.p.cr * 0.9;
        if (st.pos[0] < xl + pad) { st.pos[0] = xl + pad; st.vel[0] = Math.abs(st.vel[0]) * 0.3; }
        if (st.pos[0] > xr - pad) { st.pos[0] = xr - pad; st.vel[0] = -Math.abs(st.vel[0]) * 0.3; }
        if (st.pos[2] < zb) { st.pos[2] = zb; st.vel[2] = Math.abs(st.vel[2]) * 0.3; }
        if (st.pos[2] > zf) { st.pos[2] = zf; st.vel[2] = -Math.abs(st.vel[2]) * 0.3; }
      }
      let e = qMul(st.Q, [-st.q[0], -st.q[1], -st.q[2], st.q[3]]); if (e[3] < 0) e = [-e[0], -e[1], -e[2], -e[3]];
      const kr = inContact ? 26 : 30, cr = !inContact && HL.contain ? 8 : 5.5;
      st.w[0] += (e[0] * 2 * kr - st.w[0] * cr) * dt; st.w[1] += (e[1] * 2 * kr - st.w[1] * cr) * dt; st.w[2] += (e[2] * 2 * kr - st.w[2] * cr) * dt;
      const dq = qMul([st.w[0], st.w[1], st.w[2], 0], st.q);
      st.q = qNorm([st.q[0] + dq[0] * 0.5 * dt, st.q[1] + dq[1] * 0.5 * dt, st.q[2] + dq[2] * 0.5 * dt, st.q[3] + dq[3] * 0.5 * dt]);
    }
    for (let i = 0; i < NP; i++) for (let j = i + 1; j < NP; j++) {
      const A = S[i], B = S[j]; if (A.p.group && A.p.group === B.p.group) continue; if (A.delay > 0 || B.delay > 0) continue;
      // in the hero, satellites float on their own depth layers: they never knock the monogram out of shape
      if (!inContact && (A.p.group || B.p.group)) continue;
      const pa = closestOnAxis(A, B.pos), pb = closestOnAxis(B, pa);
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2]; const d = Math.hypot(dx, dy, dz) || 1e-3;
      const min = A.p.cr + B.p.cr;
      if (d < min) {
        const push = (min - d) * 0.5, cx = dx / d, cy = dy / d, cz = dz / d;
        A.pos[0] -= cx * push; A.pos[1] -= cy * push; A.pos[2] -= cz * push;
        B.pos[0] += cx * push; B.pos[1] += cy * push; B.pos[2] += cz * push;
        const rv = (B.vel[0] - A.vel[0]) * cx + (B.vel[1] - A.vel[1]) * cy + (B.vel[2] - A.vel[2]) * cz;
        if (rv < 0) { const im = -rv * 0.8; A.vel[0] -= cx * im * 0.5; A.vel[1] -= cy * im * 0.5; A.vel[2] -= cz * im * 0.5; B.vel[0] += cx * im * 0.5; B.vel[1] += cy * im * 0.5; B.vel[2] += cz * im * 0.5; A.w[2] += im * 0.8; B.w[2] -= im * 0.8; }
      }
    }
    // Hero, every layout, after collisions (which can push a piece anywhere): satellites are projected out of every text
    // rectangle (depth-corrected, inward velocity dropped), then a hard ceiling under the clock line / nav holds every
    // piece, and a hard floor keeps the Z bars above a headline that runs under the stage. World y is scaled by depth,
    // so the limits hold on screen; the Z bars use their exact rotated box, so a tipped bar end is caught too.
    if (!inContact) for (const st of S) {
      if (st.delay > 0) continue;
      const k = Math.max(0.2, (cam.D - st.pos[2]) / cam.D);
      if (st.i >= 3) for (const R0 of HL.rects) {
        const R = rectAt(R0, k), pad = st.p.bound * 0.75, x = st.pos[0], y = st.pos[1];
        if (x > R.l - pad && x < R.r + pad && y < R.t + pad && y > R.b - pad) {
          const pl = x - (R.l - pad), pr = (R.r + pad) - x, pt = (R.t + pad) - y, pb = y - (R.b - pad), mn = Math.min(pl, pr, pt, pb);
          if (mn === pl) { st.pos[0] = R.l - pad; if (st.vel[0] > 0) st.vel[0] = 0; }
          else if (mn === pr) { st.pos[0] = R.r + pad; if (st.vel[0] < 0) st.vel[0] = 0; }
          else if (mn === pt) { st.pos[1] = R.t + pad; if (st.vel[1] < 0) st.vel[1] = 0; }
          else { st.pos[1] = R.b - pad; if (st.vel[1] > 0) st.vel[1] = 0; }
        }
      }
      const ext = st.i < 3 ? extent(st, 1) + 0.06 : st.p.bound;
      const cap = topY * k - ext;
      if (st.pos[1] > cap) { st.pos[1] = cap; if (st.vel[1] > 0) st.vel[1] *= -0.25; }
      if (st.i < 3 && botY > -1e3) { const flo = botY * k + ext; if (st.pos[1] < flo) { st.pos[1] = flo; if (st.vel[1] < 0) st.vel[1] *= -0.25; } }
    }
    // Contact: a hard ceiling at the caption line for every piece (drop-in, build hops, celebrate, pointer lifts),
    // using the piece's rotated box and its far edge (farther points project higher under the tilted camera)
    if (inContact && armed) for (const st of S) {
      const cap = ceilY(st.pos[2] - extent(st, 2)) - extent(st, 1);
      if (st.pos[1] > cap) { st.pos[1] = cap; if (st.vel[1] > 0) st.vel[1] *= -0.2; }
    }
  }
  // half extent of a piece's local box along world axis ax (either matrix convention, like the renderer)
  function extent(st, ax) {
    const [x, y, z, w] = st.q, E = st.p.ext;
    const M = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
    let a = 0, b = 0;
    for (let j = 0; j < 3; j++) { a += Math.abs(M[ax * 3 + j]) * E[j]; b += Math.abs(M[j * 3 + ax]) * E[j]; }
    return Math.max(a, b);
  }
  function closestOnAxis(st, pt) {
    const ax = qRotV(st.q, st.p.seg); const al = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2];
    if (al < 1e-5) return st.pos;
    const s = clamp(((pt[0] - st.pos[0]) * ax[0] + (pt[1] - st.pos[1]) * ax[1] + (pt[2] - st.pos[2]) * ax[2]) / al, -1, 1);
    return [st.pos[0] + ax[0] * s, st.pos[1] + ax[1] * s, st.pos[2] + ax[2] * s];
  }

  /* ------------------------------------------------------------ render */
  const PB = new Float32Array(NP * 3), RB = new Float32Array(NP * 9), CB = new Float32Array(9);
  const NOHOLE = [-9000, -9000, -8990, -8990], NOBAND = [-1e4, -1e4, 1e4, 1e4];
  let maskOn = true; // QA only (window.__zstore.mask = false shows what the physics alone would draw)
  function render() {
    for (let i = 0; i < NP; i++) {
      const st = S[i];
      if (st.delay > 0 && st.pos[1] > 30) PB.set([0, 999, 0], i * 3); else PB.set(st.pos, i * 3);
      const [x, y, z, w] = st.q;
      RB.set([1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)], i * 9);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, useFx ? fbo : null);
    gl.viewport(0, 0, rw, rh);
    gl.useProgram(prog);
    gl.uniform2f(U.uRes, rw, rh);
    gl.uniform3fv(U.uCamPos, cam.pos);
    CB.set([...cam.r, ...cam.u, ...cam.f]); gl.uniformMatrix3fv(U.uCam, false, CB);
    gl.uniform1f(U.uTan, cam.tan);
    gl.uniform3fv(U.uP, PB); gl.uniformMatrix3fv(U.uR, false, RB);
    if (region === 'contact') {
      const L = [-0.42, 1.0, 0.5], l = Math.hypot(...L);
      gl.uniform3f(U.uL, L[0] / l, L[1] / l, L[2] / l);
      gl.uniform4f(U.uPlane, 0, 1, 0, 0); gl.uniform1f(U.uFloor, 0.55); gl.uniform1f(U.uShadowA, 0.42);
    } else {
      const L = [-0.42, 0.62, 0.9], l = Math.hypot(...L);
      gl.uniform3f(U.uL, L[0] / l, L[1] / l, L[2] / l);
      gl.uniform4f(U.uPlane, 0, 0, 1, 2.1); gl.uniform1f(U.uFloor, 0.0); gl.uniform1f(U.uShadowA, 0.16);
    }
    // fade bands in canvas pixels (GL y grows upward)
    const gy = px => (Hh - px) * scale;
    let f0 = -2, f1 = -1, f2 = 1e6, f3 = 1e6 + 1;
    if (region === 'hero') {
      if (HL.fadePx > 0) { f0 = gy(HL.fadePx); f1 = f0 + 110 * scale; }
      if (HL.fadeTopPx > 0) { f3 = gy(HL.fadeTopPx); f2 = f3 - 50 * scale; }
    } else if (region === 'contact' && CL.fade) {
      f0 = gy(CL.fade[1]); f1 = f0 + 40 * scale;
      f3 = gy(CL.fade[0]); f2 = f3 - 30 * scale;
    }
    gl.uniform4f(U.uFade, f0, f1, f2, f3);
    // output confinement (CSS px, y down → render px, y up)
    const sx = rw / W, sy = rh / Hh, B = maskOn ? CLIP.band : NOBAND;
    gl.uniform4f(U.uBand, B[0] * sx, (Hh - B[3]) * sy, B[2] * sx, (Hh - B[1]) * sy);
    gl.uniform2f(U.uClipK, Math.max(1, CLIP.feather * sx), CLIP.alpha);
    if (NH) {
      for (let i = 0; i < NH; i++) { const h = maskOn && CLIP.holes[i]; HB.set(h ? [h[0] * sx, (Hh - h[3]) * sy, h[2] * sx, (Hh - h[1]) * sy] : NOHOLE, i * 4); }
      gl.uniform4fv(U.uHole, HB);
    }
    // pixels outside the band are never rasterized (on phones the contact stage is a fraction of the screen)
    const x0 = clamp(Math.floor(B[0] * sx), 0, rw), x1 = clamp(Math.ceil(B[2] * sx), 0, rw);
    const y0 = clamp(Math.floor((Hh - B[3]) * sy), 0, rh), y1 = clamp(Math.ceil((Hh - B[1]) * sy), 0, rh);
    const any = x1 > x0 && y1 > y0 && CLIP.alpha > 0;
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (any) { gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    if (useFx) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (any) {
        const kx = canvas.width / rw, ky = canvas.height / rh;
        const X0 = Math.max(0, Math.floor(x0 * kx) - 2), Y0 = Math.max(0, Math.floor(y0 * ky) - 2);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(X0, Y0, Math.min(canvas.width, Math.ceil(x1 * kx) + 2) - X0, Math.min(canvas.height, Math.ceil(y1 * ky) + 2) - Y0);
        gl.useProgram(post);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(PU.t, 0); gl.uniform2f(PU.px, 1 / canvas.width, 1 / canvas.height); gl.uniform2f(PU.sc, rw / canvas.width, rh / canvas.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  /* ------------------------------------------------------------ loop */
  // Exactly one pending frame at any time: kick() is a no-op while a request is pending or a frame is running, and only
  // the running frame decides whether the loop continues. Region 'none' (hero covered, stage off-screen), a hidden tab,
  // an open popup and Motion off all end the loop; scroll, input and events wake it with kick().
  let raf = 0, inFrame = false, last = 0, firstHero = true, frameN = 0, drawN = 0, stepAt = 0, sizeDirty = false, tNow = 0, armT = 0, layoutKey = '';
  const keyNow = () => `${canvas.clientWidth}|${small()}|${innerWidth < 1024}|${innerWidth > innerHeight}`;
  function computeRegion() {
    const vh = innerHeight;
    if (stageEl) { const r = stageEl.getBoundingClientRect(); if (r.top < vh && r.bottom > 0 && r.height > 0) return 'contact'; }
    if (workEl && workEl.getBoundingClientRect().top > 1) return 'hero';
    return 'none';
  }
  function frame(now) {
    raf = 0; inFrame = true; let again = false;
    try { again = tick(now); } finally { inFrame = false; }
    if (again && !raf && !paused && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function tick(now) {
    if (paused || document.hidden) { last = 0; return false; }
    frameN++;
    const t = now / 1000; const real = last ? (now - last) / 1000 : 0; const dt = real ? Math.min(1 / 30, real) : 1 / 60; last = now;
    tNow = t;
    const nr = computeRegion();
    if (nr !== region) {
      const prev = region;
      region = nr; armed = false; frames = 0; acc = 0;
      canvas.classList.toggle('is-off', region === 'none');
      if (region === 'none') { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT); last = 0; return false; }
      if (sizeDirty) { sizeDirty = false; applySize(); layoutKey = keyNow(); }
      if (region === 'contact') {
        updateContactCamera(); contactTargets();
        S.forEach(st => { st.pos = [st.T[0], 80, st.T[2]]; st.vel = [0, 0, 0]; st.delay = 1e9; });
      } else {
        measureHero(); setCamera([0, 0, 0], 0, HL.H); heroTargets(t);
        if (motionOff()) snapToTargets();
        // first arrival (the static Z is fading out right here) or a jump back from the contact stage: pop out in place
        else if (firstHero || prev === 'contact') popIn();
        // uncovered from below by the work slab: the pieces are already where the slab reveals them
        else { snapToTargets(); S.forEach(st => { st.w = [rand(-1.2, 1.2), rand(-1.2, 1.2), rand(-1.2, 1.2)]; }); }
        firstHero = false;
      }
    }
    if (region === 'none') { last = 0; return false; } // nothing to draw: no render, no reschedule until a scroll wakes it
    if (region === 'hero') { setCamera([0, 0, 0], 0, HL.H); heroClip(); CLIP.alpha = 1; }
    if (region === 'contact') {
      const r = updateContactCamera();
      if (!armed && r.top < innerHeight * 0.72 && r.bottom > innerHeight * 0.2) {
        armed = true; armT = t; contactTargets();
        if (motionOff()) snapToTargets();
        // a short tumbling drop that starts inside the stage band (under the caption line), staggered by height, fading in
        else S.forEach((st, i) => {
          st.q = qNorm([rand(-1, 1), rand(-1, 1), rand(-1, 1), 1]); st.w = [rand(-4, 4), rand(-4, 4), rand(-4, 4)];
          const x = st.T[0] + rand(-0.3, 0.3), z = st.T[2] + rand(-0.2, 0.2);
          const cap = ceilY(z - extent(st, 2)) - extent(st, 1);
          st.pos = [x, Math.max(st.T[1] + 0.3, Math.min(st.T[1] + 2 + i * 0.3, cap)), z]; st.vel = [0, -2, 0]; st.delay = 0;
        });
      }
      CLIP.alpha = !armed ? 0 : motionOff() ? 1 : clamp((t - armT) / 0.3, 0, 1);
    }
    if (!motionOff()) { for (let s = 0; s < 2; s++) step(dt / 2, t); }
    else { if (region === 'hero') heroTargets(t); else if (armed) contactTargets(); snapToTargets(); }
    render(); drawN++;
    // adaptive quality from real frame deltas (the first frame after a pause has none). A step only moves the raymarch
    // viewport, so it costs nothing; shedding re-checks every 20 frames while far over budget (a slow phone settles in
    // about a second), adding pixels back waits for 1.2s of headroom since the last change.
    if (real) { frames++; acc += dt; if (real < mnDt) mnDt = real; }
    const win = quality > QMIN && frames && acc / frames > 0.024 ? 20 : 45;
    if (frames >= win) {
      const avg = acc / frames;
      // recovery bar: 12.5ms on fast displays, or "hitting nearly every vsync" on 60Hz ones (vsync estimated from the
      // smallest real delta, capped at 17.3ms so a device that only just holds 60 stays put instead of oscillating)
      const bar = Math.max(0.0125, Math.min(mnDt * 1.1, 0.0173));
      frames = 0; acc = 0; mnDt = 1;
      if (avg > 0.019 && quality > QMIN) { setQuality(Math.max(QMIN, quality * clamp(0.0165 / avg, 0.7, 0.9))); stepAt = now; } // below ~52fps: shed pixels
      else if (avg < bar && quality < QMAX && now - stepAt > 1200) { setQuality(Math.min(QMAX, quality / 0.88)); stepAt = now; } // headroom: add them back
    }
    if (motionOff()) { last = 0; return false; } // on-demand frames only
    return true;
  }
  function kick() { if (ready && !raf && !inFrame && !paused && !document.hidden) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', kick, { passive: true });
  // Resize at once (no debounce, so a stretched stale frame never sits over the copy). A rotation, a width change or a
  // breakpoint jump snaps the pieces to the new layout instead of springing them across the text; height-only changes
  // (mobile URL bar) just re-fit.
  addEventListener('resize', () => {
    if (!ready) return;
    if (region === 'none') { sizeDirty = true; return; } // the canvas is hidden: resize it when a region comes back
    const k = keyNow(), jump = k !== layoutKey; layoutKey = k;
    applySize(); measureHero();
    if (jump && region === 'hero') { setCamera([0, 0, 0], 0, HL.H); heroTargets(tNow); snapToTargets(); }
    else if (jump && region === 'contact' && armed) { updateContactCamera(); contactTargets(); snapToTargets(); }
    kick();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { last = 0; kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  addEventListener('zs:motion', () => { last = 0; kick(); });
  addEventListener('load', () => { if (ready) { measureHero(); kick(); } });
  // context, size and compile once the first frame is on screen, in idle time
  requestAnimationFrame(() => setTimeout(() => { if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 600 }); else boot(); }, 0));
  window.__zstore = { S, HL, CL, get region() { return region; }, get level() { return buildLevel; }, get ready() { return ready; },
    get frames() { return frameN; }, get draws() { return drawN; }, get quality() { return quality; }, get pending() { return !!raf; },
    get clip() { return CLIP; }, get mask() { return maskOn; }, set mask(v) { maskOn = !!v; kick(); } };
})();
