import { useState, useRef, useEffect } from 'react';
import { sendAIChat } from '../api';

const HF_TOKEN_URL = 'https://huggingface.co/settings/tokens';
const FIX_STEPS = [
  'Go to ' + HF_TOKEN_URL,
  'Create a new token and enable "Make calls to Inference Providers"',
  'Open backend/.env and set: HUGGINGFACE_API_KEY=your_token_here',
  'Restart the backend (stop with Ctrl+C, then run: node server.js from the backend folder)',
];

const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconMic = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </svg>
);
const IconMicOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="9" y1="22" x2="15" y2="22" />
  </svg>
);
const IconCloseChip = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

const STORAGE_KEY = 'kodbank_chat_messages';

function loadStoredMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (_) {}
}

const SpeechRecognitionAPI = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function ChatAI({
  embedded = false,
  controlledMessages,
  onMessagesChange,
  onFirstMessage,
}) {
  const isControlled = Array.isArray(controlledMessages);
  const isNewChatWithFirstMessage = isControlled && controlledMessages.length === 0 && typeof onFirstMessage === 'function';

  const [standaloneMessages, setStandaloneMessages] = useState(loadStoredMessages);
  const [draftMessages, setDraftMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [listening, setListening] = useState(false);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const messages = isNewChatWithFirstMessage ? draftMessages : isControlled ? controlledMessages : standaloneMessages;
  const setMessages = isNewChatWithFirstMessage
    ? setDraftMessages
    : isControlled
      ? (updater) => {
          const next = typeof updater === 'function' ? updater(controlledMessages) : updater;
          onMessagesChange?.(next);
        }
      : setStandaloneMessages;

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!isControlled && !isNewChatWithFirstMessage) saveStoredMessages(standaloneMessages);
  }, [isControlled, isNewChatWithFirstMessage, standaloneMessages]);

  function startNewChat() {
    if (isControlled) return;
    setMessages([]);
    setInput('');
    setError('');
    setAttachments([]);
    saveStoredMessages([]);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!SpeechRecognitionAPI || !listening) return;
    const rec = new SpeechRecognitionAPI();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      const last = e.results.length - 1;
      const transcript = Array.from(e.results[last]).map((r) => r.transcript).join('');
      if (e.results[last].isFinal && transcript.trim()) setInput((prev) => (prev ? prev + ' ' + transcript : transcript).trim());
    };
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch (_) {}
      recognitionRef.current = null;
    };
  }, [listening]);

  function toggleMic() {
    if (!SpeechRecognitionAPI) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    setListening((l) => !l);
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files.map((f) => ({ file: f, name: f.name }))]);
    e.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;

    const attachmentNote = attachments.length > 0
      ? `\n[Attached: ${attachments.map((a) => a.name).join(', ')}]`
      : '';
    const fullText = text + attachmentNote;

    setError('');
    setInput('');
    setAttachments([]);
    setMessages((prev) => [...prev, { role: 'user', content: fullText }]);
    setLoading(true);

    const history = messages;
    try {
      const { reply } = await sendAIChat(fullText, history);
      const next = [...messages, { role: 'user', content: fullText }, { role: 'assistant', content: reply }];
      setMessages(next);

      if (isNewChatWithFirstMessage && typeof onFirstMessage === 'function') {
        onFirstMessage(next);
      }
    } catch (err) {
      setError(err.message || 'Failed to get AI response.');
      setMessages((prev) => [...prev, { role: 'assistant', content: null, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  const hasMessages = messages.length > 0;

  const mainContent = (
    <main className={`chat-gpt-main ${embedded ? 'chat-gpt-main-embedded' : ''}`}>
      {error && (
        <div className="chat-gpt-error-wrap">
          <div className="error-msg">{error}</div>
          <div className="chat-fix-card">
            <strong>How to fix Chat with AI</strong>
            <ol>
              {FIX_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <a href={HF_TOKEN_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open Hugging Face token page</a>
          </div>
        </div>
      )}

      <div className={`chat-gpt-messages-wrap ${hasMessages ? 'has-messages' : ''}`} ref={listRef}>
        {!hasMessages && !loading && (
          <div className="chat-gpt-welcome">
            <h2 className="chat-gpt-welcome-title">What can I help with?</h2>
          </div>
        )}
        {hasMessages && (
          <div className="chat-gpt-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-gpt-msg chat-gpt-msg-${m.role} chat-msg-fade-in`}>
                <span className="chat-gpt-msg-label">{m.role === 'user' ? 'You' : 'AI'}</span>
                <div className="chat-gpt-msg-content">
                  {m.error ? 'Something went wrong. Please try again.' : m.content}
                </div>
              </div>
            ))}
          </div>
        )}
        {loading && (
          <div className="chat-gpt-msg chat-gpt-msg-assistant chat-msg-fade-in">
            <span className="chat-gpt-msg-label">AI</span>
            <div className="chat-gpt-msg-content chat-typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="chat-gpt-input-wrap">
        {attachments.length > 0 && (
          <div className="chat-gpt-attachments">
            {attachments.map((a, i) => (
              <span key={i} className="chat-gpt-attach-chip">
                <span className="chat-gpt-attach-chip-name">{a.name}</span>
                <button type="button" className="chat-gpt-attach-chip-remove" onClick={() => removeAttachment(i)} aria-label="Remove">
                  <IconCloseChip />
                </button>
              </span>
            ))}
          </div>
        )}
        <form onSubmit={handleSubmit} className="chat-gpt-form">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={onFileChange}
            className="chat-gpt-file-input"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            className="chat-gpt-input-add"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files or images"
            title="Attach files or images"
          >
            <IconPlus />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything"
            disabled={loading}
            autoComplete="off"
            className="chat-gpt-input"
            aria-busy={loading}
          />
          {SpeechRecognitionAPI && (
            <button
              type="button"
              className={`chat-gpt-mic ${listening ? 'chat-gpt-mic-active' : ''}`}
              onClick={toggleMic}
              aria-label={listening ? 'Stop recording' : 'Voice input'}
              title={listening ? 'Stop recording' : 'Voice input'}
            >
              {listening ? <IconMicOff /> : <IconMic />}
            </button>
          )}
          <button type="submit" className="chat-gpt-send" disabled={loading || (!input.trim() && attachments.length === 0)} aria-label="Send" aria-disabled={loading}>
            <IconSend />
          </button>
        </form>
      </div>
    </main>
  );

  if (embedded) return <div className="chat-gpt-embedded">{mainContent}</div>;

  return (
    <div className="chat-gpt-layout">
      <aside className="chat-gpt-sidebar">
        <button type="button" className="chat-gpt-new-chat" onClick={startNewChat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          <span>New chat</span>
        </button>
        <div className="chat-gpt-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <span>Search chats</span>
        </div>
        <div className="chat-gpt-your-chats">
          <div className="chat-gpt-your-chats-title">Your chats</div>
          {!hasMessages && (
            <p className="chat-gpt-your-chats-empty">Start a conversation to see it here.</p>
          )}
          {hasMessages && (
            <div className="chat-gpt-your-chats-item chat-gpt-your-chats-item-active">
              Current conversation
            </div>
          )}
        </div>
      </aside>
      {mainContent}
    </div>
  );
}
