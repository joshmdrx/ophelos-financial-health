import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/statements", label: "Statements" },
  { to: "/trend", label: "Over time" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">Ophelos · Health</div>
      <nav className="sidebar__nav" aria-label="Main">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              "sidebar__link" + (isActive ? " active" : "")
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <p className="sidebar__hint">
        Your information stays private. We use it only to help you understand
        your position.
      </p>
    </aside>
  );
}
