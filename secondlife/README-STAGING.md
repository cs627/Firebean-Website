# 「灣區第二人生」— STAGING DUMMY（未對外、未經法律審閱）

**狀態：STAGING / DUMMY。此目錄唔係正式上線版本，唔可以當作對外宣傳材料使用。**

| 項 | 內容 |
|---|---|
| 客戶 | 宜居樂（珠海）企業服務有限公司 · 創辦人 Causson 朱嘉信 |
| 性質 | 內部驗證用之 staging dummy（供審稿／試版） |
| 對外 | **未對外發布**。全站 `noindex, nofollow`，未有 sitemap，未加入任何導覽入口 |
| 法律審閱 | **未做**。所有免責及風險披露字句未經律師審閱 |
| 客戶簽核 | **未做** |
| 相片 | 未有真實相片，全部以「實景相待客戶提供」佔位 |
| WhatsApp 號碼 | `+852 9622 9372` —— 未經實測確認，回覆方式（AI／人手）標示為「待客戶確認」 |

## 檔案

| 檔案 | 用途 |
|---|---|
| `build_site.py` | 一次性產生器（**來源**）。11 頁 HTML 由其生成 |
| `test_site.py` | 測試腳本（16 項確定性檢查）。`python3 test_site.py` 跑全部；`python3 test_site.py T1 T3 T5` 跑子集 |
| `_data/facts.md` | 數字台帳（每個數字附來源 URL 及截止日期） |
| `BUILD-LOG.md` | 每次建置及測試之實測輸出紀錄 |
| `*.html` | **生成產物**（11 頁），已寫入 repo 工作樹，由 GitHub Pages 直接 serve |

## 重建方式

```bash
cd /opt/data/github/Firebean-Website/secondlife
python3 build_site.py            # 重新生成 11 頁
python3 test_site.py            # 驗收（16 項）
```

## 部署方式

`build_site.py` **唔會**自動部署。頁面係靜態檔，寫入 repo 工作樹後即由現行 serving 機制提供。
**未經批准唔可以 commit、唔可以 push。**

## 上線前必須完成（見 `review-v3-ready.md` §6）

1. 客戶提供真實相片（Causson、院舍、考察團）
2. 免責聲明交律師審閱
3. 實測 WhatsApp 號碼及回覆流程
4. 確認轉介佣金披露字句
5. 客戶書面簽核

## 回滾

```bash
rm -rf /opt/data/github/Firebean-Website/secondlife/
```
