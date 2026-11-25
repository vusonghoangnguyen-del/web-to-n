'use client';
import { useEffect, useRef, useState } from 'react';
export function PdfCover({url}:{url:string}){
 const canvas=useRef<HTMLCanvasElement>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;let dispose:(()=>void)|undefined;
 async function draw(){try{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs',import.meta.url).toString();const task=pdfjs.getDocument({url,withCredentials:true});dispose=()=>{void task.destroy();};const pdf=await task.promise;if(cancelled)return;const page=await pdf.getPage(1);const natural=page.getViewport({scale:1});const viewport=page.getViewport({scale:320/natural.width});const target=canvas.current;if(!target||cancelled)return;target.width=viewport.width;target.height=viewport.height;const context=target.getContext('2d');if(!context)throw Error('Canvas unavailable');await page.render({canvas:target,canvasContext:context,viewport}).promise;page.cleanup();}catch{if(!cancelled)setFailed(true);}}
 void draw();return()=>{cancelled=true;dispose?.();};},[url]);
 if(failed)return null;return <canvas ref={canvas} className="newspaper-pdf-cover" aria-label="Trang đầu tài liệu PDF" />;
}
