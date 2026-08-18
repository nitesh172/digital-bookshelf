import { useState, useEffect, useRef } from 'react';
import type { Book } from './books';
import { BookshelfScene } from './components/BookshelfScene';
import { AmbientSound } from './components/AmbientSound';
import { Heart, Search, X, Loader2, Download, Sun } from 'lucide-react';

const getCors = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};

export default function App() {
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [books, setBooks] = useState<Book[]>([]); // Initialized as [] to prevent undefined crash
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const [readingBook, setReadingBook] = useState<Book | null>(null);
    const [warmIntensity, setWarmIntensity] = useState<number>(0.4);

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
    const [searchError, setSearchError] = useState<string>('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Fetch popular books from Gutenberg API on mount
    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const res = await fetch("https://gutendex.com/books/?sort=popular&languages=en&page=1");
                const data = await res.json();

                if (data.results && data.results.length > 0) {
                    const palette = [
                        { color: "#a8e6cf", spineColor: "#81c784", textColor: "#1b5e20" },
                        { color: "#ffd3b6", spineColor: "#ffaaa5", textColor: "#3e2723" },
                        { color: "#b8c9f1", spineColor: "#7e9cd8", textColor: "#1a2a4a" },
                        { color: "#d4a5a5", spineColor: "#b88b8b", textColor: "#2b1b1b" },
                        { color: "#fce38a", spineColor: "#f38181", textColor: "#3e2723" },
                        { color: "#e8dbfc", spineColor: "#cdaef2", textColor: "#311b92" },
                    ];

                    const mapped = data.results.map((item: any, index: number) => {
                        const scheme = palette[index % palette.length];
                        return {
                            id: String(item.id),
                            title: item.title,
                            author: item.authors?.[0]?.name || "Unknown Author",
                            coverUrl: item.formats?.["image/jpeg"] || "",
                            color: scheme.color,
                            spineColor: scheme.spineColor,
                            textColor: scheme.textColor,
                            summary: item.summaries?.[0] || item.summary || "",
                            textUrl: `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}-images.html`,
                            mobiUrl: item.formats?.["application/x-mobipocket-ebook"] || `https://www.gutenberg.org/ebooks/${item.id}.kf8.images`
                        };
                    });
                    setBooks(mapped);
                    getCors('https://www.gutenberg.org/ebooks/1342.html.images')
                }
            } catch (err) {
                console.error("Failed to load Gutenberg books:", err);
            }
        };

        fetchBooks();
    }, []);



    // Search books from Gutendex API
    const handleSearch = async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        setIsSearching(true);
        setSearchError('');
        setSelectedBook(null);
        setIsFlipped(false);

        try {
            const res = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(trimmed)}&languages=en`);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const palette = [
                    { color: "#a8e6cf", spineColor: "#81c784", textColor: "#1b5e20" },
                    { color: "#ffd3b6", spineColor: "#ffaaa5", textColor: "#3e2723" },
                    { color: "#b8c9f1", spineColor: "#7e9cd8", textColor: "#1a2a4a" },
                    { color: "#d4a5a5", spineColor: "#b88b8b", textColor: "#2b1b1b" },
                    { color: "#fce38a", spineColor: "#f38181", textColor: "#3e2723" },
                    { color: "#e8dbfc", spineColor: "#cdaef2", textColor: "#311b92" },
                ];

                const mapped = data.results.map((item: any, index: number) => {
                    const scheme = palette[index % palette.length];
                    return {
                        id: String(item.id),
                        title: item.title,
                        author: item.authors?.[0]?.name || "Unknown Author",
                        coverUrl: item.formats?.["image/jpeg"] || "",
                        color: scheme.color,
                        spineColor: scheme.spineColor,
                        textColor: scheme.textColor,
                        summary: item.summaries?.[0] || item.summary || "",
                        textUrl: `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}-images.html`,
                        mobiUrl: item.formats?.["application/x-mobipocket-ebook"] || `https://www.gutenberg.org/ebooks/${item.id}.kf8.images`
                    };
                });
                setBooks(mapped);
                setIsSearchActive(true);
            } else {
                setSearchError('No books found. Try a different search.');
            }
        } catch (err) {
            console.error("Search failed:", err);
            setSearchError('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    // Clear search and restore popular books
    const handleClearSearch = async () => {
        setSearchQuery('');
        setIsSearchActive(false);
        setSearchError('');
        setSelectedBook(null);
        setIsFlipped(false);

        try {
            const res = await fetch("https://gutendex.com/books/?sort=popular&languages=en&page=1");
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const palette = [
                    { color: "#a8e6cf", spineColor: "#81c784", textColor: "#1b5e20" },
                    { color: "#ffd3b6", spineColor: "#ffaaa5", textColor: "#3e2723" },
                    { color: "#b8c9f1", spineColor: "#7e9cd8", textColor: "#1a2a4a" },
                    { color: "#d4a5a5", spineColor: "#b88b8b", textColor: "#2b1b1b" },
                    { color: "#fce38a", spineColor: "#f38181", textColor: "#3e2723" },
                    { color: "#e8dbfc", spineColor: "#cdaef2", textColor: "#311b92" },
                ];

                const mapped = data.results.map((item: any, index: number) => {
                    const scheme = palette[index % palette.length];
                    return {
                        id: String(item.id),
                        title: item.title,
                        author: item.authors?.[0]?.name || "Unknown Author",
                        coverUrl: item.formats?.["image/jpeg"] || "",
                        color: scheme.color,
                        spineColor: scheme.spineColor,
                        textColor: scheme.textColor,
                        summary: item.summaries?.[0] || item.summary || "",
                        textUrl: `https://www.gutenberg.org/cache/epub/${item.id}/pg${item.id}-images.html`,
                        mobiUrl: item.formats?.["application/x-mobipocket-ebook"] || `https://www.gutenberg.org/ebooks/${item.id}.kf8.images`
                    };
                });
                setBooks(mapped);
            }
        } catch (err) {
            console.error("Failed to reload popular books:", err);
        }
    };

    const getWarmFilterStyle = () => {
        if (warmIntensity <= 0) return {};
        return {
            backgroundColor: `rgba(251, 191, 36, ${warmIntensity * 0.15})`,
            pointerEvents: 'none' as const,
            mixBlendMode: 'multiply' as const,
        };
    };

    return (
        <div className={`relative w-screen h-screen flex flex-col transition-colors duration-500 overflow-hidden bg-[#f7f6f3] text-[#2c2a29]`}>
            {/* Dynamic Warm Amber Overlay */}
            <div className="absolute inset-0 z-40 pointer-events-none" style={getWarmFilterStyle()} />

            {/* HEADER DASHBOARD */}
            <header className="absolute top-0 left-0 right-0 z-30 p-2 md:p-6 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 bg-gradient-to-b from-black/5 to-transparent pointer-events-none">
                <div className="flex items-center gap-2 md:gap-3 pointer-events-auto bg-white/70 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2.5 rounded-2xl shadow-sm border border-black/5">
                    <Heart className="w-4 h-4 md:w-5 md:h-5 text-rose-500 fill-rose-500 animate-pulse" />
                    <div>
                        <h1 className="text-xs md:text-base font-bold text-neutral-800 tracking-tight">Her Personal Library</h1>
                        <p className="hidden md:block text-xs text-neutral-500 font-medium">A customized reading sanctuary</p>
                    </div>
                </div>

                {/* CONTROLS */}
                <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pointer-events-auto">
                    {/* Search Bar */}
                    <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-md px-2 py-1 md:px-3 md:py-1.5 rounded-2xl shadow-sm border border-black/5 transition-all focus-within:border-amber-300 focus-within:shadow-md focus-within:bg-white/95">
                        <button
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="p-1 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                            title="Search books"
                        >
                            {isSearching
                                ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500 animate-spin" />
                                : <Search className="w-3.5 h-3.5 md:w-4 md:h-4 text-neutral-500" />
                            }
                        </button>
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search books..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSearch();
                            }}
                            className="w-24 md:w-40 bg-transparent text-[11px] md:text-xs text-neutral-800 placeholder-neutral-400 outline-none font-medium"
                        />
                        {(searchQuery || isSearchActive) && (
                            <button
                                onClick={handleClearSearch}
                                className="p-0.5 rounded-full hover:bg-neutral-100 transition-colors"
                                title="Clear search"
                            >
                                <X className="w-3 h-3 md:w-3.5 md:h-3.5 text-neutral-400" />
                            </button>
                        )}
                    </div>

                    {/* Search Active Indicator */}
                    {isSearchActive && (
                        <div className="flex items-center gap-1.5 bg-amber-50/90 backdrop-blur-md px-2.5 py-1.5 md:px-3 md:py-2 rounded-2xl shadow-sm border border-amber-200 text-amber-800 text-[10px] md:text-xs font-semibold">
                            <Search className="w-3 h-3 text-amber-600" />
                            <span>Results for "{searchQuery}"</span>
                        </div>
                    )}

                    {/* Search Error Toast */}
                    {searchError && (
                        <div className="flex items-center gap-1.5 bg-rose-50/90 backdrop-blur-md px-2.5 py-1.5 md:px-3 md:py-2 rounded-2xl shadow-sm border border-rose-200 text-rose-700 text-[10px] md:text-xs font-semibold">
                            <span>{searchError}</span>
                            <button onClick={() => setSearchError('')} className="p-0.5 rounded-full hover:bg-rose-100">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Warm Amber Control */}
                    <div className="flex items-center gap-1.5 md:gap-2 bg-white/70 backdrop-blur-md px-2.5 py-1.5 md:px-3 md:py-2 rounded-2xl shadow-sm border border-black/5 pointer-events-auto">
                        <Sun className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={warmIntensity}
                            onChange={(e) => setWarmIntensity(parseFloat(e.target.value))}
                            className="w-14 md:w-24 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            title="Warm Screen Filter"
                        />
                        <span className="text-[9px] md:text-[10px] font-bold text-neutral-500 min-w-[20px] md:min-w-[24px]">Amber</span>
                    </div>

                </div>
            </header>

            {/* CORE 3D CANVAS */}
            <main className="flex-1 w-full h-full relative z-10">
                <BookshelfScene
                    books={books}
                    selectedBook={selectedBook}
                    onSelectBook={() => {
                        setIsFlipped(prev => !prev);
                    }}
                    onPreviewBook={(book) => {
                        setSelectedBook(book);
                        if (!book) {
                            setIsFlipped(false);
                            setIsTransitioning(true);
                        }
                    }}
                    onReadBook={(book) => {
                        // Close the book and return to shelf first
                        setSelectedBook(null);
                        setIsFlipped(false);
                        setIsTransitioning(true);

                        if (book.textUrl) {
                            setTimeout(() => {
                                setReadingBook(book);
                            }, 900);
                        }
                    }}

                    isTransitioning={isTransitioning}
                    setIsTransitioning={setIsTransitioning}
                    isFlipped={isFlipped}
                    setIsFlipped={setIsFlipped}
                    isSearchActive={isSearchActive}
                    warmFilterIntensity={warmIntensity}
                />
            </main>

            {/* AMBIENT SOUND CONTROLS */}
            <div className="absolute bottom-4 right-4 z-40 pointer-events-auto">
                <AmbientSound />
            </div>

            {/* IFRAME READER OVERLAY */}
            {readingBook && readingBook.textUrl && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col">
                    <div className="h-12 bg-white border-b border-black/10 flex items-center justify-between px-4 shrink-0 shadow-sm">
                        <h2 className="text-sm font-bold text-neutral-800">Reading Mode</h2>
                        
                        <div className="flex items-center gap-3">
                            {readingBook.mobiUrl && (
                                <div className="flex items-center gap-2 border-r border-neutral-200 pr-3">
                                    <span className="text-[10px] text-neutral-500 font-medium hidden sm:inline-block">Use ReadEra app for MOBI format</span>
                                    <button
                                        onClick={() => window.open(readingBook.mobiUrl, '_blank')}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Download MOBI</span>
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => setReadingBook(null)}
                                className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors flex items-center gap-1.5 text-neutral-500 hover:text-rose-500"
                            >
                                <span className="text-xs font-semibold">Close Book</span>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <iframe 
                        src={readingBook.textUrl} 
                        className="w-full h-full border-none bg-[#fdfdfc]"
                        title="Book Reader"
                    />
                </div>
            )}
        </div>
    );
}
