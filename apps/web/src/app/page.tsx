import type { Metadata } from 'next';
import Link from 'next/link';
import { MathContent } from '@/components/math-content';
import { NewsletterForm } from '@/components/newsletter-form';
import { PdfCover } from '@/components/pdf-cover';
import { UiIcon } from '@/components/ui-icon';
import { getHomeData, problemHref, type PublicProblem } from '@/lib/public-api';
import { summarizeProblemBody } from '@/lib/problem-summary';
export const metadata:Metadata={title:'Trang nhất',description:'Bài viết, bài toán, lời giải và video từ cộng đồng Tờ Toán.'};
export const revalidate=60;
const categories=[['dai-so','Đại số'],['hinh-hoc','Hình học'],['so-hoc','Số học'],['to-hop','Tổ hợp'],['logic','Logic'],['xac-suat','Xác suất']] as const;
const date=(value:string)=>new Intl.DateTimeFormat('vi-VN').format(new Date(value));
function Article({problem,lead=false}:{problem:PublicProblem;lead?:boolean}){
 const onlyPdf=Boolean(problem.latexPdfUrl)&&/^xem\s+(?:tệp|file)\s+pdf[.!]?$/i.test(problem.body.trim());
 return <article className={lead?'newspaper-lead':'newspaper-story'}>
 <div className="newspaper-story-meta"><span>{problem.categories.map(c=>c.name).join(', ')||'Toán học'}</span><span>{problem.difficulty}</span></div>
 {lead?<h1><Link href={problemHref(problem)}>{problem.title}</Link></h1>:<h2><Link href={problemHref(problem)}>{problem.title}</Link></h2>}
 <div className="newspaper-story-content"><div>{!onlyPdf&&<MathContent content={summarizeProblemBody(problem.body,lead?360:190)} className="newspaper-excerpt" />}{onlyPdf&&<p className="newspaper-document-label">Tài liệu PDF</p>}<p className="newspaper-byline">{problem.author.name}<time dateTime={problem.publishedAt??problem.createdAt}>{date(problem.publishedAt??problem.createdAt)}</time></p><Link className="newspaper-read" href={problemHref(problem)}>Đọc bài <UiIcon name="arrow-right" /></Link></div>{lead&&problem.latexPdfUrl&&<Link className="newspaper-document" href={problemHref(problem)} aria-label={'Đọc '+problem.title}><PdfCover url={problem.latexPdfUrl}/></Link>}</div>
 </article>;
}
export default async function HomePage(){
 const {problems,totalProblems,featuredSolutions,videos,problemsAvailable}=await getHomeData();const [lead,...recent]=problems;
 return <div className="newspaper-home">
 <nav className="newspaper-categories" aria-label="Chuyên mục">{categories.map(([slug,name])=><Link key={slug} href={'/bai-toan?category='+slug}>{name}</Link>)}</nav>
 <div className="newspaper-columns"><section className="newspaper-articles" aria-label="Bài viết mới">
 {lead?<Article problem={lead} lead/>:<div className="newspaper-empty"><h1>{problemsAvailable?'Chưa có bài viết được xuất bản':'Chưa tải được bài viết'}</h1><p>{problemsAvailable?'Các bài được duyệt sẽ xuất hiện tại đây.':'Vui lòng thử tải lại trang sau ít phút.'}</p><Link href={problemsAvailable?'/soan-bai':'/'}>{problemsAvailable?'Gửi bài':'Thử lại'} →</Link></div>}
 {recent.length>0&&<div className="newspaper-subarticles">{recent.slice(0,2).map(p=><Article key={p.id} problem={p}/>)}</div>}
 {recent.length>2&&<div className="newspaper-bottom-articles">{recent.slice(2,6).map(p=><Article key={p.id} problem={p}/>)}</div>}
 <div className="newspaper-archive-link"><Link href="/bai-toan">Xem tất cả bài viết <UiIcon name="arrow-right"/></Link>{problemsAvailable&&<span>{totalProblems} bài viết</span>}</div>
 </section>
 <aside className="newspaper-sidebar"><section id="loi-giai"><h2>Lời giải mới</h2>{featuredSolutions.length?featuredSolutions.slice(0,2).map(s=><article className="newspaper-solution" key={s.id}><p className="newspaper-proof">Đã kiểm chứng</p><h3><Link href={'/bai-toan/'+encodeURIComponent(s.problem_slug)+'#loi-giai'}>{s.problem_title}</Link></h3><MathContent content={summarizeProblemBody(s.excerpt,220)}/><p className="newspaper-byline">{s.author_name}</p><Link className="newspaper-read" href={'/bai-toan/'+encodeURIComponent(s.problem_slug)+'#loi-giai'}>Đọc lời giải <UiIcon name="arrow-right"/></Link></article>):<div className="newspaper-empty-copy"><p>Chưa có lời giải được kiểm chứng.</p><Link href="/bai-toan">Chọn bài để giải →</Link></div>}</section>
 <section id="video"><h2>Video bài giảng</h2>{videos.length?videos.slice(0,3).map(v=><article className="newspaper-video" key={v.id}><a className="newspaper-play" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={'Xem video '+v.title}><UiIcon name="play"/></a><div><p className="newspaper-video-meta">{v.topic}<span>{v.duration}</span></p><h3><a href={v.url} target="_blank" rel="noopener noreferrer">{v.title}</a></h3><a className="newspaper-read" href={v.url} target="_blank" rel="noopener noreferrer">Xem video ↗</a></div></article>):<p className="newspaper-empty-copy">Chưa có video bài giảng.</p>}</section>
 <section className="newspaper-contribute"><h2>Gửi bài cho Tờ Toán</h2><p>Chia sẻ bài viết, bài toán hoặc lời giải của bạn với cộng đồng.</p><Link className="newspaper-read" href="/soan-bai">Soạn bài <UiIcon name="arrow-right"/></Link></section>
 </aside></div>
 <section className="newspaper-newsletter"><div><h2>Nhận tin từ Tờ Toán</h2><p>Thông báo khi bản tin được triển khai.</p></div><NewsletterForm/></section>
 </div>;
}
