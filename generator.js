import {RECIPES} from './data.js';
import {getTotals, lookup} from './calculations.js';

const MEATS=['drum','breast','pork','saus','tuna','ham'];
const PARTS=['breakfast','lunch','dinner'];
const groupFor=(part,day)=>part==='lunch'?(day<5?'school':'weekend'):part;

function familySafe(recipe){
  if (/\b(beans?|lentils?)\b/i.test(recipe.name)) return false;
  return recipe.kind!=='dinner'||MEATS.some(id=>Number(recipe.ingredients[id])>0);
}

function penalty(plan, original){
  const ids=(part,start=0,end=7)=>plan.slice(start,end).map(day=>day[part]);
  const dinner=ids('dinner'), breakfast=ids('breakfast'), school=ids('lunch',0,5);
  const repeatCount=arr=>arr.length-new Set(arr).size;
  let v=repeatCount(dinner)*30 + Math.max(0,repeatCount(school)-1)*10;
  v += Math.max(0,3-new Set(breakfast).size)*5;
  if(plan[5].lunch===plan[6].lunch)v+=12;
  const meats=new Set(dinner.map(id=>MEATS.find(m=>lookup[id]?.ingredients[m]>0)).filter(Boolean));
  if(meats.size<3)v+=(3-meats.size)*9;
  for(let day=1;day<7;day++)if(dinner[day]===dinner[day-1])v+=20;
  // Prefer a genuinely fresh menu over showing the same schedule again.
  v-=dinner.filter((id,i)=>id!==original[i].dinner).length*0.7;
  return v;
}

/** Generate varied recipe combinations locally; does not invent recipes or fetch prices. */
export function generateWeek(state,{sections={breakfast:true,lunch:true,dinner:true},attempts=1300,random=Math.random}={}){
  const active=PARTS.filter(part=>sections[part]);
  if(!active.length)return {error:'Choose at least one meal type to generate.'};
  const choices={};
  for(const part of active)for(let day=0;day<7;day++){
    const group=groupFor(part,day),key=`${part}:${day}`;
    choices[key]=RECIPES.filter(r=>r.kind===group&&!state.excluded.includes(r.id)&&familySafe(r));
    if(!choices[key].length)return {error:`No eligible ${group} recipes remain. Restore a recipe from the library.`};
  }
  const slots=active.flatMap(part=>Array.from({length:7},(_,day)=>({part,day,key:`${part}:${day}`})));
  const original=state.plan.map(d=>({...d}));
  const initial=original.map(d=>({...d}));
  for(const {part,day,key} of slots){
    if(!choices[key].some(recipe=>recipe.id===initial[day][part])) initial[day][part]=choices[key][0].id;
  }
  const budget=Number(state.budget);
  const evaluation=plan=>{
    const total=getTotals({...state,plan}).total;
    const variety=penalty(plan,original);
    // A feasible plan always beats an over-budget plan. Among feasible plans,
    // prioritise variety; among over-budget plans, prioritise lowering spend.
    const score=total<=budget?variety+Math.max(0,budget-total)*0.018:(total-budget)*8+Math.max(0,variety)*0.3;
    return {plan,total,withinBudget:total<=budget,score};
  };
  const isBetter=(a,b)=>!b||a.withinBudget&&!b.withinBudget||a.withinBudget===b.withinBudget&&a.score<b.score-0.001;
  let best=evaluation(initial);
  const shuffled=arr=>arr.slice().sort(()=>random()-0.5);
  for(let trial=0;trial<attempts;trial++){
    const plan=(trial%9===0||trial<25?initial:best.plan).map(d=>({...d}));
    const changes=trial%9===0?slots.length:trial<25?Math.ceil(slots.length*0.6):1+Math.floor(random()*Math.min(4,slots.length));
    for(const slot of shuffled(slots).slice(0,changes)){
      const pool=choices[slot.key];
      const other=plan.filter((_,i)=>i!==slot.day).map(d=>d[slot.part]);
      const fresh=pool.filter(r=>!other.includes(r.id));
      const options=(fresh.length&&random()<0.85)?fresh:pool;
      const next=options[Math.floor(random()*options.length)];
      plan[slot.day][slot.part]=next.id;
    }
    const result=evaluation(plan);
    if(isBetter(result,best))best=result;
  }
  const changed=best.plan.reduce((count,day,i)=>count+PARTS.filter(p=>day[p]!==original[i][p]).length,0);
  return {...best,changed,budget};
}
