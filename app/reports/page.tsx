import { Shell } from '@/components/shell';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { money } from '@/lib/utils';
import { ReportControls } from '@/components/report-controls';

function boundaries(){
 const now=new Date(); const dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 const weekStart=new Date(dayStart); const d=weekStart.getDay(); weekStart.setDate(weekStart.getDate()+(d===0?-6:1-d));
 const monthStart=new Date(now.getFullYear(),now.getMonth(),1); const yearStart=new Date(now.getFullYear(),0,1);
 return {daily:[dayStart,new Date(dayStart.getTime()+86400000)],weekly:[weekStart,new Date(weekStart.getTime()+7*86400000)],monthly:[monthStart,new Date(now.getFullYear(),now.getMonth()+1,1)],yearly:[yearStart,new Date(now.getFullYear()+1,0,1)]} as const;
}
async function summary(businessId:string,start:Date,end:Date){const rows=await db.sale.findMany({where:{businessId,createdAt:{gte:start,lt:end},paymentStatus:{not:'CANCELLED'}},select:{total:true,amountPaid:true,balance:true}});return {count:rows.length,total:rows.reduce((a,x)=>a+Number(x.total),0),paid:rows.reduce((a,x)=>a+Number(x.amountPaid),0),balance:rows.reduce((a,x)=>a+Number(x.balance),0)}}
export default async function Reports(){
 const u=await requireUser(); const b=boundaries(); const [daily,weekly,monthly,yearly]=await Promise.all([summary(u.businessId,...b.daily),summary(u.businessId,...b.weekly),summary(u.businessId,...b.monthly),summary(u.businessId,...b.yearly)]);
 const cards=[['Today',daily,'daily'],['This week',weekly,'weekly'],['This month',monthly,'monthly'],['This year',yearly,'yearly']];
 return <Shell title="Sales Reports">
  <div className="mb-6"><h2 className="text-xl font-bold">Sales reporting</h2><p className="text-sm text-gray-500">Daily, weekly, monthly and yearly figures. Cancelled receipts are excluded.</p></div>
  <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">{cards.map(([label,s,period])=>{const x=s as Awaited<ReturnType<typeof summary>>;return <div className="card p-5" key={period as string}><div className="flex justify-between items-center"><span className="text-sm font-semibold">{label as string}</span><span className="text-xs text-gray-400">{x.count} sales</span></div><div className="text-xl font-black mt-3">{money(x.total)}</div><div className="text-xs text-green-700 mt-1">Collected {money(x.paid)}</div><div className="text-xs text-red-600">Outstanding {money(x.balance)}</div></div>})}</div>
  <ReportControls />
  <div className="card p-5"><h3 className="font-bold mb-4">What the reports contain</h3><div className="grid md:grid-cols-2 gap-3 text-sm text-gray-600"><div>• Transaction count and total sales</div><div>• Amount collected and outstanding</div><div>• Receipt number and customer</div><div>• Payment method and sale total</div><div>• Cancelled receipts excluded</div><div>• Downloadable PDF for each period</div></div></div>
 </Shell>;
}
