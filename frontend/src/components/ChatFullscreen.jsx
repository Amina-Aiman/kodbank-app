import { useState, useEffect, useCallback } from 'react';
import ChatAI from '../pages/ChatAI';

const SESSIONS_KEY = 'kodbank_chat_sessions';

const IconNewChat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
);
const IconPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7H9z" /></svg>
);
const IconUnpin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 17 2-2 2 2M12 5v5l-2 2-2-2" /><path d="M5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7H9v3.76a2 2 0 0 1-1.11 1.79L6.11 13.45A2 2 0 0 0 5 15.24Z" /></svg>
);
const IconRename = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const IconDelete = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
);
const IconMore = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
);

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return { nextId: 1, sessions: [] };
    const data = JSON.parse(raw);
    return {
      nextId: typeof data.nextId === 'number' ? data.nextId : 1,
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
  } catch {
    return { nextId: 1, sessions: [] };
  }
}

function saveSessions(nextId, sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify({ nextId, sessions }));
  } catch (_) {}
}

function truncateTitle(str, max = 36) {
  if (!str || typeof str !== 'string') return 'New chat';
  const t = str.trim();
  return t.length <= max ? t : t.slice(0, max) + '...';
}

export default function ChatFullscreen() {
  const [data, setData] = useState(loadSessions);
  const [currentId, setCurrentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenuId, setContextMenuId] = useState(null);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const sessions = data.sessions;
  const nextId = data.nextId;

  const save = useCallback((newNextId, newSessions) => {
    setData({ nextId: newNextId, sessions: newSessions });
    saveSessions(newNextId, newSessions);
  }, []);

  const currentSession = currentId ? sessions.find((s) => s.id === currentId) : null;
  const filteredSessions = searchQuery.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : sessions;
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (new Date(b.updatedAt || b.createdAt) || 0) - (new Date(a.updatedAt || a.createdAt) || 0);
  });

  useEffect(() => {
    const handleClick = () => setContextMenuId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  function handleNewChat() {
    setCurrentId(null);
    setContextMenuId(null);
  }

  function handleSelectSession(id) {
    setCurrentId(id);
    setContextMenuId(null);
  }

  function handleMessagesChange(id, messages) {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const title = session.title === 'New chat' && messages.length > 0
      ? truncateTitle(messages.find((m) => m.role === 'user')?.content || 'New chat')
      : session.title;
    const next = sessions.map((s) =>
      s.id === id ? { ...s, messages, title, updatedAt: new Date().toISOString() } : s
    );
    save(nextId, next);
  }

  function handleFirstMessage(id, messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    const title = truncateTitle(firstUser?.content || 'New chat');
    const newSession = {
      id: String(id),
      title,
      messages,
      pinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [newSession, ...sessions];
    save(nextId + 1, next);
    setCurrentId(String(id));
  }

  function createNewSessionAndSend(initialMessages) {
    const id = String(nextId);
    handleFirstMessage(nextId, initialMessages);
    return id;
  }

  function togglePin(id) {
    const next = sessions.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s));
    save(nextId, next);
    setContextMenuId(null);
  }

  function renameSession(id, newTitle) {
    const next = sessions.map((s) => (s.id === id ? { ...s, title: newTitle.trim() || s.title } : s));
    save(nextId, next);
    setRenameId(null);
    setRenameValue('');
    setContextMenuId(null);
  }

  function deleteSession(id) {
    const next = sessions.filter((s) => s.id !== id);
    save(nextId, next);
    if (currentId === id) setCurrentId(next[0]?.id ?? null);
    setContextMenuId(null);
  }

  const messagesForCurrent = currentId ? (currentSession?.messages ?? []) : [];
  const isNewChat = !currentId;

  return (
    <div className="chat-fullscreen-chatgpt">
      <aside className="chat-fullscreen-sidebar">
        <button type="button" className="chat-fullscreen-new-chat" onClick={handleNewChat}>
          <IconNewChat />
          <span>New chat</span>
        </button>
        <div className="chat-fullscreen-search-wrap">
          <IconSearch />
          <input
            type="text"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="chat-fullscreen-search-input"
          />
        </div>
        <div className="chat-fullscreen-your-chats">
          <div className="chat-fullscreen-your-chats-title">Your chats</div>
          <div className="chat-fullscreen-chat-list">
            {sortedSessions.length === 0 && !isNewChat && (
              <p className="chat-fullscreen-empty">No chats yet. Start a conversation.</p>
            )}
            {sortedSessions.map((s) => (
              <div
                key={s.id}
                className={`chat-fullscreen-chat-item ${currentId === s.id ? 'active' : ''} ${s.pinned ? 'pinned' : ''}`}
                onClick={() => handleSelectSession(s.id)}
              >
                <span className="chat-fullscreen-chat-item-title">{truncateTitle(s.title, 28)}</span>
                <button
                  type="button"
                  className="chat-fullscreen-chat-item-more"
                  onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === s.id ? null : s.id); }}
                  aria-label="Options"
                >
                  <IconMore />
                </button>
                {contextMenuId === s.id && (
                  <div className="chat-fullscreen-context-menu" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { setRenameId(s.id); setRenameValue(s.title); setContextMenuId(null); }}>
                      <IconRename />
                      Rename
                    </button>
                    <button type="button" onClick={() => togglePin(s.id)}>
                      {s.pinned ? <IconUnpin /> : <IconPin />}
                      {s.pinned ? 'Unpin chat' : 'Pin chat'}
                    </button>
                    <button type="button" className="chat-fullscreen-context-delete" onClick={() => deleteSession(s.id)}>
                      <IconDelete />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="chat-fullscreen-main">
        <ChatAI
          embedded
          key={currentId ?? 'new'}
          controlledMessages={isNewChat ? [] : messagesForCurrent}
          onMessagesChange={isNewChat ? undefined : (msgs) => handleMessagesChange(currentId, msgs)}
          onFirstMessage={isNewChat ? (msgs) => createNewSessionAndSend(msgs) : undefined}
        />
      </div>
      {renameId && (
        <div className="chat-fullscreen-rename-overlay" onClick={() => setRenameId(null)}>
          <div className="chat-fullscreen-rename-modal" onClick={(e) => e.stopPropagation()}>
            <label>Rename chat</label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') renameSession(renameId, renameValue); if (e.key === 'Escape') setRenameId(null); }}
              autoFocus
            />
            <div className="chat-fullscreen-rename-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRenameId(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => renameSession(renameId, renameValue)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
