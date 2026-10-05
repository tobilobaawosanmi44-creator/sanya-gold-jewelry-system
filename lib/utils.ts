export const money=(v:number|string|{toString():string})=>`₦${Number(v).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const slugReceipt=(n:string)=>`/verify/${encodeURIComponent(n)}`;
