import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-change-me');
export async function createSession(userId:string){const token=await new SignJWT({userId}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('7d').sign(secret); (await cookies()).set('sgj_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:60*60*24*7,path:'/'});}
export async function getUser(){const store=await cookies();try{const token=store.get('sgj_session')?.value;if(!token)return null;const {payload}=await jwtVerify(token,secret);if(typeof payload.userId!=='string')return null;return db.user.findUnique({where:{id:payload.userId},include:{business:true}})}catch{return null}}
export async function requireUser(){const u=await getUser();if(!u)redirect('/login');return u}
