import { useState, useRef, useEffect } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

export default function InputArea({ onSendMessage, disabled }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleSubmit = () => {
    if ((!text.trim() && !file) || disabled) return;
    onSendMessage(text, file);
    setText('');
    setFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isAllowed = selectedFile.type === 'application/pdf' || 
                        selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                        selectedFile.name.endsWith('.pdf') || 
                        selectedFile.name.endsWith('.docx');
      if (isAllowed) {
        setFile(selectedFile);
      } else {
        alert("Please upload a .pdf or .docx file.");
      }
    }
    e.target.value = ''; // Reset input
  };

  return (
    <div className="input-container">
      <div className="input-box">
        {file && (
          <div className="file-chip">
            <span style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {file.name}
            </span>
            <button onClick={() => setFile(null)} aria-label="Remove file">
              <X size={14} />
            </button>
          </div>
        )}
        
        <div className="input-row">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <button 
            className="icon-btn" 
            onClick={() => fileInputRef.current?.click()}
            title="Attach Job Description (.pdf or .docx)"
            disabled={disabled}
          >
            <Paperclip size={20} />
          </button>
          
          <textarea
            ref={textareaRef}
            className="textarea"
            placeholder="Ask a question or paste a Job Description..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
          
          <button 
            className="icon-btn send-btn" 
            onClick={handleSubmit}
            disabled={disabled || (!text.trim() && !file)}
          >
            {disabled ? (
              <div className="loading-dots">
                <div />
                <div />
                <div />
              </div>
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
