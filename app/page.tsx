"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";

type RGB = [number, number, number];
type Pattern = { width: number; height: number; pixels: number[]; palette: RGB[]; counts: number[] };

const DEMO_COLORS: RGB[] = [[247,241,225],[31,39,51],[233,92,80],[246,177,75],[105,176,139],[90,135,191]];

function distance(a: RGB, b: RGB) {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

function quantize(data: Uint8ClampedArray, count: number): { indexes: number[]; palette: RGB[]; counts: number[] } {
  const samples: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) samples.push([data[i], data[i+1], data[i+2]]);
  const palette: RGB[] = [];
  for (let k = 0; k < count; k++) {
    const s = samples[Math.floor((k + .5) * samples.length / count)] || samples[0];
    palette.push([...s]);
  }
  for (let pass = 0; pass < 7; pass++) {
    const sums = palette.map(() => [0,0,0,0]);
    for (const px of samples) {
      let best = 0, bestD = Infinity;
      palette.forEach((c, i) => { const d = distance(px,c); if (d < bestD) { bestD=d; best=i; } });
      sums[best][0]+=px[0]; sums[best][1]+=px[1]; sums[best][2]+=px[2]; sums[best][3]++;
    }
    sums.forEach((s,i) => { if (s[3]) palette[i] = [Math.round(s[0]/s[3]),Math.round(s[1]/s[3]),Math.round(s[2]/s[3])]; });
  }
  const counts = palette.map(() => 0);
  const indexes = samples.map(px => {
    let best=0, bestD=Infinity;
    palette.forEach((c,i) => { const d=distance(px,c); if(d<bestD){bestD=d;best=i;} });
    counts[best]++; return best;
  });
  return { indexes, palette, counts };
}

function demoPattern(): Pattern {
  const w=24,h=24,pixels:number[]=[];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const dx=x-11.5, dy=y-11.5;
    let c=0;
    if(dx*dx+dy*dy<92)c=4;
    if((x>6&&x<17&&y>8&&y<18))c=2;
    if((x===8||x===15)&&y>9&&y<13)c=1;
    if(y===15&&x>9&&x<14)c=1;
    if((x<5&&y<5)||(x>18&&y>18))c=5;
    if((x+y)%13===0)c=3;
    pixels.push(c);
  }
  const counts=DEMO_COLORS.map((_,i)=>pixels.filter(p=>p===i).length);
  return {width:w,height:h,pixels,palette:DEMO_COLORS,counts};
}

