'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserSettings {
  name: string;
  email: string;
  classNumber: number;
  learningStyle: {
    visual: number;
    auditory: number;
    reading: number;
    kinesthetic: number;
  };
  preferences: {
    dailyGoal: number; // minutes
    notifications: boolean;
    sound: boolean;
    darkMode: boolean;
    language: string;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    name: 'Priya Sharma',
    email: 'priya@example.com',
    classNumber: 6,
    learningStyle: { visual: 55, auditory: 12, reading: 8, kinesthetic: 25 },
    preferences: {
      dailyGoal: 30,
      notifications: true,
      sound: true,
      darkMode: false,
      language: 'en'
    }
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'learning' | 'preferences'>('profile');

  const handleSave = async () => {
    setSaving(true);
    // In production, save to Supabase
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-effect border-b border-white/20 hidden lg:block">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'profile', label: 'Profile', icon: '👤' },
            { id: 'learning', label: 'Learning Style', icon: '🎯' },
            { id: 'preferences', label: 'Preferences', icon: '⚙️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-secondary-400 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                {settings.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{settings.name}</h2>
                <p className="text-gray-500">Class {settings.classNumber}</p>
                <button type="button" className="text-sm text-primary-600 hover:underline mt-2">
                  Change Photo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={settings.name}
                  onChange={e => setSettings({ ...settings, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={settings.email}
                  onChange={e => setSettings({ ...settings, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label htmlFor="classNumber" className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  id="classNumber"
                  name="classNumber"
                  value={settings.classNumber}
                  onChange={e => setSettings({ ...settings, classNumber: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="Select your class"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>Class {n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  id="language"
                  name="language"
                  value={settings.preferences.language}
                  onChange={e => setSettings({
                    ...settings,
                    preferences: { ...settings.preferences, language: e.target.value }
                  })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="Select your language"
                >
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h3>
              <div className="flex gap-4">
                <button type="button" className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                  Change Password
                </button>
                <button type="button" className="px-4 py-2 border border-error-200 rounded-lg text-error-600 hover:bg-error-50">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Learning Style Tab */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Learning Style (VARK)</h3>
              <p className="text-gray-500 mb-6">
                Based on your assessment, here's how you learn best:
              </p>

              <div className="space-y-4">
                {[
                  { key: 'visual', label: 'Visual', icon: '👁️', color: 'bg-visual' },
                  { key: 'auditory', label: 'Auditory', icon: '👂', color: 'bg-auditory' },
                  { key: 'reading', label: 'Reading/Writing', icon: '📖', color: 'bg-reading' },
                  { key: 'kinesthetic', label: 'Kinesthetic', icon: '🖐️', color: 'bg-kinesthetic' }
                ].map(style => (
                  <div key={style.key} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                      {style.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-700">{style.label}</span>
                        <span className="font-bold text-gray-900">
                          {settings.learningStyle[style.key as keyof typeof settings.learningStyle]}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${style.color} rounded-full`}
                          style={{ 
                            width: `${settings.learningStyle[style.key as keyof typeof settings.learningStyle]}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/assessment"
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100 transition-colors"
              >
                🔄 Retake Assessment
              </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">How We Adapt Content</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <div className="text-2xl mb-2">👁️</div>
                  <h4 className="font-semibold text-gray-800">Visual Learners</h4>
                  <p className="text-sm text-gray-600">Diagrams, charts, videos, and color-coded content</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="text-2xl mb-2">👂</div>
                  <h4 className="font-semibold text-gray-800">Auditory Learners</h4>
                  <p className="text-sm text-gray-600">Audio explanations, discussions, and verbal instructions</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl">
                  <div className="text-2xl mb-2">📖</div>
                  <h4 className="font-semibold text-gray-800">Reading/Writing</h4>
                  <p className="text-sm text-gray-600">Detailed notes, written explanations, and lists</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <div className="text-2xl mb-2">🖐️</div>
                  <h4 className="font-semibold text-gray-800">Kinesthetic</h4>
                  <p className="text-sm text-gray-600">Hands-on activities, simulations, and practice</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-2xl shadow-md p-6 space-y-6">
            <div>
              <h3 id="daily-goal-label" className="text-lg font-semibold text-gray-900 mb-4">Daily Learning Goal</h3>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="dailyGoal"
                  name="dailyGoal"
                  min="10"
                  max="120"
                  step="10"
                  value={settings.preferences.dailyGoal}
                  onChange={e => setSettings({
                    ...settings,
                    preferences: { ...settings.preferences, dailyGoal: parseInt(e.target.value) }
                  })}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  aria-labelledby="daily-goal-label"
                />
                <span className="text-lg font-bold text-primary-600 min-w-[80px]">
                  {settings.preferences.dailyGoal} min
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-2">
                <span>10 min</span>
                <span>Casual</span>
                <span>Regular</span>
                <span>Serious</span>
                <span>120 min</span>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Push Notifications</p>
                    <p className="text-sm text-gray-500">Get reminders to study</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.preferences.notifications ? "true" : "false"}
                    aria-label="Toggle push notifications"
                    onClick={() => setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, notifications: !settings.preferences.notifications }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.preferences.notifications ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                      settings.preferences.notifications ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-700">Sound Effects</p>
                    <p className="text-sm text-gray-500">Play sounds for achievements</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.preferences.sound ? "true" : "false"}
                    aria-label="Toggle sound effects"
                    onClick={() => setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, sound: !settings.preferences.sound }
                    })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.preferences.sound ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                      settings.preferences.sound ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Appearance</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">Dark Mode</p>
                  <p className="text-sm text-gray-500">Use dark theme (Coming soon)</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked="false"
                  aria-label="Toggle dark mode"
                  disabled
                  className="w-12 h-6 rounded-full bg-gray-200 opacity-50 cursor-not-allowed"
                >
                  <div className="w-5 h-5 bg-white rounded-full shadow translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Save Button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
