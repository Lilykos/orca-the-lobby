const params=new URLSearchParams(location.search);const light=params.get('theme')==='light';if(!light)document.documentElement.classList.add('dark');
for (const [key,value] of Object.entries(light?{foreground:'#202830',background:'#f8f9fb','muted-foreground':'#526170',border:'#c8d0da',card:'#f3f5f8',primary:'#315cb4',ring:'#315cb4',popover:'#fff','popover-foreground':'#202830'}:{foreground:'#e3e8ef',background:'#222938','muted-foreground':'#aab6c5',border:'#465466',card:'#303d50',primary:'#f0c75e',ring:'#f0c75e',popover:'#303d50','popover-foreground':'#e3e8ef'})) document.documentElement.style.setProperty('--orca-'+key,value);
window.errors=[];window.onerror=(m)=>window.errors.push(String(m));
// media: ?hour=10.5 sets the local time the room windows follow.
if(params.has('hour'))DEMO.clock(+params.get('hour'));
const now=Date.now();
function agent(id,title,state,extra={}){return {id,terminalId:null,paneKey:id,workspaceId:'/w',projectId:'p',title,prompt:'Update the panel while keeping the pixel artwork.',reply:'Finished fixture result.',agent:'codex',state,outcome:null,unread:false,stateStartedAt:now-12000,finishedAt:null,firstSeenAt:now-20000,parentPaneKey:null,parentId:null,lastSeenAt:now,active:[],recent:[],toolCount:0,helpers:[],family:[],insight:null,history:[],...extra}}
const child={id:'b',kind:'agent',name:'Helper',description:'Keyboard review',tool:null,toolKind:null,state:'waiting',reported:true,lastReportedAt:now,missingSince:null};
window.fixture={agents:[agent('a','Update settings layout','working',{family:[child]}),agent('b','Check keyboard navigation','waiting'),agent('c','Review a long task title that must wrap naturally without hiding its status','done',{unread:true})],journal:[{id:'event1',agentId:'a',workspaceId:'/w',projectId:'p',kind:'tool',source:'roster',observedAt:now,coverage:'sampled',tool:'Edit',detail:'panel/main.ts'}],workspaces:{'/w':'Fixture workspace'},projects:{p:'Fixture project'},changes:{'/w':{files:2,added:3,removed:1}},links:{},can:{open:true},today:{day:'',finished:0,failed:0,blockedMs:0}};
const scenario=new URLSearchParams(location.search).get('scenario')||'linked';if(scenario==='peers')window.fixture.agents[0].family=[];if(scenario==='cycle')window.fixture.agents[1].family=[{...child,id:'a'}];if(scenario==='unknown'||scenario==='noid')window.fixture.agents[0].family=[{...child,id:scenario==='noid'?'':'missing',description:'Review keyboard access',tool:'Read'}];
if(scenario==='notificationexpiry'){const clock=Date.now.bind(Date);let elapsed=0;Date.now=()=>clock()+elapsed;window.advanceNotificationClock=(ms)=>{elapsed+=ms}}
if(['notificationcontrols','notificationerrors','notificationstale','notificationreadstale','notificationexpiry','notificationkeys','notificationfocus'].includes(scenario)){window.fixture.agents=[agent('need','Needs a decision','blocked',{stateStartedAt:now-35*60_000}),agent('quiet','Quiet agent','working',{lastSeenAt:now-35*60_000})];window.fixture.projects.p='Fixture project'}
if(['attentionview','attentionkeyboard','attentionfail'].includes(scenario))window.fixture.agents=[agent('need','Needs a decision','blocked'),agent('fail','Failed result','done',{outcome:'failure',finishedAt:now-8000,finishedAtSource:'source',completionId:'a'.repeat(64),completionTracked:true}),agent('done','Successful result','done',{outcome:'success',finishedAt:now-5000,finishedAtSource:'observed',completionId:'b'.repeat(64),completionTracked:true})];
if(['attentioncompact','attentioncompactfail'].includes(scenario)){window.fixture.agents=[agent('need-1','Run checkout tests','blocked',{projectId:'p',workspaceId:'/p/cart',stateStartedAt:now-12*60_000}),agent('need-2','Run checkout tests','blocked',{projectId:'q',workspaceId:'/q/e2e',stateStartedAt:now-8*60_000}),agent('no-go','Verify the checkout total','blocked',{projectId:'p',workspaceId:'/p/cart',sessionId:null}),agent('fail-1','Repair the failed cross-workspace checkout validation retry after the payment suite stopped','done',{projectId:'q',workspaceId:'/q/e2e',outcome:'failure',finishedAt:now-8000,finishedAtSource:'source',completionId:'f'.repeat(64),completionTracked:true}),agent('done-1','Confirm checkout regressions','done',{projectId:'p',workspaceId:'/p/cart',outcome:'success',finishedAt:now-5000,finishedAtSource:'observed',completionId:'d'.repeat(64),completionTracked:true}),agent('done-2','Review checkout handoff','done',{projectId:'q',workspaceId:'/q/e2e',outcome:null,finishedAt:now-3000,finishedAtSource:'observed',completionId:'e'.repeat(64),completionTracked:true})];Object.assign(window.fixture.projects,{p:'Atlas web app',q:'Atlas web app'});Object.assign(window.fixture.workspaces,{'/p/cart':'cart-a11y','/q/e2e':'checkout-e2e'})}
if(scenario==='attentionmedia'){window.fixture.agents=[agent('need','Approve the checkout validation plan','blocked',{projectId:'p',workspaceId:'/demo/atlas-web',stateStartedAt:now-12*60_000}),agent('fail','Repair the webhook key migration','done',{projectId:'q',workspaceId:'/demo/beacon-api',outcome:'failure',finishedAt:now-8000,finishedAtSource:'source',completionId:'a'.repeat(64),completionTracked:true}),agent('done','Review the updated cart flow','done',{projectId:'p',workspaceId:'/demo/atlas-web',outcome:'success',finishedAt:now-5000,finishedAtSource:'observed',completionId:'b'.repeat(64),completionTracked:true,unread:true})];Object.assign(window.fixture.projects,{p:'Atlas web app · local',q:'Beacon API · local'});Object.assign(window.fixture.workspaces,{'/demo/atlas-web':'atlas-web','/demo/beacon-api':'beacon-api'})}
if(scenario==='notificationmedia'){
 window.fixture.agents=[agent('need','Approve the checkout validation plan','blocked',{stateStartedAt:now-35*60_000}),agent('done','Review the updated cart flow','done',{outcome:'success',finishedAt:now-5000,finishedAtSource:'source',completionId:'b'.repeat(64),completionTracked:true,unread:true})];window.fixture.projects.p='Atlas web app · local';
}
if(scenario==='settingsconsolidation'){
 window.fixture.agents=[agent('need','Needs a decision','blocked',{stateStartedAt:now-35*60_000}),agent('quiet','Quiet agent','working',{projectId:'q',workspaceId:'/q',lastSeenAt:now-35*60_000})];window.fixture.projects.q='Other project';
}
if(scenario==='attentionemptyview')window.fixture.agents=[agent('quiet','No action needed','working')];
if(scenario==='attentionquietfinished')window.fixture.agents=[agent('working','Working agent','working'),agent('finished','Finished result','done',{outcome:'success',completionId:'5'.repeat(64),completionTracked:true})];
if(scenario==='attentionnoagents')window.fixture.agents=[];
if(scenario==='attentionpreviewbusy')window.fixture.agents=[agent('need-a','Approve the release plan','blocked'),agent('need-b','Check the API contract','blocked'),agent('need-c','Confirm workspace access','blocked'),agent('failed','Repair the failed validation','done',{outcome:'failure',completionId:'6'.repeat(64),completionTracked:true}),agent('finished-a','Review the merged change','done',{outcome:'success',completionId:'7'.repeat(64),completionTracked:true}),agent('finished-b','Check the final summary','done',{outcome:'success',completionId:'8'.repeat(64),completionTracked:true})];
if(scenario==='attentionpreviewquiet')window.fixture.agents=[agent('quiet-working','Long-running agent','working'),agent('quiet-finished','Finished result','done',{outcome:'success',completionId:'9'.repeat(64),completionTracked:true})];
if(scenario==='attentionlive')window.fixture.agents=Array.from({length:100},(_,i)=>agent('a'+i,'Agent '+i,i===0?'blocked':i<3?'done':'working',i===1?{outcome:'success',completionId:'8'.repeat(64),completionTracked:true}:i===2?{outcome:'failure',completionId:'9'.repeat(64),completionTracked:true}:{}));
if(scenario==='attentionlast')window.fixture.agents=[agent('last','Last result','done',{outcome:'success',completionId:'c'.repeat(64),completionTracked:true})];
if(scenario==='attentionarrival')window.fixture.agents=[agent('last','Last result','done',{outcome:'success',completionId:'e'.repeat(64),completionTracked:true})];
if(scenario==='attentiondisclosure')window.fixture.agents=[agent('need','Needs a decision','blocked'),agent('failure','Failed to build','done',{outcome:'failure',completionId:'f'.repeat(64),completionTracked:true}),agent('known','Known successful result','done',{outcome:'success',finishedAt:now-5000,finishedAtSource:'source',completionId:'k'.repeat(64),completionTracked:true}),agent('unknown','Unknown completion outcome','done',{outcome:null,finishedAt:now-3000,finishedAtSource:'observed',completionId:'u'.repeat(64),completionTracked:true})];
if(scenario==='attentionfocusfallback')window.fixture.agents=[agent('first','First decision','blocked'),agent('later','Later decision','blocked'),agent('finished','Hidden finished result','done',{outcome:'success',completionId:'z'.repeat(64),completionTracked:true})];
if(['attentionreviewgeneration','attentionreviewother','attentionreviewaway'].includes(scenario))window.fixture.agents=[agent('review-b','Second reviewed result','done',{outcome:'success',completionId:'2'.repeat(64),completionTracked:true}),agent('review-c','Third reviewed result','done',{outcome:'success',completionId:'3'.repeat(64),completionTracked:true})];
if(scenario==='attentionreviewremovedfailure')window.fixture.agents=[agent('removed','Removed result','done',{outcome:'success',completionId:'4'.repeat(64),completionTracked:true})];
if(scenario==='attentionpending')window.fixture.agents=[agent('pending','Pending result','done',{outcome:'success',completionId:'d'.repeat(64),completionTracked:true})];
if(['attentionaction','attentionstale','attentionreappear'].includes(scenario))window.fixture.agents=[agent('no-go','No navigation','blocked',{sessionId:null})];
if(scenario==='projectgone'){window.fixture.agents=[agent('kept','Kept project','working'),agent('gone','Vanishing project','working',{projectId:'q',workspaceId:'/q'})];window.fixture.projects.q='Vanishing project'}
if(['searchviews','filterdisclosure'].includes(scenario)){window.fixture.agents=[agent('parent','Parent orchestrator','working'),agent('child','Feature [one] implementation','working',{parentId:'parent',parentPaneKey:'parent'}),agent('other','Feature one other project','working',{projectId:'q',workspaceId:'/q'})];window.fixture.projects.q='Other project'}
if(scenario==='preferences')window.fixture.agents=[agent('a','Preference migration','working')];
// fixture data: terminal actions
if(scenario==='actions'||scenario==='actionslive')window.fixture.agents=[agent('a','Update settings layout','working',{agent:'claude'}),agent('b','Check keyboard navigation','waiting'),agent('c','Review the chat session','done',{agent:'claude'}),agent('d','Needs a decision','blocked',{agent:'claude'}),agent('e','Nothing to reach','done')];
// fixture data: context
if(scenario==='context'){const ctx=(tokens,window,compactions,today)=>({tokens,window,compactions,today}),f=window.fixture;f.agents[0].context=ctx(512000,700000,2,1200000);f.agents[1].context=ctx(69000,100000,0,0);f.agents[2].context=ctx(190000,200000,1,5000);f.agents.push(agent('d','Exactly seventy percent','working',{context:ctx(70000,100000,0,300)}),agent('e','Exactly ninety percent','working',{context:ctx(90000,100000,3,2000)}),agent('f','Claude with no known window','working',{agent:'claude',context:ctx(512000,null,2,1200000)}),agent('g','No context known','working'),agent('h','Just compacted','working',{context:ctx(null,258400,1,0)}))}
// fixture data: bubbles
if(scenario==='emojibubble'){const mm=window.matchMedia.bind(window);window.matchMedia=(q)=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q)}
if(scenario==='emojibubble'){const party=String.fromCodePoint(0x1F389),fam=String.fromCodePoint(0x1F468,0x200D,0x1F469,0x200D,0x1F467),fence=String.fromCharCode(96).repeat(3),nl=String.fromCharCode(10),done=(id,title,extra)=>agent(id,title,'done',{finishedAt:now-2000,stateStartedAt:now-2000,...extra});const room=(id)=>({projectId:id,workspaceId:'/'+id});window.fixture.agents=[agent('aa','Needs a decision','blocked',{stateStartedAt:now-60000}),done('e1','Party planner',{...room('p'),reply:'Party '+party.repeat(14)+' for everyone, with a very long explanation of why'}),done('e2','Family planner',{...room('q'),reply:fam.repeat(8)+' all went home'}),done('e3','Code only',{...room('r'),reply:fence+nl+'const secretCode = 1'+nl+fence}),done('e4','Fenced first',{...room('s'),reply:fence+'ts'+nl+'const hiddenCode = 2'+nl+fence+nl+'-1 returned from the tests'})];Object.assign(window.fixture.projects,{q:'Second',r:'Third',s:'Fourth'})}
if(scenario.startsWith('bubbles')){
// Everything but bubblesmotion runs with reduced motion, so people are at their seats at once and the pop and bob are off.
if(scenario!=='bubblesmotion'){const mm=window.matchMedia.bind(window);window.matchMedia=(q)=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:mm(q)}
const done=(id,title,extra)=>agent(id,title,'done',{finishedAt:now-2000,stateStartedAt:now-2000,...extra});window.fixture.agents=[agent('aa','Needs a decision','blocked',{stateStartedAt:now-60000}),agent('bb','Gone quiet','working',{lastSeenAt:now-30*60000}),agent('cc','Busy typing','working'),agent('dd','Needs a second decision','blocked',{stateStartedAt:now-60000}),done('e2','Wrapped up the settings',{reply:'## Rewrote the settings page so every toggle explains itself in plain words.'+String.fromCharCode(10)+'More detail follows.'}),done('e1','Broke the build',{outcome:'failure',reply:'It failed.'}),done('e3','Short answer',{reply:'All **done**.'})];if(scenario==='bubblesgrid'){window.fixture.agents.push(agent('qa','Other project blocked','blocked',{projectId:'q',workspaceId:'/q'}),done('qb','Other project done',{projectId:'q',workspaceId:'/q',reply:'Merged the other project.'}));window.fixture.projects.q='Second project'}}
if(scenario==='many')window.fixture.agents[0].family=Array.from({length:12},(_,i)=>({...child,id:'helper-'+i}));
if(scenario==='stale')window.fixture.agents[0].family=[{...child,reported:false,missingSince:now-1000}];
if(scenario==='multiple')window.fixture.agents[2].family=[child];
if(scenario==='states')window.fixture.agents.push(agent('d','Needs a decision','blocked'),agent('e','Failed task','done',{outcome:'failure'}));
if(scenario==='projects'||scenario==='grid'){window.fixture.agents.push(agent('other','Other project task','working',{projectId:'q',workspaceId:'/q'}));window.fixture.projects.q='Second project'}
// Orca's sidebar lists the second project first.
if(scenario==='projects')window.fixture.sidebar={q:0,p:1};
if(scenario==='grid'){window.fixture.agents.push(agent('third','Quiet third project task','working',{projectId:'r',workspaceId:'/r',lastSeenAt:now-30*60000}));window.fixture.projects.r='Third project';const u={input:1200,output:3400,cacheRead:2400000,cacheWrite:5000,models:{'claude-opus-5-5':2000000,'gpt-6.1-terra':409600}};window.fixture.usage={day:'2026-11-13',workspaces:{'/w':u},projects:{p:u}}}
const longTitle='Coordinate the extraordinarily long-running migration of every workspace including nested helpers';
if(scenario==='parentlink')window.fixture.agents=[agent('a','Parent by pane key','working'),agent('b','Linked only by parentId','waiting',{parentPaneKey:'a',parentId:'a'}),agent('c','Blocked grandchild','blocked',{parentPaneKey:'b',parentId:'b'}),agent('s','Separate peer','working')];
if(scenario==='parentnote'){window.fixture.agents=[agent('x','Parent missing from roster','working',{parentPaneKey:'gone',parentId:null}),agent('y','Parent in another project','blocked',{parentPaneKey:'o',parentId:'o'}),agent('z','No parent reported','working'),agent('o','Other project parent','working',{projectId:'q',workspaceId:'/q'})];window.fixture.projects.q='Second project'}
if(scenario==='attention'||scenario==='attentionempty'||scenario==='big'){
  const kid=(id)=>({...child,id,name:'Helper '+id});
  if(scenario==='attention'){window.fixture.agents=[agent('a','Parent orchestrator','working',{family:[kid('b')]}),agent('b','Middle manager','waiting',{family:[kid('d')]}),agent('d','Blocked leaf waiting on a decision','blocked'),agent('e','Failed run','done',{outcome:'failure'}),agent('c','Finished fine','done',{outcome:'success',unread:true})]}
  if(scenario==='attentionempty'){window.fixture.agents=[agent('a','Parent','working',{family:[kid('b')]}),agent('b','Child','done',{outcome:'success'}),agent('c','Solo','waiting')]}
  if(scenario==='big'){
    const list=[agent('r',longTitle,'working',{family:Array.from({length:12},(_,i)=>kid('c'+i))})];
    for(let i=0;i<12;i++){const fam=i<4?[kid('g'+i)]:[];list.push(agent('c'+i,longTitle+' '+i,i%5===3?'blocked':'working',{family:fam}))}
    list.push(agent('g1','Grandchild blocked','blocked'),agent('g2','Grandchild failed','done',{outcome:'failure'}),agent('g0','Grandchild fine','working'),agent('g3','Grandchild idle','waiting'));
    for(let i=0;i<8;i++)list.push(agent('p'+i,'Independent peer '+i+' with a long label that should wrap',i===5?'blocked':'working'));
    window.fixture.agents=list;
  }
}
let listener;
const storageListeners=[];
const stored={prefs:{notifyBlocked:true,notifyDone:true,animate:true,palette:'orca',layout:'list',stuckMinutes:20,projectOrder:[]}};
const restartedPrefs=scenario==='prefsreadrecover'?localStorage.getItem('prefs-recovery'):null;
if(restartedPrefs)stored.prefs=JSON.parse(restartedPrefs);
if(['newinstall','delayedfresh','legacynoprefs','prefshydration','installationrecover','installationrecoverchoice','attentionmedia','notificationmedia','notificationcontrols','notificationerrors','notificationstale','notificationreadstale','notificationexpiry','notificationkeys','notificationfocus'].includes(scenario))delete stored.prefs;
if(['legacynoprefs','prefshydration'].includes(scenario))stored.office={agents:[],journal:[]};
if(['projectgone','delayedfresh'].includes(scenario))stored.office={agents:[],journal:[]};
stored.installation={version:1,kind:['newinstall','delayedfresh','attentionmedia','notificationmedia','notificationcontrols','notificationerrors','notificationstale','notificationreadstale','notificationexpiry','notificationkeys','notificationfocus'].includes(scenario)?'fresh':scenario==='installationunknown'?'unknown':'legacy'};
if(scenario==='prefsrace')stored.prefs={notifyBlocked:true,notifyDone:true,animate:true,palette:'orca',layout:'list',stuckMinutes:20,projectOrder:['/old']};
if(scenario==='prefsreadrecover'&&!restartedPrefs)stored.prefs={notifyBlocked:true,notifyDone:false,animate:true,palette:'paper',layout:'list',density:'comfortable',stuckMinutes:30,projectOrder:['/legacy'],selectedView:'office'};
window.releaseReview=null;window.releaseOffice=null;window.releasePrefs=null;window.releasePrefsPatch=null;window.prefsPatchCalls=0;window.releaseOldAction=null;window.actionRequestCount=0;window.installRequests=0;window.goToCalls=0;window.notificationCalls=[];window.notificationPolicy={muted:false,snoozed:new Map()};window.releaseNotificationWrite=null;window.releaseStaleNotificationWrite=null;window.releaseStaleNotificationRead=null;window.releaseNotificationMute=null;window.releaseNotificationSnooze=null;window.notificationSnoozeWrites=0;window.notificationFocusStage='';window.notificationReadCalls=0;
window.orca={
storage:{
  get:async k=>{if(scenario==='prefsreadfail'&&k==='prefs')throw Error('storage unavailable');if(scenario==='prefsreadrecover'&&k==='prefs'&&!restartedPrefs&&!window.prefsRecovered){window.prefsRecovered=true;throw Error('temporary storage failure')}if(['installationrecover','installationrecoverchoice'].includes(scenario)&&k==='prefs')await new Promise(resolve=>window.releasePrefs=resolve);return stored[k]??null},
  set:async(k,v)=>{if(scenario==='storagefail'&&k==='activity-view-cursors')throw Error('storage denied');stored[k]=v;queueMicrotask(()=>storageListeners.forEach(fn=>fn({key:k})))},
  onDidChange:fn=>storageListeners.push(fn)
},
plugin:{
  on:(name,fn)=>{listener=fn},
  request:async(name,input)=>{
    if(name==='office.installation'){
      if(['prefshydration','prefsrace'].includes(scenario))await new Promise(resolve=>window.releaseOffice=resolve);
      if(['installationrecover','installationrecoverchoice'].includes(scenario)&&++window.installRequests===1)return {kind:'unknown'};
      return {kind:stored.installation.kind};
    }
    if(name==='prefs.patch'){
      if(scenario==='prefsackrace'&&++window.prefsPatchCalls===1)return new Promise(resolve=>window.releasePrefsPatch=()=>{stored.prefs={...stored.prefs,...input.patch};queueMicrotask(()=>storageListeners.forEach(fn=>fn({key:'prefs'})));resolve({ok:true})});
      if(scenario==='prefsreadrecover'){
        window.prefsPatchCalls++;
        if(window.prefsPatchCalls===1)return {ok:false,error:'temporary preference read failure'};
        if(window.prefsPatchCalls===2)return new Promise(resolve=>window.releasePrefsPatch=()=>resolve({ok:false,error:'temporary preference write failure'}));
      }
      stored.prefs={...stored.prefs,...input.patch};
      if(scenario==='prefsreadrecover')localStorage.setItem('prefs-recovery',JSON.stringify(stored.prefs));
      queueMicrotask(()=>storageListeners.forEach(fn=>fn({key:'prefs'})));
      return {ok:true};
    }
    if(name==='office.snapshot')return window.fixture;
    if(name==='notification.control.read'){
      window.notificationCalls.push({name,input});
      if(scenario==='notificationreadstale'&&input.agentId==='need'&&!window.staleNotificationReadStarted){window.staleNotificationReadStarted=true;return new Promise(resolve=>window.releaseStaleNotificationRead=()=>resolve({status:'ready',projectId:input.projectId,muted:false,agentId:'need',episodeId:'old-episode',snoozed:true,expiresAt:Date.now()+60000}))}
      if(scenario==='notificationerrors'&&window.notificationReadCalls++===0)return {status:'error',projectId:input.projectId,muted:null,agentId:input.agentId??null,episodeId:null,snoozed:null,expiresAt:null,error:'Temporary notification storage failure.'};
      const current=window.fixture.agents.find(a=>a.id===input.agentId),episodeId=current?`episode-${current.id}-${current.stateStartedAt}`:null,snooze=episodeId?window.notificationPolicy.snoozed.get(episodeId):null;
      return {status:'ready',projectId:input.projectId,muted:window.notificationPolicy.muted,agentId:input.agentId??null,episodeId,snoozed:Boolean(snooze&&(!snooze.expiresAt||snooze.expiresAt>Date.now())),expiresAt:snooze?.expiresAt??null};
    }
    if(name==='notification.project.mute'){
      window.notificationCalls.push({name,input});
      if(scenario==='notificationfocus'&&!window.notificationMuteStarted){window.notificationMuteStarted=true;return new Promise(resolve=>window.releaseNotificationMute=()=>{window.notificationPolicy.muted=input.muted;resolve({ok:true})})}
      if(scenario==='notificationerrors'&&!window.notificationWriteFailed){window.notificationWriteFailed=true;return {ok:false,error:'Could not save notification settings. Try again.'}}
      if(scenario==='notificationerrors'&&window.notificationRetryWrite)return (window.notificationPolicy.muted=input.muted,{ok:true});
      window.notificationPolicy.muted=input.muted;return {ok:true};
    }
    if(name==='notification.reminder.snooze'){
      window.notificationCalls.push({name,input});
      if(scenario==='notificationfocus'&&window.notificationSnoozeWrites++<2)return new Promise(resolve=>window.releaseNotificationSnooze=()=>{const expiresAt=input.choice==='15m'?Date.now()+15*60_000:null;window.notificationPolicy.snoozed.set(input.episodeId,{expiresAt});resolve({ok:true})})
      if(scenario==='notificationerrors'&&!window.notificationSnoozeFailed){window.notificationSnoozeFailed=true;return {ok:false,error:'Could not save reminder settings. Try again.'}}
      if(scenario==='notificationerrors'&&window.notificationRetrySnooze){const expiresAt=input.choice==='15m'?Date.now()+15*60_000:input.choice==='1h'?Date.now()+60*60_000:null;window.notificationPolicy.snoozed.set(input.episodeId,{expiresAt});return {ok:true}}
      if(scenario==='notificationstale'&&!window.notificationStaleWriteStarted){window.notificationStaleWriteStarted=true;return new Promise(resolve=>window.releaseStaleNotificationWrite=()=>resolve({ok:false,error:'That agent episode is no longer current.'}))}
      const expiresAt=input.choice==='15m'?Date.now()+15*60_000:input.choice==='1h'?Date.now()+60*60_000:null;
      if(input.choice==='resume')window.notificationPolicy.snoozed.delete(input.episodeId);else window.notificationPolicy.snoozed.set(input.episodeId,{expiresAt});
      return {ok:true};
    }
    if(name==='attention.review'){
      window.reviewCalls=(window.reviewCalls||0)+1;
      if(scenario==='attentioncompactfail'&&!window.attentionReviewRetry)return {ok:false,error:'Could not save the review.'};
      if(['attentionreviewgeneration','attentionreviewother','attentionreviewaway'].includes(scenario))return new Promise(resolve=>window.releaseReview=()=>resolve({ok:true}));
      if(scenario==='attentionreviewremovedfailure')return new Promise(resolve=>window.releaseReview=()=>resolve({ok:false,error:'Could not save the review. Try again.'}));
      return scenario==='attentionfail'?{ok:false,error:'Could not save the review.'}:scenario==='attentionpending'?new Promise(resolve=>window.releaseReview=()=>resolve({ok:false,error:'Completion changed while review was pending.'})):{ok:true};
    }
    if(name==='office.actions'&&scenario==='attentionaction')return {goTo:null,send:false,compact:null};
    if(name==='office.actions'&&scenario==='attentionstale')return ++window.actionRequestCount===1?new Promise(resolve=>window.releaseOldAction=()=>resolve({goTo:null,send:false,compact:null})):{goTo:'workspace',send:false,compact:null};
    if(name==='office.actions'&&scenario==='attentionreappear')return ++window.actionRequestCount===1?new Promise(resolve=>window.releaseOldAction=()=>resolve({goTo:'workspace',send:false,compact:null})):{goTo:null,send:false,compact:null};
    if(name==='office.actions'&&['attentioncompact','attentioncompactfail'].includes(scenario)&&input.agentId==='no-go')return {goTo:null,send:false,compact:null};
    if(name==='office.actions')return {goTo:'workspace',send:false,compact:null};
    if(name==='office.goTo')return (window.goToCalls++,{ok:true,note:'Opened fixture agent.'});
    if(name==='office.clearHistory')return (window.fixture.journal=[],listener(window.fixture),{cleared:scenario!=='clearfail'});
    return {opened:true};
  }
},
shell:{openExternal:()=>{}}
};
// media: the DEMO dataset, with the person's saved choices (?layout=grid&palette=dracula&stuck=20) and friendly names.
if(scenario==='media'){
const demo=DEMO.build(now,{fresh:params.get('fresh')==='1',only:params.get('only')?params.get('only').split(','):undefined}),prefs={notifyBlocked:true,notifyDone:true,animate:true,palette:params.get('palette')||'orca',layout:params.get('layout')==='grid'?'grid':'list',stuckMinutes:+(params.get('stuck')||20)};
window.fixture=demo.snapshot;window.demo=demo;stored.prefs=prefs;stored['friendly-agent-names']=demo.names;
window.pushSnapshot=(snapshot)=>{window.fixture=snapshot;listener(snapshot)};
const real=window.orca.plugin.request;window.orca.plugin.request=async(name,input)=>name==='office.actions'?demo.reach(input.agentId):real(name,input);
}
const modules={/*__BUNDLE__*/},cache={};function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};const dir=id.split('/').slice(0,-1);function req(p){const parts=dir.concat(p.split('/'));const out=[];for(const x of parts){if(x==='..')out.pop();else if(x!=='.')out.push(x)}return load(out.join('/'))}modules[id](req,m,m.exports);return m.exports}load('panel/main');
const wait=()=>new Promise(r=>setTimeout(r,80));
(async()=>{try{
await wait();
if(scenario==='media'){await wait();document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return}
if(scenario==='attentionmedia'||scenario==='notificationmedia'){await wait();document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return}
if(['notificationcontrols','notificationerrors','notificationstale','notificationreadstale','notificationexpiry','notificationkeys','notificationfocus'].includes(scenario)){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, until=async(test,message)=>{for(let i=0;i<30&&!test();i++)await wait();must(test(),message)}, byKey=(key)=>document.querySelector(`[data-focus-key="${key}"]`), click=async(key)=>{const b=byKey(key);must(b&&!b.disabled,'missing or disabled '+key);b.click();await until(()=>![...document.querySelectorAll('.notification-project-status,.notification-agent-status')].some(x=>x.textContent.includes('Saving')||x.textContent.includes('Loading')),'action stayed pending: '+key)};
 must(document.querySelector('#attention-tab').getAttribute('aria-selected')==='true','fresh install did not start in Attention');
 const attentionCounts=()=>[...document.querySelectorAll('.attention-group > h2,.attention-finished > summary')].map(x=>x.textContent).join('|');const initialCounts=attentionCounts(), initialRows=document.querySelectorAll('.attention-row').length;
 document.querySelector('#settings-tab').click();await wait();
 must(document.documentElement.scrollWidth<=innerWidth,'notification controls overflow the panel at '+innerWidth+'px');
 await until(()=>scenario==='notificationerrors'?document.querySelector('.notification-error'):document.querySelector('[data-focus-key="notification:project:p:mute"]')&&!document.querySelector('.notification-loading'),'notification controls did not load');
 if(scenario==='notificationerrors'){
   must(document.querySelector('.notification-error')?.textContent.includes('Temporary notification storage failure'),'read failure was hidden');
   await click('notification:project:p:retry');
   await until(()=>byKey('notification:project:p:mute')&&!document.querySelector('.notification-error'),'read retry did not recover');
   await click('notification:project:p:mute');
   must(document.querySelector('.notification-error')?.textContent.includes('Could not save notification settings'),'write failure was hidden');
   window.notificationPolicy.muted=true;listener(window.fixture);await wait();listener(window.fixture);
   await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications muted'),'live refresh did not show current persisted state');
   must(document.querySelector('.notification-project-status')?.textContent.includes('save failed')&&document.querySelector('.notification-error')?.textContent.includes('Could not save')&&byKey('notification:project:p:retry-write'),'live refresh cleared failed write or Retry save');
   window.notificationPolicy.muted=false;listener(window.fixture);
   await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications active'),'second live refresh did not show current persisted state');
   must(document.querySelector('.notification-project-status')?.textContent.includes('save failed')&&document.querySelector('.notification-error')?.textContent.includes('Could not save'),'repeated live update hid unsaved intent');
   window.notificationRetryWrite=true;
   await click('notification:project:p:retry-write');
   await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications muted')&&!document.querySelector('.notification-project-status')?.textContent.includes('save failed'),'write retry did not acknowledge durable save');
   await click('notification:agent:need:snooze:manual');
   must(document.querySelector('.notification-agent-status')?.textContent.includes('save failed')&&document.querySelector('.notification-error')?.textContent.includes('Could not save reminder settings')&&byKey('notification:agent:need:retry-write'),'snooze write failure was not visible');
   const episode=window.notificationCalls.filter(c=>c.name==='notification.reminder.snooze').at(-1).input.episodeId;
   window.notificationPolicy.snoozed.set(episode,{expiresAt:null});listener(window.fixture);await wait();listener(window.fixture);
   await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('snoozed until resumed'),'live refresh did not show current saved snooze');
   must(document.querySelector('.notification-agent-status')?.textContent.includes('save failed')&&document.querySelector('.notification-error')?.textContent.includes('Could not save reminder settings')&&byKey('notification:agent:need:retry-write'),'live refresh cleared failed snooze intent');
   window.notificationPolicy.snoozed.delete(episode);listener(window.fixture);
   await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'live refresh did not show current resumed state');
   must(document.querySelector('.notification-agent-status')?.textContent.includes('save failed')&&byKey('notification:agent:need:retry-write'),'live update hid failed snooze intent');
   window.notificationRetrySnooze=true;await click('notification:agent:need:retry-write');
   await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('snoozed until resumed')&&!document.querySelector('.notification-agent-status')?.textContent.includes('save failed'),'snooze retry did not acknowledge durable save');
 } else if(scenario==='notificationfocus'){
   const mute=byKey('notification:project:p:mute');mute.focus();mute.click();
   await until(()=>typeof window.releaseNotificationMute==='function','mute write was not gated');
   must(byKey('notification:project:p:mute')?.disabled&&document.querySelector('.notification-project-status')?.textContent.includes('Saving'),'pending mute was not visibly disabled');
   window.notificationFocusStage='mutePending';await new Promise(resolve=>window.continueNotificationFocusMute=resolve);
   const longTurn=document.querySelectorAll('.notification-controls input')[1];
   must(document.activeElement===longTurn,'Tab navigation did not move between notification settings while mute was pending');
   window.releaseNotificationMute();
   await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications muted'),'gated mute did not finish');
   must(document.activeElement===longTurn,'mute completion stole focus from keyboard navigation');
   const readsBefore=window.notificationCalls.filter(c=>c.name==='notification.control.read'&&c.input.agentId==='need').length;
   const snooze=byKey('notification:agent:need:snooze:manual');snooze.focus();snooze.click();
   await until(()=>typeof window.releaseNotificationSnooze==='function','snooze write was not gated');
   const officeTab=document.querySelector('#office-tab');window.notificationFocusStage='snoozePending';await new Promise(resolve=>window.continueNotificationFocusSnooze=resolve);
   must(document.activeElement===officeTab&&document.querySelector('#office-page').hidden===false,'keyboard navigation did not leave Settings during snooze');
   window.releaseNotificationSnooze();
   await until(()=>window.notificationCalls.filter(c=>c.name==='notification.control.read'&&c.input.agentId==='need').length>readsBefore,'gated snooze was not reread');
   await wait();must(document.activeElement===officeTab&&document.querySelector('#office-page').hidden===false,'snooze completion stole focus or navigated back to Settings');
   document.querySelector('#settings-tab').click();
   await until(()=>byKey('notification:agent:need:snooze:15m')&&!byKey('notification:agent:need:snooze:15m').disabled,'Settings controls did not reload');
   const retained=byKey('notification:agent:need:snooze:15m');retained.focus();retained.click();
   await until(()=>typeof window.releaseNotificationSnooze==='function','retained-focus snooze was not gated');
   must(byKey('notification:agent:need:snooze:15m')?.disabled,'gated snooze did not disable its action');
   const retainedReads=window.notificationCalls.filter(c=>c.name==='notification.control.read'&&c.input.agentId==='need').length;
   window.releaseNotificationSnooze();
   await until(()=>window.notificationCalls.filter(c=>c.name==='notification.control.read'&&c.input.agentId==='need').length>retainedReads,'retained-focus snooze was not reread');await wait();
   must(document.activeElement?.dataset.focusKey==='notification:agent:need:snooze:15m','focus was not restored when the user stayed on the pending action');
   const note=document.querySelector('.notification-note')?.textContent??'';
   must(note.includes('all The Lobby notifications')&&note.includes('snooze affects reminders only')&&note.includes('Agents stay visible in Attention'),'mute and snooze effects are not distinguished: '+note);
 } else {
   must(document.querySelector('.notification-project-status')?.textContent.includes('Notifications active'),'initial mute state missing');
   const note=document.querySelector('.notification-note')?.textContent??'';
   must(note.includes('all The Lobby notifications')&&note.includes('snooze affects reminders only')&&note.includes('Agents stay visible in Attention'),'mute and snooze effects are not distinguished: '+note);
   if(scenario==='notificationcontrols'){
     byKey('notification:agent:need:snooze:1h').focus();
     window.notificationPolicy.muted=true;listener(window.fixture);
     await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications muted'),'another panel mute update was not reread');
     must(document.activeElement?.dataset.focusKey==='notification:agent:need:snooze:1h','live mute refresh moved keyboard focus');
     window.notificationPolicy.muted=false;listener(window.fixture);
     await until(()=>document.querySelector('.notification-project-status')?.textContent.includes('Notifications active'),'another panel unmute update was not reread');
   }
   if(scenario==='notificationreadstale'){
     await until(()=>typeof window.releaseStaleNotificationRead==='function','initial reminder read was not gated');
     window.fixture={...window.fixture,agents:window.fixture.agents.map(a=>a.id==='need'?{...a,stateStartedAt:a.stateStartedAt-60000}:a)};listener(window.fixture);
     await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'new episode control read did not finish');
     window.releaseStaleNotificationRead();await wait();await wait();
     must(document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'old read overwrote the new episode state');
   } else if(scenario==='notificationstale'){
     const snooze=byKey('notification:agent:need:snooze:15m');must(snooze,'eligible reminder controls missing');snooze.click();
     await until(()=>typeof window.releaseStaleNotificationWrite==='function','snooze write was not gated');
     must(document.querySelector('.notification-agent-status')?.textContent.includes('Saving reminder settings')&&byKey('notification:agent:need:snooze:15m')?.disabled,'pending snooze was not visibly disabled without optimistic completion');
     window.fixture={...window.fixture,agents:window.fixture.agents.filter(a=>a.id!=='need')};listener(window.fixture);await wait();
     window.releaseStaleNotificationWrite();await wait();
     must(!document.querySelector('[data-focus-key^="notification:agent:need:"]'),'removed agent controls reappeared from a stale write');
     window.fixture={...window.fixture,agents:[...window.fixture.agents,agent('need','Needs a decision','blocked',{stateStartedAt:now-34*60_000})]};listener(window.fixture);
     await until(()=>document.querySelector('[data-focus-key="notification:agent:need:snooze:15m"]'),'reappearing current agent controls did not load');await wait();
     must(document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'old episode snooze leaked into the new episode');
   } else if(scenario==='notificationexpiry'){
     await click('notification:agent:need:snooze:15m');
     await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('snoozed until'),'snooze expiry was not shown');
     must(document.querySelector('.notification-agent-status time')?.dateTime,'snooze expiry is not an absolute time');
     window.advanceNotificationClock(16*60_000);listener(window.fixture);
     await until(()=>document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'expired snooze did not return to active');
   } else if(scenario==='notificationkeys'){
     must(byKey('notification:project:p:mute'),'keyboard mute control missing');
   } else {
     const beforeRows=initialRows,beforeCounts=initialCounts;
     await click('notification:project:p:mute');
     must(document.querySelector('.notification-project-status')?.textContent.includes('Notifications muted'),'mute was not reflected after acknowledgement: '+JSON.stringify({status:document.querySelector('.notification-project-status')?.textContent, calls:window.notificationCalls}));
     await click('notification:project:p:mute');
     must(document.querySelector('.notification-project-status')?.textContent.includes('Notifications active'),'unmute was not reflected after acknowledgement');
     await click('notification:agent:need:snooze:15m');
     must(document.querySelector('.notification-agent-status')?.textContent.includes('snoozed until'),'15 minute snooze status missing: '+JSON.stringify({status:document.querySelector('.notification-agent-status')?.textContent,calls:window.notificationCalls}));
     must(document.querySelector('.notification-agent-status time')?.dateTime,'expiry is not an absolute time');
     await click('notification:agent:need:snooze:1h');
     must(document.querySelector('.notification-agent-status')?.textContent.includes('snoozed until'),'one hour snooze status missing');
     await click('notification:agent:need:snooze:manual');
     must(document.querySelector('.notification-agent-status')?.textContent.includes('until resumed'),'manual snooze status missing');
     await click('notification:agent:need:resume');
     must(document.querySelector('.notification-agent-status')?.textContent.includes('Reminders active'),'resume was not reflected');
     document.querySelector('#attention-tab').click();await wait();
     must(attentionCounts()===beforeCounts&&document.querySelectorAll('.attention-row').length===beforeRows,'notification controls changed Attention membership or counts');
     must(window.notificationCalls.some(c=>c.name==='notification.project.mute'&&c.input.muted===false)&&window.notificationCalls.some(c=>c.name==='notification.reminder.snooze'&&c.input.choice==='resume'),'control requests did not use validated API choices');
   }
 }
 window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
