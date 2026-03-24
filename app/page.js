'use client'
export const dynamic = 'force-dynamic'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/realtime'
import dynamicImport from 'next/dynamic'
const TreeView=dynamicImport(()=>import('@/components/TreeView'),{ssr:false,loading:()=>null})
const SettingsPanel=dynamicImport(()=>import('@/components/SettingsPanel'),{ssr:false,loading:()=>null})

const CAT_COLORS={career:'#b85c00',interview:'#0f6e56',learning:'#1a5fa8',fitness:'#8a2828',family:'#6a2878',admin:'#5a4800',finance:'#0f5a3c'}
const Q_POS={do:{x:.76,y:.26},schedule:{x:.76,y:.76},delegate:{x:.26,y:.26},eliminate:{x:.26,y:.76}}

const api={
  tasks:{
    list:(from,to)=>{const p=from&&to?`?from=${from}&to=${to}`:from?`?date=${from}`:'';return fetch(`/api/tasks${p}`).then(r=>r.json()).catch(()=>({tasks:[]}))},
    create:(t)=>fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)}).then(r=>r.json()),
    update:(id,u)=>fetch('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...u})}).then(r=>r.json()),
  },
  schedule:{
    get:()=>fetch('/api/schedule').then(r=>r.json()).catch(()=>({schedule:null})),
    generate:(ctx)=>fetch('/api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ctx)}).then(r=>r.json()),
    patch:(action,slotIndex,extra={})=>fetch('/api/schedule',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,slotIndex,...extra})}).then(r=>r.json()),
  },
  coo:{checkin:(type,msg)=>fetch('/api/coo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,userMessage:msg})}).then(r=>r.json())},
  agents:{
    list:()=>fetch('/api/agents').then(r=>r.json()).catch(()=>({agents:[]})),
    run:(id,silent)=>fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:id,silent})}).then(r=>r.json()),
    update:(id,u)=>fetch('/api/agents',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...u})}).then(r=>r.json()),
  },
  settings:{get:()=>fetch('/api/settings').then(r=>r.json()).catch(()=>({settings:{}}))},
  propose:{
    get:()=>fetch('/api/tasks/propose').then(r=>r.json()),
    regen:()=>fetch('/api/tasks/propose',{method:'POST',headers:{'Content-Type':'application/json'}}).then(r=>r.json()),
    action:(action,proposal)=>fetch('/api/tasks/propose',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,proposal})}).then(r=>r.json()),
  },
  oura:{get:()=>fetch('/api/oura').then(r=>r.json()).catch(()=>({connected:false}))},
  tree:{get:()=>fetch('/api/tree',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))},
  goals:{
    get:()=>fetch('/api/goals').then(r=>r.json()).catch(()=>({goals:[]})),
    create:(body)=>fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    patch:(body)=>fetch('/api/goals',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()),
    seed:()=>fetch('/api/goals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'auto_seed'})}).then(r=>r.json()).catch(()=>({goals:[]})),
  },
}

function TreeSVG(){return(<svg style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:1,pointerEvents:'none'}}viewBox="0 0 1000 700"preserveAspectRatio="xMidYMid slice"xmlns="http://www.w3.org/2000/svg"><ellipse cx="55"cy="605"rx="68"ry="86"fill="#1a3a2a"opacity=".92"/><ellipse cx="55"cy="528"rx="52"ry="66"fill="#2d5a3d"opacity=".88"/><ellipse cx="55"cy="465"rx="37"ry="52"fill="#3d7a52"opacity=".82"/><rect x="47"y="593"width="14"height="105"fill="#152d1e"opacity=".9"/><ellipse cx="168"cy="632"rx="56"ry="72"fill="#1a3a2a"opacity=".88"/><ellipse cx="168"cy="570"rx="43"ry="57"fill="#2d5a3d"opacity=".82"/><ellipse cx="168"cy="516"rx="31"ry="43"fill="#4a9e6b"opacity=".76"/><rect x="161"y="620"width="12"height="82"fill="#152d1e"opacity=".88"/><ellipse cx="875"cy="612"rx="72"ry="90"fill="#1a3a2a"opacity=".92"/><ellipse cx="875"cy="532"rx="55"ry="70"fill="#2d5a3d"opacity=".88"/><ellipse cx="875"cy="465"rx="39"ry="56"fill="#3d7a52"opacity=".82"/><rect x="867"y="600"width="14"height="105"fill="#152d1e"opacity=".9"/><ellipse cx="962"cy="642"rx="52"ry="67"fill="#1a3a2a"opacity=".88"/><ellipse cx="962"cy="584"rx="40"ry="52"fill="#2d5a3d"opacity=".82"/><rect x="956"y="632"width="12"height="68"fill="#152d1e"opacity=".88"/><ellipse cx="500"cy="682"rx="43"ry="56"fill="#1a3a2a"opacity=".72"/><ellipse cx="500"cy="636"rx="34"ry="44"fill="#2d5a3d"opacity=".67"/><ellipse cx="312"cy="662"rx="40"ry="52"fill="#1a3a2a"opacity=".74"/><ellipse cx="312"cy="620"rx="31"ry="41"fill="#2d5a3d"opacity=".70"/><circle cx="115"cy="105"r="72"fill="#a8d9b8"opacity=".11"/><circle cx="755"cy="65"r="88"fill="#c8e6d4"opacity=".09"/></svg>)}

function PerfRing({score,color}){const ref=useRef(null);useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,36,36);ctx.strokeStyle='rgba(20,60,35,.1)';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.arc(18,18,14,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=color;ctx.beginPath();ctx.arc(18,18,14,-Math.PI/2,-Math.PI/2+(score/100)*Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.font='bold 9px JetBrains Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(score,18,18)},[score,color]);return <canvas ref={ref} width={36} height={36}/>}

const ZONE_LABELS=['IDK','today','tmrw','week','month+']
const ZONE_KEYS=['idk','today','tomorrow','week','month']
function getZoneIdx(date){
  if(!date)return 0
  const td=new Date().toISOString().slice(0,10)
  if(date<td)return 0
  if(date===td)return 1
  const tom=new Date(Date.now()+86400000).toISOString().slice(0,10)
  if(date===tom)return 2
  const dow=new Date().getDay();const eow=new Date();eow.setDate(eow.getDate()+(dow===0?0:7-dow))
  if(date<=eow.toISOString().slice(0,10))return 3
  return 4
}
function getZoneHorizon(qBaseX,cx,qW){
  const zIdx=Math.max(0,Math.min(4,Math.floor((cx-qBaseX)/(qW/5))))
  return ZONE_KEYS[zIdx]
}

// ── Deterministic seeded random for stable bubble positions ──────────────────
function seededRand(s){s=Math.imul(s^(s>>>15),0xd9e0b4fd)>>>0;s=Math.imul(s^(s>>>13),0x9b14f3a3)>>>0;return(s>>>0)/0xffffffff}
function hashStr(str){let h=0;for(let i=0;i<str.length;i++)h=Math.imul(31,h)+str.charCodeAt(i)|0;return Math.abs(h)}

// ── Auto-link parser — turns URLs, emails, phones into clickable spans ────────
function parseLinks(text){
  if(!text)return[{t:'text',v:text||''}]
  const re=/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g
  const parts=[];let last=0,m
  while((m=re.exec(text))!==null){
    if(m.index>last)parts.push({t:'text',v:text.slice(last,m.index)})
    const v=m[0]
    if(/^https?:\/\/|^www\./.test(v))parts.push({t:'url',v,href:v.startsWith('www.')?'https://'+v:v})
    else if(/@/.test(v))parts.push({t:'email',v,href:'mailto:'+v})
    else parts.push({t:'phone',v,href:'tel:'+v.replace(/[^\d+]/g,'')})
    last=m.index+v.length
  }
  if(last<text.length)parts.push({t:'text',v:text.slice(last)})
  return parts
}

function MatrixCanvas({tasks,onToggle,selectedId,onZoneClick,onMatrixDrop}){
  const canvasRef=useRef(null);const mapRef=useRef([]);const tipRef=useRef(null)
  const hoverRef=useRef(null);const rafRef=useRef(null);const drawRef=useRef(null)
  const prevIdsRef=useRef(new Set());const animTimes=useRef({})

  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const dpr=window.devicePixelRatio||1
    const W=canvas.parentElement.clientWidth-24
    const H=Math.min(Math.round(window.innerHeight*0.40),400)
    canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px'
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H)
    const qW=W/2;const qH=H/2;const zW=qW/5

    // Quadrant backgrounds
    ;[['rgba(184,92,0,.10)',qW,0,qW,qH],['rgba(15,110,86,.08)',0,0,qW,qH],
      ['rgba(26,95,168,.08)',qW,qH,qW,qH],['rgba(122,170,138,.07)',0,qH,qW,qH]
    ].forEach(([c,x,y,w,h])=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)})

    // Sub-zone strips — faint vertical dividers within each quadrant
    ctx.strokeStyle='rgba(20,60,35,.07)';ctx.lineWidth=0.5;ctx.setLineDash([3,5])
    ;[0,qW].forEach(qx=>{
      ;[qH,0].forEach(qy=>{
        for(let i=1;i<5;i++){
          const lx=qx+i*zW
          ctx.beginPath();ctx.moveTo(lx,qy);ctx.lineTo(lx,qy+qH);ctx.stroke()
        }
      })
    })
    ctx.setLineDash([])

    // Sub-zone labels — bottom of each quadrant
    ctx.font='bold 8.5px JetBrains Mono,monospace';ctx.textAlign='center'
    ;[0,qW].forEach(qx=>{
      ;[0,qH].forEach(qy=>{
        ZONE_LABELS.forEach((lbl,i)=>{
          ctx.fillStyle='rgba(20,60,35,.58)'
          ctx.fillText(lbl,qx+i*zW+zW/2,qy+qH-7)
        })
      })
    })

    // Main quadrant dividers
    ctx.strokeStyle='rgba(20,60,35,.18)';ctx.lineWidth=1.5;ctx.setLineDash([])
    ctx.beginPath();ctx.moveTo(qW,0);ctx.lineTo(qW,H);ctx.stroke()
    ctx.beginPath();ctx.moveTo(0,qH);ctx.lineTo(W,qH);ctx.stroke()

    // Axis labels
    ctx.font='9px JetBrains Mono,monospace';ctx.fillStyle='rgba(20,60,35,.26)';ctx.textAlign='center'
    ctx.fillText('IMPORTANT →',W/2,H-4)
    ctx.save();ctx.translate(12,H/2);ctx.rotate(-Math.PI/2);ctx.fillText('URGENT →',0,0);ctx.restore()

    // Quadrant name + count in each corner
    const qc={do:0,schedule:0,delegate:0,eliminate:0}
    tasks.forEach(t=>{if(qc[t.q]!==undefined)qc[t.q]++})
    ;[['DO',qW+8,14,'rgba(184,92,0,.9)','do','left'],
      ['DELEGATE',8,14,'rgba(15,110,86,.85)','delegate','left'],
      ['SCHEDULE',qW+8,qH+14,'rgba(26,95,168,.85)','schedule','left'],
      ['ELIMINATE',8,qH+14,'rgba(122,170,138,.85)','eliminate','left']
    ].forEach(([label,x,y,c,q,align])=>{
      ctx.font='700 8.5px JetBrains Mono,monospace';ctx.fillStyle=c;ctx.textAlign=align
      const n=qc[q];const txt=n>0?`${label} ${n}`:label
      ctx.fillText(txt,x,y)
    })

    // Detect newly added tasks for pop-in animation
    const currentIds=new Set(tasks.map(t=>t.id))
    const now=Date.now()
    if(prevIdsRef.current.size>0){
      tasks.forEach(t=>{if(!prevIdsRef.current.has(t.id)&&!animTimes.current[t.id])animTimes.current[t.id]=now})
    }
    prevIdsRef.current=currentIds
    Object.keys(animTimes.current).forEach(id=>{if(!currentIds.has(id))delete animTimes.current[id]})

    // Bubbles placed in their zone strip (seeded positions — stable across redraws)
    let needsAnim=false
    mapRef.current=[];const placed=[]
    tasks.forEach(t=>{
      const q=t.q||'do'
      const isRight=q==='do'||q==='schedule';const isTop=q==='do'||q==='delegate'
      const qBaseX=isRight?qW:0;const qBaseY=isTop?0:qH
      const zIdx=getZoneIdx(t.date)
      const r=Math.max(10,Math.min(28,t.blocks*4))
      const zCx=qBaseX+zIdx*zW+zW/2;const zCy=qBaseY+qH/2
      const seed=hashStr(t.id)
      let bx=zCx,by=zCy,att=0
      do{
        bx=zCx+(seededRand(seed+att*997)-.5)*(zW-r*2-2)
        by=zCy+(seededRand(seed+att*997+500)-.5)*(qH-r*2-36)
        att++
      }while(att<50&&placed.some(p=>Math.hypot(p[0]-bx,p[1]-by)<r+p[2]+4))
      bx=Math.max(qBaseX+r+2,Math.min(qBaseX+qW-r-2,bx))
      by=Math.max(qBaseY+r+20,Math.min(qBaseY+qH-r-20,by))
      placed.push([bx,by,r])

      // Animation: new bubbles pop in with scale+fade over 380ms
      const startT=animTimes.current[t.id]
      const anim=startT?Math.min(1,(now-startT)/380):1
      if(anim<1)needsAnim=true
      else if(startT)delete animTimes.current[t.id]
      const ar=r*(.35+.65*anim) // animated radius
      const col=CAT_COLORS[t.cat]||'#3d7a52'
      const isProposed=t.status==='proposed';const isSel=t.id===selectedId
      ctx.globalAlpha=anim
      if(isSel){ctx.beginPath();ctx.arc(bx,by,ar+5,0,Math.PI*2);ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.setLineDash([]);ctx.stroke()}
      ctx.beginPath();ctx.arc(bx,by,ar,0,Math.PI*2)
      if(t.done){ctx.fillStyle='rgba(20,60,35,.05)';ctx.fill();ctx.strokeStyle='rgba(20,60,35,.18)';ctx.lineWidth=1;ctx.setLineDash([]);ctx.stroke()}
      else if(isProposed){ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeStyle=col;ctx.stroke();ctx.setLineDash([])}
      else{ctx.fillStyle=col+'40';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash([]);ctx.stroke()}
      ctx.font=(t.done?'400 ':'600 ')+Math.max(9,ar*.55)+'px JetBrains Mono,monospace'
      ctx.fillStyle=t.done?'rgba(20,60,35,.26)':isProposed?col+'aa':col
      ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(t.done?'✓':t.blocks,bx,by)
      ctx.globalAlpha=1
      mapRef.current.push({x:bx,y:by,r,t})
    })
    if(needsAnim)scheduleRedraw()

    // Hover zone highlight — drawn last so it's always on top
    const hz=hoverRef.current
    if(hz){
      ctx.fillStyle='rgba(255,255,255,0.20)'
      ctx.fillRect(hz.qx+hz.zIdx*zW,hz.qy,zW,qH)
      ctx.strokeStyle='rgba(20,60,35,0.22)';ctx.lineWidth=1;ctx.setLineDash([])
      ctx.strokeRect(hz.qx+hz.zIdx*zW,hz.qy,zW,qH)
      ctx.font='bold 18px JetBrains Mono,monospace'
      ctx.fillStyle='rgba(20,60,35,0.45)'
      ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText('+',hz.qx+hz.zIdx*zW+zW/2,hz.qy+qH/2)
    }
    ctx.textBaseline='alphabetic'
  },[tasks,selectedId])

  useEffect(()=>{drawRef.current=draw},[draw])

  function scheduleRedraw(){
    if(rafRef.current)cancelAnimationFrame(rafRef.current)
    rafRef.current=requestAnimationFrame(()=>{if(drawRef.current)drawRef.current()})
  }

  useEffect(()=>{
    draw()
    const ro=new ResizeObserver(()=>{if(drawRef.current)drawRef.current()})
    if(canvasRef.current?.parentElement)ro.observe(canvasRef.current.parentElement)
    return()=>{ro.disconnect();if(rafRef.current)cancelAnimationFrame(rafRef.current);drawRef.current=null}
  },[])
  const getHit=(cx,cy)=>mapRef.current.find(c=>Math.hypot(c.x-cx,c.y-cy)<=c.r+6)

  function handleCanvasClick(cx,cy){
    const hit=getHit(cx,cy)
    if(hit){onToggle(hit.t.id);return}
    if(!onZoneClick)return
    const canvas=canvasRef.current;if(!canvas)return
    const W=parseFloat(canvas.style.width);const H=parseFloat(canvas.style.height)
    const qW=W/2;const qH=H/2
    const isRight=cx>qW;const isTop=cy<qH
    const q=isRight&&isTop?'do':isRight?'schedule':isTop?'delegate':'eliminate'
    const qBaseX=isRight?qW:0
    const horizon=getZoneHorizon(qBaseX,cx,qW)
    onZoneClick({q,horizon})
  }

  function handleMouseMove(e){
    const canvas=canvasRef.current;if(!canvas)return
    const rect=canvas.getBoundingClientRect()
    const cx=e.clientX-rect.left;const cy=e.clientY-rect.top
    const hit=getHit(cx,cy)
    // Tooltip
    const tip=tipRef.current
    if(tip){
      if(hit){
        tip.style.display='block'
        tip.style.left=Math.min(cx+14,rect.width-200)+'px'
        tip.style.top=Math.max(cy-48,4)+'px'
        tip.innerHTML=`<strong style="color:#182e22">${hit.t.name}</strong><br>${hit.t.blocks}×15min · ${hit.t.cat}${hit.t.status==='proposed'?' · COO proposed':''}`
      }else{tip.style.display='none'}
    }
    if(hit){
      canvas.style.cursor='pointer'
      if(hoverRef.current!==null){hoverRef.current=null;scheduleRedraw()}
    }else{
      canvas.style.cursor='cell'
      const W=parseFloat(canvas.style.width);const qW=W/2
      const H=parseFloat(canvas.style.height);const qH=H/2;const zW=qW/5
      const isRight=cx>qW;const isTop=cy<qH
      const qx=isRight?qW:0;const qy=isTop?0:qH
      const zIdx=Math.max(0,Math.min(4,Math.floor((cx-qx)/zW)))
      const prev=hoverRef.current
      if(!prev||prev.qx!==qx||prev.qy!==qy||prev.zIdx!==zIdx){
        hoverRef.current={qx,qy,zIdx}
        scheduleRedraw()
      }
    }
  }

  function handleMouseLeave(){
    if(tipRef.current)tipRef.current.style.display='none'
    if(hoverRef.current!==null){
      hoverRef.current=null
      if(canvasRef.current)canvasRef.current.style.cursor='crosshair'
      scheduleRedraw()
    }
  }

  return(
    <div className="card" style={{position:'relative'}}>
      <div className="card-hdr">
        <span className="card-title">Eisenhower field</span>
        <span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>bubble = blocks · dashed = proposed · tap bubble to act · tap zone to add</span>
      </div>
      <div style={{padding:'0 12px 4px'}}>
        <canvas ref={canvasRef} style={{display:'block',width:'100%',cursor:'crosshair',touchAction:'manipulation'}}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={e=>{const rect=canvasRef.current.getBoundingClientRect();handleCanvasClick(e.clientX-rect.left,e.clientY-rect.top)}}
          onTouchEnd={e=>{e.preventDefault();const rect=canvasRef.current.getBoundingClientRect();const t=e.changedTouches[0];handleCanvasClick(t.clientX-rect.left,t.clientY-rect.top)}}
          onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}}
          onDrop={e=>{
            if(!onMatrixDrop)return
            const canvas=canvasRef.current;if(!canvas)return
            const rect=canvas.getBoundingClientRect()
            const cx=e.clientX-rect.left,cy=e.clientY-rect.top
            const W=parseFloat(canvas.style.width),H=parseFloat(canvas.style.height)
            const q=cx>W/2&&cy<H/2?'do':cx>W/2?'schedule':cy<H/2?'delegate':'eliminate'
            onMatrixDrop(e,q)
          }}
        />
      </div>
      <div ref={tipRef} style={{position:'absolute',background:'rgba(255,255,255,.96)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:8,padding:'7px 10px',fontSize:12,color:'var(--txt)',pointerEvents:'none',display:'none',zIndex:99,fontFamily:'var(--m)',maxWidth:200,lineHeight:1.5}}/>
    </div>
  )
}

