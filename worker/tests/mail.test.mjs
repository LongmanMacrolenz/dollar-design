import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferedReader,ImapClient,parseMail,buildMessage,sendSMTP,quotationSubject,mailErrorMessage} from '../mail.mjs';
import {authorized,assertSameOrigin,jsonBody} from '../security.mjs';
const encoder=new TextEncoder();
function socket(reply,chunk=7){let p=0;const writes=[];return {writes,readable:new ReadableStream({pull(c){if(p>=reply.length)return c.close();c.enqueue(encoder.encode(reply.slice(p,p+=chunk)));}}),writable:new WritableStream({write(v){writes.push(new TextDecoder().decode(v));}}),close:async()=>{}};}
const imapLogin='* OK IMAP ready\r\nB00001 OK LOGIN completed\r\n';
const imapSelect='* FLAGS (\\Seen \\Answered)\r\n* 3 EXISTS\r\nB00002 OK [READ-WRITE] SELECT completed\r\n';
test('SELECT UIDVALIDITY remains the normal path without STATUS',async()=>{const s=socket(imapLogin+'* OK [UIDVALIDITY 987654321] UIDs valid\r\n'+imapSelect,1);const c=new ImapClient(s);await c.open('LOCAL_TEST_ONLY');assert.equal(c.validity,987654321);assert.equal(s.writes.length,2);assert.doesNotMatch(s.writes.join(''),/STATUS/);});
test('missing SELECT UIDVALIDITY is recovered with STATUS before UID SEARCH',async()=>{
  for(const mailbox of ['INBOX','"INBOX"']){
    const s=socket(imapLogin+imapSelect+`* STATUS ${mailbox} (UIDNEXT 101 UIDVALIDITY 4294967295 MESSAGES 3)\r\nB00003 OK STATUS completed\r\n* SEARCH 100\r\nB00004 OK SEARCH completed\r\n`,1);
    const c=new ImapClient(s);await c.open('LOCAL_TEST_ONLY');assert.equal(c.validity,4294967295);assert.deepEqual(await c.search(99),[100]);assert.equal(s.writes[2],'B00003 STATUS "INBOX" (UIDVALIDITY)\r\n');assert.match(s.writes[3],/^B00004 UID SEARCH UID 100:\*/);
  }
});
test('missing or other-mailbox STATUS validity cannot start intake',async()=>{
  for(const response of ['* STATUS INBOX (UIDNEXT 101)\r\nB00003 OK done\r\n','* STATUS "Archive" (UIDVALIDITY 123)\r\nB00003 OK done\r\n','B00003 NO STATUS unavailable\r\n']){
    const s=socket(imapLogin+imapSelect+response);const c=new ImapClient(s);await assert.rejects(c.open('LOCAL_TEST_ONLY'),{code:'IMAP_UIDVALIDITY_MISSING'});assert.equal(c.validity,undefined);assert.doesNotMatch(s.writes.join(''),/UID SEARCH|UID FETCH/);
  }
});
test('zero, oversized and inconsistent mailbox validity are rejected',async()=>{
  for(const selected of ['* OK [UIDVALIDITY 0] invalid\r\n','* OK [UIDVALIDITY 4294967296] invalid\r\n','* OK [UIDVALIDITY 42] valid\r\n* OK [UIDVALIDITY 43] changed\r\n']){
    const s=socket(imapLogin+selected+imapSelect);const c=new ImapClient(s);await assert.rejects(c.open('LOCAL_TEST_ONLY'),{code:'IMAP_UIDVALIDITY_INVALID'});assert.equal(c.validity,undefined);assert.doesNotMatch(s.writes.join(''),/UID SEARCH|STATUS/);
  }
  const c=new ImapClient(socket(imapLogin+imapSelect+'* STATUS INBOX (UIDVALIDITY 0)\r\nB00003 OK done\r\n'));await assert.rejects(c.open('LOCAL_TEST_ONLY'),{code:'IMAP_UIDVALIDITY_INVALID'});
});
test('UIDVALIDITY failure explains successful login without exposing protocol or secrets',()=>{assert.match(mailErrorMessage('IMAP_UIDVALIDITY_MISSING'),/로그인은 성공/);assert.match(mailErrorMessage('IMAP_UIDVALIDITY_INVALID'),/기존 수집 기록은 유지/);assert.match(mailErrorMessage('NAVER_AUTH_REJECTED'),/로그인이 거절/);});
test('IMAP literal framing survives fragmented reads and blank lines',async()=>{const body='Subject: RFQ\r\n\r\nline\r\n';const s=socket(`* 1 FETCH (BODY[] {${encoder.encode(body).length}}\r\n${body})\r\nB00001 OK done\r\n`,1);const r=await new ImapClient(s).command('UID FETCH 1 (BODY.PEEK[])');assert.equal(new TextDecoder().decode(r.literals[0]),body);});
test('IMAP UID after:* excludes old final UID returned by server',async()=>{const s=socket('* SEARCH 8 9 10\r\nB00001 OK search\r\n');assert.deepEqual(await new ImapClient(s).search(9),[10]);});
test('MIME parsing treats HTML as data and records attachment metadata',async()=>{const message=buildMessage({to:'customer@example.com',subject:'시험 견적 문의',plain:'품목 확인',html:'<script>attack()</script><p>품목 확인</p>',messageId:'test-01',attachment:{filename:'TEST.pdf',bytes:encoder.encode('%PDF-test')}});const parsed=await parseMail(encoder.encode(message));assert.equal(parsed.subject,'시험 견적 문의');assert.equal(parsed.body,'품목 확인');assert.equal(parsed.attachments[0].name,'TEST.pdf');assert.equal(parsed.attachments[0].size,9);});
test('header injection in recipient is rejected',()=>{assert.throws(()=>buildMessage({to:'a@example.com\r\nBcc:b@example.com',subject:'견적',messageId:'test',plain:'text'}));});
test('Korean subject encoding round-trips without broken Unicode',async()=>{const subject='긴 한글 견적 문의 '.repeat(10);const m=buildMessage({to:'customer@example.com',subject,plain:'본문',messageId:'unicode-test'});assert.equal((await parseMail(encoder.encode(m))).subject,subject.trim());});
const smtp='220 ready\r\n250-first\r\n250 AUTH LOGIN\r\n334 user\r\n334 pass\r\n235 ok\r\n250 sender\r\n250 recipient\r\n354 data\r\n';
test('SMTP acceptance and dot-stuffing are handled',async()=>{const s=socket(smtp+'250 queued\r\n');assert.equal((await sendSMTP(s,'LOCAL_TEST_ONLY','customer@example.com','.line\r\nbody')).status,'accepted');assert.match(s.writes.join(''),/\.\.line\r\nbody\r\n\.\r\n/);});
test('SMTP disconnect after DATA becomes unknown, never a retryable failure',async()=>{await assert.rejects(sendSMTP(socket(smtp),'LOCAL_TEST_ONLY','customer@example.com','body'),e=>e.deliveryUnknown&&e.code==='SMTP_DELIVERY_UNKNOWN');});
test('SMTP explicit rejection after DATA is a known failed delivery',async()=>{await assert.rejects(sendSMTP(socket(smtp+'550 rejected\r\n'),'LOCAL_TEST_ONLY','customer@example.com','body'),e=>!e.deliveryUnknown&&e.code==='SMTP_REJECTED_550');});
test('SMTP recipient rejection stops before DATA',async()=>{const s=socket(smtp.replace('250 recipient','550 recipient'));await assert.rejects(sendSMTP(s,'LOCAL_TEST_ONLY','customer@example.com','body'));assert.doesNotMatch(s.writes.join(''),/\r\nDATA\r\n/);});
test('only quote subjects enter the procurement inbox',()=>{assert(quotationSubject('견적 요청'));assert(quotationSubject('[BNQ-A1234567] 회신'));assert(!quotationSubject('개인 일정 변경'));});
test('admin authorization and origin validation reject unauthenticated writes',async()=>{const key='LOCAL_TEST_ONLY_'+'x'.repeat(32);assert(await authorized(new Request('https://example.com/api',{headers:{Authorization:'Bearer '+key}}),key));assert(!await authorized(new Request('https://example.com/api',{headers:{Authorization:'Bearer wrong'}}),key));assert(!await authorized(new Request('https://example.com/api'),'short'));assert.throws(()=>assertSameOrigin(new Request('https://example.com/api',{headers:{Origin:'https://evil.example'}})));});
test('streamed JSON size limit works without Content-Length',async()=>{await assert.rejects(jsonBody(new Request('https://example.com/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:'a'.repeat(100)})}),20),/너무 큽니다/);});
