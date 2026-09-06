import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {createCityLayout} from '../src/city-layout.js';
import {CIVILIAN_COUNT,CIVILIAN_SEED,CIVILIAN_SOURCE_VERSION,createCityPopulation,createPedestrianTemplate} from '../src/civilian-source.js';
import {createLegacyPopulation} from './fixtures/legacy-civilian-source-b5707d3.js';

const results=[],hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function test(name,run){try{results.push({name,passed:true,...run()});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name,error.message);}}
const districts=createCityLayout().districts;

test('All authored citizens and continuing aircraft match the frozen pre-extraction data',()=>{
  const legacy=createLegacyPopulation(districts),current=createCityPopulation({districts});
  assert.deepEqual(current.people,legacy.people);assert.deepEqual(current.airTraffic,legacy.airTraffic);
  assert.equal(hash(current.people),'4f52a788f418be78eeb6580990a5acde38aaa1a05b76f15c394c733440c826f3');
  assert.equal(hash(current.airTraffic),'51d1a7454635d9df5a8c7c4848a287fb1437fedb10d7122a016e1552a8c40f46');
  assert.equal(current.version,CIVILIAN_SOURCE_VERSION);assert.equal(CIVILIAN_COUNT,284);assert.equal(CIVILIAN_SEED,29715);
  assert.deepEqual(current.rng,{seed:29715,stateAfterPeople:474785530,stateAfterAirTraffic:1410189882,drawsAfterPeople:6485,drawsTotal:6549});
  assert.equal(current.people.length,284);assert.equal(current.airTraffic.length,16);
  assert.equal(current.people.filter(p=>p.pieces.length===86).length,95);
  assert.equal(current.people.filter(p=>p.pieces.length===35).length,189);
  assert.equal(current.people.reduce((count,p)=>count+p.pieces.length,0),14785);
  return{people:284,umbrellaPeople:95,voxelPieces:14785,aircraft:16,peopleSHA256:hash(current.people),airTrafficSHA256:hash(current.airTraffic),rng:current.rng};
});

test('District order, equal-distance ties and fallback coats retain the old selection rules',()=>{
  const variants=[[],districts.slice().reverse(),[{name:'Iron Docks',x:0,z:0},{name:'Lantern Market',x:0,z:0}],[{name:'Lantern Market',x:0,z:0},{name:'Iron Docks',x:0,z:0}]];
  for(const variant of variants){const actual=createCityPopulation({districts:variant}),expected=createLegacyPopulation(variant);assert.deepEqual(actual.people,expected.people);assert.deepEqual(actual.airTraffic,expected.airTraffic);}
  const first=createCityPopulation({districts:variants[2]}).people[0].pieces[5].c,second=createCityPopulation({districts:variants[3]}).people[0].pieces[5].c;
  assert.notEqual(first,second);return{districtVariants:variants.length,tieUsesFirstDistrict:true};
});

test('Callers own independent records and templates retain ordered motion bindings and swatch draws',()=>{
  const first=createCityPopulation({districts}),second=createCityPopulation({districts});
  first.people[0].x=999;first.people[0].pieces[0].c='#ffffff';first.airTraffic[0].speed=999;first.rng.stateAfterPeople=0;
  assert.equal(hash(second.people),'4f52a788f418be78eeb6580990a5acde38aaa1a05b76f15c394c733440c826f3');
  assert.equal(hash(second.airTraffic),'51d1a7454635d9df5a8c7c4848a287fb1437fedb10d7122a016e1552a8c40f46');
  assert.equal(second.rng.stateAfterPeople,474785530);
  let draws=0;const ordinary=createPedestrianTemplate('#334455',false),umbrella=createPedestrianTemplate('#334455',true,palette=>{draws++;return palette[0];});
  assert.equal(draws,37);assert.equal(ordinary.length,35);assert.equal(umbrella.length,86);
  assert.deepEqual(umbrella.slice(0,35),ordinary);assert(umbrella.slice(35).every(p=>p.umbrella));
  assert.deepEqual(createPedestrianTemplate('#334455',true),umbrella);
  assert.deepEqual(Object.keys(ordinary[0]),['x','y','z','sx','sy','sz','c','motion','umbrella']);
  const a=createCityPopulation({districts,seed:12}),b=createCityPopulation({districts,seed:12});assert.deepEqual(a,b);assert.notEqual(hash(a.people),hash(second.people));
  return{freshPopulationObjects:true,bodyPieces:35,umbrellaPieces:51,umbrellaSwatchDraws:draws,alternateSeedDeterministic:true};
});

const report={checkedAtUTC:new Date().toISOString(),passed:results.every(result=>result.passed),results};
if(process.env.CIVILIAN_SOURCE_REPORT)fs.writeFileSync(process.env.CIVILIAN_SOURCE_REPORT,JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
