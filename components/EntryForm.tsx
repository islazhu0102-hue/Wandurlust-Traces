import React, { useState, useEffect } from 'react';
import { Category, Coordinates } from '../types';
import { enhanceEntryNote, getPlaceContext, paintMemory } from '../services/geminiService';

interface EntryFormProps {
  onSubmit: (data: { note: string; category: Category; photoUrl: string | null; date: string }) => Promise<void>;
  onCancel: () => void;
  coords?: Coordinates | null;
}

const EntryForm: React.FC<EntryFormProps> = ({ onSubmit, onCancel, coords }) => {
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<Category>(Category.Culture);
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isPainting, setIsPainting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentInsight, setAgentInsight] = useState<string | null>(null);
  const [isGettingInsight, setIsGettingInsight] = useState(false);

  useEffect(() => {
    const now = new Date();
    const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setDate(localIso);
  }, [coords]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleEnhance = async () => {
    if (!note.trim()) return;
    setIsEnhancing(true);
    const polished = await enhanceEntryNote(note, category);
    setNote(polished);
    setIsEnhancing(false);
  };

  const handlePaint = async () => {
    if (!note.trim()) return alert("Please write a note first to inspire the AI.");
    setIsPainting(true);
    const aiImage = await paintMemory(note);
    if (aiImage) {
      setPreviewUrl(aiImage);
      // We clear the manual file upload if AI generates one
      setPhoto(null);
    } else {
      alert("AI failed to paint this memory. Try a different description.");
    }
    setIsPainting(false);
  };

  const handleGetInsight = async () => {
    if (!coords) return;
    setIsGettingInsight(true);
    const insight = await getPlaceContext(coords.lat, coords.lng);
    setAgentInsight(insight);
    setIsGettingInsight(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    let finalPhotoUrl: string | null = previewUrl; // Use current preview (could be AI or Local)

    // Only if it's a local File do we need to convert to Base64
    if (photo) {
      finalPhotoUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(photo);
        reader.onload = () => resolve(reader.result as string);
      });
    }

    await onSubmit({ note, category, photoUrl: finalPhotoUrl, date });
    setIsProcessing(false);
  };

  return (
    <div className="h-full flex flex-col p-2">
      <h2 className="text-3xl font-serif italic text-stone-800 mb-4 border-b border-primary/20 pb-2">Log New Memory</h2>
      
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-ui font-bold text-stone-400 uppercase tracking-widest">Time / Date</label>
          <input 
            type="datetime-local" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full bg-white/50 border-b-2 border-stone-200 focus:border-primary px-3 py-2 rounded-t-lg outline-none font-sans text-stone-700 text-sm"
          />
        </div>

        {coords && (
          <div className="flex flex-col gap-2">
             <div className="flex justify-between items-center">
                 <label className="text-xs font-ui font-bold text-stone-400 uppercase tracking-widest">Location Insight</label>
                 <button type="button" onClick={handleGetInsight} disabled={isGettingInsight} className="text-xs text-primary font-medium hover:underline">
                    {isGettingInsight ? "Thinking..." : "Ask Agent ✨"}
                 </button>
             </div>
             {agentInsight && (
                <div className="bg-pastel-lavender/30 p-3 rounded-lg border border-pastel-lavender/50 animate-fadeIn">
                   <p className="text-sm font-serif italic text-stone-700 leading-snug">"{agentInsight}"</p>
                </div>
             )}
          </div>
        )}

        <div className="flex flex-col gap-2 relative">
          <label className="text-xs font-ui font-bold text-stone-400 uppercase tracking-widest">Notes</label>
          <div className="relative group">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you see? How did you feel?"
              className="w-full h-28 p-4 bg-pastel-gold/20 border-none rounded-xl resize-none focus:ring-1 focus:ring-primary/30 text-stone-700 placeholder-stone-400 font-sans text-sm"
              required
            />
            <button
              type="button"
              onClick={handleEnhance}
              disabled={isEnhancing || !note.trim()}
              className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-white/60 hover:bg-white text-primary text-[10px] font-ui font-bold uppercase tracking-wider rounded-lg shadow-sm border border-primary/10 transition-all"
            >
              {isEnhancing ? "Polishing..." : "✨ Polish"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-ui font-bold text-stone-400 uppercase tracking-widest">Category</label>
          <div className="flex flex-wrap gap-2">
            {Object.values(Category).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1 text-xs font-ui font-medium rounded-full border transition-all ${
                  category === cat ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white/60 text-stone-500 border-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
             <label className="text-xs font-ui font-bold text-stone-400 uppercase tracking-widest">Photo or AI Art</label>
             <button 
                type="button" 
                onClick={handlePaint} 
                disabled={isPainting || !note.trim()}
                className="text-[10px] text-primary-dark font-ui font-bold uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-30"
             >
                {isPainting ? "Painting..." : "🎨 Paint with AI"}
             </button>
          </div>
          <div className="relative group">
             <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="photo-upload" />
             <label 
                htmlFor="photo-upload"
                className="flex items-center justify-center w-full h-24 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:bg-white/50 transition-all overflow-hidden bg-white/30"
             >
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center text-stone-400 group-hover:text-primary">
                        <svg className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className="text-[10px] font-ui uppercase font-bold tracking-widest">Upload Photo</span>
                    </div>
                )}
             </label>
          </div>
        </div>

        <div className="mt-auto flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-stone-500 text-xs font-ui font-bold uppercase tracking-wide">Cancel</button>
            <button 
                type="submit" 
                disabled={isProcessing || isPainting}
                className="flex-1 py-3 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl shadow-md font-ui font-bold text-xs tracking-widest uppercase disabled:opacity-50"
            >
                {isProcessing ? "Saving..." : "Save Log"}
            </button>
        </div>
      </form>
    </div>
  );
};

export default EntryForm;