import React, { useState, useMemo, useEffect } from 'react';
import MapInterface from './components/MapInterface';
import EntryForm from './components/EntryForm';
import { JournalEntry, Coordinates, Category, DateRange } from './types';
import { generateTravelSummary } from './services/geminiService';
import { ApiService } from './services/api';

const App: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [tempMarker, setTempMarker] = useState<Coordinates | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [travelStory, setTravelStory] = useState<string | null>(null);

  useEffect(() => {
    const initApp = async () => {
      const online = await ApiService.checkConnection();
      setIsBackendOnline(online);
      try {
        const data = await ApiService.getEntries();
        setEntries(data);
      } catch (error) {
        console.error("Initial load failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();

    const interval = setInterval(async () => {
      const online = await ApiService.checkConnection();
      setIsBackendOnline(online);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMapClick = (coords: Coordinates) => {
    setTempMarker(coords);
    setIsFormOpen(true);
    setSelectedEntryId(undefined);
  };

  const handleEntrySelect = (id: string) => {
    setSelectedEntryId(id);
    setTempMarker(null);
    setIsFormOpen(false);
  };

  const handleFormSubmit = async (data: { note: string; category: Category; photoUrl: string | null; date: string }) => {
    if (!tempMarker) return;
    setIsSyncing(true);
    try {
      const newEntryPayload = {
        latitude: tempMarker.lat,
        longitude: tempMarker.lng,
        timestamp: data.date,
        dateDisplay: new Date(data.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        note: data.note,
        category: data.category,
        photoUrl: data.photoUrl 
      };
      const savedEntry = await ApiService.createEntry(newEntryPayload);
      setEntries(prev => [...prev, savedEntry]);
      setIsFormOpen(false);
      setTempMarker(null);
    } catch (error) {
      alert("Failed to save to cloud, saved locally instead.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteEntry = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    if (window.confirm("Delete this memory permanently?")) {
      setIsSyncing(true);
      try {
        await ApiService.deleteEntry(id);
        setEntries(prev => prev.filter(entry => entry.id !== id));
        if (selectedEntryId === id) setSelectedEntryId(undefined);
      } catch (error) {
        alert("Action failed.");
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setTravelStory(null);
    const start = new Date(dateRange.start).getTime();
    const end = new Date(dateRange.end).getTime() + 86400000;
    const filtered = entries.filter(e => {
      const t = new Date(e.timestamp).getTime();
      return t >= start && t <= end;
    });
    const story = await generateTravelSummary(filtered);
    setTravelStory(story);
    setIsGenerating(false);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `wanderlust-traces-${new Date().toISOString().slice(0, 10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (Array.isArray(importedData)) {
          await ApiService.importEntries(importedData);
          setEntries(importedData);
          alert("Journal imported successfully!");
        }
      } catch (err) {
        alert("Failed to import. Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId);
  const sortedEntries = useMemo(() => {
     return [...entries].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pastel-sand">
        <div className="flex flex-col items-center gap-4">
           <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
           <p className="font-serif italic text-stone-500">Opening your journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center justify-start font-sans text-stone-800 bg-gradient-to-br from-pastel-lavender via-pastel-gold/30 to-pastel-sand/30">
      
      {isSyncing && (
        <div className="fixed top-4 right-4 z-[5000] bg-white/80 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-primary/20 flex items-center gap-2 animate-bounce">
           <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
           <span className="text-[10px] font-ui font-bold uppercase tracking-widest text-primary">Syncing...</span>
        </div>
      )}

      <div className="max-w-7xl w-full flex flex-col gap-8">
        
        {/* Header / Hero Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center px-4 py-2 gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-[url('https://cdn-icons-png.flaticon.com/512/3663/3663363.png')] bg-cover opacity-80 mix-blend-multiply"></div>
               <h1 className="text-4xl font-serif italic font-medium tracking-wide text-stone-700">Wanderlust Traces</h1>
            </div>
            <p className="text-sm font-serif italic text-stone-500 mt-1 ml-13">Fuel your wanderlust, one trace at a time.</p>
            <div className="flex items-center gap-2 mt-2 ml-13">
              <div className={`w-2 h-2 rounded-full ${isBackendOnline ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-amber-500'}`}></div>
              <span className="text-[10px] font-ui font-bold uppercase tracking-widest text-stone-400">
                {isBackendOnline ? 'Cloud Database Connected' : 'Running Offline Mode'}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
             <label className="cursor-pointer px-4 py-2 bg-white/50 hover:bg-white text-stone-600 rounded-full text-xs font-ui font-bold uppercase tracking-wider transition-all border border-stone-200">
                Import
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
             </label>
             <button onClick={handleExport} className="px-4 py-2 bg-white/50 hover:bg-white text-stone-600 rounded-full text-xs font-ui font-bold uppercase tracking-wider transition-all border border-stone-200">
                Export
             </button>
          </div>
        </header>

        {/* Map Container */}
        <div className="relative bg-white/40 backdrop-blur-xl rounded-[3rem] p-3 shadow-2xl border border-white/60">
           <div className="relative h-[435px] flex rounded-[2.5rem] overflow-hidden transition-all duration-500">
              <div className="flex-grow h-full relative z-0">
                 <MapInterface 
                    entries={entries} 
                    onMapClick={handleMapClick}
                    selectedEntryId={selectedEntryId}
                    onEntrySelect={handleEntrySelect}
                    tempMarker={tempMarker}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                 />
              </div>

              {(isFormOpen || selectedEntry) && (
                 <div className="absolute right-6 top-6 bottom-6 w-96 z-10 animate-fadeIn">
                    <div className="h-full bg-pastel-sand/90 backdrop-blur-md rounded-[2rem] p-6 shadow-xl border border-white/50 overflow-y-auto journal-scroll">
                       <button 
                          onClick={() => { setIsFormOpen(false); setSelectedEntryId(undefined); setTempMarker(null); }}
                          className="absolute top-6 right-6 text-stone-400 hover:text-stone-600 transition-colors"
                       >
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>

                       {isFormOpen ? (
                          <EntryForm 
                             onSubmit={handleFormSubmit}
                             onCancel={() => { setIsFormOpen(false); setTempMarker(null); }}
                             coords={tempMarker}
                          />
                       ) : selectedEntry && (
                          <div className="flex flex-col h-full">
                              <span className="inline-block self-start bg-primary/20 text-primary-dark px-3 py-1 rounded-full text-xs font-ui font-bold uppercase tracking-wide mb-4">
                                {selectedEntry.category}
                              </span>
                              <h3 className="text-2xl font-serif italic text-stone-800 mb-2">{selectedEntry.dateDisplay}</h3>
                              <div className="w-16 h-0.5 bg-primary/30 mb-6"></div>
                              <p className="text-stone-700 font-sans font-light text-lg leading-relaxed mb-8 flex-grow">
                                {selectedEntry.note}
                              </p>
                              {selectedEntry.photoUrl && (
                                <div className="mt-auto p-2 bg-white shadow-sm border border-stone-100 rounded-lg -rotate-1 transform hover:rotate-0 transition-transform duration-300">
                                   <div className="aspect-square overflow-hidden rounded">
                                      <img src={selectedEntry.photoUrl} alt="Memory" className="w-full h-full object-cover" />
                                   </div>
                                </div>
                              )}
                          </div>
                       )}
                    </div>
                 </div>
              )}
           </div>
        </div>

        {/* Summary Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-5 bg-white/30 backdrop-blur-md rounded-[2.5rem] p-8 shadow-sm border border-white/50 flex flex-col max-h-[600px]">
            <h3 className="font-serif italic text-2xl text-stone-700 mb-6">Journey Log</h3>
            <button 
                onClick={handleGenerateSummary}
                disabled={isGenerating || entries.length === 0}
                className="w-full py-3 mb-8 bg-white hover:bg-white/80 text-stone-700 font-ui font-medium uppercase tracking-widest text-xs rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50"
            >
                {isGenerating ? "Reflecting..." : "Reflect on Journey"}
            </button>
            <h4 className="font-serif italic text-lg text-stone-500 mb-4">Trace List</h4>
            <div className="flex-1 overflow-y-auto journal-scroll space-y-3 pr-2 h-96">
              {sortedEntries.map((entry, idx) => (
                <div 
                  key={entry.id} 
                  className={`relative group flex justify-between items-center p-3 rounded-2xl border transition-all ${selectedEntryId === entry.id ? 'bg-white shadow-md border-primary/20' : 'hover:bg-white/40 hover:border-white/50 border-transparent'}`}
                >
                  <div 
                    onClick={() => handleEntrySelect(entry.id)}
                    className="flex items-center gap-4 overflow-hidden cursor-pointer flex-grow h-full min-h-[3rem]"
                  >
                    <span className="font-serif italic text-lg text-primary/50 w-6 flex-shrink-0">{(sortedEntries.length - idx).toString().padStart(2, '0')}.</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-stone-600 font-sans truncate">{entry.dateDisplay.split(',')[0]}</div>
                      <div className="text-xs text-stone-400 uppercase tracking-wider font-ui truncate">{entry.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-2 flex-shrink-0 z-20">
                     {entry.photoUrl && <span className="text-stone-400 opacity-50 text-xs">📷</span>}
                     <button
                        type="button"
                        onClick={(e) => handleDeleteEntry(e, entry.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-stone-100 hover:bg-red-100 text-stone-400 hover:text-red-600 transition-colors shadow-sm active:scale-95"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                     </button>
                  </div>
                </div>
              ))}
              {entries.length === 0 && <p className="text-center text-stone-400 italic font-serif py-10">No entries yet.</p>}
            </div>
          </div>

          <div className="lg:col-span-7 relative">
             <div className="absolute inset-0 bg-gradient-to-tr from-pastel-lavender/40 to-white/40 rounded-[3rem] blur-xl"></div>
             <div className="relative h-full bg-white/30 backdrop-blur-xl rounded-[3rem] p-10 md:p-12 shadow-lg border border-white/60 flex flex-col justify-center items-start text-left">
                <h2 className="text-4xl font-serif italic text-stone-800 mb-6">Your Travel Story</h2>
                {travelStory ? (
                    <div className="prose prose-lg prose-stone font-serif leading-loose text-stone-600">
                      <p className="border-l-2 border-primary/30 pl-6 italic">
                        "{travelStory}"
                      </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-start gap-4 opacity-50 w-full">
                        <div className="w-full h-4 bg-stone-300/20 rounded-full animate-pulse"></div>
                        <div className="w-3/4 h-4 bg-stone-300/20 rounded-full animate-pulse delay-75"></div>
                        <div className="w-5/6 h-4 bg-stone-300/20 rounded-full animate-pulse delay-150"></div>
                        <p className="mt-4 text-sm font-sans text-stone-500">
                           Select a date range on the map and click reflect to see your story.
                        </p>
                    </div>
                )}
             </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default App;