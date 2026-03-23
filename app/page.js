'use client'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/realtime'
import dynamic from 'next/dynamic'
const TreeView=dynamic(()=>import('@/components/TreeView'),{ssr:false,loading:()=>null})
const SettingsPanel=dynamic(()=>import('@/components/SettingsPanel'),{ssr:false,loading:()=>null})

const CAT_COLORS={career:'#b85c00',interview:'#0f6e56',learning:'#1a5fa8',fitness:'#8a2828',family:'#6a2878',admin:'#5a4800',finance:'#0f5a3c'}
const Q_POS={do:{x:.76,y:.26},schedule:{x:.26,y:.26},delegate:{x:.76,y:.76},eliminate:{x:.26,y:.76}}

const api={
  tasks:{
    list:(date)=>fetch(`/api/tasks${date?'?date='+date:''}`).then(r=>r.json()).catch(()=>({tasks:[]})),
    create:(t)=>fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(t)}).then(r=>r.json()),
    update:(id,u)=>fetch('/api/tasks',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...u})}).then(r=>r.json()),
  },
  schedule:{
    get:()=>fetch('/api/schedule').then(r=>r.json()).catch(()=>({schedule:null})),
    generate:(ctx)=>fetch('/api/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ctx)}).then(r=>r.json()),
    patch:(action,slotIndex)=>fetch('/api/schedule',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,slotIndex})}).then(r=>r.json()),
  },
  coo:{checkin:(type,msg)=>fetch('/api/coo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,userMessage:msg})}).then(r=>r.json())},
  agents:{
    list:()=>fetch('/api/agents').then(r=>r.json()).catch(()=>({agents:[]})),
    run:(id,silent)=>fetch('/api/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agentId:id,silent})}).then(r=>r.json()),
    update:(id,u)=>fetch('/api/agents',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...u})}).then(r=>r.json()),
  },
  settings:{get:()=>fetch('/api/settings').then(r=>r.json()).catch(()=>({settings:{}}))},
  oura:{get:()=>fetch('/api/oura').then(r=>r.json()).catch(()=>({connected:false}))},
  tree:{get:()=>fetch('/api/tree',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}))},
}

function TreeSVG(){return(<svg style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:1,pointerEvents:'none'}}viewBox="0 0 1000 700"preserveAspectRatio="xMidYMid slice"xmlns="http://www.w3.org/2000/svg"><ellipse cx="55"cy="605"rx="68"ry="86"fill="#1a3a2a"opacity=".92"/><ellipse cx="55"cy="528"rx="52"ry="66"fill="#2d5a3d"opacity=".88"/><ellipse cx="55"cy="465"rx="37"ry="52"fill="#3d7a52"opacity=".82"/><rect x="47"y="593"width="14"height="105"fill="#152d1e"opacity=".9"/><ellipse cx="168"cy="632"rx="56"ry="72"fill="#1a3a2a"opacity=".88"/><ellipse cx="168"cy="570"rx="43"ry="57"fill="#2d5a3d"opacity=".82"/><ellipse cx="168"cy="516"rx="31"ry="43"fill="#4a9e6b"opacity=".76"/><rect x="161"y="620"width="12"height="82"fill="#152d1e"opacity=".88"/><ellipse cx="875"cy="612"rx="72"ry="90"fill="#1a3a2a"opacity=".92"/><ellipse cx="875"cy="532"rx="55"ry="70"fill="#2d5a3d"opacity=".88"/><ellipse cx="875"cy="465"rx="39"ry="56"fill="#3d7a52"opacity=".82"/><rect x="867"y="600"width="14"height="105"fill="#152d1e"opacity=".9"/><ellipse cx="962"cy="642"rx="52"ry="67"fill="#1a3a2a"opacity=".88"/><ellipse cx="962"cy="584"rx="40"ry="52"fill="#2d5a3d"opacity=".82"/><rect x="956"y="632"width="12"height="68"fill="#152d1e"opacity=".88"/><ellipse cx="500"cy="682"rx="43"ry="56"fill="#1a3a2a"opacity=".72"/><ellipse cx="500"cy="636"rx="34"ry="44"fill="#2d5a3d"opacity=".67"/><ellipse cx="312"cy="662"rx="40"ry="52"fill="#1a3a2a"opacity=".74"/><ellipse cx="312"cy="620"rx="31"ry="41"fill="#2d5a3d"opacity=".70"/><circle cx="115"cy="105"r="72"fill="#a8d9b8"opacity=".11"/><circle cx="755"cy="65"r="88"fill="#c8e6d4"opacity=".09"/></svg>)}

function PerfRing({score,color}){const ref=useRef(null);useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,36,36);ctx.strokeStyle='rgba(20,60,35,.1)';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.arc(18,18,14,0,Math.PI*2);ctx.stroke();ctx.strokeStyle=color;ctx.beginPath();ctx.arc(18,18,14,-Math.PI/2,-Math.PI/2+(score/100)*Math.PI*2);ctx.stroke();ctx.fillStyle=color;ctx.font='bold 9px JetBrains Mono,monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(score,18,18)},[score,color]);return <canvas ref={ref} width={36} height={36}/>}

