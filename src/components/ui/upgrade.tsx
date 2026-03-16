'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================
// SLIDER (Difficulty 1-10, etc.)
// ============================================
interface SliderProps {
  min?: number;
  max?: number;
  value: number;
  onChange: (value: number) => void;
  labels?: Record<number, string>;
  className?: string;
  showValue?: boolean;
}

export function Slider({ min = 1, max = 10, value, onChange, labels, className = '', showValue = true }: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`w-full ${className}`}>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
          style={{
            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${percentage}%, #3f3f46 ${percentage}%, #3f3f46 100%)`,
          }}
        />
        {showValue && (
          <div
            className="absolute -top-8 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-md font-medium"
            style={{ left: `calc(${percentage}% - 12px)` }}
          >
            {labels?.[value] || value}
          </div>
        )}
      </div>
      {labels && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">{labels[min] || min}</span>
          <span className="text-xs text-gray-500">{labels[max] || max}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// RADAR CHART (SVG-based for Learning DNA)
// ============================================
interface RadarChartProps {
  data: { label: string; value: number; maxValue?: number }[];
  size?: number;
  color?: string;
  className?: string;
}

export function RadarChart({ data, size = 250, color = '#8b5cf6', className = '' }: RadarChartProps) {
  const center = size / 2;
  const radius = size * 0.38;
  const levels = 5;
  const angleStep = (2 * Math.PI) / data.length;

  const getPoint = (index: number, value: number, maxVal: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = data.map((_, j) => {
      const angle = angleStep * j - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    });
    return points.join(' ');
  });

  const dataPoints = data.map((d, i) => {
    const point = getPoint(i, d.value, d.maxValue || 100);
    return `${point.x},${point.y}`;
  });

  return (
    <svg width={size} height={size} className={className} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {gridLines.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {data.map((_, i) => {
        const point = getPoint(i, 100, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={point.x}
            y2={point.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints.join(' ')}
        fill={`${color}33`}
        stroke={color}
        strokeWidth="2"
      />

      {/* Data points */}
      {data.map((d, i) => {
        const point = getPoint(i, d.value, d.maxValue || 100);
        return (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="1.5"
          />
        );
      })}

      {/* Labels */}
      {data.map((d, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const labelR = radius + 28;
        const x = center + labelR * Math.cos(angle);
        const y = center + labelR * Math.sin(angle);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.8)"
            fontSize="11"
            fontFamily="Outfit, sans-serif"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ============================================
// DRAG DROP ZONE (HTML5 Drag API)
// ============================================
interface DragDropItem {
  id: string;
  content: string;
  imageUrl?: string;
}

interface DragDropZoneProps {
  items: DragDropItem[];
  onDrop: (itemId: string, zoneId: string) => void;
  zoneId: string;
  label: string;
  droppedItems?: DragDropItem[];
  className?: string;
  isCorrect?: boolean | null;
}

export function DraggableItem({ item, className = '' }: { item: DragDropItem; className?: string }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg cursor-grab active:cursor-grabbing
                  hover:border-primary-400 hover:bg-gray-750 transition-all select-none ${className}`}
    >
      {item.imageUrl && (
        <img src={item.imageUrl} alt="" className="w-8 h-8 mb-1 rounded" />
      )}
      <span className="text-sm text-white">{item.content}</span>
    </div>
  );
}

export function DropZone({ onDrop, zoneId, label, droppedItems = [], className = '', isCorrect }: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const borderColor = isCorrect === true
    ? 'border-green-500 bg-green-500/10'
    : isCorrect === false
      ? 'border-red-500 bg-red-500/10'
      : isDragOver
        ? 'border-primary-400 bg-primary-500/10'
        : 'border-gray-600 border-dashed';

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const itemId = e.dataTransfer.getData('text/plain');
        onDrop(itemId, zoneId);
      }}
      className={`min-h-[80px] p-3 border-2 rounded-xl transition-all ${borderColor} ${className}`}
    >
      <p className="text-xs text-gray-400 mb-2 font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {droppedItems.map((item) => (
          <div key={item.id} className="px-2 py-1 bg-primary-600/20 border border-primary-500 rounded text-sm text-white">
            {item.content}
          </div>
        ))}
        {droppedItems.length === 0 && (
          <p className="text-xs text-gray-500 italic">Drop items here</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// TIMER (Countdown for challenges)
// ============================================
interface TimerProps {
  totalSeconds: number;
  onComplete: () => void;
  isRunning?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Timer({ totalSeconds, onComplete, isRunning = true, className = '', size = 'md' }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    setRemaining(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!isRunning || remaining <= 0) {
      if (remaining <= 0) onComplete();
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, remaining, onComplete]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percentage = (remaining / totalSeconds) * 100;
  const isLow = percentage < 20;

  const sizeClasses = {
    sm: 'text-lg px-2 py-1',
    md: 'text-2xl px-4 py-2',
    lg: 'text-4xl px-6 py-3',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-xl font-mono font-bold
      ${isLow ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-gray-800 text-white'}
      ${sizeClasses[size]} ${className}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.3" />
        <path
          d={`M12 2a10 10 0 0 1 0 20a10 10 0 0 1 0-20`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 0.628} 62.8`}
        />
      </svg>
      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}

// ============================================
// METHOD CARD (Teaching method display)
// ============================================
interface MethodCardProps {
  code: string;
  name: string;
  nameHindi?: string;
  category: 'modern' | 'ancient' | 'scientific';
  description: string;
  icon: string;
  bestForVark?: string[];
  onClick?: () => void;
  isSelected?: boolean;
  matchScore?: number;
  className?: string;
}

export function MethodCard({
  name, nameHindi, category, description, icon, bestForVark,
  onClick, isSelected, matchScore, className = '',
}: MethodCardProps) {
  const categoryColors = {
    modern: 'from-blue-600/20 to-blue-800/20 border-blue-500/30',
    ancient: 'from-amber-600/20 to-amber-800/20 border-amber-500/30',
    scientific: 'from-green-600/20 to-green-800/20 border-green-500/30',
  };

  const categoryBadge = {
    modern: 'bg-blue-500/20 text-blue-400',
    ancient: 'bg-amber-500/20 text-amber-400',
    scientific: 'bg-green-500/20 text-green-400',
  };

  return (
    <div
      onClick={onClick}
      className={`relative p-4 rounded-xl border bg-gradient-to-br cursor-pointer transition-all
        hover:scale-[1.02] hover:shadow-lg
        ${categoryColors[category]}
        ${isSelected ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        ${className}`}
    >
      {matchScore !== undefined && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-bold">
          {matchScore}% match
        </div>
      )}

      <div className="text-3xl mb-2">{icon}</div>
      <h3 className="font-semibold text-white text-sm">{name}</h3>
      {nameHindi && <p className="text-xs text-gray-400">{nameHindi}</p>}

      <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryBadge[category]}`}>
        {category}
      </span>

      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{description}</p>

      {bestForVark && bestForVark.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {bestForVark.map((style) => (
            <span key={style} className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
              {style}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// CHARACTER TRAIT BAR
// ============================================
interface CharacterTraitBarProps {
  trait: string;
  score: number;
  targetScore?: number;
  icon?: string;
  color?: string;
  className?: string;
}

export function CharacterTraitBar({
  trait, score, targetScore, icon, color = '#8b5cf6', className = '',
}: CharacterTraitBarProps) {
  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          <span className="text-sm text-white font-medium capitalize">{trait.replace(/_/g, ' ')}</span>
        </div>
        <span className="text-xs text-gray-400">
          {score}/100
          {targetScore && <span className="text-primary-400 ml-1">(target: {targetScore})</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
        {targetScore && (
          <div
            className="absolute top-0 h-full w-0.5 bg-white/60"
            style={{ left: `${targetScore}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// LEARNING ROAD / PATH VISUALIZATION
// ============================================
interface RoadStep {
  id: string;
  title: string;
  description?: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered';
  xp?: number;
  icon?: string;
}

interface LearningRoadProps {
  steps: RoadStep[];
  onStepClick?: (step: RoadStep) => void;
  className?: string;
}

export function LearningRoad({ steps, onStepClick, className = '' }: LearningRoadProps) {
  const statusStyles: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    locked: { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-500', glow: '' },
    available: { bg: 'bg-gray-700', border: 'border-primary-500', text: 'text-white', glow: 'shadow-lg shadow-primary-500/20' },
    in_progress: { bg: 'bg-primary-900/50', border: 'border-primary-400', text: 'text-primary-300', glow: 'shadow-lg shadow-primary-500/30 animate-pulse' },
    completed: { bg: 'bg-green-900/30', border: 'border-green-500', text: 'text-green-400', glow: '' },
    mastered: { bg: 'bg-amber-900/30', border: 'border-amber-400', text: 'text-amber-400', glow: 'shadow-lg shadow-amber-500/20' },
  };

  const statusIcons: Record<string, string> = {
    locked: '🔒',
    available: '▶️',
    in_progress: '📖',
    completed: '✅',
    mastered: '⭐',
  };

  return (
    <div className={`relative ${className}`}>
      {steps.map((step, index) => {
        const style = statusStyles[step.status];
        const isClickable = step.status !== 'locked';

        return (
          <div key={step.id} className="relative">
            {/* Connecting line */}
            {index > 0 && (
              <div className="absolute left-6 -top-4 w-0.5 h-4 bg-gray-600" />
            )}

            <div
              onClick={() => isClickable && onStepClick?.(step)}
              className={`flex items-center gap-4 p-3 rounded-xl border-2 mb-2 transition-all
                ${style.bg} ${style.border} ${style.glow}
                ${isClickable ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-not-allowed opacity-60'}`}
            >
              <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-current flex items-center justify-center text-lg flex-shrink-0">
                {step.icon || statusIcons[step.status]}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm ${style.text}`}>{step.title}</h4>
                {step.description && (
                  <p className="text-xs text-gray-500 truncate">{step.description}</p>
                )}
              </div>

              {step.xp && (
                <span className="text-xs font-bold text-primary-400 flex-shrink-0">
                  +{step.xp} XP
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// BUDDY CHAT BUBBLE
// ============================================
interface BuddyBubbleProps {
  message: string;
  mood?: 'happy' | 'thinking' | 'encouraging' | 'celebrating';
  className?: string;
  onClose?: () => void;
}

export function BuddyBubble({ message, mood = 'happy', className = '', onClose }: BuddyBubbleProps) {
  const moodEmojis = {
    happy: '😊',
    thinking: '🤔',
    encouraging: '💪',
    celebrating: '🎉',
  };

  return (
    <div className={`flex items-start gap-3 p-4 bg-gradient-to-r from-primary-900/40 to-accent-900/40
                      border border-primary-500/30 rounded-2xl ${className}`}>
      <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-xl flex-shrink-0">
        {moodEmojis[mood]}
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-200 leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
      )}
    </div>
  );
}

// ============================================
// BOARD/SYLLABUS SELECTOR
// ============================================
interface BoardSelectorProps {
  boards: { code: string; name: string; icon?: string }[];
  selectedBoard: string;
  onSelect: (board: string) => void;
  className?: string;
}

export function BoardSelector({ boards, selectedBoard, onSelect, className = '' }: BoardSelectorProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {boards.map((board) => (
        <button
          key={board.code}
          onClick={() => onSelect(board.code)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${selectedBoard === board.code
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
            }`}
        >
          {board.icon && <span className="mr-1">{board.icon}</span>}
          {board.name}
        </button>
      ))}
    </div>
  );
}

// ============================================
// MEDIA VIEWER (Video, Image, Whiteboard, Tools)
// ============================================
interface MediaViewerProps {
  type: 'video' | 'image' | 'whiteboard' | 'iframe' | 'pdf';
  url: string;
  title?: string;
  className?: string;
}

export function MediaViewer({ type, url, title, className = '' }: MediaViewerProps) {
  if (type === 'video') {
    return (
      <div className={`relative rounded-xl overflow-hidden bg-black ${className}`}>
        {title && <h4 className="absolute top-2 left-2 z-10 px-2 py-1 bg-black/70 rounded text-xs text-white">{title}</h4>}
        <video src={url} controls className="w-full aspect-video" />
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className={`rounded-xl overflow-hidden ${className}`}>
        {title && <p className="text-xs text-gray-400 mb-1">{title}</p>}
        <img src={url} alt={title || ''} className="w-full rounded-lg" />
      </div>
    );
  }

  if (type === 'iframe' || type === 'whiteboard') {
    return (
      <div className={`rounded-xl overflow-hidden border border-gray-700 ${className}`}>
        {title && <div className="px-3 py-2 bg-gray-800 text-xs text-gray-400 border-b border-gray-700">{title}</div>}
        <iframe src={url} className="w-full aspect-video border-0" allowFullScreen />
      </div>
    );
  }

  if (type === 'pdf') {
    return (
      <div className={`rounded-xl overflow-hidden border border-gray-700 ${className}`}>
        {title && <div className="px-3 py-2 bg-gray-800 text-xs text-gray-400 border-b border-gray-700">{title}</div>}
        <iframe src={url} className="w-full h-[600px] border-0" />
      </div>
    );
  }

  return null;
}

// ============================================
// SCORE DISPLAY (XP animation)
// ============================================
interface ScoreDisplayProps {
  score: number;
  maxScore: number;
  xpEarned?: number;
  label?: string;
  className?: string;
}

export function ScoreDisplay({ score, maxScore, xpEarned, label = 'Score', className = '' }: ScoreDisplayProps) {
  const percentage = Math.round((score / maxScore) * 100);
  const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' : percentage >= 70 ? 'B' :
    percentage >= 60 ? 'C' : percentage >= 50 ? 'D' : 'F';
  const gradeColor = percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`text-center p-6 bg-gray-800/50 rounded-2xl border border-gray-700 ${className}`}>
      <p className="text-sm text-gray-400 mb-2">{label}</p>
      <div className={`text-5xl font-bold ${gradeColor} mb-1`}>{grade}</div>
      <p className="text-xl text-white font-semibold">{score}/{maxScore}</p>
      <p className="text-sm text-gray-400">{percentage}%</p>
      {xpEarned && (
        <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-primary-600/20 border border-primary-500/30 rounded-full">
          <span className="text-primary-400 font-bold text-sm">+{xpEarned} XP</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAM LIFECYCLE TABS
// ============================================
interface ExamTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function ExamTabs({ activeTab, onTabChange, className = '' }: ExamTabsProps) {
  const tabs = [
    { id: 'syllabus', label: 'Syllabus', icon: '📋' },
    { id: 'learn', label: 'Learn', icon: '📖' },
    { id: 'practice', label: 'Practice', icon: '✏️' },
    { id: 'model_papers', label: 'Model Papers', icon: '📝' },
    { id: 'evaluate', label: 'Evaluate', icon: '📊' },
    { id: 'revise', label: 'Revise', icon: '🔄' },
  ];

  return (
    <div className={`flex overflow-x-auto gap-1 p-1 bg-gray-800 rounded-xl ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
            ${activeTab === tab.id
              ? 'bg-primary-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
