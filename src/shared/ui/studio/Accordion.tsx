'use client';

import React, { useState } from 'react';

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  category?: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultExpandedId?: string;
  className?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultExpandedId,
  className = '',
}: AccordionProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>(
    defaultExpandedId ? [defaultExpandedId] : []
  );

  const toggleItem = (id: string) => {
    setExpandedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (allowMultiple) {
        return [...prev, id];
      }
      return [id];
    });
  };

  return (
    <div className={`studio-accordion-group ${className}`.trim()}>
      {items.map((item) => {
        const isExpanded = expandedIds.includes(item.id);
        const buttonId = `acc-btn-${item.id}`;
        const panelId = `acc-panel-${item.id}`;

        return (
          <div
            key={item.id}
            className={`studio-accordion-item ${isExpanded ? 'is-expanded' : ''}`.trim()}
          >
            <button
              id={buttonId}
              type="button"
              className="studio-accordion-trigger"
              onClick={() => toggleItem(item.id)}
              aria-expanded={isExpanded}
              aria-controls={panelId}
            >
              <span className="studio-accordion-title">
                {item.category && (
                  <span className="studio-accordion-cat">{item.category}</span>
                )}
                {item.title}
              </span>

              <span className="studio-accordion-icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="studio-accordion-body"
              hidden={!isExpanded}
            >
              <div className="studio-accordion-content">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