function MatrixCanvas({tasks,onToggle}){
  const canvasRef=useRef(null);const mapRef=useRef([]);const tipRef=useRef(null)
  const draw=useCallback(()=>{
    const canvas=canvasRef.current;if(!canvas)return
    const dpr=window.devicePixelRatio||1;const W=canvas.parentElement.clientWidth-24;const H=250
    canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px'
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H)
    ;[['rgba(184,92,0,.13)',W/2,0,W/2,H/2],['rgba(26,95,168,.10)',0,0,W/2,H/2],['rgba(15,110,86,.10)',W/2,H/2,W/2,H/2],['rgba(122,170,138,.08)',0,H/2,W/2,H/2]].forEach(([c,x,y,w,h])=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)})
    ctx.strokeStyle='rgba(20,60,35,.1)';ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H/2);ctx.lineTo(W,H/2);ctx.stroke();ctx.setLineDash([])
    ctx.font='8px JetBrains Mono,monospace';ctx.fillStyle='rgba(20,60,35,.26)';ctx.textAlign='center';ctx.fillText('IMPORTANT →',W/2,H-5)
    ctx.save();ctx.translate(10,H/2);ctx.rotate(-Math.PI/2);ctx.fillText('URGENT →',0,0);ctx.restore()
    ;[['DO',W*.76,16,'rgba(184,92,0,.9)'],['SCHEDULE',W*.26,16,'rgba(26,95,168,.85)'],['DELEGATE',W*.76,H/2+15,'rgba(15,110,86,.85)'],['ELIMINATE',W*.26,H/2+15,'rgba(122,170,138,.85)']].forEach(([t,x,y,c])=>{ctx.font='700 8px JetBrains Mono,monospace';ctx.fillStyle=c;ctx.textAlign='center';ctx.fillText(t,x,y)})
    mapRef.current=[];const placed=[]
    tasks.forEach(t=>{
      const base=Q_POS[t.q]||Q_POS.do;const r=Math.max(8,Math.min(26,t.blocks*4))
      let bx=base.x*W,by=base.y*H;const sp=Math.min(W,H)*.16;let ox=0,oy=0,att=0
      do{ox=(Math.random()-.5)*sp;oy=(Math.random()-.5)*sp;att++}while(att<30&&placed.some(p=>Math.hypot(p[0]-(bx+ox),p[1]-(by+oy))<r+p[2]+5))
      bx=Math.max(r+18,Math.min(W-r-18,bx+ox));by=Math.max(r+18,Math.min(H-r-18,by+oy));placed.push([bx,by,r])
      const col=CAT_COLORS[t.cat]||'#3d7a52'
      const isProposed=t.status==='proposed'
      ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2)
      if(t.done){ctx.fillStyle='rgba(20,60,35,.05)';ctx.fill();ctx.strokeStyle='rgba(20,60,35,.18)';ctx.lineWidth=1;ctx.setLineDash([]);ctx.stroke()}
      else if(isProposed){ctx.lineWidth=1.6;ctx.setLineDash([4,3]);ctx.strokeStyle=col;ctx.stroke();ctx.setLineDash([])}
      else{ctx.fillStyle=col+'40';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.8;ctx.setLineDash([]);ctx.stroke()}
      ctx.font=(t.done?'400 ':'500 ')+Math.max(8,r*.55)+'px JetBrains Mono,monospace'
      ctx.fillStyle=t.done?'rgba(20,60,35,.26)':isProposed?col+'99':col;ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(t.done?'✓':t.blocks,bx,by);mapRef.current.push({x:bx,y:by,r,t})
    })
  },[tasks])
  useEffect(()=>{draw();const ro=new ResizeObserver(draw);if(canvasRef.current?.parentElement)ro.observe(canvasRef.current.parentElement);return()=>ro.disconnect()},[draw])
  const getHit=(cx,cy)=>mapRef.current.find(c=>Math.hypot(c.x-cx,c.y-cy)<=c.r+6)
  const qc=['do','schedule','delegate','eliminate'].reduce((a,q)=>{a[q]=tasks.filter(t=>t.q===q).length;return a},{})
  return(
    <div className="card"style={{position:'relative'}}>
      <div className="card-hdr"><span className="card-title">Eisenhower field</span><span style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)'}}>bubble = 15-min blocks · tap to complete</span></div>
      <div style={{padding:'0 12px 2px'}}>
        <canvas ref={canvasRef}height={250}style={{display:'block',width:'100%',cursor:'crosshair',touchAction:'manipulation'}}
          onMouseMove={e=>{const rect=canvasRef.current.getBoundingClientRect();const hit=getHit(e.clientX-rect.left,e.clientY-rect.top);const tip=tipRef.current;if(!tip)return;if(hit){tip.style.display='block';tip.style.left=Math.min(e.clientX-rect.left+14,rect.width-200)+'px';tip.style.top=Math.max(e.clientY-rect.top-44,4)+'px';tip.innerHTML=`<strong style="color:#182e22">${hit.t.name}</strong><br>${hit.t.blocks}×15min · ${hit.t.cat}`}else tip.style.display='none'}}
          onMouseLeave={()=>{if(tipRef.current)tipRef.current.style.display='none'}}
          onClick={e=>{const rect=canvasRef.current.getBoundingClientRect();const hit=getHit(e.clientX-rect.left,e.clientY-rect.top);if(hit)onToggle(hit.t.id)}}
          onTouchEnd={e=>{e.preventDefault();const rect=canvasRef.current.getBoundingClientRect();const touch=e.changedTouches[0];const hit=getHit(touch.clientX-rect.left,touch.clientY-rect.top);if(hit)onToggle(hit.t.id)}}/>
      </div>
      <div ref={tipRef}style={{position:'absolute',background:'rgba(255,255,255,.96)',backdropFilter:'blur(12px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:8,padding:'7px 10px',fontSize:11,color:'var(--txt)',pointerEvents:'none',display:'none',zIndex:99,fontFamily:'var(--m)',maxWidth:190,lineHeight:1.5}}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,padding:'8px 12px 12px'}}>
        {[['do','Do','do'],['schedule','Schedule','sch'],['delegate','Delegate','del'],['eliminate','Eliminate','eli']].map(([q,l,v])=>(
          <div key={q}style={{padding:'7px 10px',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'space-between',background:`var(--${v}-bg)`,border:`1px solid var(--${v}-bd)`}}>
            <span style={{fontFamily:'var(--m)',fontSize:'8.5px',letterSpacing:'.09em',textTransform:'uppercase',fontWeight:500,color:`var(--${v})`}}>{l}</span>
            <span style={{fontFamily:'var(--m)',fontSize:13,fontWeight:500,color:`var(--${v})`}}>{qc[q]}</span>
          </div>
        ))}
      </div>
    </div>
  )
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
  const[qaName,setQaName]=useState('');const[qaQ,setQaQ]=useState('do');const[qaCat,setQaCat]=useState('career');const[qaB,setQaB]=useState(2)
  const[tuning,setTuning]=useState(null);const[promptDraft,setPromptDraft]=useState('')
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
  const[chatMsg,setChatMsg]=useState('')
  const[chatHistory,setChatHistory]=useState([])
  const[chatLoading,setChatLoading]=useState(false)
  const[isRecording,setIsRecording]=useState(false)
  const[chatVisible,setChatVisible]=useState(false)
  const mediaRecorderRef=useRef(null)

  const userId=session?.user?.email

  // Online/offline detection
  useEffect(()=>{
    const on=()=>setIsOnline(true);const off=()=>setIsOnline(false)
    window.addEventListener('online',on);window.addEventListener('offline',off)
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}
  },[])

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
        api.tasks.list().then(r=>r.tasks&&setTasks(r.tasks)),
        api.schedule.get().then(r=>r.schedule&&setSchedule(r.schedule)),
        api.agents.list().then(r=>r.agents&&setAgents(r.agents)),
        api.oura.get().then(r=>setOura(r)),
      ])
    })
    // Schedule check-ins
    const h=new Date().getHours()
    if(h>=12&&h<13)setTimeout(()=>setCheckin('midday'),4000)
    if(h>=16&&h<17)setTimeout(()=>setCheckin('afternoon'),4000)
    if(h>=19&&h<21)setTimeout(()=>setCheckin('evening'),4000)
    // Sunday weekly review
    if(new Date().getDay()===0){
      api.coo.checkin('weekly','').then(r=>r.result&&setWeeklyBrief(r.result))
    }
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
      const{schedule:s,error}=await api.schedule.generate({roadmap:settings?.roadmap})
      if(error)throw new Error(error)
      if(s)setSchedule(s)
      setCooState('ok');setCooLabel('Schedule ready')
    }catch(e){setSchedError(e.message||'Failed to generate schedule');setCooState('idle');setCooLabel('COO idle')}
    setSchedLoading(false)
  }

  async function vetoSlot(idx){
    setCooState('thinking');setCooLabel('Assessing impact…')
    try{const{slots}=await api.schedule.patch('veto',idx);if(slots)setSchedule(s=>({...s,slots}))}catch{}
    setCooState('ok');setCooLabel('Impact assessed')
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

  async function confirmTask(id){
    setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'active'}:x))
    try{await api.tasks.update(id,{status:'active'})}catch{setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'proposed'}:x))}
  }

  async function wontDoTask(id){
    setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'wont_do'}:x))
    try{await api.tasks.update(id,{status:'wont_do'})}catch{setTasks(ts=>ts.map(x=>x.id===id?{...x,status:'proposed'}:x))}
  }

  async function sendChat(){
    if(!chatMsg.trim())return
    const msg=chatMsg.trim();setChatMsg('');setChatLoading(true);setChatVisible(true)
    setChatHistory(h=>[...h,{role:'user',content:msg}])
    try{const{result}=await api.coo.checkin('chat',msg);if(result){const resp=result.message||result.headline||JSON.stringify(result);setChatHistory(h=>[...h,{role:'coo',content:resp}]);if(result.reschedule_needed)setTimeout(generateSchedule,1500)}}catch{}
    setChatLoading(false)
  }

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
    try{const{result}=await api.coo.checkin(checkin,checkinMsg);setCheckinResult(result);if(result?.reschedule_needed)setTimeout(generateSchedule,1500)}catch{}
    setCheckinLoading(false)
  }

  if(status==='loading')return(<><div style={{position:'fixed',inset:0,background:'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)',zIndex:0}}/><TreeSVG/><div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:20}}><div style={{width:24,height:24,border:'3px solid rgba(122,170,138,0.3)',borderTopColor:'#2d7a52',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></>)

  if(status==='unauthenticated')return(
    <><div style={{position:'fixed',inset:0,background:'linear-gradient(162deg,#cce8d5 0%,#a8d9b8 18%,#7bbf98 48%,#4a9e6b 72%,#2d5a3d 100%)',zIndex:0}}/>
    <img src="/FFTT.jpg" alt="" style={{position:'fixed',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.8,zIndex:1,pointerEvents:'none'}}/>
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16}}>
      <div style={{background:'#fff',borderRadius:20,padding:'32px 28px',maxWidth:320,width:'100%',textAlign:'center',border:'1px solid rgba(255,255,255,.9)',boxShadow:'0 20px 60px rgba(20,60,35,.35)'}}>
        <div style={{fontSize:36,marginBottom:8}}>🌲</div>
        <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:24,color:'#182e22',marginBottom:4,fontStyle:'italic'}}>Forest for the Tree</div>
        <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:8.5,color:'#7aaa8a',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:20}}>Life OS · v2</div>
        <p style={{fontSize:12.5,color:'#3a5c47',marginBottom:20,lineHeight:1.65}}>Your autonomous COO reads Calendar, Gmail, and Tasks — then builds and manages your day, ADHD-aware.</p>
        <button onClick={()=>signIn('google')}style={{width:'100%',background:'#1a5a3c',color:'#fff',border:'none',borderRadius:8,padding:'11px 0',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Figtree,sans-serif'}}>Continue with Google</button>
        <p style={{fontSize:9.5,color:'#7aaa8a',marginTop:10,fontFamily:'JetBrains Mono,monospace'}}>Calendar · Gmail · Tasks · Contacts · Oura</p>
      </div>
    </div></>
  )

  const viewTitle={home:"Today's field",schedule:'COO Schedule',agents:'Agent network',log:'Performance log',settings:'Settings',tree:'Life tree'}
  const statusColor={idle:'#b0ccb8',thinking:'#b85c00',alert:'#8a2828',ok:'#0f6e56'}
  const pendingSlots=schedule?.slots?.filter(s=>s.taskId&&(s.state==='pending'||s.state==='optional')).length||0
  const alertAgents=agents.filter(a=>a.status==='alert').length
  const navItems=[
    {id:'home',icon:'◈',label:'Matrix',badge:tasks.filter(t=>!t.done).length,bc:'var(--ok)'},
    {id:'schedule',icon:'◷',label:'Schedule',badge:pendingSlots,bc:'var(--danger)'},
    {id:'agents',icon:'⬡',label:'Agents',badge:alertAgents,bc:'var(--danger)'},
    {id:'tree',icon:'🌲',label:'Life tree',badge:0,bc:''},
    {id:'log',icon:'◻',label:'Log',badge:0,bc:''},
    {id:'settings',icon:'⚙',label:'Settings',badge:0,bc:''},
  ]

  return(
    <><div className="app-bg"/><TreeSVG/>
    {!isOnline&&<div style={{position:'fixed',top:0,left:0,right:0,background:'rgba(138,40,40,0.92)',backdropFilter:'blur(8px)',padding:'8px 16px',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:11.5,color:'#fff',fontFamily:'JetBrains Mono,monospace',zIndex:500}}>● Offline — tasks saved, will sync when reconnected</div>}

    <div style={{position:'fixed',inset:0,zIndex:10,display:'flex'}}>
      {/* SIDEBAR */}
      <nav style={{width:196,flexShrink:0,background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderRight:'1px solid var(--gb)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 15px 11px',borderBottom:'1px solid var(--gb2)'}}>
          <div style={{fontFamily:'var(--s)',fontSize:16,color:'var(--txt)',fontStyle:'italic',lineHeight:1.2}}>Forest for the Tree</div>
          <div style={{fontFamily:'var(--m)',fontSize:'8px',color:'var(--txt3)',letterSpacing:'.12em',textTransform:'uppercase',marginTop:2}}>Life OS · v2</div>
        </div>
        {/* COO + Oura status */}
        <div style={{margin:'8px 8px 0',padding:'8px 10px',borderRadius:'var(--r)',border:'1px solid var(--gb2)',background:'var(--glass2)'}}>
          <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:oura?.connected?6:0}}>
            <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:statusColor[cooState],animation:cooState==='thinking'?'blink 1.2s infinite':cooState==='alert'?'blink .6s infinite':'none'}}/>
            <div style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt2)'}}>{cooLabel}</div>
          </div>
          {oura?.connected&&oura?.data?.readiness?(
            <div style={{display:'flex',alignItems:'center',gap:6,paddingTop:4,borderTop:'1px solid var(--gb2)'}}>
              <span style={{fontSize:12}}>💍</span>
              <div>
                <div style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt2)'}}>Readiness: <strong style={{color:oura.data.readiness.score>=70?'var(--ok)':oura.data.readiness.score>=50?'var(--warn)':'var(--danger)'}}>{oura.data.readiness.score}</strong>/100</div>
                <div style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)',marginTop:1}}>{oura.data.sleep?.score?`Sleep ${oura.data.sleep.score}/100 · `:''}{oura.data.energy_level} energy</div>
              </div>
            </div>
          ):!oura?.connected?(
            <div style={{paddingTop:4,borderTop:'1px solid var(--gb2)'}}>
              <a href="/settings" style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)',textDecoration:'none',display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:10}}>💍</span>Connect Oura →
              </a>
            </div>
          ):null}
        </div>
        <div style={{flex:1,padding:'10px 8px',display:'flex',flexDirection:'column',gap:2}}>
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>{setView(item.id);if(item.id==='schedule'&&!schedule)generateSchedule();if(item.id==='tree'&&!treeData)loadTree()}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:'var(--r)',cursor:'pointer',color:view===item.id?'var(--acc2)':'var(--txt2)',fontSize:12.5,border:view===item.id?'1px solid var(--gb2)':'1px solid transparent',background:view===item.id?'var(--glass2)':'transparent',width:'100%',textAlign:'left',fontFamily:'var(--f)',fontWeight:view===item.id?500:400}}>
              <span style={{fontSize:14,width:17,textAlign:'center'}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.badge>0&&<span style={{fontFamily:'var(--m)',fontSize:8.5,background:item.bc,color:'#fff',padding:'1px 5px',borderRadius:9}}>{item.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:'10px 8px',borderTop:'1px solid var(--gb2)'}}>
          <div style={{padding:'8px 10px',background:'var(--glass2)',borderRadius:'var(--r)',border:'1px solid var(--gb2)'}}>
            <div style={{fontFamily:'var(--s)',fontSize:12.5,color:'var(--txt)',fontStyle:'italic'}}>{new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</div>
            <div style={{fontFamily:'var(--m)',fontSize:7.5,color:'var(--txt3)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session?.user?.email}</div>
          </div>
          <a href="/about" style={{display:'block',textAlign:'center',marginTop:6,fontFamily:'var(--m)',fontSize:8.5,color:'var(--txt3)',textDecoration:'none',opacity:.7}}>? About this app</a>
        </div>
      </nav>

      {/* CONTENT */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderBottom:'1px solid var(--gb2)',flexShrink:0}}>
          <span style={{fontFamily:'var(--s)',fontSize:15,fontStyle:'italic',color:'var(--txt2)'}}>{viewTitle[view]}</span>
          <div style={{display:'flex',gap:7}}>
            {view==='home'&&<>
              <div style={{display:'flex',alignItems:'baseline',gap:3,background:'var(--glass2)',border:'1px solid var(--gb2)',padding:'3px 9px',borderRadius:16}}><span style={{fontFamily:'var(--m)',fontSize:13,fontWeight:500,color:'var(--acc2)'}}>{doneTasks.length}</span><span style={{fontSize:9,color:'var(--txt3)'}}>done</span></div>
              <div style={{display:'flex',alignItems:'baseline',gap:3,background:'var(--glass2)',border:'1px solid var(--gb2)',padding:'3px 9px',borderRadius:16}}><span style={{fontFamily:'var(--m)',fontSize:13,fontWeight:500,color:'var(--del)'}}>{hrs}h</span><span style={{fontSize:9,color:'var(--txt3)'}}>invested</span></div>
              <button className="btn-primary" onClick={()=>setShowAddTask(true)}>+ Task</button>
            </>}
            {view==='schedule'&&<><button className="btn-ghost" onClick={generateSchedule} disabled={schedLoading}>↺ Re-plan</button><button className="btn-primary" onClick={acceptAll}>Accept all</button></>}
            {view==='agents'&&<button className="btn-primary" onClick={()=>setShowAddAgent(true)}>+ Agent</button>}
          </div>
        </div>

        {view==='tree'
          ?<div style={{flex:1,minHeight:0,display:'flex',overflow:'hidden'}}>
            <div style={{flex:1,minHeight:0,overflow:'hidden',borderRadius:'var(--r2)',margin:'8px 0 8px 8px'}}>
              {treeLoading&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)'}}>Growing your tree…</div>}
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
                <div style={{width:240,flexShrink:0,borderLeft:'1px solid rgba(0,0,0,.09)',background:'rgba(250,249,246,.98)',display:'flex',flexDirection:'column',overflowY:'auto',fontSize:12}}>
                  {/* Species header */}
                  <div style={{padding:'14px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
                      <span style={{fontFamily:'var(--m)',fontSize:9,fontWeight:700,color:'#182e22',letterSpacing:'.1em',textTransform:'uppercase'}}>LEVEL {currentTier}</span>
                      <span style={{width:4,height:4,borderRadius:'50%',background:'#4a9e6b',display:'inline-block'}}/>
                    </div>
                    <div style={{fontFamily:'var(--m)',fontSize:9,color:'#7aaa8a',marginBottom:7}}>{cat?.group_name||'—'}</div>
                    <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:20,fontWeight:600,color:'#182e22',marginBottom:2,lineHeight:1.2}}>{cat?.emoji||sp?.species_emoji||'🌿'} {cat?.name||sp?.species_name||'Seedling'}</div>
                    {cat?.height_ft&&<div style={{fontFamily:'var(--m)',fontSize:9,color:'#7aaa8a',marginBottom:8}}>{cat.height_ft} ft height · {cat.width_ft} ft wide</div>}
                    {cat?.fact&&<div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:11,fontStyle:'italic',color:'#3a5c47',lineHeight:1.55,marginBottom:3}}>{cat.fact}</div>}
                    {cat?.exemplar&&<div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:10,fontStyle:'italic',color:'#7aaa8a',lineHeight:1.4}}>"{cat.exemplar}"</div>}
                  </div>
                  {/* XP progress */}
                  <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{fontFamily:'var(--m)',fontSize:8,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a',marginBottom:10}}>Progress</div>
                    {[['Height XP · mastery',hXP,nextH,'#4a9e6b'],['Width XP · impact',wXP,nextW,'#1a5fa8']].map(([label,val,max,col])=>(
                      <div key={label} style={{marginBottom:10}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                          <span style={{fontFamily:'var(--m)',fontSize:9,color:'#3a5c47'}}>{label}</span>
                          <span style={{fontFamily:'var(--m)',fontSize:9,color:'#182e22',fontWeight:500}}>{val.toLocaleString()} / {max.toLocaleString()}</span>
                        </div>
                        <div style={{height:4,borderRadius:2,background:'rgba(0,0,0,.07)',overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,background:col,width:`${Math.min(100,(val/Math.max(max,1))*100).toFixed(1)}%`,transition:'width .4s'}}/>
                        </div>
                      </div>
                    ))}
                    {next&&<div style={{fontFamily:'var(--m)',fontSize:8.5,color:'#7aaa8a',marginTop:2}}>Next: {next.emoji} {next.name} #{next.tier} · +{(nextH-hXP).toLocaleString()} H · +{(nextW-wXP).toLocaleString()} W</div>}
                  </div>
                  {/* Streak */}
                  <div style={{padding:'10px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{fontSize:13}}>🔥</span>
                        <span style={{fontFamily:'var(--m)',fontSize:9,fontWeight:600,color:streak>=7?'#b85c00':'#3a5c47'}}>{streak} day streak</span>
                      </div>
                      <span style={{fontFamily:'var(--m)',fontSize:9,color:'#1a5a3c',fontWeight:600}}>{streakMult}×</span>
                    </div>
                    {streak>0&&(
                      <div style={{height:3,borderRadius:2,background:'rgba(0,0,0,.07)',overflow:'hidden',marginBottom:4}}>
                        <div style={{height:'100%',borderRadius:2,background:'linear-gradient(90deg,#b85c00,#e8a030)',width:`${Math.min(100,(streak/30)*100)}%`,transition:'width .4s'}}/>
                      </div>
                    )}
                    <div style={{fontFamily:'var(--m)',fontSize:8,color:'#7aaa8a'}}>
                      {streak===0?'Complete a task to start your streak':
                       nextMilestoneStreak?`${nextMilestoneStreak-streak} more days → ${nextMilestoneBonus}× bonus`:`Max bonus reached! 2.5× XP on every task`}
                      {longestStreak>streak&&longestStreak>0&&<span style={{marginLeft:6,opacity:.6}}>· best: {longestStreak}</span>}
                    </div>
                  </div>
                  {/* Tier ladder */}
                  <div style={{padding:'12px 14px 10px',borderBottom:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{fontFamily:'var(--m)',fontSize:8,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a',marginBottom:8}}>Tier Ladder</div>
                    {groupList.map(grp=>{
                      const unlocked=grp.minTier<=currentTier
                      const isCurrent=grp.id===activeTierGroup
                      const isOpen=tierExpanded===grp.id||(isCurrent&&tierExpanded===null)
                      return(
                        <div key={grp.id} style={{marginBottom:3}} ref={el=>{tierRefs.current[grp.id]=el}}>
                          <button onClick={()=>{const opening=!isOpen;setTierExpanded(opening?grp.id:-1);if(opening)setTimeout(()=>tierRefs.current[grp.id]?.scrollIntoView({behavior:'smooth',block:'nearest'}),80)}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:6,border:`1px solid ${isCurrent?'rgba(26,90,60,.2)':'rgba(0,0,0,.08)'}`,background:isCurrent?'rgba(26,90,60,.05)':unlocked?'#fff':'rgba(0,0,0,.02)',cursor:'pointer',textAlign:'left'}}>
                            <div style={{fontFamily:'var(--m)',fontSize:9.5,color:unlocked?'#182e22':'#b0bab4',fontWeight:isCurrent?600:400}}>{unlocked?'':`🔒 `}Tier {grp.id} · {grp.name} <span style={{color:'#9aaa8a',fontWeight:400}}>#{grp.minTier}–{grp.maxTier}</span></div>
                            <span style={{color:'#7aaa8a',fontSize:9,fontWeight:600}}>{isOpen?'–':'›'}</span>
                          </button>
                          {isOpen&&unlocked&&(
                            <div style={{paddingLeft:4,paddingTop:2,display:'flex',flexDirection:'column',gap:0}}>
                              {grp.species.map(s=>{
                                const isCur=s.tier===currentTier
                                const isUnlocked=s.tier<=currentTier
                                return(
                                  <div key={s.tier} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:4,background:isCur?'rgba(26,90,60,.07)':'transparent',opacity:isUnlocked?1:.35,borderBottom:'1px solid rgba(0,0,0,.04)'}}>
                                    <span style={{fontSize:12,width:15,textAlign:'center'}}>{s.emoji}</span>
                                    <span style={{fontFamily:'Figtree,sans-serif',fontSize:11.5,color:isCur?'#182e22':'#4a6a50',flex:1,fontWeight:isCur?500:400}}>{s.name}</span>
                                    {isCur&&<span style={{fontSize:9,color:'#1a5a3c',fontWeight:600}}>►</span>}
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
                      <span style={{fontFamily:'var(--m)',fontSize:8,textTransform:'uppercase',letterSpacing:'.12em',color:'#7aaa8a'}}>Manage tree</span>
                      <span style={{color:'#7aaa8a',fontSize:9}}>{reevalOpen?'▾':'›'}</span>
                    </button>
                    {reevalOpen&&(
                      <div style={{marginTop:8}}>
                        <div style={{fontFamily:'var(--m)',fontSize:9,color:'#7aaa8a',marginBottom:5,lineHeight:1.5}}>Add career history, certifications, or projects the COO should know when ranking you.</div>
                        <textarea value={reevalCtx} onChange={e=>setReevalCtx(e.target.value)} rows={4} placeholder="e.g. 10 years in ML engineering, shipped 3 production models, published 2 papers…" style={{width:'100%',background:'#fff',border:'1px solid rgba(0,0,0,.12)',borderRadius:6,color:'#182e22',fontSize:10,padding:'6px 8px',fontFamily:'Figtree,sans-serif',resize:'vertical',outline:'none',lineHeight:1.5,boxSizing:'border-box'}}/>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                          <label style={{display:'inline-flex',alignItems:'center',gap:4,padding:'4px 9px',borderRadius:5,cursor:reevalAttachments.length>=3?'not-allowed':'pointer',border:'1px dashed rgba(122,170,138,.5)',fontSize:9.5,color:'#7aaa8a',fontFamily:'var(--m)',background:'rgba(45,122,82,.03)',opacity:reevalAttachments.length>=3?.4:1}}>
                            📎 Attach
                            <input type="file" multiple accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,image/*" style={{display:'none'}} onChange={handleReevalFileSelect} disabled={reevalAttachments.length>=3}/>
                          </label>
                          <span style={{fontFamily:'var(--m)',fontSize:8.5,color:'#7aaa8a'}}>{reevalAttachments.length>0?`${reevalAttachments.length}/3 files`:'up to 3 · txt md pdf img'}</span>
                        </div>
                        {reevalAttachments.length>0&&(
                          <div style={{marginTop:5,display:'flex',flexDirection:'column',gap:3}}>
                            {reevalAttachments.map(a=>(
                              <div key={a.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 7px',borderRadius:4,background:'#f8f7f4',border:'1px solid rgba(0,0,0,.08)'}}>
                                <span style={{fontSize:10}}>{a.status==='extracting'?'⏳':a.status==='done'?'✓':'✗'}</span>
                                <span style={{fontFamily:'var(--m)',fontSize:8.5,color:a.status==='error'?'#8a2828':'#3a5c47',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</span>
                                <button onClick={()=>setReevalAttachments(prev=>prev.filter(x=>x.id!==a.id))} style={{background:'none',border:'none',cursor:'pointer',fontSize:9,color:'#7aaa8a',padding:'0 2px',lineHeight:1}}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {reevalResult&&!reevalResult.error&&!reevalResult.skipped&&(
                          <div style={{padding:'7px 9px',background:'rgba(26,90,60,.06)',border:'1px solid rgba(26,90,60,.15)',borderRadius:6,fontFamily:'var(--m)',fontSize:9.5,color:'#3a5c47',lineHeight:1.5,marginTop:6}}>
                            <strong style={{color:'#1a5a3c'}}>Tier {reevalResult.tier} — {reevalResult.catalog_row?.emoji} {reevalResult.catalog_row?.name}</strong><br/>{reevalResult.reason}
                          </div>
                        )}
                        {reevalResult?.error&&<div style={{fontFamily:'var(--m)',fontSize:9,color:'#8a2828',marginTop:5}}>{reevalResult.error}</div>}
                        <div style={{display:'flex',gap:6,marginTop:7}}>
                          <button onClick={runReeval} disabled={reevalLoading} style={{flex:1,padding:'5px 0',borderRadius:6,border:'1px solid rgba(26,90,60,.25)',background:'rgba(26,90,60,.08)',color:'#1a5a3c',fontFamily:'var(--m)',fontSize:9.5,fontWeight:500,cursor:'pointer',opacity:reevalLoading?.6:1}}>{reevalLoading?'Evaluating…':'Re-evaluate tier'}</button>
                          <button onClick={()=>{setReevalOpen(false);setReevalCtx('');setReevalResult(null);setReevalAttachments([])}} style={{padding:'5px 10px',borderRadius:6,border:'1px solid rgba(0,0,0,.1)',background:'none',color:'#7aaa8a',fontFamily:'var(--m)',fontSize:9.5,cursor:'pointer'}}>Cancel</button>
                        </div>
                        <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(0,0,0,.07)'}}>
                          <div style={{fontFamily:'var(--m)',fontSize:8.5,color:'#7aaa8a',marginBottom:5}}>Rebuild tree from career outline</div>
                          <button onClick={runSeed} disabled={seedLoading} style={{width:'100%',padding:'5px 0',borderRadius:6,border:'1px solid rgba(0,0,0,.08)',background:'#fff',color:'#3a5c47',fontFamily:'var(--m)',fontSize:9,cursor:'pointer',opacity:seedLoading?.6:1}}>{seedLoading?'Re-seeding…':'↺ Re-seed branches, roots & relationships'}</button>
                          {seedResult&&<div style={{marginTop:5,fontFamily:'var(--m)',fontSize:8,color:seedResult.ok?'#3a7d44':'#b94a3a',lineHeight:1.4}}>{seedResult.msg}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Granularity footer */}
                  <div style={{padding:'10px 14px 10px',background:'rgba(245,244,240,.98)',borderTop:'1px solid rgba(0,0,0,.07)'}}>
                    <div style={{display:'flex',gap:5}}>
                      {['year','month','week'].map(g=>(
                        <button key={g} onClick={()=>setTreeGran(g)} style={{flex:1,padding:'5px 0',borderRadius:6,border:`1px solid ${treeGran===g?'rgba(26,90,60,.25)':'rgba(0,0,0,.1)'}`,background:treeGran===g?'rgba(26,90,60,.07)':'#fff',fontFamily:'var(--m)',fontSize:9.5,color:treeGran===g?'#1a5a3c':'#7aaa8a',cursor:'pointer',textTransform:'capitalize',fontWeight:treeGran===g?600:400}}>{g}</button>
                      ))}
                    </div>
                    <div style={{fontFamily:'Instrument Serif,Georgia,serif',fontSize:9,fontStyle:'italic',color:'#9aaa8a',marginTop:7,textAlign:'center'}}>🌱 roots & legacy below ground</div>
                  </div>
                </div>
              )
            })()}
          </div>
          :<><div className="scroll">
          {/* HOME */}
          {view==='home'&&<>
            {/* Sunday weekly brief */}
            {isSunday&&weeklyBrief&&(
              <div style={{padding:'10px 14px',background:'var(--glass2)',backdropFilter:'blur(14px)',border:'1px solid var(--gb2)',borderRadius:'var(--r2)',fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)',lineHeight:1.7}}>
                <div style={{color:'var(--acc2)',fontWeight:500,marginBottom:4}}>📊 Weekly review</div>
                <div>{weeklyBrief.message||weeklyBrief.headline}</div>
                {weeklyBrief.on_pace!==undefined&&<div style={{marginTop:4,color:weeklyBrief.on_pace?'var(--ok)':'var(--warn)'}}>{weeklyBrief.on_pace?'✓ On pace for goal':'⚠ Falling behind — adjust this week'}</div>}
              </div>
            )}
            <MatrixCanvas tasks={tasks.filter(t=>t.status!=='wont_do')} onToggle={toggleTask}/>
            <div className="card">
              <div className="card-hdr"><span className="card-title">Task list</span><span style={{fontFamily:'var(--m)',fontSize:'8.5px',color:'var(--txt3)'}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</span></div>
              <div style={{padding:'3px 3px 2px'}}>
                {[...tasks].filter(t=>t.status!=='wont_do').sort((a,b)=>({do:0,schedule:1,delegate:2,eliminate:3}[a.q]-{do:0,schedule:1,delegate:2,eliminate:3}[b.q])||(a.done-b.done)).map(t=>(
                  <div key={t.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 9px',borderRadius:'var(--r)',opacity:t.done?.42:1}}>
                    <div onClick={()=>t.status!=='proposed'&&toggleTask(t.id)} style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${t.done?'var(--del)':'var(--txt3)'}`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'#fff',fontWeight:700,background:t.done?'var(--del)':'transparent',cursor:t.status==='proposed'?'default':'pointer'}}>{t.done?'✓':''}</div>
                    <div onClick={()=>t.status!=='proposed'&&toggleTask(t.id)} style={{flex:1,fontSize:12.5,color:t.status==='proposed'?'var(--txt3)':'var(--txt)',minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',textDecoration:t.done?'line-through':'none',cursor:t.status==='proposed'?'default':'pointer'}}>{t.name}{t.status==='proposed'&&<span style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)',marginLeft:4}}>(proposed)</span>}</div>
                    <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
                      {t.status==='proposed'
                        ?<><button onClick={()=>confirmTask(t.id)} style={{fontFamily:'var(--m)',fontSize:8.5,padding:'2px 6px',borderRadius:3,border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',cursor:'pointer'}}>✓ Confirm</button><button onClick={()=>wontDoTask(t.id)} style={{fontFamily:'var(--m)',fontSize:8.5,padding:'2px 6px',borderRadius:3,border:'1px solid rgba(138,40,40,.2)',background:'rgba(138,40,40,.07)',color:'#8a2828',cursor:'pointer'}}>✗</button></>
                        :<><span className={`pill pq-${t.q}`}>{t.q}</span><span className={`pill pc-${t.cat}`}>{t.cat}</span><span style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)'}}>{t.blocks}×</span></>
                      }
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:5,padding:'8px 9px',borderTop:'1px solid var(--gb2)'}}>
                <input value={qaName} onChange={e=>setQaName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&qaName){addTask({name:qaName,q:qaQ,cat:qaCat,blocks:qaB,who:'me',notes:''});setQaName('')}}} placeholder="Quick add task…" style={{flex:1,background:'transparent',border:'none',outline:'none',color:'var(--txt)',fontSize:12.5,fontFamily:'var(--f)',minWidth:0}}/>
                <select value={qaQ} onChange={e=>setQaQ(e.target.value)} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'9px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}><option value="do">Do</option><option value="schedule">Sched</option><option value="delegate">Delg</option><option value="eliminate">Elim</option></select>
                <select value={qaCat} onChange={e=>setQaCat(e.target.value)} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'9px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}>{['career','interview','learning','fitness','family','admin','finance'].map(c=><option key={c} value={c}>{c}</option>)}</select>
                <select value={qaB} onChange={e=>setQaB(parseInt(e.target.value))} style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt2)',fontSize:'9px',padding:'4px 4px',outline:'none',fontFamily:'var(--m)'}}>{[1,2,3,4,6,8].map(b=><option key={b} value={b}>{b}×</option>)}</select>
                <button className="btn-primary" style={{fontSize:10.5,padding:'4px 9px'}} onClick={()=>{if(qaName){addTask({name:qaName,q:qaQ,cat:qaCat,blocks:qaB,who:'me',notes:''});setQaName('')}}}>Add</button>
              </div>
            </div>
          </>}

          {/* SCHEDULE */}
          {view==='schedule'&&<>
            {schedLoading&&<div className="card" style={{padding:'22px 16px',display:'flex',alignItems:'center',gap:10,color:'var(--txt3)',fontFamily:'var(--m)',fontSize:11}}><div style={{width:16,height:16,border:'2px solid rgba(122,170,138,0.3)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .7s linear infinite',flexShrink:0}}/>COO reading Calendar{oura?.connected?' + Oura Ring':''} + Gmail and building your day…</div>}
            {schedError&&!schedLoading&&<div style={{padding:'10px 12px',background:'rgba(138,40,40,.06)',border:'1px solid rgba(138,40,40,.18)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:14}}>⚠</span><span style={{flex:1,fontSize:11.5,color:'#8a2828',fontFamily:'var(--m)'}}>{schedError}</span><button onClick={generateSchedule} style={{background:'transparent',border:'1px solid rgba(138,40,40,.3)',borderRadius:5,padding:'4px 10px',cursor:'pointer',fontSize:10.5,color:'#8a2828',fontFamily:'var(--m)'}}>Retry</button></div>}
            {!schedLoading&&!schedule&&!schedError&&<div className="card" style={{padding:'24px 16px',textAlign:'center'}}><div style={{fontFamily:'var(--s)',fontSize:18,fontStyle:'italic',color:'var(--txt2)',marginBottom:8}}>No schedule yet</div><p style={{fontSize:12,color:'var(--txt3)',marginBottom:16,lineHeight:1.6}}>COO will read your Calendar{oura?.connected?', Oura readiness,':''} and Gmail then build your day in 15-min blocks.</p><button className="btn-primary" onClick={generateSchedule}>Build my day →</button></div>}
            {!schedLoading&&schedule&&<>
              {oura?.connected&&oura?.data?.readiness&&(
                <div style={{padding:'9px 13px',background:'rgba(15,110,86,0.07)',border:'1px solid rgba(15,110,86,0.18)',borderRadius:'var(--r2)',display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:16}}>💍</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'var(--m)',fontSize:10,color:'var(--del)',fontWeight:500}}>Oura readiness: {oura.data.readiness.score}/100 · Sleep: {oura.data.sleep?.score||'—'}/100</div>
                    <div style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt3)',marginTop:2}}>{oura.data.readiness.energy_note}</div>
                  </div>
                </div>
              )}
              {schedule.coo_message&&<div style={{padding:'10px 14px',background:'var(--glass2)',backdropFilter:'blur(14px)',border:'1px solid var(--gb2)',borderRadius:'var(--r2)',fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)',lineHeight:1.7}}><span style={{color:'var(--acc2)',fontWeight:500}}>COO · </span>{schedule.coo_message}</div>}
              {schedule.top_3_mits?.length>0&&<div className="card"><div className="card-hdr"><span className="card-title">Top 3 MITs{schedule.date&&schedule.date!==new Date().toISOString().slice(0,10)?' · tomorrow':' · today'}</span></div><div style={{padding:'8px 13px 12px',display:'flex',flexDirection:'column',gap:5}}>{schedule.top_3_mits.map((m,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--txt)'}}><span style={{fontFamily:'var(--m)',fontSize:9,background:'var(--do-bg)',color:'var(--do)',padding:'2px 6px',borderRadius:3}}>{i+1}</span>{m}</div>)}</div></div>}
              <div className="card">
                <div className="card-hdr">
                  <div><span className="card-title">{schedule.date&&schedule.date!==new Date().toISOString().slice(0,10)?'Tomorrow\'s plan':'Proposed day'}</span>{schedule.date&&schedule.date!==new Date().toISOString().slice(0,10)&&<span style={{fontFamily:'var(--m)',fontSize:8,color:'var(--txt3)',marginLeft:6}}>{new Date(schedule.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}</span>}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}><span style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt3)'}}>{schedule.slots?.filter(s=>s.state==='accepted').length||0}/{schedule.slots?.filter(s=>s.taskId).length||0} accepted</span>{pendingSlots>0&&<button className="btn-primary" style={{fontSize:10,padding:'3px 9px'}} onClick={acceptAll}>Accept all</button>}</div>
                </div>
                <div style={{padding:'10px 13px 14px',display:'flex',flexDirection:'column',gap:3}}>
                  {(schedule.slots||[]).map((slot,idx)=>{
                    const isTonight=slot.type==='optional_tonight'
                    const qv=slot.quadrant==='schedule'?'sch':slot.quadrant==='eliminate'?'eli':slot.quadrant
                    let bg='rgba(255,255,255,.3)',bd='var(--gb2)'
                    if(isTonight){bg='rgba(90,72,140,.07)';bd='rgba(90,72,140,.22)'}
                    else if(slot.type==='break'||slot.type==='lunch'){bg='rgba(122,170,138,.07)';bd='var(--eli-bd)'}
                    else if(slot.quadrant){bg=`var(--${qv}-bg)`;bd=`var(--${qv}-bd)`}
                    return(
                      <div key={idx}>
                        {isTonight&&<div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 0 4px',fontFamily:'var(--m)',fontSize:9,color:'rgba(90,72,140,.8)',letterSpacing:'.08em'}}>🌙 optional tonight — light tasks only, not required</div>}
                        <div style={{display:'flex',alignItems:'stretch',gap:8,minHeight:36}}>
                          <div style={{fontFamily:'var(--m)',fontSize:'9.5px',color:'var(--txt3)',width:42,flexShrink:0,paddingTop:9,textAlign:'right'}}>{slot.time}</div>
                          <div style={{width:1,background:'var(--gb2)',flexShrink:0,position:'relative'}}><div style={{position:'absolute',top:10,left:-3,width:7,height:7,borderRadius:'50%',background:isTonight?'rgba(90,72,140,.3)':'var(--gb2)'}}/></div>
                          <div style={{flex:1,borderRadius:'var(--r)',padding:'7px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,background:bg,border:`1px solid ${bd}`,opacity:slot.state==='vetoed'?.38:1}}>
                            <div>
                              <div style={{fontSize:12,color:'var(--txt)',textDecoration:slot.state==='vetoed'?'line-through':'none'}}>{slot.label}</div>
                              {slot.note&&<div style={{fontSize:9.5,color:'var(--txt3)',fontFamily:'var(--m)',marginTop:2}}>{slot.note}</div>}
                              {slot.blocks&&<div style={{fontSize:9,color:'var(--txt3)',fontFamily:'var(--m)',marginTop:1}}>{slot.blocks*15}min</div>}
                            </div>
                            <div style={{display:'flex',gap:4,flexShrink:0}}>
                              {(slot.state==='pending'||slot.state==='optional')&&<><button onClick={()=>acceptSlot(idx)} style={{padding:'3px 7px',borderRadius:4,fontSize:9.5,cursor:'pointer',border:'1px solid rgba(15,110,86,.3)',background:'rgba(15,110,86,.1)',color:'var(--ok)',fontFamily:'var(--m)',fontWeight:500}}>✓</button><button onClick={()=>vetoSlot(idx)} style={{padding:'3px 7px',borderRadius:4,fontSize:9.5,cursor:'pointer',border:'1px solid rgba(184,92,0,.25)',background:'rgba(184,92,0,.08)',color:'var(--do)',fontFamily:'var(--m)',fontWeight:500}}>✗</button></>}
                              {slot.state==='accepted'&&<span style={{fontFamily:'var(--m)',fontSize:9,color:'var(--ok)',padding:'3px 6px'}}>✓</span>}
                              {slot.state==='vetoed'&&<span style={{fontFamily:'var(--m)',fontSize:9,color:'var(--warn)',padding:'3px 6px'}}>vetoed</span>}
                            </div>
                          </div>
                        </div>
                        {slot.impact&&slot.state==='vetoed'&&<div style={{display:'flex',gap:8,marginTop:3}}><div style={{width:50,flexShrink:0}}/><div style={{flex:1,padding:'6px 10px',background:'rgba(184,92,0,.06)',border:'1px solid rgba(184,92,0,.18)',borderRadius:6,fontSize:10.5,color:'var(--warn)',fontFamily:'var(--m)',lineHeight:1.5,marginLeft:8}}>{slot.impact}{slot.suggestion&&<><br/><span style={{color:'var(--txt3)'}}>→ {slot.suggestion}</span></>}</div></div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>}
          </>}

          {/* AGENTS */}
          {view==='agents'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:10}}>
            {agents.map(a=>{
              const col=CAT_COLORS[a.area]||'#3d7a52'
              const sc={idle:'#b0ccb8',thinking:'#b85c00',alert:'#8a2828',ok:'#0f6e56'}[a.status||'idle']
              return(
                <div key={a.id} className="card">
                  <div style={{padding:'12px 13px 10px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',borderBottom:'1px solid var(--gb2)'}}>
                    <div style={{width:34,height:34,borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0,background:`${col}14`,border:`1px solid ${col}28`}}>{a.icon}</div>
                    <div style={{flex:1,paddingLeft:9}}>
                      <div style={{fontSize:13,fontWeight:500,color:'var(--txt)'}}>{a.name}</div>
                      <div style={{fontSize:9,color:'var(--txt3)',fontFamily:'var(--m)',textTransform:'uppercase',letterSpacing:'.07em',marginTop:2}}>{a.area}</div>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginTop:4}}><div style={{width:6,height:6,borderRadius:'50%',background:sc}}/><span style={{fontSize:9,color:'var(--txt3)',fontFamily:'var(--m)'}}>{a.status||'idle'}</span></div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1}}><PerfRing score={a.score||50} color={col}/><span style={{fontFamily:'var(--m)',fontSize:'7.5px',color:'var(--txt3)'}}>score</span></div>
                  </div>
                  {a.alert&&<div style={{margin:'8px 11px 0',padding:'7px 10px',borderRadius:'var(--r)',border:'1px solid rgba(184,92,0,.2)',background:'rgba(184,92,0,.06)',fontSize:10.5,color:'var(--warn)',fontFamily:'var(--m)',lineHeight:1.5}}>{a.alert}</div>}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',borderBottom:'1px solid var(--gb2)'}}>
                    {[['Runs',a.runs||0,null],['Streak',a.streak||0,col],['Score',a.score||50,null]].map(([l,v,c])=>(
                      <div key={l} style={{padding:'8px 9px',textAlign:'center',borderRight:'1px solid var(--gb2)'}}>
                        <div style={{fontFamily:'var(--m)',fontSize:13,fontWeight:500,color:c||'var(--txt)'}}>{v}</div>
                        <div style={{fontSize:8,color:'var(--txt3)',marginTop:2,textTransform:'uppercase',letterSpacing:'.06em'}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:5,padding:'9px 11px'}}>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:10.5,color:'var(--acc2)',borderColor:'rgba(45,122,82,.3)'}} onClick={()=>runAgent(a.id)} disabled={a.status==='thinking'}>{a.status==='thinking'?'…':'▶ Run'}</button>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:10.5}} onClick={()=>{setTuning(tuning===a.id?null:a.id);setPromptDraft(a.custom_prompt||a.prompt)}}>Tune</button>
                    <button className="btn-ghost" style={{flex:1,padding:6,fontSize:10.5}} onClick={()=>rateAgent(a.id)}>Rate ↑</button>
                  </div>
                  {a.output&&<div style={{margin:'0 11px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'9px 10px',fontSize:11,fontFamily:'var(--m)',color:'var(--txt2)',lineHeight:1.7,whiteSpace:'pre-wrap',maxHeight:160,overflowY:'auto'}}>{a.output}</div>}
                  {tuning===a.id&&<div style={{margin:'0 11px 11px',background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'9px 10px'}}>
                    <div style={{fontSize:8,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--txt3)',fontFamily:'var(--m)',marginBottom:4}}>System prompt</div>
                    <textarea value={promptDraft} onChange={e=>setPromptDraft(e.target.value)} rows={4} style={{width:'100%',background:'rgba(255,255,255,.65)',border:'1px solid var(--gb2)',borderRadius:5,color:'var(--txt)',fontSize:10.5,padding:'6px 8px',fontFamily:'var(--m)',resize:'vertical',outline:'none',lineHeight:1.5}}/>
                    <div style={{display:'flex',gap:6,marginTop:6}}>
                      <button className="btn-primary" style={{fontSize:10.5,padding:'4px 12px'}} onClick={async()=>{await api.agents.update(a.id,{custom_prompt:promptDraft});setAgents(as=>as.map(x=>x.id===a.id?{...x,custom_prompt:promptDraft}:x));setTuning(null)}}>Save</button>
                      <button className="btn-ghost" style={{fontSize:10.5,padding:'4px 10px'}} onClick={()=>setTuning(null)}>Cancel</button>
                    </div>
                  </div>}
                </div>
              )
            })}
            <div className="card" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:120,cursor:'pointer',border:'1px dashed var(--gb2)',background:'var(--glass2)'}} onClick={()=>setShowAddAgent(true)}>
              <div style={{textAlign:'center',color:'var(--txt3)'}}><div style={{fontSize:22}}>+</div><div style={{fontSize:11,fontFamily:'var(--m)'}}>Add agent</div></div>
            </div>
          </div>}

          {/* LOG */}
          {view==='log'&&<>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
              {[[doneTasks.length,'Tasks done',`of ${tasks.length}`,null],[Math.round(doneTasks.reduce((s,t)=>s+t.blocks*15,0)),'Min invested',`${tasks.reduce((s,t)=>s+t.blocks*15,0)} budgeted`,'var(--do)'],[tasks.filter(t=>t.who!=='me').length,'Delegated','off-loaded','var(--del)'],[tasks.filter(t=>t.status==='wont_do').length,"Won't do",'dismissed','var(--warn)'],[schedule?.slots?.filter(s=>s.state==='accepted').length||0,'Blocks accepted','COO plan','var(--acc)']].map(([n,l,s,c])=>(
                <div key={l} className="card" style={{padding:'12px 13px'}}><div style={{fontFamily:'var(--m)',fontSize:22,fontWeight:500,color:c||'var(--txt)',lineHeight:1}}>{n}</div><div style={{fontSize:9,color:'var(--txt3)',marginTop:4,textTransform:'uppercase',letterSpacing:'.07em'}}>{l}</div><div style={{fontFamily:'var(--m)',fontSize:9,color:'var(--txt3)',marginTop:2}}>{s}</div></div>
              ))}
            </div>
            <div className="card"><div className="card-hdr"><span className="card-title">All tasks · today</span></div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr>{['Task','Q','Cat','Blocks','Who','Status'].map(h=><th key={h} style={{fontFamily:'var(--m)',fontSize:8.5,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--txt3)',padding:'6px 11px',textAlign:'left',borderBottom:'1px solid var(--gb2)',fontWeight:400}}>{h}</th>)}</tr></thead>
                  <tbody>{[...tasks].filter(t=>t.status!=='wont_do').sort((a,b)=>({do:0,schedule:1,delegate:2,eliminate:3}[a.q]-{do:0,schedule:1,delegate:2,eliminate:3}[b.q])).map(t=>(
                    <tr key={t.id}><td style={{padding:'7px 11px',color:'var(--txt)'}}>{t.name}</td><td style={{padding:'7px 11px'}}><span className={`pill pq-${t.q}`}>{t.q}</span></td><td style={{padding:'7px 11px'}}><span className={`pill pc-${t.cat}`}>{t.cat}</span></td><td style={{padding:'7px 11px',fontFamily:'var(--m)',color:'var(--txt2)'}}>{t.blocks}×15m</td><td style={{padding:'7px 11px'}}><span style={{fontFamily:'var(--m)',fontSize:8.5,padding:'2px 6px',borderRadius:3,fontWeight:500,background:t.who==='me'?'rgba(45,122,82,.1)':t.who==='team'?'rgba(26,95,168,.09)':'rgba(184,92,0,.09)',color:t.who==='me'?'#1a5a3c':t.who==='team'?'#144a85':'#8a4400'}}>{t.who}</span></td><td style={{padding:'7px 11px',fontFamily:'var(--m)',fontSize:10.5,color:t.done?'var(--ok)':'var(--txt3)'}}>{t.done?'done':'open'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>}

          {view==='settings'&&<SettingsPanel/>}

        </div>
        {/* CHAT BAR */}
        <div style={{flexShrink:0,borderTop:'1px solid var(--gb2)',background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',padding:'6px 10px',display:'flex',flexDirection:'column',gap:5}}>
          {chatVisible&&chatHistory.length>0&&(
            <div style={{maxHeight:140,overflowY:'auto',display:'flex',flexDirection:'column',gap:3,paddingBottom:2}}>
              {chatHistory.slice(-8).map((m,i)=>(
                <div key={i} style={{fontFamily:'var(--m)',fontSize:11,color:m.role==='coo'?'var(--acc2)':'var(--txt)',lineHeight:1.5,padding:'3px 8px',borderRadius:5,background:m.role==='coo'?'var(--glass2)':'transparent'}}>{m.role==='coo'?'COO · ':''}{m.content}</div>
              ))}
              {chatLoading&&<div style={{fontFamily:'var(--m)',fontSize:11,color:'var(--txt3)',padding:'3px 8px'}}>COO thinking…</div>}
            </div>
          )}
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button onClick={()=>setChatVisible(v=>!v)} style={{padding:'0 7px',height:32,borderRadius:6,border:'1px solid var(--gb2)',background:'var(--glass2)',color:'var(--txt3)',fontSize:11,cursor:'pointer',flexShrink:0}}>{chatVisible?'▾':'▸'}</button>
            <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&(e.preventDefault(),sendChat())} placeholder="Ask COO anything…" style={{flex:1,background:'transparent',border:'1px solid var(--gb2)',borderRadius:6,padding:'6px 10px',outline:'none',color:'var(--txt)',fontSize:12.5,fontFamily:'var(--f)'}}/>
            <button onClick={isRecording?stopRecording:startRecording} title={isRecording?'Stop recording':'Voice input'} style={{width:32,height:32,borderRadius:'50%',border:`1px solid ${isRecording?'rgba(138,40,40,.4)':'var(--gb2)'}`,background:isRecording?'rgba(138,40,40,.12)':'var(--glass2)',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,animation:isRecording?'blink 1s infinite':'none'}}>{isRecording?'⏹':'🎙'}</button>
            <button onClick={sendChat} disabled={chatLoading||!chatMsg.trim()} style={{width:32,height:32,borderRadius:'50%',border:'none',background:chatLoading||!chatMsg.trim()?'var(--gb2)':'#1a5a3c',color:'#fff',cursor:chatLoading||!chatMsg.trim()?'default':'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background .15s'}}>↑</button>
          </div>
        </div>
      </>}
      </div>

      {/* MOBILE BOTTOM NAV */}
      <div style={{display:'none',position:'fixed',bottom:0,left:0,right:0,background:'var(--glass)',backdropFilter:'blur(22px)',WebkitBackdropFilter:'blur(22px)',borderTop:'1px solid var(--gb)',padding:'8px 0 env(safe-area-inset-bottom,10px)',zIndex:200,flexDirection:'row'}} id="mob-nav">
        {navItems.map(({icon,label,id,badge,bc})=>(
          <button key={id} onClick={()=>{setView(id);if(id==='schedule'&&!schedule)generateSchedule();if(id==='tree'&&!treeData)loadTree()}} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',border:'none',background:'transparent',color:view===id?'var(--acc2)':'var(--txt3)',fontSize:9,fontFamily:'var(--f)',padding:'3px 0',position:'relative'}}>
            <span style={{fontSize:17,lineHeight:1}}>{icon}</span><span>{label}</span>
            {badge>0&&<span style={{position:'absolute',top:0,right:'18%',width:8,height:8,borderRadius:'50%',background:bc}}/>}
          </button>
        ))}
      </div>
    </div>

    {/* CHECK-IN */}
    {checkin&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&(setCheckin(null),setCheckinResult(null))}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px',boxShadow:'0 22px 55px rgba(20,60,35,.22)'}}>
        <div style={{fontFamily:'var(--s)',fontSize:18,fontStyle:'italic',color:'var(--txt)',marginBottom:12}}>{checkin==='evening'?'Evening retro':'Check-in'}</div>
        {!checkinResult?<>
          <p style={{fontSize:12,color:'var(--txt2)',marginBottom:12,lineHeight:1.6}}>{checkin==='midday'?"How's it going? Any blockers?":checkin==='afternoon'?"Afternoon check — what got done?":"Day wrapping up — quick retro?"}</p>
          <textarea className="fm-in" value={checkinMsg} onChange={e=>setCheckinMsg(e.target.value)} rows={3} placeholder="Optional — a few words is fine…" style={{resize:'none',width:'100%'}}/>
          <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
            <button className="mb-cancel" onClick={()=>setCheckin(null)}>Skip</button>
            <button className="mb-save" onClick={submitCheckin} disabled={checkinLoading}>{checkinLoading?'…':'Send to COO'}</button>
          </div>
        </>:<>
          <div style={{background:'var(--glass2)',border:'1px solid var(--gb2)',borderRadius:'var(--r)',padding:'10px 12px',fontFamily:'var(--m)',fontSize:11,color:'var(--txt2)',lineHeight:1.7,whiteSpace:'pre-wrap',marginBottom:12}}>{checkinResult.message||checkinResult.headline||''}</div>
          {checkinResult.next_action&&<div style={{fontSize:12,color:'var(--acc2)',fontWeight:500,marginBottom:12}}>→ {checkinResult.next_action}</div>}
          {checkinResult.adhd_flag&&<div style={{fontSize:11,color:'var(--warn)',fontFamily:'var(--m)',marginBottom:12}}>⚠ {checkinResult.adhd_flag}</div>}
          <div style={{display:'flex',justifyContent:'flex-end'}}><button className="mb-save" onClick={()=>{setCheckin(null);setCheckinResult(null)}}>Got it</button></div>
        </>}
      </div>
    </div>}

    {/* ADD TASK */}
    {showAddTask&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&setShowAddTask(false)}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px'}}>
        <div style={{fontFamily:'var(--s)',fontSize:18,fontStyle:'italic',color:'var(--txt)',marginBottom:14}}>New task</div>
        <div className="fm-g"><label className="fm-l">Name</label><input className="fm-in" value={taskForm.name} onChange={e=>setTaskForm(f=>({...f,name:e.target.value}))} placeholder="What needs doing?" onKeyDown={e=>e.key==='Enter'&&taskForm.name&&addTask(taskForm)}/></div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">Quadrant</label><select className="fm-sel" value={taskForm.q} onChange={e=>setTaskForm(f=>({...f,q:e.target.value}))}><option value="do">Do — urgent + important</option><option value="schedule">Schedule — important</option><option value="delegate">Delegate — urgent</option><option value="eliminate">Eliminate</option></select></div>
          <div className="fm-g"><label className="fm-l">Blocks</label><input className="fm-in" type="number" min={1} max={16} value={taskForm.blocks} onChange={e=>setTaskForm(f=>({...f,blocks:parseInt(e.target.value)||2}))}/></div>
        </div>
        <div className="fm-row">
          <div className="fm-g"><label className="fm-l">Category</label><select className="fm-sel" value={taskForm.cat} onChange={e=>setTaskForm(f=>({...f,cat:e.target.value}))}>{['career','interview','learning','fitness','family','admin','finance'].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="fm-g"><label className="fm-l">Who</label><select className="fm-sel" value={taskForm.who} onChange={e=>setTaskForm(f=>({...f,who:e.target.value}))}><option value="me">Me</option><option value="team">Team</option><option value="delegated">Delegated</option></select></div>
        </div>
        <div className="fm-g"><label className="fm-l">Notes</label><input className="fm-in" value={taskForm.notes} onChange={e=>setTaskForm(f=>({...f,notes:e.target.value}))} placeholder="Context, link, next action…"/></div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:14}}>
          <button className="mb-cancel" onClick={()=>setShowAddTask(false)}>Cancel</button>
          <button className="mb-save" onClick={()=>taskForm.name&&addTask(taskForm)}>Add task</button>
        </div>
      </div>
    </div>}

    {/* ADD AGENT */}
    {showAddAgent&&<div style={{position:'fixed',inset:0,background:'rgba(10,28,18,.48)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:14}} onClick={e=>e.target===e.currentTarget&&setShowAddAgent(false)}>
      <div style={{background:'rgba(255,255,255,.93)',backdropFilter:'blur(26px)',border:'1px solid rgba(255,255,255,.88)',borderRadius:20,width:'100%',maxWidth:360,padding:'18px 18px 14px'}}>
        <div style={{fontFamily:'var(--s)',fontSize:18,fontStyle:'italic',color:'var(--txt)',marginBottom:14}}>New agent</div>
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

    <style>{`
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:680px){nav{display:none!important}#mob-nav{display:flex!important}.scroll{padding:11px 11px!important}}
    `}</style>
    </>
  )
}
