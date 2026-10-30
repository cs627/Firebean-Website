#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the 都會生活鏡像測驗 single-file page.

Source of truth (never hand-edit the generated HTML):
  scripts/enneagram/model.py      -> the 20 original survey questions + 9-type weights
  scripts/enneagram/types_data.py -> the 9 result cards + center labels
  scripts/enneagram/template.html -> layout / CSS / interaction (marker: /*__DATA__*/)

Output:
  enneagram/index.html            -> deployed to https://firebean.net/enneagram/

Anonymous data endpoint (optional) is read from, in order:
  $ENNEA_ENDPOINT  ->  data/enneagram_endpoint.json  ->  "" (demo mode, local only)
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

import model as M
from types_data import TYPES, CENTER_LABEL

PARTS = [
    ("第一部分", "受訪者背景與核心持份者甄別",
     "鎖定核心專業持份者與各階層市民，以便後續進行交叉比對分析。",
     ["age", "occ", "holding", "handling"]),
    ("第二部分", "政策認知現狀與過往宣傳渠道審計",
     "證明公眾對條例認知有限，並透過對比證實傳統紙本小冊子成效低迷，為資源轉型提供數據。",
     ["aware", "channel", "booklet_habit", "limitation"]),
    ("第三部分", "市民真實心態、深層疑慮與知識盲點",
     "揭示業主擔憂及公眾冷感，證實必須打出「現有權益絲毫不變」的定心丸，並以生活化故事化解冷感。",
     ["concern", "risk"]),
    ("第四部分", "數碼碎片化習慣與微短劇推廣策略",
     "獲取具體觀看時長數據，證明短影音是市民主要娛樂習慣，證實引入微短劇是必做核心策略。",
     ["shortform", "duration", "dramareact", "accept", "style"]),
    ("第五部分", "公共交通廣告與出行接觸渠道",
     "證明巴士、小巴及港鐵等車廂場景遠勝傳統紙媒，為戶外交通媒體投放提供預算依據。",
     ["transit"]),
    ("第六部分", "實體活動痛點診斷與商業化生動革新",
     "量化傳統講座的沉悶痛點，全面論證「微短劇欣賞＋活力主持＋手機即時互動」模式的必要性。",
     ["seminar", "element"]),
    ("第七部分", "吉祥物立體化與活動紀念品質素取向",
     "支持吉祥物「田兔兔」升級 3D 立體動畫，並量化公眾對廉價贈品的反感，支持採購高質實用精品。",
     ["souvenir_effect", "souvenir_type"]),
]

MATCH = [
    ["第 1 型", "巡迴展覽主打「定心丸」與「法規零瑕疵」：新舊雙軌並行、業權不可推翻，現有業主零手續。"],
    ["第 6 型", "以官方權威背書化解疑慮：防偽業權證明書、「物業把關易」電郵警示，正面回應防騙關切。"],
    ["第 4 型", "用「3D 田兔兔」精緻文創與高張力生活微短劇，以視覺與劇情反轉引發共鳴。"],
    ["第 7 型", "車廂屏幕「高戲劇反轉微短劇」＋沉浸式巡迴展覽、快問快答互動，將條文變成可玩的內容。"],
    ["第 3 型", "主打效率：一站式微網站（掃 QR Code）、即時電子查冊、重點鮮明的短影音。"],
    ["第 5 型", "提供高透明度資訊與實證：條文機制、法定彌償基金，配合設即時現場投票問答的專業講座。"],
    ["第 2 型", "製作可轉發的家族群組圖文與防騙短片，配合社區巡迴展覽，讓長輩一起領取實用紀念品。"],
    ["第 8 型", "以高質實用精品（金屬筆、皮質證件套）配合敢於正面回應核心問題的公開場合。"],
    ["第 9 型", "在社區中心與車廂等舒適場景，用親民溫和語言傳遞「零手續、零變動、零收費」定心丸。"],
]


def endpoint():
    env = os.environ.get("ENNEA_ENDPOINT", "").strip()
    if env:
        return env
    p = os.path.join(REPO, "data", "enneagram_endpoint.json")
    if os.path.exists(p):
        try:
            d = json.load(open(p, encoding="utf-8"))
            return (d.get("exec_url") or "").strip()
        except Exception:
            pass
    return ""


CENTER_MEMBERS = {"gut": [8, 9, 1], "heart": [2, 3, 4], "head": [5, 6, 7]}


def centers_payload():
    out = {}
    for k, v in CENTER_LABEL.items():
        d = dict(v)
        d["list"] = " · ".join(str(t) for t in CENTER_MEMBERS[k])
        d["types"] = CENTER_MEMBERS[k]
        out[k] = d
    return out


def payload():
    questions = []
    for q in M.Q:
        questions.append(dict(
            id=q["id"], orig=q["orig"], text=q["text"], kind=q["kind"],
            short=q.get("short", ""), max=None, note=q["note"],
            options=[dict(k=o["k"], label=o["label"], w=o["w"]) for o in q["options"]],
        ))
    assert len(questions) == 20, len(questions)
    ids = [q["id"] for q in questions]
    for _, _, _, qids in PARTS:
        for q in qids:
            assert q in ids, "part references unknown question: " + q
    parts = [dict(name=n, sub=s, goal=g, qids=q) for n, s, g, q in PARTS]
    return dict(
        meta=dict(endpoint=endpoint(), stats=endpoint().replace("/submit", "/stats"), source_doc="11yp4XWLDAN4VruqseCECnzkhunfdSM51KP8cEVLiw7U",
                  built=__import__("datetime").datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %Z")),
        parts=parts, questions=questions,
        types={str(k): v for k, v in TYPES.items()},
        centers=centers_payload(), match=MATCH,
    )


def main():
    tpl = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
    data = json.dumps(payload(), ensure_ascii=False, separators=(",", ":"))
    data = data.replace("</", "<\\/")            # never let a string close the <script>
    assert "/*__DATA__*/" in tpl, "template marker missing"
    html = tpl.replace("/*__DATA__*/", data)
    out_dir = os.path.join(REPO, "enneagram")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "index.html")
    open(out, "w", encoding="utf-8").write(html)
    print("wrote %s (%d bytes)  endpoint=%s" % (out, len(html.encode()), endpoint() or "(demo/local only)"))


if __name__ == "__main__":
    main()
