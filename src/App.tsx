import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Database, User, Bot, AlertCircle, Upload, Trash2, ShieldCheck, Clock, Layers, Search, Server, Info, CheckCircle2, ChevronRight, ChevronDown, File, Settings as SettingsIcon, Download, FileJson } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Document, SearchResult, Stats, Settings as SettingsType } from './types';

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    topK: 5,
    chunkSize: 1000,
    chunkOverlap: 200,
    similarityThreshold: 0.2,
    temperature: 0.2,
    maxTokens: 2048
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [expandedSources, setExpandedSources] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data.documents);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchStats();
    fetchSettings();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    Array.from(e.target.files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDocs();
        await fetchStats();
      } else {
        console.error('Upload failed:', data.error);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    Array.from(e.dataTransfer.files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        await fetchDocs();
        await fetchStats();
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      await fetchDocs();
      await fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const clearDocuments = async () => {
    try {
      await fetch('/api/clear', { method: 'POST' });
      setDocuments([]);
      setMessages([]);
      await fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(data.results || []);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setShowSettings(false);
    } catch (e) {
      console.error(e);
    }
  };

  const exportMarkdown = () => {
    let content = "# Research Platform Export\\n\\n";
    messages.forEach(msg => {
      content += `## ${msg.role === 'user' ? 'Question' : 'Answer'}\\n${msg.text}\\n\\n`;
      if (msg.sources && msg.sources.length > 0) {
        content += `### Evidence\\n`;
        msg.sources.forEach(s => {
          content += `- [${s.filename}, p.${s.page}] Sim: ${(s.score * 100).toFixed(1)}%\\n  > ${s.text}\\n`;
        });
        content += '\\n';
      }
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = JSON.stringify({
      timestamp: new Date().toISOString(),
      messages
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const modelMsgIdx = messages.length + 1; // tracks position of the model message being streamed
    setMessages(prev => [...prev, { role: 'model', text: '', isStreaming: true, timeline: { parsing: true, chunking: true, embedding: true, search: true, topK: false, retrieved: false, generation: false, verified: false } }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.text }),
      });

      if (!response.ok || !response.body) throw new Error('Network response was not ok');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                done = true;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].isStreaming = false;
                  if (newMessages[newMessages.length - 1].timeline) {
                    newMessages[newMessages.length - 1].timeline!.generation = true;
                    newMessages[newMessages.length - 1].timeline!.verified = true;
                  }
                  return newMessages;
                });
                break;
              }
              try {
                const parsed = JSON.parse(data);
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  
                  if (parsed.error) {
                    lastMsg.text += `\n\n**Error:** ${parsed.error}`;
                  } else if (parsed.type === 'sources') {
                    lastMsg.sources = parsed.sources;
                    if (lastMsg.timeline) {
                      lastMsg.timeline.topK = true;
                      lastMsg.timeline.retrieved = true;
                    }
                  } else if (parsed.type === 'text') {
                    lastMsg.text += parsed.text;
                  } else if (parsed.type === 'confidence') {
                    lastMsg.confidence = parsed.confidence;
                  }
                  return newMessages;
                });
              } catch (e) {
                console.error('Error parsing JSON from stream', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].text = 'Sorry, there was an error processing your request.';
        newMessages[newMessages.length - 1].isStreaming = false;
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      fetchStats();
    }
  };

  const getConfidenceColor = (confidence: string | null | undefined) => {
    if (confidence === 'High') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (confidence === 'Medium') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (confidence === 'Low') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-slate-100 text-slate-800 border-slate-200';
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Left Sidebar: Document Management */}
      <div className="w-full md:w-64 lg:w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 flex-shrink-0">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg text-slate-900 tracking-tight">ResearchPilot</h1>
        </div>
        
        <div 
          className={`p-4 border-b border-slate-200 transition-colors ${isDragging ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Knowledge Base</h2>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={`w-full py-2.5 px-4 border border-dashed rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 ${isDragging ? 'border-indigo-500 text-indigo-700 bg-indigo-100/50' : 'bg-white border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-600'}`}
          >
            {isUploading ? <Clock className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? 'Processing...' : (isDragging ? 'Drop files here' : 'Upload Documents')}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            multiple 
            accept=".pdf,.txt,.docx"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Indexed Files</h3>
            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-medium">{documents.length}</span>
          </div>
          
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No documents uploaded.<br/>Upload PDF, DOCX, or TXT.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm flex items-start gap-3 group">
                  <File className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate" title={doc.filename}>{doc.filename}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{doc.chunkCount} chunks • FAISS indexed</p>
                  </div>
                  <button onClick={() => deleteDocument(doc.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button 
            onClick={() => setShowSearch(true)}
            disabled={documents.length === 0}
            className="w-full py-2 px-4 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-600 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            Search Documents
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-full py-2 px-4 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-600 transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </button>
          {documents.length > 0 && (
            <button 
              onClick={clearDocuments}
              className="w-full py-2 px-4 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-slate-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Knowledge Base
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 relative">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center shadow-sm">
                <Search className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Enterprise AI Research Platform</h2>
                <p className="text-slate-500 mt-2 max-w-md mx-auto">Upload documents to the knowledge base, then ask questions. Answers will be generated securely using Retrieval-Augmented Generation (RAG).</p>
              </div>
              
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mt-8">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Total Documents</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.documentCount}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Pages Processed</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.pagesProcessed}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Vector Chunks</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.chunkCount}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Avg Chunk Size</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgChunkSize} chars</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Avg Retrieval Time</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgRetrievalTime}ms</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left">
                    <p className="text-xs text-slate-500 font-medium uppercase">Avg Sim Score</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{stats.avgSimilarityScore}%</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left col-span-2">
                    <p className="text-xs text-slate-500 font-medium uppercase">Vector Store</p>
                    <p className="text-sm font-semibold text-slate-800 mt-2 truncate" title={stats.vectorDb}>{stats.vectorDb} • {stats.embeddingModel}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 pb-8">
              {messages.map((msg, idx) => (
                <div key={idx} className="flex gap-4">
                  {msg.role === 'user' ? (
                    <div className="w-full flex justify-end gap-4">
                      <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm p-5 shadow-sm">
                        <div className="text-[15px] leading-relaxed">{msg.text}</div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-slate-600" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-white border border-indigo-200 flex items-center justify-center shrink-0 shadow-sm">
                        <Bot className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 space-y-4">
                        
                        {/* Process Timeline */}
                        {msg.timeline && (
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 overflow-x-auto pb-2">
                            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3"/> Upload</span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3"/> Parse & Chunk</span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3"/> Embed</span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className={`flex items-center gap-1 ${msg.timeline.search ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {msg.timeline.search ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>} Vector Search
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className={`flex items-center gap-1 ${msg.timeline.topK ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {msg.timeline.topK ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>} Top-K
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className={`flex items-center gap-1 ${msg.timeline.retrieved ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {msg.timeline.retrieved ? <CheckCircle2 className="w-3 h-3"/> : <Clock className="w-3 h-3"/>} Retrieved
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className={`flex items-center gap-1 ${msg.timeline.generation ? 'text-emerald-600' : (msg.isStreaming ? 'text-indigo-600 animate-pulse' : 'text-slate-400')}`}>
                              {msg.timeline.generation ? <CheckCircle2 className="w-3 h-3"/> : <Bot className="w-3 h-3"/>} Generation
                            </span>
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span className={`flex items-center gap-1 ${msg.timeline.verified ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {msg.timeline.verified ? <CheckCircle2 className="w-3 h-3"/> : <ShieldCheck className="w-3 h-3"/>} Verified
                            </span>
                          </div>
                        )}

                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm overflow-hidden">
                          
                          {/* Answer Panel */}
                          <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" /> Grounded Answer
                              </h3>
                              <div className="flex items-center gap-2">
                                <button onClick={exportMarkdown} className="text-slate-400 hover:text-indigo-600" title="Export Markdown"><Download className="w-4 h-4" /></button>
                                <button onClick={exportJSON} className="text-slate-400 hover:text-indigo-600" title="Export JSON"><FileJson className="w-4 h-4" /></button>
                                {msg.confidence && (
                                  <div className={`px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5 ${getConfidenceColor(msg.confidence)}`}>
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Confidence: {msg.confidence}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="prose prose-slate prose-sm max-w-none markdown-body">
                              {msg.text ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-400 font-medium">
                                  <Clock className="w-4 h-4 animate-spin" /> Synthesizing evidence...
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sources Used Card */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="bg-slate-50 border-b border-slate-100 p-5">
                              <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Database className="w-3.5 h-3.5" /> Sources Used
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(msg.sources.map(s => s.filename))).map(filename => (
                                  <div key={filename} className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
                                    <File className="w-3.5 h-3.5 text-indigo-400" />
                                    {filename}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Retrieved Evidence Collapsible */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="bg-white">
                              <button 
                                onClick={() => setExpandedSources(expandedSources === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Search className="w-4 h-4 text-indigo-500" /> 
                                  View Retrieved Evidence ({msg.sources.length} chunks)
                                </span>
                                {expandedSources === idx ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              </button>
                              
                              {expandedSources === idx && (
                                <div className="p-5 pt-0 border-t border-slate-100 space-y-3 bg-slate-50/50">
                                  {msg.sources.map((source, sIdx) => (
                                    <div key={sIdx} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                          <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">CHUNK {sIdx + 1}</span>
                                          <span className="text-xs font-medium text-slate-600">{source.filename}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Page {source.page}</span>
                                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">Sim: {(source.score * 100).toFixed(1)}%</span>
                                        </div>
                                      </div>
                                      <p className="text-xs text-slate-600 font-mono leading-relaxed bg-slate-50 p-3 rounded-md border border-slate-100">{source.text}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-white border-t border-slate-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={documents.length === 0 ? "Upload documents to start asking questions..." : "Ask a research question based on uploaded documents..."}
                disabled={documents.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-5 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none text-sm text-slate-800 shadow-inner min-h-[60px] max-h-40 disabled:opacity-50 disabled:bg-slate-100"
                rows={1}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || documents.length === 0}
                className="absolute right-2 bottom-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="text-center mt-3 flex items-center justify-center gap-1.5 text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Responses are strictly generated from retrieved document context using Gemini.</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Top-K Retrieval</label>
                <input type="number" min="1" max="20" value={settings.topK} onChange={e => setSettings({...settings, topK: parseInt(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chunk Size (chars)</label>
                <input type="number" min="100" max="4000" step="100" value={settings.chunkSize} onChange={e => setSettings({...settings, chunkSize: parseInt(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Chunk Overlap (chars)</label>
                <input type="number" min="0" max="1000" step="50" value={settings.chunkOverlap} onChange={e => setSettings({...settings, chunkOverlap: parseInt(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Similarity Threshold</label>
                <input type="number" min="0" max="1" step="0.05" value={settings.similarityThreshold} onChange={e => setSettings({...settings, similarityThreshold: parseFloat(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temperature</label>
                <input type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => setSettings({...settings, temperature: parseFloat(e.target.value)})} className="w-full border rounded-lg p-2 text-sm" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowSettings(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-16">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-200">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                    placeholder="Search raw documents directly (bypasses LLM)..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
                >
                  {isSearching ? <Clock className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
                <button type="button" onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); setSearchError(''); }} className="p-2 text-slate-400 hover:text-slate-600">&times;</button>
              </form>
              {searchError && (
                <p className="mt-2 text-sm text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {searchError}
                </p>
              )}
            </div>
            <div className="overflow-y-auto p-4 space-y-4 flex-1 bg-slate-50">
              {searchResults.length === 0 && !isSearching ? (
                <div className="text-center text-slate-500 py-8">
                  {searchQuery ? 'No results found. Try a different query.' : 'Type a query and press Search or Enter.'}
                </div>
              ) : (
                searchResults.map((res, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-indigo-700 flex items-center gap-1"><File className="w-4 h-4"/> {res.filename} (Page {res.page})</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Sim: {(res.score * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded font-mono leading-relaxed">{res.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

