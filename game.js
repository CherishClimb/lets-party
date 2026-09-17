/* Pure progression rules. Version 2 adds the clue and schoolyard story milestones. */
(function (root) {
  'use strict';
  const teamIds = ['monster', 'octopus', 'crocodile'];
  const iconIds = ['star','moon','rainbow','heart','cloud','sun','diamond','flower','butterfly','lightning','wand','leaf','comet','crown','gem'];
  const minChildren = 6, maxChildren = 15, defaultChildren = 12;
  const screens = ['home','setup','reveal','intro','warmup','level1','transition2','level2','transition3','level3','award','destination','pinata','treasure','returnMessage','waiting','finale','found','rescued','rewards','done','progress'];
  const childCount = value => Math.max(minChildren,Math.min(maxChildren,Number.isInteger(value)?value:defaultChildren));
  function fresh(participantCount=defaultChildren) {
    participantCount=childCount(participantCount);
    return {
      version:2,
      participantCount,
      children:Array.from({length:maxChildren},(_,i)=>({id:'child-'+(i+1),name:'',icon:iconIds[i],teamId:teamIds[i%teamIds.length]})),
      teams:Object.fromEntries(teamIds.map(id=>[id,{gesture:null,completedLevels:[false,false,false]}])),
      currentScreen:'home',introCompleted:false,clueRevealed:false,treasureFound:false,
      returnInvited:false,rescued:false,birthdayComplete:false,rewardIndex:0,award:null
    };
  }
  const allComplete = (s,level) => teamIds.every(id=>s.teams[id].completedLevels[level]);
  const allTasksComplete = s => [0,1,2].every(i=>allComplete(s,i));
  const teamSize = (s,id) => teamIds.includes(id)?s.children.slice(0,childCount(s.participantCount)).filter(c=>c.teamId===id&&c.name.trim()).length:0;
  const matsFor = (s,id,round) => [0,1].includes(round)?teamSize(s,id)+(round===0?1:0):null;
  const earned = (s,id,level) => s.teams[id].completedLevels[level] && (level!==2 || s.clueRevealed);
  const eligible = s => allTasksComplete(s) && s.clueRevealed;
  const levelOpen = (s,level) => Array.from({length:level},(_,i)=>i).every(i=>allComplete(s,i));
  function canVisit(s,screen) {
    if (!screens.includes(screen)) return false;
    if (/^level[123]$/.test(screen)) return levelOpen(s,Number(screen.slice(-1))-1);
    if (screen==='transition2') return levelOpen(s,1);
    if (screen==='transition3') return levelOpen(s,2);
    if (screen==='award') return !!s.award && teamIds.includes(s.award.id) && [0,1].includes(s.award.level) && earned(s,s.award.id,s.award.level);
    if (screen==='destination') return allTasksComplete(s);
    if (screen==='pinata') return eligible(s);
    if (screen==='treasure') return eligible(s) && s.treasureFound;
    if (['returnMessage','waiting','finale','found'].includes(screen)) return eligible(s) && s.returnInvited;
    if (['rescued','rewards','done'].includes(screen)) return eligible(s) && s.returnInvited && s.rescued;
    return true;
  }
  function normalize(input) {
    if (!input || ![1,2].includes(input.version) || !Array.isArray(input.children)) throw Error('invalid-state');
    const savedCount=Number.isInteger(input.participantCount)?input.participantCount:input.children.length;
    const s=fresh(savedCount);
    s.children.forEach((child,i)=>{
      const c=input.children[i];
      if (!c || typeof c!=='object') return;
      child.name=typeof c.name==='string'?c.name.slice(0,40):'';
      child.icon=iconIds.includes(c.icon)?c.icon:child.icon;
      child.teamId=teamIds.includes(c.teamId)?c.teamId:child.teamId;
    });
    teamIds.forEach(id=>{
      const t=input.teams?.[id];
      s.teams[id].gesture=Number.isInteger(t?.gesture) && t.gesture>=0 && t.gesture<3?t.gesture:null;
      s.teams[id].completedLevels=[0,1,2].map(i=>t?.completedLevels?.[i]===true);
    });
    s.introCompleted=input.introCompleted===true;
    // Preserve already-earned powers and completed old finales when upgrading.
    const legacyHome=input.version===1 && (input.rescued===true || ['waiting','finale','found','rewards','done'].includes(input.currentScreen));
    s.clueRevealed=(input.clueRevealed===true || input.version===1) && allTasksComplete(s);
    s.treasureFound=(input.treasureFound===true || legacyHome) && eligible(s);
    s.returnInvited=(input.returnInvited===true || legacyHome) && s.treasureFound;
    s.rescued=input.rescued===true && eligible(s) && s.returnInvited;
    s.birthdayComplete=(input.birthdayComplete===true || (input.version===1 && input.currentScreen==='done')) && s.rescued;
    s.rewardIndex=Number.isInteger(input.rewardIndex)?Math.max(0,Math.min(2,input.rewardIndex)):0;
    if (teamIds.includes(input.award?.id) && [0,1].includes(input.award?.level)) s.award={id:input.award.id,level:input.award.level};
    s.currentScreen=canVisit(s,input.currentScreen)?input.currentScreen:'home';
    return s;
  }
  function revealClue(s) {
    if (!allTasksComplete(s)) return false;
    s.clueRevealed=true;
    return true;
  }
  function mark(s,id,level,value) {
    if (!teamIds.includes(id) || ![0,1,2].includes(level)) return false;
    if (value && !levelOpen(s,level)) return false;
    s.teams[id].completedLevels[level]=!!value;
    if (!allTasksComplete(s)) {
      s.clueRevealed=false;s.treasureFound=false;s.returnInvited=false;s.rescued=false;s.birthdayComplete=false;s.rewardIndex=0;
    }
    if (!canVisit(s,s.currentScreen)) s.currentScreen='progress';
    return true;
  }
  root.Game={teamIds,minChildren,maxChildren,fresh,normalize,teamSize,matsFor,allComplete,allTasksComplete,earned,eligible,levelOpen,canVisit,mark,revealClue};
  if (typeof module!=='undefined') module.exports=root.Game;
})(globalThis);
