// Synthetic IMAP/SMTP transports, substituted only by the integration test's
// esbuild plugin. They never create an external connection.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const csv='Description\tQty\tUnit\tSpecification\tNotes\nStud bolt\t20\tEA\tASTM A193 B7M 3/4"-10 UNC LENGTH 150 MM PLAIN\tNACE MR0175 / EN10204 3.1 / PMI';
const raw='From: Test Buyer <buyer@example.com>\r\nSubject: RFQ BOM test\r\nMessage-ID: <fixture-customer@example.com>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nNo substitutions. Please quote.\r\n--b\r\nContent-Type: text/csv; charset=utf-8\r\nContent-Disposition: attachment; filename="bom.csv"\r\n\r\n'+csv+'\r\n--b--\r\n';
export function connect({hostname}){
 let controller,step=0,closed=false;
 const put=v=>controller.enqueue(encoder.encode(v));
 const readable=new ReadableStream({start(c){controller=c;put(hostname.startsWith('imap')?'* OK synthetic IMAP\r\n':'220 synthetic SMTP\r\n');}});
 const writable=new WritableStream({write(bytes){
  const command=decoder.decode(bytes);
  if(hostname.startsWith('smtp')){const replies=['250 AUTH LOGIN','334 user','334 password','235 accepted','250 sender','250 recipient','354 data','250 queued','221 bye'];put((replies[step++]||'221 bye')+'\r\n');return;}
  const tag=command.split(' ')[0];let response='';
  if(command.includes('SELECT INBOX'))response='* OK [UIDVALIDITY 12345] valid\r\n';
  if(command.includes('UID SEARCH'))response='* SEARCH 1\r\n';
  if(command.includes('RFC822.SIZE'))response='* 1 FETCH (RFC822.SIZE '+encoder.encode(raw).length+')\r\n';
  else if(command.includes('UID FETCH'))response='* 1 FETCH (BODY[] {'+encoder.encode(raw).length+'}\r\n'+raw+')\r\n';
  put(response+tag+' OK done\r\n');
 }});
 return {readable,writable,close:async()=>{if(!closed){closed=true;controller.close();}}};
}
