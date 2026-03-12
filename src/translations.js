// translations.js — Tri-language switching (EN/TC/JP) with embedded fallback data
// Parses UI_Text from Google Sheets CSV, updates data-key elements, manages language state

(function () {
  'use strict';

  // --- Embedded CSV fallback (from website_text_structure.csv) ---
  const FALLBACK_DATA = [
    ["Global","Navigation","Home","Home","首頁","ホーム"],
    ["Global","Navigation","About","About","關於我們","について"],
    ["Global","Navigation","WhatWeDo","What We Do","我們的服務","私たちのサービス"],
    ["Global","Navigation","WhoWeHelp","WHO WE HELP","服務對象","業種別クライアント"],
    ["Global","Navigation","GovPublic","Government & Public Sector","政府及公共機構","政府・公共機関"],
    ["Global","Navigation","LifestyleConsumer","Lifestyle & Consumer","生活時尚及消費品","ライフスタイル・消費財"],
    ["Global","Navigation","FBHospitality","F&B & Hospitality","餐飲及款待","F&B・ホスピタリティ"],
    ["Global","Navigation","MallsVenues","Malls & Venues","商場及場地","モール・会場"],
    ["Global","Navigation","RovingExhibitions","Roving Exhibitions","巡迴展覽","巡回展示"],
    ["Global","Navigation","SocialContent","Social & Content","社交媒體及內容","ソーシャル・コンテンツ"],
    ["Global","Navigation","InteractiveTech","Interactive & Tech","互動科技","インタラクティブ・テクノロジー"],
    ["Global","Navigation","PRMedia","PR & Media","公關及媒體","PR・メディア"],
    ["Global","Navigation","EventsCeremonies","Events & Ceremonies","活動及典禮","イベント・式典"],
    ["Global","Navigation","ViewAllWork","VIEW ALL WORK","瀏覽所有作品","全ての作品を見る"],
    ["Index","Hero","Line1","A","重","戦略を"],
    ["Index","Hero","Line2","STRATEGY","策略主導","主導する"],
    ["Index","Hero","Line3","DRIVEN","為先的","PRの"],
    ["Index","Hero","Line4","PR Agency","PR公關","プロフェッショナル"],
    ["Index","Hero","Subtitle","Create to Engage: We don't just stage events; we architect public engagement.","創意，為互動而生。 我們不流於一般活動執行，而是致力構築具影響力的公共互動體驗。","繋がりを創るクリエイティビティ。 ただのイベントではなく、人々の心を動かすパブリック体験を構築する。"],
    ["Index","Hero","CTA","Explore What We Do","探索我們的作品","私たちの作品を見る"],
    ["Index","About","Title","LIFESTYLE RESONANCE. INSTITUTIONAL RIGOR.","兼具生活品味的感染力，與大型機構的嚴謹度。","日常に響く共感力。確かな実行を担保する厳格さ。"],
    ["Index","About","Subtitle","Shaping Hong Kong's PR scene since 2007, we specialize in the art of the engagement. From the buzz of the city's biggest lifestyle launches to our role as PR consultants for the Buildings Department since 2023, we create the strategies that make institutions feel human and brands feel essential.","自 2007 年深耕香港公關界以來，我們專注於將「大眾參與」昇華為一門藝術。從城中最熱議的生活風格品牌發佈，以至自 2023 年起擔任屋宇署的官方公關顧問，我們致力制定具影響力的策略——讓公共機構變得平易近人，並彰顯品牌不可替代的核心價值。","2007年より香港PR界を牽引。「エンゲージメント」を芸術へと昇華させる専門家集団です。話題沸騰のブランドローンチから、香港政府・屋宇署の公式顧問（2023年〜）まで。公的機関には「親しみやすさ」を、ブランドには「不可欠な価値」をもたらす戦略を構築します。"],
    ["Index","About","Stats1","Years Experience","年經驗","年以上の経験"],
    ["Index","About","Stats2","Projects Delivered","個已完成項目","件以上のプロジェクト完了"],
    ["Index","About","Stats3Num","1.5M+","150+","150+"],
    ["Index","About","Stats3","People Engaged","萬參與人數","万人以上の参加者を動員"],
    ["Index","Work","Subtitle","Create to engage, policy into Play.","以創意連繫大眾，有規則，亦有趣。","クリエイティビティで人々をつなぐ。ルールの中に、遊び心を。"],
    ["Index","Work","Title","We Turn Mandates Into Memories","我們致力打破刻板，令活動變成專屬回憶。","常識を打ち破り、イベントを特別な「思い出」へ。"],
    ["Index","Newsletter","Title","THE DISPATCH.<br><span class=\"text-3xl md:text-4xl block mt-2\">Big Ideas, Better Engagement.</span>","《公關市場解碼》<br><span class=\"text-3xl md:text-4xl block mt-2\">大膽創想，深度連結。</span>","THE DISPATCH<br><span class=\"text-3xl md:text-4xl block mt-2\">ビッグアイデアで、より深い繋がりを。</span>"],
    ["Index","Newsletter","Subtitle","Behind the scenes of the projects shaping the lifestyle market. We share the data, the creativity, and the \\why\\\" behind today's most successful PR activations.\"","窺探顛覆生活風格市場的幕後故事。為您全面解析熱門公關企劃背後的數據、創意與核心動機。","ライフスタイル市場を覆す話題のプロジェクト、その裏側を大公開。ヒットを生み出すPR施策を支える「データ」「クリエイティブ」、そして「なぜやるのか」という核心的な動機を紐解きます。"],
    ["Index","Newsletter","EmailPlaceholder","YOUR EMAIL ADDRESS","請輸入電郵地址","メールアドレス"],
    ["Index","Newsletter","CTA","SIGN ME UP ↳","立即訂閱","登録する"],
    ["Index","Narrative","Line1","WE MOVE","我們引領","弊社は、"],
    ["Index","Narrative","Line2","BEYOND THE SCROLL","打破螢幕框架","をデジタル"],
    ["Index","Narrative","Line3","SPARK CURIOSITY FOR","，為","空間から現実の体験"],
    ["Index","Narrative","Line4","& ARCHITECT","激發大眾好奇，","へと導き、"],
    ["Index","Narrative","Line5","PUBLIC MOMENTS","並為","好奇心"],
    ["Index","Narrative","Line6","FOR","精心構築難忘的公共時刻。","を刺激し、日常を忘れら"],
    ["Index","Narrative","Line7","","",""],
    ["Index","Narrative","Subtitle","And we're clued up on public engagement...","對於策動公眾參與，我們瞭如指掌。","大衆の心を動かす仕掛けこそ、私たちの真骨頂です。"],
    ["Index","Hero","PolaroidAlt","Event","活動","イベント"],
    ["Index","Newsletter","Card1.Title","FROM POLICY TO PLAY: THE 2026 ROVING EXHIBITION REPORT","從政策到實踐：2026 巡迴展覽報告","政策から遊びへ：2026年巡回展示レポート"],
    ["Index","Newsletter","Card1.Desc","We analyze how institutional rigor meets family-first engagement. Discover why 78% of HK families now prioritize interactive digital games over static displays in public exhibitions.","我們分析了機構的嚴謹性如何與家庭優先的參與相結合。了解為什麼 78% 的香港家庭現在在公共展覽中優先考慮互動數位遊戲，而非靜態展示。","公的機関の厳格さとファミリー層向けのエンゲージメントの融合を分析。香港の家族の78%が、公共展示において静止画よりもインタラクティブなデジタルゲームを優先する理由を探ります。"],
    ["Index","Newsletter","Card1.Alt","Report","報告","レポート"],
    ["Index","Newsletter","Card2.Title","LUXURY RESILIENCE: WHY F&B BRANDS CRAVE IMMERSION","奢侈品的韌性：為什麼餐飲品牌渴望沉浸感","ラグジュアリーの回復力：なぜ飲食ブランドは没入感を求めるのか"],
    ["Index","Newsletter","Card2.Desc","High-energy activations are the new currency for Hong Kong's retail core. We explore the \"Tactile Maximalism\" trend in Causeway Bay pop-ups and how F&B leaders like Ogawa and MaskOn are leveraging immersive storytelling.","高能量的活動是香港零售核心的新貨幣。我們探討了銅鑼灣快閃店中的「觸感極大主義」趨勢，以及 Ogawa 和 MaskOn 等餐飲領導者如何利用沉浸式故事講述。","高エネルギーなアクティベーションは、香港のリテールにおける新たな通貨です。銅鑼湾のポップアップにおける「タクタイル・マキシマリズム」のトレンドと、OgawaやMaskOnなどの飲食リーダーが没入型ストーリーテリングをどのように活用しているかを探ります。"],
    ["Index","Newsletter","Card2.Alt","Luxury","奢侈品","ラグジュアリー"],
    ["Index","Newsletter","Card3.Title","THE AI EDGE: NAVIGATING THE NEW ERA OF PUBLIC PR","AI 優勢：導航公共公關的新時代","AIの優位性：パブリックPRの新時代をナビゲートする"],
    ["Index","Newsletter","Card3.Desc","Generative Search is changing how government tenders and lifestyle brands find partners. We break down the technical requirements for GEO (Generative Engine Optimization).","生成式搜索正在改變政府招標和生活方式品牌尋找合作夥伴的方式。我們分解了 GEO（生成引擎優化）的技術要求。","生成AI検索は、政府の入札やライフスタイルブランドがパートナーを見つける方法を変えています。GEO（生成エンジン最適化）の技術的要件を解説します。"],
    ["Index","Newsletter","Card3.Alt","AI","人工智能","AI"],
    ["Index","Newsletter","ReadMore","READ →","閱讀更多 →","続きを読む →"],
    ["Global","WorkHeader","Title","Profiles","我們做到了","プロフィール"],
    ["Global","WorkFilters","All","All","全部","すべて"],
    ["Global","WorkResults","Found","results found","個結果","件の結果"],
    ["Global","Contact","Title1","Ready To Talk?","準備好了？","準備はいいですか？"],
    ["Global","Contact","Title2","Get In Touch.","請聯絡我們。","お気軽にご相談ください。"],
    ["Global","Contact","NewBusiness","New Business","業務查詢","新規ビジネス"],
    ["Global","Contact","Address","Unit A, 23/F Morrison Plaza, 5-9 Morrison Hill Rd. Wan Chai, Hong Kong","香港 灣仔摩理臣山道 5-9A號 天樂廣場 23樓A室","香港湾仔 摩理臣山道5-9A号 天楽広場 23階A室"],
    ["Global","Contact","Careers","Careers","職位招聘","求人"],
    ["Global","Footer","Copyright","©2026 Firebean Limited All Rights Reserved.","©2026 Firebean Limited 版權所有。","©2026 Firebean Limited All Rights Reserved。"],
    ["Global","Footer","Disclaimer","Disclaimer","免責聲明","免責事項"],
    ["Global","Footer","Privacy","Privacy Policy","隱私政策","プライバシーポリシー"],
    ["Global","Footer","Terms","Terms of Service","服務條款","利用規約"],
    ["Legal","Disclaimer","Title","Disclaimer","免責聲明","免責事項"],
    ["Legal","Disclaimer","Content","<p>The information provided by Firebean Limited (\"we,\" \"us,\" or \"our\") on this website is for general informational purposes only. All information on the site is provided in good faith, however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p><p>Under no circumstance shall we have any liability to you for any loss or damage of any kind incurred as a result of the use of the site or reliance on any information provided on the site. Your use of the site and your reliance on any information on the site is solely at your own risk.</p><p>The site may contain (or you may be sent through the site) links to other websites or content belonging to or originating from third parties or links to websites and features. Such external links are not investigated, monitored, or checked for accuracy, adequacy, validity, reliability, availability, or completeness by us.</p>","<p>本網站由Firebean Limited（以下簡稱「我們」）提供的資訊僅供一般資訊參考用途。本網站上的所有資訊均出於誠信提供，但我們不對網站上任何資訊的準確性、充分性、有效性、可靠性、可用性或完整性做出任何形式（無論是明示還是暗示）的陳述或保證。</p><p>在任何情況下，對於因使用本網站或依賴本網站提供的任何資訊而導致的任何形式的損失或損害，我們均不承擔任何責任。您對本網站的使用以及對本網站任何資訊的依賴完全由您自行承擔風險。</p><p>本網站可能包含（或您可能透過本網站被引導至）指向屬於第三方或源自第三方的其他網站或內容的連結，或指向網站和功能的連結。此類外部連結未經我們調查、監控或檢查其準確性、充分性、有效性、可靠性、可用性或完整性。</p>","<p>本ウェブサイトにFirebean Limited（以下「当社」）が提供する情報は、一般的な情報提供を目的としています。サイト上のすべての情報は誠実に提供されていますが、サイト上の情報の正確性、妥当性、有効性、信頼性、可用性、または完全性に関して、明示的か黙示的かを問わず、いかなる種類の表明または保証も行いません。</p><p>いかなる場合においても、サイトの使用またはサイトで提供される情報への依存の結果として生じたいかなる種類の損失または損害についても、当社は一切の責任を負いません。サイトの使用およびサイト上の情報への依存は、完全にお客様自身の責任において行われるものとします。</p><p>本サイトには、第三者に属する、または第三者から発信された他のウェブサイトやコンテンツへのリンク、あるいはウェブサイトや機能へのリンクが含まれている（または本サイトを通じて送信される）場合があります。このような外部リンクは、当社によって正確性、妥当性、有効性、信頼性、可用性、または完全性が調査、監視、またはチェックされることはありません。</p>"],
    ["Legal","Privacy","Title","Privacy Policy","隱私政策","プライバシーポリシー"],
    ["Legal","Privacy","Content","<p>Your privacy is important to us. It is Firebean Limited's policy to respect your privacy regarding any information we may collect from you across our website.</p><p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we're collecting it and how it will be used.</p><p>We only retain collected information for as long as necessary to provide you with your requested service. What data we store, we'll protect within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.</p><p>We don't share any personally identifying information publicly or with third-parties, except when required to by law.</p><p>Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites, and cannot accept responsibility or liability for their respective privacy policies.</p>","<p>您的隱私對我們至關重要。Firebean Limited尊重您的隱私，及對於我們在本網站可能收集的任何資料準守相關政策。</p><p>我們僅在真正需要為您提供服務時才要求提供個人資訊。我們透過公正且合法的方式，在您知情並同意的情況下收集資訊。我們也會讓您知道收集資訊的原因以及將如何使用這些資訊。</p><p>我們僅在為您提供所要求的服務所需的期間內保留收集的資訊。對於我們儲存的數據，我們將以商業上可接受的方式進行保護，以防止遺失和盜竊，以及未經授權的存取、披露、複製、使用或修改。</p><p>除非法律要求，否則我們不會公開分享任何個人識別資訊或與第三方分享。</p><p>我們的網站可能會連結到非由我們營運的外部網站。請注意，我們無法控制這些網站的內容和做法，且不對其各自的隱私政策承擔責任或義務。</p>","<p>お客様のプライバシーは当社にとって重要です。Firebean Limitedは、当ウェブサイトを通じて収集する情報に関してお客様のプライバシーを尊重します。</p><p>サービスを提供するために真に必要な場合にのみ、個人情報を求めます。情報は、お客様の知識と同意を得て、公正かつ合法的な手段で収集されます。また、収集する理由とその使用方法についてもお知らせします。</p><p>収集した情報は、要求されたサービスを提供するために必要な期間のみ保持します。保存するデータは、紛失や盗難、不正アクセス、開示、コピー、使用、修正を防ぐために、商業的に許容される手段で保護します。</p><p>法律で義務付けられている場合を除き、個人を特定できる情報を公に、または第三者と共有することはありません。</p><p>当ウェブサイトは、当社が運営していない外部サイトにリンクしている場合があります。当社はこれらのサイトのコンテンツや慣行を管理しておらず、それぞれのプライバシーポリシーに対する責任や義務を負いかねますのでご了承ください。</p>"],
    ["Legal","Terms","Title","Terms of Service","服務條款","利用規約"],
    ["Legal","Terms","Content","<p>By accessing this website, you are agreeing to be bound by these terms of service, all applicable laws and regulations, and agree that you are responsible for compliance with any applicable local laws. If you do not agree with any of these terms, you are prohibited from using or accessing this site.</p><p>Permission is granted to temporarily download one copy of the materials (information or software) on Firebean Limited's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose, or for any public display (commercial or non-commercial); attempt to decompile or reverse engineer any software contained on this website; remove any copyright or other proprietary notations from the materials; or transfer the materials to another person or \"mirror\" the materials on any other server.</p><p>This license shall automatically terminate if you violate any of these restrictions and may be terminated by Firebean Limited at any time.</p><p>The materials on Firebean Limited's website are provided on an 'as is' basis. Firebean Limited makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>","<p>在您登入本網站時，即表示同意遵守本服務條款與相關法律法規，並同意您有責任遵守任何適用的當地法律。如果您不同意這些條款中的任何一項，您將被禁止使用或訪問本網站。</p><p>我們准許您臨時下載 Firebean Limited 網站上的一份材料（資訊或軟體）副本，僅供個人、非商業性的臨時查看。這僅是許可的授予，而非所有權的轉讓，在此許可下，您不得：修改或複製材料；將材料用於任何商業目的，或用於任何公開展示（商業或非商業）；嘗試對本網站包含的任何軟體進行反編譯或逆向工程；刪除材料中的任何版權或其他專有標註；或將材料轉移給他人或在任何其他伺服器上「鏡像」材料。</p><p>如果您違反任何這些限制，本許可將自動終止，Firebean Limited 也可以隨時終止本許可。</p><p>Firebean Limited 網站上的材料按「原樣」提供。Firebean Limited 不做任何明示或暗示的保證，並特此聲明並否認所有其他保證，包括但不限於對適銷性、特定用途的適用性或不侵犯知識產權或其他權利侵犯的暗示保證或條件。</p>","<p>本ウェブサイトにアクセスすることで、お客様は本利用規約、すべての適用法令に拘束されることに同意し、適用される地域法令の遵守について責任を負うことに同意したものとみなされます。本規約のいずれかに同意しない場合、本サイトの使用またはアクセスは禁止されます。</p><p>Firebean Limitedのウェブサイト上の資料（情報またはソフトウェア）の1つのコピーを、個人的かつ非商業的な一時的な閲覧のみを目的として一時的にダウンロードすることが許可されます。これはライセンスの付与であり、所有権の譲渡ではありません。このライセンスの下では、次のことを行うことはできません：資料を修正またはコピーすること、資料を商業目的または公開表示（商業的または非商業的）のために使用すること、本ウェブサイトに含まれるソフトウェアを逆コンパイルまたはリバースエンジニアリングしようとすること、資料から著作権またはその他の所有権表示を削除すること、資料を他の人に譲渡すること、または資料を他のサーバーに「ミラーリング」すること。</p><p>本ライセンスは、これらの制限のいずれかに違反した場合に自動的に終了し、Firebean Limitedによっていつでも終了される場合があります。</p><p>Firebean Limitedのウェブサイト上の資料は「現状のまま」で提供されます。Firebean Limitedは、明示的か黙示的かを問わず、いかなる保証も行わず、商品性、特定目的への適合性、または知的財産の非侵害またはその他の権利侵害に関する黙示の保証または条件を含むがこれに限定されない、他のすべての保証を明示的に否認し、否定します。</p>"]
  ];

  // Language column index mapping: en=3(idx 3), ch=4(idx 4), jp=5(idx 5)
  // But in our arrays: en=idx3, ch=idx4, jp=idx5
  const LANG_COL = { en: 3, ch: 4, jp: 5 };

  // Build translations map from array data: { "Page.Section.Key": { en, ch, jp } }
  function buildTranslationsMap(rows) {
    var map = {};
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
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

  // Initialize with fallback data
  var translations = buildTranslationsMap(FALLBACK_DATA);

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
    var lines = text.split('
');
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
    var url = 'https://docs.google.com/spreadsheets/d/1aTuqgmmSKMWgNCl2KR0QhK4Cj8G7W5yPsr4t39pi-yc/export?format=csv&gid=799431517';
    fetch(url)
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
