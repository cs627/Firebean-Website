import { translations } from './translations.js';

export class I18n {
  constructor() {
    this.lang = localStorage.getItem('firebean_lang') || 'en';
    this.translations = translations;
    this.init();
  }

  init() {
    // Initial update
    this.updateLanguage(this.lang);
    this.bindEvents();
  }

  bindEvents() {
    const langLinks = document.querySelectorAll('[data-lang]');
    langLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = e.target.dataset.lang;
        this.setLanguage(lang);
      });
    });
  }

  setLanguage(lang) {
    this.lang = lang;
    localStorage.setItem('firebean_lang', lang);
    this.updateLanguage(lang);
  }

  updateLanguage(lang) {
    // Update active state in switcher
    const langLinks = document.querySelectorAll('[data-lang]');
    langLinks.forEach(link => {
      if (link.dataset.lang === lang) {
        link.classList.add('text-brand-black', 'font-bold');
        link.classList.remove('text-gray-500');
      } else {
        link.classList.remove('text-brand-black', 'font-bold');
        link.classList.add('text-gray-500');
      }
    });

    // Update text content
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.dataset.i18n;
      const translation = this.getTranslation(lang, key);
      
      if (translation) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            if (el.placeholder) {
                el.placeholder = translation;
            } else {
                el.value = translation;
            }
        } else {
            // Check if translation contains HTML tags
            if (/<[a-z][\s\S]*>/i.test(translation)) {
                el.innerHTML = translation;
            } else {
                el.textContent = translation;
            }
        }
      }
    });
  }

  getTranslation(lang, key) {
    if (!key) return null;
    const keys = key.split('.');
    let value = this.translations[lang];
    
    for (const k of keys) {
      if (value && value[k]) {
        value = value[k];
      } else {
        // Fallback to English if translation missing
        if (lang !== 'en') {
            return this.getTranslation('en', key);
        }
        return null;
      }
    }
    return value;
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  window.i18n = new I18n();
});
