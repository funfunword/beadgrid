"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { COLOR_SCHEME_SIZES, getMardPalette } from "./mard-palette";

type RGB = [number, number, number];
type Pattern = { width: number; height: number; pixels: number[]; palette: RGB[]; codes: string[]; counts: number[]; schemeSize: number };

const DEMO_COLORS: RGB[] = [[253,251,255],[0,0,0],[231,0,47],[254,172,76],[53,227,82],[1,172,235]];
const DEFAULT_BEAD_WIDTH = 80;
const MIN_BEAD_WIDTH = 32;
const MAX_BEAD_WIDTH = 168;
const COLOR_BUCKET_BITS = 5;
const COLOR_BUCKET_SIZE = 1 << COLOR_BUCKET_BITS;

function distance(a: RGB, b: RGB) {
  return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
}

function quantize(data: Uint8ClampedArray, schemeSize: number): { indexes: number[]; palette: RGB[]; codes: string[]; counts: number[] } {
  const pixelCount = data.length / 4;
  const mardPalette=getMardPalette(schemeSize),palette=mardPalette.map(c=>c.rgb),codes=mardPalette.map(c=>c.code);
  const counts = palette.map(() => 0);
  const colorLookup = new Uint8Array(COLOR_BUCKET_SIZE ** 3);
  const bucketShift = 8 - COLOR_BUCKET_BITS;
  const bucketCenter = 1 << (bucketShift - 1);
  for (let r=0;r<COLOR_BUCKET_SIZE;r++) for (let g=0;g<COLOR_BUCKET_SIZE;g++) for (let b=0;b<COLOR_BUCKET_SIZE;b++) {
    const px: RGB = [(r<<bucketShift)+bucketCenter,(g<<bucketShift)+bucketCenter,(b<<bucketShift)+bucketCenter];
    let best=0,bestD=Infinity;
    palette.forEach((c,i)=>{const d=distance(px,c);if(d<bestD){bestD=d;best=i;}});
    colorLookup[(r<<(COLOR_BUCKET_BITS*2))|(g<<COLOR_BUCKET_BITS)|b]=best;
  }
  const indexes = new Array<number>(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const i = pixel * 4;
    const key=((data[i]>>bucketShift)<<(COLOR_BUCKET_BITS*2))|((data[i+1]>>bucketShift)<<COLOR_BUCKET_BITS)|(data[i+2]>>bucketShift);
    const best=colorLookup[key];
    counts[best]++;
    indexes[pixel]=best;
  }
  return { indexes, palette, codes, counts };
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
  return {width:w,height:h,pixels,palette:DEMO_COLORS,codes:["H1","H7","F5","A6","B5","C5"],counts,schemeSize:72};
}

