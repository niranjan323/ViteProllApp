import { Routes, Route } from 'react-router-dom';
import './App.css';
import MainLayout from './Component/MainLayout';
import Home from './pages/Home';
import Project from './pages/Project';

function App()
{
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="/project" element={<Project />} />
        {/* Add more routes here as needed */}
      </Route>
    </Routes>
  );
}

export default App;
