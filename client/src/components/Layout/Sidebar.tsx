import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const nav = [
  { to: '/labels', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z', label: 'Label Creator' },
  { to: '/products', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', label: 'Products' },
  { to: '/templates', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z', label: 'Templates' },
  { to: '/print', icon: 'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z', label: 'Print' },
  { to: '/print-history', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Print History' },
  { to: '/print-queue', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z', label: 'Print Queue' },
];

const adminNav = [
  { to: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', label: 'Users' },
  { to: '/admin/printers', icon: 'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z', label: 'Printers' },
  { to: '/admin/audit-log', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z', label: 'Audit Log' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className={`bg-gray-900 border-r border-gray-700 flex flex-col transition-all ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="p-3 border-b border-gray-700 flex items-center gap-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"
        >
          <span className="text-white text-xs font-bold">GS1</span>
        </button>
        {!collapsed && <span className="text-white font-semibold text-sm">Label System</span>}
      </div>

      <div className="flex-1 py-2">
        {nav.map(n => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={n.icon} />
            </svg>
            {!collapsed && <span>{n.label}</span>}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            {!collapsed && <div className="px-3 py-2 mt-4"><span className="text-xs text-gray-600 uppercase tracking-wider">Admin</span></div>}
            {collapsed && <div className="border-t border-gray-700 my-2 mx-2" />}
            {adminNav.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border-r-2 border-blue-400'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={n.icon} />
                </svg>
                {!collapsed && <span>{n.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </div>

      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.username}</p>
              <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="text-gray-500 hover:text-white" title="Logout">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
