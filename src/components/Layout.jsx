import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        <main className="px-8 py-10 w-full xl:max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
