"use client";

import React, {
   createContext,
   useContext,
   useState,
   useEffect,
   ReactNode,
} from "react";
import { tr } from "../dictionaries/tr";
import { tk } from "../dictionaries/tk";
import { en } from "../dictionaries/en";
import { ru } from "../dictionaries/ru"; // RUSÇA EKLENDİ

type Language = "tr" | "tk" | "en" | "ru"; // TİP GÜNCELLENDİ
type Translations = typeof tr;

interface LanguageContextType {
   language: Language;
   setLanguage: (lang: Language) => void;
   t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
   undefined,
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
   const [language, setLanguageState] = useState<Language>("en");
   const [isLoaded, setIsLoaded] = useState(false);

   const dictionaries = { tr, tk, en, ru }; // RUSÇA EKLENDİ

   useEffect(() => {
      const detectLanguage = async () => {
         try {
            const WebApp = (await import("@twa-dev/sdk")).default;
            const tgLang = WebApp.initDataUnsafe?.user?.language_code;

            // RUSÇA KONTROLÜ EKLENDİ
            if (tgLang === "tr" || tgLang === "tk" || tgLang === "ru") {
               setLanguageState(tgLang as Language);
            }
         } catch (error) {
            console.warn(
               "Telegram SDK yüklenemedi, varsayılan dil kullanılıyor.",
            );
         } finally {
            setIsLoaded(true);
         }
      };

      const savedLang = localStorage.getItem("app_lang") as Language;
      // DİZİYE "ru" EKLENDİ
      if (savedLang && ["tr", "tk", "en", "ru"].includes(savedLang)) {
         setLanguageState(savedLang);
         setIsLoaded(true);
      } else {
         detectLanguage();
      }
   }, []);

   const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem("app_lang", lang);
   };

   const t = dictionaries[language];

   if (!isLoaded) return null;

   return (
      <LanguageContext.Provider value={{ language, setLanguage, t }}>
         {children}
      </LanguageContext.Provider>
   );
};

export const useLanguage = () => {
   const context = useContext(LanguageContext);
   if (!context)
      throw new Error("useLanguage must be used within LanguageProvider");
   return context;
};
