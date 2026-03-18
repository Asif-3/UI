import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, UploadCloud } from 'lucide-react';
import logo from '../assets/logo.png';

const Sidebar = () => {
  return (
    <div className="flex flex-col w-64 shrink-0 h-screen bg-white text-gray-700 shadow-xl border-r border-gray-100">
      {/* Header with Logo */}
      <div className="flex items-center h-20 px-6 border-b border-gray-100">
        <img src={logo} alt="GM TEK Logo" className="h-6" />
        <div className="ml-2 flex items-baseline leading-none">

          <span className="ml-1 text-lg font-bold text-gray-800 tracking-tight">TalentConnect</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="px-4 space-y-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${isActive ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`
            }
          >
            <Home className="w-5 h-5 mr-3" />
            <span className="text-sm">Dashboard</span>
          </NavLink>

          <NavLink
            to="/upload"
            className={({ isActive }) =>
              `flex items-center px-4 py-3 rounded-lg transition-colors duration-200 ${isActive ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
              }`
            }
          >
            <UploadCloud className="w-5 h-5 mr-3" />
            <span className="text-sm">Upload Resume</span>
          </NavLink>
        </nav>
      </div>

      {/* Footer User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold border border-blue-200">
            A
          </div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-gray-900">Administrator</p>
            <p className="text-xs text-gray-500 font-medium">Recruitment Team</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
