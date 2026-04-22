import { NavLink } from 'react-router-dom';

export interface SubTabItem {
  to: string;
  label: string;
}

interface Props {
  items: SubTabItem[];
}

/**
 * Horizontal sub-tab bar shown at the top of a "parent group" page
 * (Rezultati, Nagrade). Renders one NavLink per child route. The active
 * tab is highlighted via React Router's `isActive` state, with `end`
 * matching so the parent only lights up for its exact path.
 *
 * Scrolls horizontally on narrow viewports so we never cut tabs off;
 * touch targets stay ≥44px per the project's mobile rules.
 */
export function SubTabs({ items }: Props) {
  return (
    <div className="border-b border-surface-4 bg-surface-0/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] gap-1 overflow-x-auto px-page-x lg:px-page-x-lg">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                'relative whitespace-nowrap px-4 py-3 text-sm font-600 transition-colors',
                'min-h-touch inline-flex items-center',
                isActive
                  ? 'text-ink-primary after:absolute after:bottom-0 after:left-3 after:right-3 after:h-[2px] after:bg-brand-400'
                  : 'text-ink-secondary hover:text-ink-primary',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
