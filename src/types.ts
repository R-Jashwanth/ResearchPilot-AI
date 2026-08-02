export interface Document {
  id: string;
  filename: string;
  uploadDate: string;
  chunkCount: number;
}

export interface SearchResult {
  id: string;
  filename: string;
  page: number;
  score: number;
  text: string;
}

export interface Timeline {
  parsing: boolean;
  chunking: boolean;
  embedding: boolean;
  search: boolean;
  topK: boolean;
  retrieved: boolean;
  generation: boolean;
  verified: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: SearchResult[];
  confidence?: 'High' | 'Medium' | 'Low' | null;
  timeline?: Timeline;
  isStreaming?: boolean;
}

export interface Stats {
  documentCount: number;
  pagesProcessed: number;
  chunkCount: number;
  avgChunkSize: number;
  embeddingModel: string;
  vectorDb: string;
  avgRetrievalTime: number;
  avgSimilarityScore: number;
}

export interface Settings {
  topK: number;
  chunkSize: number;
  chunkOverlap: number;
  similarityThreshold: number;
  temperature: number;
  maxTokens: number;
}
