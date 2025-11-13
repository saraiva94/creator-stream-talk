import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language } from '@/lib/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    if (saved && (saved === 'en' || saved === 'es' || saved === 'pt')) {
      return saved as Language;
    }
    // Auto-detect browser language
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'es' || browserLang === 'pt') {
      return browserLang as Language;
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
