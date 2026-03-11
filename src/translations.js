// --- CSV Parsing Logic ---
function parseCSVToLanguageMap(csvText) {
  const lines = csvText.split('\n');
  const map = { en: {}, ch: {}, jp: {} };
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current.trim());
    
    if (parts.length >= 6) {
      const page = parts[0];
      const section = parts[1];
      const key = parts[2];
      const fullKey = `${page}.${section}.${key}`;
      
      const clean = (str) => str.replace(/^"|"$/g, '').replace(/""/g, '"');
      map.en[fullKey] = clean(parts[3]);
      map.ch[fullKey] = clean(parts[4]);
      map.jp[fullKey] = clean(parts[5]);
    }
  }
  return map;
}

window.legalContent = {
  disclaimer: { title: '', content: '' },
  privacy: { title: '', content: '' },
  terms: { title: '', content: '' }
};

window.updateTranslations = async function() {
  const lang = localStorage.getItem('lang') || 'en';
  console.log('updateTranslations called. Current language:', lang);
  
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`/website_text_structure.csv?v=${timestamp}`);
    if (!response.ok) throw new Error('Failed to fetch CSV');
    const csvText = await response.text();
    const langMap = parseCSVToLanguageMap(csvText);
    
    // Update elements with data-key
    document.querySelectorAll('[data-key]').forEach(el => {
      const key = el.getAttribute('data-key');
      if (langMap[lang] && langMap[lang][key]) {
        const text = langMap[lang][key];
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = text;
        } else if (el.tagName === 'IMG') {
          el.alt = text;
        } else {
          el.innerHTML = text;
        }
      }
    });

    // Update legal content
    if (langMap[lang]) {
      window.legalContent.disclaimer.title = langMap[lang]['Legal.Disclaimer.Title'] || 'Disclaimer';
      window.legalContent.disclaimer.content = langMap[lang]['Legal.Disclaimer.Content'] || '';
      window.legalContent.privacy.title = langMap[lang]['Legal.Privacy.Title'] || 'Privacy Policy';
      window.legalContent.privacy.content = langMap[lang]['Legal.Privacy.Content'] || '';
      window.legalContent.terms.title = langMap[lang]['Legal.Terms.Title'] || 'Terms of Service';
      window.legalContent.terms.content = langMap[lang]['Legal.Terms.Content'] || '';
    }

    // Update active state of language switcher
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.getAttribute('data-lang') === lang) {
        btn.classList.remove('text-gray-500');
        btn.classList.add('text-brand-red', 'font-bold');
      } else {
        btn.classList.remove('text-brand-red', 'font-bold');
        btn.classList.add('text-gray-500');
      }
    });

    // Global body class for language
    document.body.classList.remove('lang-en', 'lang-ch', 'lang-jp');
    document.body.classList.add(`lang-${lang}`);

    // Dispatch event for page-specific logic
    window.dispatchEvent(new Event('languageChange'));

  } catch (error) {
    console.error('Error updating translations from CSV:', error);
  }
};

window.switchLanguage = function(lang) {
  console.log('Switching language to:', lang);
  localStorage.setItem('lang', lang);
  window.updateTranslations();
};

document.addEventListener('DOMContentLoaded', () => {
  window.updateTranslations();

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      if (lang) {
        window.switchLanguage(lang);
      }
    });
  });
});
