import assert from "node:assert/strict";
import test from "node:test";
import {readAllRows} from "../db/read-all.ts";
test("complete reader accepts an empty counted dataset",async()=>{
  assert.deepEqual(await readAllRows(async()=>({data:[],count:0,error:null})),[]);
});
test("complete reader advances by received rows when service cap is smaller than page size",async()=>{
  const source=[{id:"a"},{id:"b"},{id:"c"}];
  assert.deepEqual(await readAllRows(async from=>({data:source.slice(from,from+1),count:3,error:null})),source);
});
test("complete reader rejects missing counts, duplicate rows, changed totals and incomplete empty pages",async()=>{
  for(const pages of [
    [{data:[],count:null,error:null}],
    [{data:[{id:"a"}],count:2,error:null},{data:[{id:"a"}],count:2,error:null}],
    [{data:[{id:"a"}],count:2,error:null},{data:[{id:"b"}],count:3,error:null}],
    [{data:[{id:"a"}],count:2,error:null},{data:[],count:2,error:null}],
  ]){
    let index=0;
    await assert.rejects(()=>readAllRows(async()=>pages[index++]),/history|History/);
  }
});
