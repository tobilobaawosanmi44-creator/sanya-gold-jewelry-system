import {PrismaClient} from '@prisma/client';import bcrypt from 'bcryptjs';const db=new PrismaClient();

// One-time reset of demo data. Runs only when WIPE_DEMO_DATA=YES_DELETE_EVERYTHING is set,
// and never twice: a "demoWipedAt" marker is stored so a leftover env var cannot wipe real data.
// Keeps: business profile, user accounts, settings. Deletes: receipts, payments, sales,
// customers, products, notifications, audit logs. Resets the receipt counter to 0.
async function wipeDemo(){
  if(process.env.WIPE_DEMO_DATA!=='YES_DELETE_EVERYTHING')return;
  const biz=await db.business.findFirst();
  if(!biz){console.log('WIPE: no business found, nothing to wipe.');return;}
  const marker=await db.setting.findUnique({where:{businessId_key:{businessId:biz.id,key:'demoWipedAt'}}});
  if(marker){console.log('WIPE: already done on '+marker.value+'. Skipping (remove the WIPE_DEMO_DATA variable).');return;}
  const where={businessId:biz.id};
  const count=async()=>({sales:await db.sale.count({where}),receipts:await db.receipt.count({where:{sale:where}}),customers:await db.customer.count({where}),products:await db.product.count({where}),users:await db.user.count({where})});
  console.log('WIPE: before',JSON.stringify(await count()));
  await db.$transaction([
    db.payment.deleteMany({where:{sale:where}}),
    db.saleItem.deleteMany({where:{sale:where}}),
    db.receipt.deleteMany({where:{sale:where}}),
    db.sale.deleteMany({where}),
    db.customer.deleteMany({where}),
    db.product.deleteMany({where}),
    db.notification.deleteMany({where}),
    db.auditLog.deleteMany({where}),
    db.business.update({where:{id:biz.id},data:{receiptCounter:0}}),
    db.setting.create({data:{businessId:biz.id,key:'demoWipedAt',value:new Date().toISOString()}}),
  ]);
  console.log('WIPE: after',JSON.stringify(await count()));
  console.log('WIPE: complete. Business profile and user accounts were kept.');
}
async function main(){await wipeDemo();if(await db.business.count()>0){console.log('Existing business found; skipping demo seed.');return;}const b=await db.business.create({data:{name:'SANYA GOLD JEWELRY',description:'New 18KT Italian gold jewelry',address:'Ile-Ife, Osun State, Nigeria',phone:'08082423674',email:'sanyagold285@gmail.com'}});const pass=await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD||'change-this-password',12);const admin=await db.user.create({data:{businessId:b.id,name:'Sanya Admin',email:'admin@sanyagold.local',passwordHash:pass,role:'SUPER_ADMIN'}});const names=['Adeola Adebayo','Tolu Ogunleye','Bisi Adesina','Femi Ajayi','Mariam Bello','Damilola Ojo','Kunle Adeyemi','Yetunde Falana','Aisha Ibrahim','Seun Oladipo'];const customers=await Promise.all(names.map((name,i)=>db.customer.create({data:{businessId:b.id,name,phone:`080${String(8242367+i).padStart(7,'0')}`,email:`customer${i+1}@example.com`,address:'Ile-Ife, Osun State'}})));const defs=[['Classic Italian Gold Chain','CHN-001','Chain',450000,12],['Royal Necklace','NCK-001','Necklace',780000,8],['18KT Signet Ring','RNG-001','Ring',320000,15],['Crown Pendant','PEN-001','Pendant',275000,10],['Fine Hand Chain','HND-001','Hand Chain',390000,9],['Italian Gold Earrings','EAR-001','Earrings',285000,11],['Dainty Chain','CHN-002','Chain',210000,20],['Classic Pendant','PEN-002','Pendant',195000,16],['Royal Ring','RNG-002','Ring',510000,7],['Luxury Necklace','NCK-002','Necklace',920000,5],['Fine Earrings','EAR-002','Earrings',240000,14],['Italian Hand Chain','HND-002','Hand Chain',430000,6],['Classic Ring','RNG-003','Ring',260000,13],['Gold Chain Deluxe','CHN-003','Chain',650000,4],['Signature Pendant','PEN-003','Pendant',360000,9]] as const;const products=await Promise.all(defs.map(d=>db.product.create({data:{businessId:b.id,name:d[0],sku:d[1],category:d[2],price:d[3],stockQty:d[4],description:'New 18KT Italian gold jewelry.'}})));for(let i=0;i<20;i++){const c=customers[i%customers.length],p=products[i%products.length],total=Number(p.price);await db.sale.create({data:{businessId:b.id,customerId:c.id,staffId:admin.id,subtotal:total,discount:0,tax:0,total,amountPaid:i%4===0?total/2:total,balance:i%4===0?total/2:0,paymentMethod:['CASH','BANK_TRANSFER','POS','CARD'][i%4] as any,paymentStatus:i%4===0?'PARTIALLY_PAID':'PAID',items:{create:{productId:p.id,quantity:1,unitPrice:p.price,subtotal:p.price}},receipt:{create:{receiptNumber:`SGJ-2026-${String(i+1).padStart(6,'0')}`,verificationToken:`seed-${i}-${Date.now()}`}}}})}console.log('Seeded',b.id)}main().finally(()=>db.$disconnect());