// ── Horizon helpers ───────────────────────────────────────────────────────────
function todayStr(){return new Date().toISOString().slice(0,10)}
function addDays(n){const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function endOfWeek(){const d=new Date();const day=d.getDay();d.setDate(d.getDate()+(day===0?0:7-day));return d.toISOString().slice(0,10)}
function endOfMonth(){const d=new Date();return new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10)}
function horizonDate(h){
  if(h==='today')return todayStr()
  if(h==='tomorrow')return addDays(1)
  if(h==='week')return endOfWeek()
  if(h==='month')return endOfMonth()
  return todayStr()
}
function matchesHorizon(task,h){
  if(h==='all')return true
  const td=todayStr(),tom=addDays(1)
  if(h==='today')return task.date===td
  if(h==='tomorrow')return task.date===tom
  if(h==='week')return task.date>=td&&task.date<=endOfWeek()
  if(h==='month')return task.date>=td&&task.date<=endOfMonth()
  return true
}

function getSchedRange(h){
  const today=new Date();const d0=today.toISOString().slice(0,10)
  if(h==='today')return{from:d0,to:d0}
  if(h==='tomorrow'){const t=addDays(1);return{from:t,to:t}}
  if(h==='week'){const day=today.getDay();const mon=new Date(today);mon.setDate(today.getDate()-(day===0?6:day-1));const sun=new Date(mon);sun.setDate(mon.getDate()+6);return{from:mon.toISOString().slice(0,10),to:sun.toISOString().slice(0,10)}}
  if(h==='biweek')return{from:d0,to:addDays(13)}
  if(h==='month'){const last=new Date(today.getFullYear(),today.getMonth()+1,0);return{from:d0,to:last.toISOString().slice(0,10)}}
  if(h&&h.length===7){const[y,m]=h.split('-').map(Number);const first=`${y}-${String(m).padStart(2,'0')}-01`;const last=new Date(y,m,0).toISOString().slice(0,10);return{from:first,to:last}}
  return{from:d0,to:d0}
}
function datesInRange(from,to){
  const dates=[];const d=new Date(from+'T00:00:00');const end=new Date(to+'T00:00:00')
  while(d<=end){dates.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1)}
  return dates
}
function nextTwelveMonths(){
  const months=[];const d=new Date();
  for(let i=0;i<12;i++){const nd=new Date(d.getFullYear(),d.getMonth()+i,1);months.push({key:`${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`,label:nd.toLocaleDateString('en-US',{month:'short',year:'2-digit'})})}
  return months
}

