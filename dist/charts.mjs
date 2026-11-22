import {labels} from './engine.mjs';
export function esc(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2});
const fullCurrency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const count=new Intl.NumberFormat('en-US');
const monthFormat=new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
export function isMoney(key){return ['revenue','avg_order_value','price','total'].includes(key);}
export function format(key,value,short=false) {
  if(value===null || value===undefined) return '—';
  if(isMoney(key)) return (short?currency:fullCurrency).format(value);
  if(key==='month') return monthFormat.format(new Date(value+'-01T00:00:00Z'));
  return typeof value==='number'?count.format(value):String(value);
}
function timeChart(rows,dim,metric) {
  const w=540,h=156,l=47,r=15,t=13,b=28;
  const vals=rows.map(row=>Number(row[metric])||0);
  const raw=Math.max(...vals,1)/3.5,mag=10**Math.floor(Math.log10(raw));
  const tick=[1,2,2.5,5,10].find(s=>s>=raw/mag)*mag, top=Math.ceil(Math.max(...vals,1)/tick)*tick;
  const y=value=>t+(1-value/top)*(h-b-t);
  const points=vals.map((v,i)=>({x:l+(w-r-l)*(rows.length===1?.5:i/(rows.length-1)),y:y(v)}));
  let line='M '+points[0].x+' '+points[0].y;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],p=points[i],mid=(a.x+p.x)/2;
    line+=' C '+mid+' '+a.y+' '+mid+' '+p.y+' '+p.x+' '+p.y;
  }
  const area=line+' L '+points.at(-1).x+' '+(h-b)+' L '+points[0].x+' '+(h-b)+' Z';
  const grid=[];
  for(let v=0;v<=top+tick*.01;v+=tick){
    const label=(isMoney(metric)?'$':'')+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v);
    grid.push('<path d="M '+l+' '+y(v)+' H '+(w-r)+'" stroke="#e4e3ec" stroke-dasharray="3 4"/><text x="'+(l-8)+'" y="'+(y(v)+4)+'" text-anchor="end">'+esc(label)+'</text>');
  }
  const stride=Math.ceil(rows.length/6);
  const dots=rows.map((row,i)=>{
    const p=points[i],long=format(dim,row[dim]);
    const label=dim==='month' && rows[0][dim].slice(0,4)===rows.at(-1)[dim].slice(0,4)?long.split(' ')[0]:long;
    const tickLabel=i%stride===0 || i===rows.length-1 && rows.length<=7?'<text x="'+p.x+'" y="'+(h-5)+'" text-anchor="middle">'+esc(label)+'</text>':'';
    return (rows.length<=36?'<circle cx="'+p.x+'" cy="'+p.y+'" r="3.7" fill="#fff" stroke="#8356de" stroke-width="2"><title>'+esc(long+' · '+format(metric,row[metric]))+'</title></circle>':'')+tickLabel;
  }).join('');
  return '<svg class="plot" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(labels[metric]+' by '+dim)+'"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#ad86f5" stop-opacity=".40"/><stop offset="100%" stop-color="#b193ef" stop-opacity=".04"/></linearGradient></defs>'+grid.join('')+'<path d="'+area+'" fill="url(#areaFill)"/><path d="'+line+'" fill="none" stroke="#8455df" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>'+dots+'</svg>';
}
export function visualization(plan,rows){
  const metric=plan.metrics[0],dim=plan.dims[0];
  if(!rows.length || !metric) return {type:'',html:'<div class="empty">'+(!rows.length?'No values to chart for this query.':'This query returns individual records. Explore them in the results table.')+'</div>'};
  const time=['month','day','year','quarter'].includes(dim);
  const grouped=!!dim;
  const canSum=!['avg_order_value','customers','products','orders'].includes(metric)||metric==='orders'&&plan.dims.every(d=>!['category','product'].includes(d));
  const total=rows.reduce((s,r)=>s+(Number(r[metric])||0),0);
  const max=Math.max(...rows.map(r=>Number(r[metric])||0),0);
  const headline=!grouped?rows[0][metric]:canSum?total:max;
  const heading=!grouped?labels[metric]:canSum?(plan.limit&&rows.length===plan.limit?'Returned '+labels[metric].toLowerCase():'Total '+labels[metric].toLowerCase()):'Highest '+labels[metric].toLowerCase();
  const legend=grouped?'<div class="legend"><i></i>'+esc(labels[metric])+'</div>':'';
  let html='<div class="chart-info"><div><div class="chart-label">'+esc(heading)+'</div><div class="metric">'+esc(format(metric,headline,true))+'</div></div>'+legend+'</div>';
  if(!grouped) return {type:'Summary',html};
  if(time && plan.dims.length===1){
    const sorted=[...rows].sort((a,b)=>String(a[dim]).localeCompare(String(b[dim])));
    return {type:'Area chart',html:html+timeChart(sorted,dim,metric)};
  }
  html+='<div class="rank-list">'+rows.map(row=>{
    const name=plan.dims.map(key=>format(key,row[key],true)).join(' · ');
    return '<div class="rank-row"><span title="'+esc(name)+'">'+esc(name)+'</span><div class="rank-track"><i style="width:'+Math.max(0,Number(row[metric])/(max||1)*100)+'%"></i></div><span>'+esc(format(metric,row[metric],true))+'</span></div>';
  }).join('')+'</div>';
  return {type:'Bar chart',html};
}
