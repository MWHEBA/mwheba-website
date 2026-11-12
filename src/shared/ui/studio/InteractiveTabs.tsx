'use client';

import React, { useState } from 'react';

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
}

export interface InteractiveTabsProps {
  items: TabItem[];
  defaultTabId?: string;
  className?: string;
  variant?: 'pill' | 'underline' | 'contained';
}

export function InteractiveTabs({
  items,
  defaultTabId,
  className = '',
  variant = 'pill',
}: InteractiveTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(
    defaultTabId || (items.length > 0 ? items[0].id : '')
  );

  const activeItem = items.find((item) => item.id === activeTab) || items[0];

  return (
    <div className={`interactive-tabs-container ${className}`.trim()}>
      {/* Tab Navigation List */}
      <div
        className={`interactive-tablist variant-${variant}`}
        role="tablist"
        aria-label="Features navigation"
      >
        {items.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={`interactive-tab-btn ${isActive ? 'is-active' : ''}`.trim()}
            >
              {tab.icon && <span className="tab-icon">{tab.icon}</span>}
              <span className="tab-label">{tab.label}</span>
              {tab.badge && <span className="tab-badge">{tab.badge}</span>}
            </button>
          );
        })}
      </div>

      {/* Tab Content Panel */}
      {activeItem && (
        <div
          id={`panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeItem.id}`}
          className="interactive-tabpanel"
        >
          {activeItem.content}
        </div>
      )}
    </div>
  );
}
