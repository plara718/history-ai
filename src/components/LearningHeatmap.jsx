import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { getTodayString } from '../lib/utils';

const LearningHeatmap = ({ stats }) => {
  const days = useMemo(() => { const l=[]; for(let i=27; i>=0; i--){ const d=new Date(); d.setDate(d.getDate()-i); l.push(`${d.getFullYear()}-${('0'+(d.getMonth()+1)).slice(-2)}-${('0'+d.getDate()).slice(-2)}`); } return l; }, []);
  const today = getTodayString();
  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm mb-6">
      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Calendar className="w-4 h-4" /> Learning Streak</h4>
      <div className="grid grid-cols-7 gap-1.5">{days.map(d => { const c=stats[d]||0; let col="bg-slate-100"; if(c===1)col="bg-indigo-200"; if(c===2)col="bg-indigo-400"; if(c>=3)col="bg-indigo-600"; return (<div key={d} className="flex flex-col items-center gap-1"><div className={`w-full aspect-square rounded-lg ${col} transition-all duration-500 ${d===today?'ring-2 ring-offset-2 ring-indigo-500':''}`} /></div>); })}</div>
    </div>
  );
};


export default LearningHeatmap;