function PatternCanvas({pattern, grid=true, labels=false, exportRef}:{pattern:Pattern;grid?:boolean;labels?:boolean;exportRef?:React.RefObject<HTMLCanvasElement | null>}) {
  const ownRef=useRef<HTMLCanvasElement>(null);
  const ref=exportRef || ownRef;
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const cell=Math.max(8, Math.min(24, Math.floor(720/pattern.width)));
    canvas.width=pattern.width*cell;canvas.height=pattern.height*cell;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    pattern.pixels.forEach((pi,n)=>{
      const x=n%pattern.width,y=Math.floor(n/pattern.width),c=pattern.palette[pi];
      ctx.fillStyle=`rgb(${c.join(",")})`;ctx.fillRect(x*cell,y*cell,cell,cell);
      if(grid){ctx.strokeStyle="rgba(24,32,39,.18)";ctx.lineWidth=1;ctx.strokeRect(x*cell+.5,y*cell+.5,cell-1,cell-1)}
      if(labels&&cell>=14){ctx.fillStyle=(c[0]+c[1]+c[2])>390?"#273039":"#fff";ctx.font=`600 ${Math.max(8,cell*.42)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(pi+1),x*cell+cell/2,y*cell+cell/2)}
    });
  },[pattern,grid,labels,ref]);
  return <canvas ref={ref} className="pattern-canvas" aria-label="拼豆图纸预览"/>;
}

export default function Home() {
  const [pattern,setPattern]=useState<Pattern>(()=>demoPattern());
  const [fileName,setFileName]=useState("");
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const [beads,setBeads]=useState(36);
  const [colors,setColors]=useState(12);
  const [grid,setGrid]=useState(true);
  const [labels,setLabels]=useState(false);
  const [busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const exportRef=useRef<HTMLCanvasElement>(null);

  const createPattern=useCallback((img:HTMLImageElement,w:number,colorCount:number)=>{
    setBusy(true);
    requestAnimationFrame(()=>{
      const h=Math.max(8,Math.round(w*img.naturalHeight/img.naturalWidth));
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;
      ctx.imageSmoothingEnabled=true;ctx.drawImage(img,0,0,w,h);
      const {data}=ctx.getImageData(0,0,w,h);
      const q=quantize(data,colorCount);
      setPattern({width:w,height:h,pixels:q.indexes,palette:q.palette,counts:q.counts});setBusy(false);
    });
  },[]);

  useEffect(()=>{if(image)createPattern(image,beads,colors)},[image,beads,colors,createPattern]);

  function loadFile(file?:File){
    if(!file||!file.type.startsWith("image/"))return;
    setFileName(file.name);
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{setImage(img);URL.revokeObjectURL(url)};img.src=url;
  }
  function onDrop(e:DragEvent){e.preventDefault();loadFile(e.dataTransfer.files[0]);}
  function onFile(e:ChangeEvent<HTMLInputElement>){loadFile(e.target.files?.[0]);}
  function download(){const c=exportRef.current;if(!c)return;const a=document.createElement("a");a.download=`${fileName.replace(/\.[^.]+$/,"")||"拼豆图纸"}.png`;a.href=c.toDataURL("image/png");a.click();}

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="豆格首页"><span className="brand-mark"><i></i><i></i><i></i><i></i></span><span>豆格 <b>BEADGRID</b></span></a>
      <span className="privacy"><span></span> 图片仅在你的浏览器中处理</span>
    </header>

    <section className="hero" id="top">
      <div className="eyebrow">PERLER PATTERN MAKER · 免费在线工具</div>
      <h1>一张图片，<br/><em>变成一格一格的快乐。</em></h1>
      <p>上传照片，自动提取配色并生成清晰的拼豆图纸。<br/>无需登录，没有水印，处理完成即可下载。</p>
      <div className="steps"><span><b>01</b> 上传图片</span><span>→</span><span><b>02</b> 调整图纸</span><span>→</span><span><b>03</b> 下载开拼</span></div>
    </section>

    <section className="workspace">
      <aside className="panel controls">
        <div className="panel-title"><span>01</span><div><b>选择图片</b><small>JPG、PNG 或 WEBP</small></div></div>
        <button className="dropzone" onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile}/>
          <span className="upload-icon">↥</span><strong>{fileName||"点击或拖拽图片到这里"}</strong><small>{fileName?"点击可更换图片":"建议使用主体清晰、背景简单的图片"}</small>
        </button>
        <div className="panel-title settings-title"><span>02</span><div><b>调整图纸</b><small>找到细节与用量的平衡</small></div></div>
        <label className="range-label"><span>图纸宽度</span><output>{beads} 豆</output></label>
        <input type="range" min="16" max="80" value={beads} onChange={e=>setBeads(+e.target.value)}/>
        <div className="range-hints"><span>简单</span><span>精细</span></div>
        <label className="range-label"><span>颜色数量</span><output>{colors} 色</output></label>
        <input type="range" min="4" max="24" value={colors} onChange={e=>setColors(+e.target.value)}/>
        <div className="toggles">
          <button className={grid?"active":""} onClick={()=>setGrid(v=>!v)}><i>▦</i> 网格线</button>
          <button className={labels?"active":""} onClick={()=>setLabels(v=>!v)}><i>12</i> 色号</button>
        </div>
      </aside>

      <section className="panel preview-panel">
        <div className="preview-head"><div><span className="live-dot"></span>{fileName?"你的图纸":"示例图纸"}</div><span>{pattern.width} × {pattern.height} · {pattern.width*pattern.height.toLocaleString()} 颗豆</span></div>
        <div className="canvas-wrap">{busy&&<div className="processing">正在重新排列豆豆…</div>}<PatternCanvas pattern={pattern} grid={grid} labels={labels} exportRef={exportRef}/></div>
        <div className="palette-head"><b>配色清单</b><span>共 {pattern.palette.length} 色</span></div>
        <div className="palette-list">{pattern.palette.map((c,i)=><div className="swatch" key={`${c.join()}-${i}`} title={`颜色 ${i+1}`}><span style={{background:`rgb(${c.join(",")})`}}></span><b>{i+1}</b><small>{pattern.counts[i]} 颗</small></div>)}</div>
        <div className="actions"><button className="secondary" onClick={()=>window.print()}>打印图纸</button><button className="primary" onClick={download}>下载高清 PNG <span>↓</span></button></div>
      </section>
    </section>

    <section className="features"><article><span>⌁</span><div><b>本地处理，更安心</b><p>图片不会上传服务器，关掉页面后不留痕迹。</p></div></article><article><span>◫</span><div><b>一目了然的用量</b><p>自动统计每种颜色需要的豆子数量。</p></div></article><article><span>↧</span><div><b>拿来就能用</b><p>导出带网格与色号的高清图纸，手机或打印均可。</p></div></article></section>
    <footer><span>豆格 BEADGRID</span><p>把喜欢的画面，变成亲手完成的小作品。</p></footer>
  </main>
}