export default function App(){
  const{data:session,status}=useSession()
  const router=useRouter()
  const[view,setView]=useState('home')
  const[tasks,setTasks]=useState([])
  const[schedule,setSchedule]=useState(null)
  const[agents,setAgents]=useState([])
  const[settings,setSettings]=useState(null)
  const[oura,setOura]=useState(null)
  const[schedLoading,setSchedLoading]=useState(false)
  const[schedError,setSchedError]=useState(null)
  const[schedHorizon,setSchedHorizon]=useState('today')
  const[showMonthPicker,setShowMonthPicker]=useState(false)
  const[helpDismissed,setHelpDismissed]=useState({home:false,schedule:false,goals:false})
  const[showAddTask,setShowAddTask]=useState(false)
  const[showAddAgent,setShowAddAgent]=useState(false)
  const[checkin,setCheckin]=useState(null)
  const[checkinLoading,setCheckinLoading]=useState(false)
  const[checkinResult,setCheckinResult]=useState(null)
  const[checkinMsg,setCheckinMsg]=useState('')
  const[cooState,setCooState]=useState('idle')
  const[cooLabel,setCooLabel]=useState('COO idle')
  const[taskForm,setTaskForm]=useState({name:'',q:'do',cat:'career',blocks:2,who:'me',notes:''})
  const[newAgent,setNewAgent]=useState({name:'',icon:'',area:'career',prompt:''})
  const[taskHorizon,setTaskHorizon]=useState('today')
  const[qaName,setQaName]=useState('');const[qaQ,setQaQ]=useState('do');const[qaCat,setQaCat]=useState('career');const[qaB,setQaB]=useState(2);const[qaWhen,setQaWhen]=useState('today')
  const[tuning,setTuning]=useState(null);const[promptDraft,setPromptDraft]=useState('')
  const[proposals,setProposals]=useState([])
  const[proposalsOpen,setProposalsOpen]=useState(true)
  const[proposalsLoading,setProposalsLoading]=useState(false)
  const[isOnline,setIsOnline]=useState(true)
  const[isSunday]=useState(new Date().getDay()===0)
  const[weeklyBrief,setWeeklyBrief]=useState(null)
  const[treeData,setTreeData]=useState(null)
  const[treeLoading,setTreeLoading]=useState(false)
  const[treeGran,setTreeGran]=useState('year')
  const[tierExpanded,setTierExpanded]=useState(null)
  const tierRefs=useRef({})
  const[reevalOpen,setReevalOpen]=useState(false)
  const[seedLoading,setSeedLoading]=useState(false)
  const[seedResult,setSeedResult]=useState(null)
  const[reevalCtx,setReevalCtx]=useState('')
  const[reevalLoading,setReevalLoading]=useState(false)
  const[reevalResult,setReevalResult]=useState(null)
  const[reevalAttachments,setReevalAttachments]=useState([])
  const[goals,setGoals]=useState([])
  const[expandedGoal,setExpandedGoal]=useState(null)
  const[deletingGoalId,setDeletingGoalId]=useState(null)
  const[newGoalOpen,setNewGoalOpen]=useState(false)
  const[newGoalLoading,setNewGoalLoading]=useState(false)
  const[newGoalDraft,setNewGoalDraft]=useState({title:'',description:'',target_date:''})
  // Log done work
  const[logOpen,setLogOpen]=useState(false)
  const[logName,setLogName]=useState('')
  const[logBlocks,setLogBlocks]=useState(1)
  const[logCat,setLogCat]=useState('admin')
  const[logSubmitting,setLogSubmitting]=useState(false)
  const[logXp,setLogXp]=useState(null)
  const[matrixPanel,setMatrixPanel]=useState(null)
  const[matrixEdit,setMatrixEdit]=useState(null)
  const[vetoPanel,setVetoPanel]=useState(null)
  const[vetoReason,setVetoReason]=useState('')
  const[vetoPushback,setVetoPushback]=useState('')
  const[editingSlot,setEditingSlot]=useState(null)
  const[chatMsg,setChatMsg]=useState('')
  const[chatHistory,setChatHistory]=useState([])
  const[chatLoading,setChatLoading]=useState(false)
  const[isRecording,setIsRecording]=useState(false)
  const[chatVisible,setChatVisible]=useState(false)
  const mediaRecorderRef=useRef(null)
  const timerRefs=useRef([])
  const dragRef=useRef(null)
  const [taskOrder,setTaskOrder]=useState([])
  const [dragOver,setDragOver]=useState(null)
  const [undoInfo,setUndoInfo]=useState(null)
  const [schedAction,setSchedAction]=useState(null)
  const [schedManual,setSchedManual]=useState({date:'',time:''})
  const [schedActLoading,setSchedActLoading]=useState(false)
  const [expandedTask,setExpandedTask]=useState(null)

  const userId=session?.user?.email

  // Online/offline detection
  useEffect(()=>{
    const on=()=>setIsOnline(true);const off=()=>setIsOnline(false)
    window.addEventListener('online',on);window.addEventListener('offline',off)
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}
  },[])

  // Keep taskOrder in sync — preserve custom order, append newly loaded tasks at end
  useEffect(()=>{
    setTaskOrder(prev=>{
      const existing=new Set(prev)
      const filtered=tasks.filter(t=>t.status!=='wont_do')
      const newIds=filtered.filter(t=>!existing.has(t.id))
        .sort((a,b)=>({do:0,schedule:1,delegate:2,eliminate:3}[a.q]-{do:0,schedule:1,delegate:2,eliminate:3}[b.q])||(a.done-b.done))
        .map(t=>t.id)
      return [...prev.filter(id=>filtered.some(t=>t.id===id)),...newIds]
    })
  },[tasks])

  // Auto-clear undo toast after 5s
  useEffect(()=>{if(!undoInfo)return;const t=setTimeout(()=>setUndoInfo(null),5000);return()=>clearTimeout(t)},[undoInfo])

  // Realtime subscriptions
  useRealtime({
    userId,
    onTaskChange:(payload)=>{
      if(payload.eventType==='UPDATE'){setTasks(ts=>ts.map(t=>t.id===payload.new.id?payload.new:t))}
      else if(payload.eventType==='INSERT'){setTasks(ts=>[...ts.filter(t=>t.id!==payload.new.id),payload.new])}
      else if(payload.eventType==='DELETE'){setTasks(ts=>ts.filter(t=>t.id!==payload.old.id))}
    },
    onScheduleChange:(payload)=>{
      if(payload.new) setSchedule(payload.new)
    },
    onAgentChange:(payload)=>{
      if(payload.new) setAgents(as=>as.map(a=>a.id===payload.new.id?{...a,...payload.new}:a))
    },
  })

  // Initial load + onboarding redirect
  useEffect(()=>{
    if(status!=='authenticated')return
    api.settings.get().then(r=>{
      const s = r?.settings
      setSettings(s ?? null)
      if (!s || !s.onboarding_complete) { router.push('/onboarding'); return }
      Promise.all([
        api.tasks.list(todayStr(),addDays(35)).then(r=>r.tasks&&setTasks(r.tasks)),
        api.schedule.get().then(r=>r.schedule&&setSchedule(r.schedule)),
        api.agents.list().then(r=>r.agents&&setAgents(r.agents)),
        api.oura.get().then(r=>setOura(r)),
      ])
      api.propose.get().then(r=>{if(r.proposals)setProposals(r.proposals)})
      api.goals.get().then(r=>{
        const g=r.goals||[]
        setGoals(g)
        // Auto-seed goals from profile + Gmail if none exist yet
        if(g.filter(x=>x.status!=='archived').length===0){
          api.goals.seed().then(sr=>{if(sr.goals?.length&&sr.seeded)setGoals(sr.goals)})
        }
      })
    })
    // Schedule check-ins
    const h=new Date().getHours()
    if(h>=12&&h<13)timerRefs.current.push(setTimeout(()=>setCheckin('midday'),4000))
    if(h>=16&&h<17)timerRefs.current.push(setTimeout(()=>setCheckin('afternoon'),4000))
    if(h>=19&&h<21)timerRefs.current.push(setTimeout(()=>setCheckin('evening'),4000))
    // Sunday weekly review
    if(new Date().getDay()===0){
      api.coo.checkin('weekly','').then(r=>r.result&&setWeeklyBrief(r.result))
    }
    return()=>{timerRefs.current.forEach(id=>clearTimeout(id));timerRefs.current=[]}
  },[status])

  const doneTasks=tasks.filter(t=>t.done)
  const hrs=Math.round(doneTasks.reduce((s,t)=>s+t.blocks,0)*15/60*10)/10

  async function addTask(form){
    try{
      const{task}=await api.tasks.create(form)
      if(task){setTasks(t=>[...t,task]);setShowAddTask(false);setTaskForm({name:'',q:'do',cat:'career',blocks:2,who:'me',notes:''})}
      if(schedule)setSchedule(s=>({...s,stale:true}))
    }catch(e){console.error(e)}
  }

  async function toggleTask(id){
    const t=tasks.find(x=>x.id===id);if(!t)return
    setTasks(ts=>ts.map(x=>x.id===id?{...x,done:!x.done}:x)) // optimistic
    try{const{task}=await api.tasks.update(id,{done:!t.done});if(task)setTasks(ts=>ts.map(x=>x.id===id?task:x))}
    catch{setTasks(ts=>ts.map(x=>x.id===id?{...x,done:t.done}:x))} // rollback
  }

  async function generateSchedule(){
    setSchedLoading(true);setSchedError(null);setCooState('thinking');setCooLabel('Building your day…')
    try{
      const{schedule:s,error,proposed_tasks}=await api.schedule.generate({roadmap:settings?.roadmap})
      if(error)throw new Error(error)
      if(s)setSchedule(s)
      // Merge proposed tasks into matrix (replace any previous coo-proposed for same date)
      if(proposed_tasks?.length){
        const planDate=s?.date||s?.plan_date
        setTasks(ts=>[
          ...ts.filter(t=>!(t.status==='proposed'&&t.source==='coo'&&t.date===planDate)),
          ...proposed_tasks,
        ])
      }
      setCooState('ok');setCooLabel('Schedule ready')
    }catch(e){setSchedError(e.message||'Failed to generate schedule');setCooState('idle');setCooLabel('COO idle')}
    setSchedLoading(false)
  }

  function openVetoPanel(idx){setVetoPanel({idx});setVetoReason('');setVetoPushback('')}
  async function submitVeto(){
    if(!vetoPanel)return
    const idx=vetoPanel.idx;setVetoPanel(null)
    setCooState('thinking');setCooLabel('Assessing impact…')
    const pushDate=vetoPushback?horizonDate(vetoPushback):undefined
    try{const{slots}=await api.schedule.patch('veto',idx,{reason:vetoReason||undefined,pushback_date:pushDate});if(slots){setSchedule(s=>({...s,slots}));if(pushDate)setTasks(ts=>ts.map(t=>t.id===slots[idx]?.taskId?{...t,date:pushDate}:t))}}catch{}
    setCooState('ok');setCooLabel('Impact assessed')
    setVetoReason('');setVetoPushback('')
  }
  async function submitSlotEdit(){
    if(!editingSlot)return
    const{idx,label,time,note,blocks}=editingSlot;setEditingSlot(null)
    try{const{slots}=await api.schedule.patch('edit',idx,{label,time,note,duration_blocks:blocks});if(slots)setSchedule(s=>({...s,slots}))}catch{}
  }
  async function acceptSlot(idx){try{const{slots}=await api.schedule.patch('accept',idx);if(slots)setSchedule(s=>({...s,slots}))}catch{}}
  async function acceptAll(){try{const{slots}=await api.schedule.patch('accept_all',0);if(slots)setSchedule(s=>({...s,slots}))}catch{};setCooState('ok');setCooLabel('All accepted')}

  async function loadTree(){
    setTreeLoading(true)
    try{
      const j=await api.tree.get()
      setTreeData(j||null)
      // Auto-fetch Wikipedia photo for current species if not cached yet
      const row=j?.current_catalog_row
      if(row?.slug&&row?.name&&!row.image_url){
        fetch('/api/tree/photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:row.slug,name:row.name})})
          .then(r=>r.json())
          .then(({image_url})=>{if(image_url)setTreeData(d=>d?{...d,current_catalog_row:{...d.current_catalog_row,image_url}}:d)})
          .catch(()=>{})
      }
    }catch{}
    setTreeLoading(false)
  }

  async function runReeval(){
    setReevalLoading(true);setReevalResult(null)
    try{
      const attachText=reevalAttachments.filter(a=>a.status==='done'&&a.text).map(a=>a.text).join('\n\n')
      const ctx=reevalCtx+(attachText?'\n\n'+attachText:'')
      const r=await fetch('/api/tree/tier-eval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true,additional_context:ctx})})
      const j=await r.json()
      setReevalResult(j)
      if(j.tier&&!j.skipped)loadTree()
    }catch{}
    setReevalLoading(false)
  }

  async function acceptProposal(p){
    setProposals(ps=>ps.filter(x=>x.id!==p.id))
    const r=await api.propose.action('accept',p)
    if(r.task)setTasks(ts=>[...ts,r.task])
    if(r.proposals)setProposals(r.proposals)
  }
  async function dismissProposal(p){
    setProposals(ps=>ps.filter(x=>x.id!==p.id))
    const r=await api.propose.action('dismiss',p)
    if(r.proposals)setProposals(r.proposals)
  }
  async function regenProposals(){
    setProposalsLoading(true)
    const r=await api.propose.regen()
    if(r.proposals)setProposals(r.proposals)
    setProposalsLoading(false)
  }

  async function runSeed(){
    setSeedLoading(true)
    setSeedResult(null)
    try{
      const attachText=reevalAttachments.filter(a=>a.status==='done'&&a.text).map(a=>a.text).join('\n\n')
      const seedOutline=reevalCtx+(attachText?'\n\n'+attachText:'')
      const res=await fetch('/api/tree/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true,...(seedOutline.trim()&&{outline:seedOutline})})})
      const json=await res.json()
      if(json.skipped){
        const d=json.debug||{}
        setSeedResult({ok:false,msg:`Skipped (${json.reason}). outline:${d.outline_chars||0}ch, relseeds:${d.relseeds_chars||0}ch, coo_notes:${d.has_coo_notes}`})
      } else if(json.ok){
        // Persist outline to user_context if we had to supply it from the textarea
        if(seedOutline.trim()) fetch('/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({outline:seedOutline})}).catch(()=>{})
        await loadTree()
        const s=json.seeded; const d=json.debug||{}
        setSeedResult({ok:true,msg:`Seeded ${s.branches}b·${s.rings}r·${s.roots}rt·${s.relationships}rel (outline:${d.outline_chars}ch, errs:${d.insert_errors})`})
      } else {
        setSeedResult({ok:false,msg:json.error||'Unknown error'})
      }
    }catch(e){
      setSeedResult({ok:false,msg:'Network error'})
    }
    setSeedLoading(false)
  }

  async function extractReevalFile(file,id){
    try{
      const fd=new FormData();fd.append('file',file)
      const res=await fetch('/api/onboarding/extract-outline',{method:'POST',body:fd})
      const json=await res.json()
      if(!res.ok)throw new Error(json.error||'Upload failed')
      setReevalAttachments(prev=>prev.map(a=>a.id===id?{...a,status:'done',text:json.text}:a))
    }catch(err){
      setReevalAttachments(prev=>prev.map(a=>a.id===id?{...a,status:'error',errorMsg:err.message}:a))
    }
  }

  function handleReevalFileSelect(e){
    const selected=Array.from(e.target.files||[])
    e.target.value=''
    if(!selected.length)return
    const remaining=3-reevalAttachments.length
    if(remaining<=0)return
    const files=selected.slice(0,remaining)
    const newAtts=files.map(file=>({id:Math.random().toString(36).slice(2)+Date.now(),name:file.name,status:'extracting'}))
    setReevalAttachments(prev=>[...prev,...newAtts])
    files.forEach((file,i)=>extractReevalFile(file,newAtts[i].id))
  }

  async function createGoal(){
    if(!newGoalDraft.title.trim())return
    setNewGoalLoading(true)
    try{
      const r=await api.goals.create(newGoalDraft)
      if(r.goals)setGoals(r.goals)
      setNewGoalOpen(false)
      setNewGoalDraft({title:'',description:'',target_date:''})
      if(r.goal)setExpandedGoal(r.goal.id)
    }catch{}
    setNewGoalLoading(false)
  }

  async function patchGoal(body){
    const r=await api.goals.patch(body)
    if(r.goals)setGoals(r.goals)
  }

  async function confirmTask(id){
    setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'active'}:x))
    try{await api.tasks.update(id,{status:'active'})}catch{setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'proposed'}:x))}
  }

  async function wontDoTask(id){
    setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'wont_do'}:x))
    try{await api.tasks.update(id,{status:'wont_do'})}catch{setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'proposed'}:x))}
  }

  function handleZoneClick({q,horizon}){
    const when=horizon==='idk'?'today':horizon
    setTaskForm(f=>({...f,q,when,date:horizonDate(when)}))
    setShowAddTask(true)
  }

  function handleMatrixClick(id){
    const t=tasks.find(x=>x.id===id);if(!t)return
    if(matrixPanel?.id===id){setMatrixPanel(null);setMatrixEdit(null);return}
    setMatrixPanel(t);setMatrixEdit(null)
  }
  async function updateTaskQ(id,q){
    const orig=tasks.find(t=>t.id===id)?.q
    setTasks(ts=>ts.map(t=>t.id===id?{...t,q}:t));setMatrixPanel(p=>p?.id===id?{...p,q}:p)
    try{await api.tasks.update(id,{q})}catch{setTasks(ts=>ts.map(t=>t.id===id?{...t,q:orig}:t))}
  }
  async function saveMatrixEdit(){
    if(!matrixEdit||!matrixPanel)return
    const{name,blocks,cat}=matrixEdit;const orig={...matrixPanel}
    setTasks(ts=>ts.map(t=>t.id===matrixPanel.id?{...t,name,blocks,cat}:t))
    setMatrixPanel(p=>({...p,name,blocks,cat}));setMatrixEdit(null)
    try{await api.tasks.update(matrixPanel.id,{name,blocks,cat})}catch{setTasks(ts=>ts.map(t=>t.id===orig.id?orig:t));setMatrixPanel(orig)}
  }

  async function logDoneWork(){
    if(!logName.trim())return
    setLogSubmitting(true)
    try{
      const r=await api.tasks.create({name:logName.trim(),blocks:logBlocks,q:'do',cat:logCat,source:'manual_log',done:true})
      if(r.task){
        setTasks(ts=>[...ts,r.task])
        if(r.xp)setLogXp(r.xp)
        setLogName('');setLogBlocks(1)
        timerRefs.current.push(setTimeout(()=>setLogXp(null),4000))
      }
    }catch{}
    setLogSubmitting(false)
  }

  async function sendChat(){
    if(!chatMsg.trim())return
    const msg=chatMsg.trim();setChatMsg('');setChatLoading(true);setChatVisible(true)
    setChatHistory(h=>[...h.slice(-99),{role:'user',content:msg}])
    try{const r=await api.coo.checkin('chat',msg);const result=r?.result;if(result){const resp=result.message||result.headline||JSON.stringify(result);setChatHistory(h=>[...h.slice(-99),{role:'coo',content:resp}]);if(result.reschedule_needed)timerRefs.current.push(setTimeout(generateSchedule,1500))}else if(r?.error){setChatHistory(h=>[...h.slice(-99),{role:'coo',content:`Error: ${r.error}`}])}}catch(e){setChatHistory(h=>[...h.slice(-99),{role:'coo',content:`Network error — ${e.message||'check Vercel logs'}`}])}
    setChatLoading(false)
  }

  // Release mic stream on unmount if recording was interrupted
  useEffect(()=>()=>{
    const mr=mediaRecorderRef.current
    if(mr&&mr.state!=='inactive'){
      mr.onstop=null // prevent stale callback from firing
      mr.stop()
      mr.stream?.getTracks().forEach(t=>t.stop())
    }
  },[])

  async function startRecording(){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true})
      const mr=new MediaRecorder(stream);const chunks=[]
      mr.ondataavailable=e=>e.data.size&&chunks.push(e.data)
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop())
        const blob=new Blob(chunks,{type:chunks[0]?.type||'audio/webm'})
        const fd=new FormData();fd.append('file',blob,'voice.webm')
        try{const r=await fetch('/api/media',{method:'POST',body:fd});const j=await r.json();if(j.transcript)setChatMsg(m=>m?m+' '+j.transcript:j.transcript)}catch{}
        setIsRecording(false)
      }
      mediaRecorderRef.current=mr;mr.start();setIsRecording(true)
    }catch{setIsRecording(false)}
  }

  function stopRecording(){if(mediaRecorderRef.current?.state==='recording')mediaRecorderRef.current.stop()}

  async function runAgent(id){
    setAgents(as=>as.map(a=>a.id===id?{...a,status:'thinking'}:a))
    try{const{result}=await api.agents.run(id,false);if(result)setAgents(as=>as.map(a=>a.id===id?{...a,...result}:a))}
    catch{setAgents(as=>as.map(a=>a.id===id?{...a,status:'idle'}:a))}
  }

  async function rateAgent(id){const a=agents.find(x=>x.id===id);const score=Math.min(99,(a.score||50)+3);const streak=(a.streak||0)+1;await api.agents.update(id,{score,streak});setAgents(as=>as.map(a=>a.id===id?{...a,score,streak}:a))}

  async function submitCheckin(){
    setCheckinLoading(true)
    try{const{result}=await api.coo.checkin(checkin,checkinMsg);setCheckinResult(result);if(result?.reschedule_needed)timerRefs.current.push(setTimeout(generateSchedule,1500))}catch{}
    setCheckinLoading(false)
  }

  // ── Drag-to-reorder + drag-to-matrix ────────────────────────────────────────
  function handleDragStart(e,taskId,idx){
    dragRef.current={id:taskId,fromIdx:idx}
    e.dataTransfer.effectAllowed='move'
    e.dataTransfer.setData('text/plain',taskId)
  }
  function handleTaskDragOver(e,idx){
    e.preventDefault();e.dataTransfer.dropEffect='move'
    if(dragOver!==idx)setDragOver(idx)
  }
  function handleTaskDrop(e,toIdx,orderedList){
    e.preventDefault();e.stopPropagation()
    const {id}=dragRef.current||{};if(!id){setDragOver(null);return}
    const fromPos=taskOrder.indexOf(id);const toId=orderedList[toIdx]?.id
    const toPos=toId&&toId!==id?taskOrder.indexOf(toId):taskOrder.length
    if(fromPos===toPos){setDragOver(null);dragRef.current=null;return}
    const next=[...taskOrder];const[moved]=next.splice(fromPos,1);next.splice(toPos,0,moved)
    setUndoInfo({prevOrder:taskOrder,label:'reorder'})
    setTaskOrder(next);setDragOver(null);dragRef.current=null
  }
  function handleDropOnMatrix(e,q){
    e.preventDefault()
    const taskId=dragRef.current?.id||e.dataTransfer.getData('text/plain');if(!taskId)return
    const t=tasks.find(x=>x.id===taskId);if(!t||t.q===q)return
    setUndoInfo({prevTasks:[...tasks],prevOrder:[...taskOrder],label:`move to ${q}`})
    updateTaskQ(taskId,q);dragRef.current=null
  }
  function handleUndo(){
    if(!undoInfo)return
    if(undoInfo.prevTasks)setTasks(undoInfo.prevTasks)
    if(undoInfo.prevOrder)setTaskOrder(undoInfo.prevOrder)
    setUndoInfo(null)
  }

  // ── Schedule-quadrant action ─────────────────────────────────────────────────
  async function handleSchedOption(taskId,option){
    const t=tasks.find(x=>x.id===taskId);if(!t)return
    if(option==='manual'){
      setSchedManual({date:t.date||todayStr(),time:''})
      setSchedAction({taskId,phase:'manual'})
    }else if(option==='auto'){
      setSchedAction({taskId,phase:'auto_horizon'})
    }else if(option==='delegate'){
      setSchedAction(null);setSchedActLoading(true)
      try{
        await api.coo.checkin('delegate',`Handle this for me and schedule a check-in to discuss progress: "${t.name}" (${t.cat}, ~${t.blocks*15}min)`)
        const updates={q:'delegate',status:'active'}
        setTasks(ts=>ts.map(x=>x.id===taskId?{...x,...updates}:x))
        await api.tasks.update(taskId,{q:'delegate'})
      }catch{}
      setSchedActLoading(false)
    }
  }
  async function confirmManualSched(taskId){
    const{date,time}=schedManual;setSchedAction(null)
    const updates={date:date||todayStr(),q:'do',status:'active',...(time?{notes:`Scheduled at ${time}`}:{})}
    setTasks(ts=>ts.map(x=>x.id===taskId?{...x,...updates}:x))
    try{await api.tasks.update(taskId,updates)}catch{}
  }
  async function handleSchedAutoHorizon(taskId,horizon){
    setSchedAction(null);setSchedActLoading(true)
    if(horizon!=='idk'){
      // week = not today/tmrw → end of this week; month = not this week → end of month
      const newDate=horizon==='today'?todayStr():horizon==='tmrw'?addDays(1):horizon==='week'?endOfWeek():horizon==='month'?endOfMonth():null
      if(newDate){
        setTasks(ts=>ts.map(x=>x.id===taskId?{...x,date:newDate}:x))
        try{await api.tasks.update(taskId,{date:newDate})}catch{}
      }
    }
    await generateSchedule()
    setSchedActLoading(false)
  }

  if(status==='loading')return(<><div style={{position:'fixed',inset:0,background:'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)',zIndex:0}}/><TreeSVG/><div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20}}><div style={{width:24,height:24,border:'3px solid rgba(122,170,138,0.3)',borderTopColor:'#2d7a52',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>)

  if(status==='unauthenticated')return(
    <><div style={{position:'fixed',inset:0,background:'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)',zIndex:0}}/>
    <img src="/FFTT.jpg" alt="" style={{position:'fixed',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.8,zIndex:1,pointerEvents:'none'}}/>
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 28px',maxWidth:320,width:'100%',textAlign:'center',border:'1px solid rgba(255,255,255,.9)',boxShadow:'0 20px 60px rgba(20,60,35,.35)'}}>
        <div style={{fontSize:38,marginBottom:8}}>🌲</div>
        <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:26,color:'#182e22',marginBottom:4,fontStyle:'italic'}}>Forest for the Tree</div>
        <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10.5,color:'#7aaa8a',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:20}}>Life OS · v2</div>
        <p style={{fontSize:14.5,color:'#3a5c47',marginBottom:20,lineHeight:1.65}}>Your autonomous COO reads Calendar, Gmail, and Tasks — then builds and manages your day, ADHD-aware.</p>
        <button onClick={()=>signIn('google')}style={{width:'100%',background:'#1a5a3c',color:'#fff',border:'none',borderRadius:8,padding:'11px 0',fontSize:15,fontWeight:600,cursor:'pointer',fontFamily:'Figtree,sans-serif'}}>Continue with Google</button>
        <p style={{fontSize:11.5,color:'#7aaa8a',marginTop:10,fontFamily:'JetBrains Mono,monospace'}}>Calendar · Gmail · Tasks · Contacts · Oura</p>
      </div>
    </div></>
  )

  const viewTitle={home:"Today's field",schedule:'COO Schedule',agents:'Agent network',log:'Performance log',settings:'Settings',tree:'Life tree',goals:'Goals'}
  const statusColor={idle:'#b0ccb8',thinking:'#b85c00',alert:'#8a2828',ok:'#0f6e56'}
  const pendingSlots=schedule?.slots?.filter(s=>s.taskId&&(s.state==='pending'||s.state==='optional')).length||0
  const alertAgents=agents.filter(a=>a.status==='alert').length
  const navItems=[
    {id:'home',icon:'◈',label:'Matrix',badge:tasks.filter(t=>!t.done).length,bc:'var(--ok)'},
    {id:'schedule',icon:'◷',label:'Schedule',badge:pendingSlots,bc:'var(--danger)'},
    {id:'agents',icon:'⬡',label:'Agents',badge:alertAgents,bc:'var(--danger)'},
    {id:'goals',icon:'🎯',label:'Goals',badge:goals.filter(g=>g.status==='active').length,bc:'var(--ok)'},
    {id:'tree',icon:'🌲',label:'Life tree',badge:0,bc:''},
    {id:'log',icon:'◻',label:'Log',badge:0,bc:''},
    {id:'settings',icon:'⚙',label:'Settings',badge:0,bc:''},
  ]

  return(
    <><div className="app-bg"/><TreeSVG/>
    {!isOnline&&<div style={{position:'fixed',top:0,left:0,right:0,background:'rgba(138,40,40,0.92)',backdropFilter:'blur(8px)',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:13.5,color:'#fff',fontFamily:'JetBrains Mono,monospace',zIndex:500}}>● Offline — tasks saved, will sync when reconnected</div>}

    <div style={{position:'fixed',inset:0,zIndex:10,display:'flex'}}>
      {/* SIDEBAR */}
      <nav style={{width:196,flexShrink:0,background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderRight:'1px solid var(--gb)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 15px 11px',borderBottom:'1px solid var(--gb2)'}}>
          <div style={{fontFamily:'var(--s)',fontSize:18,color:'var(--txt)',fontStyle:'italic',lineHeight:1.2}}>Forest for the Tree</div>
          <div style={{fontFamily:'var(--m)',fontSize:'10px',color:'var(--txt3)',letterSpacing:'.12em',textTransform:'uppercase',marginTop:2}}>Life OS · v2</div>
        </div>
        {/* COO + Oura status */}
        <div style={{margin:'8px 8px 0',padding:'8px 10px',borderRadius:'var(--r)',border:'1px solid var(--gb2)',background:'var(--glass2)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:oura?.connected?6:0}}>
            <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:statusColor[cooState],animation:cooState==='thinking'?'blink 1.2s infinite':cooState==='alert'?'blink .6s infinite':'none'}}/>
            <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)'}}>{cooLabel}</div>
          </div>
          {oura?.connected&&oura?.data?.readiness?(
            <div style={{display:'flex',alignItems:'center',gap:6,paddingTop:4,borderTop:'1px solid var(--gb2)'}}>
              <span style={{fontSize:14}}>💍</span>
              <div>
                <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)'}}>Readiness: <strong style={{color:oura.data.readiness.score>=70?'var(--ok)':oura.data.readiness.score>=50?'var(--warn)':'var(--danger)'}}>{oura.data.readiness.score}</strong>/100</div>
                <div style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)',marginTop:1}}>{oura.data.sleep?.score?`Sleep ${oura.data.sleep.score}/100 · `:''}{oura.data.energy_level} energy</div>
              </div>
            </div>
          ):!oura?.connected?(
            <div style={{paddingTop:4,borderTop:'1px solid var(--gb2)'}}>
              <a href="/settings" style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)',textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:12}}>💍</span>Connect Oura →
              </a>
            </div>
          ):null}
        </div>
        <div style={{flex:1,padding:'10px 8px',display:'flex',flexDirection:'column',gap:2}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>{setView(item.id);if(item.id==='schedule'&&!schedule)generateSchedule();if(item.id==='tree'&&!treeData)loadTree()}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:'var(--r)',cursor:'pointer',color:view===item.id?'var(--acc2)':'var(--txt2)',fontSize:14.5,border:view===item.id?'1px solid rgba(45,122,82,0.35)':'1px solid transparent',background:view===item.id?'rgba(45,122,82,0.10)':'transparent',width:'100%',textAlign:'left',fontFamily:'var(--f)',fontWeight:view===item.id?600:400,boxShadow:view===item.id?'inset 3px 0 0 var(--acc2)':'none',transition:'all .13s'}}>
              <span style={{fontSize:16,width:17,textAlign:'center'}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.badge>0&&<span style={{fontFamily:'var(--m)',fontSize:10.5,background:item.bc,color:'#fff',padding:'1px 5px',borderRadius:9}}>{item.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:'10px 8px',borderTop:'1px solid var(--gb2)'}}>
          <div style={{padding:'8px 10px',background:'var(--glass2)',borderRadius:'var(--r)',border:'1px solid var(--gb2)'}}>
            <div style={{fontFamily:'var(--s)',fontSize:14.5,color:'var(--txt)',fontStyle:'italic'}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
            <div style={{fontFamily:'var(--m)',fontSize:9.5,color:'var(--txt3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session?.user?.email}</div>
          </div>
          <a href="/about" style={{display:'block',textAlign:'center',marginTop:6,fontFamily:'var(--m)',fontSize:10.5,color:'var(--txt3)',textDecoration:'none',opacity:.7}}>? About this app</a>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderBottom:'1px solid var(--gb2)',flexShrink:0}}>
          <span style={{fontFamily:'var(--s)',fontSize:17,fontStyle:'italic',color:'var(--txt2)'}}>{viewTitle[view]}</span>
          <div style={{display:'flex',gap:7}}>
            {view==='home'&&<>
              <div style={{display:'flex',alignItems:'baseline',gap:3,background:'var(--glass2)',border:'1px solid var(--gb2)',padding:'3px 9px',borderRadius:16}}><span style={{fontFamily:'var(--m)',fontSize:15,fontWeight:500,color:'var(--acc2)'}}>{doneTasks.length}</span><span style={{fontSize:11,color:'var(--txt3)'}}>done</span></div>
              <div style={{display:'flex',alignItems:'baseline',gap:3,background:'var(--glass2)',border:'1px solid var(--gb2)',padding:'3px 9px',borderRadius:16}}><span style={{fontFamily:'var(--m)',fontSize:15,fontWeight:500,color:'var(--del)'}}>{hrs}h</span><span style={{fontSize:11,color:'var(--txt3)'}}>invested</span></div>
              <button className="btn-primary" onClick={()=>setShowAddTask(true)}>+ Task</button>
            </>}
            {view==='schedule'&&<><button className="btn-ghost" onClick={generateSchedule} disabled={schedLoading}>↺ Re-plan</button><button className="btn-primary" onClick={acceptAll}>Accept all</button></>}
            {view==='agents'&&<button className="btn-primary" onClick={()=>setShowAddAgent(true)}>+ Agent</button>}
            {view==='goals'&&<button className="btn-primary" onClick={()=>setNewGoalOpen(true)}>+ Goal</button>}
          </div>
        </div>

        {view==='tree'
          ?<div style={{flex:1,minHeight:0,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,minHeight:0,overflow:'hidden',borderRadius:'var(--r2)',margin:'8px 0 8px 8px'}}>
              {treeLoading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontFamily:'var(--m)',fontSize:13,color:'var(--txt3)'}}>Growing your tree…</div>}
              {!treeLoading&&<TreeView treeData={treeData} treeLoading={treeLoading} treeError={null} gran={treeGran} onGranChange={setTreeGran}/>}
            </div>
            {/* ── SIDE PANEL ─────────────────────────────────────────── */}
            {(()=>{
              const sp=treeData?.species
              const cat=treeData?.current_catalog_row
              const next=treeData?.next_milestone
              const catalog=treeData?.catalog||[]
              const currentTier=sp?.current_tier||1
              const hXP=sp?.height_xp||0
              const wXP=sp?.width_xp||0
              const streak=sp?.current_streak||0
              const longestStreak=sp?.longest_streak||0
              const streakMult=Math.round(Math.min(2.5,1.0+streak*0.05)*100)/100
              const nextMilestoneStreak=streak<3?3:streak<7?7:streak<14?14:streak<21?21:streak<30?30:null
              const nextMilestoneBonus=nextMilestoneStreak?Math.round(Math.min(2.5,1.0+nextMilestoneStreak*0.05)*100)/100:null
              // XP targets from next species dimensions (rough approximation)
              const nextH=next?Math.round(next.height_ft*60):Math.max(hXP*1.5,100)
              const nextW=next?Math.round(next.width_ft*180):Math.max(wXP*1.5,100)
              // Group catalog into tier groups
              const groups={}
              catalog.forEach(r=>{
                if(!groups[r.tier_group])groups[r.tier_group]={name:r.group_name,minTier:r.tier,maxTier:r.tier,species:[]}
                groups[r.tier_group].species.push(r)
                groups[r.tier_group].minTier=Math.min(groups[r.tier_group].minTier,r.tier)
                groups[r.tier_group].maxTier=Math.max(groups[r.tier_group].maxTier,r.tier)
              })
              const groupList=Object.entries(groups).map(([g,v])=>({...v,id:+g})).sort((a,b)=>a.minTier-b.minTier)
              const activeTierGroup=catalog.find(r=>r.tier===currentTier)?.tier_group
              return(
                <div style={{width:240,flexShrink:0,borderLeft:'1px solid rgba(0,0,0,.09)',background:'rgba(250,249,246,.98)',display:'flex',flexDirection:'column',overflowY:'auto',fontSize:14}}>
                  {/* Species header */}
                  <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
                      <span style={{fontFamily:'var(--m)',fontSize:11,fontWeight:700,color:'#182e22',letterSpacing:'.1em',textTransform:'uppercase'}}>LEVEL {currentTier}</span>
                      <span style={{width:4,height:4,borderRadius:'50%',background:'#4a9e6b',display:'inline-block'}}/>
                    </div>
                    <div style={{fontFamily:'var(--m)',fontSize:11,color:'#7aaa8a',marginBottom:7}}>{cat?.group_name||'—'}</div>
                    <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:22,fontWeight:600,color:'#182e22',marginBottom:2,lineHeight:1.2}}>{cat?.emoji||sp?.species_emoji||'🌿'} {cat?.name||sp?.species_name||'Seedling'}</div>
                    {cat?.height_ft&&<div style={{fontFamily:'var(--m)',fontSize:11,color:'#7aaa8a',marginBottom:8}}>{cat.height_ft} ft height · {cat.width_ft} ft wide</div>}
                    {cat?.fact&&<div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:13,fontStyle:'italic',color:'#3a5c47',lineHeight:1.55,marginBottom:3}}>{cat.fact}</div>}
                    {cat?.exemplar&&<div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:12,fontStyle:'italic',color:'#7aaa8a',lineHeight:1.4}}>"{cat.exemplar}"</div>}
                  </div>
                  {/* XP progress */}
                  <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a',marginBottom:10}}>Progress</div>
                    {[['Height XP · mastery',hXP,nextH,'#4a9e6b'],['Width XP · impact',wXP,nextW,'#1a5fa8']].map(([label,val,max,col])=>(
                      <div key={label} style={{marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                          <span style={{fontFamily:'var(--m)',fontSize:11,color:'#3a5c47'}}>{label}</span>
                          <span style={{fontFamily:'var(--m)',fontSize:11,color:'#182e22',fontWeight:500}}>{val.toLocaleString()} / {max.toLocaleString()}</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:'rgba(0,0,0,.07)',overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,background:col,width:`${Math.min(100,(val/Math.max(max,1))*100).toFixed(1)}%`,transition:'width .4s'}}/>
                        </div>
                      </div>
                    ))}
                    {next&&<div style={{fontFamily:'var(--m)',fontSize:10.5,color:'#7aaa8a',marginTop:2}}>Next: {next.emoji} {next.name} #{next.tier} · +{(nextH-hXP).toLocaleString()} H · +{(nextW-wXP).toLocaleString()} W</div>}
                  </div>
                  {/* Streak */}
                  <div style={{padding:'10px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:15}}>🔥</span>
                        <span style={{fontFamily:'var(--m)',fontSize:11,fontWeight:600,color:streak>=7?'#b85c00':'#3a5c47'}}>{streak} day streak</span>
                      </div>
                      <span style={{fontFamily:'var(--m)',fontSize:11,color:'#1a5a3c',fontWeight:600}}>{streakMult}×</span>
                    </div>
                    {streak>0&&(
                      <div style={{height:3,borderRadius:2,background:'rgba(0,0,0,.07)',overflow:'hidden',marginBottom:4}}>
                        <div style={{height:'100%',borderRadius:2,background:'linear-gradient(90deg,#b85c00,#e8a030)',width:`${Math.min(100,(streak/30)*100)}%`,transition:'width .4s'}}/>
                      </div>
                    )}
                    <div style={{fontFamily:'var(--m)',fontSize:10,color:'#7aaa8a'}}>
                      {streak===0?'Complete a task to start your streak':
                       nextMilestoneStreak?`${nextMilestoneStreak-streak} more days → ${nextMilestoneBonus}× bonus`:`Max bonus reached! 2.5× XP on every task`}
                      {longestStreak>streak&&longestStreak>0&&<span style={{marginLeft:6,opacity:.6}}>· best: {longestStreak}</span>}
                    </div>
                  </div>
                  {/* Tier ladder */}
                  <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a',marginBottom:8}}>Tier Ladder</div>
                    {groupList.map(grp=>{
                      const unlocked=grp.minTier<=currentTier
                      const isCurrent=grp.id===activeTierGroup
                      const isOpen=tierExpanded===grp.id||(isCurrent&&tierExpanded===null)
                      return(
                        <div key={grp.id} style={{marginBottom:3}} ref={el=>{tierRefs.current[grp.id]=el}}>
                          <button onClick={()=>{const opening=!isOpen;setTierExpanded(opening?grp.id:-1);if(opening)setTimeout(()=>tierRefs.current[grp.id]?.scrollIntoView({behavior:'smooth',block:'nearest'}),80)}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:6,border:`1px solid ${isCurrent?'rgba(26,90,60,.2)':'rgba(0,0,0,.08)'}`,background:isCurrent?'rgba(26,90,60,.05)':unlocked?'#fff':'rgba(0,0,0,.02)',cursor:'pointer',textAlign:'left'}}>
                            <div style={{fontFamily:'var(--m)',fontSize:11.5,color:unlocked?'#182e22':'#b0bab4',fontWeight:isCurrent?600:400}}>{unlocked?'':`🔒 `}Tier {grp.id} · {grp.name} <span style={{color:'#9aaa8a',fontWeight:400}}>#{grp.minTier}–{grp.maxTier}</span></div>
                            <span style={{color:'#7aaa8a',fontSize:11,fontWeight:600}}>{isOpen?'–':'›'}</span>
                          </button>
                          {isOpen&&unlocked&&(
                            <div style={{paddingLeft:4,paddingTop:2,display:'flex',flexDirection:'column',gap:0}}>
                              {grp.species.map(s=>{
                                const isCur=s.tier===currentTier
                                const isUnlocked=s.tier<=currentTier
                                return(
                                  <div key={s.tier} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:4,background:isCur?'rgba(26,90,60,.07)':'transparent',opacity:isUnlocked?1:.35,borderBottom:'1px solid rgba(0,0,0,.04)'}}>
                                    <span style={{fontSize:14,width:15,textAlign:'center'}}>{s.emoji}</span>
                                    <span style={{fontFamily:'Figtree,sans-serif',fontSize:13.5,color:isCur?'#182e22':'#4a6a50',flex:1,fontWeight:isCur?500:400}}>{s.name}</span>
                                    {isCur&&<span style={{fontSize:11,color:'#1a5a3c',fontWeight:600}}>►</span>}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {/* Manage tree */}
                  <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <button onClick={()=>{setReevalOpen(o=>!o);setReevalResult(null)}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',background:'none',border:'none',cursor:'pointer',padding:0}}>
                      <span style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a'}}>Manage tree</span>
                      <span style={{color:'#7aaa8a',fontSize:11}}>{reevalOpen?'▾':'›'}</span>
                    </button>
                    {reevalOpen&&(
                      <div style={{marginTop:8}}>
                        <div style={{fontFamily:'var(--m)',fontSize:11,color:'#7aaa8a',marginBottom:5,lineHeight:1.5}}>Add career history, certifications, or projects the COO should know when ranking you.</div>
                        <textarea value={reevalCtx} onChange={e=>setReevalCtx(e.target.value)} rows={4} placeholder="e.g. 10 years in ML engineering, shipped 3 production models, published 2 papers…" style={{width:'100%',background:'#fff',border:'1px solid rgba(0,0,0,.12)',borderRadius:6,color:'#182e22',fontSize:12,padding:'6px 8px',fontFamily:'Figtree,sans-serif',resize:'vertical',outline:'none',lineHeight:1.5,boxSizing:'border-box'}}/>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                          <label style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:5,cursor:reevalAttachments.length>=3?'not-allowed':'pointer',border:'1px dashed rgba(122,170,138,.5)',fontSize:11.5,color:'#7aaa8a',fontFamily:'var(--m)',background:'rgba(45,122,82,.03)',opacity:reevalAttachments.length>=3?.4:1}}>
                            📎 Attach
                            <input type="file" multiple accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,image/*" style={{display:'none'}} onChange={handleReevalFileSelect} disabled={reevalAttachments.length>=3}/>
                          </label>
                          <span style={{fontFamily:'var(--m)',fontSize:10.5,color:'#7aaa8a'}}>{reevalAttachments.length>0?`${reevalAttachments.length}/3 files`:'up to 3 · txt md pdf img'}</span>
                        </div>
                        {reevalAttachments.length>0&&(
                          <div style={{marginTop:5,display:'flex',flexDirection:'column',gap:3}}>
                            {reevalAttachments.map(a=>(
                              <div key={a.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 7px',borderRadius:4,background:'#f8f7f4',border:'1px solid rgba(0,0,0,.08)'}}>
                                <span style={{fontSize:12}}>{a.status==='extracting'?'⏳':a.status==='done'?'✓':'✗'}</span>
                                <span style={{fontFamily:'var(--m)',fontSize:10.5,color:a.status==='error'?'#8a2828':'#3a5c47',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                                <button onClick={()=>setReevalAttachments(prev=>prev.filter(x=>x.id!==a.id))} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#7aaa8a',padding:'0 2px',lineHeight:1}}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {reevalResult&&!reevalResult.error&&!reevalResult.skipped&&(
                          <div style={{padding:'7px 9px',background:'rgba(26,90,60,.06)',border:'1px solid rgba(26,90,60,.15)',borderRadius:6,fontFamily:'var(--m)',fontSize:11.5,color:'#3a5c47',lineHeight:1.5,marginTop:6}}>
                            <strong style={{color:'#1a5a3c'}}>Tier {reevalResult.tier} — {reevalResult.catalog_row?.emoji} {reevalResult.catalog_row?.name}</strong><br/>{reevalResult.reason}
                          </div>
                        )}
                        {reevalResult?.error&&<div style={{fontFamily:'var(--m)',fontSize:11,color:'#8a2828',marginTop:5}}>{reevalResult.error}</div>}
                        <div style={{display:'flex',gap:6,marginTop:7}}>
                          <button onClick={runReeval} disabled={reevalLoading} style={{flex:1,padding:'5px 0',borderRadius:6,border:'1px solid rgba(26,90,60,.25)',background:'rgba(26,90,60,.08)',color:'#1a5a3c',fontFamily:'var(--m)',fontSize:11.5,fontWeight:500,cursor:'pointer',opacity:reevalLoading?.6:1}}>{reevalLoading?'Evaluating…':'Re-evaluate tier'}</button>
                          <button onClick={()=>{setReevalOpen(false);setReevalCtx('');setReevalResult(null);setReevalAttachments([])}} style={{padding:'5px 10px',borderRadius:6,border:'1px solid rgba(0,0,0,.1)',background:'none',color:'#7aaa8a',fontFamily:'var(--m)',fontSize:11.5,cursor:'pointer'}}>Cancel</button>
                        </div>
                        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(0,0,0,.07)'}}>
                          <div style={{fontFamily:'var(--m)',fontSize:10.5,color:'#7aaa8a',marginBottom:5}}>Rebuild tree from career outline</div>
                          <button onClick={runSeed} disabled={seedLoading} style={{width:'100%',padding:'5px 0',borderRadius:6,border:'1px solid rgba(0,0,0,.08)',background:'#fff',color:'#3a5c47',fontFamily:'var(--m)',fontSize:11,cursor:'pointer',opacity:seedLoading?.6:1}}>{seedLoading?'Re-seeding…':'↺ Re-seed branches, roots & relationships'}</button>
                          {seedResult&&<div style={{marginTop:5,fontFamily:'var(--m)',fontSize:10,color:seedResult.ok?'#3a7d44':'#b94a3a',lineHeight:1.4}}>{seedResult.msg}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Granularity footer */}
                  <div style={{padding:'10px 14px 10px',background:'rgba(245,244,240,.98)',borderTop:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',gap:5}}>
                      {['year','month','week'].map(g=>(
                        <button key={g} onClick={()=>setTreeGran(g)} style={{flex:1,padding:'5px 0',borderRadius:6,border:`1px solid ${treeGran===g?'rgba(26,90,60,.25)':'rgba(0,0,0,.1)'}`,background:treeGran===g?'rgba(26,90,60,.07)':'#fff',fontFamily:'var(--m)',fontSize:11.5,color:treeGran===g?'#1a5a3c':'#7aaa8a',cursor:'pointer',textTransform:'capitalize',fontWeight:treeGran===g?600:400}}>{g}</button>
                      ))}
                    </div>
                    <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:11,fontStyle:'italic',color:'#9aaa8a',marginTop:7,textAlign:'center'}}>🌱 roots & legacy below ground</div>
                  </div>
                </div>
              )
            })()}
          </div>
          :<><div className="scroll">
          {/* HOME */}
          {view==='home'&&<>
            {!helpDismissed.home&&<div style={{padding:'10px 14px',background:'rgba(26,90,60,0.07)',border:'1px solid rgba(26,90,60,0.15)',borderRadius:'var(--r2)',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:18,flexShrink:0}}>◈</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--acc2)',fontWeight:600,marginBottom:3}}>Eisenhower Matrix — your task command centre</div>
                <div style={{fontSize:13,color:'var(--txt2)',lineHeight:1.6}}><strong>Do</strong> = urgent + important (top right). <strong>Schedule</strong> = important, not urgent (bottom right). <strong>Delegate</strong> = urgent, not important (top left). <strong>Eliminate</strong> = neither (bottom left). Bubble size = time needed. Dashed = COO-proposed. Use the horizon filter (Today / Week / Month) to focus on what matters now. The COO reads this matrix when building your schedule.</div>
              </div>
              <button onClick={()=>setHelpDismissed(h=>({...h,home:true}))} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:18,padding:0,flexShrink:0}}>×</button>
            </div>}
            {/* Sunday weekly brief */}
            {isSunday&&weeklyBrief&&(
              <div style={{padding:'10px 14px',background:'var(--glass2)',backdropFilter:'blur(14px)',border:'1px solid var(--gb2)',borderRadius:'var(--r2)',fontFamily:'var(--m)',fontSize:13,color:'var(--txt2)',lineHeight:1.7}}>
                <div style={{color:'var(--acc2)',fontWeight:500,marginBottom:4}}>📊 Weekly review</div>
                <div>{weeklyBrief.message||weeklyBrief.headline}</div>
                {weeklyBrief.on_pace!==undefined&&<div style={{marginTop:4,color:weeklyBrief.on_pace?'var(--ok)':'var(--warn)'}}>{weeklyBrief.on_pace?'✓ On pace for goal':'⚠ Falling behind — adjust this week'}</div>}
              </div>
            )}
            {proposals.length>0&&(
              <div className="card">
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderBottom:'1px solid var(--gb2)',cursor:'pointer'}} onClick={()=>setProposalsOpen(o=>!o)}>
                  <span style={{fontFamily:'var(--m)',fontSize:11,textTransform:'uppercase',letterSpacing:'.1em',color:'#7aaa8a'}}>COO proposals</span>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontFamily:'var(--m)',fontSize:10.5,color:'var(--txt3)'}}>{proposals.length} suggested</span>
                    <button onClick={e=>{e.stopPropagation();regenProposals()}} disabled={proposalsLoading} style={{fontFamily:'var(--m)',fontSize:10.5,padding:'2px 7px',borderRadius:4,border:'1px solid var(--gb2)',background:'transparent',cursor:'pointer',color:'var(--txt3)',opacity:proposalsLoading?.5:1}}>
                      {proposalsLoading?'…':'↺'}
                    </button>
                    <span style={{fontFamily:'var(--m)',fontSize:12,color:'var(--txt3)'}}>{proposalsOpen?'▾':'▸'}</span>
                  </div>
                </div>
                {proposalsOpen&&(
                  <div style={{padding:'6px 10px 10px',display:'flex',flexDirection:'column',gap:5}}>
                    {proposals.map(p=>(
                      <div key={p.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'8px 9px',borderRadius:'var(--r)',border:'1px dashed var(--gb2)',background:'rgba(122,170,138,0.04)'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,color:'var(--txt)',marginBottom:3,fontFamily:'var(--f)'}}>{p.name}</div>
                          <div style={{fontSize:11.5,color:'var(--txt3)',fontFamily:'var(--m)',lineHeight:1.5}}>{p.rationale}</div>
                          <div style={{display:'flex',gap:4,marginTop:4,alignItems:'center'}}>
                            <span style={{fontFamily:'var(--m)',fontSize:10,padding:'1px 5px',borderRadius:3,background:'rgba(26,90,60,.1)',color:'#1a5a3c'}}>{p.q}</span>
                            <span style={{fontFamily:'var(--m)',fontSize:10,padding:'1px 5px',borderRadius:3,background:'rgba(122,170,138,.12)',color:'#3a5c47'}}>{p.cat}</span>
                            <span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>{p.blocks}×15min</span>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:4,flexShrink:0,paddingTop:1}}>
                          <button onClick={()=>acceptProposal(p)} style={{fontFamily:'var(--m)',fontSize:11,padding:'3px 8px',borderRadius:4,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'#0f6e56',cursor:'pointer'}}>+ Add</button>
                          <button onClick={()=>dismissProposal(p)} style={{fontFamily:'var(--m)',fontSize:11,padding:'3px 7px',borderRadius:4,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',cursor:'pointer'}}>Skip</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <MatrixCanvas tasks={tasks.filter(t=>t.status!=='wont_do'&&matchesHorizon(t,taskHorizon))} onToggle={handleMatrixClick} selectedId={matrixPanel?.id} onZoneClick={handleZoneClick} onMatrixDrop={handleDropOnMatrix}/>
            {/* Matrix task action panel */}
            {matrixPanel&&(()=>{
              const t=matrixPanel
              const cats=settings?.life_areas?.map(a=>a.key)||Object.keys(CAT_COLORS)
              const Q_META=[['do','Do','do'],['schedule','Schedule','sch'],['delegate','Delegate','del'],['eliminate','Eliminate','eli']]
              return(
                <div className="card" style={{borderTop:'2px solid var(--acc)'}}>
                  <div style={{padding:'11px 13px 13px'}}>
                    {/* Header row */}
                    <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:9}}>
                      {matrixEdit
                        ?<input value={matrixEdit.name} onChange={e=>setMatrixEdit(s=>({...s,name:e.target.value}))} style={{flex:1,background:'rgba(255,255,255,.8)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt)',fontSize:15,padding:'4px 9px',fontFamily:'var(--f)',outline:'none'}}/>
                        :<span style={{flex:1,fontSize:15.5,fontWeight:500,color:'var(--txt)',lineHeight:1.3}}>{t.name}</span>
                      }
                      <div style={{display:'flex',gap:5,alignItems:'center',flexShrink:0}}>
                        {t.status==='proposed'&&<span style={{fontFamily:'var(--m)',fontSize:10,background:'rgba(26,95,168,.1)',color:'#1a5fa8',border:'1px solid rgba(26,95,168,.2)',borderRadius:3,padding:'2px 6px'}}>COO proposed</span>}
                        <button onClick={()=>{setMatrixPanel(null);setMatrixEdit(null)}} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:20,padding:0,lineHeight:1}}>×</button>
                      </div>
                    </div>
                    {/* Quadrant mover */}
                    <div style={{display:'flex',gap:3,marginBottom:9}}>
                      {Q_META.map(([q,l,v])=>(
                        <button key={q} onClick={()=>updateTaskQ(t.id,q)} style={{flex:1,padding:'5px 0',borderRadius:5,border:`1px solid var(--${q===t.q?v+'-bd':'gb2'})`,background:q===t.q?`var(--${v}-bg)`:'transparent',color:`var(--${v})`,fontFamily:'var(--m)',fontSize:'10.5px',cursor:'pointer',fontWeight:q===t.q?700:400,textTransform:'uppercase',transition:'all .12s'}}>{l}</button>
                      ))}
                    </div>
                    {/* Edit fields or metadata line */}
                    {matrixEdit?(
                      <div style={{display:'flex',gap:5,marginBottom:9,alignItems:'center'}}>
                        <select value={matrixEdit.cat} onChange={e=>setMatrixEdit(s=>({...s,cat:e.target.value}))} style={{flex:1,background:'rgba(255,255,255,.8)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:13.5,padding:'4px 7px',fontFamily:'var(--m)',outline:'none'}}>
                          {cats.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" value={matrixEdit.blocks} onChange={e=>setMatrixEdit(s=>({...s,blocks:+e.target.value}))} min={1} max={16} style={{width:52,background:'rgba(255,255,255,.8)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:13.5,padding:'4px 6px',fontFamily:'var(--m)',outline:'none',textAlign:'center'}}/>
                        <span style={{fontFamily:'var(--m)',fontSize:11.5,color:'var(--txt3)',whiteSpace:'nowrap'}}>×15 min</span>
                      </div>
                    ):(
                      <div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--txt3)',marginBottom:9,display:'flex',gap:8,flexWrap:'wrap'}}>
                        <span>{t.cat}</span><span>·</span><span>{t.blocks}×15min = {t.blocks*15}m</span>
                        {t.date!==todayStr()&&<><span>·</span><span style={{color:'var(--acc2)'}}>{t.date===addDays(1)?'tomorrow':t.date?.slice(5)}</span></>}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                      {matrixEdit?(
                        <>
                          <button onClick={saveMatrixEdit} style={{padding:'5px 14px',borderRadius:5,border:'1px solid rgba(26,90,60,.3)',background:'rgba(26,90,60,.1)',color:'var(--acc)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer',fontWeight:500}}>Save</button>
                          <button onClick={()=>setMatrixEdit(null)} style={{padding:'5px 11px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer'}}>Cancel</button>
                        </>
                      ):t.status==='proposed'?(
                        <>
                          <button onClick={()=>{confirmTask(t.id);setMatrixPanel(null)}} style={{padding:'5px 14px',borderRadius:5,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer',fontWeight:500}}>✓ Accept</button>
                          <button onClick={()=>setMatrixEdit({name:t.name,blocks:t.blocks,cat:t.cat})} style={{padding:'5px 11px',borderRadius:5,border:'1px solid var(--gb2)',background:'rgba(255,255,255,.5)',color:'var(--txt2)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer'}}>✎ Edit</button>
                          <button onClick={()=>{wontDoTask(t.id);setMatrixPanel(null)}} style={{padding:'5px 11px',borderRadius:5,border:'1px solid rgba(138,40,40,.2)',background:'rgba(138,40,40,.07)',color:'#8a2828',fontFamily:'var(--m)',fontSize:13,cursor:'pointer'}}>✗ Reject</button>
                        </>
                      ):(
                        <>
                          <button onClick={()=>{toggleTask(t.id);setMatrixPanel(null)}} style={{padding:'5px 14px',borderRadius:5,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer',fontWeight:500}}>{t.done?'↩ Undo done':'✓ Mark done'}</button>
                          <button onClick={()=>setMatrixEdit({name:t.name,blocks:t.blocks,cat:t.cat})} style={{padding:'5px 11px',borderRadius:5,border:'1px solid var(--gb2)',background:'rgba(255,255,255,.5)',color:'var(--txt2)',fontFamily:'var(--m)',fontSize:13,cursor:'pointer'}}>✎ Edit</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
            {/* ── LOG DONE WORK ── */}
            <div className="card">
              <div className="card-hdr" style={{cursor:'pointer'}} onClick={()=>setLogOpen(o=>!o)}>
                <span className="card-title">Log done work</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {doneTasks.filter(t=>t.source==='manual_log').length>0&&<span style={{fontFamily:'var(--m)',fontSize:10,background:'var(--ok)',color:'#fff',padding:'1px 6px',borderRadius:8}}>{doneTasks.filter(t=>t.source==='manual_log').length} logged</span>}
                  <span style={{fontFamily:'var(--m)',fontSize:12,color:'var(--txt3)'}}>{logOpen?'▾':'›'}</span>
                </div>
              </div>
              {logOpen&&<div style={{padding:'10px 13px',display:'flex',flexDirection:'column',gap:10}}>
                <p style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',lineHeight:1.5}}>Got something done that wasn't on the COO plan? Log it — you'll earn XP and the COO will learn your patterns.</p>
                <div style={{display:'flex',gap:7,alignItems:'flex-end',flexWrap:'wrap'}}>
                  <input value={logName} onChange={e=>setLogName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&logDoneWork()} placeholder="What did you get done?" className="fm-in" style={{flex:'1 1 180px',minWidth:0}}/>
                  <select value={logCat} onChange={e=>setLogCat(e.target.value)} className="fm-sel" style={{width:90,flexShrink:0}}>
                    {(settings?.life_areas?.length?settings.life_areas.filter(a=>a.key).map(a=>a.key):['career','admin','learning','fitness','family','finance']).map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={logBlocks} onChange={e=>setLogBlocks(Number(e.target.value))} className="fm-sel" style={{width:86,flexShrink:0}}>
                    {[[1,'15 min'],[2,'30 min'],[3,'45 min'],[4,'1 hr'],[6,'1.5 hr'],[8,'2 hr']].map(([b,l])=><option key={b} value={b}>{l}</option>)}
                  </select>
                  <button onClick={logDoneWork} disabled={logSubmitting||!logName.trim()} className="btn-primary" style={{flexShrink:0,height:36}}>{logSubmitting?'…':'Log it ✓'}</button>
                </div>
                {logXp&&<div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--ok)',animation:'fadeUp .3s'}}>+{logXp.h_gained} XP · streak {logXp.streak} day{logXp.streak!==1?'s':''} 🌱{logXp.tier_up?` → ${logXp.tier_up.species}!`:''}</div>}
                {doneTasks.filter(t=>t.source==='manual_log').length>0&&<div style={{borderTop:'1px solid var(--gb2)',paddingTop:8}}>
                  <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--txt3)',marginBottom:6}}>Logged today</div>
                  {doneTasks.filter(t=>t.source==='manual_log').map(t=>(
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid rgba(0,0,0,.04)'}}>
                      <span style={{color:'var(--ok)',fontSize:12}}>✓</span>
                      <span style={{flex:1,fontSize:13,color:'var(--txt)'}}>{t.name}</span>
                      <span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>{t.blocks*15}m</span>
                      <span className={`pill pc-${t.cat}`}>{t.cat}</span>
                    </div>
                  ))}
                </div>}
              </div>}
            </div>

            <div className="card">
              <div className="card-hdr" style={{flexDirection:'column',alignItems:'stretch',gap:0,paddingBottom:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingBottom:8}}>
                  <span className="card-title">Task list</span>
                  <span style={{fontFamily:'var(--m)',fontSize:'10.5px',color:'var(--txt3)'}}>{tasks.filter(t=>matchesHorizon(t,taskHorizon)&&t.status!=='wont_do'&&!t.done).length} pending</span>
                </div>
                <div style={{display:'flex',gap:3,paddingBottom:8}}>
                  {[['all','All'],['today','Today'],['tomorrow','Tmrw'],['week','Week'],['month','Month']].map(([h,lbl])=>{
                    const count=tasks.filter(t=>matchesHorizon(t,h)&&t.status!=='wont_do'&&!t.done).length
                    const active=taskHorizon===h
                    return <button key={h} onClick={()=>setTaskHorizon(h)} style={{flex:1,padding:'4px 0',borderRadius:5,border:`1px solid ${active?'var(--acc)':'var(--gb2)'}`,background:active?'rgba(26,90,60,0.12)':'transparent',color:active?'var(--acc)':'var(--txt3)',fontFamily:'var(--m)',fontSize:'10.5px',cursor:'pointer',transition:'all .15s'}}>
                      {lbl}{count>0&&<span style={{marginLeft:3,background:active?'var(--acc)':'rgba(122,170,138,.3)',color:active?'#fff':'var(--txt2)',borderRadius:8,padding:'0 4px',fontSize:10}}>{count}</span>}
                    </button>
                  })}
                </div>
              </div>
              {(()=>{
                const filtered=tasks.filter(t=>t.status!=='wont_do'&&matchesHorizon(t,taskHorizon))
                const fromOrder=taskOrder.filter(id=>filtered.some(t=>t.id===id)).map(id=>filtered.find(t=>t.id===id)).filter(Boolean)
                // Fall back to default sort if taskOrder hasn't synced yet (effect runs after render)
                const orderedTasks=fromOrder.length>0||filtered.length===0
                  ?fromOrder
                  :[...filtered].sort((a,b)=>({do:0,schedule:1,delegate:2,eliminate:3}[a.q]-{do:0,schedule:1,delegate:2,eliminate:3}[b.q])||(a.done-b.done))
                return(
                <div style={{padding:'3px 3px 2px'}}
                  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null)}}>
                  {orderedTasks.map((t,ordIdx)=>(
                    <div key={t.id}
                      onDragOver={e=>handleTaskDragOver(e,ordIdx)}
                      onDrop={e=>handleTaskDrop(e,ordIdx,orderedTasks)}>
                      {/* Drop indicator line */}
                      {dragOver===ordIdx&&dragRef.current?.id!==t.id&&<div style={{height:2,background:'var(--acc)',borderRadius:1,margin:'0 9px'}}/>}
                      {/* Main row */}
                      <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 9px',borderRadius:'var(--r)',opacity:t.done?.42:1,transition:'background .1s',background:expandedTask===t.id?'rgba(26,90,60,.04)':'transparent'}}>
                        {/* Drag handle */}
                        <div draggable onDragStart={e=>handleDragStart(e,t.id,ordIdx)} onDragEnd={()=>{setDragOver(null);dragRef.current=null}}
                          style={{cursor:'grab',color:'var(--txt4)',fontSize:13,flexShrink:0,padding:'0 1px',lineHeight:1,userSelect:'none',touchAction:'none'}}>⠿</div>
                        {/* Check — behavior differs by quadrant */}
                        {t.status==='proposed'?(
                          <div style={{width:14,height:14,borderRadius:3,border:'1.5px solid var(--txt4)',flexShrink:0,background:'transparent'}}/>
                        ):t.q==='schedule'&&!t.done?(
                          <div onClick={()=>setSchedAction(a=>a?.taskId===t.id?null:{taskId:t.id,phase:'menu'})}
                            style={{width:14,height:14,borderRadius:3,border:'1.5px solid var(--sch)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:schedAction?.taskId===t.id?'var(--sch-bg)':'transparent',cursor:'pointer'}}>
                            {schedAction?.taskId===t.id&&<span style={{fontSize:7,color:'var(--sch)'}}>▾</span>}
                          </div>
                        ):(
                          <div onClick={()=>t.status!=='proposed'&&toggleTask(t.id)}
                            style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${t.done?'var(--del)':'var(--txt3)'}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700,background:t.done?'var(--del)':'transparent',cursor:'pointer'}}>
                            {t.done?'✓':''}
                          </div>
                        )}
                        {/* Task name — click to expand detail */}
                        <div onClick={()=>setExpandedTask(id=>id===t.id?null:t.id)}
                          style={{flex:1,fontSize:14.5,color:t.status==='proposed'?'var(--txt3)':'var(--txt)',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textDecoration:t.done?'line-through':'none',cursor:'pointer'}}>
                          {t.name}{t.status==='proposed'&&<span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)',marginLeft:4}}>(proposed)</span>}
                        </div>
                        {/* Right: date + pills */}
                        <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
                          {t.date!==todayStr()&&<span style={{fontFamily:'var(--m)',fontSize:9.5,color:'var(--txt3)',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:3,padding:'1px 4px'}}>{t.date===addDays(1)?'tmrw':t.date?.slice(5)}</span>}
                          {t.status==='proposed'
                            ?<><button onClick={()=>confirmTask(t.id)} style={{fontFamily:'var(--m)',fontSize:10.5,padding:'2px 6px',borderRadius:3,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',cursor:'pointer'}}>✓</button>
                              <button onClick={()=>wontDoTask(t.id)} style={{fontFamily:'var(--m)',fontSize:10.5,padding:'2px 6px',borderRadius:3,border:'1px solid rgba(138,40,40,.2)',background:'rgba(138,40,40,.07)',color:'#8a2828',cursor:'pointer'}}>✗</button></>
                            :<><span className={`pill pq-${t.q}`}>{t.q}</span><span className={`pill pc-${t.cat}`}>{t.cat}</span><span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>{t.blocks}×</span></>
                          }
                        </div>
                      </div>
                      {/* Schedule action menu */}
                      {schedAction?.taskId===t.id&&schedAction.phase==='menu'&&(
                        <div style={{margin:'0 9px 7px 28px',padding:'9px 10px',background:'var(--sch-bg)',border:'1px solid var(--sch-bd)',borderRadius:'var(--r)'}}>
                          <div style={{fontFamily:'var(--m)',fontSize:10.5,color:'var(--sch)',marginBottom:7,fontWeight:500}}>How should this get scheduled?</div>
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            <button onClick={()=>handleSchedOption(t.id,'manual')} style={{flex:1,minWidth:100,padding:'7px 9px',borderRadius:6,border:'1px solid var(--gb2)',background:'var(--glass)',color:'var(--txt)',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer',textAlign:'left'}}>
                              <div style={{fontWeight:600,marginBottom:2}}>Manual</div>
                              <div style={{fontSize:11,color:'var(--txt3)'}}>I'll add it to my calendar</div>
                            </button>
                            <button onClick={()=>handleSchedOption(t.id,'auto')} disabled={schedActLoading} style={{flex:1,minWidth:100,padding:'7px 9px',borderRadius:6,border:'1px solid var(--sch-bd)',background:'rgba(26,95,168,.12)',color:'var(--sch)',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer',textAlign:'left'}}>
                              <div style={{fontWeight:600,marginBottom:2}}>Auto</div>
                              <div style={{fontSize:11,opacity:.8}}>COO slots it in my day</div>
                            </button>
                            <button onClick={()=>handleSchedOption(t.id,'delegate')} disabled={schedActLoading} style={{flex:1,minWidth:100,padding:'7px 9px',borderRadius:6,border:'1px solid var(--del-bd)',background:'var(--del-bg)',color:'var(--del)',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer',textAlign:'left'}}>
                              <div style={{fontWeight:600,marginBottom:2}}>Delegate</div>
                              <div style={{fontSize:11,opacity:.8}}>COO handles + check-in</div>
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Manual date/time picker */}
                      {schedAction?.taskId===t.id&&schedAction.phase==='manual'&&(
                        <div style={{margin:'0 9px 7px 28px',padding:'8px 10px',background:'var(--sch-bg)',border:'1px solid var(--sch-bd)',borderRadius:'var(--r)',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                          <input type="date" value={schedManual.date} min={todayStr()} onChange={e=>setSchedManual(s=>({...s,date:e.target.value}))}
                            style={{flex:1,minWidth:110,background:'rgba(255,255,255,.82)',border:'1px solid var(--gb2)',borderRadius:5,padding:'5px 8px',fontSize:13,fontFamily:'var(--f)',outline:'none',color:'var(--txt)'}}/>
                          <input type="time" value={schedManual.time} onChange={e=>setSchedManual(s=>({...s,time:e.target.value}))}
                            style={{flex:1,minWidth:90,background:'rgba(255,255,255,.82)',border:'1px solid var(--gb2)',borderRadius:5,padding:'5px 8px',fontSize:13,fontFamily:'var(--f)',outline:'none',color:'var(--txt)'}}/>
                          <button onClick={()=>confirmManualSched(t.id)} style={{padding:'5px 13px',borderRadius:5,border:'none',background:'var(--acc2)',color:'#fff',fontFamily:'var(--f)',fontSize:13,cursor:'pointer',fontWeight:500}}>Set →</button>
                          <button onClick={()=>setSchedAction(null)} style={{padding:'5px 9px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',fontFamily:'var(--f)',fontSize:13,cursor:'pointer'}}>✕</button>
                        </div>
                      )}
                      {/* Auto horizon picker — when to schedule */}
                      {schedAction?.taskId===t.id&&schedAction.phase==='auto_horizon'&&(
                        <div style={{margin:'0 9px 7px 28px',padding:'9px 10px',background:'var(--sch-bg)',border:'1px solid var(--sch-bd)',borderRadius:'var(--r)'}}>
                          <div style={{fontFamily:'var(--m)',fontSize:10.5,color:'var(--sch)',marginBottom:7,fontWeight:500}}>When should the COO slot this in?</div>
                          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                            {[['idk','IDK','no date constraint'],['today','Today','schedule today'],['tmrw','Tmrw','tomorrow'],['week','Week','not today or tmrw'],['month','Month','not this week']].map(([h,lbl,sub])=>(
                              <button key={h} onClick={()=>handleSchedAutoHorizon(t.id,h)} disabled={schedActLoading}
                                style={{flex:1,minWidth:70,padding:'6px 8px',borderRadius:6,border:'1px solid var(--sch-bd)',background:'rgba(26,95,168,.08)',color:'var(--sch)',fontFamily:'var(--f)',fontSize:12,cursor:'pointer',textAlign:'left',opacity:schedActLoading?.5:1}}>
                                <div style={{fontWeight:600}}>{lbl}</div>
                                <div style={{fontSize:10,opacity:.7,marginTop:1}}>{sub}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Expanded task detail — notes with clickable source links */}
                      {expandedTask===t.id&&(
                        <div style={{margin:'0 9px 8px 28px',padding:'9px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)'}}>
                          {t.notes&&<div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--txt2)',marginBottom:6,lineHeight:1.6,wordBreak:'break-word'}}>
                            {parseLinks(t.notes).map((p,i)=>p.t==='text'?<span key={i}>{p.v}</span>:<a key={i} href={p.href} target={p.t==='url'?'_blank':'_self'} rel="noopener noreferrer" style={{color:'var(--sch)',textDecoration:'underline',cursor:'pointer'}}>{p.v}</a>)}
                          </div>}
                          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                            <span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>{t.blocks}×15min · {t.cat}{t.who&&t.who!=='me'?` · ${t.who}`:''}</span>
                            {t.q==='do'&&!t.done&&<button onClick={()=>{toggleTask(t.id);setExpandedTask(null)}} style={{marginLeft:'auto',padding:'4px 13px',borderRadius:5,border:'none',background:'var(--ok)',color:'#fff',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer',fontWeight:500}}>Mark done ✓</button>}
                            {t.q==='schedule'&&!t.done&&<button onClick={()=>setSchedAction({taskId:t.id,phase:'menu'})} style={{marginLeft:'auto',padding:'4px 13px',borderRadius:5,border:'1px solid var(--sch-bd)',background:'var(--sch-bg)',color:'var(--sch)',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer'}}>Schedule →</button>}
                            {t.q==='delegate'&&!t.done&&<button onClick={()=>handleSchedOption(t.id,'delegate')} style={{marginLeft:'auto',padding:'4px 13px',borderRadius:5,border:'1px solid var(--del-bd)',background:'var(--del-bg)',color:'var(--del)',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer'}}>Delegate →</button>}
                            {t.q==='eliminate'&&!t.done&&<button onClick={()=>wontDoTask(t.id)} style={{marginLeft:'auto',padding:'4px 13px',borderRadius:5,border:'1px solid rgba(138,40,40,.2)',background:'rgba(138,40,40,.07)',color:'#8a2828',fontFamily:'var(--f)',fontSize:12.5,cursor:'pointer'}}>Archive →</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )
              })()}
              <div style={{display:'flex',gap:5,padding:'8px 9px',borderTop:'1px solid var(--gb2)',flexWrap:'wrap'}}>
                <input value={qaName} onChange={e=>setQaName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&qaName){addTask({name:qaName,q:qaQ,cat:qaCat,blocks:qaB,who:'me',notes:'',date:horizonDate(qaWhen)});setQaName('')}}} placeholder="Quick add task…" style={{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--txt)',fontSize:14.5,fontFamily:'var(--f)',minWidth:120}}/>
                <div style={{display:'flex',gap:4}}>
                  <select value={qaWhen} onChange={e=>setQaWhen(e.target.value)} style={{background:'var(--glass2)',border:'1px solid rgba(26,90,60,.4)',borderRadius:5,color:'var(--acc)',fontSize:'11px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)',fontWeight:600}}>
                    <option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This week</option><option value="month">This month</option>
                  </select>
                  <select value={qaQ} onChange={e=>setQaQ(e.target.value)} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'11px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}><option value="do">Do</option><option value="schedule">Sched</option><option value="delegate">Delg</option><option value="eliminate">Elim</option></select>
                  <select value={qaCat} onChange={e=>setQaCat(e.target.value)} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'11px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}>{(settings?.life_areas?.length?settings.life_areas.filter(a=>a.key).map(a=>a.key):['career','learning','fitness','family','admin','finance']).map(c=><option key={c} value={c}>{c}</option>)}</select>
                  <select value={qaB} onChange={e=>setQaB(parseInt(e.target.value))} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'11px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}>{[1,2,3,4,6,8].map(b=><option key={b} value={b}>{b}×</option>)}</select>
                  <button className="btn-primary" style={{fontSize:12.5,padding:'4px 9px'}} onClick={()=>{if(qaName){addTask({name:qaName,q:qaQ,cat:qaCat,blocks:qaB,who:'me',notes:'',date:horizonDate(qaWhen)});setQaName('')}}}>Add</button>
                </div>
              </div>
            </div>
          </>}

          {/* SCHEDULE */}
          {view==='schedule'&&<>
            {/* Help banner */}
            {!helpDismissed.schedule&&<div style={{padding:'10px 14px',background:'rgba(26,90,60,0.07)',border:'1px solid rgba(26,90,60,0.15)',borderRadius:'var(--r2)',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:18,flexShrink:0}}>📋</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--acc2)',fontWeight:600,marginBottom:3}}>How the Schedule works</div>
                <div style={{fontSize:13,color:'var(--txt2)',lineHeight:1.6}}>The COO reads your Calendar, Gmail, and Oura ring to build a time-blocked day in 15-min slots. <strong>✓ Accept</strong> slots you'll do, <strong>✗ veto</strong> ones you won't — the COO learns your patterns. Use <strong>Re-plan</strong> after adding tasks or later in the day. Toggle the horizon below to plan days, weeks, or months ahead.</div>
              </div>
              <button onClick={()=>setHelpDismissed(h=>({...h,schedule:true}))} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:18,padding:0,flexShrink:0}}>×</button>
            </div>}
            {/* Horizon toggle */}
            <div style={{position:'relative'}}>
              <div style={{display:'flex',gap:3,flexWrap:'nowrap',overflowX:'auto',paddingBottom:2}}>
                {[['today','Today'],['tomorrow','Tmrw'],['week','Week'],['biweek','2 weeks'],['month','Month']].map(([h,lbl])=>(
                  <button key={h} onClick={()=>{setSchedHorizon(h);setShowMonthPicker(false)}} style={{flexShrink:0,padding:'5px 11px',borderRadius:6,border:`1px solid ${schedHorizon===h?'var(--acc)':'var(--gb2)'}`,background:schedHorizon===h?'rgba(26,90,60,0.12)':'transparent',color:schedHorizon===h?'var(--acc)':'var(--txt3)',fontFamily:'var(--m)',fontSize:'11px',cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap'}}>{lbl}</button>
                ))}
                <button onClick={()=>setShowMonthPicker(v=>!v)} style={{flexShrink:0,padding:'5px 11px',borderRadius:6,border:`1px solid ${showMonthPicker||(!['today','tomorrow','week','biweek','month'].includes(schedHorizon))?'var(--acc)':'var(--gb2)'}`,background:showMonthPicker||(!['today','tomorrow','week','biweek','month'].includes(schedHorizon))?'rgba(26,90,60,0.12)':'transparent',color:showMonthPicker||(!['today','tomorrow','week','biweek','month'].includes(schedHorizon))?'var(--acc)':'var(--txt3)',fontFamily:'var(--m)',fontSize:'11px',cursor:'pointer'}}>📅 Month ▾</button>
              </div>
              {showMonthPicker&&<div style={{position:'absolute',top:'100%',right:0,zIndex:50,background:'rgba(255,255,255,.97)',backdropFilter:'blur(16px)',border:'1px solid var(--gb2)',borderRadius:10,padding:'10px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4,marginTop:4,boxShadow:'0 8px 24px rgba(20,60,35,.14)'}}>
                {nextTwelveMonths().map(({key,label})=>(
                  <button key={key} onClick={()=>{setSchedHorizon(key);setShowMonthPicker(false)}} style={{padding:'6px 8px',borderRadius:5,border:`1px solid ${schedHorizon===key?'var(--acc)':'var(--gb2)'}`,background:schedHorizon===key?'rgba(26,90,60,0.12)':'transparent',color:schedHorizon===key?'var(--acc)':'var(--txt3)',fontFamily:'var(--m)',fontSize:'11px',cursor:'pointer'}}>{label}</button>
                ))}
              </div>}
            </div>
            {/* Single-day view: today or tomorrow */}
            {(schedHorizon==='today'||schedHorizon==='tomorrow')&&<>
              {schedLoading&&<div className="card" style={{padding:'22px 16px',display:'flex',alignItems:'center',gap:10,color:'var(--txt3)',fontFamily:'var(--m)',fontSize:13}}><div style={{width:16,height:16,border:'2px solid rgba(122,170,138,0.3)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>COO reading Calendar{oura?.connected?' + Oura Ring':''} + Gmail and building your day…</div>}
              {schedError&&!schedLoading&&<div style={{padding:'10px 12px',background:'rgba(138,40,40,.06)',border:'1px solid rgba(138,40,40,.18)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:16}}>⚠</span><span style={{flex:1,fontSize:13.5,color:'#8a2828',fontFamily:'var(--m)'}}>{schedError}</span><button onClick={generateSchedule} style={{background:'transparent',border:'1px solid rgba(138,40,40,.3)',borderRadius:5,padding:'4px 10px',cursor:'pointer',fontSize:12.5,color:'#8a2828',fontFamily:'var(--m)'}}>Retry</button></div>}
              {!schedLoading&&!schedule&&!schedError&&<div className="card" style={{padding:'24px 16px',textAlign:'center'}}><div style={{fontFamily:'var(--s)',fontSize:20,fontStyle:'italic',color:'var(--txt2)',marginBottom:8}}>No schedule yet</div><p style={{fontSize:14,color:'var(--txt3)',marginBottom:16,lineHeight:1.6}}>COO will read your Calendar{oura?.connected?', Oura readiness,':''} and Gmail then build your day in 15-min blocks.</p><button className="btn-primary" onClick={generateSchedule}>Build my day →</button></div>}
              {!schedLoading&&schedule&&<>
                {oura?.connected&&oura?.data?.readiness&&<div style={{padding:'9px 13px',background:'rgba(15,110,86,0.07)',border:'1px solid rgba(15,110,86,0.18)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:18}}>💍</span><div style={{flex:1}}><div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--del)',fontWeight:500}}>Oura readiness: {oura.data.readiness.score}/100 · Sleep: {oura.data.sleep?.score||'—'}/100</div><div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',marginTop:2}}>{oura.data.readiness.energy_note}</div></div></div>}
                {schedule.coo_message&&<div style={{padding:'10px 14px',background:'var(--glass2)',backdropFilter:'blur(14px)',border:'1px solid var(--gb2)',borderRadius:'var(--r2)',fontFamily:'var(--m)',fontSize:13,color:'var(--txt2)',lineHeight:1.7}}><span style={{color:'var(--acc2)',fontWeight:500}}>COO · </span>{schedule.coo_message}</div>}
                <div className="card" style={{flexShrink:0}}>
                  <div className="card-hdr"><span className="card-title">Top 3 MITs · {schedule.date&&schedule.date!==todayStr()?'tomorrow':'today'}</span></div>
                  <div style={{padding:'10px 13px 14px',display:'flex',flexDirection:'column',gap:6}}>
                    {schedule.top_3_mits?.length>0
                      ?schedule.top_3_mits.map((m,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'8px 11px',background:i===0?'var(--do-bg)':i===1?'rgba(26,95,168,.06)':'var(--glass2)',borderRadius:'var(--r)',border:`1px solid ${i===0?'var(--do-bd)':i===1?'rgba(26,95,168,.15)':'var(--gb2)'}`}}>
                          <span style={{fontFamily:'var(--m)',fontSize:11,background:i===0?'var(--do)':i===1?'rgba(26,95,168,.75)':'rgba(122,170,138,.55)',color:'#fff',padding:'2px 7px',borderRadius:3,flexShrink:0,marginTop:1}}>{i+1}</span>
                          <span style={{fontSize:14.5,color:'var(--txt)',lineHeight:1.4,fontWeight:i===0?500:400}}>{m}</span>
                        </div>
                      ))
                      :<div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--txt3)',fontStyle:'italic',padding:'4px 0'}}>COO will identify your Most Important Tasks when you generate a schedule.</div>
                    }
                  </div>
                </div>
                <div className="card" style={{display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 320px)',minHeight:0}}>
                  <div className="card-hdr" style={{flexShrink:0}}>
                    <div style={{display:'flex',alignItems:'baseline',gap:8}}>
                      <span className="card-title">{schedule.date&&schedule.date!==todayStr()?'Tomorrow\'s plan':'Proposed day'}</span>
                      <span style={{fontFamily:'var(--m)',fontSize:12,color:'var(--acc2)',fontWeight:500}}>{schedule.date?new Date(schedule.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>
                    </div>
                    <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>{schedule.slots?.filter(s=>s.state==='accepted').length||0}/{schedule.slots?.filter(s=>s.taskId).length||0} accepted</span>{pendingSlots>0&&<button className="btn-primary" style={{fontSize:12,padding:'3px 9px'}} onClick={acceptAll}>Accept all</button>}</div>
                  </div>
                  <div className="panel-scroll" style={{flex:1,minHeight:0,overflowY:'auto',padding:'10px 13px 24px',display:'flex',flexDirection:'column',gap:6}}>
                    {(schedule.slots||[]).map((slot,idx)=>{
                      const isTonight=slot.type==='optional_tonight'
                      const qv=slot.quadrant==='schedule'?'sch':slot.quadrant==='eliminate'?'eli':slot.quadrant
                      let bg='rgba(255,255,255,.3)',bd='var(--gb2)'
                      if(isTonight){bg='rgba(90,72,140,.07)';bd='rgba(90,72,140,.22)'}
                      else if(slot.type==='break'||slot.type==='lunch'){bg='rgba(122,170,138,.07)';bd='var(--eli-bd)'}
                      else if(slot.quadrant){bg=`var(--${qv}-bg)`;bd=`var(--${qv}-bd)`}
                      return(
                        <div key={idx}>
                          {isTonight&&<div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 0 4px',fontFamily:'var(--m)',fontSize:11,color:'rgba(90,72,140,.8)',letterSpacing:'.08em'}}>🌙 optional tonight — light tasks only, not required</div>}
                          <div style={{display:'flex',alignItems:'stretch',gap:8,minHeight:44}}>
                            <div style={{fontFamily:'var(--m)',fontSize:'11.5px',color:'var(--txt3)',width:42,flexShrink:0,paddingTop:9,textAlign:'right'}}>{slot.time}</div>
                            <div style={{width:1,background:'var(--gb2)',flexShrink:0,position:'relative'}}><div style={{position:'absolute',top:10,left:-3,width:7,height:7,borderRadius:'50%',background:isTonight?'rgba(90,72,140,.3)':'var(--gb2)'}}/></div>
                            <div style={{flex:1,borderRadius:'var(--r)',padding:'7px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,background:bg,border:`1px solid ${bd}`,opacity:slot.state==='vetoed'?.38:1}}>
                              <div>
                                <div style={{fontSize:14,color:'var(--txt)',textDecoration:slot.state==='vetoed'?'line-through':'none'}}>{slot.label}</div>
                                {slot.note&&<div style={{fontSize:11.5,color:'var(--txt3)',fontFamily:'var(--m)',marginTop:2}}>{slot.note}</div>}
                                {slot.duration_blocks&&<div style={{fontSize:11,color:'var(--txt3)',fontFamily:'var(--m)',marginTop:1}}>{slot.duration_blocks*15}min</div>}
                              </div>
                              <div style={{display:'flex',gap:4,flexShrink:0}}>
                                {(slot.state==='pending'||slot.state==='optional')&&<>
                                  <button onClick={()=>acceptSlot(idx)} style={{padding:'3px 7px',borderRadius:4,fontSize:11.5,cursor:'pointer',border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',fontFamily:'var(--m)',fontWeight:500}}>✓</button>
                                  <button onClick={()=>openVetoPanel(idx)} style={{padding:'3px 7px',borderRadius:4,fontSize:11.5,cursor:'pointer',border:'1px solid rgba(184,92,0,.25)',background:'rgba(184,92,0,.08)',color:'var(--do)',fontFamily:'var(--m)',fontWeight:500}}>✗</button>
                                  <button onClick={()=>setEditingSlot({idx,label:slot.label,time:slot.time||'',note:slot.note||'',blocks:slot.duration_blocks||2})} style={{padding:'3px 7px',borderRadius:4,fontSize:11.5,cursor:'pointer',border:'1px solid var(--gb2)',background:'rgba(255,255,255,.5)',color:'var(--txt2)',fontFamily:'var(--m)'}}>✎</button>
                                </>}
                                {slot.state==='accepted'&&<><span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--ok)',padding:'3px 6px'}}>✓ accepted</span><button onClick={()=>setEditingSlot({idx,label:slot.label,time:slot.time||'',note:slot.note||'',blocks:slot.duration_blocks||2})} style={{padding:'3px 7px',borderRadius:4,fontSize:11,cursor:'pointer',border:'1px solid var(--gb2)',background:'rgba(255,255,255,.4)',color:'var(--txt3)',fontFamily:'var(--m)'}}>✎</button></>}
                                {slot.state==='vetoed'&&<span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--warn)',padding:'3px 6px'}}>vetoed</span>}
                              </div>
                            </div>
                          </div>
                          {/* Veto reason panel */}
                          {vetoPanel?.idx===idx&&<div style={{display:'flex',gap:8,marginTop:3}}>
                            <div style={{width:50,flexShrink:0}}/>
                            <div style={{flex:1,padding:'9px 11px',background:'rgba(138,40,40,.04)',border:'1px solid rgba(138,40,40,.2)',borderRadius:6,marginLeft:8}}>
                              <div style={{fontFamily:'var(--m)',fontSize:11,color:'#8a2828',marginBottom:6}}>Why skip this? <span style={{color:'var(--txt3)',fontWeight:400}}>(optional — COO learns from it)</span></div>
                              <textarea value={vetoReason} onChange={e=>setVetoReason(e.target.value)} rows={2} placeholder="Too tired · conflicts with a meeting · lower priority right now…" style={{width:'100%',background:'rgba(255,255,255,.75)',border:'1px solid rgba(138,40,40,.2)',borderRadius:5,color:'var(--txt)',fontSize:12.5,padding:'5px 8px',fontFamily:'var(--m)',resize:'none',outline:'none',lineHeight:1.5,boxSizing:'border-box'}}/>
                              <div style={{display:'flex',alignItems:'center',gap:4,marginTop:6,flexWrap:'wrap'}}>
                                <span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',flexShrink:0}}>Push back to:</span>
                                {[['','Don\'t push back'],['tomorrow','Tomorrow'],['week','This week'],['month','This month']].map(([v,l])=>(
                                  <button key={v} onClick={()=>setVetoPushback(v)} style={{padding:'3px 8px',borderRadius:4,fontSize:10.5,cursor:'pointer',border:`1px solid ${vetoPushback===v?'rgba(184,92,0,.45)':'var(--gb2)'}`,background:vetoPushback===v?'rgba(184,92,0,.12)':'transparent',color:vetoPushback===v?'var(--do)':'var(--txt3)',fontFamily:'var(--m)',whiteSpace:'nowrap'}}>{l}</button>
                                ))}
                              </div>
                              <div style={{display:'flex',gap:5,marginTop:7}}>
                                <button onClick={submitVeto} style={{padding:'4px 13px',borderRadius:4,border:'1px solid rgba(138,40,40,.3)',background:'rgba(138,40,40,.1)',color:'#8a2828',fontFamily:'var(--m)',fontSize:12,cursor:'pointer',fontWeight:500}}>Veto</button>
                                <button onClick={()=>{setVetoPanel(null);setVetoReason('');setVetoPushback('')}} style={{padding:'4px 10px',borderRadius:4,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',fontFamily:'var(--m)',fontSize:12,cursor:'pointer'}}>Cancel</button>
                              </div>
                            </div>
                          </div>}
                          {/* Edit slot panel */}
                          {editingSlot?.idx===idx&&<div style={{display:'flex',gap:8,marginTop:3}}>
                            <div style={{width:50,flexShrink:0}}/>
                            <div style={{flex:1,padding:'9px 11px',background:'rgba(26,90,60,.05)',border:'1px solid rgba(26,90,60,.2)',borderRadius:6,marginLeft:8}}>
                              <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--acc)',marginBottom:6}}>Edit slot</div>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 72px 60px',gap:5,marginBottom:5}}>
                                <input value={editingSlot.label} onChange={e=>setEditingSlot(s=>({...s,label:e.target.value}))} placeholder="Label" style={{background:'rgba(255,255,255,.75)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:13,padding:'4px 8px',fontFamily:'var(--f)',outline:'none'}}/>
                                <input value={editingSlot.time} onChange={e=>setEditingSlot(s=>({...s,time:e.target.value}))} placeholder="9:00 AM" style={{background:'rgba(255,255,255,.75)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:12.5,padding:'4px 6px',fontFamily:'var(--m)',outline:'none',textAlign:'center'}}/>
                                <input type="number" value={editingSlot.blocks} onChange={e=>setEditingSlot(s=>({...s,blocks:+e.target.value}))} min={1} max={16} title="Duration in 15-min blocks" style={{background:'rgba(255,255,255,.75)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:12.5,padding:'4px 6px',fontFamily:'var(--m)',outline:'none',textAlign:'center'}}/>
                              </div>
                              <div style={{fontFamily:'var(--m)',fontSize:9.5,color:'var(--txt3)',marginBottom:4,display:'flex',gap:12}}><span>← label</span><span style={{marginLeft:'auto',marginRight:0}}>time · blocks (15 min each)</span></div>
                              <input value={editingSlot.note} onChange={e=>setEditingSlot(s=>({...s,note:e.target.value}))} placeholder="Note (optional)" style={{width:'100%',background:'rgba(255,255,255,.75)',border:'1px solid var(--gb2)',borderRadius:4,color:'var(--txt)',fontSize:12.5,padding:'4px 8px',fontFamily:'var(--m)',outline:'none',boxSizing:'border-box',marginBottom:6}}/>
                              <div style={{display:'flex',gap:5}}>
                                <button onClick={submitSlotEdit} style={{padding:'4px 13px',borderRadius:4,border:'1px solid rgba(26,90,60,.3)',background:'rgba(26,90,60,.1)',color:'var(--acc)',fontFamily:'var(--m)',fontSize:12,cursor:'pointer',fontWeight:500}}>Save</button>
                                <button onClick={()=>setEditingSlot(null)} style={{padding:'4px 10px',borderRadius:4,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',fontFamily:'var(--m)',fontSize:12,cursor:'pointer'}}>Cancel</button>
                              </div>
                            </div>
                          </div>}
                          {/* COO impact + veto reason (after veto) */}
                          {slot.state==='vetoed'&&(slot.impact||slot.veto_reason)&&<div style={{display:'flex',gap:8,marginTop:3}}>
                            <div style={{width:50,flexShrink:0}}/>
                            <div style={{flex:1,padding:'6px 10px',background:'rgba(184,92,0,.06)',border:'1px solid rgba(184,92,0,.18)',borderRadius:6,fontSize:12.5,color:'var(--warn)',fontFamily:'var(--m)',lineHeight:1.5,marginLeft:8}}>
                              {slot.veto_reason&&<div style={{color:'var(--txt2)',marginBottom:slot.impact?4:0}}>"{slot.veto_reason}"{slot.pushed_to&&<span style={{marginLeft:6,fontFamily:'var(--m)',fontSize:10.5,color:'var(--txt3)'}}>→ pushed to {slot.pushed_to}</span>}</div>}
                              {slot.impact&&<div>{slot.impact}{slot.suggestion&&<><br/><span style={{color:'var(--txt3)'}}>→ {slot.suggestion}</span></>}</div>}
                            </div>
                          </div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>}
            </>}
            {/* Multi-day planning view: week / biweek / month / specific month */}
            {!['today','tomorrow'].includes(schedHorizon)&&(()=>{
              const range=getSchedRange(schedHorizon)
              const dates=datesInRange(range.from,range.to)
              const td=todayStr()
              return <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',padding:'2px 0'}}>Planning view — tasks queued per day · bubble = 15-min block · click a day to build its schedule</div>
                {dates.map(d=>{
                  const dayTasks=tasks.filter(t=>t.date===d&&t.status!=='wont_do')
                  const dayGoalMilestones=goals.filter(g=>g.status==='active'&&g.target_date===d)
                  const isPast=d<td;const isToday=d===td;const isTom=d===addDays(1)
                  const label=isToday?'Today':isTom?'Tomorrow':new Date(d+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
                  return(
                    <div key={d} style={{background:'rgba(255,255,255,.7)',backdropFilter:'blur(12px)',border:`1px solid ${isToday?'rgba(26,90,60,.3)':isTom?'rgba(26,90,60,.15)':'var(--gb2)'}`,borderRadius:'var(--r2)',padding:'10px 13px',opacity:isPast?.6:1}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:dayTasks.length>0||dayGoalMilestones.length>0?8:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontFamily:'var(--m)',fontSize:isToday||isTom?11:10,fontWeight:isToday||isTom?600:400,color:isToday?'var(--acc)':isTom?'var(--acc2)':'var(--txt2)'}}>{label}</span>
                          {dayTasks.length>0&&<span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>{dayTasks.filter(t=>!t.done).length} tasks · {dayTasks.reduce((s,t)=>s+t.blocks*15,0)}min</span>}
                        </div>
                        {!isPast&&(isToday||isTom)&&<button onClick={()=>{setSchedHorizon(isToday?'today':'tomorrow');generateSchedule()}} style={{fontFamily:'var(--m)',fontSize:10.5,padding:'3px 9px',borderRadius:5,border:'1px solid rgba(26,90,60,.25)',background:'rgba(26,90,60,.07)',color:'var(--acc)',cursor:'pointer'}}>Build day →</button>}
                      </div>
                      {dayGoalMilestones.map(g=>(
                        <div key={g.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,padding:'4px 8px',background:'rgba(184,92,0,.06)',borderRadius:5,border:'1px solid rgba(184,92,0,.15)'}}>
                          <span style={{fontSize:14}}>{g.emoji||'🎯'}</span>
                          <span style={{fontSize:13,color:'var(--do)',fontFamily:'var(--m)',fontWeight:500}}>Goal deadline: {g.title}</span>
                        </div>
                      ))}
                      {dayTasks.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {dayTasks.map(t=>(
                          <div key={t.id} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:5,background:`var(--${t.q==='schedule'?'sch':t.q==='eliminate'?'eli':t.q}-bg)`,border:`1px solid var(--${t.q==='schedule'?'sch':t.q==='eliminate'?'eli':t.q}-bd)`,opacity:t.done?.5:1}}>
                            <span style={{fontSize:11,color:`var(--${t.q==='schedule'?'sch':t.q==='eliminate'?'eli':t.q})`,fontFamily:'var(--m)'}}>{t.done?'✓':t.blocks+'×'}</span>
                            <span style={{fontSize:13,color:'var(--txt)',maxWidth:180,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',textDecoration:t.done?'line-through':'none'}}>{t.name}</span>
                          </div>
                        ))}
                      </div>}
                      {dayTasks.length===0&&!dayGoalMilestones.length&&!isPast&&<span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>No tasks queued</span>}
                    </div>
                  )
                })}
              </div>
            })()}
          </>}

          {/* AGENTS */}
          {view==='agents'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
            {agents.map(a=>{
              const col=CAT_COLORS[a.area]||'#3d7a52'
              const sc={idle:'#b0ccb8',thinking:'#b85c00',alert:'#8a2828',ok:'#0f6e56'}[a.status||'idle']
              return(
                <div key={a.id} className="card">
                  <div style={{padding:'12px 13px 10px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',borderBottom:'1px solid var(--gb2)'}}>
                    <div style={{width:34,height:34,borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19,flexShrink:0,background:`${col}14`,border:`1px solid ${col}28`}}>{a.icon}</div>
                    <div style={{flex:1,paddingLeft:9}}>
                      <div style={{fontSize:15,fontWeight:500,color:'var(--txt)'}}>{a.name}</div>
                      <div style={{fontSize:11,color:'var(--txt3)',fontFamily:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2}}>{a.area}</div>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}><div style={{width:6,height:6,borderRadius:'50%',background:sc}}/><span style={{fontSize:11,color:'var(--txt3)',fontFamily:'var(--m)'}}>{a.status||'idle'}</span></div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}><PerfRing score={a.score||50} color={col}/><span style={{fontFamily:'var(--m)',fontSize:'9.5px',color:'var(--txt3)'}}>score</span></div>
                  </div>
                  {a.alert&&<div style={{margin:'8px 11px 0',padding:'7px 10px',borderRadius:'var(--r)',border:'1px solid rgba(184,92,0,.2)',background:'rgba(184,92,0,.06)',fontSize:12.5,color:'var(--warn)',fontFamily:'var(--m)',lineHeight:1.5}}>{a.alert}</div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'1px solid var(--gb2)'}}>
                    {[['Runs',a.runs||0,null],['Streak',a.streak||0,col],['Score',a.score||50,null]].map(([l,v,c])=>(
                      <div key={l} style={{padding:'8px 9px',textAlign:'center',borderRight:'1px solid var(--gb2)'}}>
                        <div style={{fontFamily:'var(--m)',fontSize:15,fontWeight:500,color:c||'var(--txt)'}}>{v}</div>
                        <div style={{fontSize:10,color:'var(--txt3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:5,padding:'9px 11px'}}>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:12.5,color:'var(--acc2)',borderColor:'rgba(45,122,82,.3)'}} onClick={()=>runAgent(a.id)} disabled={a.status==='thinking'}>{a.status==='thinking'?'…':'▶ Run'}</button>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:12.5}} onClick={()=>{setTuning(tuning===a.id?null:a.id);setPromptDraft(a.custom_prompt||a.prompt)}}>Tune</button>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:12.5}} onClick={()=>rateAgent(a.id)}>Rate ↑</button>
                  </div>
                  {a.output&&<div style={{margin:'0 11px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'9px 10px',fontSize:13,fontFamily:'var(--m)',color:'var(--txt2)',lineHeight:1.7,whiteSpace:'pre-wrap',maxHeight:160,overflowY:'auto'}}>{a.output}</div>}
                  {tuning===a.id&&<div style={{margin:'0 11px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'9px 10px'}}>
                    <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--txt3)',fontFamily:'var(--m)',marginBottom:4}}>System prompt</div>
                    <textarea value={promptDraft} onChange={e=>setPromptDraft(e.target.value)} rows={4} style={{width:'100%',background:'rgba(255,255,255,.65)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt)',fontSize:12.5,padding:'6px 8px',fontFamily:'var(--m)',resize:'vertical',outline:'none',lineHeight:1.5}}/>
                    <div style={{display:'flex',gap:6,marginTop:6}}>
                      <button className="btn-primary" style={{fontSize:12.5,padding:'4px 12px'}} onClick={async()=>{await api.agents.update(a.id,{custom_prompt:promptDraft});setAgents(as=>as.map(x=>x.id===a.id?{...x,custom_prompt:promptDraft}:x));setTuning(null)}}>Save</button>
                      <button className="btn-ghost" style={{fontSize:12.5,padding:'4px 10px'}} onClick={()=>setTuning(null)}>Cancel</button>
                    </div>
                  </div>}
                </div>
              )
            })}
            <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:120,cursor:'pointer',border:'1px dashed var(--gb2)',background:'var(--glass2)'}} onClick={()=>setShowAddAgent(true)}>
              <div style={{textAlign:'center',color:'var(--txt3)'}}><div style={{fontSize:24}}>+</div><div style={{fontSize:13,fontFamily:'var(--m)'}}>Add agent</div></div>
            </div>
          </div>}

          {/* LOG */}
          {view==='log'&&<>
            {/* COO grade */}
            {(()=>{
              const taskSlots=(schedule?.slots||[]).filter(s=>!['break','lunch','free','event','optional_tonight'].includes(s.type))
              const acc=taskSlots.filter(s=>s.state==='accepted').length
              const vet=taskSlots.filter(s=>s.state==='vetoed').length
              const man=tasks.filter(t=>t.source==='manual_log').length
              const total=acc+vet
              const pct=total>0?Math.round(acc/total*100):null
              const grade=pct===null?'—':pct>=90?'A':pct>=75?'B':pct>=60?'C':pct>=45?'D':'F'
              const gradeColor=pct===null?'var(--txt3)':pct>=90?'var(--ok)':pct>=75?'var(--acc)':pct>=60?'var(--warn)':'var(--danger)'
              const agentAlerts=agents.filter(a=>a.status==='alert').length
              return(
                <div className="card" style={{padding:'13px 15px',display:'flex',gap:12,alignItems:'stretch'}}>
                  <div style={{textAlign:'center',minWidth:60}}>
                    <div style={{fontFamily:'var(--m)',fontSize:38,fontWeight:600,color:gradeColor,lineHeight:1}}>{grade}</div>
                    <div style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt3)',marginTop:3,textTransform:'uppercase',letterSpacing:'.08em'}}>COO grade</div>
                    {pct!==null&&<div style={{fontFamily:'var(--m)',fontSize:10,color:gradeColor,marginTop:1}}>{pct}%</div>}
                  </div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:5,justifyContent:'center',borderLeft:'1px solid var(--gb2)',paddingLeft:12}}>
                    <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)'}}><span style={{color:'var(--ok)'}}>{acc}</span> slots accepted · <span style={{color:'var(--danger)'}}>{vet}</span> vetoed</div>
                    <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)'}}><span style={{color:'var(--ok)'}}>{man}</span> tasks logged outside plan</div>
                    <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)'}}><span style={{color:agentAlerts>0?'var(--danger)':'var(--ok)'}}>{agentAlerts}</span> active agent alert{agentAlerts!==1?'s':''}</div>
                    <div style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)',marginTop:2,lineHeight:1.5}}>
                      COO is graded on you not needing to reschedule or alter its plan. Manual logs teach it your real patterns.
                    </div>
                  </div>
                </div>
              )
            })()}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {[[doneTasks.length,'Tasks done',`of ${tasks.length}`,null],[Math.round(doneTasks.reduce((s,t)=>s+t.blocks*15,0)),'Min invested',`${tasks.reduce((s,t)=>s+t.blocks*15,0)} budgeted`,'var(--do)'],[tasks.filter(t=>t.who!=='me').length,'Delegated','off-loaded','var(--del)'],[tasks.filter(t=>t.status==='wont_do').length,"Won't do",'dismissed','var(--warn)'],[schedule?.slots?.filter(s=>s.state==='accepted').length||0,'Blocks accepted','COO plan','var(--acc)']].map(([n,l,s,c])=>(
                <div key={l} className="card" style={{padding:'12px 13px'}}><div style={{fontFamily:'var(--m)',fontSize:24,fontWeight:500,color:c||'var(--txt)',lineHeight:1}}>{n}</div><div style={{fontSize:11,color:'var(--txt3)',marginTop:4,textTransform:'uppercase',letterSpacing:'.07em'}}>{l}</div><div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',marginTop:2}}>{s}</div></div>
              ))}
            </div>
            <div className="card"><div className="card-hdr"><span className="card-title">All tasks · today</span></div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
                  <thead><tr>{['Task','Q','Cat','Blocks','Who','Status'].map(h=><th key={h} style={{fontFamily:'var(--m)',fontSize:10.5,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--txt3)',padding:'6px 11px',textAlign:'left',borderBottom:'1px solid var(--gb2)',fontWeight:400}}>{h}</th>)}</tr></thead>
                  <tbody>{[...tasks].filter(t=>t.status!=='wont_do').sort((a,b)=>({do:0,schedule:1,delegate:2,eliminate:3}[a.q]-{do:0,schedule:1,delegate:2,eliminate:3}[b.q])).map(t=>(
                    <tr key={t.id}><td style={{padding:'7px 11px',color:'var(--txt)'}}>{t.name}</td><td style={{padding:'7px 11px'}}><span className={`pill pq-${t.q}`}>{t.q}</span></td><td style={{padding:'7px 11px'}}><span className={`pill pc-${t.cat}`}>{t.cat}</span></td><td style={{padding:'7px 11px',fontFamily:'var(--m)',color:'var(--txt2)'}}>{t.blocks}×15m</td><td style={{padding:'7px 11px'}}><span style={{fontFamily:'var(--m)',fontSize:10.5,padding:'2px 6px',borderRadius:3,fontWeight:500,background:t.who==='me'?'rgba(45,122,82,.1)':t.who==='team'?'rgba(26,95,168,.09)':'rgba(184,92,0,.09)',color:t.who==='me'?'#1a5a3c':t.who==='team'?'#144a85':'#8a4400'}}>{t.who}</span></td><td style={{padding:'7px 11px',fontFamily:'var(--m)',fontSize:12.5,color:t.done?'var(--ok)':'var(--txt3)'}}>{t.done?'done':'open'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>}

          {view==='settings'&&<SettingsPanel/>}

          {view==='goals'&&<>
            {!helpDismissed.goals&&<div style={{padding:'10px 14px',background:'rgba(26,90,60,0.07)',border:'1px solid rgba(26,90,60,0.15)',borderRadius:'var(--r2)',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:18,flexShrink:0}}>🎯</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--m)',fontSize:12,color:'var(--acc2)',fontWeight:600,marginBottom:3}}>Goals — your COO-managed objectives</div>
                <div style={{fontSize:13,color:'var(--txt2)',lineHeight:1.6}}>Goals span days to a full year and auto-renew for tracking. The COO breaks each goal into milestones, metrics, and daily tasks. <strong>Met goals</strong> appear as rings on your life tree. Set a target date up to 12 months out — the COO will chunk milestones backwards from that deadline. Agents are assigned per goal domain.</div>
              </div>
              <button onClick={()=>setHelpDismissed(h=>({...h,goals:true}))} style={{background:'none',border:'none',color:'var(--txt3)',cursor:'pointer',fontSize:18,padding:0,flexShrink:0}}>×</button>
            </div>}
            {goals.length===0
              ?<div className="card" style={{padding:'32px 20px',textAlign:'center'}}>
                <div style={{fontSize:38,marginBottom:10}}>🎯</div>
                <div style={{fontFamily:'var(--s)',fontSize:20,fontStyle:'italic',color:'var(--txt2)',marginBottom:8}}>No goals yet</div>
                <p style={{fontSize:14,color:'var(--txt3)',marginBottom:20,lineHeight:1.7,maxWidth:320,margin:'0 auto 20px'}}>Your COO will structure each goal into milestones, tracking metrics, and assign or propose agents. Met goals grow your life tree.</p>
                <button className="btn-primary" onClick={()=>setNewGoalOpen(true)}>Set your first goal →</button>
              </div>
              :goals.map(goal=>{
                const totalMs=goal.milestones?.length||0
                const doneMs=goal.milestones?.filter(m=>m.done).length||0
                const pct=totalMs?Math.round(doneMs/totalMs*100):0
                const isOpen=expandedGoal===goal.id
                const metGoals=goals.filter(g=>g.status==='met').length
                return(
                  <div key={goal.id} className="card">
                    {/* Header */}
                    <div style={{padding:'11px 13px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={()=>setExpandedGoal(isOpen?null:goal.id)}>
                      <span style={{fontSize:24,flexShrink:0,lineHeight:1}}>{goal.emoji||'🎯'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:totalMs>0?4:0}}>
                          <span style={{fontSize:15,color:'var(--txt)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{goal.title}</span>
                          {goal.status==='met'&&<span style={{fontFamily:'var(--m)',fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(138,92,0,.15)',color:'#8a5c00',flexShrink:0}}>met ✓</span>}
                          {goal.status==='paused'&&<span style={{fontFamily:'var(--m)',fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(122,170,138,.15)',color:'var(--txt3)',flexShrink:0}}>paused</span>}
                        </div>
                        {totalMs>0&&<div style={{display:'flex',alignItems:'center',gap:6}}>
                          <div style={{flex:1,height:3,borderRadius:2,background:'rgba(0,0,0,.08)',overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:2,background:goal.status==='met'?'#8a5c00':'var(--ok)',width:`${pct}%`,transition:'width .3s'}}/>
                          </div>
                          <span style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)',flexShrink:0}}>{doneMs}/{totalMs}</span>
                        </div>}
                      </div>
                      <span style={{fontFamily:'var(--m)',fontSize:13,color:'var(--txt3)',flexShrink:0}}>{isOpen?'▾':'›'}</span>
                    </div>
                    {/* Expanded */}
                    {isOpen&&<div style={{borderTop:'1px solid var(--gb2)',padding:'12px 13px',display:'flex',flexDirection:'column',gap:13}}>
                      {/* COO note */}
                      {goal.coo_note&&<div style={{padding:'9px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',fontFamily:'var(--m)',fontSize:12.5,color:'var(--txt2)',lineHeight:1.65}}><span style={{color:'var(--acc2)',fontWeight:500}}>COO · </span>{goal.coo_note}</div>}
                      {/* Milestones */}
                      {goal.milestones?.length>0&&<div>
                        <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--txt3)',marginBottom:7}}>Milestones</div>
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          {goal.milestones.map(m=>(
                            <div key={m.id} style={{display:'flex',alignItems:'center',gap:9,cursor:'pointer'}} onClick={()=>patchGoal({id:goal.id,action:'toggle_milestone',milestone_id:m.id})}>
                              <div style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${m.done?'var(--del)':'var(--txt3)'}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700,background:m.done?'var(--del)':'transparent'}}>{m.done?'✓':''}</div>
                              <span style={{fontSize:14,color:m.done?'var(--txt3)':'var(--txt)',textDecoration:m.done?'line-through':'none'}}>{m.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>}
                      {/* Metrics */}
                      {goal.metrics?.length>0&&<div>
                        <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--txt3)',marginBottom:7}}>Tracking</div>
                        <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(goal.metrics.length,3)},1fr)`,gap:6}}>
                          {goal.metrics.map(m=>(
                            <div key={m.key} style={{padding:'9px 10px',background:'rgba(255,255,255,.5)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',textAlign:'center'}}>
                              <div style={{display:'flex',alignItems:'baseline',gap:2,justifyContent:'center',marginBottom:3}}>
                                <input type="number" min={0} value={m.value} onChange={e=>patchGoal({id:goal.id,action:'update_metric',metric_key:m.key,value:parseInt(e.target.value)||0})} style={{width:40,background:'transparent',border:'none',outline:'none',fontFamily:'var(--m)',fontSize:19,fontWeight:500,color:'var(--txt)',textAlign:'center'}}/>
                                {m.target&&<span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>/{m.target}</span>}
                              </div>
                              <div style={{fontFamily:'var(--m)',fontSize:10,color:'var(--txt3)'}}>{m.label}</div>
                              {m.target>0&&<div style={{height:2,borderRadius:1,background:'rgba(0,0,0,.08)',marginTop:5,overflow:'hidden'}}><div style={{height:'100%',borderRadius:1,background:'var(--ok)',width:`${Math.min(100,(m.value/m.target)*100)}%`}}/></div>}
                            </div>
                          ))}
                        </div>
                      </div>}
                      {/* Suggested agents */}
                      {goal.suggested_agents?.length>0&&<div>
                        <div style={{fontFamily:'var(--m)',fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--txt3)',marginBottom:7}}>COO suggests an agent</div>
                        {goal.suggested_agents.map((a,i)=>(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'9px 11px',background:'rgba(122,170,138,.05)',border:'1px dashed var(--gb2)',borderRadius:'var(--r)'}}>
                            <span style={{fontSize:22,flexShrink:0}}>{a.icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:14.5,color:'var(--txt)',fontWeight:500}}>{a.name}</div>
                              <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.prompt?.slice(0,70)}{a.prompt?.length>70?'…':''}</div>
                            </div>
                            <button onClick={async()=>{
                              await fetch('/api/agents',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'new',...a,score:50,runs:0,streak:0,status:'idle',alert:'',output:''})})
                              await patchGoal({id:goal.id,action:'dismiss_suggestion',agent_name:a.name})
                              api.agents.list().then(r=>r.agents&&setAgents(r.agents))
                            }} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 9px',borderRadius:4,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',cursor:'pointer',flexShrink:0}}>+ Create agent</button>
                          </div>
                        ))}
                      </div>}
                      {/* Target date */}
                      {goal.target_date&&<div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>Target: {new Date(goal.target_date+'T00:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>}
                      {/* Actions */}
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {goal.status==='active'&&<button onClick={()=>patchGoal({id:goal.id,action:'set_status',status:'met'})} style={{fontFamily:'var(--m)',fontSize:12,padding:'5px 12px',borderRadius:5,border:'1px solid rgba(138,92,0,.3)',background:'rgba(138,92,0,.08)',color:'#8a5c00',cursor:'pointer'}}>🌳 Met it ✓</button>}
                        {goal.status==='active'&&<button onClick={()=>patchGoal({id:goal.id,action:'set_status',status:'paused'})} style={{fontFamily:'var(--m)',fontSize:12,padding:'5px 10px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',cursor:'pointer'}}>Pause</button>}
                        {goal.status!=='active'&&<button onClick={()=>patchGoal({id:goal.id,action:'set_status',status:'active'})} style={{fontFamily:'var(--m)',fontSize:12,padding:'5px 10px',borderRadius:5,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.08)',color:'var(--ok)',cursor:'pointer'}}>Resume</button>}
                        {deletingGoalId===goal.id
                          ?<div style={{display:'flex',gap:5,marginLeft:'auto',alignItems:'center'}}>
                            <span style={{fontFamily:'var(--m)',fontSize:11,color:'var(--danger)'}}>Archive this goal?</span>
                            <button onClick={async()=>{await patchGoal({id:goal.id,action:'delete'});setDeletingGoalId(null)}} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid rgba(138,40,40,.4)',background:'rgba(138,40,40,.1)',color:'var(--danger)',cursor:'pointer'}}>Yes, archive</button>
                            <button onClick={()=>setDeletingGoalId(null)} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',cursor:'pointer'}}>Cancel</button>
                          </div>
                          :<button onClick={()=>setDeletingGoalId(goal.id)} style={{fontFamily:'var(--m)',fontSize:12,padding:'5px 10px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',cursor:'pointer',marginLeft:'auto',opacity:.55}}>Archive</button>
                        }
                      </div>
                    </div>}
                  </div>
                )
              })
            }
            {/* Fill missing life areas */}
            {goals.length>0&&(()=>{
              const covered=new Set(goals.filter(g=>g.status!=='archived').map(g=>g.category?.toLowerCase()))
              const lifeAreas=settings?.life_areas||[]
              const missing=lifeAreas.filter(a=>!covered.has((a.key||a.label||'').toLowerCase()))
              if(!missing.length)return null
              return(
                <div style={{padding:'10px 13px',background:'rgba(26,95,168,.06)',border:'1px solid rgba(26,95,168,.18)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:16}}>◎</span>
                  <div style={{flex:1,fontFamily:'var(--m)',fontSize:12,color:'#1a5fa8',lineHeight:1.5}}>
                    Missing goals for: <strong>{missing.map(a=>a.label||a.key).join(', ')}</strong>
                  </div>
                  <button onClick={async()=>{
                    setSeedLoading(true)
                    const r=await api.goals.seed()
                    if(r.goals?.length)setGoals(r.goals)
                    setSeedLoading(false)
                  }} disabled={seedLoading} style={{flexShrink:0,fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid rgba(26,95,168,.3)',background:'rgba(26,95,168,.1)',color:'#1a5fa8',cursor:'pointer',opacity:seedLoading?.5:1}}>{seedLoading?'Seeding…':'COO: fill gaps →'}</button>
                </div>
              )
            })()}
            {/* Met goals summary */}
            {goals.filter(g=>g.status==='met').length>0&&<div style={{padding:'10px 14px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>🌳</span>
              <div style={{fontFamily:'var(--m)',fontSize:12.5,color:'var(--txt2)'}}>
                <strong style={{color:'#8a5c00'}}>{goals.filter(g=>g.status==='met').length} goal{goals.filter(g=>g.status==='met').length!==1?'s':''} met</strong> — visible as rings and milestones on your life tree
              </div>
              <button onClick={()=>setView('tree')} style={{marginLeft:'auto',fontFamily:'var(--m)',fontSize:11,padding:'3px 8px',borderRadius:4,border:'1px solid rgba(138,92,0,.25)',background:'transparent',color:'#8a5c00',cursor:'pointer',flexShrink:0}}>View tree →</button>
            </div>}
          </>}

        </div>
        {/* CHAT BAR */}
        <div style={{flexShrink:0,borderTop:'1px solid var(--gb2)',background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',padding:'6px 10px',display:'flex',flexDirection:'column',gap:5}}>
          {chatVisible&&chatHistory.length>0&&(
            <div style={{maxHeight:140,overflowY:'auto',display:'flex',flexDirection:'column',gap:3,paddingBottom:2}}>
              {chatHistory.slice(-8).map((m,i)=>(
                <div key={i} style={{fontFamily:'var(--m)',fontSize:13,color:m.role==='coo'?'var(--acc2)':'var(--txt)',lineHeight:1.5,padding:'3px 8px',borderRadius:5,background:m.role==='coo'?'var(--glass2)':'transparent'}}>{m.role==='coo'?'COO · ':''}{m.content}</div>
              ))}
              {chatLoading&&<div style={{fontFamily:'var(--m)',fontSize:13,color:'var(--txt3)',padding:'3px 8px'}}>COO thinking…</div>}
            </div>
          )}
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button onClick={()=>setChatVisible(v=>!v)} style={{padding:'0 7px',height:32,borderRadius:6,border:'1px solid var(--gb2)',background:'var(--glass2)',color:'var(--txt3)',fontSize:13,cursor:'pointer',flexShrink:0}}>{chatVisible?'▾':'▸'}</button>
            <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendChat())} placeholder="Ask COO anything…" style={{flex:1,background:'transparent',border:'1px solid var(--gb2)',borderRadius:6,padding:'6px 10px',outline:'none',color:'var(--txt)',fontSize:14.5,fontFamily:'var(--f)'}}/>
            <button onClick={isRecording?stopRecording:startRecording} title={isRecording?'Stop recording':'Voice input'} style={{width:32,height:32,borderRadius:'50%',border:`1px solid ${isRecording?'rgba(138,40,40,.4)':'var(--gb2)'}`,background:isRecording?'rgba(138,40,40,.12)':'var(--glass2)',cursor:'pointer',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,animation:isRecording?'blink 1s infinite':'none'}}>{isRecording?'⏹':'🎙'}</button>
            <button onClick={sendChat} disabled={chatLoading||!chatMsg.trim()} style={{width:32,height:32,borderRadius:'50%',border:'none',background:chatLoading||!chatMsg.trim()?'var(--gb2)':'#1a5a3c',color:'#fff',cursor:chatLoading||!chatMsg.trim()?'default':'pointer',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background .15s'}}>↑</button>
          </div>
        </div>
      </>}
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div style={{display:'none',position:'fixed',bottom:0,left:0,right:0,background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderTop:'1px solid var(--gb)',padding:'8px 0 env(safe-area-inset-bottom,10px)',zIndex:200,flexDirection:'row'}} id="mob-nav">
        {navItems.map(({icon,label,id,badge,bc})=>(
          <button key={id} onClick={()=>{setView(id);if(id==='schedule'&&!schedule)generateSchedule();if(id==='tree'&&!treeData)loadTree()}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',border:'none',background:'transparent',color:view===id?'var(--acc2)':'var(--txt3)',fontSize:11,fontFamily:'var(--f)',padding:'3px 0',position:'relative'}}>
            <span style={{fontSize:19,lineHeight:1}}>{icon}</span><span>{label}</span>
            {badge>0&&<span style={{position:'absolute',top:0,right:'18%',width:8,height:8,borderRadius:'50%',background:bc}}/>}
          </button>
        ))}
      </div>
    </div>

    {/* CHECK-IN */}
    {checkin&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&(setCheckin(null),setCheckinResult(null))}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px',boxShadow:'0 22px 55px rgba(20,60,35,.22)'}}>
        <div style={{fontFamily:'var(--s)',fontSize:20,fontStyle:'italic',color:'var(--txt)',marginBottom:12}}>{checkin==='evening'?'Evening retro':'Check-in'}</div>
        {!checkinResult?<>
          <p style={{fontSize:14,color:'var(--txt2)',marginBottom:12,lineHeight:1.6}}>{checkin==='midday'?"How's it going? Any blockers?":checkin==='afternoon'?"Afternoon check — what got done?":"Day wrapping up — quick retro?"}</p>
          <textarea className="fm-in" value={checkinMsg} onChange={e=>setCheckinMsg(e.target.value)} rows={3} placeholder="Optional — a few words is fine…" style={{resize:'none',width:'100%'}}/>
          <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
            <button className="mb-cancel" onClick={()=>setCheckin(null)}>Skip</button>
            <button className="mb-save" onClick={submitCheckin} disabled={checkinLoading}>{checkinLoading?'…':'Send to COO'}</button>
          </div>
        </>:<>
          <div style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'10px 12px',fontFamily:'var(--m)',fontSize:13,color:'var(--txt2)',lineHeight:1.7,whiteSpace:'pre-wrap',marginBottom:checkin==='evening'?8:12}}>{checkinResult.message||checkinResult.headline||''}</div>
          {checkin!=='evening'&&checkinResult.next_action&&<div style={{fontSize:14,color:'var(--acc2)',fontWeight:500,marginBottom:12}}>→ {checkinResult.next_action}</div>}
          {checkin!=='evening'&&checkinResult.adhd_flag&&<div style={{fontSize:13,color:'var(--warn)',fontFamily:'var(--m)',marginBottom:12}}>⚠ {checkinResult.adhd_flag}</div>}
          {checkin==='evening'&&checkinResult.incomplete_decisions?.length>0&&<div style={{marginBottom:10}}>
            <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6}}>Unfinished tasks</div>
            {checkinResult.incomplete_decisions.map((d,i)=>(
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'5px 0',borderBottom:'0.5px solid var(--gb2)'}}>
                <span style={{fontFamily:'var(--m)',fontSize:11,padding:'2px 6px',borderRadius:3,flexShrink:0,background:d.action==='tomorrow'?'var(--do-bg)':d.action==='drop'?'rgba(138,40,40,.08)':'var(--sch-bg)',color:d.action==='tomorrow'?'var(--do)':d.action==='drop'?'#8a2828':'var(--sch)',marginTop:1}}>{d.action==='tomorrow'?'→ tmrw':d.action==='drop'?'drop':'→ wk'}</span>
                <div style={{flex:1}}><div style={{fontSize:13,color:'var(--txt)'}}>{d.task}</div><div style={{fontSize:11.5,color:'var(--txt3)',fontFamily:'var(--m)'}}>{d.reason}</div></div>
              </div>
            ))}
          </div>}
          {checkin==='evening'&&checkinResult.calendar_question&&<div style={{padding:'9px 11px',background:'rgba(26,95,168,.06)',border:'1px solid rgba(26,95,168,.18)',borderRadius:'var(--r)',marginBottom:10}}>
            <div style={{fontFamily:'var(--m)',fontSize:11,color:'rgba(26,95,168,.8)',fontWeight:600,marginBottom:3}}>📅 Calendar audit</div>
            <div style={{fontSize:13,color:'var(--txt2)',lineHeight:1.6}}>{checkinResult.calendar_question}</div>
            <div style={{display:'flex',gap:6,marginTop:8}}>
              <button onClick={()=>{setChatHistory(h=>[...h,{role:'user',content:'Yes, keep it'},{role:'coo',content:'Got it — I\'ll keep scheduling around that block.'}]);setCheckin(null);setCheckinResult(null)}} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid rgba(26,95,168,.3)',background:'rgba(26,95,168,.08)',color:'rgba(26,95,168,.9)',cursor:'pointer'}}>Keep it</button>
              <button onClick={()=>{setChatHistory(h=>[...h,{role:'user',content:'Remove that block'},{role:'coo',content:'Noted — I\'ll free that time for future scheduling.'}]);setCheckin(null);setCheckinResult(null)}} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid rgba(138,40,40,.25)',background:'rgba(138,40,40,.07)',color:'#8a2828',cursor:'pointer'}}>Remove it</button>
              <button onClick={()=>{setCheckin(null);setCheckinResult(null)}} style={{fontFamily:'var(--m)',fontSize:11,padding:'4px 10px',borderRadius:5,border:'1px solid var(--gb2)',background:'transparent',color:'var(--txt3)',cursor:'pointer'}}>Discuss →</button>
            </div>
          </div>}
          {checkin==='evening'&&checkinResult.tomorrow_focus?.length>0&&<div style={{marginBottom:10}}>
            <div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:6}}>Tomorrow's focus</div>
            {checkinResult.tomorrow_focus.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 0',fontSize:13,color:'var(--txt)'}}><span style={{fontFamily:'var(--m)',fontSize:10,background:'var(--do-bg)',color:'var(--do)',padding:'1px 5px',borderRadius:3,flexShrink:0}}>{i+1}</span>{f}</div>)}
          </div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:4}}>
            <button className="mb-cancel" onClick={()=>{setCheckin(null);setCheckinResult(null)}}>Done</button>
            {checkin==='evening'&&checkinResult.tomorrow_trigger&&<button className="mb-save" onClick={()=>{setCheckin(null);setCheckinResult(null);setView('schedule');setSchedHorizon('tomorrow');setTimeout(generateSchedule,200)}}>Plan tomorrow now →</button>}
            {checkin!=='evening'&&<button className="mb-save" onClick={()=>{setCheckin(null);setCheckinResult(null)}}>Got it</button>}
          </div>
        </>}
      </div>
    </div>}

    {/* ADD TASK */}
    {showAddTask&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&setShowAddTask(false)}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px'}}>
        <div style={{fontFamily:'var(--s)',fontSize:20,fontStyle:'italic',color:'var(--txt)',marginBottom:14}}>New task</div>
        <div className="fm-g"><label className="fm-l">Name</label><input className="fm-in" value={taskForm.name} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="What needs doing?" onKeyDown={e=>e.key==='Enter'&&taskForm.name&&addTask(taskForm)}/></div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">Quadrant</label><select className="fm-sel" value={taskForm.q} onChange={e=>setTaskForm(f=>({...f,q:e.target.value}))}><option value="do">Do — urgent + important</option><option value="schedule">Schedule — important</option><option value="delegate">Delegate — urgent</option><option value="eliminate">Eliminate</option></select></div>
          <div className="fm-g"><label className="fm-l">Blocks</label><input className="fm-in" type="number" min={1} max={16} value={taskForm.blocks} onChange={e=>setTaskForm(f=>({...f,blocks:parseInt(e.target.value)||2}))}/></div>
        </div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">Category</label><select className="fm-sel" value={taskForm.cat} onChange={e=>setTaskForm(f=>({...f,cat:e.target.value}))}>{['career','interview','learning','fitness','family','admin','finance'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="fm-g"><label className="fm-l">Who</label><select className="fm-sel" value={taskForm.who} onChange={e=>setTaskForm(f=>({...f,who:e.target.value}))}><option value="me">Me</option><option value="team">Team</option><option value="delegated">Delegated</option></select></div>
        </div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">When</label><select className="fm-sel" value={taskForm.when||'today'} onChange={e=>setTaskForm(f=>({...f,when:e.target.value,date:horizonDate(e.target.value)}))}>
            <option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This week</option><option value="month">This month</option>
          </select></div>
          <div className="fm-g"><label className="fm-l">Notes</label><input className="fm-in" value={taskForm.notes} onChange={e=>setTaskForm(f=>({...f,notes:e.target.value}))} placeholder="Context or link…"/></div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
          <button className="mb-cancel" onClick={()=>setShowAddTask(false)}>Cancel</button>
          <button className="mb-save" onClick={()=>taskForm.name&&addTask({...taskForm,date:taskForm.date||horizonDate(taskForm.when||'today')})}>Add task</button>
        </div>
      </div>
    </div>}

    {/* ADD AGENT */}
    {showAddAgent&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&setShowAddAgent(false)}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px'}}>
        <div style={{fontFamily:'var(--s)',fontSize:20,fontStyle:'italic',color:'var(--txt)',marginBottom:14}}>New agent</div>
        <div className="fm-g"><label className="fm-l">Name</label><input className="fm-in" value={newAgent.name} onChange={e=>setNewAgent(a=>({...a,name:e.target.value}))} placeholder="e.g. Finance Coach"/></div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">Icon</label><input className="fm-in" value={newAgent.icon} onChange={e=>setNewAgent(a=>({...a,icon:e.target.value}))} placeholder="💰" maxLength={2}/></div>
          <div className="fm-g"><label className="fm-l">Area</label><select className="fm-sel" value={newAgent.area} onChange={e=>setNewAgent(a=>({...a,area:e.target.value}))}>{['career','interview','learning','fitness','family','finance','admin'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="fm-g"><label className="fm-l">System prompt</label><textarea className="fm-in" value={newAgent.prompt} onChange={e=>setNewAgent(a=>({...a,prompt:e.target.value}))} rows={3} style={{resize:'vertical'}} placeholder="You are my coach for…"/></div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
          <button className="mb-cancel" onClick={()=>setShowAddAgent(false)}>Cancel</button>
          <button className="mb-save" onClick={async()=>{if(!newAgent.name)return;const r=await fetch('/api/agents',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'new',...newAgent,score:50,runs:0,streak:0,status:'idle',alert:'',output:''})});setShowAddAgent(false);api.agents.list().then(r=>r.agents&&setAgents(r.agents))}}>Create agent</button>
        </div>
      </div>
    </div>}

    {/* NEW GOAL */}
    {newGoalOpen&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&!newGoalLoading&&setNewGoalOpen(false)}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:380,padding:'20px 20px 16px'}}>
        <div style={{fontFamily:'var(--s)',fontSize:21,fontStyle:'italic',color:'var(--txt)',marginBottom:5}}>New goal</div>
        <p style={{fontSize:13.5,color:'var(--txt3)',marginBottom:16,lineHeight:1.6}}>Your COO will structure this into milestones, tracking metrics, and suggest an agent if helpful.</p>
        <div className="fm-g"><label className="fm-l">What do you want to achieve?</label><input className="fm-in" value={newGoalDraft.title} onChange={e=>setNewGoalDraft(d=>({...d,title:e.target.value}))} placeholder="e.g. Land a new ML role, Run a 10K, Launch my side project" onKeyDown={e=>e.key==='Enter'&&!newGoalLoading&&createGoal()} autoFocus/></div>
        <div className="fm-g"><label className="fm-l">More context <span style={{color:'var(--txt3)',fontWeight:400}}>(optional — helps COO be specific)</span></label><textarea className="fm-in" value={newGoalDraft.description} onChange={e=>setNewGoalDraft(d=>({...d,description:e.target.value}))} rows={2} style={{resize:'none'}} placeholder="e.g. targeting Series B startups in ML infra, currently at 5K base mileage…"/></div>
        <div className="fm-g"><label className="fm-l">Target date <span style={{color:'var(--txt3)',fontWeight:400}}>(optional)</span></label><input className="fm-in" type="date" value={newGoalDraft.target_date} min={todayStr()} max={addDays(365)} onChange={e=>setNewGoalDraft(d=>({...d,target_date:e.target.value}))}/></div>
        {newGoalLoading&&<div style={{padding:'10px 12px',background:'rgba(26,90,60,.05)',border:'1px solid rgba(26,90,60,.12)',borderRadius:'var(--r)',fontFamily:'var(--m)',fontSize:12.5,color:'var(--acc2)',display:'flex',alignItems:'center',gap:8,marginBottom:12}}><div style={{width:12,height:12,border:'2px solid rgba(122,170,138,.3)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>COO is structuring your goal…</div>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
          <button className="mb-cancel" onClick={()=>setNewGoalOpen(false)} disabled={newGoalLoading}>Cancel</button>
          <button className="mb-save" onClick={createGoal} disabled={newGoalLoading||!newGoalDraft.title.trim()}>{newGoalLoading?'Thinking…':'Set goal →'}</button>
        </div>
      </div>
    </div>}

    {/* Undo toast */}
    {undoInfo&&<div style={{position:'fixed',bottom:72,left:'50%',transform:'translateX(-50%)',zIndex:400,background:'rgba(24,46,34,.92)',backdropFilter:'blur(12px)',borderRadius:8,padding:'9px 16px',display:'flex',alignItems:'center',gap:12,boxShadow:'0 4px 20px rgba(0,0,0,.28)',animation:'fadeUp .18s ease',whiteSpace:'nowrap'}}>
      <span style={{color:'rgba(255,255,255,.8)',fontFamily:'var(--m)',fontSize:12}}>{undoInfo.label}</span>
      <button onClick={handleUndo} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',color:'#fff',padding:'3px 11px',borderRadius:5,cursor:'pointer',fontFamily:'var(--m)',fontSize:12}}>↩ Undo</button>
      <button onClick={()=>setUndoInfo(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,.5)',cursor:'pointer',fontSize:14,padding:0,lineHeight:1}}>×</button>
    </div>}

    <style>{`
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:680px){nav{display:none!important}#mob-nav{display:flex!important}.scroll{padding:11px 11px!important}}
    `}</style>
    </>
  )
}
