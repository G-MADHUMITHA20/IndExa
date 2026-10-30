import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  User,
  LogOut,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function TeacherSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/teacher/dashboard',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/teacher/exams',
      label: 'Exam Management',
      icon: FileText,
      end: true,
    },
    {
      to: '/teacher/exams/create',
      label: 'Create New Exam',
      icon: PlusCircle,
      end: true,
    },
    {
      to: '/teacher/profile',
      label: 'Faculty Profile',
      icon: User,
      end: true,
    },
  ];

  return (
    <aside
      aria-label="Teacher Portal Navigation"
      className="w-full md:w-64 bg-slate-900/90 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0"
    >
      {/* Faculty Portal Header */}
      <div className="p-5 border-b border-slate-800/80 hidden md:block">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <GraduationCap className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Faculty Console</h2>
            <p className="text-[11px] text-slate-400">Academic Examination Suite</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="p-3 md:p-4 space-y-1.5 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Section at Bottom */}
      <div className="mt-auto p-4 border-t border-slate-800/80 hidden md:block space-y-3">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs uppercase">
            {user?.name ? user.name[0] : 'T'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Faculty Member'}</p>
            <p className="text-[10px] text-purple-400 font-medium uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 inline" aria-hidden="true" />
              Teacher Role
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
          aria-label="Sign out of teacher portal"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
