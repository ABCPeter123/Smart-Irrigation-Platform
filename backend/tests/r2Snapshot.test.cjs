const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  parseR2Snapshot, makeR2Snapshot, isFreshSnapshot, comparePublicRecords,
} = require("../dist/services/r2Snapshot.service");

const record = {
  id:"demo-kitchener-tomatoes",name:"Kitchener Tomato Plot",
  latitude:43.4516,longitude:-80.4925,areaHa:1.2,cropType:"tomatoes",
  soilType:"loam",irrigationMethod:"drip",
  forecastDate:"2026-11-12",updatedAt:"2026-11-12T15:00:00.000Z",
  urgency:"Low",actionLabel:"No irrigation needed",
  recommendedMm:0,estimatedLitres:0,dataCompletenessPct:100,
  waterDeficitMm:0,modelVersion:"weather-balance-service-v1.0",
  reasons:["No short-term soil deficit"],
};

test("validated current index accepts existing export format and typed zeroes", () => {
  const snapshot = parseR2Snapshot({
    schemaVersion:1,status:"ready",source:"r2-weather-archive",
    exportId:"20261112T150000Z-a1b2c3d4",manifestKey:"irrigation/v1/exports/manifest.json",
    records:[record],
  });
  assert.equal(snapshot.records.length,1);
  assert.equal(snapshot.records[0].recommendedMm,0);
  assert.equal(snapshot.manifestKey,"irrigation/v1/exports/manifest.json");
});

test("malformed, duplicate and non-demo records fail closed", () => {
  const make = records => ({
    schemaVersion:1,status:"ready",source:"r2-weather-snapshot",
    records,
  });
  assert.throws(()=>parseR2Snapshot(make([{...record,latitude:999}])));
  assert.throws(()=>parseR2Snapshot(make([{...record,id:"private-farm"}])));
  assert.throws(()=>parseR2Snapshot(make([record,record])),/Duplicate/);
  assert.throws(()=>parseR2Snapshot({schemaVersion:2,status:"ready",source:"r2",records:[record]}));
});

test("freshness protects against stalled R2 cron writes", () => {
  const now=Date.parse("2026-11-12T16:00:00.000Z");
  const fresh=makeR2Snapshot([record],"2026-11-12T15:00:00.000Z","irrigation/v1/live/2026-11-12/snapshot.json.gz");
  assert.equal(isFreshSnapshot(fresh,now),true);
  assert.equal(isFreshSnapshot(fresh,now+40*60*60*1000),false);
});

test("record parity ignores generated timestamps but rejects changed estimates", () => {
  const changedTime = {...record,updatedAt:"2026-11-12T15:12:00.000Z"};
  assert.deepEqual(comparePublicRecords([record],[changedTime]),{
    matched:true,neonCount:1,r2Count:1,mismatchedSites:[],
  });
  const wrong = {...record,recommendedMm:9};
  const diff=comparePublicRecords([record],[wrong]);
  assert.equal(diff.matched,false);
  assert.deepEqual(diff.mismatchedSites,["demo-kitchener-tomatoes"]);
});

test("S3 writer puts and verifies only bounded daily + current snapshots", async () => {
  const original = {};
  for(const key of ["R2_ACCOUNT_ID","R2_BUCKET","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_SYNC_ENABLED"]) {
    original[key] = process.env[key];
  }
  process.env.R2_ACCOUNT_ID="a".repeat(32);
  process.env.R2_BUCKET="smart-irrigation-data";
  process.env.R2_ACCESS_KEY_ID="testing-key";
  process.env.R2_SECRET_ACCESS_KEY="testing-secret";
  process.env.R2_SYNC_ENABLED="true";

  const aws=require("@aws-sdk/client-s3");
  const oldSend=aws.S3Client.prototype.send;
  const objects = new Map();
  const calls = [];
  aws.S3Client.prototype.send=async function(command){
    if(command instanceof aws.PutObjectCommand) {
      const {Key,Body,Metadata}=command.input;
      const data=Buffer.from(Body);
      objects.set(Key,{data,metadata:Metadata});
      calls.push(["put",Key]);
      return {};
    }
    if(command instanceof aws.GetObjectCommand) {
      const key=command.input.Key;
      const stored=objects.get(key);
      if(!stored)throw Error("NoSuchKey");
      calls.push(["get",key]);
      return {
        Body:{transformToByteArray:async()=>Uint8Array.from(stored.data)},
        ContentLength:stored.data.length,Metadata:stored.metadata,
      };
    }
    throw Error("Unexpected S3 action");
  };
  try {
    const r2=require("../dist/services/r2Storage.service");
    const output=await r2.writeDailyR2Snapshot([record]);
    assert.equal(calls.length,4);
    assert.deepEqual(calls.map(x=>x[0]),["put","get","put","get"]);
    assert.ok(output.archiveBytes<64*1024);
    assert.ok(output.indexBytes<64*1024);
    assert.equal(objects.size,2);
    const latest=JSON.parse(objects.get("irrigation/v1/current.json").data.toString());
    assert.equal(latest.records[0].id,record.id);
    assert.equal(latest.source,"r2-weather-snapshot");
    assert.equal(latest.archiveKey,output.archiveKey);
    for(const {data,metadata} of objects.values()){
      assert.equal(createHash("sha256").update(data).digest("hex"),metadata.sha256);
    }
  } finally {
    aws.S3Client.prototype.send=oldSend;
    for (const [key,value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key]=value;
    }
  }
});

test("R2 writes are disabled by default", async ()=>{
  const previous=process.env.R2_SYNC_ENABLED;
  delete process.env.R2_SYNC_ENABLED;
  try {
    const r2=require("../dist/services/r2Storage.service");
    assert.equal(r2.r2WriteEnabled(),false);
    await assert.rejects(r2.writeDailyR2Snapshot([record]),/disabled/);
  } finally {
    if(previous === undefined)delete process.env.R2_SYNC_ENABLED;
    else process.env.R2_SYNC_ENABLED=previous;
  }
});
