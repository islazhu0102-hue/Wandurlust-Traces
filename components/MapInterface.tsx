import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, JournalEntry, Category, DateRange } from '../types';

interface MapInterfaceProps {
  entries: JournalEntry[];
  onMapClick: (coords: Coordinates) => void;
  selectedEntryId?: string;
  onEntrySelect: (id: string) => void;
  tempMarker?: Coordinates | null;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

// Helper to get global Leaflet object
const getL = () => (window as any).L;

const MapInterface: React.FC<MapInterfaceProps> = ({ 
  entries, 
  onMapClick, 
  selectedEntryId,
  onEntrySelect,
  tempMarker,
  dateRange,
  onDateRangeChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [id: string]: any }>({});
  const tempMarkerRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Helper to get icon based on category
  const getCategoryIcon = (cat: Category) => {
    switch(cat) {
      case Category.Food: return '🍴';
      case Category.Shopping: return '🛍️';
      case Category.Nature: return '🌲';
      case Category.Culture: return '🏛️';
      default: return '📍';
    }
  };

  // Initialize Map
  useEffect(() => {
    const L = getL();
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([51.4769, -0.0005], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      map.on('click', (e: any) => {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapInstanceRef.current = map;
    }
  }, []);

  // Sync Entries (Markers)
  useEffect(() => {
    const L = getL();
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    Object.values(markersRef.current).forEach((marker: any) => map.removeLayer(marker));
    markersRef.current = {};

    entries.forEach(entry => {
      const isSelected = entry.id === selectedEntryId;
      const iconHtml = `
        <div class="relative flex flex-col items-center transition-transform duration-300 group ${isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'}">
           <div class="w-10 h-10 rounded-full rounded-br-none -rotate-45 shadow-md border-2 flex items-center justify-center 
                ${isSelected ? 'bg-primary border-white' : 'bg-white border-primary'}">
              <div class="rotate-45 font-ui font-semibold text-lg ${isSelected ? 'text-white' : 'text-stone-700'}">
                ${getCategoryIcon(entry.category)}
              </div>
           </div>
           <div class="absolute -bottom-2 w-4 h-1 bg-stone-500/20 rounded-full blur-[1px]"></div>
        </div>
      `;
      const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon',
        iconSize: [40, 50],
        iconAnchor: [20, 40] 
      });

      const marker = L.marker([entry.latitude, entry.longitude], { icon })
        .addTo(map)
        .on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          onEntrySelect(entry.id);
        });

      markersRef.current[entry.id] = marker;
    });
  }, [entries, selectedEntryId]);

  // Sync Temp Marker
  useEffect(() => {
    const L = getL();
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (tempMarkerRef.current) {
      map.removeLayer(tempMarkerRef.current);
      tempMarkerRef.current = null;
    }

    if (tempMarker) {
      const iconHtml = `
        <div class="animate-bounce relative">
          <div class="w-10 h-10 rounded-full rounded-br-none -rotate-45 bg-primary-dark/80 border-2 border-white shadow-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 rotate-45 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-1 bg-stone-500/20 rounded-full blur-[1px]"></div>
        </div>
      `;
      const icon = L.divIcon({
        html: iconHtml,
        className: 'custom-div-icon',
        iconSize: [40, 50],
        iconAnchor: [20, 40]
      });
      tempMarkerRef.current = L.marker([tempMarker.lat, tempMarker.lng], { icon }).addTo(map);
    }
  }, [tempMarker]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      // 关键修复：添加 email 参数以符合 Nominatim 的 Usage Policy
      // 这样 API 提供方就能识别出这是一个来自 Wanderlust Traces 应用的合法请求
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(searchQuery)}&email=wanderlust-traces@example.com`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (!response.ok) throw new Error("Search service returned an error");
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Search failed", error);
      alert("Search failed. Please try again or check your connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = (e: React.MouseEvent, result: any) => {
    const L = getL();
    L.DomEvent.stopPropagation(e);
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    const map = mapInstanceRef.current;
    if (map && !isNaN(lat) && !isNaN(lon)) {
      map.invalidateSize();
      map.flyTo([lat, lon], 17, { duration: 1.5 });
      onMapClick({ lat, lng: lon });
    }
    
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
  };

  return (
    <div className="relative w-full h-full rounded-[2rem] overflow-hidden shadow-sm bg-white border border-white/50">
      <div 
        ref={mapContainerRef} 
        id="map" 
        className="w-full h-full z-0 vintage-map-filter"
      ></div>

      <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col md:flex-row gap-4 pointer-events-none">
        <div className="relative pointer-events-auto w-80">
          <form onSubmit={handleSearch} className="relative shadow-md rounded-full overflow-hidden">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (hasSearched) setHasSearched(false);
              }}
              placeholder="Search places..."
              className="w-full pl-10 pr-12 py-3 border-none outline-none text-stone-700 font-sans text-sm bg-white/95 backdrop-blur-md focus:ring-2 focus:ring-primary/20"
            />
            <div className="absolute left-3.5 top-3 text-stone-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            
            <button 
              type="submit" 
              className="absolute right-0 top-0 bottom-0 px-4 bg-primary text-white hover:bg-primary-dark transition-colors flex items-center justify-center"
              disabled={isSearching}
            >
              {isSearching ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              )}
            </button>
          </form>

          {(searchResults.length > 0 || (hasSearched && !isSearching)) && (
            <div className="absolute top-full left-0 w-full mt-2 bg-white/95 backdrop-blur rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto border border-stone-100 z-[1100]">
              {searchResults.length > 0 ? (
                searchResults.map((result, idx) => (
                  <div 
                    key={idx}
                    onClick={(e) => handleResultSelect(e, result)}
                    className="px-4 py-3 hover:bg-pastel-gold/30 cursor-pointer border-b border-stone-50 last:border-0 text-sm text-stone-700 font-sans"
                  >
                    <div className="font-medium truncate">{result.display_name.split(',')[0]}</div>
                    <div className="text-xs text-stone-500 truncate">{result.display_name}</div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-center text-stone-400 text-sm italic">
                  No results found for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-md rounded-full px-4 py-2 flex items-center gap-2 border border-white/50 h-[46px]">
            <div className="flex items-center gap-2">
                <span className="text-stone-400 text-xs uppercase font-bold tracking-wider">From</span>
                <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => onDateRangeChange({...dateRange, start: e.target.value})}
                    className="bg-transparent border-none text-stone-700 font-sans text-sm focus:ring-0 p-0 w-28 cursor-pointer"
                />
            </div>
            <div className="w-px h-4 bg-stone-300 mx-1"></div>
            <div className="flex items-center gap-2">
                <span className="text-stone-400 text-xs uppercase font-bold tracking-wider">To</span>
                <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => onDateRangeChange({...dateRange, end: e.target.value})}
                    className="bg-transparent border-none text-stone-700 font-sans text-sm focus:ring-0 p-0 w-28 cursor-pointer"
                />
            </div>
        </div>
      </div>

      {entries.length === 0 && !tempMarker && (
        <div className="absolute bottom-8 left-8 z-[1000] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-xl shadow-lg border-l-4 border-primary max-w-xs">
             <h3 className="text-primary-dark font-serif italic font-semibold text-xl mb-1">Begin your story</h3>
             <p className="text-stone-600 text-sm font-sans leading-relaxed">Search for a place or simply click on the map to drop a pin.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapInterface;