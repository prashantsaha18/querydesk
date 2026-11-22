export const initialQuestion = 'Show monthly revenue for the first half of 2025.';
export const suggestions = [
  ['Top products', 'Which are the top 5 products by revenue?'],
  ['Orders by region', 'How many orders came from each region?'],
  ['Average order value', 'What was the average order value by month in 2025?']
];
const months = 'january february march april may june july august september october november december'.split(' ');
const dimensions = {
  month: ["strftime('%Y-%m', o.order_date)", 'Month'],
  quarter: ["substr(o.order_date, 1, 4) || '-Q' || CAST((CAST(substr(o.order_date, 6, 2) AS INTEGER) + 2) / 3 AS INTEGER)", 'Quarter'],
  year: ["substr(o.order_date, 1, 4)", 'Year'],
  day: ['o.order_date', 'Day'],
  product: ['p.name', 'Product'], category: ['p.category', 'Category'], region: ['c.region', 'Region'], customer: ['c.name', 'Customer']
};
export const labels = { revenue:'Revenue', orders:'Orders', customers:'Customers', products:'Products', units:'Units sold', avg_order_value:'Average order value', price:'Price', total:'Order total', order_id:'Order ID', order_date:'Order date', name:'Name', customer_id:'Customer ID', product_id:'Product ID', table_name:'Table name', ...Object.fromEntries(Object.entries(dimensions).map(([k,v])=>[k,v[1]])) };
const guidance = 'Try a revenue, order count, average order value, or units sold question. You can group by month, region, category, customer, or product.';
function reject(detail = '') { throw new Error(detail || guidance); }
function quote(s) { return "'" + String(s).replaceAll("'", "''") + "'"; }
function regexEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function iso(year, month, day = 1) { return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0,10); }
function dateWindow(source, latest) {
  let q = source, start, end;
  const refYear = +latest.slice(0,4), refMonth = +latest.slice(5,7);
  const trailing=q.match(/\b(?:last|past|previous) (\d{1,3}) (days?|months?|years?)\b/);
  if(trailing){
    const n=Number(trailing[1]);
    if(n<1) reject('Use a positive number of days, months, or years.');
    const unit=trailing[2][0], day=+latest.slice(8);
    start=unit==='d'?iso(refYear,refMonth,day-n+1):unit==='m'?iso(refYear,refMonth-n+1):iso(refYear-n+1,1);
    end=iso(refYear,refMonth,day+1);
    return {q:q.replace(trailing[0],' '),start,end};
  }
  const yearMatches = [...q.matchAll(/\b(19\d{2}|20\d{2})\b/g)];
  const year = yearMatches.length ? +yearMatches[0][1] : refYear;
  const dates = [...q.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0]);
  if (dates.length) {
    if (dates.some(d=>Number.isNaN(Date.parse(d)) || new Date(d).toISOString().slice(0,10)!==d)) reject('Use a valid calendar date in YYYY-MM-DD format.');
    if (dates.length===2 && /\b(between|from)\b/.test(q)) {
      start=dates[0]; end=iso(+dates[1].slice(0,4),+dates[1].slice(5,7),+dates[1].slice(8)+1);
      q=q.replace(dates[0],' ').replace(dates[1],' ');
    } else if(dates.length===1) {
      const d=dates[0], next=iso(+d.slice(0,4),+d.slice(5,7),+d.slice(8)+1);
      if (/\b(before|until)\b/.test(q)) end=d;
      else if (/\bafter\b/.test(q)) start=next;
      else if (/\bsince\b/.test(q)) start=d;
      else {start=d;end=next;}
      q=q.replace(d,' ').replace(/\b(before|until|after|since)\b/g,' ');
    } else reject('Use one date, or a range such as “between 2025-01-01 and 2025-03-31”.');
  } else {
    if(yearMatches.length>1) reject('Use one calendar year or two full dates in YYYY-MM-DD format.');
    q=q.replace(/\b(19\d{2}|20\d{2})\b/g,' ');
    const names=new RegExp('\\b('+months.flatMap(m=>[m,m.slice(0,3)]).join('|')+')\\b','g');
    const matched=[...q.matchAll(names)].map(m=>months.findIndex(name=>name.startsWith(m[1]))+1);
    let a,b;
    const half=q.match(/\b(first|second) (?:six months|half)\b|\bh([12])\b/);
    const quarter=q.match(/\bq([1-4])\b|\b(first|second|third|fourth) quarter\b/);
    const relative=q.match(/\b(last|this|latest) (month|year)\b/);
    if(matched.length){
      if(matched.length>2 || (matched.length===2 && !/\b(from|between|through|to)\b/.test(q))) reject('Use a single month or a range such as “January through June 2025”.');
      a=matched[0];b=matched.at(-1)+1;q=q.replace(names,' ');
    } else if(half){ a=(half[1]==='second'||half[2]==='2')?7:1;b=a+6;q=q.replace(half[0],' '); }
    else if(quarter){a=((+quarter[1]||(['first','second','third','fourth'].indexOf(quarter[2])+1))-1)*3+1;b=a+3;q=q.replace(quarter[0],' ');}
    else if(relative){
      if(yearMatches.length) reject('Choose a relative period or a calendar year.');
      const offset=relative[1]==='last'?1:0;
      if(relative[2]==='month'){start=iso(refYear,refMonth-offset);end=iso(refYear,refMonth-offset+1);}
      else {start=iso(refYear-offset,1);end=iso(refYear-offset+1,1);}
      q=q.replace(relative[0],' ');
    } else if(yearMatches.length){a=1;b=13;}
    if(a!==undefined){start=iso(year,a);end=iso(year,b);}
  }
  if(start && end && end<=start) reject('The start of the range must come before the end.');
  return {q,start,end};
}
const filler = new Set(('a an the of from to in for on by with as and how what which who is are was were did do does can could you me us we our my i want please give get find show list display tell calculate compute return see know have had has made generated generate bring brought came per each across over during through between at grouped group grouping broken down breakdown ranked rank sorted sort most least highest lowest biggest smallest best worst selling performing top bottom leading largest smallest first last recent latest total totals all overall much many number count counts ordered order orders sale sales revenue revenues income turnover earnings spend spending spent value average avg mean quantity quantities units unit sold items purchased purchases product products categories category customers customer people buyers buyer regions region monthly months month daily days day quarterly quarters quarter yearly annual annually years year trend trends time chart compare versus vs retail database shop store data dataset records rows names their they us dollar dollars there placed received recorded sold brought during was it orders sales our business did does that had have their from into made make earned earn listed list tell broken give show would like to see worth per spending spender spenders').split(' '));
function checkTerms(q) {
  const unknown = (q.match(/[a-z0-9]+/g)||[]).filter(t=>!filler.has(t));
  if(unknown.length) reject('I could not match “'+unknown.slice(0,3).join(' ')+'” to the sample schema. '+guidance);
}
export function compile(question, catalog) {
  if(typeof question!=='string' || !question.trim()) reject('Type a question to run a query.');
  if(question.length>400) reject('Keep your question under 400 characters.');
  let q=question.toLowerCase().trim().replaceAll('’',"'").replace(/['’]s\b/g,'').replace(/[-–]/g,(c,i,s)=>/\d/.test(s[i-1]||'')&&/\d/.test(s[i+1]||'')?c:' ').replace(/\s+/g,' ');
  if(/\b(delete|remove|drop|insert|update|alter|truncate|create|replace|modify|rename|erase|write|attach|pragma)\b/.test(q)) reject('This workspace is read-only. Ask to view, count, or summarize the sample data.');
  if(/[;=]|\b(select|union|join|execute|sql)\b/.test(q)) reject('Enter a plain-English question about the retail database.');
  if(/\b(growth|median|forecast|profit|margin|compared|change|percent|percentage|versus|vs|except|excluding|without|not|or|more than|less than|greater than|at least|at most)\b/.test(q)) reject('That comparison or condition is outside the supported query types. '+guidance);
  if(/^(?:(?:show|list|display|what are|which are) (?:me )?(?:all |the )*)?tables(?: (?:in|of) (?:this |the )?(?:database|dataset))?[?.!]*$/.test(q)){
    return {sql:"SELECT name AS table_name\nFROM sqlite_schema\nWHERE type = 'table'\n  AND name NOT LIKE 'sqlite_%'\nORDER BY name;",columns:['table_name'],metrics:[],dims:[],title:'Database tables',limit:null};
  }
  q=q.replace(/\bhow much (?:did (?:we|the store|the shop) )?(?:earn|make)\b/g,'revenue')
     .replace(/\b(?:money|revenue) (?:did )?(?:we )?(?:make|earn)\b/g,'revenue')
     .replace(/\b(?:biggest|highest|top) spenders\b/g,'top customers by spending')
     .replace(/\bbest sellers\b/g,'top products by units sold')
     .replace(/\border volume\b/g,'order count')
     .replace(/\b(?:avg|average) basket (?:value|size)\b/g,'average order value');
  const date=dateWindow(q,catalog.latest); q=date.q;
  const filters=[];
  for(const [key, values] of Object.entries(catalog.values)) {
    for(const value of values) {
      const re=new RegExp('\\b'+regexEscape(value.toLowerCase())+'\\b','g');
      if(re.test(q)){filters.push([key,value]);q=q.replace(re,' ');}
    }
  }
  if(new Set(filters.map(f=>f[0])).size!==filters.length) reject('Filter by one value per field, such as one region and one product category.');
  q=q.replace(/\s+/g,' ');
  const rank=q.match(/\b(top|bottom|first|last|most recent|latest|recent|highest|lowest|best|worst|largest|smallest)\s+(\d{1,3})\b/);
  const numberWords={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  const wordRank=q.match(/\b(top|bottom|first|last|best|worst)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  const rankLimit=rank?+rank[2]:wordRank?numberWords[wordRank[2]]:null;
  if(rankLimit!==null && (rankLimit<1 || rankLimit>100)) reject('Choose a result limit between 1 and 100.');
  if(rank) q=q.replace(rank[0],rank[1]);
  if(wordRank) q=q.replace(wordRank[0],wordRank[1]);
  const ranking=/\b(top|bottom|best|worst|highest|lowest|leading|most|least|biggest|largest|smallest)\b/.test(q);
  const dims=[];
  for(const [key, forms] of Object.entries({month:'month|months|monthly',quarter:'quarter|quarters|quarterly',year:'year|years|yearly|annual|annually',day:'day|days|daily',region:'region|regions',category:'category|categories',product:'product|products',customer:'customer|customers|buyer|buyers'})) {
    if(new RegExp('\\b('+forms+')\\b').test(q)) dims.push(key);
  }
  if(/\bover time\b|\btrend\b/.test(q)&&!dims.some(x=>['year','quarter','month','day'].includes(x))) dims.unshift('month');
  const avg=/\b(average|avg|mean)\b/.test(q);
  const money=/\b(revenues?|sales?|income|turnover|earnings|spend|spending|spent)\b/.test(q);
  const countOrders=/\borders?\b/.test(q.replace(/\b(average|avg|mean) (order|purchase) (value|amount|size)\b/g,''));
  const units=/\b(units?|quantit(?:y|ies)|items sold|products sold|best selling|selling)\b/.test(q);
  const count=/\b(how many|counts?|number of|total)\b/.test(q);
  let countCustomers=/\b(how many|count(?: of)?|number of|total|unique|distinct) (?:unique |distinct )?(?:customers?|buyers?)\b/.test(q);
  let countProducts=/\b(how many|count(?: of)?|number of|total|unique|distinct) (?:unique |distinct )?products?\b/.test(q)&&!units;
  if(!money && !avg && !countOrders && !units){
    if(/\bcustomers? (?:grouped )?by region\b/.test(q)) countCustomers=true;
    if(/\bproducts? (?:grouped )?by categor(?:y|ies)\b/.test(q)) countProducts=true;
  }
  if(countCustomers && !/\b(by|per|each) customer\b/.test(q)) dims.splice(dims.indexOf('customer'),1);
  if((countProducts||/\bproducts sold\b/.test(q)) && !/\b(by|per|each) product\b/.test(q)) {const pos=dims.indexOf('product');if(pos>=0)dims.splice(pos,1);}
  const grouped=/\b(by|per|each|grouped|breakdown|broken down|across|monthly|quarterly|daily|yearly|over time|trend)\b/.test(q);
  const rowMode=/\b(show|list|display|get|which|latest|recent|last|first)\b/.test(q) && !money && !avg && !count && !units && !grouped && (!ranking || /\bmost recent\b/.test(q));
  let entity=dims.includes('customer')?'customers':dims.includes('product')?'products':countOrders?'orders':null;
  const metricKeys=[];
  if(money && !avg || /\btotal (revenue|sales)\b/.test(q)) metricKeys.push('revenue');
  if(avg) {
    if(!/\b(order|purchase) (value|amount|size)\b|\bper order\b/.test(q)) reject('For an average, ask for “average order value”, optionally grouped by month or region.');
    metricKeys.push('avg_order_value');
  }
  if(countOrders && !rowMode) metricKeys.push('orders');
  if(countCustomers) metricKeys.push('customers');
  if(countProducts) metricKeys.push('products');
  if(units) metricKeys.push('units');
  if(!rowMode && !metricKeys.length && ranking && dims.length) metricKeys.push('revenue');
  if(!rowMode && !metricKeys.length) reject();
  if(rowMode && !entity) reject();
  if(ranking && !rowMode && !dims.length) reject('Specify what to rank, such as products, customers, regions, or months.');
  checkTerms(q.replace(/\b(unique|distinct|amount|size|purchase)\b/g,' '));
  const keys=filters.map(f=>f[0]);
  const needsItem = dims.some(x=>['category','product'].includes(x)) || keys.some(x=>['category','product'].includes(x)) || units || countProducts;
  const needsCustomer=dims.includes('region')||dims.includes('customer')||keys.includes('customer')||keys.includes('region');
  const where=filters.map(([key,val])=>dimensions[key][0]+' = '+quote(val));
  if(date.start) where.push('o.order_date >= '+quote(date.start));
  if(date.end) where.push('o.order_date < '+quote(date.end));
  const ascending=/\b(bottom|lowest|least|worst|smallest)\b/.test(q);
  const limit=rankLimit || (ranking?(/\b(top|bottom|leading)\b/.test(q)?5:1):100);
  const hasDate=date.start||date.end;
  let select,from,group='',sort='',columns,title;
  const baseOnly=(rowMode&&entity==='products' || countProducts && metricKeys.length===1) && !hasDate && !needsCustomer && !dims.some(x=>['month','day','quarter','year'].includes(x));
  const customersOnly=(rowMode&&entity==='customers'||countCustomers&&metricKeys.length===1) && !hasDate && !needsItem && !dims.some(x=>['month','day','quarter','year'].includes(x));
  if(baseOnly) from='products AS p';
  else if(customersOnly) from='customers AS c';
  else {
    from='orders AS o';
    if(needsItem || rowMode&&entity==='products') from+='\nJOIN order_items AS i ON i.order_id = o.order_id\nJOIN products AS p ON p.product_id = i.product_id';
    if(needsCustomer || rowMode&&entity==='customers') from+='\nJOIN customers AS c ON c.customer_id = o.customer_id';
  }
  if(rowMode) {
    columns=entity==='orders'?['order_id','order_date','total']:entity==='products'?['product_id','name','category','price']:['customer_id','name','region'];
    const alias={orders:'o',products:'p',customers:'c'}[entity];
    select='DISTINCT '+columns.map(x=>alias+'.'+x).join(', ');
    sort=entity==='orders'?'o.order_date '+(/\bfirst\b/.test(q)?'ASC':'DESC')+', o.order_id':'name ASC';
    title=entity[0].toUpperCase()+entity.slice(1);
  } else {
    const revenue=needsItem?'SUM(i.quantity * i.unit_price)':'SUM(o.total)';
    const expr={revenue:'ROUND(COALESCE('+revenue+', 0), 2)',orders:'COUNT(DISTINCT o.order_id)',customers:'COUNT(DISTINCT '+(customersOnly?'c':'o')+'.customer_id)',products:'COUNT(DISTINCT p.product_id)',units:'COALESCE(SUM(i.quantity), 0)',avg_order_value:needsItem?'ROUND('+revenue+' / NULLIF(COUNT(DISTINCT o.order_id), 0), 2)':'ROUND(AVG(o.total), 2)'};
    columns=[...dims,...metricKeys];
    select=[...dims.map(d=>dimensions[d][0]+' AS '+d),...metricKeys.map(m=>expr[m]+' AS '+m)].join(',\n  ');
    if(dims.length) {
      group='\nGROUP BY '+dims.join(', ');
      sort=ranking||!dims.some(x=>['month','day','year','quarter'].includes(x))?metricKeys[0]+(ascending?' ASC':' DESC')+', '+dims.join(', '):dims.join(', ');
    }
    title=labels[metricKeys[0]]+(dims.length?' by '+dims.map(d=>d).join(' and '):'');
  }
  let prefix='',filterSql=where.length?'\nWHERE '+where.join('\n  AND '):'';
  // An order can contain multiple matching lines. Average each complete basket once per group.
  if(!rowMode && avg && needsItem){
    if(countProducts) reject('Ask for product count and average order value in two separate questions.');
    const fields=['o.order_id','o.customer_id','o.total', ...dims.map(d=>dimensions[d][0]+' AS '+d),'SUM(i.quantity * i.unit_price) AS item_revenue','SUM(i.quantity) AS item_units'];
    prefix='WITH matched_orders AS (\n  SELECT '+fields.join(',\n    ')+'\n  FROM '+from.replaceAll('\n','\n  ')+filterSql.replaceAll('\n','\n  ')+'\n  GROUP BY '+['o.order_id',...dims].join(', ')+'\n)\n';
    const expr={avg_order_value:'ROUND(AVG(total), 2)',orders:'COUNT(*)',customers:'COUNT(DISTINCT customer_id)',units:'COALESCE(SUM(item_units), 0)',revenue:'ROUND(COALESCE(SUM(item_revenue), 0), 2)'};
    select=[...dims,...metricKeys.map(m=>expr[m]+' AS '+m)].join(',\n  ');
    from='matched_orders';filterSql='';
  }
  const sql=prefix+'SELECT\n  '+select+'\nFROM '+from+filterSql+group+(sort?'\nORDER BY '+sort:'')+(rowMode||ranking&&dims.length||dims.length?'\nLIMIT '+limit:'')+';';
  return {sql,columns,dims:rowMode?[]:dims,metrics:rowMode?[]:metricKeys,title,limit:rowMode||dims.length?limit:null};
}
