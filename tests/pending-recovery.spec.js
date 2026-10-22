import {test,expect} from '@playwright/test';

async function openPendingSession(page){
 await page.addInitScript(()=>{window.pendingFixture={calls:[],held:true,conflict:false};});
 // All authenticated data in this fixture is synthetic; block external traffic.
 const origin=new URL(process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000').origin;
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.route('**/components/Login.tsx*',route=>route.fulfill({contentType:'application/javascript',body:`
 import React from '/node_modules/.vite/deps/react.js';
 export default function Login({onLogin}){return React.createElement('button',{onClick:()=>onLogin({id:'fixture-user',name:'Equipe fictícia',role:'admin',clinicId:'fixture-clinic'})},'Entrar na sessão fictícia');}
 `}));
 await page.route('**/components/Dashboard.tsx*',route=>route.fulfill({contentType:'application/javascript',body:`
 import React from '/node_modules/.vite/deps/react.js';
 export default function Dashboard(){return React.createElement('button',{onClick:()=>window.pendingFixture.calls.push('edit')},'Editar registro fictício');}
 `}));
 await page.route('**/services/supabase.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 export const isSupabaseConfigured=true;
 export const supabase={rpc:async()=>({data:'fixture-clinic'}),auth:{signOut:async()=>{},getSession:async()=>({data:{session:null}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'fixture-user',role:'admin',active:true}})})})})};
 `}));
 await page.route('**/services/operationalStorage.ts*',route=>route.fulfill({contentType:'application/javascript',body:`
 const f=window.pendingFixture;
 const empty=()=>({users:[{id:'fixture-user',name:'Equipe fictícia',role:'admin',active:true}],patients:[],doctors:[],appointments:[],medications:[],sigilousNotes:[],financial:{transactions:[],repasses:[],settings:[]}});
 export const financialTables={};
 export async function operationalRpc(){throw Error('RPC inesperada no cenário fictício');}
 export const storage={
 initLocal:empty,resetCloudSyncState(){},prepareSession:async()=>{},save:async()=>{},
 fetchFromCloud:async clinic=>{if(!clinic)return {};f.calls.push('snapshot');return empty();},
 syncToCloud:async()=>{f.calls.push('sync');if(f.held)throw Error('Há pendências protegidas da sessão anterior.');},
 getPendingChanges:async()=>f.held?{changes:[{table:'doctors',id:'fixture-doctor',row:{name:'Alteração fictícia'}}]}:null,
 inspectPendingChanges:async()=>f.held?[{table:'doctors',id:'fixture-doctor',row:{name:'Alteração fictícia',apiKey:'synthetic-sensitive-value'},current:{name:'Confirmado'},applied:false,conflict:f.conflict}]:[],
 holdPendingChanges:async()=>{f.calls.push('hold');return f.held;},
 recoverPendingChanges:async()=>{f.calls.push('recover');if(f.conflict)throw Error('Conflito de gravação: outro acesso alterou o registro. Suas alterações não foram enviadas.');f.held=false;},
 discardPendingChanges:async()=>{f.calls.push('discard');f.held=false;}
 };
 `}));
 await page.goto('/');
 await page.getByRole('button',{name:/Acesso Profissional/i}).click();
 await page.getByRole('button',{name:'Entrar na sessão fictícia'}).click();
 await expect(page.getByRole('heading',{name:'Revisão de alterações protegidas'})).toBeVisible();
}
test('comparison only reads the cloud; recovery reloads without flushing the old screen and unlocks editing',async({page})=>{
 await openPendingSession(page);
 expect(await page.getByText('Editar registro fictício',{exact:true}).evaluate(el=>!!el.closest('[inert]'))).toBe(true);
 await page.getByRole('button',{name:'Recarregar para comparar com os dados confirmados'}).click();
 await expect(page.getByText(/Suas alterações protegidas continuam preservadas/)).toBeVisible();
 expect(await page.evaluate(()=>window.pendingFixture.calls.includes('sync'))).toBe(false);
 await page.getByRole('button',{name:'Recuperar pendências protegidas desta conta'}).click();
 await expect(page.getByText('Cloud Online',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Editar registro fictício'}).click();
 const calls=await page.evaluate(()=>window.pendingFixture.calls);
 expect(calls.filter(call=>call!=='sync')).toEqual(['snapshot','hold','snapshot','recover','snapshot','edit']);
 // Normal autosync may resume after the confirmed snapshot, never before it.
 if(calls.includes('sync'))expect(calls.indexOf('sync')).toBeGreaterThan(calls.lastIndexOf('snapshot'));
});
test('mobile review shows actual local versus confirmed values and keeps recovery buttons clickable',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openPendingSession(page);
 await expect(page.getByRole('heading',{name:'Revisão de alterações protegidas'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Editar registro fictício'})).toBeHidden();
 const recover=page.getByRole('button',{name:'Recuperar pendências protegidas desta conta'});
 expect(await recover.evaluate(el=>!!el.closest('[inert]'))).toBe(false);
 await page.getByText('Médicos — Confirmado',{exact:false}).click();
 await expect(page.getByRole('cell',{name:'Alteração fictícia',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Confirmado',exact:true})).toBeVisible();
 await expect(page.getByText('synthetic-sensitive-value',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('cell',{name:'Conteúdo protegido',exact:true})).toHaveCount(2);
 await expect(page.getByRole('cell',{name:'Conteúdo protegido',exact:true}).first()).toBeVisible();
 expect(await page.evaluate(()=>window.pendingFixture.calls.includes('sync'))).toBe(false);
 await recover.click();
 await expect(page.getByRole('heading',{name:'Revisão de alterações protegidas'})).toHaveCount(0);
 await page.getByRole('button',{name:'Editar registro fictício'}).click();
});
test('a recovery conflict keeps the copy and editing lock instead of silently discarding or retrying',async({page})=>{
 await openPendingSession(page);
 await page.evaluate(()=>{window.pendingFixture.conflict=true;});
 await page.getByRole('button',{name:'Recuperar pendências protegidas desta conta'}).click();
 await expect(page.getByRole('alert')).toContainText('Conflito de gravação');
 expect(await page.evaluate(()=>window.pendingFixture.held)).toBe(true);
 expect(await page.getByText('Editar registro fictício',{exact:true}).evaluate(el=>!!el.closest('[inert]'))).toBe(true);
 expect(await page.evaluate(()=>window.pendingFixture.calls)).toEqual(['snapshot','recover']);
});
test('discard requires explicit confirmation and reloads confirmed data without sending the old copy',async({page})=>{
 await openPendingSession(page);
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Descartar pendências locais após revisão'}).click();
 expect(await page.evaluate(()=>window.pendingFixture.held)).toBe(true);
 expect(await page.evaluate(()=>window.pendingFixture.calls)).toEqual(['snapshot']);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Descartar pendências locais após revisão'}).click();
 await expect(page.getByText('Editar registro fictício',{exact:true})).not.toHaveAttribute('inert');
 await expect.poll(()=>page.evaluate(()=>!!document.querySelector('[inert]'))).toBe(false);
 expect(await page.evaluate(()=>window.pendingFixture.calls)).toEqual(['snapshot','discard','snapshot']);
});
