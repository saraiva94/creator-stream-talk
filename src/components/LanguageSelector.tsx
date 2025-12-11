import { useLanguage } from '@/hooks/useLanguage';
import { Button } from './ui/button';
import { Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const LANGUAGES = [
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'pt', label: 'PT', flag: '🇧🇷' },
];

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-2xl rounded-md">
          <span role="img" aria-label={currentLang.label}>{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[100px] bg-card border-border">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as 'en' | 'es' | 'pt')}
            className={`flex items-center gap-2 cursor-pointer ${
              language === lang.code 
                ? 'bg-primary/20 text-primary' 
                : ''
            }`}
          >
            {language === lang.code && <Check className="h-4 w-4 text-primary" />}
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
