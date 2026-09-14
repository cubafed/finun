import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function context(){const user=await getChatGPTUser();if(!user)throw new Error('AUTH');if(!env.DB)throw new Error('STORAGE');const db=env.DB;await db.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('starosta',?)").bind(user.userId).run();const role=await db.prepare("SELECT value FROM settings WHERE key='starosta'").first<{value:string}>();return {user,db,admin:role?.value===user.userId};}
export function failure(e:unknown){console.error('Community request failed',e);return Response.json({error:e instanceof Error&&e.message==='AUTH'?'Войдите через ChatGPT.':'Не удалось сохранить или загрузить данные. Попробуйте ещё раз.'},{status:e instanceof Error&&e.message==='AUTH'?401:503});}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export function safeFile(v:unknown){return typeof v==='string'&&/^\/api\/files\?id=[a-f0-9-]+$/.test(v)?v:'';}