// fixture checks: terminal actions
if(scenario==='actions'||scenario==='actionslive'){
const must=(ok,m)=>{if(!ok)throw Error(m)}, btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]'), esc=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
const calls=[], selects=[], real=window.orca.plugin.request;let failNext=false, holdSend=null, asked=0;
const reach={a:{goTo:'terminal',send:true,compact:'/compact'},b:{goTo:'terminal',send:true,compact:null},c:{goTo:'workspace',send:false,compact:null},d:{goTo:'terminal',send:true,compact:null}};
window.orca.plugin.request=async(name,input)=>{
 if(name==='office.select'){selects.push(input.agentId);return {ok:true}}
 if(name==='office.actions'){asked++;if(!reach[input.agentId])throw Error('no answer');return reach[input.agentId]}
 if(name==='office.goTo'){calls.push([name,input.agentId]);return input.agentId==='c'?{ok:true,note:'Opened its workspace. Orca does not let plugins pick a chat tab.'}:{ok:true}}
 if(name==='office.send'){calls.push([name,input.agentId,input.text]);if(holdSend)await holdSend;if(failNext){failNext=false;return {ok:false,error:'Its terminal is no longer open.'}}return {ok:true}}
 if(name==='office.compact'){calls.push([name,input.agentId]);return {ok:true}}
 return real(name,input)};
