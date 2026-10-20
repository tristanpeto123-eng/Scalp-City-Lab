// Browser/Node reusable historical research source reconciliation.
// This hash links public historical screening to the exact current Academy
// JSON object; it is not an independent signature or trading permission.
const sha64=/^[0-9a-f]{64}$/;
export async function requireMatchingAcademySource({screen,academy,cryptoProvider=globalThis.crypto}={}){
 if(screen?.schema!=='TEACHER_PUBLIC_HISTORICAL_SCREEN_V1'||
    !sha64.test(screen.academySourceSha256||'')||
    academy?.schema!=='ROBOT_ACADEMY_RESEARCH_V1'||
    academy.source!=='GITHUB_PERSISTED_HISTORICAL_TRAINING'||
    academy.actualBrokerOrders!==0||academy.verifiedForwardGrades!==0||
    academy.latestTrainingEnd!==screen.lastResearchTrainingEnd||
    !Array.isArray(academy.pupils)||academy.pupils.length!==10||
    !cryptoProvider?.subtle?.digest)
  throw Error('Academy-to-Teacher historical source reconciliation is unavailable');
 const bytes=new TextEncoder().encode(JSON.stringify(academy));
 const actual=new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes));
 const hex=Array.from(actual,x=>x.toString(16).padStart(2,'0')).join('');
 if(hex!==screen.academySourceSha256)
  throw Error('Teacher screening does not match the currently published Academy record — request a fresh independent screen');
 return Object.freeze({sourceMatched:true,academySourceSha256:hex,latestTrainingEnd:academy.latestTrainingEnd});
}
