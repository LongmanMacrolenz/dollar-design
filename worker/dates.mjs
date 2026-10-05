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
