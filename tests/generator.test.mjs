import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLAN} from '../data.js';
import {lookup,getTotals} from '../calculations.js';
import {generateWeek} from '../generator.js';

const state=()=>({plan:structuredClone(DEFAULT_PLAN),excluded:[],pantry:[],prices:{},budget:200,people:5,teens:3,coffeeGrams:60,coffeeMilk:350});

test('generated week fills 7 breakfasts, 7 lunches and meat-based dinners',()=>{
  const s=state(),r=generateWeek(s,{attempts:300});
  assert.equal(r.plan.length,7);
  for(let d=0;d<7;d++){
    assert.equal(lookup[r.plan[d].breakfast].kind,'breakfast');
    assert.equal(lookup[r.plan[d].lunch].kind,d<5?'school':'weekend');
    const dinner=lookup[r.plan[d].dinner];
    assert.equal(dinner.kind,'dinner');
    assert.ok(['drum','breast','pork','saus','tuna','ham'].some(id=>dinner.ingredients[id]>0));
  }
  assert.equal(getTotals({...s,plan:r.plan}).total,r.total);
});

test('excluded recipes stay out of generated menu',()=>{
  const s=state();s.excluded=['roast','chicken_sand','porridge'];
  const r=generateWeek(s,{attempts:500});
  for(const day of r.plan)assert.ok(!Object.values(day).some(id=>s.excluded.includes(id)));
});

test('dinner-only generation preserves all breakfasts and lunches',()=>{
  const s=state(); const r=generateWeek(s,{sections:{breakfast:false,lunch:false,dinner:true},attempts:350});
  r.plan.forEach((p,i)=>{assert.equal(p.breakfast,s.plan[i].breakfast);assert.equal(p.lunch,s.plan[i].lunch);});
});

test('uses selected budget and never falsely claims an infeasible plan fits',()=>{
  const s=state();s.budget=20;
  const r=generateWeek(s,{attempts:300});
  assert.ok(r.total>20);
  assert.equal(r.withinBudget,false);
});

test('validates empty selections and unavailable recipes',()=>{
  const s=state();
  assert.match(generateWeek(s,{sections:{breakfast:false,lunch:false,dinner:false}}).error,/at least one/);
  s.excluded=['tuna_wraps','egg_picnic','chicken_wraps','sausage_wraps'];
  assert.match(generateWeek(s,{attempts:50}).error,/No eligible weekend/);
});

test('respects price overrides and food already in pantry',()=>{
 const s=state();s.pantry=['coffee','rice'];s.prices.milk=20;
 const r=generateWeek(s,{attempts:250});
 assert.equal(r.total,getTotals({...s,plan:r.plan}).total);
});
