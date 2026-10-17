// GitHub-only durable research memory. No trades, credentials, external DB or
// code edits. Write is confined by application to ONE JSON file on a dedicated
// model-memory branch. GitHub GITHUB_TOKEN must explicitly have contents:write.
// A failed GitHub persistence request aborts; we never claim success on failure.
import {emptyMemory,assertMemory,MEMORY_BRANCH} from './learning-memory.mjs';
const OWNER='tristanpeto123-eng',REPO='Scalp-City-Lab';
const PATH='scalp-learning/history.json';
const API='https://api.github.com/repos/'+OWNER+'/'+REPO+'/contents/'+PATH;
const isSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const headers=token=>({
  'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Scalp-City-Lab-Research',
  'Content-Type':'application/json'
});
const decode=s=>Buffer.from(s.replace(/\s/g,''),'base64').toString('utf8');
export async function loadGitHubMemory({fetchImpl=fetch,token,branch=MEMORY_BRANCH}={}){
 if(!token||typeof token!=='string'||branch!==MEMORY_BRANCH)throw Error('Memory branch/token missing');
 const url=API+'?ref='+encodeURIComponent(branch);
 const response=await fetchImpl(url,{method:'GET',headers:headers(token)});
 if(!response.ok)throw Error('Memory GET failed: HTTP '+response.status+'; do not start memory from scratch');
 const meta=await response.json();
 if(!isSha(meta.sha)||typeof meta.content!=='string')throw Error('Invalid GitHub memory file response');
 const memory=JSON.parse(decode(meta.content));
 assertMemory(memory);
 return {memory,blobSha:meta.sha};
}
export async function commitGitHubMemory({fetchImpl=fetch,token,branch=MEMORY_BRANCH,
 expectedSha,memory,previousMemory}={}){
 if(!token||branch!==MEMORY_BRANCH||!isSha(expectedSha))throw Error('Invalid memory write precondition');
 assertMemory(memory);assertMemory(previousMemory);
 if(memory.experiments.length<previousMemory.experiments.length)throw Error('Cannot erase stored experiments');
 for(let i=0;i<previousMemory.experiments.length;i++){
   if(JSON.stringify(memory.experiments[i])!==JSON.stringify(previousMemory.experiments[i]))
     throw Error('Memory updates must be append-only');
 }
 if(memory.experiments.length===previousMemory.experiments.length)
   return {status:'NO_NEW_EVIDENCE',written:false};
 const content=Buffer.from(JSON.stringify(memory,null,2)+'\n','utf8').toString('base64');
 const response=await fetchImpl(API,{
   method:'PUT',headers:headers(token),
   body:JSON.stringify({message:'research: append historical TRAIN-only evidence, no order or model promotion',
     sha:expectedSha,branch,content})
 });
 if(!response.ok)throw Error('Memory PUT failed HTTP '+response.status+
   '; no presumed persistence (SHA conflict requires a fresh read/retry)');
 const saved=await response.json();
 if(!isSha(saved.content?.sha)||!isSha(saved.commit?.sha))throw Error('Missing committed GitHub memory SHA');
 return {status:'PERSISTED_TRAINING_MEMORY',written:true,blobSha:saved.content.sha,commitSha:saved.commit.sha};
}
export function freshMemorySeed(){return emptyMemory();}