function PatternCanvas({pattern, grid=true, labels=false, exportRef}:{pattern:Pattern;grid?:boolean;labels?:boolean;exportRef?:React.RefObject<HTMLCanvasElement | null>}) {
  const ownRef=useRef<HTMLCanvasElement>(null);
  const ref=exportRef || ownRef;
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const cell=Math.max(1, Math.min(24, Math.floor(960/pattern.width)));
    canvas.width=pattern.width*cell;canvas.height=pattern.height*cell;
    const ctx=canvas.getContext("2d");if(!ctx)return;
    const pixelCanvas=document.createElement("canvas");pixelCanvas.width=pattern.width;pixelCanvas.height=pattern.height;
    const pixelCtx=pixelCanvas.getContext("2d");if(!pixelCtx)return;
    const image=pixelCtx.createImageData(pattern.width,pattern.height);
    pattern.pixels.forEach((pi,n)=>{
      const c=pattern.palette[pi],offset=n*4;
      image.data[offset]=c[0];image.data[offset+1]=c[1];image.data[offset+2]=c[2];image.data[offset+3]=255;
    });
    pixelCtx.putImageData(image,0,0);
    ctx.imageSmoothingEnabled=false;ctx.drawImage(pixelCanvas,0,0,canvas.width,canvas.height);
    if(grid&&cell>=4){
      ctx.strokeStyle="rgba(24,32,39,.18)";ctx.lineWidth=1;ctx.beginPath();
      for(let x=0;x<=pattern.width;x++){ctx.moveTo(x*cell+.5,0);ctx.lineTo(x*cell+.5,canvas.height)}
      for(let y=0;y<=pattern.height;y++){ctx.moveTo(0,y*cell+.5);ctx.lineTo(canvas.width,y*cell+.5)}
      ctx.stroke();
    }
    if(labels&&cell>=14){
      ctx.font=`600 ${Math.max(8,cell*.42)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      pattern.pixels.forEach((pi,n)=>{
        const x=n%pattern.width,y=Math.floor(n/pattern.width),c=pattern.palette[pi];
        ctx.fillStyle=(c[0]+c[1]+c[2])>390?"#273039":"#fff";ctx.fillText(pattern.codes[pi],x*cell+cell/2,y*cell+cell/2);
      });
    }
  },[pattern,grid,labels,ref]);
  return <canvas ref={ref} className="pattern-canvas" aria-label="拼豆图纸预览"/>;
}

export default function Home() {
  const [pattern,setPattern]=useState<Pattern>(()=>demoPattern());
  const [fileName,setFileName]=useState("");
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const [beads,setBeads]=useState(DEFAULT_BEAD_WIDTH);
  const [colorSchemeIndex,setColorSchemeIndex]=useState(2);
  const colors=COLOR_SCHEME_SIZES[colorSchemeIndex];
  const activeSchemeSize=image?pattern.schemeSize:colors;
  const [grid,setGrid]=useState(true);
  const [labels,setLabels]=useState(false);
  const [busy,setBusy]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const exportRef=useRef<HTMLCanvasElement>(null);

  const createPattern=useCallback((img:HTMLImageElement,w:number,colorCount:number)=>{
    setBusy(true);
    requestAnimationFrame(()=>{
      const h=Math.max(8,Math.round(w*img.naturalHeight/img.naturalWidth));
      const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)return;
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality="high";
      ctx.drawImage(img,0,0,w,h);
      const {data}=ctx.getImageData(0,0,w,h);
      const q=quantize(data,colorCount);
      setPattern({width:w,height:h,pixels:q.indexes,palette:q.palette,codes:q.codes,counts:q.counts,schemeSize:colorCount});setBusy(false);
    });
  },[]);

  useEffect(()=>{
    if(!image)return;
    const timer=window.setTimeout(()=>createPattern(image,beads,colors),120);
    return ()=>window.clearTimeout(timer);
  },[image,beads,colors,createPattern]);

  function loadFile(file?:File){
    if(!file||!file.type.startsWith("image/"))return;
    setFileName(file.name);
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{setImage(img);URL.revokeObjectURL(url)};img.src=url;
  }
  function onDrop(e:DragEvent){e.preventDefault();loadFile(e.dataTransfer.files[0]);}
  function onFile(e:ChangeEvent<HTMLInputElement>){loadFile(e.target.files?.[0]);}
  function download(){const c=exportRef.current;if(!c)return;const a=document.createElement("a");a.download=`${fileName.replace(/\.[^.]+$/,"")||"拼豆图纸"}.png`;a.href=c.toDataURL("image/png");a.click();}

  async function downloadPdf(){
    const patternCanvas=exportRef.current;if(!patternCanvas||pdfBusy)return;
    setPdfBusy(true);
    try{
      const {jsPDF}=await import("jspdf");
      const pageW=1240,pageH=1754,margin=70,contentW=pageW-margin*2;
      const makePage=()=>{
        const canvas=document.createElement("canvas");canvas.width=pageW;canvas.height=pageH;
        const ctx=canvas.getContext("2d");if(!ctx)throw new Error("无法创建 PDF 画布");
        ctx.fillStyle="#fffdf8";ctx.fillRect(0,0,pageW,pageH);return {canvas,ctx};
      };
      const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
      const addPage=(canvas:HTMLCanvasElement,first=false)=>{if(!first)pdf.addPage();pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,210,297,undefined,"FAST");};
      const first=makePage();
      first.ctx.fillStyle="#20272b";first.ctx.font='700 42px "Microsoft YaHei",sans-serif';first.ctx.fillText("拼豆图纸",margin,82);
      first.ctx.fillStyle="#697276";first.ctx.font='24px "Microsoft YaHei",sans-serif';first.ctx.fillText(`${pattern.width} × ${pattern.height} · ${(pattern.width*pattern.height).toLocaleString()} 颗豆 · MARD ${activeSchemeSize} 色方案`,margin,126);
      first.ctx.strokeStyle="#d9d1c2";first.ctx.lineWidth=2;first.ctx.beginPath();first.ctx.moveTo(margin,154);first.ctx.lineTo(pageW-margin,154);first.ctx.stroke();
      const maxPatternH=pageH-250,scale=Math.min(contentW/patternCanvas.width,maxPatternH/patternCanvas.height);
      const drawW=patternCanvas.width*scale,drawH=patternCanvas.height*scale,drawX=(pageW-drawW)/2,drawY=190+(maxPatternH-drawH)/2;
      first.ctx.fillStyle="#eee7da";first.ctx.fillRect(drawX-10,drawY-10,drawW+20,drawH+20);first.ctx.imageSmoothingEnabled=false;first.ctx.drawImage(patternCanvas,drawX,drawY,drawW,drawH);
      first.ctx.fillStyle="#898277";first.ctx.font='20px "Microsoft YaHei",sans-serif';first.ctx.textAlign="right";first.ctx.fillText("第 1 页 · 图纸",pageW-margin,pageH-42);
      addPage(first.canvas,true);

      const usedColors=pattern.palette.map((rgb,index)=>({rgb,index})).filter(({index})=>pattern.counts[index]>0);
      const columns=6,rows=12,perPage=columns*rows,cardGap=12,cardW=(contentW-cardGap*(columns-1))/columns,cardH=112;
      for(let start=0;start<usedColors.length;start+=perPage){
        const page=makePage(),pageNumber=2+Math.floor(start/perPage);
        page.ctx.fillStyle="#20272b";page.ctx.textAlign="left";page.ctx.font='700 38px "Microsoft YaHei",sans-serif';page.ctx.fillText("配色清单",margin,78);
        page.ctx.fillStyle="#697276";page.ctx.font='22px "Microsoft YaHei",sans-serif';page.ctx.fillText(`实际使用 ${usedColors.length} 色 · MARD ${activeSchemeSize} 色方案`,margin,116);
        page.ctx.strokeStyle="#d9d1c2";page.ctx.lineWidth=2;page.ctx.beginPath();page.ctx.moveTo(margin,145);page.ctx.lineTo(pageW-margin,145);page.ctx.stroke();
        usedColors.slice(start,start+perPage).forEach(({rgb,index},offset)=>{
          const col=offset%columns,row=Math.floor(offset/columns),x=margin+col*(cardW+cardGap),y=180+row*(cardH+cardGap);
          page.ctx.fillStyle="#fffaf0";page.ctx.strokeStyle="#d9d1c2";page.ctx.lineWidth=2;page.ctx.beginPath();page.ctx.roundRect(x,y,cardW,cardH,10);page.ctx.fill();page.ctx.stroke();
          page.ctx.fillStyle=`rgb(${rgb.join(",")})`;page.ctx.strokeStyle="#aaa297";page.ctx.beginPath();page.ctx.arc(x+32,y+38,21,0,Math.PI*2);page.ctx.fill();page.ctx.stroke();
          page.ctx.fillStyle="#20272b";page.ctx.font='700 22px "Microsoft YaHei",sans-serif';page.ctx.fillText(pattern.codes[index],x+62,y+39);
          page.ctx.fillStyle="#697276";page.ctx.font='18px "Microsoft YaHei",sans-serif';page.ctx.fillText(`${pattern.counts[index].toLocaleString()} 颗`,x+62,y+72);
        });
        page.ctx.fillStyle="#898277";page.ctx.font='20px "Microsoft YaHei",sans-serif';page.ctx.textAlign="right";page.ctx.fillText(`第 ${pageNumber} 页 · 配色清单`,pageW-margin,pageH-42);
        addPage(page.canvas);
      }
      const base=fileName.replace(/\.[^.]+$/,"").trim()||"拼豆图纸";
      pdf.save(`${base}.pdf`);
    }finally{setPdfBusy(false);}
  }

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
        <input type="range" min={MIN_BEAD_WIDTH} max={MAX_BEAD_WIDTH} step="4" value={beads} onChange={e=>setBeads(+e.target.value)}/>
        <div className="range-hints"><span>简单</span><span>精细</span></div>
        <label className="range-label"><span>MARD 色卡方案</span><output>{colors} 色</output></label>
        <input aria-label="MARD 色卡方案" type="range" min="0" max={COLOR_SCHEME_SIZES.length-1} step="1" value={colorSchemeIndex} onChange={e=>setColorSchemeIndex(Number(e.target.value))}/>
        <div className="scheme-hints">{COLOR_SCHEME_SIZES.map(size=><span key={size}>{size}</span>)}</div>
        <div className="toggles">
          <button className={grid?"active":""} onClick={()=>setGrid(v=>!v)}><i>▦</i> 网格线</button>
          <button className={labels?"active":""} onClick={()=>setLabels(v=>!v)}><i>12</i> 色号</button>
        </div>
      </aside>

      <section className="panel preview-panel">
        <div className="preview-head"><div><span className="live-dot"></span>{fileName?"你的图纸":"示例图纸"}</div><span>{pattern.width} × {pattern.height} · {(pattern.width*pattern.height).toLocaleString()} 颗豆</span></div>
        <div className="canvas-wrap">{busy&&<div className="processing">正在重新排列豆豆…</div>}<PatternCanvas pattern={pattern} grid={grid} labels={labels} exportRef={exportRef}/></div>
        <div className="palette-head"><b>配色清单</b><span>实际使用 {pattern.counts.filter(Boolean).length} / MARD {activeSchemeSize} 色</span></div>
        <div className="palette-list">{pattern.palette.map((c,i)=>pattern.counts[i]>0&&<div className="swatch" key={pattern.codes[i]} title={`MARD ${pattern.codes[i]}`}><span style={{background:`rgb(${c.join(",")})`}}></span><b>{pattern.codes[i]}</b><small>{pattern.counts[i]} 颗</small></div>)}</div>
        <div className="actions"><button className="secondary" disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy?"正在生成 PDF…":"下载 PDF 图纸"}</button><button className="primary" onClick={download}>下载高清 PNG <span>↓</span></button></div>
      </section>
    </section>

    <section className="features"><article><span>⌁</span><div><b>本地处理，更安心</b><p>图片不会上传服务器，关掉页面后不留痕迹。</p></div></article><article><span>◫</span><div><b>一目了然的用量</b><p>自动统计每种颜色需要的豆子数量。</p></div></article><article><span>↧</span><div><b>拿来就能用</b><p>导出带网格与色号的高清图纸，手机或打印均可。</p></div></article></section>
    <footer><span>豆格 BEADGRID</span><p>把喜欢的画面，变成亲手完成的小作品。</p></footer>
  </main>
}
