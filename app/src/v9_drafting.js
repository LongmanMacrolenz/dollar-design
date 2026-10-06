/* Original vector drawings. Dimension labels come only from existing reviewed
   tables or the customer's selected length; geometry remains NTS. */
let bnDraftSerial=0;
const BN_DRAFT_STYLE=`<style>
.bn-drawing .outline{fill:#fff;stroke:#213744;stroke-width:1.8;stroke-linejoin:round}.bn-drawing .edge{fill:none;stroke:#213744;stroke-width:1}.bn-drawing .thread{fill:none;stroke:#506b79;stroke-width:.8}.bn-drawing .centre{fill:none;stroke:#8a9da7;stroke-width:.65;stroke-dasharray:12 3 2 3}.bn-drawing .hidden{fill:none;stroke:#7c909c;stroke-width:.8;stroke-dasharray:5 3}.bn-drawing .dimension{fill:none;stroke:#397082;stroke-width:.8}.bn-drawing .label{fill:#23566a;font:13px monospace;paint-order:stroke fill;stroke:#fff;stroke-width:5px;stroke-linejoin:round}.bn-drawing .viewlabel{fill:#6c808a;font:11px sans-serif;letter-spacing:1px}.bn-drawing .sheet-title{fill:#223d4a;font:600 15px sans-serif}.bn-drawing .sheet-note{fill:#647c87;font:11px sans-serif}.bn-drawing .frame{fill:none;stroke:#cad6dc;stroke-width:1}
</style>`;
const bnDraftN=v=>Number.isFinite(+v)&&+v>0?+v:null;
function bnDraftDim(id,x1,y1,x2,y2,label,offset=-25){
 if(!label)return '';
 const h=y1===y2,a=h?[x1,y1+offset]:[x1+offset,y1],b=h?[x2,y2+offset]:[x2+offset,y2];
 return `<g><path class="dimension" d="M${x1} ${y1}L${a[0]} ${a[1]}M${x2} ${y2}L${b[0]} ${b[1]}"/><path class="dimension" d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" marker-start="url(#${id})" marker-end="url(#${id})"/><text class="label" x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-7}" text-anchor="middle"${h?'':` transform="rotate(-90 ${(a[0]+b[0])/2} ${(a[1]+b[1])/2-7})"`}>${esc(label)}</text></g>`;
}
const bnDraftAxis=(x1,x2,y)=>`<path class="centre" d="M${x1} ${y}H${x2}"/>`;
function bnDraftEnd(cx,cy,r,hex=false,hole=false){
 const outline=hex?`<polygon class="outline" points="${Array.from({length:6},(_,i)=>`${cx+r*Math.cos(i*Math.PI/3)},${cy+r*Math.sin(i*Math.PI/3)}`).join(' ')}"/>`:`<circle class="outline" cx="${cx}" cy="${cy}" r="${r}"/>`;
 const cut=hole==='socket'?`<polygon class="edge" points="${Array.from({length:6},(_,i)=>`${cx+r*.5*Math.cos(i*Math.PI/3)},${cy+r*.5*Math.sin(i*Math.PI/3)}`).join(' ')}"/>`:hole?`<circle class="edge" cx="${cx}" cy="${cy}" r="${r*.48}"/><path class="thread" d="M${cx+r*.55} ${cy}A${r*.55} ${r*.55} 0 1 1 ${cx} ${cy-r*.55}"/>`:'';
 return outline+cut+bnDraftAxis(cx-r-12,cx+r+12,cy)+`<path class="centre" d="M${cx} ${cy-r-12}V${cy+r+12}"/>`;
}
function bnDraftSvg(o){
 const id='bn-dim-'+(++bnDraftSerial),cy=151;let b='';
 const val=(symbol,v)=>bnDraftN(v)?symbol+' '+String(v?.raw??v)+(o.inch?'″':''):null;
 const unit=o.inch?'in':'mm';
 if(['bolt','socket','countersunk','rod','pin','key','stud'].includes(o.kind)){
  const L=bnDraftN(o.L),d=bnDraftN(o.d)||1,head=o.kind==='bolt'||o.kind==='socket'||o.kind==='countersunk';
  const ah=bnDraftN(o.headWidth)||d*1.6,k=bnDraftN(o.geometryHeadHeight)||bnDraftN(o.headHeight)||d*.65;
  const span=L||d*4,visualSpan=Math.min(span,d*12),compressed=span>visualSpan,sc=Math.min(250/(visualSpan+(head&&o.kind!=='countersunk'?k:0)),92/Math.max(head?ah:d,d));
  const x=100,h=d*sc,hw=head?k*sc:0,sh=x+hw,end=sh+(o.kind==='countersunk'?Math.max(d,visualSpan-k):visualSpan)*sc,hh=(head?ah:d)*sc;
  if(head){
   if(o.kind==='countersunk')b+=`<path class="outline" d="M${x} ${cy-hh/2}L${sh} ${cy-h/2}V${cy+h/2}L${x} ${cy+hh/2}Z"/>`;
   else b+=`<path class="outline" d="M${x+2} ${cy-hh/2}H${sh}V${cy+hh/2}H${x+2}L${x} ${cy+hh/2-2}V${cy-hh/2+2}Z"/>`;
   if(o.kind==='bolt')b+=`<path class="edge" d="M${x} ${cy-hh/4}H${sh}M${x} ${cy+hh/4}H${sh}"/>`;
   if(o.kind==='socket'||o.kind==='countersunk')b+=`<path class="hidden" d="M${x} ${cy-h*.23}H${x+hw*.68}V${cy+h*.23}H${x}"/>`;
   b+=bnDraftDim(id,x,cy+hh/2,sh,cy+hh/2,val('k',o.headHeight),28);
   b+=bnDraftDim(id,x,cy-hh/2,x,cy+hh/2,val(o.kind==='bolt'?'s':'dk',o.headWidth),-28);
  }
  const cham=o.kind==='key'?0:Math.min(h*.12,4);
  b+=`<path class="outline" d="M${sh} ${cy-h/2}H${end-cham}L${end} ${cy-h/2+cham}V${cy+h/2-cham}L${end-cham} ${cy+h/2}H${sh}Z"/>`;
  if(!['pin','key'].includes(o.kind)){
   const ts=o.partial?end-(bnDraftN(o.threadLength)?Math.min(span,+o.threadLength)*sc:span*sc*.65):sh+Math.min(7,h*.18);
   b+=`<path class="thread" d="M${ts} ${cy-h*.36}H${end-1}M${ts} ${cy+h*.36}H${end-1}"/><path class="edge" d="M${ts} ${cy-h/2}V${cy+h/2}"/>`;
   b+=bnDraftDim(id,ts,cy+h/2,end,cy+h/2,val('b',o.threadLength),45);
  }
  b+=bnDraftAxis(x-14,end+14,cy);
  b+=bnDraftDim(id,o.kind==='countersunk'?x:sh,cy-hh/2,end,cy-hh/2,L?val(o.lengthSymbol||'L',o.L):'L · 주문 길이',-30);
  b+=bnDraftDim(id,end,cy-h/2,end,cy+h/2,o.kind==='key'?val('h',o.d):(o.thread||val('⌀d',o.d)),27);
  if(compressed){const mid=(sh+end)/2;b+=`<rect x="${mid-8}" y="${cy-h/2-4}" width="16" height="${h+8}" fill="white"/><path class="edge" d="M${mid-7} ${cy-h/2-3}q8 ${h/2} 0 ${h+6}M${mid+7} ${cy-h/2-3}q8 ${h/2} 0 ${h+6}"/>`;}
  if(o.kind==='key'){const ew=Math.min(72,48*(+o.width/d||1));b+=`<rect class="outline" x="${472-ew/2}" y="${cy-24}" width="${ew}" height="48"/>`;}
  else b+=bnDraftEnd(472,cy,Math.min(49,head?hh/2:h/2),o.kind==='bolt',o.kind==='socket'||o.kind==='countersunk'?'socket':false);
  if((o.kind==='socket'||o.kind==='countersunk')&&bnDraftN(o.driveWidth))b+=`<text class="label" x="472" y="235" text-anchor="middle">${esc(val('s',o.driveWidth))}</text>`;
  if(o.kind==='key')b+=`<text class="label" x="465" y="235" text-anchor="middle">${esc(val('b',o.width)||'폭 · 도면 지정')}</text>`;
 }else if(o.kind==='nut'){
  const cx=166,r=65,sf=r*Math.sqrt(3)/2,w=Math.min(75,Math.max(28,65*(+o.height||1)/(+o.af||1)));
  b+=bnDraftEnd(cx,cy,r,true,true);
  b+=bnDraftDim(id,cx-r,cy-sf,cx-r,cy+sf,val('s',o.af),-29);
  const x=405;b+=`<path class="outline" d="M${x+5} ${cy-sf}H${x+w-5}L${x+w} ${cy-sf+6}V${cy+sf-6}L${x+w-5} ${cy+sf}H${x+5}L${x} ${cy+sf-6}V${cy-sf+6}Z"/><path class="edge" d="M${x} ${cy-sf/2}H${x+w}M${x} ${cy+sf/2}H${x+w}"/><path class="hidden" d="M${x} ${cy-r*.4}H${x+w}M${x} ${cy+r*.4}H${x+w}"/>`+bnDraftAxis(x-14,x+w+14,cy)+bnDraftDim(id,x,cy-sf,x+w,cy-sf,val('m',o.height),-30);
  b+=`<text class="label" x="430" y="240" text-anchor="middle">${esc(o.thread||'나사 · 주문 사양')}</text>`;
 }else if(o.kind==='washer'){
  const cx=168,R=67,r=R*(+o.inner/+o.outer||.5),t=Math.max(5,Math.min(24,134*(+o.height/+o.outer||.06)));
  b+=`<circle class="outline" cx="${cx}" cy="${cy}" r="${R}"/><circle class="edge" cx="${cx}" cy="${cy}" r="${r}"/>`+bnDraftAxis(cx-R-12,cx+R+12,cy)+`<path class="centre" d="M${cx} ${cy-R-12}V${cy+R+12}"/>`;
  if(o.split)b+=`<path class="edge" d="M${cx+r-1} ${cy-3}L${cx+R+1} ${cy+3}"/>`;
  b+=bnDraftDim(id,cx-r,cy-R,cx+r,cy-R,val('⌀d1',o.inner),-23)+bnDraftDim(id,cx-R,cy+R,cx+R,cy+R,val('⌀d2',o.outer),25);
  b+=`<rect class="outline" x="429" y="${cy-R}" width="${t}" height="${R*2}"/><path class="hidden" d="M429 ${cy-r}h${t}M429 ${cy+r}h${t}"/>`+bnDraftAxis(409,449+t,cy)+bnDraftDim(id,429,cy-R,429+t,cy-R,val(o.split?'s':'h',o.height),-23);
 }
 if(!b)return null;
 return `<svg class="dw bn-drawing" viewBox="0 0 600 332" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.title)} 2D 형상·치수도"><title>${esc(o.title)}</title>${BN_DRAFT_STYLE}<defs><marker id="${id}" viewBox="0 0 10 8" refX="5" refY="4" markerWidth="7" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L9 4L0 7Z" fill="#397082"/></marker></defs><rect width="600" height="332" fill="#fff"/><path class="frame" d="M16 16H584V316H16ZM16 273H584"/><text class="viewlabel" x="32" y="37">ORTHOGRAPHIC VIEWS · NTS</text>${b}<text class="viewlabel" x="170" y="259" text-anchor="middle">${['nut','washer'].includes(o.kind)?'정면도':'측면도'}</text><text class="viewlabel" x="468" y="259" text-anchor="middle">${['nut','washer'].includes(o.kind)?'측면도':'끝면도'}</text><text class="sheet-title" x="32" y="296">${esc(o.title)}</text><text class="sheet-note" x="32" y="312">${esc(o.std||'주문 사양 기준')} · 단위 ${unit} · 형상 참고도 / 제작 승인 도면 아님</text></svg>`;
}
const bnOriginalDrawing=drawing;
drawing=(f,size,L)=>{
 const kind={hex:'bolt',hexp:'bolt',scs:'socket',csk:'countersunk',nut:'nut',washer:'washer',spring:'washer',rod:'rod'}[f.draw];if(!kind)return bnOriginalDrawing(f,size,L);
 const d=dnum(size),v=k=>bnDraftN(DIM[k]?.[size]),head=kind==='socket'?['scsDk','scsK']:kind==='countersunk'?['cskDk',null]:['hexS','hexK'];
 const dims={kind,title:f.short+' '+size+(L?' × '+L:''),std:f.std.ISO||f.std.DIN,d,L:kind==='rod'?1000:L,headWidth:v(head[0]),headHeight:head[1]?v(head[1]):null,driveWidth:kind==='socket'?v('scsS'):kind==='countersunk'?v('cskS'):null,geometryHeadHeight:kind==='countersunk'&&v('cskDk')?(v('cskDk')-d)/2:null,af:v('hexS'),height:v(kind==='nut'?'nutM':f.draw==='spring'?'swS':'pwH'),inner:v(f.draw==='spring'?'swD1':'pwD1'),outer:v(f.draw==='spring'?'swD2':'pwD2'),split:f.draw==='spring',thread:v('pitch')?`${size} × ${v('pitch')}`:size,partial:f.draw==='hexp',threadLength:f.draw==='hexp'&&L&&!['M14','M22'].includes(size)?Math.min(L,L<=125?2*d+6:L<=200?2*d+12:2*d+25):null};
 return bnDraftSvg(dims)||bnOriginalDrawing(f,size,L);
};
const bnOriginalInch=drawInch;
drawInch=(f,size,len)=>{
 const d=dnumIn(size),L=inchToMm(len)/25.4,{series,cls}=inchThread(f,size),thread=`${fmtIn(size)} ${series}${cls?'-'+cls:''}`,hn=f.nut&&f.id==='hh'&&typeof hhnIn==='function'?hhnIn(d):null;
 if(f.stud)return bnOriginalInch(f,size,len); // Stud assembly retains the verified point/length convention.
 return bnDraftSvg({kind:f.nut?'nut':f.draw==='rod'?'rod':f.draw==='scs'?'socket':'bolt',title:f.short+' '+fmtIn(size),std:f.nut?'ASME B18.2.2':f.draw==='scs'?'ASME B18.3':'ASME B18.2.1',inch:true,d,L:Number.isFinite(L)?L:null,thread,af:hn?Object.assign(new Number(hn[2]),{raw:hn[1]}):null,height:hn?Object.assign(new Number(hn[4]),{raw:hn[3]}):null})||bnOriginalInch(f,size,len);
};
const bnOriginalIaDraw=iaDrawSvg;
iaDrawSvg=(f,s)=>{
 const original=bnOriginalIaDraw(f,s);if(!original)return null;
 const k=IA_DRAW_OF[f.eng],g=IA_DRAW[k]?.(f,s);if(!g)return original;
 const raw=v=>v==null?null:v;
 return bnDraftSvg({kind:k,title:f.ko+' '+s.size,std:f.enStd,inch:f.sys==='inch',L:raw(g.L),lengthSymbol:g.L?.key?.includes('Min')?'L min':'L',d:raw(g.d||g.h),width:raw(g.b),af:raw(g.s),height:raw(g.m||g.h),inner:raw(g.a),outer:raw(g.b),thread:s.size})||original;
};
function bnBlueprint(){return bnSourcingDrawing('bn-detail-draft');}
// Enlarge in an accessible dialog, then export the actual vector with embedded styling.
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-drawing-expand],[data-drawing-save]');if(!b)return;
 const box=b.closest('.dbox'),svg=box?.querySelector('svg');if(!svg)return;
 if(b.hasAttribute('data-drawing-save')){
  const copy=svg.cloneNode(true);
  const sourceNodes=[svg,...svg.querySelectorAll('*')],copyNodes=[copy,...copy.querySelectorAll('*')];
  sourceNodes.forEach((node,i)=>{if(['style','defs','title','desc'].includes(node.tagName))return;const css=getComputedStyle(node);['fill','stroke','stroke-width','stroke-dasharray','font-family','font-size','font-weight','paint-order'].forEach(k=>copyNodes[i].style.setProperty(k,css.getPropertyValue(k)));});
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.dw .pt{fill:white;stroke:#213744;stroke-width:1.7}.dw .ol,.dw .eg,.dw .th{fill:none;stroke:#213744;stroke-width:1}.dw .cl,.dw .hid{fill:none;stroke:#7e9099;stroke-width:.8;stroke-dasharray:6 3}.dw .dl{fill:none;stroke:#397082;stroke-width:.8}.dw text{fill:#23566a;font:12px monospace}.dw .ar{fill:#397082}';copy.prepend(style);
  const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'})),a=document.createElement('a');a.href=url;a.download='Boltnote-drawing.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
 }
 const dialog=document.createElement('dialog');dialog.className='bn-drawing-dialog';dialog.setAttribute('aria-label','2D 도면 확대');dialog.innerHTML=`<div class="bn-drawing-dialog-head"><b>2D 도면 확대</b><button class="btn sm" type="button">닫기 ×</button></div><div class="bn-drawing-full">${svg.outerHTML}</div><p>형상과 치수 확인용 · 제작 승인 도면 아님</p>`;document.body.append(dialog);
 // Distinct marker/title ids keep the expanded copy independent of the original SVG.
 const ids=[...dialog.querySelectorAll('[id]')].map(x=>x.id);let html=dialog.innerHTML;ids.forEach(id=>{html=html.replaceAll('id="'+id+'"','id="'+id+'-expanded"').replaceAll('#'+id+')','#'+id+'-expanded)');});dialog.innerHTML=html;
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.addEventListener('click',ev=>{if(ev.target===dialog)dialog.close();});dialog.addEventListener('close',()=>{dialog.remove();b.focus();},{once:true});dialog.showModal();
});
const bnDraftEnhance=()=>{
 document.querySelectorAll('.dbox').forEach(box=>{
  const svg=box.querySelector('svg');if(!svg)return;
  if(!box.querySelector('.bn-drawing-tools')){const bar=document.createElement('div');bar.className='bn-drawing-tools';bar.innerHTML='<span>VECTOR · 2D</span><button type="button" data-drawing-expand>도면 확대 ↗</button><button type="button" data-drawing-save>SVG 저장 ↓</button>';box.prepend(bar);}
  const labels=[...new Set([...svg.querySelectorAll('.label,.dt')].map(x=>x.textContent))];
  let values=box.querySelector('.bn-drawing-values');if(!values){values=document.createElement('div');values.className='bn-drawing-values';values.setAttribute('aria-label','도면 치수 표기');box.append(values);}
  const signature=labels.join('|');if(values.dataset.signature!==signature){values.dataset.signature=signature;values.innerHTML=labels.map(t=>`<span>${esc(t)}</span>`).join('');}
 });
};
const bnDraftObserver=new MutationObserver(bnDraftEnhance);
bnDraftObserver.observe(document.body,{childList:true,subtree:true});

requestAnimationFrame(bnDraftEnhance);
