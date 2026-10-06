import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';

function rangeFor(period: string, value: string) {
  const anchor = new Date(`${value || new Date().toISOString().slice(0,10)}T00:00:00+01:00`);
  if (Number.isNaN(anchor.getTime())) throw new Error('Invalid report date');
  let start = new Date(anchor);
  let end: Date;
  if (period === 'daily') { end = new Date(start); end.setDate(end.getDate()+1); }
  else if (period === 'weekly') { const day = start.getDay(); const diff = day === 0 ? -6 : 1-day; start.setDate(start.getDate()+diff); end = new Date(start); end.setDate(end.getDate()+7); }
  else if (period === 'yearly') { start = new Date(start.getFullYear(),0,1); end = new Date(start.getFullYear()+1,0,1); }
  else { start = new Date(start.getFullYear(),start.getMonth(),1); end = new Date(start.getFullYear(),start.getMonth()+1,1); }
  return { start, end };
}
const money = (n:number) => `N${n.toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const title = (period:string) => period.charAt(0).toUpperCase()+period.slice(1)+' Sales Report';

export async function GET(req:Request){
 const u=await requireUser();
 try{
  const q=new URL(req.url).searchParams; const period=q.get('period')||'daily'; const date=q.get('date')||new Date().toISOString().slice(0,10);
  if(!['daily','weekly','monthly','yearly'].includes(period)) return new NextResponse('Invalid period',{status:400});
  const {start,end}=rangeFor(period,date);
  const sales=await db.sale.findMany({where:{businessId:u.businessId,createdAt:{gte:start,lt:end},paymentStatus:{not:'CANCELLED'}},include:{customer:true,staff:true,receipt:true,items:{include:{product:true}}},orderBy:{createdAt:'asc'}});
  const total=sales.reduce((a,s)=>a+Number(s.total),0), paid=sales.reduce((a,s)=>a+Number(s.amountPaid),0), balance=sales.reduce((a,s)=>a+Number(s.balance),0);
  const pdf=await PDFDocument.create(); const font=await pdf.embedFont(StandardFonts.Helvetica); const bold=await pdf.embedFont(StandardFonts.HelveticaBold); const gold=rgb(0.79,0.64,0.15); let page=pdf.addPage([595,842]); let y=800;
  const draw=(text:string,x:number,yy:number,size=10,f=font,color=rgb(0.12,0.12,0.12))=>page.drawText(text,{x,y:yy,size,font:f,color});
  draw('SANYA GOLD JEWELRY',42,y,20,bold,gold); y-=25; draw('New 18KT Italian gold jewelry · Ile-Ife, Osun State, Nigeria',42,y,9); y-=30; draw(title(period),42,y,17,bold); y-=16; draw(`${start.toLocaleDateString('en-NG')} - ${new Date(end.getTime()-1).toLocaleDateString('en-NG')}`,42,y,9); y-=28;
  draw('SUMMARY',42,y,10,bold); y-=18; draw(`Transactions: ${sales.length}`,42,y); draw(`Total sales: ${money(total)}`,205,y); draw(`Collected: ${money(paid)}`,365,y); y-=16; draw(`Outstanding: ${money(balance)}`,42,y); y-=28;
  draw('SALES',42,y,10,bold); y-=18; draw('Date / Receipt',42,y,8,bold); draw('Customer',185,y,8,bold); draw('Payment',335,y,8,bold); draw('Total',475,y,8,bold); y-=8;
  for(const s of sales){ if(y<55){page=pdf.addPage([595,842]);y=800;draw('SANYA GOLD JEWELRY — Sales Report',42,y,14,bold,gold);y-=28;draw('Date / Receipt',42,y,8,bold);draw('Customer',185,y,8,bold);draw('Payment',335,y,8,bold);draw('Total',475,y,8,bold);y-=18;} const d=new Date(s.createdAt).toLocaleDateString('en-NG'); draw(`${d} ${s.receipt?.receiptNumber||''}`.slice(0,28),42,y,7); draw(s.customer.name.slice(0,23),185,y,7); draw(s.paymentMethod.replace('_',' '),335,y,7); draw(money(Number(s.total)),475,y,7); y-=15; }
  if(!sales.length) draw('No completed sales were recorded for this period.',42,y,10);
  y-=28; if(y<100){page=pdf.addPage([595,842]);y=800;} draw('Generated from the Sanya Gold Jewelry Sales Management System.',42,y,8); draw('This report excludes cancelled receipts.',42,y-13,8);
  const bytes=await pdf.save(); return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="Sanya-Gold-${period}-${date}.pdf"`,'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:(e as Error).message||'Unable to generate report'},{status:400});}
}
