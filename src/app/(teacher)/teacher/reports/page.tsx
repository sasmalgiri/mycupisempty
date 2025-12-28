'use client';

import Link from 'next/link';

export default function ReportsPage() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Generate and manage student progress reports</p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Reports Coming Soon</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Generate detailed progress reports for students and share them with parents.
          This feature is currently under development.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-3xl mb-2">📊</div>
            <h4 className="font-medium text-gray-900">Progress Reports</h4>
            <p className="text-sm text-gray-500">Track student progress over time</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-3xl mb-2">🧠</div>
            <h4 className="font-medium text-gray-900">VARK Insights</h4>
            <p className="text-sm text-gray-500">Learning style analysis</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-3xl mb-2">👨‍👩‍👧</div>
            <h4 className="font-medium text-gray-900">Parent Sharing</h4>
            <p className="text-sm text-gray-500">Share reports with parents</p>
          </div>
        </div>
      </div>
    </div>
  );
}
