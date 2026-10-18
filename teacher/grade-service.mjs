// Public, READ-ONLY signed report endpoint. Separate process, no broker keys.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const allowed='https://tristanpeto123-eng.github.io';
export function serve({directory,bind='127.0.0.1',port=8790}={}){
  if(!directory||!path.isAbsolute(directory))
    throw Error('PUBLICATION: explicit private directory required');
  const filename=path.join(directory,'public-exam-report.json');
  const server=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin',allowed);
    res.setHeader('Vary','Origin');
    if(req.method!=='GET'||req.url!=='/api/academy'){
      res.writeHead(404).end('{}');return;
    }
    try{
      const data=JSON.parse(await readFile(filename,'utf8'));
      if(data.algorithm!=='Ed25519'||typeof data.signature!=='string'||
         data.payload?.schema!=='ROBOT_ACADEMY_SIGNED_FORWARD_V1')
        throw Error('Published evidence invalid');
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
    port:Number(process.env.TEACHER_PUBLIC_PORT||8790)});
