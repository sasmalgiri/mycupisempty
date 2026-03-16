'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type NotificationType = 'daily_reminder' | 'streak_warning' | 'concern_flag' | 'weekly_digest';

interface QuietHours {
  start: number | null;
  end: number | null;
}

interface TelegramStatus {
  linked: boolean;
  telegram_chat_id: string | null;
  notification_types: NotificationType[] | null;
  quiet_hours: QuietHours | null;
}

export default function NotificationSettingsPage() {
  const [status, setStatus] = useState<TelegramStatus>({
    linked: false,
    telegram_chat_id: null,
    notification_types: null,
    quiet_hours: null,
  });
  const [chatIdInput, setChatIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/telegram');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch {
      console.error('Failed to fetch notification status');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleLink = async () => {
    if (!chatIdInput.trim()) {
      showMessage('Please enter your Telegram Chat ID', 'error');
      return;
    }

    setActionLoading('link');
    try {
      const response = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          telegram_chat_id: chatIdInput.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Telegram linked successfully!', 'success');
        setChatIdInput('');
        await fetchStatus();
      } else {
        showMessage(data.error || 'Failed to link', 'error');
      }
    } catch {
      showMessage('Failed to link Telegram', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlink = async () => {
    setActionLoading('unlink');
    try {
      const response = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlink' }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Telegram unlinked', 'success');
        setStatus({
          linked: false,
          telegram_chat_id: null,
          notification_types: null,
          quiet_hours: null,
        });
      } else {
        showMessage(data.error || 'Failed to unlink', 'error');
      }
    } catch {
      showMessage('Failed to unlink Telegram', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTest = async () => {
    setActionLoading('test');
    try {
      const response = await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_test' }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage('Test message sent! Check your Telegram.', 'success');
      } else {
        showMessage(data.error || 'Failed to send test', 'error');
      }
    } catch {
      showMessage('Failed to send test message', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePreference = async (
    key: NotificationType,
    currentlyEnabled: boolean
  ) => {
    const current = status.notification_types || ['daily_reminder', 'streak_warning', 'weekly_digest'];
    const newTypes = currentlyEnabled
      ? current.filter((t) => t !== key)
      : [...current, key];

    // Optimistic update
    setStatus((prev) => ({ ...prev, notification_types: newTypes }));

    try {
      await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          notification_types: newTypes,
        }),
      });
    } catch {
      // Revert on failure
      fetchStatus();
    }
  };

  const handleQuietHoursChange = async (field: 'start' | 'end', value: string) => {
    const hour = parseInt(value.split(':')[0], 10);
    const newQuietHours = {
      start: field === 'start' ? hour : (status.quiet_hours?.start ?? 22),
      end: field === 'end' ? hour : (status.quiet_hours?.end ?? 7),
    };

    setStatus((prev) => ({ ...prev, quiet_hours: newQuietHours }));

    try {
      await fetch('/api/notifications/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_preferences',
          quiet_hours_start: newQuietHours.start,
          quiet_hours_end: newQuietHours.end,
        }),
      });
    } catch {
      fetchStatus();
    }
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-effect border-b border-white/20 hidden lg:block">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/settings"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                &larr; Settings
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Message */}
        {message && (
          <div
            className={`p-4 rounded-xl text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Telegram Section */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.46-1.9-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.12.098.153.228.168.363.016.135.035.313.02.483z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Telegram</h2>
              {status.linked ? (
                <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Connected
                </span>
              ) : (
                <span className="text-sm text-gray-500">Not connected</span>
              )}
            </div>
          </div>

          {!status.linked ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-medium text-gray-800 mb-3">
                  How to connect Telegram:
                </h3>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary-600">1.</span>
                    Open our Telegram bot (search for @MyCupIsEmptyBot)
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary-600">2.</span>
                    Send <code className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">/start</code> to the bot
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary-600">3.</span>
                    The bot will reply with your Chat ID - copy it
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary-600">4.</span>
                    Paste your Chat ID below and click Link
                  </li>
                </ol>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={chatIdInput}
                  onChange={(e) => setChatIdInput(e.target.value)}
                  placeholder="Enter your Telegram Chat ID"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={handleLink}
                  disabled={actionLoading === 'link'}
                  className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'link' ? 'Linking...' : 'Link'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleSendTest}
                disabled={actionLoading === 'test'}
                className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'test' ? 'Sending...' : 'Send Test'}
              </button>
              <button
                onClick={handleUnlink}
                disabled={actionLoading === 'unlink'}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'unlink' ? 'Unlinking...' : 'Unlink'}
              </button>
            </div>
          )}
        </div>

        {/* Notification Types */}
        {status.linked && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Notification Types
            </h3>
            <div className="space-y-4">
              {([
                {
                  key: 'daily_reminder' as NotificationType,
                  label: 'Daily Reminder',
                  description: 'Get a daily reminder to study and complete habits',
                },
                {
                  key: 'streak_warning' as NotificationType,
                  label: 'Streak Warnings',
                  description: 'Get warned when a streak is about to break',
                },
                {
                  key: 'weekly_digest' as NotificationType,
                  label: 'Weekly Digest',
                  description: 'Receive a weekly summary of your progress',
                },
                {
                  key: 'concern_flag' as NotificationType,
                  label: 'Concern Flags',
                  description:
                    'Alert parents/guardians about engagement concerns',
                },
              ]).map((item) => {
                const isEnabled = (status.notification_types || []).includes(item.key);
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-700">{item.label}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      aria-label={`Toggle ${item.label}`}
                      onClick={() => handleTogglePreference(item.key, isEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        isEnabled ? 'bg-primary-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quiet Hours */}
        {status.linked && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Quiet Hours
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              No notifications will be sent during these hours.
            </p>
            <div className="flex items-center gap-4">
              <div>
                <label
                  htmlFor="quiet-start"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  Start
                </label>
                <select
                  id="quiet-start"
                  value={`${String(status.quiet_hours?.start ?? 22).padStart(2, '0')}:00`}
                  onChange={(e) =>
                    handleQuietHoursChange('start', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="Quiet hours start time"
                >
                  {timeOptions.map((t) => (
                    <option key={`start-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-gray-400 mt-6">to</span>
              <div>
                <label
                  htmlFor="quiet-end"
                  className="block text-sm font-medium text-gray-600 mb-1"
                >
                  End
                </label>
                <select
                  id="quiet-end"
                  value={`${String(status.quiet_hours?.end ?? 7).padStart(2, '0')}:00`}
                  onChange={(e) =>
                    handleQuietHoursChange('end', e.target.value)
                  }
                  className="px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  title="Quiet hours end time"
                >
                  {timeOptions.map((t) => (
                    <option key={`end-${t}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Back link for mobile */}
        <div className="lg:hidden pt-4">
          <Link
            href="/settings"
            className="text-primary-600 font-medium hover:underline"
          >
            &larr; Back to Settings
          </Link>
        </div>
      </main>
    </div>
  );
}
