import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Video, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

type UserResult = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  is_creator: boolean;
  is_streaming: boolean;
  relevance_score: number;
};

interface UserSearchAutocompleteProps {
  onSelectUser?: (user: UserResult) => void;
  placeholder?: string;
  className?: string;
}

export const UserSearchAutocomplete = ({
  onSelectUser,
  placeholder,
  className,
}: UserSearchAutocompleteProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Debounced search function
  const searchUsers = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch profiles matching the search
      const { data: profiles, error } = await supabase
        .from("public_profiles")
        .select("id, username, avatar_url, bio")
        .ilike("username", `%${searchTerm}%`)
        .limit(20);

      if (error) throw error;

      // Fetch creator info for these users
      const userIds = profiles?.map((p) => p.id) || [];
      const { data: creators } = await supabase
        .from("creator_profiles")
        .select("id, is_streaming")
        .in("id", userIds);

      const creatorMap = new Map(
        creators?.map((c) => [c.id, { is_streaming: c.is_streaming }]) || []
      );

      // Calculate relevance scores and sort
      const scoredResults: UserResult[] = (profiles || []).map((profile) => {
        const username = profile.username?.toLowerCase() || "";
        const searchLower = searchTerm.toLowerCase();
        
        // Relevance scoring
        let score = 0;
        
        // Exact match = highest score
        if (username === searchLower) {
          score = 1000;
        }
        // Starts with search term = high score
        else if (username.startsWith(searchLower)) {
          score = 500 + (100 - username.length); // Shorter names rank higher
        }
        // Contains search term = medium score
        else {
          const index = username.indexOf(searchLower);
          score = 100 - index; // Earlier occurrence = higher score
        }

        // Bonus for creators
        const creatorInfo = creatorMap.get(profile.id);
        if (creatorInfo) {
          score += 50;
          // Extra bonus if streaming
          if (creatorInfo.is_streaming) {
            score += 200;
          }
        }

        return {
          id: profile.id!,
          username: profile.username!,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          is_creator: !!creatorInfo,
          is_streaming: creatorInfo?.is_streaming || false,
          relevance_score: score,
        };
      });

      // Sort by relevance score (descending)
      scoredResults.sort((a, b) => b.relevance_score - a.relevance_score);

      setResults(scoredResults.slice(0, 8)); // Show top 8 results
      setIsOpen(scoredResults.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce effect
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(query);
    }, 150); // Fast debounce for responsive feel

    return () => clearTimeout(debounceTimer);
  }, [query, searchUsers]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectUser(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectUser = (user: UserResult) => {
    if (onSelectUser) {
      onSelectUser(user);
    } else {
      // Default: navigate to user's profile
      navigate(`/profile/${user.username}`);
    }
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Highlight matching text
  const highlightMatch = (text: string, search: string) => {
    if (!search) return text;
    const parts = text.split(new RegExp(`(${search})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="text-primary font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder || t.home.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length > 0 && results.length > 0 && setIsOpen(true)}
          className="pl-10 pr-10 bg-card/80 backdrop-blur-sm border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-md border border-primary/20 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="max-h-[400px] overflow-y-auto">
            {results.map((user, index) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left transition-colors",
                  selectedIndex === index
                    ? "bg-primary/20"
                    : "hover:bg-muted/50"
                )}
              >
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.username?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {highlightMatch(user.username, query)}
                    </span>
                    {user.is_streaming && (
                      <Badge className="bg-destructive/20 text-destructive text-xs px-1.5 py-0">
                        <span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse mr-1" />
                        LIVE
                      </Badge>
                    )}
                    {user.is_creator && !user.is_streaming && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        <Video className="h-3 w-3 mr-1" />
                        Criador
                      </Badge>
                    )}
                  </div>
                  {user.bio && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {user.bio}
                    </p>
                  )}
                </div>

                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
          
          {/* Search hint */}
          <div className="px-3 py-2 bg-muted/30 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <span>↑↓ navegar</span>
            <span>↵ selecionar</span>
            <span>esc fechar</span>
          </div>
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length > 0 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-md border border-primary/20 rounded-lg shadow-xl p-4 text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum usuário encontrado para "{query}"
          </p>
        </div>
      )}
    </div>
  );
};

export default UserSearchAutocomplete;
