import {PRODUCTS, RECIPES, DEFAULT_PLAN, DAYS} from './data.js';
import {lookup, makeShopping, getTotals, formatQuantity, money} from './calculations.js';
import {generateWeek} from './generator.js';
const KEY='family-table-v1';
const DEFAULT=()=>({plan:structuredClone(DEFAULT_PLAN),excluded:[],pantry:[],checked:[],prices:{},budget:200,people:5,teens:3,coffeeGrams:60,coffeeMilk:350});
let state=load(), tab=tabFromHash(), filter='all', search='', toastTimer, modalContext=null;
let generatorParts={breakfast:true,lunch:true,dinner:true}, generatorMessage='';
const app=document.getElementById('app'), modal=document.getElementById('modal');
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY));if(!saved)return DEFAULT();return sanitize(saved);}catch{return DEFAULT();}}
function sanitize(obj){
  const s=DEFAULT(); if(!obj||typeof obj!=='object')return s;
  if(Array.isArray(obj.plan)&&obj.plan.length===7)for(let i=0;i<7;i++)for(const part of ['breakfast','lunch','dinner']){
    const r=lookup[obj.plan[i]?.[part]];
    if(r && (part==='lunch'? r.kind===(i<5?'school':'weekend'):r.kind===part))s.plan[i][part]=r.id;
  }
  for(const k of ['excluded','pantry','checked'])if(Array.isArray(obj[k]))s[k]=obj[k].filter(x=>typeof x==='string'&&(k==='excluded'?Boolean(lookup[x]):Boolean(PRODUCTS[x])));
  if(obj.prices&&typeof obj.prices==='object')for(const [id,val] of Object.entries(obj.prices))if(PRODUCTS[id]&&Number.isFinite(Number(val))&&Number(val)>=0&&Number(val)<=10000)s.prices[id]=Number(val);
  for(const [k,min,max] of [['budget',20,3000],['people',1,20],['teens',0,20],['coffeeGrams',0,500],['coffeeMilk',0,2000]])if(Number.isFinite(Number(obj[k])))s[k]=Math.max(min,Math.min(max,Number(obj[k])));
  return s;
}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{} }
function tabFromHash(){return ['planner','shopping','recipes','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'planner';}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);}
function image(r){return './assets/'+r.image+'.png';}
function childrenFor(kind,day){return kind==='lunch'?(day<5?'school':'weekend'):kind;}
function allCandidates(kind,day){return RECIPES.filter(r=>r.kind===childrenFor(kind,day)&&!state.excluded.includes(r.id));}
function pickNext(kind,day){
  const current=state.plan[day][kind], other=state.plan.filter((_,i)=>i!==day).map(d=>d[kind]);
  const candidates=allCandidates(kind,day).filter(r=>r.id!==current);
  if(!candidates.length)return current;
  const unused=candidates.filter(r=>!other.includes(r.id));
  const pool=unused.length?unused:candidates;
  return pool[0].id;
}
const headings={planner:['Your week, sorted.','Seven family dinners, school lunches, portable weekends and proper coffee.'],shopping:['Your smarter shopping list.','Quantities and costs change when you swap a meal.'],recipes:['Meals worth repeating.','Explore recipes, exclude anything unpopular, and rotate in something new.'],settings:['Make it yours.','Tune the family size, coffee, budget and saved preferences.']};
function render(){
  const totals=getTotals(state), budgetLeft=state.budget-totals.total;
  app.innerHTML=`<section class="hero"><div><div class="eyebrow">Family favourites · Plan, swap, shop</div><h1>${headings[tab][0]}</h1><p>${headings[tab][1]}</p></div><div class="hero-actions">${tab==='planner'?'<button class="btn primary" data-action="shuffle-dinners">↻ Rotate all dinners</button>':''}<button class="btn" data-action="print">↥ Print</button></div></section>
  <nav class="tabs" aria-label="Sections">${[['planner','▦ Weekly planner'],['shopping','☷ Shopping list'],['recipes','♧ Recipe library'],['settings','⚙ Settings']].map(([id,label])=>`<a class="tab ${tab===id?'active':''}" href="#${id}" ${tab===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
  <section class="overview"><div class="metric primary"><div class="metric-title">Estimated weekly shop</div><div class="metric-value">${money(totals.total)}</div><div class="progress"><span style="width:${Math.min(100,Math.round(totals.total/state.budget*100))}%"></span></div><div class="hint">${budgetLeft>=0?money(budgetLeft)+' budget remaining':money(-budgetLeft)+' over your budget'}</div></div>
  <div class="metric"><div class="metric-title">Dinner servings</div><div class="metric-value">${state.people*7}</div><div class="hint">7 dinners for ${state.people} people</div></div><div class="metric"><div class="metric-title">Packed lunches</div><div class="metric-value">${state.teens*5+state.people*2}</div><div class="hint">School + weekend</div></div><div class="metric"><div class="metric-title">Real coffee beans</div><div class="metric-value">${state.coffeeGrams*7}g</div><div class="hint">Weekly brewing allowance</div></div></section>
  ${budgetLeft<0?`<div class="notice warning">This plan is ${money(-budgetLeft)} above your ${money(state.budget)} target using your estimated prices. Swap meals, mark pantry items as already owned or adjust prices in the shopping list.</div>`:''}
  ${tab==='planner'?renderPlanner():tab==='shopping'?renderShop(totals):tab==='recipes'?renderRecipes():renderSettings()}`;
}
function renderGenerator(){return `<section class="panel generator-panel" aria-labelledby="generator-title">
  <div class="generator-heading"><div><div class="eyebrow">BUILD A WEEK FOR YOUR BUDGET</div><h2 id="generator-title">Set the budget. Generate the meals.</h2><p>Family breakfasts, three teenagers' school lunches, portable weekend lunches and meat-based dinners. No beans or lentils.</p></div><span class="chip">No AI subscription</span></div>
  <div class="generator-fields">
    <label class="field">Weekly grocery budget (AUD)<input id="generator-budget" type="number" min="20" max="3000" step="5" value="${state.budget}" aria-label="Weekly grocery budget"></label>
    <label class="field">People in family<input type="number" min="1" max="20" data-setting="people" value="${state.people}"></label>
    <label class="field">School lunches for teens<input type="number" min="0" max="20" data-setting="teens" value="${state.teens}"></label>
  </div>
  <fieldset class="generator-parts"><legend>What should I regenerate?</legend>${[['breakfast','Breakfasts'],['lunch','School + weekend lunches'],['dinner','Dinners']].map(([key,label])=>`<label><input type="checkbox" data-generate-part="${key}" ${generatorParts[key]?'checked':''}> ${label}</label>`).join('')}</fieldset>
  <div class="generator-actions"><button class="btn primary" data-action="generate-week">✦ Generate my week</button><span class="mini muted">Uses your recipe exclusions, saved price estimates and pantry items.</span></div>
  ${generatorMessage?`<div class="notice generator-result" role="status">${safe(generatorMessage)}</div>`:''}
  </section>`;}
function renderPlanner(){return `${renderGenerator()}<section class="section-head"><div><h2>Seven days of family food</h2><p>Use ↻ to rotate a meal or Change to pick a specific alternative.</p></div><div class="section-actions"><button class="btn sm" data-action="reset-plan">Reset week</button><button class="btn sm primary" data-action="go-shopping">View shopping list →</button></div></section>
<div class="schedule">${state.plan.map((d,i)=>{
  const dinner=lookup[d.dinner],b=lookup[d.breakfast],l=lookup[d.lunch];
  return `<article class="day-card"><div class="day-top"><div><div class="day-tag">Day ${i+1}${i>=5?' · Weekend':''}</div><div class="day-name">${DAYS[i]}</div></div><span class="chip">${i<5?'School day':'Everyone home'}</span></div><img class="photo" src="${image(dinner)}" alt="Illustration of ${safe(dinner.name)}" loading="lazy"><div class="day-body"><div style="display:flex;gap:10px;justify-content:space-between;align-items:start"><div><h3 class="dinner-title">${safe(dinner.name)}</h3><p class="dinner-desc">${safe(dinner.description)} · ${dinner.time}</p></div><button class="btn sm" data-action="view" data-id="${dinner.id}">Recipe</button></div>
  ${[['breakfast',b],['lunch',l],['dinner',dinner]].map(([part,r])=>`<div class="meal-row"><span class="meal-kind">${part}</span><span class="meal-name">${safe(r.name)}</span><div class="inline-actions"><button class="icon-btn" title="Rotate ${part}" aria-label="Rotate ${DAYS[i]} ${part}" data-action="rotate" data-day="${i}" data-kind="${part}">↻</button><button class="btn sm" data-action="swap" data-day="${i}" data-kind="${part}">Change</button></div></div>`).join('')}</div></article>`;}).join('')}</div><p class="notice" style="margin-top:18px">Lunch quantities cover three school-aged teenagers from Monday to Friday and all ${state.people} family members at weekends. Breakfast and dinner are for all ${state.people}. Milk and whole coffee beans are also counted in your shopping list.</p>`;}
function renderShop({rows,total}){
  const groups=Object.groupBy ? Object.groupBy(rows,r=>r.category) : rows.reduce((o,r)=>{(o[r.category]||=[]).push(r);return o;},{});
  return `<section class="section-head"><div><h2>One list, everything covered</h2><p>Based on your chosen recipes. Edit the estimated pack prices to match your Woolworths store.</p></div><div class="section-actions"><button class="btn sm" data-action="copy-shop">Copy list</button><button class="btn sm" data-action="clear-checked">Clear ticks</button><button class="btn sm primary" data-action="print">↥ Print list</button></div></section>
  <div class="notice">Prices are editable estimates based on the previous printable plan, <strong>not live Woolworths prices</strong>. Quantities round up to typical packs; meat bought by weight rounds to 100 g. Tick <strong>Have it</strong> to remove something you already own from the checkout estimate.</div>
  <div class="shopping-layout"><div>${Object.entries(groups).map(([category,items])=>`<section class="shop-group"><h3>${safe(category)}<span>${money(items.reduce((s,r)=>s+r.checkout,0))}</span></h3>${items.map(r=>`<div class="shop-row ${state.checked.includes(r.id)?'done':''}"><div><label><input type="checkbox" data-check="${r.id}" ${state.checked.includes(r.id)?'checked':''}><span>${safe(r.name)}<span class="sup">Buy ${formatQuantity(r.buy,r.unit)} · ${r.packCount} × ${safe(r.stepLabel)}</span></span></label></div><div class="needed mini muted">Need ${formatQuantity(r.required,r.unit)}</div><div><label class="mini muted">$ / pack<br><input type="number" min="0" step="0.01" data-price="${r.id}" value="${r.packPrice.toFixed(2)}" aria-label="Price per pack for ${safe(r.name)}"></label></div><div class="price">${money(r.checkout)}<label class="sup"><input type="checkbox" data-pantry="${r.id}" ${r.pantry?'checked':''}> Have it</label></div></div>`).join('')}</section>`).join('')}</div>
  <aside class="summary"><h3>Your trolley</h3><div class="summary-line"><span>Different ingredients</span><strong>${rows.length}</strong></div><div class="summary-line"><span>Estimated before pantry</span><strong>${money(rows.reduce((s,r)=>s+r.cost,0))}</strong></div><div class="summary-line"><span>Already at home</span><strong>−${money(rows.filter(r=>r.pantry).reduce((s,r)=>s+r.cost,0))}</strong></div><div class="summary-line"><span>Budget</span><strong>${money(state.budget)}</strong></div><div class="summary-total">${money(total)}</div><p class="mini ${state.budget<total?'status over':'status'}">${state.budget>=total?money(state.budget-total)+' left to spend':money(total-state.budget)+' over target'}</p><button class="btn primary wide" data-action="copy-shop">Copy shopping list</button><p class="mini muted">Checking an item off means you've picked it up, not that it's removed from your budget.</p></aside></div>`;
}
function renderRecipes(){const visible=RECIPES.filter(r=>(filter==='all'||r.kind===filter) && (r.name.toLowerCase().includes(search)||r.description.toLowerCase().includes(search)));
  return `<section class="section-head"><div><h2>Find your next favourite</h2><p>${RECIPES.length} prepared recipes, including ${RECIPES.filter(r=>r.kind==='dinner').length} dinners. Excluded meals won't be suggested when you rotate.</p></div><input class="search-input print-hide" id="recipe-search" aria-label="Search recipes" placeholder="Search meals…" value="${safe(search)}"></section><div class="recipe-filter">${[['all','All meals'],['dinner','Dinners'],['breakfast','Breakfasts'],['school','School lunches'],['weekend','Weekend lunches']].map(([id,label])=>`<button class="btn sm ${id===filter?'primary':''}" data-action="filter" data-filter="${id}">${label}</button>`).join('')}</div><div class="recipe-grid">${visible.map(r=>`<article class="recipe-card ${state.excluded.includes(r.id)?'excluded':''}"><img src="${image(r)}" alt="Illustrated ${safe(r.name)}" loading="lazy"><div class="body"><span class="chip">${r.time} · Serves ${r.servings}</span><h3>${safe(r.name)}</h3><p>${safe(r.description)}</p><div class="recipe-actions"><button class="btn sm primary" data-action="view" data-id="${r.id}">View recipe</button><button class="btn sm ${state.excluded.includes(r.id)?'danger':''}" data-action="exclude" data-id="${r.id}">${state.excluded.includes(r.id)?'Restore meal':'Exclude meal'}</button></div></div></article>`).join('')}</div>${visible.length?'':'<div class="empty">No recipes match your search. Try a different term.</div>'}`;
}
function renderSettings(){return `<div class="settings-grid"><section class="panel"><h3>Household & budget</h3><p>Changes here automatically recalculate the shopping list and quantities.</p><div class="field-grid"><label class="field">People for family meals<input type="number" min="1" max="20" data-setting="people" value="${state.people}"></label><label class="field">Teenagers getting school lunches<input type="number" min="0" max="20" data-setting="teens" value="${state.teens}"></label><label class="field">Weekly budget (AUD)<input type="number" min="20" max="3000" step="1" data-setting="budget" value="${state.budget}"></label><label class="field">Whole coffee beans, grams per day<input type="number" min="0" max="500" step="5" data-setting="coffeeGrams" value="${state.coffeeGrams}"></label><label class="field">Milk for coffee, mL per day<input type="number" min="0" max="2000" step="50" data-setting="coffeeMilk" value="${state.coffeeMilk}"></label></div><p class="mini">This plan defaults to five family members, three school lunches per weekday, $200 per week and whole coffee beans. Milk and coffee are included on all seven days.</p></section>
  <section class="panel"><h3>Preferences & saved data</h3><p>Meals with beans and lentils are excluded from the starter recipe library. You can exclude any other recipe in the Recipe library; excluded meals won't be offered in rotation.</p><div class="notice">This static version saves changes in <strong>this browser only</strong>. GitHub Pages and Docker work without a database. To sync across devices later, we can add sign-in and self-hosted storage.</div><p><strong>${state.excluded.length}</strong> meals excluded · <strong>${state.pantry.length}</strong> grocery items marked as already at home.</p><div class="recipe-actions"><button class="btn" data-action="export">Export my plan (.json)</button><button class="btn" data-action="import">Import plan</button><button class="btn danger" data-action="reset-all">Reset everything</button></div><p class="mini">No account is required. The export button lets you back up your own preferences.</p></section></div>`;}
function openModal(html){modal.innerHTML=`<div class="backdrop" data-action="close-modal"></div><div class="modal-card" role="dialog" aria-modal="true" aria-label="Meal options"><div class="modal-head"><div><div class="eyebrow">Family Table</div><h2>${modalContext?.title||'Recipe'}</h2></div><button class="icon-btn" data-action="close-modal" aria-label="Close">×</button></div><div class="modal-content">${html}</div></div>`;modal.classList.add('open');document.body.style.overflow='hidden';}
function closeModal(){modal.classList.remove('open');modal.innerHTML='';document.body.style.overflow='';modalContext=null;}
function showSwap(day,kind){const current=state.plan[day][kind];modalContext={title:`Change ${DAYS[day]}'s ${kind}`,day,kind};const options=RECIPES.filter(r=>r.kind===childrenFor(kind,day));openModal(`<p class="muted mini">Pick a replacement. Recipes you've excluded are hidden until you restore them in the library.</p>${options.filter(r=>!state.excluded.includes(r.id)).map(r=>`<div class="swap-option"><img alt="" src="${image(r)}"><div class="grow"><strong>${safe(r.name)}</strong><span class="mini muted">${r.time} · ${safe(r.description)}</span></div><button class="btn sm ${r.id===current?'':'primary'}" data-action="select-recipe" data-id="${r.id}" ${r.id===current?'disabled':''}>${r.id===current?'Selected':'Use this'}</button></div>`).join('')}`);}
function viewRecipe(id){const r=lookup[id];if(!r)return;modalContext={title:r.name};openModal(`<img class="recipe-detail-hero" src="${image(r)}" alt="Illustration of ${safe(r.name)}"><p class="muted">${safe(r.description)} · ${r.time} · Serves ${r.servings}</p><h3>Ingredients</h3><ul class="ingredients">${Object.entries(r.ingredients).map(([id,quantity])=>`<li>${formatQuantity(quantity,PRODUCTS[id].unit)} ${safe(PRODUCTS[id].name.toLowerCase())}</li>`).join('')}</ul><h3>Method</h3><ol class="steps">${r.steps.map(x=>`<li>${safe(x)}</li>`).join('')}</ol><div class="notice">Recipe quantities are for the stated number of serves. Your shopping list scales them to your household settings. Raw chicken should reach 75°C, and perishable packed lunches need an insulated bag and frozen ice packs.</div><button class="btn" data-action="print">Print recipe / current page</button>`);}
function updateAndRender(msg){persist();render();if(msg)showToast(msg);}
function rotate(day,kind){const next=pickNext(kind,day);if(next===state.plan[day][kind]){showToast('No other suitable meals are available. Restore an excluded recipe.');return;}state.plan[day][kind]=next;updateAndRender('Meal rotated. Shopping list updated.');}
function excludeRecipe(id){const excluded=state.excluded.includes(id);if(excluded)state.excluded=state.excluded.filter(x=>x!==id);else {state.excluded.push(id);for(let day=0;day<7;day++)for(const part of ['breakfast','lunch','dinner'])if(state.plan[day][part]===id)state.plan[day][part]=pickNext(part,day);}updateAndRender(excluded?'Meal restored to rotation.':'Meal excluded; any planned occurrences replaced.');}
function shoppingText(){const rows=makeShopping(state);return `FAMILY TABLE — SHOPPING LIST\nBudget: ${money(state.budget)} | Estimated checkout: ${money(getTotals(state).total)}\n\n`+[...new Set(rows.map(r=>r.category))].map(cat=>cat+'\n'+rows.filter(r=>r.category===cat).map(r=>`[${state.checked.includes(r.id)?'x':' '}] ${r.name}: ${formatQuantity(r.buy,r.unit)} — ${r.pantry?'Already have':money(r.checkout)}`).join('\n')).join('\n\n')+'\n\nPrices are estimates; verify at checkout.';}
async function copyShop(){try{await navigator.clipboard.writeText(shoppingText());showToast('Shopping list copied.');}catch{showToast('Copy unavailable. Try printing or exporting your plan.');}}
function exportData(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download='family-table-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
window.addEventListener('hashchange',()=>{tab=tabFromHash();render();window.scrollTo(0,0);});
document.addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-action]');if(!btn)return;const {action,day,kind,id,filter:which}=btn.dataset;const idx=Number(day);
  if(action==='print'){window.print();return;}if(action==='go-shopping'){location.hash='shopping';return;}
  if(action==='generate-week'){
    const input=document.getElementById('generator-budget');
    const requested=Number(input?.value);
    if(!Number.isFinite(requested)||requested<20||requested>3000){showToast('Enter a weekly budget between $20 and $3,000.');return;}
    state.budget=requested;
    const result=generateWeek(state,{sections:generatorParts});
    if(result.error){generatorMessage=result.error;updateAndRender(result.error);return;}
    state.plan=result.plan;state.checked=[];
    generatorMessage=result.withinBudget
      ?`Generated a new week for ${money(result.total)} — ${money(result.budget-result.total)} under budget (${result.changed} meals changed). Open the Shopping list to see all items.`
      :`The lowest-cost varied option found was ${money(result.total)}, ${money(result.total-result.budget)} above your target. No within-budget combination was found with the current recipes, saved prices and pantry settings. Try increasing your budget or marking food you already have.`;
    updateAndRender(result.withinBudget?'New week generated within your budget.':'Plan generated, but the estimated cost exceeds your budget.');
    return;
  }
  if(action==='rotate'){rotate(idx,kind);return;}if(action==='swap'){showSwap(idx,kind);return;}
  if(action==='select-recipe'){if(modalContext){state.plan[modalContext.day][modalContext.kind]=id;closeModal();updateAndRender('Meal swapped. Shopping budget recalculated.');}return;}
  if(action==='close-modal'){closeModal();return;}if(action==='view'){viewRecipe(id);return;}
  if(action==='exclude'){excludeRecipe(id);return;}if(action==='filter'){filter=which;render();return;}
  if(action==='shuffle-dinners'){for(let i=0;i<7;i++)state.plan[i].dinner=pickNext('dinner',i);updateAndRender('Seven dinners rotated.');return;}
  if(action==='reset-plan'&&confirm('Reset the seven-day menu to the starter plan? Your price edits and exclusions will remain.')){state.plan=structuredClone(DEFAULT_PLAN);for(let i=0;i<7;i++)for(const part of ['breakfast','lunch','dinner'])if(state.excluded.includes(state.plan[i][part]))state.plan[i][part]=pickNext(part,i);updateAndRender('Original week restored.');return;}
  if(action==='copy-shop'){copyShop();return;}if(action==='clear-checked'){state.checked=[];updateAndRender('Shopping ticks cleared.');return;}
  if(action==='export'){exportData();showToast('Plan exported as JSON.');return;}if(action==='import'){document.getElementById('import-json').click();return;}
  if(action==='reset-all'&&confirm('Reset your entire plan, exclusions, pantry and price edits on this device?')){state=DEFAULT();filter='all';updateAndRender('All settings restored.');}
});
document.addEventListener('change',ev=>{
  const el=ev.target;
  if(el.matches('[data-generate-part]')){generatorParts[el.dataset.generatePart]=el.checked;return;}
  if(el.id==='generator-budget'){const v=Number(el.value);if(Number.isFinite(v)&&v>=20&&v<=3000){state.budget=v;updateAndRender('Budget updated. Generate a new menu when ready.');}return;}
  if(el.matches('[data-check]')){const id=el.dataset.check;state.checked=el.checked?[...new Set([...state.checked,id])]:state.checked.filter(x=>x!==id);updateAndRender();}
  if(el.matches('[data-pantry]')){const id=el.dataset.pantry;state.pantry=el.checked?[...new Set([...state.pantry,id])]:state.pantry.filter(x=>x!==id);updateAndRender();}
  if(el.matches('[data-price]')){const id=el.dataset.price,v=Number(el.value);if(Number.isFinite(v)&&v>=0&&v<=10000)state.prices[id]=v;updateAndRender();}
  if(el.matches('[data-setting]')){const k=el.dataset.setting,v=Number(el.value);const bounds={budget:[20,3000],people:[1,20],teens:[0,20],coffeeGrams:[0,500],coffeeMilk:[0,2000]};if(Number.isFinite(v)&&bounds[k])state[k]=Math.max(bounds[k][0],Math.min(bounds[k][1],v));updateAndRender('Settings saved.');}
});
document.addEventListener('input',ev=>{if(ev.target.id==='recipe-search'){search=ev.target.value.toLowerCase();const pos=ev.target.selectionStart;render();const input=document.getElementById('recipe-search');input.focus();input.setSelectionRange(pos,pos);}});
document.getElementById('import-json').addEventListener('change',async ev=>{const file=ev.target.files?.[0];if(!file)return;try{state=sanitize(JSON.parse(await file.text()));updateAndRender('Plan imported.');}catch{showToast('Unable to import that file.');}ev.target.value='';});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&modal.classList.contains('open'))closeModal();});
render();

if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
