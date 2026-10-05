import PostalMime from 'postal-mime';
import {email,text,DomainError} from './domain.mjs';

const utf8=new TextEncoder();
const decode=new TextDecoder();
export const MAIL_ACCOUNT='a8wlhg942@naver.com';
export const MAX_MAIL_BYTES=8*1024*1024;
export class MailError extends Error {
  constructor(code,unknown=false){super(code);this.code=code;this.deliveryUnknown=unknown;}
}
export function mailErrorMessage(code){
  if(code==='IMAP_UIDVALIDITY_MISSING'||code==='IMAP_UIDVALIDITY_INVALID') return '네이버 로그인은 성공했지만 메일함 식별 정보를 확인하지 못했습니다. 기존 수집 기록은 유지됩니다. 다시 수집해도 같은 코드가 나오면 서버 응답 확인이 필요합니다.';
  if(code==='NAVER_AUTH_REJECTED') return '네이버 로그인이 거절되었습니다. IMAP/SMTP 사용 설정과 Cloudflare의 NAVER_APP_PASSWORD를 확인하세요.';
  return '메일 연결을 확인하세요. 설정과 상태 코드를 참고하세요.';
}
// RFC 3501: UIDs are meaningful only together with the mailbox's non-zero
// 32-bit UIDVALIDITY. Never invent a value or reuse another mailbox's value.
function uidValidity(lines,status=false){
  let result;
  for(const line of lines){
    const attributes=status?line.match(/^\* STATUS (?:INBOX|"INBOX") \(([^)]*)\)\s*$/i)?.[1]:undefined;
    const match=status?attributes?.match(/(?:^|\s)UIDVALIDITY\s+(\d+)(?=\s|$)/i):line.match(/^(?:\*|[a-z0-9]+) OK \[UIDVALIDITY\s+(\d+)\]/i);
    if(!match)continue;
    const value=Number(match[1]);
    if(!Number.isInteger(value)||value<1||value>0xffffffff||result!==undefined&&result!==value) throw new MailError('IMAP_UIDVALIDITY_INVALID');
    result=value;
  }
  return result;
}
export function base64(bytes) {
  let binary='';for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export function unbase64(value){const s=atob(value);return Uint8Array.from(s,c=>c.charCodeAt(0));}
export class BufferedReader {
  constructor(stream){this.reader=stream.getReader();this.buffer=new Uint8Array();}
  async fill(){
    let timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new MailError('MAIL_TIMEOUT')),15000);});
    let result;try{result=await Promise.race([this.reader.read(),timeout]);}finally{clearTimeout(timer);}
    if(result.done) throw new MailError('MAIL_CONNECTION_CLOSED');
    const joined=new Uint8Array(this.buffer.length+result.value.length);joined.set(this.buffer);joined.set(result.value,this.buffer.length);this.buffer=joined;
  }
  async exact(n){
    if(n>MAX_MAIL_BYTES) throw new MailError('MAIL_TOO_LARGE');
    while(this.buffer.length<n) await this.fill();
    const result=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n);return result;
  }
  async line(){
    for(;;){
      const index=this.buffer.findIndex((b,i)=>b===10 && i>0 && this.buffer[i-1]===13);
      if(index>=0){const result=decode.decode(this.buffer.subarray(0,index-1));this.buffer=this.buffer.slice(index+1);return result;}
      if(this.buffer.length>65536) throw new MailError('MAIL_PROTOCOL_LIMIT');
      await this.fill();
    }
  }
}
export function imapQuote(value){
  if(/[\r\n\0]/.test(value)) throw new MailError('MAIL_INVALID_CREDENTIAL');
  return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
}
export class ImapClient {
  constructor(socket){this.socket=socket;this.reader=new BufferedReader(socket.readable);this.writer=socket.writable.getWriter();this.sequence=0;}
  async open(password){
    if(!(await this.reader.line()).startsWith('* OK')) throw new MailError('IMAP_GREETING_REJECTED');
    await this.command(`LOGIN ${imapQuote(MAIL_ACCOUNT)} ${imapQuote(password)}`);
    const selected=await this.command('SELECT INBOX');
    let validity=uidValidity(selected.lines);
    // Some servers omit this required SELECT response code. Ask for the
    // selected mailbox's standard STATUS attribute before searching messages.
    if(validity===undefined){
      let status;
      try{status=await this.command('STATUS "INBOX" (UIDVALIDITY)');}
      catch(e){if(e.code==='IMAP_COMMAND_REJECTED')throw new MailError('IMAP_UIDVALIDITY_MISSING');throw e;}
      validity=uidValidity(status.lines,true);
    }
    if(validity===undefined) throw new MailError('IMAP_UIDVALIDITY_MISSING');
    this.validity=validity;
  }
  async command(command){
    const tag='B'+String(++this.sequence).padStart(5,'0');
    await this.writer.write(utf8.encode(tag+' '+command+'\r\n'));
    const lines=[],literals=[];
    for(let i=0;i<1000;i++){
      const line=await this.reader.line();lines.push(line);
      const literal=line.match(/\{(\d+)\}\+?$/);
      if(literal) literals.push(await this.reader.exact(Number(literal[1])));
      if(line.startsWith(tag+' ')){
        if(!line.startsWith(tag+' OK')) throw new MailError(command.startsWith('LOGIN')?'NAVER_AUTH_REJECTED':'IMAP_COMMAND_REJECTED');
        return {lines,literals};
      }
    }
    throw new MailError('IMAP_PROTOCOL_LIMIT');
  }
  async search(lastUID=0){
    const since=new Date(Date.now()-30*86400000);
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const query=lastUID?`UID SEARCH UID ${lastUID+1}:*`:`UID SEARCH UNSEEN SINCE ${since.getUTCDate()}-${months[since.getUTCMonth()]}-${since.getUTCFullYear()}`;
    const response=await this.command(query);
    // IMAP's range after:* may still include the last existing UID when after is larger.
    return response.lines.filter(l=>l.startsWith('* SEARCH')).flatMap(l=>l.slice(8).trim().split(/\s+/).map(Number)).filter(n=>Number.isSafeInteger(n)&&n>lastUID).sort((a,b)=>a-b).slice(0,25);
  }
  async fetch(uid,headerOnly=false){
    if(!Number.isSafeInteger(uid)||uid<=0) throw new MailError('IMAP_INVALID_UID');
    const part=headerOnly?'HEADER.FIELDS (FROM TO SUBJECT MESSAGE-ID IN-REPLY-TO REFERENCES DATE CONTENT-TYPE)':'';
    const r=await this.command(`UID FETCH ${uid} (BODY.PEEK[${part}])`);
    if(r.literals.length!==1) throw new MailError('IMAP_MESSAGE_MISSING');
    return r.literals[0];
  }
  async size(uid){
    const r=await this.command(`UID FETCH ${uid} (RFC822.SIZE)`);
    const n=Number(r.lines.join(' ').match(/RFC822.SIZE\s+(\d+)/i)?.[1]);
    if(!Number.isSafeInteger(n)||n<=0) throw new MailError('IMAP_SIZE_MISSING');return n;
  }
  async close(){try{await this.command('LOGOUT');}catch{}try{await this.socket.close();}catch{}}
}
export function quotationSubject(subject){return /견적|quotation|\bquote\b|\bRFQ\b|\[BNQ-/i.test(subject);}
export async function parseMail(bytes){
  const parsed=await PostalMime.parse(bytes);
  const htmlPlain=(parsed.html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ');
  return {messageId:text(parsed.messageId,500),subject:text(parsed.subject,1000),from:text(parsed.from?.address,254),fromName:text(parsed.from?.name,200),date:parsed.date||'',inReplyTo:text(parsed.inReplyTo,500),references:parsed.references||'',body:text(parsed.text||htmlPlain,600000),attachments:(parsed.attachments||[]).map(a=>({name:text(a.filename||'attachment',200),type:text(a.mimeType,100),size:a.content?.byteLength||0}))};
}
export function encodeHeader(value){
  const words=[];let chunk='';
  for(const c of text(value,1000).replace(/[\r\n]/g,' ')){
    if(utf8.encode(chunk+c).length>42){words.push('=?UTF-8?B?'+base64(utf8.encode(chunk))+'?=');chunk='';}chunk+=c;
  }
  if(chunk) words.push('=?UTF-8?B?'+base64(utf8.encode(chunk))+'?=');
  return words.join('\r\n ');
}
const wrap64=bytes=>base64(bytes).match(/.{1,76}/g)?.join('\r\n')||'';
export function buildMessage({to,subject,plain,html,attachment,messageId,replyToMessageId}){
  to=email(to);const id=text(messageId,120);
  if(!/^[a-zA-Z0-9._-]+$/.test(id)) throw new DomainError('메일 식별자를 확인하세요.');
  const mix='bnm_'+id,alt='bna_'+id;
  const headers=[`From: ${encodeHeader('볼트노트')} <${MAIL_ACCOUNT}>`,`To: ${to}`,`Subject: ${encodeHeader(subject)}`,`Date: ${new Date().toUTCString()}`,`Message-ID: <${id}@naver.com>`,'MIME-Version: 1.0'];
  if(replyToMessageId && /^<[^<>\r\n]{1,490}>$/.test(replyToMessageId)) headers.push(`In-Reply-To: ${replyToMessageId}`,`References: ${replyToMessageId}`);
  headers.push(`Content-Type: multipart/mixed; boundary="${mix}"`);
  let body=`--${mix}\r\nContent-Type: multipart/alternative; boundary="${alt}"\r\n\r\n`;
  for(const [type,content] of [['text/plain',plain],['text/html',html||plain]]) body+=`--${alt}\r\nContent-Type: ${type}; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap64(utf8.encode(content||''))}\r\n`;
  body+=`--${alt}--\r\n`;
  if(attachment){
    if(!/^[a-zA-Z0-9._-]+\.pdf$/.test(attachment.filename)) throw new DomainError('PDF 파일 이름을 확인하세요.');
    body+=`--${mix}\r\nContent-Type: application/pdf; name="${attachment.filename}"\r\nContent-Disposition: attachment; filename="${attachment.filename}"\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap64(attachment.bytes)}\r\n`;
  }
  return headers.join('\r\n')+'\r\n\r\n'+body+`--${mix}--\r\n`;
}
async function smtpResponse(reader){
  let code;
  for(let i=0;i<100;i++){
    const line=await reader.line();const m=line.match(/^(\d{3})([ -])/);
    if(!m) throw new MailError('SMTP_PROTOCOL_ERROR');
    if(code && code!==m[1]) throw new MailError('SMTP_PROTOCOL_ERROR');code=m[1];
    if(m[2]===' ') return Number(code);
  }
  throw new MailError('SMTP_PROTOCOL_LIMIT');
}
export async function sendSMTP(socket,password,to,message){
  const reader=new BufferedReader(socket.readable),writer=socket.writable.getWriter();let dataSent=false,accepted=false;
  const command=async(line,expected)=>{
    if(line!=null) await writer.write(utf8.encode(line+'\r\n'));
    const code=await smtpResponse(reader);
    if(!expected.includes(code)) throw new MailError(`SMTP_REJECTED_${code}`);
  };
  try{
    await command(null,[220]);await command('EHLO boltnote.workers.dev',[250]);
    await command('AUTH LOGIN',[334]);await command(base64(utf8.encode(MAIL_ACCOUNT)),[334]);await command(base64(utf8.encode(password)),[235]);
    await command(`MAIL FROM:<${MAIL_ACCOUNT}>`,[250]);await command(`RCPT TO:<${email(to)}>`,[250,251]);await command('DATA',[354]);
    const safe=message.replace(/^\./gm,'..');
    // A disconnect from this point may have occurred after server acceptance.
    // Preserve an unknown-delivery state instead of automatically sending twice.
    dataSent=true;await writer.write(utf8.encode(safe.replace(/\r?\n/g,'\r\n')+'\r\n.\r\n'));
    await command(null,[250]);accepted=true;
    try{await writer.write(utf8.encode('QUIT\r\n'));}catch{}
    return {status:'accepted'};
  }catch(e){if(dataSent&&!accepted&&!e.code?.startsWith('SMTP_REJECTED_')) throw new MailError('SMTP_DELIVERY_UNKNOWN',true);throw e;}
  finally{try{await socket.close();}catch{}}
}
