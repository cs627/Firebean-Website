// translations.js — Tri-language switching (EN/TC/JP) with embedded fallback data
// Parses UI_Text from Google Sheets CSV, updates data-key elements, manages language state
// FALLBACK_DATA synced to live UI_Text sheet 2026-06-19; live fetch is cache-busted (no-store)

(function () {
  'use strict';

  // --- Embedded CSV fallback (from website_text_structure.csv) ---
  const FALLBACK_DATA = [
    ["Global", "Navigation", "Home", "Home", "首頁", "ホーム"],
    ["Global", "Navigation", "About", "About", "關於我們", "について"],
    ["Global", "Navigation", "WhatWeDo", "What We Do", "我們的服務", "私たちのサービス"],
    ["Global", "Navigation", "WhoWeHelp", "WHO WE HELP", "服務對象", "業種別クライアント"],
    ["Global", "Navigation", "GovPublic", "Government & Public Sector", "政府及公共機構", "政府・公共機関"],
    ["Global", "Navigation", "LifestyleConsumer", "Lifestyle & Consumer", "生活時尚及消費品", "ライフスタイル・消費財"],
    ["Global", "Navigation", "FBHospitality", "F&B & Hospitality", "餐飲及款待", "F&B・ホスピタリティ"],
    ["Global", "Navigation", "MallsVenues", "Malls & Venues", "商場及場地", "モール・会場"],
    ["Global", "Navigation", "RovingExhibitions", "Roving Exhibitions", "巡迴展覽", "巡回展示"],
    ["Global", "Navigation", "SocialContent", "Social & Content", "社交媒體及內容", "ソーシャル・コンテンツ"],
    ["Global", "Navigation", "InteractiveTech", "Interactive & Tech", "互動科技", "インタラクティブ・テクノロジー"],
    ["Global", "Navigation", "PRMedia", "PR & Media", "公關及媒體", "PR・メディア"],
    ["Global", "Navigation", "EventsCeremonies", "Events & Ceremonies", "活動及典禮", "イベント・式典"],
    ["Global", "Navigation", "ViewAllWork", "VIEW ALL WORK", "瀏覽所有作品", "全ての作品を見る"],
    ["Index", "Hero", "Line1", "A", "重", "戦略を"],
    ["Index", "Hero", "Line2", "STRATEGY", "策略主導", "主導する"],
    ["Index", "Hero", "Line3", "DRIVEN", "為先的", "PRの"],
    ["Index", "Hero", "Line4", "PR Agency", "PR公關", "プロフェッショナル"],
    ["Index", "Hero", "Subtitle", "Create to Engage: We don't just stage events; we architect public engagement.", "創意，為互動而生。 我們不流於一般活動執行，而是致力構築具影響力的公共互動體驗。", "繋がりを創るクリエイティビティ。 ただのイベントではなく、人々の心を動かすパブリック体験を構築する。"],
    ["Index", "Hero", "CTA", "Explore What We Do", "探索我們的作品", "私たちの作品を見る"],
    ["Index", "About", "Title", "\"All-In\" on Creativity: Earning the Highest Trust Through Lifestyle Appeal", "將創意「All-In」：以生活品味，贏得政府最高信任。", "クリエイティビティを「All-In」：ライフスタイルの魅力で政府からの信頼を獲得。"],
    ["Index", "About", "Subtitle", "Since 2007, Firebean has created buzzworthy lifestyle experiences. Today, we take those creative chips and go \"All-In\" on government projects. By \"Turning Policy into Play,\" we transform serious public affairs into engaging, \"chill\" campaigns. This bold strategy brought lifestyle vibrancy to the public sector, leading to our appointment as the Official PR Consultant for the Buildings Department in 2023, successfully making government outreach vibrant and approachable.", "自 2007 年起，Firebean 專注為各大生活品牌打造話題體驗。面對嚴肅的公共機構，我們決定將累積的創意籌碼，毫無保留地「All-In」注入政府項目。我們堅信「化政策為遊戲 (Turn Policy into Play)」，以最 Chill 的體驗包裝公共事務。這份破格策略成功將 Lifestyle 感染力帶入體制，令我們接連贏得大案，更自 2023 年起成為屋宇署官方公關顧問，成功讓政府走入群眾、充滿活力！", "2007年からライフスタイル領域で培ったクリエイティブのすべてを、政府プロジェクトに「All-In」。私たちは「政策を遊びに (Turn Policy into Play)」を掲げ、お堅い公共事務をChillな体験へと変圧します。 この戦略により、行政に新しい活気をもたらし、2023年からは屋宇署の公式PR顧問に就任。政府と市民の距離を楽しく縮めています。"],
    ["Index", "About", "Stats1", "Years Experience", "年經驗", "年以上の経験"],
    ["Index", "About", "Stats2", "Projects Delivered", "個已完成項目", "件以上のプロジェクト完了"],
    ["Index", "About", "Stats3Num", "1.5M+", "150+", "150+"],
    ["Index", "About", "Stats3", "People Engaged", "萬參與人數", "万人以上の参加者を動員"],
    ["Index", "Work", "Subtitle", "Create to engage, policy into Play.", "以創意連繫大眾，有規則，亦有趣。", "クリエイティビティで人々をつなぐ。ルールの中に、遊び心を。"],
    ["Index", "Work", "Title", "We Turn Mandates Into Memories", "我們致力打破刻板，令活動變成專屬回憶。", "常識を打ち破り、イベントを特別な「思い出」へ。"],
    ["Index", "Newsletter", "Title", "THE DISPATCH.<br><span class=\"text-3xl md:text-4xl block mt-2\">Big Ideas, Better Engagement.</span>", "公關市場解碼<br><span class=\"text-3xl md:text-4xl block mt-2\">大膽創想，深度連結。</span>", "THE DISPATCH<br><span class=\"text-3xl md:text-4xl block mt-2\">ビッグアイデアで、より深い繋がりを。</span>"],
    ["Index", "Newsletter", "Subtitle", "Behind the scenes of the projects shaping the lifestyle market. We share the data, the creativity, and the why behind today's most successful PR activations.", "窺探顫覆生活風格市場的幕後故事。為您全面解析熱門公關企劃背後的數據、創意與核心動機。", "ライフスタイル市場を覆す話題のプロジェクト、その裏側を大公開。ヒットを生み出すPR施策を支える「データ」「クリエイティブ」、そして「なぜやるのか」という核心的な動機を紐解きます。"],
    ["Index", "Newsletter", "EmailPlaceholder", "YOUR EMAIL ADDRESS", "請輸入電郵地址", "メールアドレス"],
    ["Index", "Newsletter", "CTA", "SIGN ME UP ↳", "立即訂閱", "登録する"],
    ["Index", "Narrative", "Line1", "WE PUSH", "我們引領", "弊社は、"],
    ["Index", "Narrative", "Line2", "BEYOND THE SCREEN, ", "打破螢幕框架", "をデジタル"],
    ["Index", "Narrative", "Line3", "IGNITE CURIOSITY FOR", "，為", "空間から現実の体験"],
    ["Index", "Narrative", "Line4", "& CRAFT UNFORGETTABLE ", "激發大眾好奇，", "へと導き、"],
    ["Index", "Narrative", "Line5", "PUBLIC  MOMENTS", "並為", "の好奇心"],
    ["Index", "Narrative", "Line6", "FOR", "精心構築難忘的公共時刻。", "を刺激し、日常を忘れら"],
    ["Index", "Narrative", "Line7", "", "", "れない空間へ。"],
    ["Index", "Narrative", "Subtitle", "And we're clued up on public engagement...", "對於策動公眾參與，我們瞭如指掌。", "大衆の心を動かす仕掛けこそ、私たちの真骨頂です。"],
    ["Index", "Hero", "PolaroidAlt", "Event", "活動", "イベント"],
    ["Index", "Newsletter", "ReadMore", "READ →", "閱讀更多 →", "続きを読む →"],
    ["Global", "WorkHeader", "Title", "Profiles", "看得見觸得到", "プロフィール"],
    ["Global", "WorkFilters", "All", "All", "全部", "すべて"],
    ["Global", "WorkResults", "Found", "results found", "個結果", "件の結果"],
    ["Global", "Contact", "Title1", "Ready To Talk?", "進一步了解？", "準備はいいですか？"],
    ["Global", "Contact", "Title2", "Get In Touch.", "請聯絡我們。", "お気軽にご相談ください。"],
    ["Global", "Contact", "NewBusiness", "New Business", "業務查詢", "新規ビジネス"],
    ["Global", "Contact", "Address", "Unit A, 23/F Morrison Plaza, 5-9 Morrison Hill Rd. Wan Chai, Hong Kong", "香港 灣仔摩理臣山道 5-9A號 天樂廣場 23樓A室", "香港湾仔 摩理臣山道5-9A号 天楽広場 23階A室"],
    ["Global", "Contact", "Careers", "Careers", "職位招聘", "求人"],
    ["Global", "Footer", "Copyright", "©2026 Firebean Limited All Rights Reserved.", "©2026 Firebean Limited 版權所有。", "©2026 Firebean Limited All Rights Reserved。"],
    ["Global", "Footer", "Disclaimer", "Disclaimer", "免責聲明", "免責事項"],
    ["Global", "Footer", "Privacy", "Privacy Policy", "隱私政策", "プライバシーポリシー"],
    ["Global", "Footer", "Terms", "Terms of Service", "服務條款", "利用規約"],
    ["Legal", "Disclaimer", "Title", "Disclaimer", "免責聲明", "免責事項"],
    ["Legal", "Disclaimer", "Content", "<p>The information provided by Firebean Limited (\"we,\" \"us,\" or \"our\") on this website is for general informational purposes only. All information on the site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p><p>Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site. Your use of the site and your reliance on any information on the site is solely at your own risk.</p><p>The site may contain (or you may be sent through the site) links to other websites or content belonging to or originating from third parties or links to websites and features. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.</p>", "<p>本網站由Firebean Limited（以下簡稱「我們」）提供的資訊僅供一般資訊參考用途。本網站上的所有資訊均出於誠信提供，但我們不對網站上任何資訊的準確性、充分性、有效性、可靠性、可用性或完整性做出任何形式（無論是明示還是暗示）的陳述或保證。</p><p>在任何情況下，對於因使用本網站或依賴本網站提供的任何資訊而導致的任何形式的損失或損害，我們均不承擔任何責任。您對本網站的使用以及對本網站任何資訊的依賴完全由您自行承擔風險。</p><p>本網站可能包含（或您可能透過本網站被引導至）指向屬於第三方或源自第三方的其他網站或內容的連結，或指向網站和功能的連結。此類外部連結未經我們調查、監控或檢查其準確性、充分性、有效性、可靠性、可用性或完整性。</p>", "<p>本ウェブサイトにFirebean Limited（以下「当社」）が提供する情報は、一般的な情報提供を目的としています。サイト上のすべての情報は誠実に提供されていますが、サイト上の情報の正確性、妥当性、有効性、信頼性、可用性、または完全性に関して、明示的か黙示的かを問わず、いかなる種類の表明または保証も行いません。</p><p>いかなる場合においても、サイトの使用またはサイトで提供される情報への依存の結果として生じたいかなる種類の損失または損害についても、当社は一切の責任を負いません。サイトの使用およびサイト上の情報への依存は、完全にお客様自身の責任において行われるものとします。</p><p>本サイトには、第三者に属する、または第三者から発信された他のウェブサイトやコンテンツへのリンク、またはウェブサイトや機能へのリンクが含まれている場合があります（または本サイトを通じて誘導される場合があります）。このような外部リンクは、当社によってその正確性、充分性、有効性、信頼性、可用性、または完全性が調査、監視、または確認されているわけではありません。</p>"],
    ["Legal", "Privacy", "Title", "Privacy Policy", "隱私政策", "プライバシーポリシー"],
    ["Legal", "Privacy", "Content", "<p>Your privacy is important to us. It is Firebean Limited's policy to respect your privacy regarding any information we may collect from you across our website.</p><p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we're collecting it and how it will be used.</p><p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we'll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p><p>We don't share any personally identifying information publicly or with third-parties, except when required to by law.</p><p>Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies.</p>", "<p>您的隱私對我們至關重要。Firebean Limited尊重您的隱私，及對於我們在本網站可能收集的任何資料準守相關政策。</p><p>我們僅在真正需要為您提供服務時才要求提供個人資訊。我們透過公正且合法的方式，在您知情並同意的情況下收集資訊。我們也會讓您知道收集資訊的原因以及將如何使用這些資訊。</p><p>我們僅在為您提供所要求的服務所需的期間內保留收集的資訊。對於我們儲存的數據，我們將以商業上可接受的方式進行保護，以防止遺失和盜竊，以及未經授權的存取、披露、複製、使用或修改。</p><p>除非法律要求，否則我們不會公開分享任何個人識別資訊或與第三方分享。</p><p>我們的網站可能會連結到非由我們營運的外部網站。請注意，我們無法控制這些網站的內容和做法，且不對其各自的隱私政策承擔責任或義務。</p>", "<p>お客様のプライバシーは当社にとって重要です。Firebean Limitedは、当ウェブサイトを通じて収集する情報に関してお客様のプライバシーを尊重します。</p><p>サービスを提供するために真に必要な場合にのみ、個人情報を求めます。情報は、お客様の知識と同意を得て、公正かつ合法的な手段で収集されます。また、収集する理由とその使用方法についてもお知らせします。</p><p>収集した情報は、要求されたサービスを提供するために必要な期間のみ保持します。保存するデータは、紛失や盗難、不正アクセス、開示、コピー、使用、修正を防ぐために、商業的に許容される手段で保護します。</p><p>法律で義務付けられている場合を除き、個人を特定できる情報を公に、または第三者と共有することはありません。</p><p>当ウェブサイトは、当社が運営していない外部サイトにリンクしている場合があります。当社はこれらのサイトのコンテンツや慣行を管理しておらず、それぞれのプライバシーポリシーに対する責任や義務を負いかねますのでご了承ください。</p>"],
    ["Legal", "Terms", "Title", "Terms of Service", "服務條款", "利用規約"],
    ["Legal", "Terms", "Content", "<p>By accessing this website, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p><p>Permission is granted to temporarily download one copy of the materials (information or software) on Firebean Limited's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose, or for any public display (commercial or non-commercial); attempt to decompile or reverse engineer any software contained on this website; remove any copyright or other proprietary notations from the materials; or transfer the materials to another person or \"mirror\" the materials on any other server.</p><p>This license shall automatically terminate if you violate any of these restrictions and may be terminated by Firebean Limited at any time.</p><p>The materials on Firebean Limited's website are provided on an 'as is' basis. Firebean Limited makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>", "<p>在您登入本網站時，即表示同意遵守本服務條款與相關法律法規，並同意您有責任遵守任何適用的當地法律。如果您不同意這些條款中的任何一項，您將被禁止使用或訪問本網站。</p><p>我們准許您臨時下載 Firebean Limited 網站上的一份材料（資訊或軟體）副本，僅供個人、非商業性的臨時查看。這僅是許可的授予，而非所有權的轉讓，在此許可下，您不得：修改或複製材料；將材料用於任何商業目的，或用於任何公開展示（商業或非商業）；嘗試對本網站包含的任何軟體進行反編譯或逆向工程；刪除材料中的任何版權或其他專有標註；或將材料轉移給他人或在任何其他伺服器上「鏡像」材料。</p><p>如果您違反任何這些限制，本許可將自動終止，Firebean Limited 也可以隨時終止本許可。</p><p>Firebean Limited 網站上的材料按「原樣」提供。Firebean Limited 不做任何明示或暗示的保證，並特此聲明並否認所有其他保證，包括但不限於對適銷性、特定用途的適用性或不侵犯知識產權或其他權利侵犯的暗示保證或條件。</p>", "<p>本ウェブサイトにアクセスすることにより、お客様はこれらの利用規約、すべての適用法令に拘束されることに同意し、適用される現地法の遵守に責任を負うことに同意したものとみなされます。これらの規約のいずれかに同意しない場合は、本サイトの使用またはアクセスを禁止します。</p><p>Firebean Limitedのウェブサイト上の資料（情報またはソフトウェア）の1コピーを、個人的、非営利的な一時的な閲覧のためにのみ一時的にダウンロードすることが許可されます。これはライセンスの付与であり、所有権の譲渡ではありません。このライセンスに基づき、お客様は以下のことを行うことはできません：資料を改変またはコピーすること。商業目的、または公の展示（商業的か非営利かに関わらず）のために資料を使用すること。本ウェブサイトに含まれるソフトウェアをデコンパイルまたはリバースエンジニアリングしようとすること。資料から著作権またはその他の所有権の表記を削除すること。または資料を別の人に転送したり、他のサーバーに資料を「ミラーリング」したりすること。</p><p>これらの制限のいずれかに違反した場合、このライセンスは自動的に終了し、Firebean Limitedはいつでも終了させることができます。</p><p>Firebean Limitedのウェブサイト上の資料は「現状有姿」で提供されます。Firebean Limitedは、明示的か黙示的かを問わず、いかなる保証も行わず、商品性、特定目的への適合性、または知的財産権の非侵害やその他の権利の侵害がないことの黙示的な保証または条件を含むがこれらに限定されない、他のすべての保証を否認および否定します。</p>"]
    ["Roving","Hero","Title","Hong Kong's Roving Exhibition Agency","香港巡迴展覽專家","香港の巡回展示エージェンシー"],
    ["Roving","Hero","Subtitle","30 projects. 9 years. Trusted by Hong Kong's government bureaus.","30個項目。9年經驗。獲香港政府部門信賴。","30プロジェクト。9年の実績。香港政府機関から信頼される。"],
    ["Roving","Hero","Tagline","Roving Exhibitions","巡迴展覽","巡回展示"],
    ["Roving","Hero","Subtitle2","Hong Kong's Most Experienced Roving Exhibition Agency","香港最具經驗的巡迴展覽公司","香港で最も経験豊富な巡回展示エージェンシー"],
    ["Roving","Methodology","Subtitle","From policy to public — four steps to a memorable roving exhibition.","從政策到公眾 — 成就難忘巡迴展覽的四個步驟。","政策から公共へ — 記憶に残る巡回展示を実現する4つのステップ。"],
    ["Roving","Methodology","Step1Title","Design","設計","設計"],
    ["Roving","Methodology","Step1Body","Policy meets lifestyle creative. We translate government briefs into exhibition concepts the public actually wants to engage with \u2014 blending strategic messaging with the visual language of Hong Kong\u2019s best consumer brands. Every design decision is backed by audience insight, not guesswork.","\u653f\u7b56\u9047\u4e0a\u751f\u6d3b\u54c1\u5473\u5275\u610f\u3002\u6211\u5011\u5c07\u653f\u5e9c\u7c21\u5831\u8f49\u5316\u70ba\u516c\u773e\u771f\u6b63\u60f3\u53c3\u8207\u7684\u5c55\u89bd\u6982\u5ff5 \u2014 \u5c07\u7b56\u7565\u6027\u8a0a\u606f\u8207\u9999\u6e2f\u9802\u7d1a\u6d88\u8cbb\u54c1\u724c\u7684\u8996\u89ba\u8a9e\u8a00\u878d\u70ba\u4e00\u9ad4\u3002\u6bcf\u500b\u8a2d\u8a08\u6c7a\u7b56\u90fd\u4ee5\u53d7\u773e\u6d1e\u5bdf\u70ba\u57fa\u790e\uff0c\u800c\u975e\u6191\u7a7a\u731c\u6e2c\u3002","\u653f\u7b56\u3068\u30e9\u30a4\u30d5\u30b9\u30bf\u30a4\u30eb\u30af\u30ea\u30a8\u30a4\u30c6\u30a3\u30d6\u306e\u878d\u5408\u3002\u653f\u5e9c\u306e\u30d6\u30ea\u30fc\u30d5\u3092\u3001\u4eba\u3005\u304c\u5b9f\u969b\u306b\u95a2\u308f\u308a\u305f\u304f\u306a\u308b\u5c55\u793a\u30b3\u30f3\u30bb\u30d7\u30c8\u306b\u5909\u63db \u2014 \u6226\u7565\u7684\u30e1\u30c3\u30bb\u30fc\u30b8\u30f3\u30b0\u3068\u9999\u6e2f\u306e\u30c8\u30c3\u30d7\u30b3\u30f3\u30b7\u30e5\u30fc\u30de\u30fc\u30d6\u30e9\u30f3\u30c9\u306e\u30d3\u30b8\u30e5\u30a2\u30eb\u8a00\u8a9e\u3092\u878d\u5408\u3002\u3059\u3079\u3066\u306e\u30c7\u30b6\u30a4\u30f3\u6c7a\u5b9a\u306f\u3001\u63a8\u6e2c\u3067\u306f\u306a\u304f\u30aa\u30fc\u30c7\u30a3\u30a8\u30f3\u30b9\u30a4\u30f3\u30b5\u30a4\u30c8\u306b\u57fa\u3065\u3044\u3066\u3044\u307e\u3059\u3002"],
    ["Roving","Methodology","Step2Title","Build & Brand","搭建與品牌","構築とブランディング"],
    ["Roving","Methodology","Step2Body","Modular doesn\u2019t mean mediocre. Our exhibition builds combine transport-ready engineering with premium lifestyle aesthetics \u2014 designed to survive 20+ venue rotations without losing visual impact. From custom interactive tech to durable branded environments, every element is built for the road.","\u6a21\u7d44\u5316\u4e0d\u7b49\u65bc\u5e73\u5eb8\u3002\u6211\u5011\u7684\u5c55\u89bd\u642d\u5efa\u7d50\u5408\u4fbf\u65bc\u904b\u8f38\u7684\u5de5\u7a0b\u8a2d\u8a08\u8207\u9ad8\u7aef\u751f\u6d3b\u54c1\u5473\u7f8e\u5b78 \u2014 \u5c08\u70ba\u627f\u53d720+\u5834\u5730\u8f2a\u63db\u800c\u4e0d\u5931\u8996\u89ba\u885d\u64ca\u529b\u800c\u8a2d\u8a08\u3002\u5f9e\u5b9a\u5236\u4e92\u52d5\u79d1\u6280\u5230\u8010\u7528\u7684\u54c1\u724c\u5316\u74b0\u5883\uff0c\u6bcf\u500b\u5143\u7d20\u90fd\u70ba\u5de1\u8ff4\u800c\u751f\u3002","\u30e2\u30b8\u30e5\u30fc\u30eb\u5f0f\u306f\u51e1\u5eb8\u3092\u610f\u5473\u3057\u306a\u3044\u3002\u5f53\u793e\u306e\u5c55\u793a\u69cb\u7bc9\u306f\u3001\u8f38\u9001\u306b\u9069\u3057\u305f\u30a8\u30f3\u30b8\u30cb\u30a2\u30ea\u30f3\u30b0\u3068\u30d7\u30ec\u30df\u30a2\u30e0\u306a\u30e9\u30a4\u30d5\u30b9\u30bf\u30a4\u30eb\u7f8e\u5b66\u3092\u878d\u5408 \u2014 20\u4ee5\u4e0a\u306e\u4f1a\u5834\u30ed\u30fc\u30c6\u30fc\u30b7\u30e7\u30f3\u3067\u3082\u8996\u899a\u7684\u30a4\u30f3\u30d1\u30af\u30c8\u3092\u5931\u308f\u306a\u3044\u8a2d\u8a08\u3002\u30ab\u30b9\u30bf\u30e0\u30a4\u30f3\u30bf\u30e9\u30af\u30c6\u30a3\u30d6\u6280\u8853\u304b\u3089\u8010\u4e45\u6027\u306e\u3042\u308b\u30d6\u30e9\u30f3\u30c9\u74b0\u5883\u307e\u3067\u3001\u3059\u3079\u3066\u304c\u5de1\u56de\u306e\u305f\u3081\u306b\u69cb\u7bc9\u3055\u308c\u3066\u3044\u307e\u3059\u3002"],
    ["Roving","Methodology","Step3Title","Tour & Operate","巡迴與營運","巡回と運営"],
    ["Roving","Methodology","Step3Body","Hong Kong-wide coverage, zero excuses. From Cheung Chau to Tuen Mun, our logistics team handles transport, installation, staffing, and daily ops \u2014 so your team doesn\u2019t have to. We\u2019ve managed tours spanning 18+ venues in a single campaign, with 99.8% on-time setup. When a government bureau needs reliability, they call Firebean.","\u5168\u6e2f\u8986\u84cb\uff0c\u96f6\u85c9\u53e3\u3002\u5f9e\u9577\u6d32\u5230\u5c6f\u9580\uff0c\u6211\u5011\u7684\u7269\u6d41\u5718\u968a\u8655\u7406\u904b\u8f38\u3001\u5b89\u88dd\u3001\u4eba\u624b\u53ca\u65e5\u5e38\u71df\u904b \u2014 \u8b93\u4f60\u7684\u5718\u968a\u7121\u9700\u64cd\u5fc3\u3002\u6211\u5011\u66fe\u65bc\u55ae\u4e00\u6d3b\u52d5\u7ba1\u7406\u6a6b\u8e8f18+\u5834\u5730\u7684\u5de1\u8ff4\uff0c\u6e96\u6642\u642d\u5efa\u7387\u905499.8%\u3002\u7576\u653f\u5e9c\u90e8\u9580\u9700\u8981\u7a69\u59a5\u53ef\u9760\uff0c\u4ed6\u5011\u627eFirebean\u3002","\u9999\u6e2f\u5168\u57df\u30ab\u30d0\u30fc\u3001\u8a00\u3044\u8a33\u30bc\u30ed\u3002\u9577\u6d32\u304b\u3089\u5c6f\u9580\u307e\u3067\u3001\u7269\u6d41\u30c1\u30fc\u30e0\u304c\u8f38\u9001\u3001\u8a2d\u7f6e\u3001\u30b9\u30bf\u30c3\u30d5\u914d\u7f6e\u3001\u65e5\u5e38\u904b\u55b6\u3092\u51e6\u7406 \u2014 \u3042\u306a\u305f\u306e\u30c1\u30fc\u30e0\u306f\u4f55\u3082\u3059\u308b\u5fc5\u8981\u306a\u3057\u3002\u5358\u4e00\u30ad\u30e3\u30f3\u30da\u30fc\u30f3\u306718\u4ee5\u4e0a\u306e\u4f1a\u5834\u3092\u30ab\u30d0\u30fc\u3057\u305f\u5b9f\u7e3e\u304c\u3042\u308a\u3001\u30aa\u30f3\u30bf\u30a4\u30e0\u8a2d\u7f6e\u738799.8%\u3002\u653f\u5e9c\u6a5f\u95a2\u304c\u4fe1\u983c\u6027\u3092\u6c42\u3081\u308b\u6642\u3001Firebean\u3092\u547c\u3073\u307e\u3059\u3002"],
    ["Roving","Methodology","Step4Title","Engage & Measure","互動與量度","エンゲージメントと測定"],
    ["Roving","Methodology","Step4Body","Engagement isn\u2019t a buzzword \u2014 it\u2019s a deliverable. We design interactive experiences that generate real participation data, then report it in formats government stakeholders actually find useful. From real-time dashboards to post-tour analytics decks, we prove your exhibition worked \u2014 with numbers, not adjectives.","\u4e92\u52d5\u4e0d\u53ea\u662f\u6f6e\u6d41\u7528\u8a9e \u2014 \u5b83\u662f\u53ef\u4ea4\u4ed8\u7684\u6210\u679c\u3002\u6211\u5011\u8a2d\u8a08\u80fd\u7522\u751f\u771f\u5be6\u53c3\u8207\u6578\u64da\u7684\u4e92\u52d5\u9ad4\u9a57\uff0c\u7136\u5f8c\u4ee5\u653f\u5e9c\u6301\u4efd\u8005\u771f\u6b63\u89ba\u5f97\u6709\u7528\u7684\u683c\u5f0f\u532f\u5831\u3002\u5f9e\u5373\u6642\u6578\u64da\u5100\u8868\u677f\u5230\u5de1\u8ff4\u5f8c\u5206\u6790\u7c21\u5831\uff0c\u6211\u5011\u7528\u6578\u5b57\u800c\u975e\u5f62\u5bb9\u8a5e\u4f86\u8b49\u660e\u4f60\u7684\u5c55\u89bd\u6210\u6548\u3002","\u30a8\u30f3\u30b2\u30fc\u30b8\u30e1\u30f3\u30c8\u306f\u30d0\u30ba\u30ef\u30fc\u30c9\u3067\u306f\u306a\u304f\u3001\u6210\u679c\u7269\u3067\u3059\u3002\u5b9f\u969b\u306e\u53c2\u52a0\u30c7\u30fc\u30bf\u3092\u751f\u307f\u51fa\u3059\u30a4\u30f3\u30bf\u30e9\u30af\u30c6\u30a3\u30d6\u4f53\u9a13\u3092\u8a2d\u8a08\u3057\u3001\u653f\u5e9c\u30b9\u30c6\u30fc\u30af\u30db\u30eb\u30c0\u30fc\u304c\u672c\u5f53\u306b\u5f79\u7acb\u3064\u3068\u611f\u3058\u308b\u30d5\u30a9\u30fc\u30de\u30c3\u30c8\u3067\u5831\u544a\u3002\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u304b\u3089\u30c4\u30a2\u30fc\u5f8c\u5206\u6790\u30c7\u30c3\u30ad\u307e\u3067\u3001\u5f62\u5bb9\u8a5e\u3067\u306f\u306a\u304f\u6570\u5b57\u3067\u5c55\u793a\u306e\u52b9\u679c\u3092\u8a3c\u660e\u3057\u307e\u3059\u3002"],
    ["Roving","Projects","SectionTitle","Roving Exhibitions","巡迴展覽","巡回展示"],
    ["Roving","Projects","YearRange","2018—2026","2018—2026","2018—2026"],
    ["Roving","Stats","Projects","11","11","11"],
    ["Roving","Stats","Years","9","9","9"],
    ["Roving","Stats","Bureaus","6","6","6"],
    ["Roving","Stats","PeopleLabel","People Engaged","參與人次","参加者"],
    ["Roving","Hero","Slogan1","PROJECTS.","個項目。","プロジェクト。"],
    ["Roving","Hero","Slogan2","GOVERNMENT BUREAUS.","個政府部門。","つの政府機関。"],
    ["Roving","Hero","Slogan3","1.5M+","150萬+","150万人"],
    ["Roving","Hero","Slogan4","PEOPLE ENGAGED.","參與人次。","以上が参加。"],
    ["Roving","Stats","ProjectsLabel","Roving Projects","巡迴項目","巡回プロジェクト"],
];

  // Language column index mapping: en=3(idx 3), ch=4(idx 4), jp=5(idx 5)
  // But in our arrays: en=idx3, ch=idx4, jp=idx5
  const LANG_COL = { en: 3, ch: 4, jp: 5 };

  // Build translations map from array data: { "Page.Section.Key": { en, ch, jp } }
  function buildTranslationsMap(rows) {
    var map = {};
    if (!rows || !rows.length) return map;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!row || !row.length) continue;
      var page = (row[0] || '').trim();
      var section = (row[1] || '').trim();
      var key = (row[2] || '').trim();
      if (!page || !section || !key) continue;
      var dataKey = page + '.' + section + '.' + key;
      map[dataKey] = {
        en: row[3] || '',
        ch: row[4] || '',
        jp: row[5] || ''
      };
    }
    return map;
  }

  // Initialize with fallback data — wrapped for safety
  var translations = {};
  try {
    translations = buildTranslationsMap(FALLBACK_DATA);
  } catch(e) {
    console.error('[translations] buildTranslationsMap fallback failed:', e.message);
  }

  // Get current language
  function getLang() {
    return localStorage.getItem('lang') || 'en';
  }

  // Get translation value for a data-key
  function t(dataKey, lang) {
    lang = lang || getLang();
    var entry = translations[dataKey];
    if (!entry) return null;
    return entry[lang] || entry['en'] || '';
  }

  // Update all elements with data-key attributes
  function updateTranslations() {
    var lang = getLang();
    var elements = document.querySelectorAll('[data-key]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-key');
      var value = t(key, lang);
      if (value === null) continue;

      // Handle input placeholders
      if (el.tagName === 'INPUT' && el.hasAttribute('placeholder')) {
        el.setAttribute('placeholder', value);
      } else if (el.tagName === 'IMG') {
        el.setAttribute('alt', value);
      } else if (value.indexOf('<') !== -1 && value.indexOf('>') !== -1) {
        // Contains HTML tags - use innerHTML
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    }

    // Update language button styles
    var langBtns = document.querySelectorAll('.lang-btn');
    for (var j = 0; j < langBtns.length; j++) {
      var btn = langBtns[j];
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.remove('text-gray-500');
      } else {
        btn.classList.add('text-gray-500');
      }
    }

    // Update legal content
    updateLegalContent(lang);

    // Dispatch languageChange event
    window.dispatchEvent(new CustomEvent('languageChange', { detail: { lang: lang } }));
  }

  // Set up window.legalContent for legal modals
  function updateLegalContent(lang) {
    lang = lang || getLang();
    window.legalContent = {
      disclaimer: {
        title: t('Legal.Disclaimer.Title', lang) || 'Disclaimer',
        content: t('Legal.Disclaimer.Content', lang) || ''
      },
      privacy: {
        title: t('Legal.Privacy.Title', lang) || 'Privacy Policy',
        content: t('Legal.Privacy.Content', lang) || ''
      },
      terms: {
        title: t('Legal.Terms.Title', lang) || 'Terms of Service',
        content: t('Legal.Terms.Content', lang) || ''
      }
    };
  }

  // Set language and update
  function setLang(lang) {
    localStorage.setItem('lang', lang);
    updateTranslations();
  }

  // Language button click handlers
  function initLangButtons() {
    var langBtns = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < langBtns.length; i++) {
      langBtns[i].addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        setLang(lang);
      });
    }
  }

  // Parse CSV text into rows of arrays
  function parseCSV(text) {
    var rows = [];
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      // Simple CSV parse handling quoted fields
      var row = [];
      var inQuotes = false;
      var field = '';
      for (var j = 0; j < line.length; j++) {
        var ch = line[j];
        if (inQuotes) {
          if (ch === '"') {
            if (j + 1 < line.length && line[j + 1] === '"') {
              field += '"';
              j++;
            } else {
              inQuotes = false;
            }
          } else {
            field += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ',') {
            row.push(field);
            field = '';
          } else {
            field += ch;
          }
        }
      }
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  // Try fetching fresh UI_Text from Google Sheets
  function fetchRemoteTranslations() {
    var base = 'https://docs.google.com/spreadsheets/d/1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc/export?format=csv&gid=799431517';
    // Cache-buster so the browser/CDN always pulls the freshest UI_Text sheet
    var url = base + '&cb=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        // Skip header row (first row has column names)
        if (rows.length > 1) {
          var dataRows = rows.slice(1);
          // Remap columns: A=Page(0), B=Section(1), C=Key(2), D=EN(3), E=TC(4), F=JP(5)
          var mapped = [];
          for (var i = 0; i < dataRows.length; i++) {
            var r = dataRows[i];
            if (r.length >= 4) {
              mapped.push([r[0], r[1], r[2], r[3], r[4] || '', r[5] || '']);
            }
          }
          if (mapped.length > 0) {
            translations = buildTranslationsMap(mapped);
            updateTranslations();
          }
        }
      })
      .catch(function () {
        // Silently use fallback data
      });
  }

  // Expose globals
  window.updateTranslations = updateTranslations;
  window.t = t;
  window.setLang = setLang;
  window.getLang = getLang;

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initLangButtons();
      updateLegalContent();
      updateTranslations();
      fetchRemoteTranslations();
    });
  } else {
    initLangButtons();
    updateLegalContent();
    updateTranslations();
    fetchRemoteTranslations();
  }
})();
