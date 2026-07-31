import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';

export default function ChatContainer({ messages, isStreaming }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-area">
      {messages.length === 0 && (
        <div style={{textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem'}}>
          Hi! I'm an AI assistant trained on Mohd Fazil's resume. How can I help you today?
        </div>
      )}
      {messages.map((msg, idx) => (
        <div key={idx} className={`message-wrapper ${msg.role}`}>
          <div className={`message ${msg.role}`}>
            {msg.role === 'assistant' ? (
               <Markdown>{msg.content || (isStreaming && idx === messages.length - 1 ? '...' : '')}</Markdown>
            ) : (
               <p>{msg.content}</p>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
