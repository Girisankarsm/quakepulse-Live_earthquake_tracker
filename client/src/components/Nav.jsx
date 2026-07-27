import { NAV } from './icons';

export function BottomNav({ page, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className="nav-item"
          aria-current={page === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export function SideNav({ page, onChange }) {
  return (
    <nav className="side-nav" aria-label="Primary">
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className="nav-item"
          aria-current={page === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
