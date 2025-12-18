export enum Category {
  Food = 'Food',
  Shopping = 'Shopping',
  Culture = 'Culture',
  Nature = 'Nature',
  Other = 'Other'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface JournalEntry {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string; // ISO string
  dateDisplay: string; // Human readable
  note: string;
  category: Category;
  photoUrl: string | null;
}

export interface DateRange {
  start: string;
  end: string;
}