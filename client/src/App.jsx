import { useState, useEffect } from 'react';
import { Sun, Moon, UserCircle2 } from 'lucide-react';
import ChatContainer from './components/ChatContainer';
import InputArea from './components/InputArea';
import './App.css';

const SERVER = 'https://fazil-ai-chatboat-01.onrender.com';

// ── Session helpers (all stored in localStorage) ─────────────────────────────
function getSessionId() {
  let id = localStorage.getItem('session_id');
  if (!id) {
    id = 'hr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    localStorage.setItem('session_id', id);
  }
  return id;
}

function loadLocalHistory(sessionId) {
  try {
    const raw = localStorage.getItem(`chat_${sessionId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocalHistory(sessionId, messages) {
  // Only save real user/assistant messages (not the local greeting)
  const toSave = messages.filter(m => m.role === 'user' || m.role === 'assistant');
  localStorage.setItem(`chat_${sessionId}`, JSON.stringify(toSave));
}

// ── Welcome Modal ─────────────────────────────────────────────────────────────
function WelcomeModal({ onStart }) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onStart(name.trim(), company.trim());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-icon"><UserCircle2 size={40} /></div>
        <h2>Welcome to Fazil's Resume Assistant</h2>
        <p>Please introduce yourself before we begin.</p>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="hr-name">Your Name *</label>
            <input id="hr-name" type="text" placeholder="e.g. Priya Sharma"
              value={name} onChange={e => setName(e.target.value)} autoFocus required />
          </div>
          <div className="modal-field">
            <label htmlFor="hr-company">Company (optional)</label>
            <input id="hr-company" type="text" placeholder="e.g. Google, Infosys..."
              value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <button type="submit" className="modal-btn" disabled={!name.trim()}>
            Start Chat →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [sessionId]    = useState(getSessionId);
  const [hrName, setHrName]     = useState(() => localStorage.getItem('hr_name') || null);
  const [hrCompany]    = useState(() => localStorage.getItem('hr_company') || '');
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]       = useState(null);
  const [theme, setTheme]       = useState(() => localStorage.getItem('theme') || 'light');

  // Apply theme on mount + change
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Load history from localStorage once HR is known
  useEffect(() => {
    if (!hrName) return;
    const history = loadLocalHistory(sessionId);
    if (history.length > 0) {
      setMessages(history);
    } else {
      // Fresh session — show greeting
      const greeting = hrCompany
        ? `Hi ${hrName} from ${hrCompany}! 👋 Ask me anything about Fazil's skills, experience, or projects — or upload a JD to check his fit.`
        : `Hi ${hrName}! 👋 Ask me anything about Fazil's skills, experience, or projects — or upload a JD to check his fit.`;
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [hrName]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('theme', next);
  };

  const handleWelcomeStart = (name, company) => {
    // New HR → brand-new session ID so history is completely isolated
    const newId = 'hr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    localStorage.setItem('session_id', newId);
    localStorage.setItem('hr_name', name);
    if (company) localStorage.setItem('hr_company', company);
    else localStorage.removeItem('hr_company');
    window.location.reload();
  };

  const updateMessages = (updater) => {
    setMessages(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Persist to localStorage (exclude the static greeting bubble)
      const toSave = next.filter(m => m._saved !== false);
      saveLocalHistory(sessionId, toSave);
      return next;
    });
  };

  const handleSendMessage = async (text, file) => {
    if (!text.trim() && !file) return;

    const userMessage = { role: 'user', content: text };
    if (file) userMessage.content += ` (Attached JD: ${file.name})`;

    // Add user msg + empty assistant placeholder
    setMessages(prev => {
      const next = [...prev, userMessage, { role: 'assistant', content: '' }];
      return next;
    });
    setIsStreaming(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('message', text);
      // Send only actual chat history (not the static greeting)
      const historyToSend = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      formData.append('history', JSON.stringify(historyToSend));
      if (file) formData.append('file', file);

      const response = await fetch(`${SERVER}/api/chat`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Server ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let fullAssistantContent = '';

      while (!done) {
        const { value, done: rd } = await reader.read();
        done = rd;
        if (!value) continue;

        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break; }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { setError(parsed.error); break; }
            if (parsed.content) {
              fullAssistantContent += parsed.content;
              setMessages(prev => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                if (last.role === 'assistant') last.content += parsed.content;
                next[next.length - 1] = last;
                return next;
              });
            }
          } catch {}
        }
      }

      // Save completed exchange to localStorage
      setMessages(prev => {
        saveLocalHistory(sessionId, prev.filter(m => m.role === 'user' || m.role === 'assistant'));
        return prev;
      });

    } catch (err) {
      console.error(err);
      setError('Failed to reach the server. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <>
      {!hrName && <WelcomeModal onStart={handleWelcomeStart} />}
      <div className="app-container">
        <header className="header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Fazil's Resume Assistant</h1>
              {hrName && <p>Hi <strong>{hrName}</strong> — ask me anything, or upload a JD to check Fazil's fit.</p>}
            </div>
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
          {error && <p style={{ color: 'red', marginTop: '0.5rem', fontSize: '0.85rem' }}>{error}</p>}
        </header>

        <ChatContainer messages={messages} isStreaming={isStreaming} />
        <InputArea onSendMessage={handleSendMessage} disabled={isStreaming || !hrName} />
      </div>
    </>
  );
}

export default App;
