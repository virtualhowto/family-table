import test from 'node:test';
import assert from 'node:assert/strict';
test('browser app produces the complete default planner without a framework',async()=>{
  const nodes=new Map();
  globalThis.document={
    getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',classList:{add(){},remove(){},contains(){return false;}},addEventListener(){},style:{}});return nodes.get(id);},
    addEventListener(){},body:{style:{}}
  };
  globalThis.window={addEventListener(){}};
  globalThis.localStorage={getItem(){return null;},setItem(){}};
  globalThis.location={hash:''};
  await import('../app.js');
  const html=nodes.get('app').innerHTML;
  assert.ok(html.includes('Your week, sorted.'));
  assert.ok(html.includes('$198.10'));
  assert.ok(html.includes('Roast chicken &amp; vegetable rice'));
  assert.equal((html.match(/class="day-card"/g)||[]).length,7);
});