const open=async(id)=>{if(document.querySelector('.sheet'))esc();await wait();btn('office-row:'+id).click();await wait();return document.querySelector('.sheet')};
const has=(sheet,text)=>[...sheet.querySelectorAll('button')].some(b=>b.textContent===text);
const type=(sheet,text)=>{const ta=sheet.querySelector('textarea');ta.focus();ta.value=text;ta.dispatchEvent(new Event('input',{bubbles:true}));return ta};
const enter=(ta,shift)=>ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',shiftKey:!!shift,bubbles:true,cancelable:true}));

if(scenario==='actionslive'){
let sheet,ta;const wait=()=>new Promise(r=>setTimeout(r,30));
// The drawer stays put under live updates and the 1 s timer: same box, same focus and selection, same buttons.
sheet=await open('a');must(selects.includes('a'),'opening the drawer did not tell the worker which agent is selected');
const selectsAtOpen=selects.length;
ta=type(sheet,'first line and second words');ta.setSelectionRange(6,10);
const sendBtn=btn('a:send'),goBtn=btn('a:go'),askBtn=btn('a:compact'),status0=sheet.querySelector('.drawer-status .drawer-line'),status0Text=status0.textContent;
const watched=[],watcher=new MutationObserver((records)=>watched.push(...records));watcher.observe(document.querySelector('.sheet-body'),{childList:true,subtree:true});
const realNow=Date.now,askedBefore=asked;
for(let i=0;i<3;i++){listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1+i}))});await wait()}
// Past the 15 s the worker's answer is trusted for: it is asked again, and an unchanged answer redraws nothing.
Date.now=()=>realNow()+16000;await new Promise(r=>setTimeout(r,1300));Date.now=realNow;
must(asked>askedBefore,'the actions were not asked again after 15 s');
watcher.disconnect();
const swapped=watched.filter(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1));
must(swapped.length===0,'the drawer rebuilt elements with nothing changed: '+swapped.slice(0,3).map(r=>r.target.className+' +'+r.addedNodes.length+' -'+r.removedNodes.length).join(', '));
must(document.querySelector('.sheet textarea')===ta&&document.activeElement===ta,'the instruction box was replaced or lost focus: '+document.activeElement?.dataset.focusKey);
must(ta.selectionStart===6&&ta.selectionEnd===10&&ta.value==='first line and second words','selection or text changed under live updates: '+ta.selectionStart+'-'+ta.selectionEnd);
must(btn('a:send')===sendBtn&&btn('a:go')===goBtn&&btn('a:compact')===askBtn,'a button was replaced');
must(sheet.querySelector('.drawer-status .drawer-line')===status0&&status0.textContent!==status0Text,'the time line was rebuilt, or not updated in place: '+status0Text+' -> '+status0.textContent);
must(selects.length===selectsAtOpen,'the selected agent was sent again without a new selection');
// A real change to what is shown rebuilds the information, not the action area.
listener({...window.fixture,agents:window.fixture.agents.map(x=>x.id==='a'?{...x,title:'Update settings layout, renamed',toolCount:x.toolCount+1}:x)});await wait();
must(document.querySelector('.sheet textarea')===ta&&document.activeElement===ta&&btn('a:send')===sendBtn&&ta.selectionStart===6,'a data change disturbed the action area');
must(document.querySelector('.sheet').textContent.includes('renamed'),'the drawer did not show the changed title');
// Enter held down does not send again, and nothing is sent twice while a request is out.
ta.value='one';ta.dispatchEvent(new Event('input',{bubbles:true}));
const sentBefore=calls.length;
ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true}));await wait();
must(calls.length===sentBefore,'a repeated Enter sent');
let release;holdSend=new Promise(r=>{release=r});
enter(ta,false);await wait();
must(calls.length===sentBefore+1&&ta.readOnly&&sendBtn.disabled&&sendBtn.textContent==='Sending…','the box is not read-only and Send disabled while sending');
enter(ta,false);sendBtn.click();await wait();must(calls.length===sentBefore+1,'sent twice while a request was out');
must(document.querySelector('.sheet textarea')===ta&&btn('a:send')===sendBtn,'sending replaced the box or button');
// Text that arrives while the request is out survives its success.
ta.value='one and more';holdSend=null;release();await wait();
must(ta.value==='one and more'&&!ta.readOnly&&sheet.querySelector('.action-note')?.textContent==='Sent.','text typed during a send was lost or the box stayed read-only: '+ta.value);
// The sent text itself is cleared.
holdSend=new Promise(r=>{release=r});ta.value='gone after sending';ta.dispatchEvent(new Event('input',{bubbles:true}));enter(ta,false);await wait();holdSend=null;release();await wait();
must(ta.value==='','the sent text was not cleared');
// Compact keeps the keyboard user's place: confirm, cancel, and confirm-and-send.
btn('a:compact').focus();btn('a:compact').click();await wait();
must(document.activeElement===btn('a:compact-yes'),'focus did not move to the confirm button: '+document.activeElement?.dataset.focusKey);
btn('a:compact-no').click();await wait();
must(document.activeElement===btn('a:compact')&&btn('a:compact')===askBtn,'focus did not return to Compact after Cancel: '+document.activeElement?.dataset.focusKey);
btn('a:compact').click();await wait();btn('a:compact-yes').focus();btn('a:compact-yes').click();await wait();
must(document.activeElement===btn('a:compact'),'focus did not return to Compact after sending it: '+document.activeElement?.dataset.focusKey);
// A late result for a drawer that has closed is ignored, and the draft and notes go with the drawer.
holdSend=new Promise(r=>{release=r});ta.value='send then leave';ta.dispatchEvent(new Event('input',{bubbles:true}));enter(ta,false);await wait();
esc();await wait();must(!document.querySelector('.sheet'),'Escape did not close the drawer');
sheet=await open('b');release();holdSend=null;await wait();
must(!sheet.querySelector('.action-note')&&!sheet.querySelector('.action-error'),'a late result from agent a showed on agent b');
sheet=await open('a');must(sheet.querySelector('textarea').value===''&&!sheet.querySelector('.action-note')&&!sheet.querySelector('.action-error'),'agent a kept its draft or a stale note after the drawer closed');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
// Working Claude terminal: every control, and opening the drawer sends nothing.
let sheet=await open('a');
for(const want of ['Go to agent','Send','Compact conversation','View in Activity'])must(has(sheet,want),'agent a lacks the '+want+' button');
must(!has(sheet,'Open workspace')&&!sheet.textContent.includes('Open workspace'),'Open workspace is still offered');
must(sheet.textContent.includes('Send an instruction'),'no instruction label');
must(sheet.querySelector('label[for]')?.htmlFor===sheet.querySelector('textarea').id,'instruction box is not labelled');
must(sheet.querySelector('button.primary')?.textContent==='Go to agent','Go to agent is not the primary button');
must(calls.length===0,'opening the drawer sent something: '+JSON.stringify(calls));
must([...sheet.querySelectorAll('button')].find(b=>b.textContent==='Send').disabled,'Send is enabled with nothing typed');
// Go to agent.
[...sheet.querySelectorAll('button')].find(b=>b.textContent==='Go to agent').click();await wait();
must(calls.length===1&&calls[0][0]==='office.goTo'&&calls[0][1]==='a','Go to agent did not ask the worker');
// Enter sends, Shift+Enter does not, and the box clears on success.
sheet=document.querySelector('.sheet');let ta=type(sheet,'  run the tests  ');
enter(ta,true);await wait();must(calls.length===1,'Shift+Enter sent');
enter(ta,false);await wait();
must(calls.length===2&&calls[1].join('|')==='office.send|a|  run the tests  ','Enter did not send the typed text: '+JSON.stringify(calls[1]));
sheet=document.querySelector('.sheet');must(sheet.querySelector('textarea').value==='','box did not clear after a successful send');
must(sheet.querySelector('.action-note')?.textContent==='Sent.','no confirmation after sending');
must(document.activeElement?.dataset.focusKey==='a:instruction'||document.activeElement?.dataset.focusKey==='a:send','focus was lost after sending: '+document.activeElement?.dataset.focusKey);
// An empty box sends nothing.
ta=sheet.querySelector('textarea');enter(ta,false);await wait();must(calls.length===2,'Enter on an empty box sent');
// A draft survives a live update.
ta=type(sheet,'half-written');listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1}))});await wait();
sheet=document.querySelector('.sheet');must(sheet.querySelector('textarea').value==='half-written','live update lost the draft');
// A failure shows inline and keeps the text.
failNext=true;ta=sheet.querySelector('textarea');enter(ta,false);await wait();
sheet=document.querySelector('.sheet');must(sheet.querySelector('.action-error[role=alert]')?.textContent==='Its terminal is no longer open.','failure not shown inline');
must(sheet.querySelector('textarea').value==='half-written','a failed send cleared the text');
// Compact needs a confirmation.
sheet.querySelector('[data-focus-key="a:compact"]').click();await wait();sheet=document.querySelector('.sheet');
must(sheet.textContent.includes('Send /compact to this agent?')&&calls.filter(c=>c[0]==='office.compact').length===0,'Compact did not ask first');
btn('a:compact-no').click();await wait();must(calls.filter(c=>c[0]==='office.compact').length===0&&btn('a:compact'),'Cancel did not back out');
btn('a:compact').click();await wait();btn('a:compact-yes').click();await wait();
must(calls.filter(c=>c[0]==='office.compact').length===1&&document.querySelector('.sheet').textContent.includes('Compact command sent.'),'confirmed Compact did not send');
// Back to a failure plus a pending confirmation, for the screenshot.
failNext=true;ta=document.querySelector('.sheet textarea');enter(ta,false);await wait();btn('a:compact').click();await wait();

