'use client';

import React, { useState } from 'react';
import { useTeachingMethods } from '@/hooks/upgrade';
import { MethodCard } from '@/components/ui/upgrade';
import { LoadingSpinner, Card } from '@/components/ui/index';
import Link from 'next/link';
import type { MethodCategory } from '@/types/upgrade';

export default function MethodsPage() {
  const [activeCategory, setActiveCategory] = useState<MethodCategory | 'all'>('all');
  const { methods, loading } = useTeachingMethods(
    activeCategory !== 'all' ? { category: activeCategory } : undefined
  );

  const categories = [
    { key: 'all', label: 'All Methods', icon: '📚', count: methods.length },
    { key: 'modern', label: 'Modern', icon: '💡', count: methods.filter(m => m.category === 'modern').length },
    { key: 'ancient', label: 'Ancient Wisdom', icon: '🕉️', count: methods.filter(m => m.category === 'ancient').length },
    { key: 'scientific', label: 'Scientific', icon: '🧪', count: methods.filter(m => m.category === 'scientific').length },
  ];

  const filtered = activeCategory === 'all' ? methods : methods.filter(m => m.category === activeCategory);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">📚 Teaching Methods Library</h1>
        <p className="text-gray-400">
          20+ proven techniques from ancient wisdom to modern science.
          Find the method that clicks for you!
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat.key
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
            <span className="text-[10px] opacity-60">({cat.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Category descriptions */}
          {activeCategory === 'ancient' && (
            <Card className="p-4 mb-6 border-amber-500/20 bg-amber-900/10">
              <p className="text-sm text-amber-200">
                🙏 These methods come from thousands of years of Indian and global wisdom traditions.
                From Vedic Mathematics to the Socratic method, these time-tested approaches are
                proven by centuries of successful teaching.
              </p>
            </Card>
          )}

          {activeCategory === 'scientific' && (
            <Card className="p-4 mb-6 border-green-500/20 bg-green-900/10">
              <p className="text-sm text-green-200">
                🧪 These methods are backed by modern cognitive science and education research.
                Peer-reviewed studies have shown their effectiveness for long-term learning and retention.
              </p>
            </Card>
          )}

          {/* Methods grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(method => (
              <div key={method.id} className="relative group">
                <MethodCard
                  code={method.code}
                  name={method.name}
                  nameHindi={method.name_hindi || undefined}
                  category={method.category}
                  description={method.description}
                  icon={method.icon || '📖'}
                  bestForVark={method.best_for_vark}
                  onClick={() => window.location.href = `/methods/${method.code}`}
                />
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={`/methods/${method.code}`} className="px-2 py-1 bg-gray-900/90 rounded text-[10px] text-primary-400 hover:text-white">Road →</a>
                  <a href={`/guru?method=${method.code}`} className="px-2 py-1 bg-gray-900/90 rounded text-[10px] text-accent-400 hover:text-white">Guru →</a>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No methods found in this category.</p>
            </div>
          )}
        </>
      )}

      {/* How to use section */}
      <div className="mt-12 p-6 bg-gray-800/50 border border-gray-700 rounded-2xl">
        <h2 className="text-xl font-bold text-white mb-4">How to Use These Methods</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-900 rounded-xl">
            <span className="text-2xl block mb-2">1️⃣</span>
            <h3 className="font-medium text-white text-sm mb-1">Choose a Method</h3>
            <p className="text-xs text-gray-400">Pick one that matches your learning style or try something new!</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl">
            <span className="text-2xl block mb-2">2️⃣</span>
            <h3 className="font-medium text-white text-sm mb-1">Ask AI Guru</h3>
            <p className="text-xs text-gray-400">Click any method to open AI Guru with that method pre-selected.</p>
          </div>
          <div className="p-4 bg-gray-900 rounded-xl">
            <span className="text-2xl block mb-2">3️⃣</span>
            <h3 className="font-medium text-white text-sm mb-1">Rate & Track</h3>
            <p className="text-xs text-gray-400">Rate how well each method works for you. We'll learn your preferences!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
