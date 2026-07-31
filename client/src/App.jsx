import { useState, useEffect, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import ChatContainer from './components/ChatContainer';
import InputArea from './components/InputArea';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.body.className = savedTheme;
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.body.className = newTheme;
  };

  useEffect(() => {
    // Fetch initial history
    fetch('https://fazil-ai-chatboat-01.onrender.com/api/history')
      .then(res => res.json())
      .then(data => {
        setMessages(data);
      })
      .catch(err => {
        console.error("Failed to fetch history:", err);
        setError("Could not load chat history. Ensure the server is running.");
      });
  }, []);

  const handleSendMessage = async (text, file) => {
    if (!text.trim() && !file) return;

    const userMessage = { role: 'user', content: text };
    if (file) {
      userMessage.content += ` (Attached JD: ${file.name})`;
    }

    setMessages(prev => [...prev, userMessage, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('message', text);
      formData.append('history', JSON.stringify(messages));
      
      if (file) {
        formData.append('file', file);
      }

      const response = await fetch('https://fazil-ai-chatboat-01.onrender.com/api/chat', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.error) {
                     setError(parsed.error);
                     break;
                  }
                  if (parsed.content) {
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = { ...newMessages[newMessages.length - 1] };
                      if (lastMessage.role === 'assistant') {
                        lastMessage.content += parsed.content;
                      }
                      newMessages[newMessages.length - 1] = lastMessage;
                      return newMessages;
                    });
                  }
                } catch (e) {
                  console.error("Error parsing SSE JSON", e, dataStr);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the server.");
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Fazil's Resume Assistant</h1>
            <p>Ask me anything about Fazil, or paste a Job Description to see if he's a fit.</p>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle Theme">
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
        {error && <p style={{color: 'red', marginTop: '0.5rem'}}>{error}</p>}
      </header>

      <ChatContainer messages={messages} isStreaming={isStreaming} />
      <InputArea onSendMessage={handleSendMessage} disabled={isStreaming} />
    </div>
  );
}

export default App;
