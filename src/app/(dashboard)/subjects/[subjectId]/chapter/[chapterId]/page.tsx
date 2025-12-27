'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Topic {
  id: string;
  name: string;
  order_index: number;
  content: string;
  completed: boolean;
}

interface Chapter {
  id: string;
  name: string;
  chapter_number: number;
  description: string;
  subject_name: string;
  subject_icon: string;
  topics: Topic[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChapterPage() {
  const params = useParams();
  const router = useRouter();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'read' | 'learn' | 'practice' | 'quiz'>('read');
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChapterData();
  }, [params.chapterId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchChapterData = async () => {
    try {
      const res = await fetch(`/api/curriculum?chapterId=${params.chapterId}`);
      const data = await res.json();
      setChapter(data.chapter);
      if (data.chapter?.topics?.length > 0) {
        setActiveTopic(data.chapter.topics[0].id);
      }
    } catch (error) {
      console.error('Error fetching chapter:', error);
      const mock = getMockChapter();
      setChapter(mock);
      if (mock.topics.length > 0) {
        setActiveTopic(mock.topics[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  const getMockChapter = (): Chapter => ({
    id: params.chapterId as string,
    name: 'Fractions',
    chapter_number: 7,
    description: 'Understanding and operating with fractions',
    subject_name: 'Mathematics',
    subject_icon: '📐',
    topics: [
      {
        id: '1',
        name: 'What is a Fraction?',
        order_index: 1,
        completed: true,
        content: `# What is a Fraction?

A **fraction** represents a part of a whole. When you cut a pizza into 4 equal slices and take 1 slice, you have **1/4** (one-fourth) of the pizza!

## Parts of a Fraction

Every fraction has two parts:

- **Numerator** (top number): How many parts we have
- **Denominator** (bottom number): How many equal parts the whole is divided into

### Example
In the fraction **3/4**:
- 3 is the numerator (we have 3 parts)
- 4 is the denominator (the whole is divided into 4 parts)

## Real-Life Examples

1. 🍕 Half a pizza = **1/2**
2. 🍫 3 pieces of a chocolate bar divided into 6 = **3/6** = **1/2**
3. ⏰ 15 minutes of an hour = **15/60** = **1/4**

> 💡 **Remember:** The denominator can never be zero! You cannot divide something into zero parts.`
      },
      {
        id: '2',
        name: 'Types of Fractions',
        order_index: 2,
        completed: true,
        content: `# Types of Fractions

Fractions come in different types based on the relationship between numerator and denominator.

## 1. Proper Fractions

When the numerator is **less than** the denominator.

**Examples:** 1/2, 3/4, 5/8, 2/7

These fractions are always less than 1.

## 2. Improper Fractions

When the numerator is **greater than or equal to** the denominator.

**Examples:** 5/3, 7/4, 9/5, 4/4

These fractions are equal to or greater than 1.

## 3. Mixed Numbers

A whole number combined with a proper fraction.

**Examples:** 2½, 3¼, 5⅔

### Converting Improper to Mixed

To convert **7/4** to a mixed number:
1. Divide 7 ÷ 4 = 1 remainder 3
2. Write as: 1¾

## 4. Unit Fractions

Fractions with numerator = 1.

**Examples:** 1/2, 1/3, 1/4, 1/5`
      },
      {
        id: '3',
        name: 'Equivalent Fractions',
        order_index: 3,
        completed: false,
        content: `# Equivalent Fractions

**Equivalent fractions** are different fractions that represent the same value.

## The Key Rule

When you multiply or divide both the numerator and denominator by the same number, you get an equivalent fraction.

### Example 1: Creating Equivalent Fractions

Starting with **1/2**:
- 1/2 × 2/2 = **2/4** ✓
- 1/2 × 3/3 = **3/6** ✓
- 1/2 × 4/4 = **4/8** ✓

All these fractions equal **1/2**!

### Example 2: Simplifying Fractions

Starting with **6/8**:
- 6/8 ÷ 2/2 = **3/4** ✓

This is the **simplest form** (cannot be simplified further).

## How to Check if Fractions are Equivalent

**Cross multiply!**

Are 2/3 and 4/6 equivalent?
- 2 × 6 = 12
- 3 × 4 = 12

Since both products are equal, yes they are equivalent! ✓`
      },
      {
        id: '4',
        name: 'Comparing Fractions',
        order_index: 4,
        completed: false,
        content: `# Comparing Fractions

To compare fractions, we need to determine which is larger or if they're equal.

## Method 1: Same Denominator

When denominators are the same, just compare numerators!

**Example:** Compare 3/7 and 5/7
- Both have denominator 7
- 5 > 3, so **5/7 > 3/7** ✓

## Method 2: Same Numerator

When numerators are the same, the fraction with the **smaller** denominator is larger!

**Example:** Compare 3/4 and 3/8
- Both have numerator 3
- 4 < 8, so **3/4 > 3/8** ✓

> 💡 Think about it: Would you rather have 3 slices of a pizza cut into 4 pieces, or 3 slices of a pizza cut into 8 pieces?

## Method 3: Cross Multiplication

For any two fractions:

**Compare 2/3 and 3/5:**
1. Multiply: 2 × 5 = 10
2. Multiply: 3 × 3 = 9
3. Since 10 > 9, **2/3 > 3/5** ✓

## Method 4: Convert to Same Denominator

**Compare 2/3 and 3/4:**
1. LCM of 3 and 4 = 12
2. 2/3 = 8/12
3. 3/4 = 9/12
4. Since 9 > 8, **3/4 > 2/3** ✓`
      },
      {
        id: '5',
        name: 'Adding and Subtracting Fractions',
        order_index: 5,
        completed: false,
        content: `# Adding and Subtracting Fractions

## Same Denominator

When denominators are the same, just add/subtract the numerators!

### Addition
**2/5 + 1/5 = ?**
- Add numerators: 2 + 1 = 3
- Keep denominator: 5
- Answer: **3/5** ✓

### Subtraction
**4/7 - 2/7 = ?**
- Subtract numerators: 4 - 2 = 2
- Keep denominator: 7
- Answer: **2/7** ✓

## Different Denominators

First, find a common denominator (LCM)!

### Example: 1/3 + 1/4 = ?

**Step 1:** Find LCM of 3 and 4 = 12

**Step 2:** Convert fractions
- 1/3 = 4/12 (multiply by 4/4)
- 1/4 = 3/12 (multiply by 3/3)

**Step 3:** Add
- 4/12 + 3/12 = **7/12** ✓

## Practice Problem

**Solve: 2/3 - 1/6 = ?**

1. LCM of 3 and 6 = 6
2. 2/3 = 4/6
3. 4/6 - 1/6 = **3/6 = 1/2** ✓`
      },
      {
        id: '6',
        name: 'Multiplying and Dividing Fractions',
        order_index: 6,
        completed: false,
        content: `# Multiplying and Dividing Fractions

## Multiplication

To multiply fractions, multiply the numerators together and the denominators together!

### Formula
**a/b × c/d = (a×c)/(b×d)**

### Example 1
**2/3 × 3/4 = ?**
- Numerators: 2 × 3 = 6
- Denominators: 3 × 4 = 12
- Answer: 6/12 = **1/2** ✓

### Example 2: Fraction × Whole Number
**3/4 × 5 = ?**
- Write 5 as 5/1
- 3/4 × 5/1 = 15/4 = **3¾** ✓

## Division

To divide fractions, multiply by the **reciprocal** (flip the second fraction)!

### Formula
**a/b ÷ c/d = a/b × d/c**

### Example
**2/3 ÷ 1/4 = ?**
- Flip 1/4 to get 4/1
- 2/3 × 4/1 = 8/3 = **2⅔** ✓

> 💡 **Tip:** "Keep, Change, Flip"
> - Keep the first fraction
> - Change ÷ to ×
> - Flip the second fraction`
      }
    ]
  });

  const sendMessage = async () => {
    if (!chatInput.trim() || isAITyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsAITyping(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: chatInput,
          context: {
            subject: chapter?.subject_name,
            chapter: chapter?.name,
            topic: chapter?.topics.find(t => t.id === activeTopic)?.name
          }
        })
      });

      const data = await response.json();
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "I'm here to help you learn! What would you like to know about this topic?",
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'd love to help explain this concept! Let me break it down for you step by step. What specific part would you like me to clarify?",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsAITyping(false);
    }
  };

  const quickActions = [
    { icon: '🎓', text: 'Explain this', prompt: 'Explain this topic simply' },
    { icon: '💡', text: 'Give example', prompt: 'Give me a real-world example' },
    { icon: '❓', text: 'I have a doubt', prompt: 'I have a doubt about this' },
    { icon: '🎯', text: 'Test me', prompt: 'Ask me a question to test my understanding' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary-200 rounded-2xl"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chapter) return null;

  const currentTopic = chapter.topics.find(t => t.id === activeTopic);
  const completedCount = chapter.topics.filter(t => t.completed).length;
  const progress = Math.round((completedCount / chapter.topics.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary-50 to-secondary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{chapter.subject_icon}</span>
                  <span>{chapter.subject_name}</span>
                  <span>›</span>
                  <span>Chapter {chapter.chapter_number}</span>
                </div>
                <h1 className="text-lg font-bold text-gray-900">{chapter.name}</h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600">{progress}%</span>
              </div>
              <button
                onClick={() => setShowAIChat(!showAIChat)}
                className={`btn-primary flex items-center gap-2 ${showAIChat ? 'ring-2 ring-primary-300' : ''}`}
              >
                <span>🤖</span>
                <span>AI Tutor</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Topics Sidebar */}
        <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">Topics</h2>
            <p className="text-sm text-gray-500">{completedCount}/{chapter.topics.length} completed</p>
          </div>
          <nav className="p-2">
            {chapter.topics.map((topic, index) => (
              <button
                key={topic.id}
                onClick={() => setActiveTopic(topic.id)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                  activeTopic === topic.id 
                    ? 'bg-primary-50 border-l-4 border-primary-500' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${
                    topic.completed 
                      ? 'bg-success-100 text-success-600' 
                      : activeTopic === topic.id
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {topic.completed ? '✓' : index + 1}
                  </div>
                  <span className={`text-sm font-medium ${
                    activeTopic === topic.id ? 'text-primary-700' : 'text-gray-700'
                  }`}>
                    {topic.name}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Tabs */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6">
            <div className="flex gap-1">
              {[
                { id: 'read', icon: '📖', label: 'Read' },
                { id: 'learn', icon: '🎓', label: 'Learn' },
                { id: 'practice', icon: '✏️', label: 'Practice' },
                { id: 'quiz', icon: '🎯', label: 'Quiz' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-6 max-w-4xl">
            {activeTab === 'read' && currentTopic && (
              <div className="prose prose-lg max-w-none">
                <div 
                  className="markdown-content"
                  dangerouslySetInnerHTML={{ 
                    __html: currentTopic.content
                      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold text-gray-900 mb-4">$1</h1>')
                      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-semibold text-gray-800 mt-8 mb-3">$1</h2>')
                      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold text-gray-700 mt-6 mb-2">$1</h3>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900">$1</strong>')
                      .replace(/\*(.*?)\*/g, '<em>$1</em>')
                      .replace(/^> (.*$)/gm, '<blockquote class="border-l-4 border-primary-400 bg-primary-50 p-4 my-4 rounded-r-lg italic">$1</blockquote>')
                      .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1">$1</li>')
                      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 mb-1"><span class="font-bold">$1.</span> $2</li>')
                      .replace(/\n\n/g, '</p><p class="mb-4">')
                      .replace(/✓/g, '<span class="text-success-500">✓</span>')
                  }}
                />
                
                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => {
                      const currentIndex = chapter.topics.findIndex(t => t.id === activeTopic);
                      if (currentIndex > 0) {
                        setActiveTopic(chapter.topics[currentIndex - 1].id);
                      }
                    }}
                    disabled={chapter.topics.findIndex(t => t.id === activeTopic) === 0}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Previous Topic
                  </button>
                  
                  {!currentTopic.completed && (
                    <button className="btn-primary">
                      ✓ Mark as Complete
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      const currentIndex = chapter.topics.findIndex(t => t.id === activeTopic);
                      if (currentIndex < chapter.topics.length - 1) {
                        setActiveTopic(chapter.topics[currentIndex + 1].id);
                      }
                    }}
                    disabled={chapter.topics.findIndex(t => t.id === activeTopic) === chapter.topics.length - 1}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Topic →
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'learn' && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎓</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Interactive Learning</h2>
                <p className="text-gray-600 mb-6">Learn with personalized explanations from AI Tutor</p>
                <button 
                  onClick={() => setShowAIChat(true)}
                  className="btn-primary"
                >
                  Start Learning with AI →
                </button>
              </div>
            )}

            {activeTab === 'practice' && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">✏️</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Practice Problems</h2>
                <p className="text-gray-600 mb-6">Solve problems to strengthen your understanding</p>
                <Link href={`/subjects/${params.subjectId}/chapter/${params.chapterId}/practice`} className="btn-primary">
                  Start Practice →
                </Link>
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chapter Quiz</h2>
                <p className="text-gray-600 mb-6">Test your knowledge with a quiz</p>
                <Link href={`/subjects/${params.subjectId}/chapter/${params.chapterId}/quiz`} className="btn-primary">
                  Start Quiz →
                </Link>
              </div>
            )}
          </div>
        </main>

        {/* AI Chat Panel */}
        {showAIChat && (
          <aside className="w-96 bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Tutor</h3>
                  <p className="text-xs text-success-500">● Online</p>
                </div>
              </div>
              <button onClick={() => setShowAIChat(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">👋</div>
                  <p className="text-gray-600 mb-2">Hi! I'm your AI tutor.</p>
                  <p className="text-sm text-gray-500">Ask me anything about <strong>{currentTopic?.name}</strong></p>
                </div>
              )}
              
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-primary-500 text-white rounded-br-sm' 
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {isAITyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-t border-gray-100 flex flex-wrap gap-2">
              {quickActions.map(action => (
                <button
                  key={action.text}
                  onClick={() => {
                    setChatInput(action.prompt);
                    sendMessage();
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-primary-50 hover:text-primary-600 rounded-full text-sm font-medium transition-colors"
                >
                  {action.icon} {action.text}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask anything..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || isAITyping}
                  className="px-4 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
