// src/language.js

const translations = {};
let currentLanguage = 'English'; // Default language

// Function to parse CSV and populate translations object
async function loadTranslations() {
  const response = await fetch('/website_text_structure.csv');
  const csvText = await response.text();
  const lines = csvText.split('\n');

  // Assuming the first line is the header
  const headers = lines[0].split(',');
  const englishIndex = headers.indexOf('English');
  const chineseIndex = headers.indexOf('Chinese (Translate Here)');
  const japaneseIndex = headers.indexOf('Japanese (Translate Here)');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;

    const parts = line.split(',');
    const page = parts[0];
    const section = parts[1];
    const key = parts[2];

    if (!translations[page]) translations[page] = {};
    if (!translations[page][section]) translations[page][section] = {};
    if (!translations[page][section][key]) translations[page][section][key] = {};

    translations[page][section][key]['English'] = parts[englishIndex] ? parts[englishIndex].replace(/^"|"$/g, '') : '';
    translations[page][section][key]['Chinese'] = parts[chineseIndex] ? parts[chineseIndex].replace(/^"|"$/g, '') : '';
    translations[page][section][key]['Japanese'] = parts[japaneseIndex] ? parts[japaneseIndex].replace(/^"|"$/g, '') : '';
  }
  console.log('Translations loaded:', translations);
}

// Function to apply translations to the DOM
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const i18nKey = element.dataset.i18n;
    const [page, section, key] = i18nKey.split(',');

    if (translations[page] && translations[page][section] && translations[page][section][key] && translations[page][section][key][currentLanguage]) {
      element.textContent = translations[page][section][key][currentLanguage];
    } else {
      console.warn(`Translation not found for: ${i18nKey} in ${currentLanguage}`);
    }
  });

  // Update specific elements that might not be simple textContent
  // For example, placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const i18nKey = element.dataset.i18nPlaceholder;
    const [page, section, key] = i18nKey.split(',');
    if (translations[page] && translations[page][section] && translations[page][section][key] && translations[page][section][key][currentLanguage]) {
      element.placeholder = translations[page][section][key][currentLanguage];
    }
  });

  // Update legal modal content if it's open
  const legalModal = document.getElementById('legal-modal');
  if (legalModal && !legalModal.classList.contains('hidden')) {
    const modalType = legalModal.dataset.modalType;
    if (modalType) {
      updateLegalModalContent(modalType);
    }
  }

  // Update client modal content if it's open
  const clientModal = document.getElementById('client-modal');
  if (clientModal && !clientModal.classList.contains('hidden')) {
    const modalKey = clientModal.dataset.modalKey;
    if (modalKey) {
      updateClientModalContent(modalKey);
    }
  }

  // Update work.html profile descriptions
  if (document.body.id === 'work-page') {
    document.querySelectorAll('.project-profile').forEach(profileElement => {
      const titleKey = profileElement.dataset.i18nTitle;
      const descKey = profileElement.dataset.i18nDesc;
      const [page, section, titleCsvKey] = titleKey.split(',');
      const [page2, section2, descCsvKey] = descKey.split(',');

      if (translations[page] && translations[page][section] && translations[page][section][titleCsvKey] && translations[page][section][titleCsvKey][currentLanguage]) {
        profileElement.querySelector('h3').textContent = translations[page][section][titleCsvKey][currentLanguage];
      }
      if (translations[page2] && translations[page2][section2] && translations[page2][section2][descCsvKey] && translations[page2][section2][descCsvKey][currentLanguage]) {
        profileElement.querySelector('p').textContent = translations[page2][section2][descCsvKey][currentLanguage];
      }
    });
  }
}

// Function to set the language and re-apply translations
function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('selectedLanguage', lang);
  applyTranslations();
  // Update active language link in navigation
  document.querySelectorAll('.lang-switcher a').forEach(link => {
    if (link.dataset.lang === lang) {
      link.classList.remove('text-gray-500');
    } else {
      link.classList.add('text-gray-500');
    }
  });
}

// Helper for legal modal content
function updateLegalModalContent(type) {
  const modalTitleElement = document.getElementById('modal-title');
  const modalContentElement = document.getElementById('modal-content');
  const page = 'Legal';

  if (modalTitleElement) {
    const titleKey = `${type},Title`;
    if (translations[page] && translations[page][type] && translations[page][type]['Title'] && translations[page][type]['Title'][currentLanguage]) {
      modalTitleElement.textContent = translations[page][type]['Title'][currentLanguage];
    }
  }
  if (modalContentElement) {
    const contentKey = `${type},Content`;
    if (translations[page] && translations[page][type] && translations[page][type]['Content'] && translations[page][type]['Content'][currentLanguage]) {
      modalContentElement.innerHTML = translations[page][type]['Content'][currentLanguage];
    }
  }
}

// Helper for client modal content
function updateClientModalContent(modalKey) {
  const modalLogoElement = document.getElementById('modal-logo');
  const modalDescElement = document.getElementById('modal-desc');
  const modalViewProfileBtn = document.querySelector('#client-modal button');
  const [page, section, key] = modalKey.split(','); // Logos,Lifestyle,Adidas

  if (modalLogoElement) {
    // Assuming logo src is not translated, just description
    // modalLogoElement.src = `https://picsum.photos/seed/${key}/100/40`; // Re-enable if logos are dynamic
  }
  if (modalDescElement) {
    if (translations[page] && translations[page][section] && translations[page][section][key] && translations[page][section][key][currentLanguage]) {
      modalDescElement.textContent = translations[page][section][key][currentLanguage];
    }
  }
  if (modalViewProfileBtn) {
    if (translations['Global'] && translations['Navigation'] && translations['Navigation']['ViewAllWork'] && translations['Global']['Navigation']['ViewAllWork'][currentLanguage]) {
      modalViewProfileBtn.textContent = translations['Global']['Navigation']['ViewAllWork'][currentLanguage];
    }
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadTranslations();
  const savedLanguage = localStorage.getItem('selectedLanguage');
  setLanguage(savedLanguage || 'English'); // Set default or saved language

  // Expose functions globally for HTML access
  window.setLanguage = setLanguage;
  window.updateLegalModalContent = updateLegalModalContent;
  window.updateClientModalContent = updateClientModalContent;
});
