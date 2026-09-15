/* Pure game state and progression rules. */
(function (root) {
  'use strict';
  const teamIds = ['monster', 'octopus', 'crocodile'];
  const iconIds = ['star','moon','rainbow','heart','cloud','sun','diamond','flower','butterfly','lightning','wand','leaf','comet','crown','gem'];
  const screens = ['home','setup','reveal','intro','warmup','level1','level2','level3','destination','waiting','finale','found','rewards','done','progress'];
  function fresh() {
    return {version:1, children:Array.from({length:12}, (_,i) => ({id:'child-'+(i+1),name:'',icon:iconIds[i],teamId:teamIds[Math.floor(i/4)]})), teams:Object.fromEntries(teamIds.map(id => [id,{gesture:null,completedLevels:[false,false,false]}])), currentScreen:'home',introCompleted:false,rescued:false,rewardIndex:0};
  }
  const allComplete = (s, level) => teamIds.every(id => s.teams[id].completedLevels[level]);
  const eligible = s => [0,1,2].every(level => allComplete(s,level));
  const levelOpen = (s, level) => Array.from({length:level},(_,i)=>i).every(i=>allComplete(s,i));
  function canVisit(s, screen) {
    if (!screens.includes(screen)) return false;
    if (/^level[123]$/.test(screen)) return levelOpen(s,Number(screen.slice(-1))-1);
    if (['destination','waiting','finale','found'].includes(screen)) return eligible(s);
    if (['rewards','done'].includes(screen)) return eligible(s) && s.rescued;
    return true;
  }
  function normalize(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.children)) throw new Error('invalid-state');
    const s = fresh();
    s.children.forEach((child,i) => {
      const c = input.children[i];
      if (!c || typeof c !== 'object') return;
      child.name = typeof c.name === 'string' ? c.name.slice(0,40) : '';
      child.icon = iconIds.includes(c.icon) ? c.icon : child.icon;
      child.teamId = teamIds.includes(c.teamId) ? c.teamId : child.teamId;
    });
    teamIds.forEach(id => {
      const t = input.teams?.[id];
      s.teams[id].gesture = Number.isInteger(t?.gesture) && t.gesture >= 0 && t.gesture < 3 ? t.gesture : null;
      s.teams[id].completedLevels = [0,1,2].map(i=>t?.completedLevels?.[i] === true);
    });
    s.introCompleted = input.introCompleted === true;
    s.rescued = input.rescued === true && eligible(s);
    s.rewardIndex = Number.isInteger(input.rewardIndex) ? Math.max(0,Math.min(2,input.rewardIndex)) : 0;
    s.currentScreen = canVisit(s,input.currentScreen) ? input.currentScreen : 'home';
    return s;
  }
  function mark(s, id, level, value) {
    if (!teamIds.includes(id) || ![0,1,2].includes(level)) return false;
    if (value && !levelOpen(s,level)) return false;
    s.teams[id].completedLevels[level] = !!value;
    if (!eligible(s)) { s.rescued = false; s.rewardIndex = 0; }
    if (!canVisit(s,s.currentScreen)) s.currentScreen = 'progress';
    return true;
  }
  root.Game = {teamIds,fresh,normalize,allComplete,eligible,levelOpen,canVisit,mark};
  if (typeof module !== 'undefined') module.exports = root.Game;
})(globalThis);
