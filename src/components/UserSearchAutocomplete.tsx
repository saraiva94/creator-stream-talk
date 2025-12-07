import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Video, X, Clock, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

interface UserSearchAutocompleteProps {
  onSelectUser?: (user: UserResult) => void;
  placeholder?: string;
  className?: string;
}

const SEARCH_HISTORY_KEY = "stream_search_history";
const MAX_HISTORY_ITEMS = 5;

// Format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${days}d`;
};

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
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading search history:", e);
    }
  }, []);

  // Save search to history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const newItem: SearchHistoryItem = {
      query: searchQuery.trim(),
      timestamp: Date.now(),
    };

    const updated = [
      newItem,
      ...searchHistory.filter(h => h.query.toLowerCase() !== searchQuery.toLowerCase()),
    ].slice(0, MAX_HISTORY_ITEMS);

    setSearchHistory(updated);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving search history:", e);
    }
  };

  // Remove item from history
  const removeFromHistory = (queryToRemove: string) => {
    const updated = searchHistory.filter(h => h.query !== queryToRemove);
    setSearchHistory(updated);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error removing from history:", e);
    }
  };

  // Clear all history
  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.error("Error clearing history:", e);
    }
  };

  // Debounced search function
  const searchUsers = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setShowHistory(false);
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
        
        // Relevance scoring - ORDER OF PRIORITY:
        // 1. Users streaming (live) - highest
        // 2. Creators
        // 3. Exact match
        // 4. Starts with term
        // 5. Contains term
        let score = 0;
        
        const creatorInfo = creatorMap.get(profile.id);
        
        // Priority 1: Streaming users get highest base score
        if (creatorInfo?.is_streaming) {
          score = 2000;
        }
        // Priority 2: Creators get high base score
        else if (creatorInfo) {
          score = 1000;
        }
        
        // Priority 3: Exact match
        if (username === searchLower) {
          score += 500;
        }
        // Priority 4: Starts with search term
        else if (username.startsWith(searchLower)) {
          score += 300 + (100 - username.length); // Shorter names rank higher
        }
        // Priority 5: Contains search term
        else {
          const index = username.indexOf(searchLower);
          score += 100 - index; // Earlier occurrence = higher score
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

      setResults(scoredResults.slice(0, 10)); // Show top 10 results
      setIsOpen(scoredResults.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce effect - 250ms for better UX
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(query);
    }, 250);

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
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = showHistory ? searchHistory : results;
    if (!isOpen && !showHistory) return;
    if (items.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < items.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          if (showHistory) {
            const historyItem = searchHistory[selectedIndex];
            setQuery(historyItem.query);
            setShowHistory(false);
          } else {
            handleSelectUser(results[selectedIndex]);
          }
        }
        break;
      case "Escape":
        setIsOpen(false);
        setShowHistory(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleSelectUser = (user: UserResult) => {
    saveToHistory(user.username);
    
    if (onSelectUser) {
      onSelectUser(user);
    } else {
      // Default: navigate to user's public profile
      navigate(`/u/${user.username}`);
    }
    setQuery("");
    setIsOpen(false);
    setResults([]);
  };

  const handleFocus = () => {
    if (query.length === 0 && searchHistory.length > 0) {
      setShowHistory(true);
      setSelectedIndex(-1);
    } else if (query.length > 0 && results.length > 0) {
      setIsOpen(true);
    }
  };

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    searchUsers(historyQuery);
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
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
    const parts = text.split(regex);
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
          placeholder={placeholder || t.home?.search || "Buscar usuários..."}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length === 0) {
              setShowHistory(searchHistory.length > 0);
            } else {
              setShowHistory(false);
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="pl-10 pr-10 bg-card/80 backdrop-blur-sm border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {query && (
          <button
            type="button"
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

      {/* Search History Dropdown */}
      {showHistory && searchHistory.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-md border border-primary/20 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Buscas recentes
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearHistory}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {searchHistory.map((item, index) => (
              <div
                key={`${item.query}-${item.timestamp}`}
                className={cn(
                  "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors group",
                  selectedIndex === index
                    ? "bg-primary/20"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleHistorySelect(item.query)}
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{item.query}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromHistory(item.query);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown results */}
      {isOpen && results.length > 0 && !showHistory && (
        <div className="absolute z-50 w-full mt-2 bg-card/95 backdrop-blur-md border border-primary/20 rounded-lg shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="max-h-[400px] overflow-y-auto">
            {results.map((user, index) => (
              <div
                key={user.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectUser(user)}
                onKeyDown={(e) => e.key === "Enter" && handleSelectUser(user)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 text-left transition-colors cursor-pointer",
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
              </div>
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
      {isOpen && query.length > 0 && results.length === 0 && !loading && !showHistory && (
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