// Codex terminal: instructions, but no compact command verified for it.
sheet=await open('b');must(has(sheet,'Go to agent')&&sheet.querySelector('textarea')&&!has(sheet,'Compact conversation'),'Codex terminal controls wrong');
// A chat session can only be gone to by its workspace, and says so.
sheet=await open('c');must(has(sheet,'Go to agent')&&!sheet.querySelector('textarea')&&!has(sheet,'Compact conversation')&&!has(sheet,'Send'),'chat session shows terminal-only controls');
must(sheet.textContent.includes('The Lobby cannot select this agent’s tab'),'chat session does not explain what Go to agent does');
[...sheet.querySelectorAll('button')].find(b=>b.textContent==='Go to agent').click();await wait();
must(document.querySelector('.sheet .action-note')?.textContent.includes('Orca does not let plugins pick a chat tab'),'workspace-only note missing');
// Blocked: say Orca does not report the question; no compact.
sheet=await open('d');must(sheet.textContent.includes('Orca does not say what it is asking')&&!has(sheet,'Compact conversation')&&sheet.querySelector('textarea'),'blocked agent controls wrong');
// Nothing supported (the worker could not say): every action is left out, the rest stays.
sheet=await open('e');must(!has(sheet,'Go to agent')&&!has(sheet,'Send')&&!has(sheet,'Compact conversation')&&!sheet.querySelector('textarea')&&has(sheet,'View in Activity'),'unsupported agent shows actions');
must(!calls.some(c=>c[1]==='e'||c[1]==='b'||c[1]==='d'),'something was sent to an agent the person did not act on');
// Reopened: the old error is gone. End on a fresh failure with a draft, for the screenshot.
esc();await wait();sheet=await open('a');must(sheet.querySelector('textarea').value==='','closing the drawer kept the draft');
type(sheet,'half-written');failNext=true;enter(sheet.querySelector('textarea'),false);await wait();
must(document.querySelector('.sheet .action-error')?.textContent==='Its terminal is no longer open.'&&document.querySelector('.sheet textarea').value==='half-written','final state lacks the error');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
// fixture checks: context
if(scenario==='context'){
const must=(ok,m)=>{if(!ok)throw Error(m)}, btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]'), esc=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
const badge=(id)=>btn('office-row:'+id)?.querySelector('.context-badge');
for(const [id,text,level] of [['a','Context 73%','warn'],['c','Context 95%','high'],['d','Context 70%','warn'],['e','Context 90%','high']]){const b=badge(id);must(b&&b.textContent===text&&b.classList.contains('context-'+level),'row '+id+' badge: '+(b&&b.textContent+' '+b.className))}
for(const id of ['b','f','g','h'])must(btn('office-row:'+id)&&!badge(id),'row '+id+' should have no badge');
must(getComputedStyle(badge('a')).borderTopColor!==getComputedStyle(badge('c')).borderTopColor,'amber and red badges look the same');
must(badge('a').title.includes('512k of 700k'),'badge lacks its tooltip');
const open=(id)=>{btn('office-row:'+id).click();return document.querySelector('.sheet')};
const line=(sheet)=>sheet.querySelector('.drawer-context')?.textContent;
let sheet=open('a');sheet.querySelector('summary').click();must(line(sheet)==='Context 73% (512k of 700k) · 2 compactions · 1.2M tokens today','drawer line a: '+line(sheet));
must(sheet.textContent.includes('window is the one the log states'),'drawer fine print lacks the window source');
esc();await wait();
sheet=open('b');sheet.querySelector('summary').click();must(line(sheet)==='Context 69% (69k of 100k) · no compactions','drawer line b: '+line(sheet));esc();await wait();
sheet=open('c');sheet.querySelector('summary').click();must(line(sheet)==='Context 95% (190k of 200k) · 1 compaction · 5k tokens today','drawer line c: '+line(sheet));esc();await wait();
sheet=open('f');sheet.querySelector('summary').click();must(line(sheet)==='Context 512k tokens · 2 compactions · 1.2M tokens today','drawer line f: '+line(sheet));
must(!line(sheet).includes('%')&&sheet.textContent.includes('does not state the context window'),'unknown window should show tokens only, and say why');esc();await wait();
sheet=open('g');must(!sheet.querySelector('.drawer-context'),'drawer shows context for an agent without any');esc();await wait();
sheet=open('h');sheet.querySelector('summary').click();must(line(sheet)==='Context not reported yet · 1 compaction','drawer line h: '+line(sheet));esc();await wait();
document.querySelector('#activity-tab').click();await wait();
btn('chart-node:a').click();await wait();document.querySelector('.sheet summary').click();must(line(document.querySelector('.sheet'))==='Context 73% (512k of 700k) · 2 compactions · 1.2M tokens today','Activity drawer lacks the context line');esc();await wait();
document.querySelector('#office-tab').click();await wait();
btn('office-row:a').click();await wait();
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
// fixture checks: bubbles
if(scenario==='searchviews'){
const must=(ok,m)=>{if(!ok)throw Error(m)};document.querySelector('#filter-disclosure').open=true;const search=document.querySelector('#view-filters input');search.value='FEATURE [ONE]';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();
must(document.querySelectorAll('#offices [data-focus-key^="office-row:"]').length===1&&document.querySelector('[data-focus-key="office-row:child"]'),'Office search did not use a literal normalized match');must(document.querySelector('#filter-count').textContent==='1 match','shared match count did not update');
document.querySelector('#activity-tab').click();await wait();must(document.querySelector('#filter-disclosure').open,'Filter disclosure closed while switching views');must(document.querySelector('[data-focus-key="chart-node:child"]')&&!document.querySelector('[data-focus-key="chart-node:other"]')&&document.querySelector('[data-focus-key="chart-node:parent"]'),'Activity search lost its chart ancestor or included a nonmatch');
search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();const project=document.querySelector('#view-filters select');project.value='q';project.dispatchEvent(new Event('change',{bubbles:true}));await wait();must(!document.querySelector('[data-focus-key="chart-node:child"]')&&document.querySelector('[data-focus-key="chart-node:other"]'),'project filter did not apply across views');must(document.querySelector('#filter-count').textContent==='1 match','project match count did not update');
document.querySelector('#attention-tab').click();await wait();must(document.querySelector('#view-filters select').value==='q'&&document.querySelector('#filter-disclosure').open&&document.querySelector('#filter-active-count').textContent==='1 active','project filter or disclosure did not persist into Attention');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='newinstall'){
const must=(ok,m)=>{if(!ok)throw Error(m)};must(document.querySelector('#attention-tab').getAttribute('aria-selected')==='true','new installation did not open Attention');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='delayedfresh'){
if(!stored.office||document.querySelector('#attention-tab').getAttribute('aria-selected')!=='true')throw Error('a fresh worker auto-save before delayed panel open selected the wrong view');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='legacynoprefs'){
if(document.querySelector('#office-tab').getAttribute('aria-selected')!=='true')throw Error('1.2 office storage without preferences did not preserve Office');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='prefsreadfail'){
if(document.querySelector('#office-tab').getAttribute('aria-selected')!=='true'||!document.querySelector('#prefs-status')?.textContent.includes('Could not load'))throw Error('preference read failure did not keep Office and report the error');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='installationunknown'){
if(document.querySelector('#office-tab').getAttribute('aria-selected')!=='true'||!document.querySelector('#prefs-status')?.textContent.includes('Could not confirm Lobby installation state'))throw Error('unknown installation state did not preserve Office or report the migration uncertainty');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='prefshydration'){
if(document.body.classList.contains('prefs-ready'))throw Error('panel became visible before legacy view detection completed');window.releaseOffice();await wait();if(!document.body.classList.contains('prefs-ready')||document.querySelector('#office-tab').getAttribute('aria-selected')!=='true')throw Error('delayed legacy hydration selected the wrong view');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='prefsreadrecover'){
const must=(ok,m)=>{if(!ok)throw Error(m)};
if(restartedPrefs){await wait();must(document.querySelector('#activity-tab').getAttribute('aria-selected')==='true','restart lost the selected view');must(document.querySelector('select[name="density"]').value==='comfortable','restart lost the last queued density intent');must(document.querySelector('select[name="palette"]').value==='dracula','restart lost the concurrent palette');must(document.querySelectorAll('#settings input[type="checkbox"]')[0].checked===false&&document.querySelectorAll('#settings input[type="checkbox"]')[1].checked===true,'restart lost preserved notification preferences');must(JSON.stringify(stored.prefs.projectOrder)===JSON.stringify(['/concurrent']),'restart lost the concurrent project order');localStorage.removeItem('prefs-recovery');}
else{
await wait();must(document.querySelector('#prefs-status').textContent.includes('Could not load saved Lobby settings'),'failed initial read was not reported');
document.querySelector('#activity-tab').click();document.querySelector('#settings-tab').click();
const notify=document.querySelectorAll('#settings input[type="checkbox"]')[0];notify.checked=false;notify.dispatchEvent(new Event('change',{bubbles:true}));
const density=document.querySelector('select[name="density"]');density.value='compact';density.dispatchEvent(new Event('change',{bubbles:true}));
must(stored.prefs.palette==='paper'&&stored.prefs.notifyDone===false&&JSON.stringify(stored.prefs.projectOrder)==='["/legacy"]','actions overwrote stored preferences before a successful reread');
for(let i=0;i<50&&!window.releasePrefsPatch;i++)await new Promise(resolve=>setTimeout(resolve,20));must(typeof window.releasePrefsPatch==='function','worker retry did not reach the gated write');
density.value='comfortable';density.dispatchEvent(new Event('change',{bubbles:true}));
stored.prefs={...stored.prefs,palette:'dracula',layout:'grid',notifyDone:true,stuckMinutes:60,projectOrder:['/concurrent']};window.releasePrefsPatch();
await wait();must(document.querySelector('#prefs-status').textContent.includes('still pending'),'failed write did not leave visible unsaved status');
for(let i=0;i<50&&stored.prefs.selectedView!=='activity';i++)await new Promise(resolve=>setTimeout(resolve,50));
must(stored.prefs.selectedView==='activity'&&stored.prefs.notifyBlocked===false&&stored.prefs.density==='comfortable'&&window.prefsPatchCalls>=2,'queued user changes were not saved after automatic retry');
must(stored.prefs.palette==='dracula'&&stored.prefs.layout==='grid'&&stored.prefs.notifyDone===true&&stored.prefs.stuckMinutes===60&&JSON.stringify(stored.prefs.projectOrder)==='["/concurrent"]','recovery overwrote unrelated or concurrent settings: '+JSON.stringify(stored.prefs));
must(!document.querySelector('#prefs-status').textContent.includes('Could not load')&&!document.querySelector('#prefs-status').textContent.includes('still pending'),'successful recovery left an error visible');localStorage.setItem('prefs-recovery',JSON.stringify(stored.prefs));location.reload();return;
}
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='prefsackrace'){
await wait();document.querySelector('#settings-tab').click();const density=document.querySelector('select[name="density"]');density.value='compact';density.dispatchEvent(new Event('change',{bubbles:true}));
for(let i=0;i<50&&!window.releasePrefsPatch;i++)await new Promise(resolve=>setTimeout(resolve,20));if(!window.releasePrefsPatch)throw Error('first panel patch did not reach the gated write');
density.value='comfortable';density.dispatchEvent(new Event('change',{bubbles:true}));window.releasePrefsPatch();
for(let i=0;i<50&&(stored.prefs.density!=='comfortable'||window.prefsPatchCalls<2);i++)await new Promise(resolve=>setTimeout(resolve,20));
if(stored.prefs.density!=='comfortable'||window.prefsPatchCalls<2)throw Error('an older successful acknowledgement discarded the newer density intent');
if(document.querySelector('#prefs-status').textContent.includes('pending'))throw Error('successful concurrent preference writes still appear unsaved');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['installationrecover','installationrecoverchoice'].includes(scenario)){
if(document.body.classList.contains('prefs-ready'))throw Error('installation race fixture was already hydrated');if(scenario==='installationrecoverchoice')document.querySelector('#office-tab').click();stored.installation.kind='fresh';storageListeners.forEach(fn=>fn({key:'lobby.installation'}));window.releasePrefs();await wait();
const expected=scenario==='installationrecoverchoice'?'office':'attention';if(document.querySelector(`#${expected}-tab`).getAttribute('aria-selected')!=='true'||document.querySelector('#prefs-status').textContent.includes('Could not confirm Lobby installation state'))throw Error('a fresh installation marker received during hydration was lost: '+JSON.stringify({requests:window.installRequests,view:expected,status:document.querySelector('#prefs-status').textContent}));
document.querySelector('#office-tab').click();storageListeners.forEach(fn=>fn({key:'lobby.installation'}));await wait();
if(document.querySelector('#office-tab').getAttribute('aria-selected')!=='true')throw Error('marker refresh navigated away from the user-selected view');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='prefsrace'){
if(document.body.classList.contains('prefs-ready'))throw Error('panel became visible before its worker state was ready');
const latest={...stored.prefs,notifyBlocked:false,selectedView:'activity',density:'compact',projectOrder:['/latest']};
await window.orca.storage.set('prefs',latest);window.releaseOffice();await wait();
const checkboxes=[...document.querySelectorAll('#settings input[type="checkbox"]')];const order=[...stored.prefs.projectOrder];
if(document.querySelector('#activity-tab').getAttribute('aria-selected')!=='true'||!document.documentElement.classList.contains('compact')||checkboxes[0]?.checked!==false||checkboxes[1]?.checked!==true||JSON.stringify(order)!==JSON.stringify(['/latest'])||stored.prefs.selectedView!=='activity')throw Error('stale hydration overwrote a concurrent panel preference: '+JSON.stringify({prefs:stored.prefs,view:document.querySelector('#activity-tab').getAttribute('aria-selected'),compact:document.documentElement.classList.contains('compact'),notify:[...checkboxes].map(box=>box.checked)}));
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='preferences'){
const must=(ok,m)=>{if(!ok)throw Error(m)};must(document.querySelector('#office-tab').getAttribute('aria-selected')==='true','1.2 preferences did not preserve Office');
document.querySelector('#settings-tab').click();await wait();const density=document.querySelector('select[name="density"]');must(density.value==='comfortable','upgrade density was not Comfortable');density.value='compact';density.focus();density.dispatchEvent(new Event('change',{bubbles:true}));await wait();must(document.documentElement.classList.contains('compact'),'Compact density not applied');must(document.querySelector('#settings-tab').getAttribute('aria-selected')==='true'&&document.activeElement===density,'preference storage change navigated away or stole Settings focus');document.querySelector('#activity-tab').click();await wait();must(stored.prefs.selectedView==='activity','functional view was not persisted');document.querySelector('#settings-tab').click();await wait();must(stored.prefs.selectedView==='activity','Settings was persisted as startup view');density.value='comfortable';density.focus();density.dispatchEvent(new Event('change',{bubbles:true}));await wait();must(document.querySelector('#settings-tab').getAttribute('aria-selected')==='true'&&document.activeElement===density&&stored.prefs.selectedView==='activity','editing settings navigated away from the previously selected view');
must(document.querySelector('#settings-tab').getAttribute('aria-selected')==='true','preference storage change navigated away from Settings');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='settingsconsolidation'){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, tab=async(id)=>{document.querySelector(`#${id}-tab`).click();await wait()};
 const banner=document.querySelector('#banner'),toggle=document.querySelector('#brand-toggle'),settings=document.querySelector('#settings-page'),attention=document.querySelector('#attention-page');
 await tab('attention');
 must(attention.querySelector('.attention-group h2')?.textContent.startsWith('Needs input · 1')&&attention.querySelector('[data-focus-key="attention-title:need"]'),'Attention lost its count or queue actions');
 document.querySelector('#filter-disclosure').open=true;const projectFilter=document.querySelector('#view-filters select');projectFilter.value='p';projectFilter.dispatchEvent(new Event('change',{bubbles:true}));
 const search=document.querySelector('#view-filters input');search.value='no matching agents';search.dispatchEvent(new Event('input',{bubbles:true}));
 await tab('settings');
 const controls=settings.querySelector('.notification-controls');
 must(!document.querySelector('#view-filters').getClientRects().length,'Attention filters were visible in Settings');
 must(controls?.querySelector('[data-focus-key="notification:project:p:mute"]')&&controls.querySelector('[data-focus-key="notification:agent:need:snooze:15m"]'),'project mute and current-episode snooze were not grouped under Settings');
 must(controls.querySelector('[data-focus-key="notification:project:q:mute"]')&&controls.querySelector('[data-focus-key="notification:agent:quiet:snooze:15m"]'),'Attention filters limited Settings controls');
 must(controls.querySelectorAll('input[type="checkbox"]').length===2&&controls.querySelector('select[name="stuck"]'),'notification preferences were not grouped with mute and snooze');
 must(!attention.querySelector('.notification-controls,[data-focus-key^="notification:"]'),'notification controls remained in Attention');
 must(settings.contains(toggle)&&toggle.getAttribute('aria-controls')===banner.id,'the banner control was not in Settings or did not identify the banner');
 for(const id of ['office','activity','attention','settings']){await tab(id);must(!banner.hidden,`banner missing in ${id}`);must(Boolean(toggle.getClientRects().length)===(id==='settings'),`banner control visibility is wrong in ${id}`)}
 toggle.click();must(banner.hidden&&toggle.textContent==='Show banner'&&toggle.getAttribute('aria-expanded')==='false','Settings did not hide the banner accessibly');
 for(const id of ['office','activity','attention','settings']){await tab(id);must(banner.hidden,`hidden banner reappeared in ${id}`)}
 toggle.click();must(!banner.hidden&&toggle.textContent==='Hide banner'&&toggle.getAttribute('aria-expanded')==='true','Settings did not show the banner accessibly');
 await tab('attention');must(!banner.hidden,'restored banner disappeared after switching tabs');
 window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='sharedbanner'){
document.querySelector('#settings-tab').click();await wait();document.querySelector('#brand-toggle').focus();
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionquietfinished'){
 document.querySelector('#attention-tab').click();await wait();const quiet=document.querySelector('.attention-empty')?.textContent??'';if(!quiet.includes('No one needs input right now')||!quiet.includes('1 working')||!document.querySelector('.attention-finished summary')?.textContent.includes('1'))throw Error('quiet state hid working or finished counts: '+JSON.stringify({quiet,finished:document.querySelector('.attention-finished summary')?.textContent}));window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionnoagents'){
 document.querySelector('#attention-tab').click();await wait();if(document.querySelector('.attention-empty')?.textContent!=='No live agents to show yet.')throw Error('no-agent state missing: '+document.querySelector('#attention-list').textContent);window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['attentionpreviewbusy','attentionpreviewquiet'].includes(scenario)){
 document.querySelector('#settings-tab').click();await wait();const toggle=document.querySelector('#brand-toggle');if(!toggle||toggle.textContent!=='Hide banner')throw Error('fixture did not begin with the shared banner visible');toggle.click();document.querySelector('#attention-tab').click();await wait();
 const must=(ok,m)=>{if(!ok)throw Error(m)};must(document.querySelector('#banner').hidden&&!document.querySelector('#filter-disclosure').open,'preview changed the banner choice or opened filters');
 if(scenario==='attentionpreviewbusy'&&innerWidth===420)must([...document.querySelectorAll('.attention-row')].filter(x=>x.checkVisibility()).length===4,'420px busy preview does not fit four intervention rows');
 must([...document.querySelectorAll('.attention-row .attention-title,.attention-row .attention-actions .action')].every(x=>x.getBoundingClientRect().height>=32),'Attention controls are smaller than 32px');
 must(!document.querySelector('.attention-counts'),'redundant live Attention totals remain');
 if(scenario==='attentionpreviewquiet')must(document.querySelector('.attention-empty')?.textContent.includes('1 working')&&document.querySelector('.attention-finished summary')?.textContent.includes('1'),'quiet preview omitted truthful work or Finished counts');
 must(document.documentElement.scrollWidth===innerWidth,'preview overflowed at '+innerWidth+'px');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='filterdisclosure'){
 document.querySelector('#attention-tab').click();await wait();const disclosure=document.querySelector('#filter-disclosure');if(!disclosure||disclosure.open)throw Error('shared Filter controls should begin in a collapsed native disclosure');const indicator=document.querySelector('#filter-indicator');if(!indicator||indicator.getAttribute('aria-hidden')!=='true'||indicator.textContent!=='▸')throw Error('collapsed Filter disclosure has no visible decorative indicator');disclosure.open=true;await wait();if(indicator.textContent!=='▾'||disclosure.open!==true)throw Error('expanded Filter disclosure indicator or native state is missing');if(document.querySelector('#filter-summary').getAttribute('aria-label')!=='Filter')throw Error('decorative indicator was duplicated in the accessible Filter label');disclosure.open=false;await wait();window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionemptyview'){
document.querySelector('#attention-tab').click();await wait();if(document.querySelector('.attention-empty')?.textContent!=='Nothing needs input or review right now · 1 working.')throw Error('empty Attention state missing');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionlive'){
document.querySelector('#attention-tab').click();await wait();const finished=document.querySelector('.attention-finished');if(!finished||finished.open)throw Error('100-agent fixture should begin with Finished collapsed');finished.querySelector('summary').click();await wait();if(!finished.open)throw Error('Finished did not expand before the live update');document.querySelector('#filter-disclosure').open=true;const search=document.querySelector('#view-filters input');search.value='Agent';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();search.focus();window.scrollTo(0,300);const at=document.scrollingElement.scrollTop;listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1}))});await wait();if(document.activeElement!==search||search.value!=='Agent'||document.scrollingElement.scrollTop!==at||!document.querySelector('.attention-finished')?.open)throw Error('100-agent update lost focus, query, scroll or disclosure choice');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionkeyboard'){
document.querySelector('#attention-tab').click();await wait();document.querySelector('.attention-finished').open=true;await wait();const title=document.querySelector('[data-focus-key="attention-title:done"]');if(!title)throw Error('keyboard result title missing');title.focus();window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentioncapture'){
document.querySelector('#attention-tab').click();await wait();window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionfail'){
document.querySelector('#attention-tab').click();await wait();document.querySelector('.attention-finished').open=true;await wait();document.querySelector('[data-focus-key="attention-title:done"]').click();await wait();document.querySelector('[data-focus-key="drawer-review:done"]').click();await wait();await wait();if(!document.querySelector('[data-focus-key="drawer-review:done"]')?.textContent.includes('Retry')||!document.querySelector('.drawer-review-error')?.textContent.includes('Could not save'))throw Error('failed review was hidden or its error was not visible');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionaction'){
document.querySelector('#attention-tab').click();await wait();await new Promise(r=>setTimeout(r,30));const go=document.querySelector('[data-focus-key="attention-open:no-go"]');if(!go?.disabled||!document.getElementById(go.getAttribute('aria-describedby'))?.textContent.includes('Navigation unavailable'))throw Error('agent action response did not disable and explain unavailable Open agent');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionstale'){
document.querySelector('#attention-tab').click();await wait();await new Promise(r=>setTimeout(r,20));if(window.actionRequestCount!==1)throw Error('first per-agent action request was not issued');const pendingGo=document.querySelector('[data-focus-key="attention-open:no-go"]');if(!pendingGo?.disabled||!document.getElementById(pendingGo.getAttribute('aria-describedby'))?.textContent.includes('Checking navigation'))throw Error('unresolved navigation capability was presented as unavailable or enabled');listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,sessionId:'changed-session'}))});await wait();await new Promise(r=>setTimeout(r,20));const go=document.querySelector('[data-focus-key="attention-open:no-go"]');if(window.actionRequestCount!==2||go?.disabled)throw Error('new agent capability response was not applied');window.releaseOldAction();await wait();if(document.querySelector('[data-focus-key="attention-open:no-go"]')?.disabled)throw Error('stale action response overwrote current capability');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionreappear'){
document.querySelector('#attention-tab').click();await wait();if(window.actionRequestCount!==1)throw Error('initial redacted agent capability request missing');
listener({...window.fixture,agents:[]});await wait();listener({...window.fixture,agents:[{...window.fixture.agents[0],sessionId:null}]});await wait();await new Promise(r=>setTimeout(r,20));
const go=document.querySelector('[data-focus-key="attention-open:no-go"]');if(window.actionRequestCount!==2||!go?.disabled||!document.getElementById(go.getAttribute('aria-describedby'))?.textContent.includes('Navigation unavailable'))throw Error('reappeared same-id agent reused the previous lifecycle capability');
window.releaseOldAction();await wait();if(!document.querySelector('[data-focus-key="attention-open:no-go"]')?.disabled)throw Error('old delayed action response applied to reappeared agent');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='projectgone'){
document.querySelector('#filter-disclosure').open=true;const project=document.querySelector('#view-filters select');project.value='q';project.dispatchEvent(new Event('change',{bubbles:true}));await wait();const clear=document.querySelector('#clear-filters');document.querySelector('#office-tab').focus();listener({...window.fixture,agents:window.fixture.agents.filter(x=>x.id!=='gone')});await wait();if(project.value!=='all'||document.querySelector('#filter-count').textContent!==''||!clear.hidden||document.activeElement!==document.querySelector('#office-tab')||!document.querySelector('[data-focus-key="office-row:kept"]'))throw Error('disappeared project filter left stale state or stole focus');listener(window.fixture);await wait();if(project.value!=='all'||!document.querySelector('[data-focus-key="office-row:gone"]'))throw Error('reconnected project unexpectedly reactivated stale filter');project.value='q';project.dispatchEvent(new Event('change',{bubbles:true}));await wait();clear.focus();listener({...window.fixture,agents:window.fixture.agents.filter(x=>x.id!=='gone')});await wait();if(project.value!=='all'||!clear.hidden||document.activeElement!==document.querySelector('#filter-summary'))throw Error('project disappearance hid the focused Clear without returning focus to Filter');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionpending'){
document.querySelector('#attention-tab').click();await wait();document.querySelector('.attention-finished').open=true;await wait();document.querySelector('[data-focus-key="attention-title:pending"]').click();await wait();const pending=document.querySelector('[data-focus-key="drawer-review:pending"]');pending.focus();pending.click();listener({...window.fixture,agents:[]});await wait();window.releaseReview();await wait();await wait();if(!document.querySelector('#attention-feedback').textContent.includes('Completion changed while review was pending'))throw Error('pending review error was not surfaced: '+document.querySelector('#attention-feedback').textContent);window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionlast'){
document.querySelector('#attention-tab').click();await wait();const finished=document.querySelector('.attention-finished');if(!finished)throw Error('last result disclosure missing');finished.open=true;await wait();const title=document.querySelector('[data-focus-key="attention-title:last"]');if(!title)throw Error('last result title missing');title.focus();window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionarrival'){
document.querySelector('#attention-tab').click();await wait();document.querySelector('.attention-finished').open=true;await wait();document.querySelector('[data-focus-key="attention-title:last"]').click();await wait();document.querySelector('[data-focus-key="drawer-review:last"]').click();await wait();await wait();const heading=document.querySelector('.attention-heading');if(document.activeElement!==heading)throw Error('reviewing the last item did not focus the empty queue');window.arrive=()=>listener({...window.fixture,agents:[agent('arrival','New decision','blocked',{sessionId:null})]});window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentiondisclosure'){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, tab=async(id)=>{document.querySelector(`#${id}-tab`).click();await wait()}, summary=()=>document.querySelector('.attention-finished summary'), details=()=>document.querySelector('.attention-finished');
 await tab('attention');await wait();
 must(details() instanceof HTMLDetailsElement&&!details().open,'Finished is not a collapsed native disclosure on a fresh view');
 must(summary().textContent.includes('Finished')&&summary().textContent.includes('2')&&summary().textContent.includes('1 outcome unknown'),'Finished count or unknown outcome label is missing: '+summary()?.textContent);
 must(document.querySelector('[data-agent-id="unknown"] .attention-meta')?.textContent.includes('Outcome unknown'),'unknown completion is not labeled on its row');
 must(document.querySelector('[data-agent-id="need"]')&&!details().contains(document.querySelector('[data-agent-id="need"]'))&&document.querySelector('[data-agent-id="failure"]'),'Needs input and failures were incorrectly hidden under Finished');
 must(!document.querySelector('[data-agent-id="known"] .attention-title')?.checkVisibility()&&!document.querySelector('[data-agent-id="unknown"] .attention-title')?.checkVisibility(),'fresh Finished disclosure should be collapsed');document.querySelector('#filter-disclosure').open=true;
 summary().click();await wait();must(details().open,'Finished could not be expanded');summary().focus();
 listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1}))});await wait();must(document.querySelector('.attention-finished')?.open&&document.activeElement?.dataset.focusKey==='attention-finished-summary','live update lost open choice or summary focus: '+JSON.stringify({open:document.querySelector('.attention-finished')?.open,focus:document.activeElement?.dataset.focusKey}));
 await tab('office');await tab('attention');must(document.querySelector('.attention-finished')?.open,'view switch lost the Finished expansion choice');
 summary().click();await wait();must(!details().open,'Finished could not be collapsed');
 const search=document.querySelector('#view-filters input');search.value='Unknown completion outcome';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(details()?.open&&document.querySelector('[data-agent-id="unknown"]'),'search did not reveal its matching finished result');
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(!document.querySelector('.attention-finished')?.open,'clearing search did not restore the user\'s collapsed choice');
 search.value='Known successful result';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(document.querySelector('.attention-finished')?.open&&document.querySelector('[data-agent-id="known"]'),'matching source-time completion was hidden by search');
 search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(!document.querySelector('.attention-finished')?.open,'clearing search did not restore the user\'s collapsed choice');summary().click();await wait();search.value='Unknown completion outcome';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(document.querySelector('.attention-finished')?.open,'clearing search did not restore the user\'s expanded choice');summary().click();await wait();document.querySelector('.attention-finished summary').focus();window.disclosureArrival=()=>listener({...window.fixture,agents:[...window.fixture.agents,agent('arrival','Arrived result','done',{outcome:null,completionId:'v'.repeat(64),completionTracked:true})]});window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionreviewremovedfailure'){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, until=async(test,m)=>{for(let i=0;i<30&&!test();i++)await wait();must(test(),m)};
 document.querySelector('#attention-tab').click();await wait();document.querySelector('.attention-finished').open=true;await wait();document.querySelector('[data-focus-key="attention-title:removed"]').click();await wait();document.querySelector('[data-focus-key="drawer-review:removed"]').click();await until(()=>typeof window.releaseReview==='function','review write did not become pending');
 listener({...window.fixture,agents:[]});await until(()=>!document.querySelector('.sheet'),'agent removal did not close its drawer before the write failed');document.querySelector('#filter-disclosure summary').click();const search=document.querySelector('#view-filters input');search.focus();must(document.activeElement===search,'search did not receive focus after drawer removal');window.releaseReview();await wait();await wait();
 must(document.activeElement===search,'late review failure stole focus from search');must(document.querySelector('#attention-feedback')?.textContent==='Could not save the review. Try again.','failed review was not surfaced in Attention feedback');must(!document.querySelector('.sheet'),'failed stale review reopened its drawer');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionfocusfallback'){
 document.querySelector('#attention-tab').click();await wait();const finished=document.querySelector('.attention-finished');if(!finished||finished.open)throw Error('Finished should start collapsed');document.querySelector('[data-focus-key="attention-title:first"]').focus();window.removeLater=()=>listener({...window.fixture,agents:window.fixture.agents.filter(x=>x.id!=='later')});window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['attentionreviewgeneration','attentionreviewother','attentionreviewaway'].includes(scenario)){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, until=async(test,m)=>{for(let i=0;i<30&&!test();i++)await wait();must(test(),m)}, tab=async(id)=>{const button=document.querySelector(`#${id}-tab`);must(button,'missing tab '+id);button.click();await wait()}, openFinished=async()=>{const section=document.querySelector('.attention-finished');if(section&&!section.open){section.open=true;await wait()}}, openAgent=async(id)=>{await openFinished();const title=document.querySelector(`[data-focus-key="attention-title:${id}"]`);must(title,'missing title for '+id);title.click();await wait();must(document.querySelector('.sheet')&&document.querySelector('#drawer-title')?.textContent.includes(id==='review-b'?'Second':'Third'),'could not open requested review drawer '+id)}, startReview=async(id)=>{await openAgent(id);window.releaseReview=null;const button=document.querySelector(`[data-focus-key="drawer-review:${id}"]`);must(button,'missing review action for '+id);button.click();await until(()=>typeof window.releaseReview==='function','review write did not become pending')}, closeDrawer=async()=>{const button=document.querySelector('[data-focus-key="drawer-close"]');must(button,'drawer missing before close');button.click();await wait()};
 await tab('attention');
 if(scenario==='attentionreviewgeneration'){
  await startReview('review-b');await closeDrawer();await openAgent('review-b');const close=document.querySelector('[data-focus-key="drawer-close"]');close.focus();window.releaseReview();await wait();await wait();must(document.querySelector('.sheet')&&document.querySelector('#drawer-title')?.textContent.includes('Second')&&document.querySelector('[data-focus-key="drawer-review:review-b"]')?.textContent==='Reviewed in The Lobby.'&&document.activeElement?.dataset.focusKey==='drawer-close','same-agent re-open was closed or lost focus by the older review');
 } else if(scenario==='attentionreviewother'){
  await startReview('review-b');await closeDrawer();await openAgent('review-c');const close=document.querySelector('[data-focus-key="drawer-close"]');close.focus();window.releaseReview();await wait();await wait();must(document.querySelector('.sheet')&&document.querySelector('#drawer-title')?.textContent.includes('Third')&&document.activeElement?.dataset.focusKey==='drawer-close','review completion closed or refocused another agent drawer');
 } else {
  await startReview('review-b');await tab('office');document.querySelector('#office-tab').focus();window.releaseReview();await wait();await wait();must(document.querySelector('#office-tab').getAttribute('aria-selected')==='true'&&!document.querySelector('.sheet')&&document.activeElement===document.querySelector('#office-tab'),'review completion navigated back to or opened its old drawer');
 }
 window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['attentioncompact','attentioncompactfail'].includes(scenario)){
 const must=(ok,m)=>{if(!ok)throw Error(m)}, by=(key)=>document.querySelector(`[data-focus-key="${key}"]`), waitFor=async(test,msg)=>{for(let i=0;i<12&&!test();i++)await wait();must(test(),msg)};
 document.querySelector('#attention-tab').click();await wait();await wait();
 must(document.documentElement.scrollWidth===innerWidth,'compact Attention overflowed at '+innerWidth+'px');
 const rows=[...document.querySelectorAll('.attention-row')];must(rows.length===6,'compact rows missing: '+rows.length);
 must(!document.querySelector('.attention-card'),'old large card layout remains');
 const same1=rows.find(x=>x.dataset.agentId==='need-1'),same2=rows.find(x=>x.dataset.agentId==='need-2');
 must(same1.querySelector('.attention-meta').textContent.includes('cart-a11y')&&same2.querySelector('.attention-meta').textContent.includes('checkout-e2e'),'duplicate task/project labels lack workspace disambiguation');
 const long=by('attention-title:fail-1'),longName='Repair the failed cross-workspace checkout validation retry after the payment suite stopped';
 must(long?.tagName==='BUTTON'&&long.getAttribute('aria-label')===`Review details: ${longName}`&&getComputedStyle(long).webkitLineClamp==='2','long task title is truncated accessibly or exceeds two lines');
 const unavailable=by('attention-open:no-go');must(unavailable?.disabled&&unavailable.getAttribute('aria-describedby')&&document.getElementById(unavailable.getAttribute('aria-describedby'))?.textContent.includes('Navigation unavailable'),'unavailable navigation lacks disabled control and explanation: '+JSON.stringify({disabled:unavailable?.disabled,described:unavailable?.getAttribute('aria-describedby'),note:document.getElementById(unavailable?.getAttribute('aria-describedby')||'')?.textContent}));
 must(!rows.find(x=>x.dataset.agentId==='done-1').querySelector('[data-focus-key$=":review"]'),'Reviewed action remains on the inbox row');
 by('attention-title:need-1').click();await wait();must(document.querySelector('.sheet')&&document.querySelector('#attention-tab').getAttribute('aria-selected')==='true'&&document.querySelector('#drawer-title')?.textContent==='Run checkout tests','task title did not open details in Attention');
 document.querySelector('[data-focus-key="drawer-close"]').click();await wait();must(document.activeElement?.dataset.focusKey==='attention-title:need-1','closing details did not restore the title focus');
 by('attention-open:need-1').click();await wait();await wait();must(window.goToCalls===1,'Open agent did not use validated navigation');
 const finished=document.querySelector('.attention-finished');if(finished){finished.open=true;await wait()}by('attention-title:done-1').click();await wait();must(by('drawer-review:done-1')&&!document.querySelector('.attention-row[data-agent-id="done-1"] [data-focus-key$=":review"]'),'result details lack Mark Reviewed');
 by('drawer-review:done-1').click();await wait();await wait();
 if(scenario==='attentioncompactfail'){
   must(document.querySelector('.sheet')&&document.querySelector('[role="alert"].drawer-review-error')?.textContent.includes('Could not save')&&by('drawer-review:done-1')?.textContent==='Retry Mark Reviewed','review save error/retry was not visible');
   window.attentionReviewRetry=true;by('drawer-review:done-1').click();await wait();await wait();
 }
 await waitFor(()=>!document.querySelector('.sheet')&&!document.querySelector('.attention-row[data-agent-id="done-1"]'),'successful review did not return to the queue');
 must(document.activeElement?.dataset.focusKey==='attention-title:done-2','review did not focus the next remaining result');
 must(document.querySelector('#attention-feedback').textContent.includes('Reviewed in The Lobby.'),'review success was not announced');
 window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='attentionview'){
const must=(ok,m)=>{if(!ok)throw Error(m)};document.querySelector('#attention-tab').click();await wait();
must(document.querySelectorAll('.attention-row').length===3,'Attention rows missing');must(!document.querySelector('.attention-counts'),'redundant live queue totals remain');must(document.querySelector('.attention-group h2')?.textContent==='Needs input · 1'&&document.querySelectorAll('.attention-group h2')[1]?.textContent==='Failed · 1'&&document.querySelector('.attention-finished summary')?.textContent==='Finished · 1','per-group counts are missing or inaccurate');
const accents=[...document.querySelectorAll('.attention-row')].map(card=>getComputedStyle(card).borderLeftColor);must(JSON.stringify(accents)===JSON.stringify(['rgb(237, 130, 59)','rgb(229, 72, 77)','rgb(57, 135, 229)']),'Attention status accents missing or mismatched: '+JSON.stringify(accents));
must([...document.querySelectorAll('[data-attention-time]')].some(x=>x.textContent.includes('Needs you for'))&&[...document.querySelectorAll('[data-attention-time]')].some(x=>x.textContent.startsWith('Finished'))&&[...document.querySelectorAll('[data-attention-time]')].some(x=>x.textContent.startsWith('Done observed')),'Attention source versus observed completion times were mislabeled: '+JSON.stringify([...document.querySelectorAll('[data-attention-time]')].map(x=>x.textContent)));
document.querySelector('[data-focus-key="attention-open:need"]').click();await wait();await wait();must(window.goToCalls===1&&document.querySelector('[data-focus-key="attention-open:need"]'),'Open agent did not use the validated action');must(document.querySelector('#attention-feedback').textContent.includes('Opened fixture agent.'),'navigation feedback missing');
document.querySelector('#filter-disclosure').open=true;const query=document.querySelector('#view-filters input');query.value='Successful result';query.dispatchEvent(new Event('input',{bubbles:true}));await wait();document.querySelector('[data-focus-key="attention-title:done"]').click();await wait();must(document.querySelector('.sheet'),'Review details did not open the drawer');document.querySelector('[data-focus-key="drawer-close"]').click();await wait();must(document.querySelector('#attention-tab').getAttribute('aria-selected')==='true','closing details did not return to Attention');must(query.value==='Successful result','search query was cleared on view change');query.value='';query.dispatchEvent(new Event('input',{bubbles:true}));await wait();
document.querySelector('[data-focus-key="attention-title:done"]').click();await wait();const review=document.querySelector('[data-focus-key="drawer-review:done"]');review.focus();review.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));review.click();await wait();await wait();must(![...document.querySelectorAll('.attention-title')].some(x=>x.textContent==='Successful result'),'Reviewed completion remained in the queue');must(document.querySelectorAll('.attention-row').length===2,'review removed an unrelated row');must(document.querySelector('#attention-feedback').textContent==='Reviewed in The Lobby.','successful review was not announced');
const input=document.querySelector('#view-filters input');input.value='not present anywhere';input.dispatchEvent(new Event('input',{bubbles:true}));await wait();must(document.querySelector('.attention-empty')?.textContent==='No agents match these filters.','search state: '+document.querySelector('#attention-list').textContent);
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='emojibubble'){
const must=(ok,m)=>{if(!ok)throw Error(m)};
const drawn=[];const real=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...rest){drawn.push(String(t));return real.call(this,t,...rest)};
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,unread:true}))});await wait();await wait();await new Promise(r=>setTimeout(r,500));
CanvasRenderingContext2D.prototype.fillText=real;
const lone=(t)=>{for(let i=0;i<t.length;i++){const c=t.charCodeAt(i);if(c>=0xD800&&c<0xDC00){const n=t.charCodeAt(i+1);if(!(n>=0xDC00&&n<0xE000))return true;i++}else if(c>=0xDC00&&c<0xE000)return true}return false};
must(drawn.length>0,'nothing was drawn');
must(!drawn.some(lone),'a bubble was cut inside an emoji');
must(!drawn.some(t=>t.includes(String.fromCharCode(0xFFFD))),'a replacement glyph was drawn');
const party=String.fromCodePoint(0x1F389);
must(drawn.some(t=>t.startsWith('Party ')&&t.includes(party)&&t.endsWith(String.fromCharCode(0x2026))),'the long emoji reply was not cut with an ellipsis');
must(drawn.some(t=>t.startsWith('-1')),'a leading minus was stripped, or the prose after the code was not used: '+JSON.stringify(drawn.filter(t=>t.length>4)));
must(!drawn.some(t=>t.includes('Code')&&t.includes('secret')||t.includes('secretCode')||t.includes('hiddenCode')),'code was drawn in a bubble');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario.startsWith('bubbles')){
const must=(ok,m)=>{if(!ok)throw Error(m)};
if(scenario==='bubblesgrid'){document.querySelector('#office-page [data-focus-key="layout:grid"]').click();await wait();await wait();must(document.documentElement.classList.contains('grid'),'Grid did not turn on for the bubbles check')}
const paints={need:[237,130,59],stuck:[246,201,160],failed:[201,58,63]};
const scan=()=>{const found={need:null,stuck:null,failed:null};for(const canvas of document.querySelectorAll('#offices canvas')){const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,d=c.getImageData(0,0,w,h).data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;for(const k in paints){const p=paints[k];if(d[i]===p[0]&&d[i+1]===p[1]&&d[i+2]===p[2]&&d[i+3]===255){const f=found[k]||(found[k]={canvas,x0:x,y0:y,x1:x,y1:y,w,h});f.x0=Math.min(f.x0,x);f.x1=Math.max(f.x1,x);f.y0=Math.min(f.y0,y);f.y1=Math.max(f.y1,y)}}}}return found};
const first=scan();
if(scenario==='bubblesmotion'){must(first.need,'Need you! bubble missing while people are walking in');window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return}
for(const k of ['need','stuck','failed'])must(first[k],k+' bubble was not drawn');
for(const k in first){const f=first[k];must(f.x0>0&&f.x1<f.w-1&&f.y0>0,k+' bubble touches the canvas edge')}
// the sign is the top 22 screen pixels of a room; no bubble may reach into it
for(const k in first)must(first[k].y0>=22*first[k].canvas.width/first[k].canvas.clientWidth,k+' bubble reaches into the room sign');
// clicking a bubble opens the drawer of its speaker, like clicking the character
const tell=(f)=>{const box=f.canvas.getBoundingClientRect(),ratio=f.canvas.width/box.width;return {clientX:box.left+(f.x0+2)/ratio,clientY:box.top+(f.y0+2)/ratio}};
first.need.canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,...tell(first.need)}));await wait();
const sheet=document.querySelector('.sheet');must(sheet&&sheet.textContent.includes('Needs a'),'clicking the Need you! bubble did not open the drawer');
document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();must(!document.querySelector('.sheet'),'Escape did not close the drawer');
// a failure stops saying Failed once its twenty seconds are over
const later={...window.fixture,agents:window.fixture.agents.map(x=>x.id==='e1'?{...x,finishedAt:now-25000,stateStartedAt:now-25000}:x)};listener(later);await wait();await wait();
must(!scan().failed,'Failed bubble outlived its twenty seconds');must(scan().need,'Need you! went away with the Failed bubble');
listener(window.fixture);await wait();await wait();
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['drawer','drawerkeyboard','drawer-reduced','drawertab'].includes(scenario)){
const must=(ok,m)=>{if(!ok)throw Error(m)}, btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]'), esc=()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
must(!document.querySelector('.sheet'),'drawer open before any selection');
btn('office-row:a').click();await wait();
const sheet=document.querySelector('.sheet');must(sheet&&document.querySelector('.scrim'),'Office row did not open the drawer');
must(sheet.getAttribute('role')==='dialog'&&sheet.getAttribute('aria-modal')==='true','drawer is not a modal dialog');
must(document.activeElement?.dataset.focusKey==='drawer-close','focus did not move into the drawer');
for(const want of ['Update settings layout','Wren','Finished','Result','Go to agent','More details','Calls','Current work','View in Activity'])must(sheet.textContent.includes(want),'Office drawer lacks '+want);
const info=[sheet.querySelector('.drawer-head'),sheet.querySelector('.drawer-status'),sheet.querySelector('.drawer-result'),sheet.querySelector('.drawer-actions')];
must(info.every(Boolean)&&info.every((x,i)=>!i||!!(info[i-1].compareDocumentPosition(x)&Node.DOCUMENT_POSITION_FOLLOWING)),'task, state, result and primary action are not presented in order');
const extra=sheet.querySelector('details.drawer-extra');must(extra&&!extra.open,'supplementary details should start collapsed');must(extra.querySelector('[role="tablist"]'),'calls and supplementary tabs were removed');
must(sheet.querySelector('.drawer-result').checkVisibility()&&[...extra.querySelectorAll('.tabbox,.drawer-usage')].every(x=>!x.checkVisibility()),'the primary result is hidden or supplementary calls/tokens are visible before disclosure');
if(scenario==='drawer-reduced')must(getComputedStyle(sheet).animationName==='none'&&getComputedStyle(document.querySelector('.scrim')).animationName==='none','drawer animates with reduced motion requested');
must(!document.querySelector('#offices .details'),'details still expand inline in the roster');
extra.open=true;
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1,toolCount:x.id==='a'?x.toolCount+1:x.toolCount}))});await wait();
must(document.querySelector('.drawer-extra').open,'live information update closed the expanded details section');
must(document.querySelector('.sheet')===sheet&&document.activeElement?.dataset.focusKey==='drawer-close','live update closed the drawer or lost focus');
esc();await wait();must(!document.querySelector('.sheet'),'Escape did not close the drawer');
must(document.activeElement?.dataset.focusKey==='office-row:a','focus did not return to the Office row');
btn('office-row:a').click();await wait();[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='View in Activity').click();await wait();
must(!document.querySelector('.activity-page[hidden]')&&!document.querySelector('#activity-page').hidden,'View in Activity did not switch pages');
must(!document.querySelector('.sheet'),'View in Activity should show the chart, not another drawer');
must(document.activeElement?.dataset.focusKey==='chart-node:a','View in Activity did not focus the agent node');
btn('chart-node:b').click();await wait();must(document.querySelector('.sheet')?.textContent.includes('Check keyboard navigation'),'chart node did not open the drawer');
must(!document.querySelector('.sheet').textContent.includes('View in Activity'),'Activity drawer links to itself');
document.querySelector('.scrim').click();await wait();must(!document.querySelector('.sheet'),'scrim click did not close the drawer');
must(document.activeElement?.dataset.focusKey==='chart-node:b','focus did not return to the chart node');
btn('chart-node:b').click();await wait();
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(scenario==='drawerfocus'){
const must=(ok,m)=>{if(!ok)throw Error(m)}, btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]');
btn('office-row:a').click();await wait();let sheet=document.querySelector('.sheet');
const result=sheet.querySelector('.drawer-result');must(result,'fixture result missing');result.focus();result.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,toolCount:x.id==='a'?x.toolCount+1:x.toolCount}))});await wait();sheet=document.querySelector('.sheet');
must(document.activeElement?.dataset.focusKey==='a:replied:note'&&document.activeElement.getAttribute('aria-expanded')==='true','live update lost result focus or its expansion');
const extra=sheet.querySelector('.drawer-extra');extra.open=true;const prompt=extra.querySelector('.note.asked');must(prompt,'fixture prompt missing');prompt.focus();prompt.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,stateStartedAt:x.id==='a'?x.stateStartedAt+1:x.stateStartedAt,toolCount:x.id==='a'?x.toolCount+1:x.toolCount}))});await wait();sheet=document.querySelector('.sheet');
must(sheet.querySelector('.drawer-extra').open&&document.activeElement?.dataset.focusKey==='a:asked:note'&&document.activeElement.getAttribute('aria-expanded')==='true','live update lost disclosed prompt focus, disclosure or expansion');
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
document.querySelector('#activity-tab').click();await wait();
if(scenario==='grid'){
const must=(ok,m)=>{if(!ok)throw Error(m)}, btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]'), wide=innerWidth>=400;
must(getComputedStyle(document.querySelector('#activity-list .layout-toggle')).display!=='none'&&getComputedStyle(document.querySelector('#office-page .layout-toggle')).display!=='none','List/Grid toggle hidden');
must(btn('layout:list').getAttribute('aria-pressed')==='true','default layout is not List');
for(const page of ['#office-page','#activity-list']){const c=document.querySelector(page+' .agent-counts')?.textContent;must(c==='3 working1 done0 failed','counts beside List/Grid on '+page+': '+c)}
if(!wide){
 document.querySelector('#activity-list [data-focus-key="layout:grid"]').click();await wait();
 const blocks=[...document.querySelectorAll('.chart-block')];must(blocks[1].offsetTop>blocks[0].offsetTop,'narrow Grid should stay one per line');
 must(document.querySelector('#activity-list [data-focus-key="layout:grid"]').title.includes('400px'),'narrow Grid does not explain itself: '+JSON.stringify({title:document.querySelector('#activity-list [data-focus-key="layout:grid"]').title,width:document.documentElement.clientWidth}));
}
if(wide){
 document.querySelector('#activity-list [data-focus-key="layout:grid"]').click();await wait();
 const blocks=[...document.querySelectorAll('.chart-block')];// Document order is the left column (projects 1 and 3), then the right one (project 2).
 must(blocks.length===3&&blocks[0].offsetTop===blocks[2].offsetTop&&blocks[0].offsetLeft<blocks[2].offsetLeft&&blocks[1].offsetLeft===blocks[0].offsetLeft&&blocks[1].offsetTop>blocks[0].offsetTop,'activity charts not in two columns');
 must(blocks[0].querySelector('.chart-summary').textContent.includes('2.4M tokens today'),'chart header lacks tokens: '+blocks[0].querySelector('.chart-summary').textContent);
 const settle=()=>new Promise(r=>setTimeout(r,450));let top3=blocks[1].getBoundingClientRect().top,top2=blocks[2].getBoundingClientRect().top;
 document.querySelector('[data-focus-key="chart-fold:p"]').click();await settle();
 const folded=document.querySelectorAll('.chart-block')[0];must(folded.classList.contains('folded')&&getComputedStyle(folded.querySelector('.chart-viewport')).display==='none','chart did not fold');
 must(document.querySelectorAll('.chart-block')[1].getBoundingClientRect().top<top3-50,'project beneath did not slide up');
 must(Math.abs(document.querySelectorAll('.chart-block')[2].getBoundingClientRect().top-top2)<1,'the other column moved');
 document.querySelector('[data-focus-key="chart-fold:p"]').click();await settle();must(!document.querySelectorAll('.chart-block')[0].classList.contains('folded'),'chart did not unfold');
 must(document.documentElement.scrollWidth<=innerWidth,'activity grid scrolls horizontally');
 document.querySelector('[data-focus-key="chart-node:other"]').click();await wait();const insp=document.querySelector('.sheet');must(insp&&insp.offsetWidth>=innerWidth-2&&document.querySelector('.scrim'),'drawer should cover the panel');document.querySelector('[data-focus-key="drawer-close"]').click();await wait();
 document.querySelector('#office-tab').click();await wait();await wait();
 const rooms=[...document.querySelectorAll('#offices .office')];must(rooms.length===3&&rooms[0].offsetTop===rooms[2].offsetTop&&rooms[0].offsetLeft<rooms[2].offsetLeft&&rooms[1].offsetLeft===rooms[0].offsetLeft,'offices not in two columns');
 const strip=rooms[0].querySelector('.room-usage');must(strip&&!strip.hidden&&strip.textContent.includes('2.4M tokens today · 100% cached')&&strip.title.includes('Opus 5.5 2.0M'),'office lacks tokens: '+strip?.textContent+' / '+strip?.title);
 must(document.querySelector('.quiet-label')?.textContent.startsWith('Quiet 30m'),'stuck agent not marked quiet');
 const r3=rooms[1].getBoundingClientRect().top,r2=rooms[2].getBoundingClientRect().top,sign=rooms[0].querySelector('canvas').getBoundingClientRect();
 rooms[0].querySelector('canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:sign.left+20,clientY:sign.top+4}));await new Promise(r=>setTimeout(r,500));
 must(rooms[1].getBoundingClientRect().top<r3-50,'office beneath did not slide up after folding');
 must(Math.abs(rooms[2].getBoundingClientRect().top-r2)<1,'office in the other column moved');
 rooms[0].querySelector('canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:sign.left+20,clientY:sign.top+4}));await new Promise(r=>setTimeout(r,500));
 document.querySelector('[data-focus-key="office-row:a"]').click();await wait();must(document.querySelector('.sheet')?.textContent.includes('Workspace 2.4M tokens today'),'drawer lacks workspace tokens');document.querySelector('[data-focus-key="drawer-close"]').click();await wait();
 for(const r of rooms){const c=r.querySelector('canvas');must(c.getBoundingClientRect().right<=r.getBoundingClientRect().right+1,'office scene wider than its column')}
 must(document.documentElement.scrollWidth<=innerWidth,'office grid scrolls horizontally');
 document.querySelector('#office-page [data-focus-key="layout:list"]').click();await wait();await wait();
 const listed=[...document.querySelectorAll('#offices .office')];must(listed[1].offsetTop>listed[0].offsetTop,'List did not restore one project per line');
 document.querySelector('#office-page [data-focus-key="layout:grid"]').click();await wait();await wait();
 must(document.querySelector('#activity-list [data-focus-key="layout:grid"]').getAttribute('aria-pressed')==='true','toggles out of sync between pages');
 document.querySelector('#activity-tab').click();await wait();
}
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
if(['attention','attentionempty','big','parentlink','parentnote'].includes(scenario)){
const $=(q)=>document.querySelectorAll(q), btn=(k)=>document.querySelector('[data-focus-key="'+k+'"]'), pick=()=>$('button.chart-node-button:not(.chart-helper)').length;
const vp=()=>document.querySelector('.chart-viewport'), must=(ok,m)=>{if(!ok)throw Error(m)};
const total=pick();
must(btn('filter:all').getAttribute('aria-pressed')==='true'&&btn('filter:attention').getAttribute('aria-pressed')==='false','default filter is not All');
must(!$('.context').length&&!$('.attention').length,'All view is de-emphasized');
must(document.documentElement.scrollWidth<=innerWidth,'page scrolls horizontally in All');
if(scenario==='parentlink'){
 must(total===4,'agents '+total);must($('.chart-edge.child').length===2,'parentId edges: '+$('.chart-edge.child').length);must($('.chart-edge.membership').length===2,'membership edges '+$('.chart-edge.membership').length);
 must(!document.querySelector('[data-focus-key^="chart-helper:"]'),'parentId link rendered as an unlinked helper');
 btn('chart-branch:root:a').click();await wait();const collapsed=pick();must(collapsed===2,'collapse parentId branch: '+collapsed);
 btn('filter:attention').click();await wait();
 must(pick()===total&&$('.chart-edge.child').length===2,'attention dropped parentId ancestors');
 must($('.chart-node.attention').length===1,'attention nodes');
 const anc=[...$('.chart-node.context.ancestor')].map(x=>x.textContent);must(anc.length===2&&anc.some(t=>t.includes('Parent by pane key'))&&anc.some(t=>t.includes('Linked only')),'parentId ancestors are not shown as context: '+anc.length);
 must($('.chart-node.context:not(.ancestor)').length===1,'peer not de-emphasized');
 btn('filter:all').click();await wait();must(pick()===collapsed,'collapsed state not restored');
}
if(scenario==='parentnote'){
 const byTitle=(t)=>[...$('.chart-node')].find(n=>n.textContent.includes(t));
 must(byTitle('Parent missing').title==='Parent not in current roster','missing note: '+byTitle('Parent missing').title);
 must(byTitle('Parent in another').title==='Parent is outside this view','outside note: '+byTitle('Parent in another').title);
 must(byTitle('No parent reported').title==='','unrequested note');
 must($('.chart-edge.child').length===0&&!document.querySelector('[data-focus-key^="chart-helper:"]'),'note invented an edge or helper');
 btn('chart-node:y').click();await wait();must(document.querySelector('.sheet').textContent.includes('Parent is outside this view'),'inspector lacks note');
 btn('filter:attention').click();await wait();must($('.chart-node.attention').length===1&&byTitle('Parent in another').title==='Parent is outside this view','attention lost note');
}
if(scenario==='attentionempty'){
 btn('filter:attention').click();await wait();
 must(document.querySelector('.chart-empty')&&!vp()&&btn('chart-empty-all'),'empty state missing');
 must(document.querySelector('.chart-empty').textContent.includes('Nothing in any project'),'empty text');
 btn('chart-empty-all').click();await wait();must(pick()===total&&vp(),'All not restored from empty state');
}
if(scenario==='attention'){
 btn('chart-branch:root:a')?.click();await wait();
 const collapsed=pick();must(collapsed<total,'collapse did not reduce nodes');
 btn('filter:attention').click();await wait();
 must(pick()===total,'attention changed membership: '+pick()+' vs '+total);
 must($('.chart-node.attention').length===2,'attention nodes '+$('.chart-node.attention').length);
 must($('.chart-node.context').length===total-2,'context nodes');
 const ancestor=[...$('.chart-node.context.ancestor')].map(x=>x.textContent);must(ancestor.length===2&&ancestor.some(t=>t.includes('Middle'))&&ancestor.some(t=>t.includes('Parent')),'ancestors of the blocked leaf are not context-visible: '+ancestor.length);
 must(btn('chart-branch:root:a').getAttribute('aria-disabled')==='true','forced branch not marked');
 btn('chart-branch:root:a').click();await wait();must(pick()===total,'forced branch collapsed');
 must(document.querySelector('.chart-filter-hint').textContent==='2 of '+total+' need attention','hint '+document.querySelector('.chart-filter-hint').textContent);
 btn('filter:all').click();await wait();must(pick()===collapsed,'branch state not restored: '+pick()+' vs '+collapsed);must(!$('.context').length,'dim remained in All');
}
if(scenario==='big'){
 must(total===25,'big team count '+total);
 const v=vp();must(v.scrollWidth>v.clientWidth||innerWidth>=900,'viewport not horizontally scrollable at '+innerWidth);must(v.scrollHeight<=v.clientHeight&&getComputedStyle(v).overflowY==='hidden'&&getComputedStyle(v).overscrollBehaviorY==='auto','a chart scrolls vertically or traps the page scroll: '+v.scrollHeight+'/'+v.clientHeight);
 v.scrollLeft=90;v.scrollTop=40;const keepLeft=v.scrollLeft,keepTop=v.scrollTop;must(keepTop===0&&keepLeft>0,'a chart must scroll sideways only: '+keepLeft+','+keepTop);
 btn('filter:attention').click();await wait();
 must(pick()===total,'attention removed nodes');must($('.chart-node.attention').length===5,'attention count '+$('.chart-node.attention').length);must($('.chart-node.context').length===total-5,'context count');
 must(document.querySelector('.chart-filter-hint').textContent==='5 of '+total+' need attention','hint');
 const first=document.querySelector('.chart-node.attention').getBoundingClientRect(),frame=vp().getBoundingClientRect();
 must(first.right>frame.left&&first.left<frame.right&&first.bottom>frame.top&&first.top<frame.bottom,'first attention node not brought into view');
 must(first.top>=0&&first.bottom<=innerHeight+1,'the page did not scroll to the first attention node: '+first.top+'-'+first.bottom);
 const attScroll=[vp().scrollLeft,vp().scrollTop];vp().scrollLeft=attScroll[0]+7;
 btn('filter:all').click();await wait();must(vp().scrollLeft===keepLeft&&vp().scrollTop===keepTop,'All scroll not restored '+vp().scrollLeft+','+vp().scrollTop+' vs '+keepLeft+','+keepTop);
 btn('filter:attention').click();await wait();must(vp().scrollLeft===attScroll[0]+7,'attention scroll not restored');
 btn('filter:all').click();await wait();
 btn('chart-node:p7').click();await wait();must(document.querySelector('.chart-node.selected'),'select');
 btn('filter:attention').click();await wait();
 const sel=document.querySelector('.chart-node.selected');must(sel&&!sel.classList.contains('context'),'selection lost or dimmed');
 const r=sel.getBoundingClientRect(),f=vp().getBoundingClientRect();must(r.left>=f.left-1&&r.right<=f.right+1&&r.top>=f.top-1&&r.bottom<=f.bottom+1,'selected node not visible after toggle');
 must(document.querySelectorAll('.sheet').length===1,'inspector lost on toggle');
 btn('filter:all').click();await wait();must(document.querySelector('.chart-node.selected')&&document.querySelectorAll('.sheet').length===1,'selection not kept in All');
 document.querySelector('[data-focus-key="drawer-close"]').click();await wait();
 for(const n of $('.chart-node')){must(n.offsetWidth===114&&n.offsetHeight===92,'card resized by long name '+n.offsetWidth+'x'+n.offsetHeight);const t=n.querySelector('.chart-task');must(t.getBoundingClientRect().bottom<=n.getBoundingClientRect().bottom+1,'task text spills out of its card')}
 must(document.documentElement.scrollWidth<=innerWidth,'page scrolls horizontally with long names');
 btn('filter:attention').click();await wait();
}
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS';document.body.dataset.errors=window.errors.join('|');return;
}
let nodes=document.querySelectorAll('button.chart-node-button:not(.chart-helper)');if(nodes.length!==(scenario==='states'?5:scenario==='projects'?4:3))throw Error('incorrect selectable agent count');
const edges=document.querySelectorAll('.chart-edge.membership');if(edges.length!==(scenario==='states'?4:['peers','unknown','noid','many','multiple','projects'].includes(scenario)?3:2))throw Error('project membership edges incorrect');
if(scenario==='peers'&&document.querySelectorAll('.chart-edge.child').length)throw Error('invented child edge');
if(scenario==='linked'&&document.querySelectorAll('.chart-edge.child').length!==1)throw Error('missing reported child edge');if(scenario==='multiple'&&document.querySelectorAll('.chart-edge.child').length!==2)throw Error('multiple reported edges missing');
if(scenario==='many'&&document.querySelectorAll('.chart-edge.child').length!==12)throw Error('missing child nodes');
if(scenario==='stale'&&!document.querySelector('[title*="No longer reported"]'))throw Error('stale relation unlabeled');
if(scenario==='multiple'&&!document.querySelector('[title*="Multiple reported parents"]'))throw Error('multiple parents unlabeled');
if(scenario==='states'&&(!document.querySelector('.status-blocked')||!document.querySelector('.status-failed')))throw Error('attention or failure missing');
if(scenario==='states'&&document.querySelector('#activity-list .agent-counts')?.textContent!=='1 working1 need you1 done1 failed')throw Error('counts with blocked and failed agents: '+document.querySelector('#activity-list .agent-counts')?.textContent);
if(scenario==='projects'){const order=()=>[...document.querySelectorAll('.chart-title')].map(x=>x.textContent).join(',');const rooms=()=>[...document.querySelectorAll('section.office .room-move button')].map(b=>b.getAttribute('aria-label')).filter(x=>x.endsWith(' up')).join(',');const tab=async(id)=>{document.getElementById(id+'-tab').click();await wait()};if(order()!=='Second project,Fixture project')throw Error('charts should follow the sidebar: '+order());await tab('office');if(rooms()!=='Move Second project up,Move Fixture project up')throw Error('rooms should follow the sidebar: '+rooms());await tab('activity');document.querySelector('[data-focus-key="chart-move:q:down"]').click();await wait();if(order()!=='Fixture project,Second project')throw Error('moving a chart down did not reorder: '+order());if(!document.querySelector('[data-focus-key="chart-move:p:up"]').disabled)throw Error('the first project can still move up');await tab('office');if(rooms()!=='Move Fixture project up,Move Second project up')throw Error('the rooms did not follow the moved chart: '+rooms());await tab('activity')}
if(scenario==='projects'){if(document.querySelectorAll('.chart-block').length!==2||!document.querySelector('[data-focus-key="chart-node:other"]'))throw Error('every project should get its own chart');const titles=[...document.querySelectorAll('.chart-title')].map(x=>x.textContent);if(!titles.includes('Second project'))throw Error('project title missing: '+titles);document.querySelector('[data-focus-key="chart-node:other"]').click();await wait();const insp=document.querySelector('.sheet');if(!insp||!insp.textContent.includes('Other project task'))throw Error('drawer did not open for the other project agent');[...document.querySelectorAll('.sheet button')].find(b=>b.textContent==='×')?.click();await wait();nodes=document.querySelectorAll('button.chart-node-button')}
const viewport=document.querySelector('.chart-viewport');viewport.scrollLeft=60;const left=viewport.scrollLeft,top=viewport.scrollTop;
const allViewports=[...document.querySelectorAll('.chart-viewport')];
nodes[0].focus({preventScroll:true});const focus=nodes[0].dataset.focusKey;
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+1}))});await wait();
if(document.activeElement?.dataset.focusKey!==focus||document.querySelector('.chart-viewport').scrollLeft!==left||document.querySelector('.chart-viewport').scrollTop!==top)throw Error('chart focus or viewport lost on update');
if(document.querySelector('.chart-viewport')!==viewport||[...document.querySelectorAll('.chart-viewport')].some((v,i)=>v!==allViewports[i]))throw Error('scroll containers replaced on update, which ends a scrollbar drag');
if(scenario==='linked'){const branch=document.querySelector('.chart-branch');branch.click();await wait();if(document.querySelectorAll('.chart-edge.child').length!==0)throw Error('collapse failed');document.querySelector('.chart-branch').click();await wait();if(document.querySelectorAll('.chart-edge.child').length!==1)throw Error('expand failed')}
nodes=document.querySelectorAll('button.chart-node-button:not(.chart-helper)');nodes[0].click();await wait();
if(document.querySelectorAll('.sheet').length!==1||!document.querySelector('.sheet').textContent.includes('Finished fixture result.'))throw Error('selected result unavailable');
const rect=document.querySelector('.chart-node.selected').getBoundingClientRect(), frame=document.querySelector('.chart-viewport').getBoundingClientRect();if(rect.left<frame.left-1||rect.right>frame.right+1||rect.top<frame.top-1||rect.bottom>frame.bottom+1)throw Error('selected node is not visible');
if(document.querySelector('#activity-list .project-feed')||document.querySelector('#activity-list .tabbox'))throw Error('feed or raw tabs in primary Activity');
const selectedScroll=document.querySelector('.chart-viewport').scrollLeft;const selectedFocus=document.activeElement?.dataset.focusKey;listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+2}))});await wait();if(document.querySelectorAll('.sheet').length!==1||document.querySelector('.chart-viewport').scrollLeft!==selectedScroll||document.activeElement?.dataset.focusKey!==selectedFocus)throw Error('selection, focus or chart position lost on update');
if(scenario==='unknown'||scenario==='noid'){
const helper=document.querySelector('button.chart-helper');if(!helper)throw Error('reported helper is not selectable');
if(!helper.textContent.includes('Read')&&!helper.textContent.includes('Review keyboard'))throw Error('helper node lacks observed work');
helper.click();await wait();let card=document.querySelector('.sheet');
if(!card?.textContent.includes('Review keyboard access')||!card.textContent.includes('Read')||!card.textContent.toLowerCase().includes('waiting')||card.textContent.includes('Open workspace'))throw Error('helper details incorrect');
listener({...window.fixture,agents:window.fixture.agents.map(x=>({...x,lastSeenAt:x.lastSeenAt+5}))});await wait();
if(!document.querySelector('.sheet')?.textContent.includes('Review keyboard access'))throw Error('helper selection lost on refresh');
document.querySelector('button.chart-node-button:not(.chart-helper)').click();await wait();if(document.querySelectorAll('.sheet').length!==1||!document.querySelector('.sheet').textContent.includes('Current work'))throw Error('agent selection did not replace helper');document.querySelector('button.chart-helper').click();await wait();
const stale={...window.fixture,agents:window.fixture.agents.map(x=>x.id==='a'?{...x,family:x.family.map(c=>({...c,reported:false,missingSince:now}))}:x)};listener(stale);await wait();
if(!document.querySelector('.sheet')?.textContent.includes('No longer reported'))throw Error('missing helper not labeled');
const replacement=scenario==='noid'?[{...child,id:'',name:'Different helper',description:'Different task'}]:[];listener({...window.fixture,agents:window.fixture.agents.map(x=>x.id==='a'?{...x,family:replacement}:x)});await wait();if(document.querySelector('.sheet'))throw Error('expired helper selection retained');
listener(window.fixture);await wait();document.querySelector('button.chart-helper').click();await wait();
}
if(scenario==='departure'){listener({...window.fixture,agents:window.fixture.agents.filter(x=>x.id!=='a')});await wait();if(document.querySelector('.sheet'))throw Error('departed selection retained');listener(window.fixture);await wait();document.querySelector('button.chart-node-button').click();await wait()}
window.scrollTo(0,0);document.body.dataset.width=String(innerWidth);document.body.dataset.fixture='PASS'
}catch(e){document.body.dataset.fixture='FAIL '+e.message}document.body.dataset.errors=window.errors.join('|')})();
