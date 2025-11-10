import { db } from '../_db';
export default async function h(_req:any,res:any){
  const n = await db().queryRun.updateMany({
    where:{ status:'running' },
    data:{ status:'error', note:'manual reset', finishedAt:new Date() }
  });
  res.json({ reset:n.count });
}
