import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { io, Socket } from 'socket.io-client';
import { useGetAdminChatListQuery, ChatMessage, AdminChatListResponse } from '@/services/chatApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { PaperAirplaneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { api } from '@/services/api'; // Trả fetcher cho REST methods nếu cần
import { useDispatch } from 'react-redux';

// Socket URL
const SOCKET_URL = 'http://localhost:8888';

const SupportDashboard: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<AdminChatListResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatList, setChatList] = useState<AdminChatListResponse[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();

  const { user } = useSelector((state: RootState) => state.auth);

  // Fetch admin list
  const { data: listData, isLoading: isListLoading, refetch: refetchList } = useGetAdminChatListQuery();

  useEffect(() => {
    if (listData?.data) {
      setChatList(listData.data);
    }
  }, [listData]);

  // Fetch active user messages
  const fetchMessages = async (identifier: string) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/chat/${identifier}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }).then(r => r.json());
      if (res.status === 'success') {
        setMessages(res.data);
        refetchList();
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.sessionId || selectedUser.userId);
    } else {
      setMessages([]);
    }
  }, [selectedUser]);

  const selectedUserRef = useRef<AdminChatListResponse | null>(null);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Connect socket ONCE on mount
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.on('connect', () => {
      socketRef.current?.emit('adminJoin');
      socketRef.current?.emit('getOnlineUsers');
    });

    socketRef.current.on('messageRecieved', (msg: ChatMessage) => {
      const currentSelected = selectedUserRef.current;
      if (currentSelected && (msg.sessionId === currentSelected.sessionId || (msg.userId && msg.userId === currentSelected.userId))) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some(m => m.id === msg.id)) return prev;
          
          // Filter out optimistic temp message with same content
          if (msg.isFromAdmin) {
            const filtered = prev.filter(m => !(m.id.startsWith('temp_') && m.content === msg.content));
            return [...filtered, msg];
          }
          return [...prev, msg];
        });

        // Notify server that we've read this incoming message since we're already active in this chat
        const identifier = currentSelected.sessionId || currentSelected.userId;
        fetch(`${SOCKET_URL}/api/chat/read/${identifier}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }).then(() => refetchList());
      } else {
        refetchList();
      }
    });

    socketRef.current.on('onlineUsersList', (users: string[]) => {
      setOnlineUsers(users);
    });

    socketRef.current.on('userStatusChanged', ({ id, status }) => {
      setOnlineUsers(prev => {
        if (status === 'online') {
          return Array.from(new Set([...prev, id]));
        } else {
          return prev.filter(uid => uid !== id);
        }
      });
    });

    socketRef.current.on('userTyping', ({ id }) => {
      setTypingUsers(prev => Array.from(new Set([...prev, id])));
    });

    socketRef.current.on('userStopTyping', ({ id }) => {
      setTypingUsers(prev => prev.filter(uid => uid !== id));
    });

    socketRef.current.on('newChatAlert', () => {
      refetchList();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [refetchList]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleTyping = () => {
    if (!socketRef.current || !selectedUser) return;

    socketRef.current.emit('typing', { targetId: selectedUser.sessionId || selectedUser.userId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stopTyping', { targetId: selectedUser.sessionId || selectedUser.userId });
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !socketRef.current) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socketRef.current.emit('stopTyping', { targetId: selectedUser.sessionId || selectedUser.userId });
    }

    const content = newMessage.trim();
    const messageData = {
      userId: selectedUser.userId,
      sessionId: selectedUser.sessionId,
      senderId: user?.id,
      content: content,
      isFromAdmin: true,
    };

    // Optimistic Update
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      ...messageData,
      createdAt: new Date().toISOString(),
      isRead: false,
    } as any;

    setMessages(prev => [...prev, optimisticMessage]);

    socketRef.current.emit('sendMessage', messageData);
    setNewMessage('');
  };

  if (isListLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-neutral-200 dark:border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-primary-500" />
            Hỗ trợ khách hàng
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatList.length === 0 ? (
            <p className="p-4 text-center text-neutral-400 text-sm">Chưa có người nhắn tin</p>
          ) : (
            chatList.map((item) => {
              const isOnline = onlineUsers.includes(item.sessionId) || onlineUsers.includes(item.userId);
              return (
                <button
                  key={item.sessionId || item.userId}
                  onClick={() => setSelectedUser(item)}
                  className={`w-full p-4 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${(selectedUser?.sessionId === item.sessionId && item.sessionId) || (selectedUser?.userId === item.userId && !item.sessionId) ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="bg-neutral-200 dark:bg-neutral-700 h-10 w-10 rounded-full flex items-center justify-center font-bold text-neutral-600 dark:text-neutral-300">
                        {item.user?.firstName?.[0] || 'G'}
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></span>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm">
                        {item.user ? `${item.user.firstName} ${item.user.lastName}` : `Khách (${item.sessionId.substring(0, 5)})`}
                      </p>
                      <p className="text-xs text-neutral-500 truncate max-w-[150px]">{item.lastMessage}</p>
                    </div>
                  </div>
                  {item.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {item.unreadCount}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>


      {/* Main Chat Box area */}
      <div className="w-2/3 flex flex-col bg-neutral-50 dark:bg-zinc-900/20">
        {selectedUser ? (
          <>
            {/* Upper Info */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 h-10 w-10 rounded-full flex items-center justify-center font-bold">
                  {selectedUser.user?.firstName?.[0] || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-100">
                    {selectedUser.user ? `${selectedUser.user.firstName} ${selectedUser.user.lastName}` : 'Anonymous'}
                  </p>
                  <p className="text-xs text-neutral-400">{selectedUser.user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${(onlineUsers.includes(selectedUser.sessionId) || onlineUsers.includes(selectedUser.userId)) ? 'bg-green-500' : 'bg-neutral-300'}`}></div>
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {(onlineUsers.includes(selectedUser.sessionId) || onlineUsers.includes(selectedUser.userId)) ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
              {messages.map((msg, idx) => {
                const isMe = msg.isFromAdmin;
                return (
                  <div key={msg.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl text-sm ${isMe
                        ? 'bg-primary-600 text-white rounded-br-none'
                        : 'bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-none shadow-sm border border-neutral-100 dark:border-neutral-800'
                        }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef}></div>
            </div>

            {/* Typing Indicator */}
            {(typingUsers.includes(selectedUser.sessionId) || typingUsers.includes(selectedUser.userId)) && (
              <div className="px-4 py-2 text-xs text-neutral-400 italic bg-white dark:bg-neutral-900 flex items-center gap-1">
                <div className="flex gap-1">
                  <span className="h-1 w-1 bg-neutral-400 rounded-full animate-bounce"></span>
                  <span className="h-1 w-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="h-1 w-1 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                Người dùng đang soạn tin...
              </div>
            )}

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.currentTarget.value);
                  handleTyping();
                }}
                placeholder="Nhập câu trả lời..."
                className="flex-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-xl disabled:opacity-50 transition-colors"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-neutral-400">
            <EnvelopeIcon className="h-16 w-16 mb-2 opacity-30" />
            <p className="text-sm">Chọn một cuộc trò chuyện để bắt đầu</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportDashboard;
