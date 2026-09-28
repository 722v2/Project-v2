/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LayoutDashboard, Radar, Radio, Briefcase, Settings } from 'lucide-react';
import { NavTab } from './TopBar.tsx';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  activeSignalsCount?: number;
  activeTradesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
  activeSignalsCount = 0,
  activeTradesCount = 0,
}) => {
  const tabs = [
    { id: 'dashboard' as NavTab, label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'scanner' as NavTab, label: 'السكانر', icon: Radar },
    {
      id: 'signals' as NavTab,
      label: 'الإشارات',
      icon: Radio,
      badge: activeSignalsCount > 0 ? activeSignalsCount : undefined,
    },
    {
      id: 'trades' as NavTab,
      label: 'الصفقات',
      icon: Briefcase,
      badge: activeTradesCount > 0 ? activeTradesCount : undefined,
    },
    { id: 'settings' as NavTab, label: 'الإعدادات', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0E17]/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1">
      <div className="grid grid-cols-5 items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] transition-colors relative cursor-pointer ${
                isActive ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.7]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1 -left-2 bg-amber-500 text-slate-950 text-[9px] font-bold font-mono rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
