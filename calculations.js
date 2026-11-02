import {PRODUCTS, RECIPES} from './data.js';
export const lookup = Object.fromEntries(RECIPES.map(r=>[r.id,r]));
const round = n=>Math.round((n+Number.EPSILON)*100)/100;
export function makeShopping(state){
  const used={};
  for (const day of state.plan){
    for (const id of Object.values(day)) {
      const recipe=lookup[id]; if(!recipe) continue;
      const scale=recipe.kind==='school' ? state.teens/recipe.servings : state.people/recipe.servings;
      for (const [product,amount] of Object.entries(recipe.ingredients)) used[product]=(used[product]||0)+amount*scale;
    }
  }
  // Seven days of beans for adults' coffee, plus milk for real coffee.
  used.coffee=(used.coffee||0)+7*state.coffeeGrams;
  used.milk=(used.milk||0)+7*state.coffeeMilk/1000;
  return Object.entries(used).map(([id,amount])=>{
    const p=PRODUCTS[id];if(!p)return null;
    const packCount=Math.ceil(Math.max(0,amount-1e-8)/p.step);
    const buy=round(packCount*p.step);
    const packPrice=Math.max(0,Number(state.prices?.[id]??p.price)||0);
    const cost=round(packPrice*packCount);
    const pantry=Boolean(state.pantry?.includes(id));
    return {id, ...p, required:round(amount), buy, packCount, packPrice, cost, checkout:pantry?0:cost, pantry};
  }).filter(Boolean).sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
}
export function getTotals(state){const rows=makeShopping(state);return {rows,total:round(rows.reduce((s,r)=>s+r.checkout,0)),beforePantry:round(rows.reduce((s,r)=>s+r.cost,0))};}
export function formatQuantity(amount,unit){
  let v=Number(amount);let text=(Number.isInteger(v)?String(v):String(round(v)));
  if(unit==='kg'&&v<1) return Math.round(v*1000)+' g';
  if(unit==='L'&&v<1)return Math.round(v*1000)+' mL';
  if(unit==='g'&&v>=1000)return round(v/1000)+' kg';
  if(unit==='half')return text+' half-head';
  if(unit==='slices')return text+' slices';
  return text+' '+unit;
}
export function money(n){return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n);}
