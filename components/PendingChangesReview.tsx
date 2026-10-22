import React from 'react';

export interface PendingReviewItem {
 table:string;id:string;row:Record<string,unknown>|null;
 current:Record<string,unknown>|null;applied:boolean;conflict:boolean;
}
const names:Record<string,string>={
 doctors:'Médicos',patients:'Pacientes',appointments:'Agendamentos',medications:'Medicamentos',
 name:'Nome',email:'E-mail',phone:'Telefone',specialty:'Especialidade',crm:'Registro profissional',
 availableTimes:'Horários de atendimento',status:'Situação',amount:'Valor',date:'Data',
};
const sensitiveKey=/password|senha|token|secret|apikey|accesskey|privatekey|authorization|authuserid|pendingauthuserid/i;
function valueText(value:unknown,key:string){
 if(sensitiveKey.test(key))return 'Conteúdo protegido';
 if(value===undefined||value===null)return 'Sem valor';
 if(typeof value==='boolean')return value?'Sim':'Não';
 if(typeof value==='object')return JSON.stringify(value, (key,item)=>
  sensitiveKey.test(key)?'[protegido]':item,2);
 return String(value);
}
export default function PendingChangesReview({items}:{items:PendingReviewItem[]}){
 return <section aria-labelledby="pending-review-title" className="mb-6 rounded-xl border border-amber-300 bg-white p-5">
  <h2 id="pending-review-title" className="text-lg font-bold text-slate-900">Revisão de alterações protegidas</h2>
  <p className="mt-2 text-slate-700">Seu acesso continua ativo. Os formulários foram temporariamente suspensos para não misturar novas edições com as pendências anteriores.</p>
  <ol className="my-3 list-decimal pl-5 space-y-1 text-sm text-slate-700">
   <li>Confira abaixo o que ficou neste computador. Use “Recarregar para comparar” para atualizar a leitura do servidor.</li>
   <li>Para manter essas alterações, escolha “Recuperar pendências protegidas desta conta”.</li>
   <li>Se não precisar delas, descarte somente depois de revisar. Os registros já confirmados no servidor não serão apagados.</li>
  </ol>
  <p className="text-sm font-semibold">A edição será liberada após a recuperação ou o descarte e a confirmação da leitura do servidor.</p>
  {items.length===0?<p className="mt-4 text-sm">Não há detalhes carregados. Use “Recarregar para comparar com os dados confirmados”.</p>:
   <div className="mt-4 space-y-3">{items.map((item,index)=><details key={`${item.table}:${item.id}:${index}`} className="rounded-lg border border-slate-200 p-3">
    <summary className="cursor-pointer font-semibold">
     {names[item.table]||'Registro'} — {String(item.current?.name||item.row?.name||item.id)}
     <span className="ml-2 text-sm font-normal">{item.applied?'Já consta na leitura confirmada':item.conflict?'Requer revisão: versão diferente no servidor':'Alteração local pendente'}</span>
    </summary>
    {item.row===null?<p className="mt-3 text-sm">Pendência de exclusão deste registro. {item.current?'O registro ainda consta no servidor.':'O registro não consta na leitura autorizada.'}</p>:
     <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
      <thead><tr><th className="p-2 text-left">Campo</th><th className="p-2 text-left">Neste computador</th><th className="p-2 text-left">Confirmado no servidor</th></tr></thead>
      <tbody>{Object.entries(item.row).filter(([key])=>!['id','clinicId'].includes(key)).map(([key,value])=><tr key={key} className="border-t border-slate-100">
       <th className="p-2 text-left align-top">{names[key]||key}</th>
       <td className="p-2 align-top"><pre className="whitespace-pre-wrap break-all font-sans">{valueText(value,key)}</pre></td>
       <td className="p-2 align-top"><pre className="whitespace-pre-wrap break-all font-sans">{valueText(item.current?.[key],key)}</pre></td>
      </tr>)}</tbody>
     </table></div>}
    {item.conflict&&<p className="mt-2 text-sm text-amber-900">A recuperação não sobrescreve automaticamente uma versão diferente. Não descarte informações necessárias apenas para liberar a tela.</p>}
   </details>)}</div>}
 </section>;
}
