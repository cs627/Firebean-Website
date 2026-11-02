
# -*- coding: utf-8 -*-
"""題庫判別力基準：模擬真實作答者（非純型人），量度 top-1 準確率。
用法：python3 BENCH.py [patch.json]    patch 格式 {"qid": {"opt_k": {"t": delta_or_value, "^": true}}}
"""
import sys, json, random, importlib.util, copy
SPEC=importlib.util.spec_from_file_location("m","/opt/data/github/Firebean-Website/scripts/enneagram/model.py")
M=importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(M)

def apply(patch):
    Q=copy.deepcopy(M.Q)
    for q in Q:
        pd=patch.get(q["id"])
        if not pd: continue
        for o in q["options"]:
            od=pd.get(o["k"])
            if not od: continue
            for t,v in od.items():
                if t=="^": continue
                if od.get("^"): o["w"][t]=v
                else: o["w"][t]=max(0,(o["w"].get(t,0))+v)
    return Q

def ideal(Q,t):
    out={}
    for q in Q:
        ranked=sorted(q["options"], key=lambda o:-(o["w"].get(str(t),0)))
        n=1 if q["kind"]=="single" else min(q.get("max") or 2, len(ranked))
        out[q["id"]]=[o["k"] for o in ranked[:n]]
    return out

def classify(Q,ans):
    s={str(i):0 for i in range(1,10)}
    for q in Q:
        for k in ans.get(q["id"],[]):
            o=[x for x in q["options"] if x["k"]==k]
            if not o: continue
            for t,v in o[0]["w"].items(): s[t]=s.get(t,0)+v
    win=max(s,key=lambda k:(s[k],-int(k)))
    return win,s

def simulate(Q):
    res={}
    for t in range(1,10):
        w,s=classify(Q,ideal(Q,t))
        others=sorted((v for k,v in s.items() if k!=str(t)),reverse=True)
        res[t]=(w, s[str(t)]-others[0])
    return res

def bench(Q,cons,seed=7,N=400):
    rnd=random.Random(seed); acc={}; conf={}
    for t in range(1,10):
        idl=ideal(Q,t); hit=0; mis={}
        for _ in range(N):
            ans={}
            for q in Q:
                if rnd.random()<cons: ans[q["id"]]=idl[q["id"]]
                else:
                    pool=[o["k"] for o in q["options"]]
                    n=1 if q["kind"]=="single" else min(q.get("max") or 2,len(pool))
                    ans[q["id"]]=rnd.sample(pool,n)
            w,s=classify(Q,ans)
            if w==str(t): hit+=1
            else: mis[w]=mis.get(w,0)+1
        acc[t]=round(hit/N*100)
        conf[t]=sorted(mis.items(),key=lambda x:-x[1])[:2]
    return acc,conf

def effq(Q):
    out={}
    for t in range(1,10):
        n=0
        for q in Q:
            wmax=max((o["w"].get(str(t),0)) for o in q["options"])
            sp=max(max(o["w"].values()) for o in q["options"])-min(min(o["w"].values()) for o in q["options"])
            if wmax>=2 and sp>=3: n+=1
        out[t]=n
    return out

patch={}
if len(sys.argv)>1:
    patch=json.load(open(sys.argv[1],encoding="utf-8"))
    print("已套用 patch:",sys.argv[1])
Q=apply(patch)
sim=simulate(Q)
print("\n[simulate] 理想答題者（每型自認最似自己）:")
mm=min(v[1] for v in sim.values())
print("  ", " ".join("T%d→%s(%+d)"%(t,v[0][0],v[1]) for t,v in sim.items()))
print("   最細邊際 = %d %s"%(mm, "⚠️ 有風險" if mm<8 else "OK"))
print("\n[有效題數] 每型 weight>=2 且題目鑑別力>=3 的題數:", effq(Q))
for c in (0.6,0.75,0.9):
    acc,conf=bench(Q,c)
    print("\n[準確率] 一致度 %.2f（真實人唔會純型）: 平均 %d%%"%(c,sum(acc.values())/9))
    print("  ", " ".join("T%d:%d%%"%(t,acc[t]) for t in sorted(acc)))
    weak=sorted(acc.items(),key=lambda x:x[1])[:3]
    for t,a in weak: print("   最弱 T%d %d%% → 最常誤判為 %s"%(t,a,["T%s(%d次)"%(k,v) for k,v in conf[t]]))
