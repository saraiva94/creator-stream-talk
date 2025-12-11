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
  { code: 'en', label: 'EN', flag: '/flags/us.png' },
  { code: 'es', label: 'ES', flag: '/flags/es.png' },
  { code: 'pt', label: 'PT', flag: '/flags/br.png' },
];

export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-md p-1">
          <img 
            src={currentLang.flag} 
            alt={currentLang.label} 
            className="w-6 h-4 object-cover rounded-sm"
          />
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
            <img 
              src={lang.flag} 
              alt={lang.label} 
              className="w-5 h-3.5 object-cover rounded-sm"
            />
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
