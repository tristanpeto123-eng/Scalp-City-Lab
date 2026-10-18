// Public, READ-ONLY signed report endpoint. Separate process, no broker keys.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {verifyReport} from './grade-pipeline.mjs';
const allowed='https://tristanpeto123-eng.github.io';
export function serve({directory,bind='127.0.0.1',port=8790,publisherPublicKey}={}){
  if(!directory||!path.isAbsolute(directory))
    throw Error('PUBLICATION: explicit private directory required');
  if(!publisherPublicKey)throw Error('PUBLICATION: pinned Ed25519 verifier key required');
  const filename=path.join(directory,'public-exam-report.json');
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin',allowed);
    res.setHeader('Vary','Origin');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'");
    if(req.method!=='GET'||req.url!=='/api/academy'){
      res.writeHead(404).end('{}');return;
    }
    try{
      const data=JSON.parse(await readFile(filename,'utf8'));
      const verified=verifyReport(data,publisherPublicKey);
      const stamped=Date.parse(verified.generatedAt),now=Date.now();
      if(verified.schema!=='ROBOT_ACADEMY_SIGNED_FORWARD_V1'||
         verified.source!=='SERVER_VERIFIED_ALPACA_PAPER'||
         verified.paperOnly!==true||!Number.isFinite(stamped)||
         stamped>now+300000||now-stamped>36*3600_000)
        throw Error('Published evidence invalid or expired');
      // Only the sanitized signed payload is public; private journal is not.
      res.writeHead(200).end(JSON.stringify(data));
    }catch{
      res.writeHead(503).end(JSON.stringify({status:'NO_SIGNED_FORWARD_REPORT'}));
    }
  });
  server.listen(port,bind);
  return server;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href)
  serve({directory:process.env.TEACHER_PRIVATE_DIR,
    bind:process.env.TEACHER_PUBLIC_BIND||'127.0.0.1',
    port:Number(process.env.TEACHER_PUBLIC_PORT||8790),
    publisherPublicKey:process.env.TEACHER_PUBLISH_PUBLIC_KEY_PEM});
