import {compile, initialQuestion, suggestions, labels} from './engine.mjs';
import {esc,format,isMoney,visualization} from './charts.mjs';
import {icon} from './icons.mjs';

const $=id=>document.getElementById(id);
const pages={studio:['Query studio','studio'],schema:['Schema explorer','schema'],history:['Query history','history']};
const descriptions={orders:'One record per completed purchase, with the order date and total in USD.',order_items:'The products, quantities, and sale prices within each order.',products:'The retail catalog, including product categories and unit prices in USD.',customers:'Synthetic customer names and their sales regions.'};
const historyKey='querydesk.history.1';
let db,catalog,current,history=[],available=false;
try {history=JSON.parse(localStorage.getItem(historyKey)||'[]').filter(h=>typeof h.q==='string'&&h.q.length<=400&&Number.isFinite(h.t)).slice(0,40);}catch{history=[];}
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
$('nav').innerHTML=Object.entries(pages).map(([id,[label,glyph]])=>'<a href="#'+id+'" data-route="'+id+'">'+icon(glyph)+'<span>'+label+'</span></a>').join('');
$('suggestions').innerHTML=suggestions.map(([title],i)=>'<button type="button" class="chip" data-prompt="'+i+'">'+icon(['box','globe','wallet'][i])+esc(title)+'</button>').join('');
function setMenu(open){
  document.body.classList.toggle('menu-open',open);
  $('scrim').hidden=!open;
  $('mobileMenu').setAttribute('aria-expanded',String(open));
}
$('mobileMenu').onclick=()=>setMenu(!document.body.classList.contains('menu-open'));
$('scrim').onclick=()=>setMenu(false);
function go(id){if(location.hash==='#'+id) route();else location.hash=id;}
function route(){
  const id=Object.hasOwn(pages,location.hash.slice(1))?location.hash.slice(1):'studio';
  for(const key of Object.keys(pages)) $(key).hidden=id!==key;
  $('crumb').textContent=pages[id][0];document.title=pages[id][0]+' · Querydesk';
  document.querySelectorAll('[data-route]').forEach(el=>{const active=id===el.dataset.route;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  if(id==='history') renderHistory();
  setMenu(false);window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>go(el.dataset.nav));
document.querySelectorAll('[data-route]').forEach(el=>el.onclick=()=>setMenu(false));
function queryRows(sql){
  const statement=db.prepare(sql);
  try {const rows=[];while(statement.step()) rows.push(statement.getAsObject());return rows;}finally{statement.free();}
}
function schema(){
  const built=[];
  for(const [table,description] of Object.entries(descriptions)){
    const fields=queryRows('PRAGMA table_info('+table+')');
    const links=queryRows('PRAGMA foreign_key_list('+table+')');
    const n=queryRows('SELECT COUNT(*) AS n FROM '+table)[0].n;
    const body=fields.map(f=>'<tr><td>'+esc(f.name)+'</td><td>'+esc(f.type)+'</td><td>'+esc(f.pk?'Primary key':links.some(l=>l.from===f.name)?'Foreign key':'—')+'</td></tr>').join('');
    built.push('<article class="card schema-card"><div class="card-head"><div class="head-glyph lavender">'+icon('table')+'</div><h2>'+table+'</h2><span class="count-badge">'+n.toLocaleString()+' rows</span></div><p class="schema-desc">'+description+'</p><div class="table-wrap"><table><thead><tr><th>Column</th><th>Type</th><th>Key</th></tr></thead><tbody>'+body+'</tbody></table></div>'+(links.length?'<div class="relation">'+links.map(l=>esc(l.from+' → '+l.table+'.'+l.to)).join(' · ')+'</div>':'')+'</article>');
  }
  $('schemaTables').innerHTML=built.join('');
}
function renderHistory(){
  const list=$('historyItems');
  if(!history.length){list.innerHTML='<div class="card empty">Your next successful query will appear here.</div>';return;}
  list.innerHTML=history.map(({q,t},i)=>'<button class="history-row" data-history="'+i+'"><span class="head-glyph lavender">'+icon('history')+'</span><span><strong>'+esc(q)+'</strong><small>'+esc(new Date(t).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}))+'</small></span>'+icon('chev')+'</button>').join('');
}
function saveHistory(q){history=[{q,t:Date.now()},...history.filter(h=>h.q!==q)].slice(0,40);try{localStorage.setItem(historyKey,JSON.stringify(history));}catch{}}
function highlight(sql){
  const token=/'(?:''|[^'])*'|\b(?:SELECT|FROM|WHERE|AND|OR|AS|GROUP BY|ORDER BY|LIMIT|DESC|ASC|JOIN|ON|DISTINCT|SUM|COUNT|AVG|ROUND|COALESCE|strftime|substr|NULLIF|CAST|INTEGER)\b|\b\d+(?:\.\d+)?\b/gi;
  return sql.split('\n').map((line,index)=>{
    const parts=[];let at=0;
    for(const match of line.matchAll(token)){
      const word=match[0],style=word[0]==="'"?'str':/^\d/.test(word)?'num':/^(sum|count|avg|round|coalesce|strftime|substr|nullif|cast)$/i.test(word)?'fn':'kw';
      parts.push(esc(line.slice(at,match.index)),'<span class="'+style+'">'+esc(word)+'</span>');at=match.index+word.length;
    }
    parts.push(esc(line.slice(at)));
    return '<div class="code-line"><span class="ln" aria-hidden="true">'+(index+1)+'</span><code>'+parts.join('')+'</code></div>';
  }).join('');
}
function renderResult({plan,rows,ms}){
  const {html,type}=visualization(plan,rows);
  $('chart').innerHTML=html;$('chartType').textContent=type;$('code').innerHTML=highlight(plan.sql);$('code').scrollTop=0;$('code').scrollLeft=0;
  $('rowcount').textContent=rows.length+' '+(rows.length===1?'row':'rows');
  const metric=plan.metrics[0],max=metric?Math.max(0,...rows.map(r=>r[metric]||0)):0;
  const numeric=key=>isMoney(key)||typeof rows.find(r=>r[key]!==null)?.[key]==='number';
  const titles=plan.columns.map(k=>'<th scope="col" class="'+(numeric(k)?'is-number':'')+'">'+esc(labels[k]||k)+'</th>').join('');
  const body=rows.map((row,i)=>'<tr><td class="index">'+(i+1)+'</td>'+plan.columns.map(k=>{
    const value=esc(format(k,row[k]));
    if(rows.length>1&&k===metric&&max>0) return '<td class="barcell is-number"><div class="revenue-cell"><span aria-hidden="true" class="mini-track"><i style="width:'+Math.max(0,row[k]/max*100)+'%"></i></span>'+value+'</div></td>';
    return '<td class="'+(numeric(k)?'is-number':'')+'">'+value+'</td>';}).join('')+'</tr>').join('');
  $('results').innerHTML=rows.length?'<div class="table-wrap"><table><thead><tr><th class="index" scope="col">#</th>'+titles+'</tr></thead><tbody>'+body+'</tbody></table></div>':'<p class="empty">No matching rows. The sample covers January–December 2025.</p>';
  $('resultFooter').innerHTML=icon('check')+'Query completed'+(plan.limit===rows.length?' · Limited to '+plan.limit+' rows':'')+'<span class="elapsed">'+ms+' ms</span>';
  $('copy').disabled=false;$('export').disabled=!rows.length;
  $('announce').textContent='Query completed. '+rows.length+' results.';
}
function run(question,remember=true){
  if(!available)return;
  $('error').hidden=true;
  try {
    const plan=compile(question,catalog),t=performance.now();
    const rows=queryRows(plan.sql),ms=Math.max(.1,performance.now()-t).toFixed(1);
    current={plan,rows,ms};renderResult(current);$('output').hidden=false;
    if(remember)saveHistory(question.trim());
  } catch(error) {
    $('error').textContent=error.message;$('error').hidden=false;$('output').hidden=true;current=null;
  }
}
$('composer').addEventListener('submit',e=>{e.preventDefault();run($('question').value);});
$('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();run($('question').value);}});
$('suggestions').onclick=e=>{const button=e.target.closest('[data-prompt]');if(button&&available){const q=suggestions[+button.dataset.prompt][1];$('question').value=q;run(q);}};
$('historyItems').onclick=e=>{const button=e.target.closest('[data-history]');if(button&&available){const q=history[+button.dataset.history].q;$('question').value=q;go('studio');run(q);}};
let copyTimer;
$('copy').onclick=async()=>{
  if(!current)return;
  try{await navigator.clipboard.writeText(current.plan.sql);}catch{
    const range=document.createRange();range.selectNodeContents($('code'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    $('announce').textContent='SQL selected. Use your browser’s copy command.';return;
  }
  $('copy').innerHTML=icon('check');$('copy').setAttribute('aria-label','SQL copied');$('announce').textContent='SQL copied.';clearTimeout(copyTimer);
  copyTimer=setTimeout(()=>{$('copy').innerHTML=icon('copy');$('copy').setAttribute('aria-label','Copy SQL');},1400);
};
$('export').onclick=()=>{
  if(!current)return;
  const {plan,rows}=current, csvValue=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=[plan.columns,...rows.map(row=>plan.columns.map(k=>row[k]))].map(row=>row.map(csvValue).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='querydesk-'+plan.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
route();
async function boot(){
  try {
    if(!window.initSqlJs && document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
    const [SQL,bytes]=await Promise.all([window.initSqlJs(),fetch('./retail.sqlite').then(r=>{if(!r.ok)throw Error('Database unavailable');return r.arrayBuffer();})]);
    db=new SQL.Database(new Uint8Array(bytes));db.run('PRAGMA query_only=ON');
    const values=(table,col)=>queryRows('SELECT DISTINCT '+col+' AS v FROM '+table+' ORDER BY LENGTH('+col+') DESC').map(r=>r.v);
    catalog={latest:queryRows('SELECT MAX(order_date) AS d FROM orders')[0].d,values:{product:values('products','name'),customer:values('customers','name'),category:values('products','category'),region:values('customers','region')}};
    schema();available=true;$('run').disabled=false;$('connection').textContent='Database connected';run(initialQuestion,false);
  }catch(err){
    $('connection').textContent='Database unavailable';document.querySelector('.online-dot').style.background='#e69d83';
    $('error').textContent='The sample database could not open. Reload the page to try again.';$('error').hidden=false;$('output').hidden=true;
  }finally{$('output').setAttribute('aria-busy','false');}
}
boot();
