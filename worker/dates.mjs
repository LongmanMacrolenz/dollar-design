// Customer-facing dates use the Korean business timezone; stored timestamps stay UTC.
export function businessDate(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
export function businessTime(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
  return businessDate(value)+' '+time+' KST';
}
export function referenceDateTime(value){
  const date=String(value??'').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
    const stamp=Date.parse(date+'T00:00:00+09:00');
    return Number.isFinite(stamp)&&businessDate(stamp)===date?stamp:NaN;
  }
  return Date.parse(date);
}
